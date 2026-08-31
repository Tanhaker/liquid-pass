//! Subscription passes as time-bound, resellable NFTs.
//!
//! Minimal ERC-721-*like*: it emits a standard `Transfer(address,address,
//! uint256)` so a subgraph can index it, but it is NOT ERC-721 compliant.
//! There are no approvals, no operators, no enumeration and no metadata URI,
//! so it will not work with generic NFT marketplaces or wallets. Resale goes
//! through `buy` on this contract only.
//!
//! Deployed separately from PassKeyWallet, which is untouched.

#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

// The #[public] macro expands to code using Vec, which is not in the no_std prelude.
use alloc::{vec, vec::Vec};

use stylus_sdk::alloy_primitives::{Address, U256};
use stylus_sdk::alloy_sol_types::sol;
use stylus_sdk::call::transfer::transfer_eth;
use stylus_sdk::prelude::*;

/// Issuer's cut of every resale, as a divisor: price / 10 == 10%.
const ROYALTY_DIVISOR: u64 = 10;

sol! {
    /// A new pass was issued.
    event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry);
    /// Owner offered a pass for resale.
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    /// Owner withdrew a pass from sale.
    event Unlisted(uint256 indexed tokenId, address indexed seller);
    /// A pass changed hands, with the payment split recorded.
    event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty);
    /// ERC-721-shaped ownership change, so standard indexers understand it.
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
}

sol_storage! {
    #[entrypoint]
    pub struct Subscription {
        mapping(uint256 => address) owners;
        mapping(uint256 => uint256) expiries;
        mapping(uint256 => address) issuers;
        /// 0 means "not for sale", so a listing price of 0 is rejected.
        mapping(uint256 => uint256) prices;
        uint256 next_token_id;
    }
}

#[public]
impl Subscription {
    /// Issue a pass to `to`, valid for `duration_seconds` from now.
    ///
    /// The caller becomes the issuer and earns the royalty on every future
    /// resale of this token.
    #[payable]
    pub fn mint(&mut self, to: Address, duration_seconds: U256) -> Result<U256, Vec<u8>> {
        if to.is_zero() {
            return Err(b"zero recipient".to_vec());
        }
        if duration_seconds.is_zero() {
            return Err(b"zero duration".to_vec());
        }
        let duration: u64 = duration_seconds
            .try_into()
            .map_err(|_| b"duration too large".to_vec())?;
        let expiry = self
            .vm()
            .block_timestamp()
            .checked_add(duration)
            .ok_or_else(|| b"expiry overflow".to_vec())?;

        let token_id = self.next_token_id.get();
        self.next_token_id.set(token_id + U256::from(1));

        let issuer = self.vm().msg_sender();
        self.owners.setter(token_id).set(to);
        self.expiries.setter(token_id).set(U256::from(expiry));
        self.issuers.setter(token_id).set(issuer);

        self.vm().log(Minted {
            tokenId: token_id,
            to,
            issuer,
            expiry: U256::from(expiry),
        });
        self.vm().log(Transfer {
            from: Address::ZERO,
            to,
            tokenId: token_id,
        });
        Ok(token_id)
    }

    /// Whether the pass still grants access.
    pub fn is_active(&self, token_id: U256) -> bool {
        U256::from(self.vm().block_timestamp()) < self.expiries.get(token_id)
    }

    /// Seconds of access left, or 0 once expired.
    pub fn remaining_seconds(&self, token_id: U256) -> U256 {
        let expiry = self.expiries.get(token_id);
        let now = U256::from(self.vm().block_timestamp());
        if expiry > now { expiry - now } else { U256::ZERO }
    }

    /// Offer the pass for resale at `price` wei.
    pub fn list(&mut self, token_id: U256, price: U256) -> Result<(), Vec<u8>> {
        let owner = self.owners.get(token_id);
        if owner.is_zero() {
            return Err(b"no such token".to_vec());
        }
        if owner != self.vm().msg_sender() {
            return Err(b"not owner".to_vec());
        }
        // 0 is the sentinel for "not listed", so it cannot also be a price.
        if price.is_zero() {
            return Err(b"zero price".to_vec());
        }
        self.prices.setter(token_id).set(price);
        self.vm().log(Listed {
            tokenId: token_id,
            seller: owner,
            price,
        });
        Ok(())
    }

    /// Withdraw the pass from sale.
    pub fn unlist(&mut self, token_id: U256) -> Result<(), Vec<u8>> {
        let owner = self.owners.get(token_id);
        if owner.is_zero() {
            return Err(b"no such token".to_vec());
        }
        if owner != self.vm().msg_sender() {
            return Err(b"not owner".to_vec());
        }
        self.prices.setter(token_id).set(U256::ZERO);
        self.vm().log(Unlisted {
            tokenId: token_id,
            seller: owner,
        });
        Ok(())
    }

    /// Buy a listed pass. Pays 90% to the seller and 10% to the issuer.
    #[payable]
    pub fn buy(&mut self, token_id: U256) -> Result<(), Vec<u8>> {
        let price = self.prices.get(token_id);
        if price.is_zero() {
            return Err(b"not listed".to_vec());
        }
        let seller = self.owners.get(token_id);
        let buyer = self.vm().msg_sender();
        if buyer == seller {
            return Err(b"already owner".to_vec());
        }
        // Exact payment only: no refund path, so overpayment would otherwise
        // be stranded in the contract.
        if self.vm().msg_value() != price {
            return Err(b"wrong value".to_vec());
        }
        let issuer = self.issuers.get(token_id);

        // ---- EFFECTS, before any external call ----
        // Ownership and the listing are cleared first, so a seller or issuer
        // that re-enters on payment finds the token already sold and delisted.
        self.owners.setter(token_id).set(buyer);
        self.prices.setter(token_id).set(U256::ZERO);

        // Royalty is taken as a remainder, not a second percentage, so the
        // two payouts always sum to exactly `price` with no dust left behind.
        let royalty = price / U256::from(ROYALTY_DIVISOR);
        let proceeds = price - royalty;

        // ---- INTERACTIONS ----
        transfer_eth(self.vm(), seller, proceeds)?;
        transfer_eth(self.vm(), issuer, royalty)?;

        self.vm().log(Bought {
            tokenId: token_id,
            buyer,
            seller,
            price,
            royalty,
        });
        self.vm().log(Transfer {
            from: seller,
            to: buyer,
            tokenId: token_id,
        });
        Ok(())
    }

    /// Current holder, or the zero address if the token does not exist.
    pub fn owner_of(&self, token_id: U256) -> Address {
        self.owners.get(token_id)
    }

    /// Unix seconds at which access lapses.
    pub fn expiry_of(&self, token_id: U256) -> U256 {
        self.expiries.get(token_id)
    }

    /// Listed price in wei, or 0 if not for sale.
    pub fn price_of(&self, token_id: U256) -> U256 {
        self.prices.get(token_id)
    }

    /// Issuer who receives the royalty on resale.
    pub fn issuer_of(&self, token_id: U256) -> Address {
        self.issuers.get(token_id)
    }

    /// Id the next mint will use.
    pub fn next_token_id(&self) -> U256 {
        self.next_token_id.get()
    }
}
