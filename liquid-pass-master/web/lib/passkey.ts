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
      rp: { name: "PassKey Wallet", id: "localhost" },
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
      rpId: "localhost",
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
