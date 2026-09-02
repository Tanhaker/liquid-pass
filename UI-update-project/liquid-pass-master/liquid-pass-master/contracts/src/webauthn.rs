//! WebAuthn assertion verifier.
//!
//! Pure Rust: no Stylus, no chain, no allocation, no JSON library. Runnable
//! under `cargo test`. Every failure path returns `Err`; nothing here panics
//! and nothing indexes without a bounds check (CLAUDE.md rule 3).
//!
//! Implements CLAUDE.md correctness rules 1-5. Rules 6 and 7 are contract
//! level and cannot live here -- see `challenge_preimage` and the note on
//! `verify_assertion` below.

use p256::ecdsa::{signature::hazmat::PrehashVerifier, Signature, VerifyingKey};

#[cfg(test)]
#[path = "webauthn_tests.rs"]
mod tests;

/// SHA-256, abstracted so this module stays chain-agnostic.
///
/// A full SHA-256 implementation costs roughly 3.5-4KB of the 24KB code
/// budget, so the contract implements this with the EVM SHA-256 precompile at
/// address 0x02 instead of linking one. Tests implement it with RustCrypto
/// `sha2`, which is why `sha2` is a dev-dependency only.
pub trait Sha256Backend {
    /// SHA-256 over the concatenation of `parts`, in order.
    ///
    /// Fallible because the on-chain implementation is an external call to a
    /// precompile, which can fail (out of gas, unexpected return length). A
    /// failure must revert cleanly rather than panic.
    fn sha256_parts(&self, parts: &[&[u8]]) -> Result<[u8; 32], VerifyError>;
}

/// Minimum length of authenticatorData: rpIdHash(32) || flags(1) || signCount(4).
const AUTH_DATA_MIN: usize = 37;
/// Index of the flags byte within authenticatorData.
const FLAGS_IDX: usize = 32;
/// User Presence bit within the flags byte.
const FLAG_UP: u8 = 0x01;

/// floor(n/2) for the P-256 group order, big-endian.
/// Derived and checked: 2*HALF_N + 1 == n.
const HALF_N: [u8; 32] = [
    0x7f, 0xff, 0xff, 0xff, 0x80, 0x00, 0x00, 0x00, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xde, 0x73, 0x7d, 0x56, 0xd3, 0x8b, 0xcf, 0x42, 0x79, 0xdc, 0xe5, 0x61,
    0x7e, 0x31, 0x92, 0xa8,
];

/// Why an assertion was rejected. Every variant is a clean revert, never a panic.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyError {
    /// authenticatorData shorter than the 37-byte minimum.
    AuthDataTooShort,
    /// User Presence flag not set (rule 5).
    UserPresenceNotSet,
    /// clientDataJSON "type" is absent or is not "webauthn.get".
    TypeMismatch,
    /// clientDataJSON "origin" is absent or does not match the expected RP.
    OriginMismatch,
    /// No challenge field found in clientDataJSON.
    ChallengeNotFound,
    /// Challenge field present but not a well-formed unpadded 43-char base64url
    /// encoding of 32 bytes.
    ChallengeMalformed,
    /// Challenge decoded correctly but is not the expected one (rule 2).
    ChallengeMismatch,
    /// s > n/2; malleable signature (rule 4).
    HighS,
    /// Public key coordinates are not a valid P-256 point.
    InvalidPublicKey,
    /// Signature is malformed or does not verify.
    InvalidSignature,
    /// Packed assertion blob is too short, or its length prefix is
    /// inconsistent with the actual blob length.
    MalformedAssertion,
    /// The SHA-256 backend failed (on-chain: the precompile call reverted or
    /// returned an unexpected length).
    HashFailed,
}

/// Byte offsets within the packed assertion blob accepted by
/// [`verify_assertion_packed`].
mod offset {
    pub const PUBKEY_X: usize = 0;
    pub const PUBKEY_Y: usize = 32;
    pub const SIG_R: usize = 64;
    pub const SIG_S: usize = 96;
    pub const CHALLENGE: usize = 128;
    pub const AD_LEN: usize = 160;
    /// Start of authenticatorData; also the minimum valid blob length.
    pub const AD: usize = 162;
}

/// Verify an assertion supplied as one packed byte blob.
///
/// Layout (all integers big-endian):
///
/// ```text
///   0..32    pubkey_x
///  32..64    pubkey_y
///  64..96    sig_r
///  96..128   sig_s
/// 128..160   expected_challenge
/// 160..162   authenticator_data_len (u16)
/// 162..162+L authenticator_data
/// 162+L..    client_data_json  (runs to the end of the blob)
/// ```
///
/// clientDataJSON is last so its length is implied by the blob, which keeps
/// the ABI surface to a single dynamic `bytes` argument. Every field is
/// bounds-checked; a malformed blob is a clean `Err`, never a panic.
pub fn verify_assertion_packed<H: Sha256Backend>(
    hasher: &H,
    blob: &[u8],
    expected_origin: &[u8],
) -> Result<(), VerifyError> {
    if blob.len() < offset::AD {
        return Err(VerifyError::MalformedAssertion);
    }
    let ad_len = ((blob[offset::AD_LEN] as usize) << 8) | blob[offset::AD_LEN + 1] as usize;
    let client_data_start = offset::AD
        .checked_add(ad_len)
        .ok_or(VerifyError::MalformedAssertion)?;
    if blob.len() < client_data_start {
        return Err(VerifyError::MalformedAssertion);
    }

    verify_assertion(
        hasher,
        array32(blob, offset::PUBKEY_X)?,
        array32(blob, offset::PUBKEY_Y)?,
        &blob[offset::AD..client_data_start],
        &blob[client_data_start..],
        array32(blob, offset::SIG_R)?,
        array32(blob, offset::SIG_S)?,
        array32(blob, offset::CHALLENGE)?,
        expected_origin,
    )
}

/// Borrow a fixed 32-byte field out of the blob without copying.
fn array32(blob: &[u8], at: usize) -> Result<&[u8; 32], VerifyError> {
    let slice = blob
        .get(at..at.checked_add(32).ok_or(VerifyError::MalformedAssertion)?)
        .ok_or(VerifyError::MalformedAssertion)?;
    <&[u8; 32]>::try_from(slice).map_err(|_| VerifyError::MalformedAssertion)
}

/// Verify a WebAuthn assertion.
///
/// NOTE ON SIGNATURE SHAPE: this takes `expected_origin` as an 8th parameter,
/// one more than originally specified. Origin binding cannot be done without
/// it. The caller must supply a value it controls -- never one taken from
/// untrusted calldata, which would defeat the check entirely.
///
/// NOTE ON RULES 6 AND 7: this function enforces that the signed challenge
/// equals `expected_challenge`. *Constructing* that challenge from the nonce
/// and contract address (rule 6) is the caller's job -- see
/// `challenge_preimage`. Nonce-increment ordering (rule 7) is likewise the
/// contract's, not this module's.
#[allow(clippy::too_many_arguments)]
pub fn verify_assertion<H: Sha256Backend>(
    hasher: &H,
    pubkey_x: &[u8; 32],
    pubkey_y: &[u8; 32],
    authenticator_data: &[u8],
    client_data_json: &[u8],
    sig_r: &[u8; 32],
    sig_s: &[u8; 32],
    expected_challenge: &[u8; 32],
    expected_origin: &[u8],
) -> Result<(), VerifyError> {
    // --- Rule 5: user presence -------------------------------------------
    if authenticator_data.len() < AUTH_DATA_MIN {
        return Err(VerifyError::AuthDataTooShort);
    }
    if authenticator_data[FLAGS_IDX] & FLAG_UP == 0 {
        return Err(VerifyError::UserPresenceNotSet);
    }

    // --- Ceremony type: reject a webauthn.create signature replayed here --
    let ty = json_string_field(client_data_json, TYPE_KEY).ok_or(VerifyError::TypeMismatch)?;
    if !ct_eq(ty, b"webauthn.get") {
        return Err(VerifyError::TypeMismatch);
    }

    // --- Origin binding ---------------------------------------------------
    let origin =
        json_string_field(client_data_json, ORIGIN_KEY).ok_or(VerifyError::OriginMismatch)?;
    if !ct_eq(origin, expected_origin) {
        return Err(VerifyError::OriginMismatch);
    }

    // --- Rules 2 + 3: extract and compare the challenge -------------------
    // Substring scan, not a JSON parse.
    let challenge_b64 =
        json_string_field(client_data_json, CHALLENGE_KEY).ok_or(VerifyError::ChallengeNotFound)?;
    let challenge = b64url_decode_32(challenge_b64)?;
    if !ct_eq(&challenge, expected_challenge) {
        return Err(VerifyError::ChallengeMismatch);
    }

    // --- Rule 4: reject malleable high-s ----------------------------------
    // p256 sets NORMALIZE_S = false for NistP256, so the library will NOT do
    // this for us. Clients must normalise s to n-s before submitting.
    if is_high_s(sig_s) {
        return Err(VerifyError::HighS);
    }

    // --- Rule 1: sha256(authenticatorData || sha256(clientDataJSON)) ------
    let client_data_hash = hasher.sha256_parts(&[client_data_json])?;
    let message = hasher.sha256_parts(&[authenticator_data, &client_data_hash])?;

    // --- Curve operation, last because it is the expensive one ------------
    let mut sec1 = [0u8; 65];
    sec1[0] = 0x04;
    sec1[1..33].copy_from_slice(pubkey_x);
    sec1[33..65].copy_from_slice(pubkey_y);
    let verifying_key =
        VerifyingKey::from_sec1_bytes(&sec1).map_err(|_| VerifyError::InvalidPublicKey)?;

    let mut sig_bytes = [0u8; 64];
    sig_bytes[..32].copy_from_slice(sig_r);
    sig_bytes[32..].copy_from_slice(sig_s);
    let signature = Signature::from_slice(&sig_bytes).map_err(|_| VerifyError::InvalidSignature)?;

    verifying_key
        .verify_prehash(&message, &signature)
        .map_err(|_| VerifyError::InvalidSignature)
}

/// Build the 32-byte challenge a client must have signed (CLAUDE.md rule 6).
///
/// Binds the contract address and nonce into the preimage so a signature
/// cannot be replayed against a different transaction or a different contract.
/// The frontend must compute this identically and pass it as the WebAuthn
/// challenge.
pub fn challenge_preimage<H: Sha256Backend>(
    hasher: &H,
    nonce: u64,
    contract_address: &[u8; 20],
    target: &[u8; 20],
    value: &[u8; 32],
    call_data: &[u8],
) -> Result<[u8; 32], VerifyError> {
    let nonce_be = nonce.to_be_bytes();
    hasher.sha256_parts(&[
        b"PassKeyWallet.v1",
        contract_address,
        &nonce_be,
        target,
        value,
        call_data,
    ])
}

// -------------------------------------------------------------------------
// Helpers. All bounds-checked; none can panic.
// -------------------------------------------------------------------------

/// JSON key patterns, written as byte literals to avoid escaping noise.
const TYPE_KEY: &[u8] = b"\"type\":\"";
const ORIGIN_KEY: &[u8] = b"\"origin\":\"";
const CHALLENGE_KEY: &[u8] = b"\"challenge\":\"";

/// Locate `key` and return the bytes up to the next closing quote. Returns
/// `None` if the key is absent or the string is unterminated.
fn json_string_field<'a>(hay: &'a [u8], key: &[u8]) -> Option<&'a [u8]> {
    let start = find_after(hay, key)?;
    let rest = hay.get(start..)?;
    let mut i = 0;
    while i < rest.len() {
        let c = rest[i];
        if c == b'"' {
            return Some(&rest[..i]);
        }
        // A backslash means an escape sequence. None of the fields we read
        // (type, origin, base64url challenge) may legitimately contain one, so
        // treat it as malformed rather than trying to unescape.
        if c == b'\\' {
            return None;
        }
        i += 1;
    }
    None
}

/// Index just past the first occurrence of `needle`, or `None`.
fn find_after(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    let last = hay.len() - needle.len();
    let mut i = 0;
    while i <= last {
        if &hay[i..i + needle.len()] == needle {
            return Some(i + needle.len());
        }
        i += 1;
    }
    None
}

/// Decode exactly 43 unpadded base64url characters into 32 bytes.
///
/// Accepts the base64url alphabet only: `-` and `_`, never `+` or `/`, and no
/// `=` padding. Also rejects a non-canonical final character (43 chars carry
/// 258 bits; the trailing 2 must be zero).
fn b64url_decode_32(input: &[u8]) -> Result<[u8; 32], VerifyError> {
    if input.len() != 43 {
        return Err(VerifyError::ChallengeMalformed);
    }
    let mut out = [0u8; 32];
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut written = 0usize;
    let mut i = 0;
    while i < input.len() {
        let v = match b64url_value(input[i]) {
            Some(v) => v,
            None => return Err(VerifyError::ChallengeMalformed),
        };
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            if written >= out.len() {
                return Err(VerifyError::ChallengeMalformed);
            }
            out[written] = (acc >> bits) as u8;
            written += 1;
        }
        i += 1;
    }
    if written != 32 {
        return Err(VerifyError::ChallengeMalformed);
    }
    if acc & 0b11 != 0 {
        return Err(VerifyError::ChallengeMalformed);
    }
    Ok(out)
}

/// base64url alphabet value, or `None` for any character outside it.
fn b64url_value(c: u8) -> Option<u8> {
    match c {
        b'A'..=b'Z' => Some(c - b'A'),
        b'a'..=b'z' => Some(c - b'a' + 26),
        b'0'..=b'9' => Some(c - b'0' + 52),
        b'-' => Some(62),
        b'_' => Some(63),
        _ => None,
    }
}

/// Big-endian `s > floor(n/2)`.
fn is_high_s(s: &[u8; 32]) -> bool {
    let mut i = 0;
    while i < 32 {
        if s[i] != HALF_N[i] {
            return s[i] > HALF_N[i];
        }
        i += 1;
    }
    false
}

/// Length-independent byte comparison. Does not early-exit on a mismatched
/// byte, so it leaks nothing about where two equal-length inputs diverge.
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    let mut i = 0;
    while i < a.len() {
        diff |= a[i] ^ b[i];
        i += 1;
    }
    diff == 0
}
