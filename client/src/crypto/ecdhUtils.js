// client/src/crypto/ecdhUtils.js
// ephemeral ecdh key pair generate karein p256 curve pe

// generate ephemeral ECDH keypair (your original)
export async function generateEphemeralECDHKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits", "deriveKey"]
  );

  const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);

  return {
    publicJwk,
    privateKey: keyPair.privateKey,
  };
}

// import peer ECDH public key (your original)
export async function importPeerECDHPublicKey(peerPublicJwk) {
  return window.crypto.subtle.importKey(
    "jwk",
    peerPublicJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    []
  );
}

// helper chaiye raw buffer → base64 (your original)
function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/* -----------------------------------------------------------
   NEW: derive ONLY raw shared secret (needed for confirmHash)
   ----------------------------------------------------------- */
export async function deriveSharedSecretRaw(privateKey, peerPublicJwk) {
  const peerKey = await importPeerECDHPublicKey(peerPublicJwk);

  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerKey,
    },
    privateKey,
    256
  );

  return new Uint8Array(sharedBits);
}

/* -----------------------------------------------------------
   NEW: HKDF extract + expand helpers (clean + reusable)
   ----------------------------------------------------------- */

// concatenate Uint8Arrays
function concatUint8(arrays) {
  let total = arrays.reduce((s, a) => s + a.length, 0);
  let out = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((a) => {
    out.set(a, offset);
    offset += a.length;
  });
  return out;
}

// HKDF extract step
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(prk);
}

// HKDF expand step
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const blocks = [];
  let previous = new Uint8Array();

  let n = Math.ceil(length / 32);

  for (let i = 1; i <= n; i++) {
    const input = concatUint8([
      previous,
      info,
      new Uint8Array([i]),
    ]);

    previous = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
    blocks.push(previous);
  }

  return concatUint8(blocks).slice(0, length);
}

/* -----------------------------------------------------------
   NEW: clean HKDF wrapper (used by both initiator & responder)
   ----------------------------------------------------------- */
export async function hkdf(secretUint8, infoStr, length = 32) {
  const salt = new Uint8Array(32);
  const info = new TextEncoder().encode(infoStr);

  const prk = await hkdfExtract(salt, secretUint8);
  const okm = await hkdfExpand(prk, info, length);

  return okm;
}

/* -----------------------------------------------------------
   YOUR ORIGINAL FUNCTION (updated to use new HKDF)
   Now returns:
   - chatKey
   - fileKey
   - sharedSecretB64
   ----------------------------------------------------------- */
export async function deriveSessionKeyFromECDH(options) {
  const { ownPrivateKey, peerPublicJwk, sessionId } = options;

  const sharedBits = await deriveSharedSecretRaw(ownPrivateKey, peerPublicJwk);

  const sharedSecretB64 = bufferToBase64(sharedBits);

  const info_chat = `cryptlink-chat-${sessionId}`;
  const info_file = `cryptlink-file-${sessionId}`;

  const chatKeyRaw = await hkdf(sharedBits, info_chat, 32);
  const fileKeyRaw = await hkdf(sharedBits, info_file, 32);

  const chatKey = await crypto.subtle.importKey(
    "raw",
    chatKeyRaw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  const fileKey = await crypto.subtle.importKey(
    "raw",
    fileKeyRaw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return {
    chatKey,
    fileKey,
    sharedSecretB64,
    info_chat,
    info_file,
  };
}
