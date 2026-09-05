/**
 * Raw WebAuthn + P-256 plumbing. No wrapper libraries, per CLAUDE.md.
 */

/** P-256 group order. */
export const P256_N =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

const HALF_N = P256_N / 2n;

/**
 * ArrayBuffer-backed bytes. TypeScript 5.7 made Uint8Array generic over its
 * backing buffer, and WebAuthn's BufferSource rejects the SharedArrayBuffer
 * case, so the concrete form has to be named explicitly.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Fold s into the low half of the curve order.
 *
 * The contract rejects s > n/2 (CLAUDE.md rule 4) and Windows Hello emits
 * high-s roughly half the time, so this must run on EVERY signature, not just
 * ones that look wrong. (r, s) and (r, n - s) are both valid for the same
 * message, so normalising never invalidates a genuine assertion.
 */
export function normalizeS(s: bigint): bigint {
  return s > HALF_N ? P256_N - s : s;
}

export function isHighS(s: bigint): boolean {
  return s > HALF_N;
}

export function bytesToBigInt(b: Uint8Array): bigint {
  let out = 0n;
  for (const byte of b) out = (out << 8n) | BigInt(byte);
  return out;
}

export function toHex32(v: bigint): `0x${string}` {
  return `0x${v.toString(16).padStart(64, "0")}`;
}

export function bytesToHex(b: Uint8Array): `0x${string}` {
  let out = "";
  for (const byte of b) out += byte.toString(16).padStart(2, "0");
  return `0x${out}`;
}

export function hexToBytes(hex: string): Bytes {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Pull the uncompressed point out of a DER SPKI public key.
 *
 * For prime256v1 the key is 91 bytes and ends with the 65-byte point
 * 0x04 || X || Y, so reading the tail avoids a full ASN.1 parser.
 */
export function parseSpkiPublicKey(spki: Uint8Array): { x: bigint; y: bigint } {
  if (spki.length < 65) {
    throw new Error(`SPKI too short: ${spki.length} bytes`);
  }
  const point = spki.slice(spki.length - 65);
  if (point[0] !== 0x04) {
    throw new Error(
      `expected an uncompressed point (0x04), got 0x${point[0].toString(16)}`,
    );
  }
  return {
    x: bytesToBigInt(point.slice(1, 33)),
    y: bytesToBigInt(point.slice(33, 65)),
  };
}

/**
 * Parse a DER `SEQUENCE { INTEGER r, INTEGER s }` ECDSA signature.
 *
 * Authenticators emit DER; the contract wants two raw 32-byte scalars.
 */
export function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("bad signature: not a DER SEQUENCE");

  // Length may use the long form, though P-256 signatures never need it.
  let seqLen = der[i++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let k = 0; k < n; k++) seqLen = (seqLen << 8) | der[i++];
  }

  if (der[i++] !== 0x02) throw new Error("bad signature: r is not an INTEGER");
  const rLen = der[i++];
  const r = bytesToBigInt(der.slice(i, i + rLen));
  i += rLen;

  if (der[i++] !== 0x02) throw new Error("bad signature: s is not an INTEGER");
  const sLen = der[i++];
  const s = bytesToBigInt(der.slice(i, i + sLen));

  return { r, s };
}

export interface CreatedPasskey {
  credentialId: Bytes;
  x: bigint;
  y: bigint;
}

export async function createPasskey(): Promise<CreatedPasskey> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      // The RP id must match the page's own domain. Hardcoding "localhost"
      // made every credential unusable anywhere else.
      rp: { name: "Liquid Pass", id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "passkey-wallet",
        displayName: "PassKey Wallet",
      },
      // ES256 / P-256 only. The contract verifies secp256r1 and nothing else,
      // so offering any other algorithm would produce an unusable credential.
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
      },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("passkey creation was cancelled");

  const response = credential.response as AuthenticatorAttestationResponse;

  const alg = response.getPublicKeyAlgorithm?.();
  if (alg !== undefined && alg !== -7) {
    throw new Error(`authenticator used algorithm ${alg}, expected -7 (ES256)`);
  }

  const spki = response.getPublicKey?.();
  if (!spki) throw new Error("authenticator did not return a public key");

  const { x, y } = parseSpkiPublicKey(new Uint8Array(spki));
  return { credentialId: new Uint8Array(credential.rawId), x, y };
}

export interface SignedAssertion {
  authenticatorData: Bytes;
  clientDataJSON: Bytes;
  r: bigint;
  /** Already normalised to low-s. This is what goes on chain. */
  s: bigint;
  /** s exactly as the authenticator emitted it, for display only. */
  rawS: bigint;
  wasHighS: boolean;
}

export async function signChallenge(
  challenge: Bytes,
  credentialId: Bytes,
): Promise<SignedAssertion> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: "public-key", id: credentialId }],
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("signing was cancelled");

  const response = assertion.response as AuthenticatorAssertionResponse;
  const { r, s } = parseDerSignature(new Uint8Array(response.signature));

  return {
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
    r,
    s: normalizeS(s),
    rawS: s,
    wasHighS: isHighS(s),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Additions for the on-page verifier.
 *
 * Everything below re-derives, in the browser, exactly what the Stylus
 * contract re-derives on chain -- so the page can show the intermediate values
 * rather than asserting that they matched.
 * ──────────────────────────────────────────────────────────────────────────── */

export async function sha256(bytes: Uint8Array): Promise<Bytes> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(digest);
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Bytes {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * The message a WebAuthn authenticator actually signs.
 *
 * CLAUDE.md rule 1: it is sha256(authenticatorData || sha256(clientDataJSON)),
 * NOT the transaction hash. Getting this wrong is the classic way to build a
 * verifier that never validates anything.
 *
 * Returned unhashed here because WebCrypto's ECDSA verify applies the final
 * SHA-256 itself; the contract hashes it explicitly.
 */
export async function signedMessage(
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
): Promise<Bytes> {
  return concatBytes(authenticatorData, await sha256(clientDataJSON));
}

export function base64urlToBytes(s: string): Bytes {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Pull the challenge out of clientDataJSON the way the contract does.
 *
 * CLAUDE.md rule 3: locate the `"challenge":"` substring and read to the
 * closing quote. No JSON parsing, and malformed input returns null instead of
 * throwing.
 */
export function extractChallenge(clientDataJSON: Uint8Array): string | null {
  const text = new TextDecoder().decode(clientDataJSON);
  const key = '"challenge":"';
  const start = text.indexOf(key);
  if (start < 0) return null;
  const from = start + key.length;
  const end = text.indexOf('"', from);
  if (end < 0) return null;
  return text.slice(from, end);
}

/** Same idea, for the origin the contract binds against. */
export function extractOrigin(clientDataJSON: Uint8Array): string | null {
  const text = new TextDecoder().decode(clientDataJSON);
  const key = '"origin":"';
  const start = text.indexOf(key);
  if (start < 0) return null;
  const from = start + key.length;
  const end = text.indexOf('"', from);
  if (end < 0) return null;
  return text.slice(from, end);
}

/** authenticatorData flags. Bit 0 is user presence, bit 2 user verification. */
export function parseFlags(authenticatorData: Uint8Array): {
  userPresent: boolean;
  userVerified: boolean;
} {
  const flags = authenticatorData[32] ?? 0;
  return { userPresent: (flags & 0x01) !== 0, userVerified: (flags & 0x04) !== 0 };
}

/**
 * Verify the assertion in the browser, against the same public key the
 * contract would use.
 *
 * This is a genuine secp256r1 verification -- WebCrypto doing exactly the
 * arithmetic the Stylus contract does with the p256 crate. It proves the
 * assertion is real without needing a transaction, which is the point: it lets
 * anyone see the P-256 path work even when they cannot execute on chain.
 */
export async function verifyLocally(
  x: bigint,
  y: bigint,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  r: bigint,
  s: bigint,
): Promise<boolean> {
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64url(toBytes32(x)),
    y: bytesToBase64url(toBytes32(y)),
    ext: true,
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  // WebCrypto wants the raw r||s pair, not the DER the authenticator emitted.
  const sig = concatBytes(toBytes32(r), toBytes32(s));
  const message = await signedMessage(authenticatorData, clientDataJSON);

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    sig as BufferSource,
    message as BufferSource,
  );
}

function toBytes32(v: bigint): Bytes {
  const out = new Uint8Array(32);
  let n = v;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function bytesToBase64url(b: Uint8Array): string {
  let bin = "";
  for (const byte of b) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
