//! Tests for the WebAuthn verifier, driven entirely by the real fixtures in
//! `contracts/tracks/fixtures/`. No test data is constructed here: every byte
//! comes from `vector1.json` / `vector2.json`, which were captured from
//! Windows Hello on Chrome. The only values derived locally are negative cases
//! built by mutating those real inputs.

use super::*;

const VECTOR1: &str = include_str!("../tracks/fixtures/vector1.json");
const VECTOR2: &str = include_str!("../tracks/fixtures/vector2.json");

/// The origin both fixtures were captured against.
const FIXTURE_ORIGIN: &[u8] = b"https://webauthn.io";

/// SHA-256 backed by RustCrypto, used only in tests. On-chain the contract
/// uses the EVM precompile at 0x02 instead; see `Sha256Backend`.
struct TestSha256;

impl Sha256Backend for TestSha256 {
    fn sha256_parts(&self, parts: &[&[u8]]) -> Result<[u8; 32], VerifyError> {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        for part in parts {
            h.update(part);
        }
        Ok(h.finalize().into())
    }
}

/// Shorthand for the test hasher.
const HASHER: TestSha256 = TestSha256;

/// P-256 group order, big-endian. Used only to normalise s in tests.
const N: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84, 0xf3, 0xb9, 0xca, 0xc2,
    0xfc, 0x63, 0x25, 0x51,
];

/// A decoded fixture.
struct Vector {
    pubkey_x: [u8; 32],
    pubkey_y: [u8; 32],
    authenticator_data: Vec<u8>,
    client_data_json: Vec<u8>,
    sig_r: [u8; 32],
    /// s exactly as the authenticator emitted it (both fixtures are high-s).
    sig_s_raw: [u8; 32],
    /// s normalised to the low form, as a client must do before submitting.
    sig_s_low: [u8; 32],
    challenge: [u8; 32],
}

fn load(src: &str) -> Vector {
    let pk = b64_std(json_field(src, "publicKeyDer"));
    let challenge = b64_std(json_field(src, "challenge"));
    let authenticator_data = b64_std(json_field(src, "authenticatorData"));
    let client_data_json = b64_std(json_field(src, "clientDataJSON"));
    let sig_der = b64_std(json_field(src, "signatureDer"));

    // Uncompressed point lives in the tail of the SPKI: 0x04 || x || y.
    assert_eq!(pk.len(), 91, "unexpected SPKI length");
    let point = &pk[pk.len() - 65..];
    assert_eq!(point[0], 0x04, "point is not uncompressed");
    let mut pubkey_x = [0u8; 32];
    let mut pubkey_y = [0u8; 32];
    pubkey_x.copy_from_slice(&point[1..33]);
    pubkey_y.copy_from_slice(&point[33..65]);

    let (sig_r, sig_s_raw) = parse_der_sig(&sig_der);
    let sig_s_low = normalize_s(sig_s_raw);

    let mut ch = [0u8; 32];
    assert_eq!(challenge.len(), 32);
    ch.copy_from_slice(&challenge);

    Vector {
        pubkey_x,
        pubkey_y,
        authenticator_data,
        client_data_json,
        sig_r,
        sig_s_raw,
        sig_s_low,
        challenge: ch,
    }
}

impl Vector {
    /// Verify with the low-s signature and the correct origin.
    fn verify(&self) -> Result<(), VerifyError> {
        self.verify_with(
            &self.authenticator_data,
            &self.client_data_json,
            &self.sig_s_low,
            &self.challenge,
            FIXTURE_ORIGIN,
        )
    }

    fn verify_with(
        &self,
        authenticator_data: &[u8],
        client_data_json: &[u8],
        sig_s: &[u8; 32],
        expected_challenge: &[u8; 32],
        expected_origin: &[u8],
    ) -> Result<(), VerifyError> {
        verify_assertion(
            &HASHER,
            &self.pubkey_x,
            &self.pubkey_y,
            authenticator_data,
            client_data_json,
            &self.sig_r,
            sig_s,
            expected_challenge,
            expected_origin,
        )
    }
}

// -------------------------------------------------------------------------
// Required tests
// -------------------------------------------------------------------------

#[test]
fn vector1_verifies() {
    assert_eq!(load(VECTOR1).verify(), Ok(()));
}

#[test]
fn vector2_verifies() {
    assert_eq!(load(VECTOR2).verify(), Ok(()));
}

#[test]
fn swapping_challenge_is_rejected() {
    let v1 = load(VECTOR1);
    let v2 = load(VECTOR2);
    assert_ne!(v1.challenge, v2.challenge, "fixtures must differ to be meaningful");
    let got = v1.verify_with(
        &v1.authenticator_data,
        &v1.client_data_json,
        &v1.sig_s_low,
        &v2.challenge, // vector2's challenge against vector1's assertion
        FIXTURE_ORIGIN,
    );
    assert_eq!(got, Err(VerifyError::ChallengeMismatch));
}

#[test]
fn flipping_authenticator_data_byte_is_rejected() {
    let v = load(VECTOR1);
    let mut tampered = v.authenticator_data.clone();
    tampered[5] ^= 0x01; // inside rpIdHash, so flags/UP stay valid
    let got = v.verify_with(
        &tampered,
        &v.client_data_json,
        &v.sig_s_low,
        &v.challenge,
        FIXTURE_ORIGIN,
    );
    // authenticatorData is covered by the signature, so this must fail the
    // curve check rather than any earlier structural check.
    assert_eq!(got, Err(VerifyError::InvalidSignature));
}

#[test]
fn high_s_signature_is_rejected() {
    // Both fixtures are high-s as captured. The raw form must be refused even
    // though it is a cryptographically valid signature.
    for src in [VECTOR1, VECTOR2] {
        let v = load(src);
        assert!(is_high_s(&v.sig_s_raw), "fixture expected to be high-s");
        let got = v.verify_with(
            &v.authenticator_data,
            &v.client_data_json,
            &v.sig_s_raw,
            &v.challenge,
            FIXTURE_ORIGIN,
        );
        assert_eq!(got, Err(VerifyError::HighS));
    }
}

#[test]
fn clearing_user_presence_bit_is_rejected() {
    let v = load(VECTOR1);
    let mut ad = v.authenticator_data.clone();
    assert_eq!(ad[32], 0x1d, "fixture flags changed");
    ad[32] &= !0x01; // clear UP
    let got = v.verify_with(&ad, &v.client_data_json, &v.sig_s_low, &v.challenge, FIXTURE_ORIGIN);
    assert_eq!(got, Err(VerifyError::UserPresenceNotSet));
}

#[test]
fn malformed_client_data_json_errors_cleanly() {
    let v = load(VECTOR1);

    // Every truncation of a real clientDataJSON must return Err, never panic.
    for cut in 0..v.client_data_json.len() {
        let truncated = &v.client_data_json[..cut];
        let got = v.verify_with(
            &v.authenticator_data,
            truncated,
            &v.sig_s_low,
            &v.challenge,
            FIXTURE_ORIGIN,
        );
        assert!(got.is_err(), "truncation at {cut} unexpectedly succeeded");
    }

    // Assorted malformed inputs, all of which must be clean errors.
    let cases: &[&[u8]] = &[
        b"",
        b"{",
        b"not json at all",
        // challenge key present but string never closed
        br#"{"type":"webauthn.get","origin":"https://webauthn.io","challenge":"abc"#,
        // challenge present but wrong length
        br#"{"type":"webauthn.get","origin":"https://webauthn.io","challenge":"tooshort"}"#,
        // challenge with standard-base64 characters, which are not base64url
        br#"{"type":"webauthn.get","origin":"https://webauthn.io","challenge":"ilSK1t54w1TaYCJiCsGhjHojq/KtcDWGSrAYp0vMnqo"}"#,
        // embedded escape in the challenge string
        br#"{"type":"webauthn.get","origin":"https://webauthn.io","challenge":"ab\"cd"}"#,
    ];
    for case in cases {
        let got = v.verify_with(
            &v.authenticator_data,
            case,
            &v.sig_s_low,
            &v.challenge,
            FIXTURE_ORIGIN,
        );
        assert!(got.is_err(), "malformed input unexpectedly succeeded: {case:?}");
    }
}

// -------------------------------------------------------------------------
// Additional coverage
// -------------------------------------------------------------------------

#[test]
fn vector1_actually_exercises_base64url() {
    // vector2's challenge happens to encode without - or _, so it would pass
    // even with a plain-base64 decoder. vector1 is the one that proves the
    // base64url path works; assert that rather than assuming it.
    let v1 = load(VECTOR1);
    let field = json_string_field(&v1.client_data_json, CHALLENGE_KEY).unwrap();
    assert!(
        field.contains(&b'-') || field.contains(&b'_'),
        "vector1 no longer covers the base64url alphabet"
    );
}

#[test]
fn wrong_origin_is_rejected() {
    let v = load(VECTOR1);
    let got = v.verify_with(
        &v.authenticator_data,
        &v.client_data_json,
        &v.sig_s_low,
        &v.challenge,
        b"https://evil.example",
    );
    assert_eq!(got, Err(VerifyError::OriginMismatch));
}

#[test]
fn wrong_ceremony_type_is_rejected() {
    let v = load(VECTOR1);
    let forged = br#"{"type":"webauthn.create","challenge":"ilSK1t54w1TaYCJiCsGhjHojq_KtcDWGSrAYp0vMnqo","origin":"https://webauthn.io","crossOrigin":false}"#;
    let got = v.verify_with(
        &v.authenticator_data,
        forged,
        &v.sig_s_low,
        &v.challenge,
        FIXTURE_ORIGIN,
    );
    assert_eq!(got, Err(VerifyError::TypeMismatch));
}

#[test]
fn short_authenticator_data_is_rejected() {
    let v = load(VECTOR1);
    let got = v.verify_with(
        &v.authenticator_data[..36],
        &v.client_data_json,
        &v.sig_s_low,
        &v.challenge,
        FIXTURE_ORIGIN,
    );
    assert_eq!(got, Err(VerifyError::AuthDataTooShort));
}

#[test]
fn b64url_decoder_rejects_standard_base64_alphabet() {
    // 43 chars, but using + and / which belong to standard base64.
    let bad = b"ilSK1t54w1TaYCJiCsGhjHojq/KtcDWGSrAYp0vMnq+";
    assert_eq!(bad.len(), 43);
    assert_eq!(b64url_decode_32(bad), Err(VerifyError::ChallengeMalformed));
}

#[test]
fn b64url_decoder_rejects_non_canonical_trailing_bits() {
    // 43 base64url chars carry 258 bits; the low 2 must be zero. Take a real
    // encoding and bump the final character so those bits are set.
    let v = load(VECTOR1);
    let field = json_string_field(&v.client_data_json, CHALLENGE_KEY).unwrap();
    let mut bad = field.to_vec();
    let last = bad.len() - 1;
    // 'o' -> 'p' sets the trailing bits without leaving the alphabet.
    assert_eq!(bad[last], b'o');
    bad[last] = b'p';
    assert_eq!(b64url_decode_32(&bad), Err(VerifyError::ChallengeMalformed));
}

#[test]
fn challenge_preimage_binds_nonce_and_address() {
    let addr_a = [0x11u8; 20];
    let addr_b = [0x22u8; 20];
    let target = [0x33u8; 20];
    let value = [0u8; 32];
    let data = b"payload";

    let base = unwrap_preimage(0, &addr_a, &target, &value, data);
    // Rule 6: changing the nonce must change the challenge.
    assert_ne!(base, unwrap_preimage(1, &addr_a, &target, &value, data));
    // Rule 6: changing the contract address must change the challenge.
    assert_ne!(base, unwrap_preimage(0, &addr_b, &target, &value, data));
    // Same inputs must be deterministic.
    assert_eq!(base, unwrap_preimage(0, &addr_a, &target, &value, data));
}

// -------------------------------------------------------------------------
// Packed-blob entry point
// -------------------------------------------------------------------------

impl Vector {
    /// Serialise into the packed layout the contract accepts.
    fn pack(&self) -> Vec<u8> {
        let mut b = Vec::new();
        b.extend_from_slice(&self.pubkey_x);
        b.extend_from_slice(&self.pubkey_y);
        b.extend_from_slice(&self.sig_r);
        b.extend_from_slice(&self.sig_s_low);
        b.extend_from_slice(&self.challenge);
        let len = self.authenticator_data.len();
        assert!(len <= u16::MAX as usize);
        b.extend_from_slice(&(len as u16).to_be_bytes());
        b.extend_from_slice(&self.authenticator_data);
        b.extend_from_slice(&self.client_data_json);
        b
    }
}

#[test]
fn packed_vector1_verifies() {
    let v = load(VECTOR1);
    assert_eq!(verify_assertion_packed(&HASHER, &v.pack(), FIXTURE_ORIGIN), Ok(()));
}

#[test]
fn packed_vector2_verifies() {
    let v = load(VECTOR2);
    assert_eq!(verify_assertion_packed(&HASHER, &v.pack(), FIXTURE_ORIGIN), Ok(()));
}

#[test]
fn packed_layout_round_trips_through_the_unpacked_api() {
    // The packed path must agree with the 8-argument path on the same inputs.
    let v = load(VECTOR1);
    assert_eq!(verify_assertion_packed(&HASHER, &v.pack(), FIXTURE_ORIGIN), v.verify());
}

#[test]
fn packed_truncation_errors_cleanly() {
    // Every truncation of a valid blob must return Err, never panic.
    let v = load(VECTOR1);
    let full = v.pack();
    for cut in 0..full.len() {
        assert!(
            verify_assertion_packed(&HASHER, &full[..cut], FIXTURE_ORIGIN).is_err(),
            "truncation at {cut} unexpectedly succeeded"
        );
    }
}

#[test]
fn packed_lying_length_prefix_is_rejected() {
    let v = load(VECTOR1);

    // authenticator_data_len far beyond the blob.
    let mut lying = v.pack();
    lying[super::offset::AD_LEN] = 0xff;
    lying[super::offset::AD_LEN + 1] = 0xff;
    assert_eq!(
        verify_assertion_packed(&HASHER, &lying, FIXTURE_ORIGIN),
        Err(VerifyError::MalformedAssertion)
    );

    // Length prefix that swallows the clientDataJSON entirely.
    let mut greedy = v.pack();
    let overflow = (greedy.len() - super::offset::AD) as u16;
    greedy[super::offset::AD_LEN..super::offset::AD_LEN + 2]
        .copy_from_slice(&overflow.to_be_bytes());
    // Blob is exactly consumed, so clientDataJSON is empty -> no type field.
    assert_eq!(
        verify_assertion_packed(&HASHER, &greedy, FIXTURE_ORIGIN),
        Err(VerifyError::TypeMismatch)
    );
}

#[test]
fn packed_minimum_length_blob_is_rejected() {
    assert_eq!(
        verify_assertion_packed(&HASHER, &[0u8; super::offset::AD - 1], FIXTURE_ORIGIN),
        Err(VerifyError::MalformedAssertion)
    );
}

/// challenge_preimage is fallible only because of the on-chain backend; with
/// the test hasher it cannot fail.
fn unwrap_preimage(
    nonce: u64,
    contract_address: &[u8; 20],
    target: &[u8; 20],
    value: &[u8; 32],
    call_data: &[u8],
) -> [u8; 32] {
    challenge_preimage(&HASHER, nonce, contract_address, target, value, call_data).unwrap()
}

// -------------------------------------------------------------------------
// Test-only fixture decoding. Not compiled into the contract.
// -------------------------------------------------------------------------

/// Pull a string value out of the fixture JSON. Test-only, and deliberately
/// dumb -- the fixtures are trusted local files.
fn json_field<'a>(src: &'a str, key: &str) -> &'a str {
    let needle = format!("\"{key}\"");
    let at = src.find(&needle).unwrap_or_else(|| panic!("missing key {key}"));
    let after_colon = src[at + needle.len()..].find(':').unwrap() + at + needle.len() + 1;
    let rest = &src[after_colon..];
    let open = rest.find('"').unwrap();
    let close = rest[open + 1..].find('"').unwrap();
    &rest[open + 1..open + 1 + close]
}

/// Standard base64 (with padding, `+` and `/`) -- the fixture encoding.
fn b64_std(s: &str) -> Vec<u8> {
    fn val(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut out = Vec::new();
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for &c in s.as_bytes() {
        if c == b'=' {
            break;
        }
        let v = val(c).unwrap_or_else(|| panic!("bad base64 char {c:?}"));
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    out
}

/// Parse a DER `SEQUENCE { INTEGER r, INTEGER s }` into fixed 32-byte scalars.
fn parse_der_sig(der: &[u8]) -> ([u8; 32], [u8; 32]) {
    assert_eq!(der[0], 0x30, "not a SEQUENCE");
    let mut i = 2;
    assert_eq!(der[i], 0x02, "r is not an INTEGER");
    let rlen = der[i + 1] as usize;
    let r = &der[i + 2..i + 2 + rlen];
    i += 2 + rlen;
    assert_eq!(der[i], 0x02, "s is not an INTEGER");
    let slen = der[i + 1] as usize;
    let s = &der[i + 2..i + 2 + slen];
    (right_align_32(r), right_align_32(s))
}

/// Right-align a big-endian integer into 32 bytes, dropping DER's leading
/// zero padding byte when present.
fn right_align_32(v: &[u8]) -> [u8; 32] {
    let trimmed = if v.len() > 32 { &v[v.len() - 32..] } else { v };
    let mut out = [0u8; 32];
    out[32 - trimmed.len()..].copy_from_slice(trimmed);
    out
}

/// Normalise s to the low form: if s > n/2, replace it with n - s.
///
/// This is exactly what the frontend/relayer must do before submitting, and it
/// is safe: (r, s) and (r, n - s) are both valid signatures over the same
/// message, so normalising never invalidates a genuine assertion.
fn normalize_s(s: [u8; 32]) -> [u8; 32] {
    if !is_high_s(&s) {
        return s;
    }
    let mut out = [0u8; 32];
    let mut borrow = 0i16;
    for i in (0..32).rev() {
        let diff = N[i] as i16 - s[i] as i16 - borrow;
        if diff < 0 {
            out[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            out[i] = diff as u8;
            borrow = 0;
        }
    }
    assert_eq!(borrow, 0, "n - s underflowed");
    out
}
