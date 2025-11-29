// Convert object → ArrayBuffer for signature
function encodeForSigning(obj) {
  const json = JSON.stringify(obj);
  return new TextEncoder().encode(json);
}

// Sign an object using your RSA private key
export async function signPayload(privateKey, payloadObject) {
  const data = encodeForSigning(payloadObject);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Verify signature using peer's RSA public key
export async function verifySignature(publicKey, payloadObject, base64Sig) {
  const data = encodeForSigning(payloadObject);
  const sigBytes = Uint8Array.from(atob(base64Sig), (c) => c.charCodeAt(0));

  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    sigBytes,
    data
  );
}
