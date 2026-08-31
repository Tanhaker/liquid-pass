//! PassKey Wallet -- a seedless smart account controlled by a device passkey.
//!
//! The verifier lives in [`webauthn`] and is unchanged by this file. This is
//! the chain-facing wrapper that finally makes CLAUDE.md rules 6 and 7
//! implementable: rule 6 because there is now a nonce and a contract address
//! to bind into the challenge preimage, and rule 7 because there is now an
//! external call to order effects against.

#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

// The #[public] macro expands to code using Vec, which is not in the no_std prelude.
use alloc::{vec, vec::Vec};

use stylus_sdk::abi::Bytes;
use stylus_sdk::alloy_primitives::{Address, FixedBytes, U256};
use stylus_sdk::alloy_sol_types::sol;
use stylus_sdk::call::{call, static_call};
use stylus_sdk::prelude::*;
use stylus_sdk::stylus_core::host::Host;

pub mod webauthn;

use webauthn::{Sha256Backend, VerifyError};

/// The relying-party origin assertions must be bound to.
///
/// SECURITY: deliberately a constant, not a parameter. If it were
/// caller-supplied, an attacker would pass whatever origin their signature was
/// made for and the check would be worthless.
///
/// NOTE: the test fixtures were captured at https://webauthn.io, so they will
/// NOT verify against this contract. Any on-chain smoke test needs an
/// assertion captured from this origin.
const EXPECTED_ORIGIN: &[u8] = b"http://localhost:3000";

/// The EVM SHA-256 precompile, address 0x02.
const SHA256_PRECOMPILE: Address = Address::new([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
]);

sol! {
    /// Emitted once, when the wallet's passkey is bound.
    event PasskeyRegistered(uint256 x, uint256 y);
    /// Emitted after a successful authenticated call.
    event Executed(address indexed target, uint256 value, uint256 nonce);
}

/// SHA-256 via the EVM precompile rather than a linked implementation.
///
/// A RustCrypto SHA-256 measured at ~1.5KB of the 24KB budget. The precompile
/// costs 60 + 12 per 32-byte word of gas and zero code size.
struct PrecompileSha256<'a, H: ?Sized> {
    host: &'a H,
}

impl<H: Host + ?Sized> Sha256Backend for PrecompileSha256<'_, H> {
    fn sha256_parts(&self, parts: &[&[u8]]) -> Result<[u8; 32], VerifyError> {
        let mut input = Vec::with_capacity(parts.iter().map(|p| p.len()).sum());
        for part in parts {
            input.extend_from_slice(part);
        }
        let out = static_call(self.host, Call::new(), SHA256_PRECOMPILE, &input)
            .map_err(|_| VerifyError::HashFailed)?;
        let digest = <[u8; 32]>::try_from(out.as_slice()).map_err(|_| VerifyError::HashFailed)?;
        Ok(digest)
    }
}

sol_storage! {
    #[entrypoint]
    pub struct PassKeyWallet {
        uint256[2] pubkey;
        uint256 nonce;
        address owner_fallback;
    }
}

#[public]
impl PassKeyWallet {
    /// Bind a passkey to this wallet. One-time: reverts if already registered.
    pub fn register(&mut self, x: U256, y: U256) -> Result<(), Vec<u8>> {
        if self.is_registered()? {
            return Err(b"already registered".to_vec());
        }
        if x.is_zero() && y.is_zero() {
            return Err(b"zero pubkey".to_vec());
        }
        self.pubkey
            .setter(0)
            .ok_or_else(|| b"storage".to_vec())?
            .set(x);
        self.pubkey
            .setter(1)
            .ok_or_else(|| b"storage".to_vec())?
            .set(y);

        // Recorded for a future recovery path. Social recovery is out of scope
        // per CLAUDE.md, so nothing reads this yet.
        let sender = self.vm().msg_sender();
        self.owner_fallback.set(sender);

        self.vm().log(PasskeyRegistered { x, y });
        Ok(())
    }

    /// The digest the frontend must pass as the WebAuthn challenge.
    ///
    /// Rule 6: the preimage binds the current nonce and this contract's
    /// address, so an assertion cannot be replayed against another
    /// transaction or another deployment.
    pub fn get_challenge(
        &self,
        target: Address,
        value: U256,
        data: Bytes,
    ) -> Result<FixedBytes<32>, Vec<u8>> {
        let challenge = self.compute_challenge(target, value, &data)?;
        Ok(FixedBytes(challenge))
    }

    /// Verify a passkey assertion and, only if it passes, make the call.
    ///
    /// Rule 7 (checks-effects-interactions) is enforced by the ordering
    /// below: the assertion is checked, the nonce is incremented, and only
    /// then is the external call made. A reentrant call back into `execute`
    /// therefore sees the already-incremented nonce and cannot replay this
    /// assertion.
    #[allow(clippy::too_many_arguments)]
    pub fn execute(
        &mut self,
        target: Address,
        value: U256,
        data: Bytes,
        auth_data: Bytes,
        client_data: Bytes,
        r: FixedBytes<32>,
        s: FixedBytes<32>,
    ) -> Result<Bytes, Vec<u8>> {
        // ---------------- CHECKS ----------------
        if !self.is_registered()? {
            return Err(b"not registered".to_vec());
        }
        let x = self.pubkey.get(0).ok_or_else(|| b"storage".to_vec())?;
        let y = self.pubkey.get(1).ok_or_else(|| b"storage".to_vec())?;
        let nonce = self.nonce.get();

        let expected_challenge = self.compute_challenge(target, value, &data)?;

        {
            let hasher = PrecompileSha256 { host: self.vm() };
            webauthn::verify_assertion(
                &hasher,
                &x.to_be_bytes::<32>(),
                &y.to_be_bytes::<32>(),
                &auth_data,
                &client_data,
                &r.0,
                &s.0,
                &expected_challenge,
                EXPECTED_ORIGIN,
            )
            .map_err(|_| b"bad assertion".to_vec())?;
        }

        // ---------------- EFFECTS ----------------
        // Rule 7: the nonce is bumped BEFORE the external call, never after.
        self.nonce.set(nonce + U256::from(1));

        // ---------------- INTERACTIONS ----------------
        let config = Call::new_payable(self, value);
        let result = call(self.vm(), config, target, &data).map_err(|_| b"call failed".to_vec())?;
        let result = Bytes::from(result);

        self.vm().log(Executed {
            target,
            value,
            nonce,
        });
        Ok(result)
    }

    /// Current nonce; the next assertion must be bound to this value.
    pub fn nonce(&self) -> U256 {
        self.nonce.get()
    }

    /// The registered passkey coordinates, or (0, 0) if unregistered.
    pub fn pubkey(&self) -> Result<(U256, U256), Vec<u8>> {
        let x = self.pubkey.get(0).ok_or_else(|| b"storage".to_vec())?;
        let y = self.pubkey.get(1).ok_or_else(|| b"storage".to_vec())?;
        Ok((x, y))
    }
}

/// Internal helpers. Not part of the external ABI.
impl PassKeyWallet {
    fn is_registered(&self) -> Result<bool, Vec<u8>> {
        let x = self.pubkey.get(0).ok_or_else(|| b"storage".to_vec())?;
        let y = self.pubkey.get(1).ok_or_else(|| b"storage".to_vec())?;
        Ok(!(x.is_zero() && y.is_zero()))
    }

    /// Rule 6 preimage: domain || this contract || nonce || target || value || data.
    fn compute_challenge(
        &self,
        target: Address,
        value: U256,
        data: &[u8],
    ) -> Result<[u8; 32], Vec<u8>> {
        // The verifier binds a u64 nonce. Convert explicitly rather than
        // truncating, so an out-of-range nonce reverts instead of silently
        // aliasing an earlier one.
        let nonce: u64 = self
            .nonce
            .get()
            .try_into()
            .map_err(|_| b"nonce overflow".to_vec())?;

        let hasher = PrecompileSha256 { host: self.vm() };
        let contract_address = self.vm().contract_address();
        webauthn::challenge_preimage(
            &hasher,
            nonce,
            &contract_address.0 .0,
            &target.0 .0,
            &value.to_be_bytes::<32>(),
            data,
        )
        .map_err(|_| b"hash failed".to_vec())
    }
}
