//! Subscription passes as time-bound, resellable NFTs.
//!
//! NOT ERC-721, and deliberately does not pretend to be. There are no
//! approvals, operators, enumeration or metadata URI, so this will not work
//! with generic NFT wallets or marketplaces; resale goes through `buy` here.
//! Ownership changes emit `PassTransferred`, NOT ERC-721's
//! `Transfer(address,address,uint256)` -- emitting that signature would have
//! advertised a standard this contract does not implement, and indexers and
//! wallets would have believed it.
//!
//! Deployed separately from PassKeyWallet, which is untouched.

#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

// The #[public] macro expands to code using Vec, which is not in the no_std prelude.
use alloc::{string::String, vec, vec::Vec};

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
    /// Ownership moved. Deliberately NOT named `Transfer`: this contract is
    /// not ERC-721 and must not claim that interface.
    event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId);
    /// An address was granted or revoked the right to issue passes.
    event IssuerSet(address indexed issuer, bool allowed);
    /// An issuer published a plan that anyone can buy a pass from.
    event PlanCreated(uint256 indexed planId, address indexed issuer, uint256 price, uint256 durationSeconds);
    /// A plan was opened for sale or withdrawn from sale.
    event PlanOpenSet(uint256 indexed planId, bool open);
    /// A pass was bought directly from its plan -- the primary sale, as
    /// opposed to `Bought`, which is a resale between holders.
    event PassPurchased(uint256 indexed tokenId, uint256 indexed planId, address indexed buyer, uint256 price, uint256 expiry);
}

sol_storage! {
    #[entrypoint]
    pub struct Subscription {
        mapping(uint256 => address) owners;
        mapping(uint256 => uint256) expiries;
        mapping(uint256 => address) issuers;
        /// The OPENING ask -- what the seller wanted when they listed. 0 means
        /// "not for sale", so a listing price of 0 is rejected. What a buyer
        /// actually pays is `current_price`, which decays from this.
        mapping(uint256 => uint256) prices;
        /// When the listing opened. The start of the decay ramp.
        mapping(uint256 => uint256) listed_at;
        uint256 next_token_id;
        /// Controls the issuer allowlist. Set once, at construction.
        address admin;
        /// Only these addresses may mint.
        mapping(address => bool) allowed_issuers;

        // ---- Plan catalogue: what a buyer can purchase a NEW pass from ----
        //
        // A plan is the product ("Figma Pro, 30 days, 0.002 ETH"); a pass is
        // one bought instance of it. Kept as parallel mappings rather than a
        // struct because sol_storage does not support struct values in
        // mappings, and this keeps each field's slot layout explicit.
        //
        // The zero address in `plan_issuers` is the "no such plan" sentinel,
        // mirroring how `owners` already marks a nonexistent token.
        mapping(uint256 => address) plan_issuers;
        mapping(uint256 => uint256) plan_prices;
        mapping(uint256 => uint256) plan_durations;
        /// Whether the plan still sells new passes. Closing a plan never
        /// touches passes already sold from it -- they keep their expiry.
        mapping(uint256 => bool) plan_open;
        /// Held on-chain, not only in the IPFS metadata, so the marketplace
        /// can still render a plan when IPFS is unreachable.
        mapping(uint256 => string) plan_names;
        mapping(uint256 => string) plan_uris;
        uint256 next_plan_id;

        /// Which plan a pass came from. Meaningless unless `token_paid` is
        /// non-zero, since passes from `mint` have no plan.
        mapping(uint256 => uint256) token_plans;
        /// What the FIRST buyer paid, kept so a resale can be shown as a
        /// discount against the original price. Never overwritten on resale;
        /// 0 for passes issued by `mint`, which had no sale price.
        mapping(uint256 => uint256) token_paid;
    }
}

#[public]
impl Subscription {
    /// Runs once at deployment. `admin` becomes the allowlist controller and
    /// the first permitted issuer.
    ///
    /// The admin is an explicit argument, NOT `msg_sender()`. cargo-stylus
    /// routes construction through the StylusDeployer contract, so inside a
    /// constructor `msg_sender()` is that contract rather than the deploying
    /// EOA. Deriving admin from it hands control to a contract that will
    /// never call `set_issuer`, which permanently bricks minting.
    ///
    /// A constructor rather than an `initialize()` function because an
    /// initializer is unguarded until someone calls it, so it can be
    /// front-run. The SDK guarantees this runs exactly once.
    #[constructor]
    pub fn constructor(&mut self, admin: Address) -> Result<(), Vec<u8>> {
        if admin.is_zero() {
            return Err(b"zero admin".to_vec());
        }
        self.admin.set(admin);
        self.allowed_issuers.setter(admin).set(true);
        Ok(())
    }

    /// Grant or revoke the right to mint passes. Admin only.
    pub fn set_issuer(&mut self, issuer: Address, allowed: bool) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.admin.get() {
            return Err(b"not admin".to_vec());
        }
        if issuer.is_zero() {
            return Err(b"zero issuer".to_vec());
        }
        self.allowed_issuers.setter(issuer).set(allowed);
        self.vm().log(IssuerSet { issuer, allowed });
        Ok(())
    }

    /// Issue a pass to `to`, valid for `duration_seconds` from now.
    ///
    /// Not payable: nothing here consumes a payment, and there is no withdraw
    /// function, so accepting ETH would strand it in the contract forever.
    /// Sending value now reverts instead of burning it.
    pub fn mint(&mut self, to: Address, duration_seconds: U256) -> Result<U256, Vec<u8>> {
        if !self.allowed_issuers.get(self.vm().msg_sender()) {
            return Err(b"not an issuer".to_vec());
        }
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
        self.vm().log(PassTransferred {
            from: Address::ZERO,
            to,
            tokenId: token_id,
        });
        Ok(token_id)
    }

    /// Publish a plan that anyone can buy a pass from. Issuer allowlist only,
    /// the same gate as `mint`.
    ///
    /// `name` is stored on-chain alongside `metadata_uri` on purpose: the
    /// marketplace must still be able to name a plan when IPFS is down.
    pub fn create_plan(
        &mut self,
        name: String,
        metadata_uri: String,
        price: U256,
        duration_seconds: U256,
    ) -> Result<U256, Vec<u8>> {
        let issuer = self.vm().msg_sender();
        if !self.allowed_issuers.get(issuer) {
            return Err(b"not an issuer".to_vec());
        }
        // A zero price would be indistinguishable from the "issued by mint,
        // never sold" marker in `token_paid`, which the resale discount is
        // computed against.
        if price.is_zero() {
            return Err(b"zero price".to_vec());
        }
        if duration_seconds.is_zero() {
            return Err(b"zero duration".to_vec());
        }
        // Range-checked at creation, not at purchase, so a plan can never be
        // published that would revert for every buyer.
        let _: u64 = duration_seconds
            .try_into()
            .map_err(|_| b"duration too large".to_vec())?;

        let plan_id = self.next_plan_id.get();
        self.next_plan_id.set(plan_id + U256::from(1));
        self.plan_issuers.setter(plan_id).set(issuer);
        self.plan_prices.setter(plan_id).set(price);
        self.plan_durations.setter(plan_id).set(duration_seconds);
        self.plan_open.setter(plan_id).set(true);
        self.plan_names.setter(plan_id).set_str(&name);
        self.plan_uris.setter(plan_id).set_str(&metadata_uri);

        self.vm().log(PlanCreated {
            planId: plan_id,
            issuer,
            price,
            durationSeconds: duration_seconds,
        });
        Ok(plan_id)
    }

    /// Open or close a plan for new sales. Passes already sold keep their
    /// expiry and stay resellable either way.
    pub fn set_plan_open(&mut self, plan_id: U256, open: bool) -> Result<(), Vec<u8>> {
        let issuer = self.plan_issuers.get(plan_id);
        if issuer.is_zero() {
            return Err(b"no such plan".to_vec());
        }
        if issuer != self.vm().msg_sender() {
            return Err(b"not plan issuer".to_vec());
        }
        self.plan_open.setter(plan_id).set(open);
        self.vm().log(PlanOpenSet { planId: plan_id, open });
        Ok(())
    }

    /// Buy a NEW pass from a plan -- the primary sale. The whole price goes to
    /// the issuer; the 90/10 split applies only to `buy`, where there is a
    /// seller to pay.
    #[payable]
    pub fn buy_pass(&mut self, plan_id: U256) -> Result<U256, Vec<u8>> {
        let issuer = self.plan_issuers.get(plan_id);
        if issuer.is_zero() {
            return Err(b"no such plan".to_vec());
        }
        if !self.plan_open.get(plan_id) {
            return Err(b"plan closed".to_vec());
        }
        let price = self.plan_prices.get(plan_id);
        // Exact payment only, the same rule as `buy`: there is no refund path
        // and no withdraw function, so an overpayment would be stranded.
        if self.vm().msg_value() != price {
            return Err(b"wrong value".to_vec());
        }
        // Cannot overflow the cast: create_plan already range-checked it.
        let duration: u64 = self
            .plan_durations
            .get(plan_id)
            .try_into()
            .map_err(|_| b"duration too large".to_vec())?;
        let expiry = self
            .vm()
            .block_timestamp()
            .checked_add(duration)
            .ok_or_else(|| b"expiry overflow".to_vec())?;

        let buyer = self.vm().msg_sender();
        let token_id = self.next_token_id.get();

        // ---- EFFECTS, before the payout ----
        // An issuer that re-enters on payment finds the token already minted
        // and the id already consumed.
        self.next_token_id.set(token_id + U256::from(1));
        self.owners.setter(token_id).set(buyer);
        self.expiries.setter(token_id).set(U256::from(expiry));
        self.issuers.setter(token_id).set(issuer);
        self.token_plans.setter(token_id).set(plan_id);
        self.token_paid.setter(token_id).set(price);

        // ---- INTERACTIONS ----
        transfer_eth(self.vm(), issuer, price)?;

        self.vm().log(PassPurchased {
            tokenId: token_id,
            planId: plan_id,
            buyer,
            price,
            expiry: U256::from(expiry),
        });
        self.vm().log(PassTransferred {
            from: Address::ZERO,
            to: buyer,
            tokenId: token_id,
        });
        Ok(token_id)
    }

    /// Issuer who published the plan, or the zero address if there is none.
    pub fn plan_issuer_of(&self, plan_id: U256) -> Address {
        self.plan_issuers.get(plan_id)
    }

    /// Price of a new pass from this plan, in wei.
    pub fn plan_price_of(&self, plan_id: U256) -> U256 {
        self.plan_prices.get(plan_id)
    }

    /// How long a pass bought from this plan lasts, in seconds.
    pub fn plan_duration_of(&self, plan_id: U256) -> U256 {
        self.plan_durations.get(plan_id)
    }

    /// Whether the plan still sells new passes.
    pub fn plan_is_open(&self, plan_id: U256) -> bool {
        self.plan_open.get(plan_id)
    }

    /// Display name, readable without IPFS.
    pub fn plan_name(&self, plan_id: U256) -> String {
        self.plan_names.getter(plan_id).get_string()
    }

    /// IPFS (or other) metadata URI for the plan's richer fields.
    pub fn plan_uri(&self, plan_id: U256) -> String {
        self.plan_uris.getter(plan_id).get_string()
    }

    /// Id the next created plan will use.
    pub fn next_plan_id(&self) -> U256 {
        self.next_plan_id.get()
    }

    /// Plan a pass was bought from. Only meaningful when `paid_of` is
    /// non-zero; passes from `mint` have no plan.
    pub fn plan_of(&self, token_id: U256) -> U256 {
        self.token_plans.get(token_id)
    }

    /// What the first buyer paid, for showing a resale as a discount against
    /// the original price. 0 means the pass was issued by `mint`, never sold.
    pub fn paid_of(&self, token_id: U256) -> U256 {
        self.token_paid.get(token_id)
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
        // An expired pass grants nothing, so it cannot be offered for sale.
        if !self.is_active(token_id) {
            return Err(b"expired".to_vec());
        }
        // 0 is the sentinel for "not listed", so it cannot also be a price.
        if price.is_zero() {
            return Err(b"zero price".to_vec());
        }
        self.prices.setter(token_id).set(price);
        // Read the clock before taking the setter: `setter` borrows self
        // mutably and `vm()` borrows it immutably, so both in one expression
        // does not compile.
        let now = U256::from(self.vm().block_timestamp());
        // Re-listing restarts the ramp from the time left now, not from the
        // pass's original term.
        self.listed_at.setter(token_id).set(now);
        self.vm().log(Listed {
            tokenId: token_id,
            seller: owner,
            price,
        });
        Ok(())
    }

    /// Withdraw the pass from sale. Allowed even once expired, so a seller can
    /// always clear a stale listing.
    pub fn unlist(&mut self, token_id: U256) -> Result<(), Vec<u8>> {
        let owner = self.owners.get(token_id);
        if owner.is_zero() {
            return Err(b"no such token".to_vec());
        }
        if owner != self.vm().msg_sender() {
            return Err(b"not owner".to_vec());
        }
        self.prices.setter(token_id).set(U256::ZERO);
        self.listed_at.setter(token_id).set(U256::ZERO);
        self.vm().log(Unlisted {
            tokenId: token_id,
            seller: owner,
        });
        Ok(())
    }

    /// What the pass costs right now.
    ///
    /// The ask falls in proportion to the access still left, measured from the
    /// moment of listing: a pass listed at 0.003 with 30 days to run costs
    /// 0.001 once 10 days remain. Time is the good being sold, so the price
    /// tracks how much of it survives.
    ///
    /// Straight-line, because a buyer has to be able to predict it. Integer
    /// maths throughout, multiplying before dividing so the ratio does not
    /// truncate to zero.
    pub fn current_price(&self, token_id: U256) -> U256 {
        let opening = self.prices.get(token_id);
        if opening.is_zero() {
            return U256::ZERO;
        }
        let expiry = self.expiries.get(token_id);
        let start = self.listed_at.get(token_id);
        let now = U256::from(self.vm().block_timestamp());
        if now >= expiry || expiry <= start {
            return U256::ZERO;
        }
        opening * (expiry - now) / (expiry - start)
    }

    /// What the seller originally asked, before any decay.
    pub fn opening_price(&self, token_id: U256) -> U256 {
        self.prices.get(token_id)
    }

    /// Buy a listed pass at its CURRENT price. Pays 90% to the seller and 10%
    /// to the issuer.
    #[payable]
    pub fn buy(&mut self, token_id: U256) -> Result<(), Vec<u8>> {
        if self.prices.get(token_id).is_zero() {
            return Err(b"not listed".to_vec());
        }
        // The decayed price, not the opening one. Charging the opening price
        // would bill the buyer for time already consumed -- the exact thing
        // this product exists to stop.
        let price = self.current_price(token_id);
        if price.is_zero() {
            return Err(b"no time left".to_vec());
        }
        // Re-checked at purchase, not just at listing: a pass can expire while
        // it sits on the market, and buying zero remaining access is a loss
        // with no recourse.
        if !self.is_active(token_id) {
            return Err(b"expired".to_vec());
        }
        let seller = self.owners.get(token_id);
        let buyer = self.vm().msg_sender();
        if buyer == seller {
            return Err(b"already owner".to_vec());
        }
        // At least the current price, and change is returned.
        //
        // NOT exact payment, which is what the pre-decay version required.
        // Exact payment and a continuously falling price are incompatible: a
        // buyer reads the price, builds a transaction, and by the time it is
        // mined the price has dropped, so msg.value no longer equals
        // current_price and every purchase reverts. Simulation hides this
        // because it executes in the current block.
        //
        // Since the price only ever falls, a value read moments ago is always
        // at least the price at execution -- so accepting an overpayment and
        // refunding the difference makes the race harmless instead of fatal.
        let paid = self.vm().msg_value();
        if paid < price {
            return Err(b"wrong value".to_vec());
        }
        let refund = paid - price;
        let issuer = self.issuers.get(token_id);

        // ---- EFFECTS, before any external call ----
        // Ownership and the listing are cleared first, so a seller or issuer
        // that re-enters on payment finds the token already sold and delisted.
        self.owners.setter(token_id).set(buyer);
        self.prices.setter(token_id).set(U256::ZERO);
        self.listed_at.setter(token_id).set(U256::ZERO);

        // Royalty is taken as a remainder, not a second percentage, so the
        // two payouts always sum to exactly `price` with no dust left behind.
        let royalty = price / U256::from(ROYALTY_DIVISOR);
        let proceeds = price - royalty;

        // ---- INTERACTIONS ----
        transfer_eth(self.vm(), seller, proceeds)?;
        transfer_eth(self.vm(), issuer, royalty)?;
        // Change last. Sending it first would let a buyer re-enter before the
        // seller has been paid, and the contract must never end a call holding
        // value -- proceeds + royalty + refund is exactly msg.value.
        if !refund.is_zero() {
            transfer_eth(self.vm(), buyer, refund)?;
        }

        self.vm().log(Bought {
            tokenId: token_id,
            buyer,
            seller,
            price,
            royalty,
        });
        self.vm().log(PassTransferred {
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

    /// Whether `who` may mint passes.
    pub fn is_issuer(&self, who: Address) -> bool {
        self.allowed_issuers.get(who)
    }

    /// Address controlling the issuer allowlist.
    pub fn admin(&self) -> Address {
        self.admin.get()
    }
}
