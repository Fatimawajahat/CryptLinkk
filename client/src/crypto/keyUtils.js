// client/src/crypto/keyUtils.js

// indexeddb helper (your original)
function openKeyDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("cryptlink-keys-db", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "name" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// read identity key record (your original)
async function getIdentityKeyRecord() {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", "readonly");
    const store = tx.objectStore("keys");
    const req = store.get("identity-key");

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// save identity key record (your original)
async function saveIdentityKeyRecord(record) {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", "readwrite");
    const store = tx.objectStore("keys");
    const req = store.put(record);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// rsa identity key generator (your original)
async function generateRsaIdentityKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicJwk, privateJwk };
}

// generate-or-load identity key (your original but cleaned)
export async function generateAndStoreIdentityKeyIfMissing() {
  const existing = await getIdentityKeyRecord();

  if (existing && existing.publicJwk && existing.privateJwk) {
    return JSON.stringify(existing.publicJwk);
  }

  const { publicJwk, privateJwk } = await generateRsaIdentityKeyPair();

  await saveIdentityKeyRecord({
    name: "identity-key",
    publicJwk,
    privateJwk,
  });

  return JSON.stringify(publicJwk);
}

// return full jwk pair (your original)
export async function getIdentityKeyPair() {
  let record = await getIdentityKeyRecord();

  if (!record) {
    const generated = await generateRsaIdentityKeyPair();
    record = {
      name: "identity-key",
      publicJwk: generated.publicJwk,
      privateJwk: generated.privateJwk,
    };
    await saveIdentityKeyRecord(record);
  }

  return {
    publicJwk: record.publicJwk,
    privateJwk: record.privateJwk,
  };
}

// arraybuffer → base64 (your original)
function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// sign string with identity private key (your original)
export async function signWithIdentityKey(messageString) {
  const { privateJwk } = await getIdentityKeyPair();

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const enc = new TextEncoder();
  const data = enc.encode(messageString);

  const signatureBuf = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    data
  );

  return bufferToBase64(signatureBuf);
}

/* ---------------------------------------------------------
   NEW FUNCTIONS ADDED FOR STEP 5 (clean + required)
   --------------------------------------------------------- */

// return public key JWK (new)
export async function getIdentityPublicKeyJWK() {
  const record = await getIdentityKeyRecord();
  return record ? record.publicJwk : null;
}

// return private CryptoKey for signing (new)
// return private CryptoKey for signing
export async function getIdentityPrivateKey() {
  const record = await getIdentityKeyRecord();
  
  if (!record || !record.privateJwk) {
    console.error("❌ No identity key record found");
    return null;
  }

  try {
    return await crypto.subtle.importKey(
      "jwk",
      record.privateJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } catch (err) {
    console.error("❌ Failed to import private key:", err);
    return null;
  }
}

// import peer public RSA key for verifying (new)
export async function importPeerIdentityKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"]
  );
}
