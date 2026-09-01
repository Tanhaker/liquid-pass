#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::{string::String, vec, vec::Vec};
use stylus_sdk::alloy_primitives::{Address, U256};
use stylus_sdk::alloy_sol_types::sol;
use stylus_sdk::call::transfer::transfer_eth;
use stylus_sdk::prelude::*;

sol! {
    event Minted(uint256 indexed tokenId, address indexed to, address indexed issuer, uint256 expiry);
    event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId);
    event IssuerSet(address indexed issuer, bool allowed);
    event PlanCreated(uint256 indexed planId, address indexed issuer, uint256 price, uint256 durationSeconds);
    event PlanOpenSet(uint256 indexed planId, bool open);
    event PassPurchased(uint256 indexed tokenId, uint256 indexed planId, address indexed buyer, uint256 price, uint256 expiry);
    event MarketplaceSet(address indexed marketplace);
}

sol_storage! {
    #[entrypoint]
    pub struct Subscription {
        mapping(uint256 => address) owners;
        mapping(uint256 => uint256) expiries;
        mapping(uint256 => address) issuers;
        mapping(uint256 => uint256) starts;
        uint256 next_token_id;
        address admin;
        mapping(address => bool) allowed_issuers;

        // Plan catalogue
        mapping(uint256 => address) plan_issuers;
        mapping(uint256 => uint256) plan_prices;
        mapping(uint256 => uint256) plan_durations;
        mapping(uint256 => bool) plan_open;
        mapping(uint256 => string) plan_names;
        mapping(uint256 => string) plan_uris;
        uint256 next_plan_id;

        mapping(uint256 => uint256) token_plans;
        mapping(uint256 => uint256) token_paid;

        // Link to the Marketplace contract
        address marketplace;
    }
}

#[public]
impl Subscription {
    #[constructor]
    pub fn constructor(&mut self, admin: Address) -> Result<(), Vec<u8>> {
        if admin.is_zero() { return Err(alloc::vec::Vec::new()); }
        self.admin.set(admin);
        self.allowed_issuers.setter(admin).set(true);
        Ok(())
    }

    pub fn set_issuer(&mut self, issuer: Address, allowed: bool) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.admin.get() { return Err(alloc::vec::Vec::new()); }
        if issuer.is_zero() { return Err(alloc::vec::Vec::new()); }
        self.allowed_issuers.setter(issuer).set(allowed);
        self.vm().log(IssuerSet { issuer, allowed });
        Ok(())
    }

    pub fn set_marketplace(&mut self, market: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.admin.get() { return Err(alloc::vec::Vec::new()); }
        self.marketplace.set(market);
        self.vm().log(MarketplaceSet { marketplace: market });
        Ok(())
    }

    pub fn mint(&mut self, to: Address, duration_seconds: U256) -> Result<U256, Vec<u8>> {
        if !self.allowed_issuers.get(self.vm().msg_sender()) { return Err(alloc::vec::Vec::new()); }
        if to.is_zero() || duration_seconds.is_zero() { return Err(alloc::vec::Vec::new()); }
        
        let duration: u64 = duration_seconds.try_into().unwrap_or(0);
        let expiry = self.vm().block_timestamp() + duration;
        
        let token_id = self.next_token_id.get();
        self.next_token_id.set(token_id + U256::from(1));

        let issuer = self.vm().msg_sender();
        self.owners.setter(token_id).set(to);
        self.expiries.setter(token_id).set(U256::from(expiry));
        self.issuers.setter(token_id).set(issuer);

        self.vm().log(Minted { tokenId: token_id, to, issuer, expiry: U256::from(expiry) });
        self.vm().log(PassTransferred { from: Address::ZERO, to, tokenId: token_id });
        Ok(token_id)
    }

    pub fn create_plan(&mut self, name: String, metadata_uri: String, price: U256, duration_seconds: U256) -> Result<U256, Vec<u8>> {
        let issuer = self.vm().msg_sender();
        if !self.allowed_issuers.get(issuer) { return Err(alloc::vec::Vec::new()); }
        if price.is_zero() || duration_seconds.is_zero() { return Err(alloc::vec::Vec::new()); }
        
        let plan_id = self.next_plan_id.get();
        self.next_plan_id.set(plan_id + U256::from(1));
        self.plan_issuers.setter(plan_id).set(issuer);
        self.plan_prices.setter(plan_id).set(price);
        self.plan_durations.setter(plan_id).set(duration_seconds);
        self.plan_open.setter(plan_id).set(true);
        self.plan_names.setter(plan_id).set_str(&name);
        self.plan_uris.setter(plan_id).set_str(&metadata_uri);

        self.vm().log(PlanCreated { planId: plan_id, issuer, price, durationSeconds: duration_seconds });
        Ok(plan_id)
    }

    pub fn set_plan_open(&mut self, plan_id: U256, open: bool) -> Result<(), Vec<u8>> {
        let issuer = self.plan_issuers.get(plan_id);
        if issuer != self.vm().msg_sender() { return Err(alloc::vec::Vec::new()); }
        self.plan_open.setter(plan_id).set(open);
        self.vm().log(PlanOpenSet { planId: plan_id, open });
        Ok(())
    }

    #[payable]
    pub fn buy_pass(&mut self, plan_id: U256) -> Result<U256, Vec<u8>> {
        let issuer = self.plan_issuers.get(plan_id);
        if issuer.is_zero() || !self.plan_open.get(plan_id) { return Err(alloc::vec::Vec::new()); }
        
        let price = self.plan_prices.get(plan_id);
        if self.vm().msg_value() != price { return Err(alloc::vec::Vec::new()); }
        
        let duration: u64 = self.plan_durations.get(plan_id).try_into().unwrap_or(0);
        let expiry = self.vm().block_timestamp() + duration;
        
        let buyer = self.vm().msg_sender();
        let token_id = self.next_token_id.get();

        self.next_token_id.set(token_id + U256::from(1));
        self.owners.setter(token_id).set(buyer);
        self.expiries.setter(token_id).set(U256::from(expiry));
        self.issuers.setter(token_id).set(issuer);
        self.token_plans.setter(token_id).set(plan_id);
        self.token_paid.setter(token_id).set(price);

        transfer_eth(self.vm(), issuer, price)?;

        self.vm().log(PassPurchased { tokenId: token_id, planId: plan_id, buyer, price, expiry: U256::from(expiry) });
        self.vm().log(PassTransferred { from: Address::ZERO, to: buyer, tokenId: token_id });
        Ok(token_id)
    }

    pub fn split(&mut self, token_id: U256, parts: U256) -> Result<U256, Vec<u8>> {
        let owner = self.owners.get(token_id);
        if owner != self.vm().msg_sender() { return Err(alloc::vec::Vec::new()); }
        if !self.is_active(token_id) { return Err(alloc::vec::Vec::new()); }
        
        let n: u64 = parts.try_into().unwrap_or(0);
        if n < 2 || n > 24 { return Err(alloc::vec::Vec::new()); }

        let expiry = self.expiries.get(token_id);
        let now = U256::from(self.vm().block_timestamp());
        let slice = (expiry - now) / parts;

        let plan = self.token_plans.get(token_id);
        let issuer = self.issuers.get(token_id);
        let share = self.token_paid.get(token_id) / parts;

        self.owners.setter(token_id).set(Address::ZERO);
        self.expiries.setter(token_id).set(U256::ZERO);

        let first = self.next_token_id.get();
        for i in 0..n {
            let id = first + U256::from(i);
            let start = now + slice * U256::from(i);
            let end = if i + 1 == n { expiry } else { start + slice };
            self.owners.setter(id).set(owner);
            self.starts.setter(id).set(start);
            self.expiries.setter(id).set(end);
            self.issuers.setter(id).set(issuer);
            self.token_plans.setter(id).set(plan);
            self.token_paid.setter(id).set(share);
            self.vm().log(PassTransferred { from: Address::ZERO, to: owner, tokenId: id });
        }
        self.next_token_id.set(first + parts);
        Ok(first)
    }

    pub fn bundle(&mut self, token_ids: Vec<U256>) -> Result<U256, Vec<u8>> {
        let n = token_ids.len();
        if n < 2 { return Err(alloc::vec::Vec::new()); }
        
        let caller = self.vm().msg_sender();
        let first = token_ids[0];
        let plan = self.token_plans.get(first);
        let issuer = self.issuers.get(first);
        
        let mut total_rem = U256::ZERO;
        let mut total_paid = U256::ZERO;

        for id in token_ids.iter() {
            let id = *id;
            if self.owners.get(id) != caller { return Err(alloc::vec::Vec::new()); }
            if self.token_plans.get(id) != plan { return Err(alloc::vec::Vec::new()); }
            if !self.is_active(id) { return Err(alloc::vec::Vec::new()); }
            
            total_rem += self.remaining_seconds(id);
            total_paid += self.token_paid.get(id);

            self.owners.setter(id).set(Address::ZERO);
            self.expiries.setter(id).set(U256::ZERO);
            self.vm().log(PassTransferred { from: caller, to: Address::ZERO, tokenId: id });
        }

        let new_id = self.next_token_id.get();
        self.next_token_id.set(new_id + U256::from(1));
        
        let now = U256::from(self.vm().block_timestamp());
        self.owners.setter(new_id).set(caller);
        self.expiries.setter(new_id).set(now + total_rem);
        self.issuers.setter(new_id).set(issuer);
        self.token_plans.setter(new_id).set(plan);
        self.token_paid.setter(new_id).set(total_paid);

        self.vm().log(PassTransferred { from: Address::ZERO, to: caller, tokenId: new_id });
        Ok(new_id)
    }

    pub fn transfer_pass(&mut self, to: Address, token_id: U256) -> Result<(), Vec<u8>> {
        let owner = self.owners.get(token_id);
        if owner != self.vm().msg_sender() { return Err(alloc::vec::Vec::new()); }
        self.owners.setter(token_id).set(to);
        self.vm().log(PassTransferred { from: owner, to, tokenId: token_id });
        Ok(())
    }

    /// Called ONLY by the Marketplace contract when a pass is sold.
    pub fn market_transfer(&mut self, from: Address, to: Address, token_id: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.marketplace.get() { return Err(alloc::vec::Vec::new()); }
        if self.owners.get(token_id) != from { return Err(alloc::vec::Vec::new()); }
        
        self.owners.setter(token_id).set(to);
        self.vm().log(PassTransferred { from, to, tokenId: token_id });
        Ok(())
    }

    // View functions for the Marketplace and Frontend
    pub fn is_active(&self, token_id: U256) -> bool {
        let now = U256::from(self.vm().block_timestamp());
        now >= self.starts.get(token_id) && now < self.expiries.get(token_id)
    }
    pub fn remaining_seconds(&self, token_id: U256) -> U256 {
        let expiry = self.expiries.get(token_id);
        let now = U256::from(self.vm().block_timestamp());
        if expiry > now { expiry - now } else { U256::ZERO }
    }
    pub fn owner_of(&self, token_id: U256) -> Address { self.owners.get(token_id) }
    pub fn expiry_of(&self, token_id: U256) -> U256 { self.expiries.get(token_id) }
    pub fn issuer_of(&self, token_id: U256) -> Address { self.issuers.get(token_id) }
    pub fn next_token_id(&self) -> U256 { self.next_token_id.get() }
    pub fn is_issuer(&self, who: Address) -> bool { self.allowed_issuers.get(who) }
    pub fn admin(&self) -> Address { self.admin.get() }
    pub fn marketplace(&self) -> Address { self.marketplace.get() }
    
    // Plan queries
    pub fn plan_issuer_of(&self, plan_id: U256) -> Address { self.plan_issuers.get(plan_id) }
    pub fn plan_price_of(&self, plan_id: U256) -> U256 { self.plan_prices.get(plan_id) }
    pub fn plan_duration_of(&self, plan_id: U256) -> U256 { self.plan_durations.get(plan_id) }
    pub fn plan_is_open(&self, plan_id: U256) -> bool { self.plan_open.get(plan_id) }
    pub fn plan_name(&self, plan_id: U256) -> String { self.plan_names.getter(plan_id).get_string() }
    pub fn plan_uri(&self, plan_id: U256) -> String { self.plan_uris.getter(plan_id).get_string() }
    pub fn next_plan_id(&self) -> U256 { self.next_plan_id.get() }
    pub fn plan_of(&self, token_id: U256) -> U256 { self.token_plans.get(token_id) }
    pub fn paid_of(&self, token_id: U256) -> U256 { self.token_paid.get(token_id) }
}
