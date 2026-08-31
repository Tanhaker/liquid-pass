//! Isolated P-256 gas benchmark.
//!
//! Deliberately does nothing except the secp256r1 curve operation: no
//! SHA-256, no clientDataJSON parsing, no base64url decoding, no storage, no
//! outbound call. This exists so the measured gas is comparable, like for
//! like, against published Solidity P-256 verifiers.
//!
//! Deployed separately from PassKeyWallet on purpose: redeploying the wallet
//! would change its address and orphan the registered passkey.

#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

// The #[public] macro expands to code using Vec, which is not in the no_std prelude.
use alloc::{vec, vec::Vec};

use p256::ecdsa::{signature::hazmat::PrehashVerifier, Signature, VerifyingKey};
use stylus_sdk::alloy_primitives::FixedBytes;
use stylus_sdk::prelude::*;

/// Stylus WASM is single threaded with no interrupts, so a critical section
/// has nothing to guard against and acquire/release are genuinely no-ops.
/// Required only because primeorder's base-point table sits behind a LazyLock.
struct SingleThreadedCriticalSection;
critical_section::set_impl!(SingleThreadedCriticalSection);

unsafe impl critical_section::Impl for SingleThreadedCriticalSection {
    unsafe fn acquire() {}
    unsafe fn release(_token: ()) {}
}

sol_storage! {
    #[entrypoint]
    pub struct P256Bench {
    }
}

/// The curve operation on its own, shared by both measured entry points.
fn verify_once(
    x: &[u8; 32], y: &[u8; 32], digest: &[u8; 32], r: &[u8; 32], s: &[u8; 32],
) -> bool {
    let mut sec1 = [0u8; 65];
    sec1[0] = 0x04;
    sec1[1..33].copy_from_slice(x);
    sec1[33..65].copy_from_slice(y);
    let Ok(verifying_key) = VerifyingKey::from_sec1_bytes(&sec1) else {
        return false;
    };
    let mut sig_bytes = [0u8; 64];
    sig_bytes[..32].copy_from_slice(r);
    sig_bytes[32..].copy_from_slice(s);
    let Ok(signature) = Signature::from_slice(&sig_bytes) else {
        return false;
    };
    verifying_key.verify_prehash(digest, &signature).is_ok()
}

#[public]
impl P256Bench {
    /// The measurement: one secp256r1 signature verification over a digest
    /// that is supplied ready-made, so nothing but the curve maths is timed.
    pub fn verify_p256(
        &self,
        x: FixedBytes<32>,
        y: FixedBytes<32>,
        digest: FixedBytes<32>,
        r: FixedBytes<32>,
        s: FixedBytes<32>,
    ) -> bool {
        let mut sec1 = [0u8; 65];
        sec1[0] = 0x04;
        sec1[1..33].copy_from_slice(&x.0);
        sec1[33..65].copy_from_slice(&y.0);
        let Ok(verifying_key) = VerifyingKey::from_sec1_bytes(&sec1) else {
            return false;
        };

        let mut sig_bytes = [0u8; 64];
        sig_bytes[..32].copy_from_slice(&r.0);
        sig_bytes[32..].copy_from_slice(&s.0);
        let Ok(signature) = Signature::from_slice(&sig_bytes) else {
            return false;
        };

        verifying_key.verify_prehash(&digest.0, &signature).is_ok()
    }

    /// The same verification run twice.
    ///
    /// Subtracting `verifyP256` from this yields exactly one verification with
    /// every fixed cost cancelled: intrinsic gas, calldata, router dispatch,
    /// and the per-call WASM module init that an uncached Stylus contract pays.
    /// `black_box` stops the optimiser from collapsing the second call into the
    /// first, which would silently make this measure one verification, not two.
    pub fn verify_p256_x2(
        &self,
        x: FixedBytes<32>,
        y: FixedBytes<32>,
        digest: FixedBytes<32>,
        r: FixedBytes<32>,
        s: FixedBytes<32>,
    ) -> bool {
        use core::hint::black_box;
        let a = verify_once(&x.0, &y.0, &digest.0, &r.0, &s.0);
        let b = verify_once(
            black_box(&x.0), black_box(&y.0), black_box(&digest.0),
            black_box(&r.0), black_box(&s.0),
        );
        black_box(a) && black_box(b)
    }

    /// Baseline with an identical signature that never touches the curve.
    ///
    /// Subtracting this from `verify_p256` removes the 21000 intrinsic gas,
    /// the calldata cost of five 32-byte words, and the router dispatch,
    /// leaving the verification cost alone. Without it the headline number
    /// would silently include overhead that published Solidity figures may or
    /// may not count.
    ///
    /// Touches every argument so the optimiser cannot discard the decode.
    pub fn noop(
        &self,
        x: FixedBytes<32>,
        y: FixedBytes<32>,
        digest: FixedBytes<32>,
        r: FixedBytes<32>,
        s: FixedBytes<32>,
    ) -> bool {
        let mut acc = 0u8;
        acc ^= x.0[0];
        acc ^= y.0[0];
        acc ^= digest.0[0];
        acc ^= r.0[0];
        acc ^= s.0[0];
        acc == 0
    }
}
