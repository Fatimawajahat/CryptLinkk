// Utility: concatenate Uint8Arrays
function concatUint8(arrays) {
  let total = arrays.reduce((sum, a) => sum + a.length, 0);
  let out = new Uint8Array(total);
  let offset = 0;

  arrays.forEach((a) => {
    out.set(a, offset);
    offset += a.length;
  });

  return out;
}

// Extract step
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const info = new Uint8Array(0);
  const prk = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(prk);
}

// Expand step
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  let out = [];
  let prev = new Uint8Array(0);
  let n = Math.ceil(length / 32);

  for (let i = 1; i <= n; i++) {
    let input = concatUint8([prev, info, new Uint8Array([i])]);
    prev = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
    out.push(prev);
  }

  return concatUint8(out).slice(0, length);
}

// Public HKDF function
export async function hkdf(secret, infoStr, length = 32) {
  const salt = new Uint8Array(32); // zeros
  const info = new TextEncoder().encode(infoStr);

  const prk = await hkdfExtract(salt, secret);
  const okm = await hkdfExpand(prk, info, length);

  return okm;
}
