// server/utils/signatureUtils.js
// Backend RSA-SHA256 signature verification for HELLO / RESPONSE / CONFIRM

const crypto = require("crypto");

/**
 * Convert JWK → PEM (public key)
 */
function jwkToPem(jwk) {
  if (!jwk || jwk.kty !== "RSA") {
    throw new Error("JWK is not RSA format");
  }

  // Convert base64url to base64
  function b64urlToB64(url) {
    return url.replace(/-/g, "+").replace(/_/g, "/");
  }

  const modulus = Buffer.from(b64urlToB64(jwk.n), "base64");
  const exponent = Buffer.from(b64urlToB64(jwk.e), "base64");

  // Create ASN.1 DER structure of RSA public key
  const pubKeyDer = crypto.createPublicKey({
    key: {
      n: modulus,
      e: exponent,
    },
    format: "jwk",
  }).export({ format: "pem", type: "spki" });

  return pubKeyDer;
}

/**
 * Verify RSA SHA-256 signature of handshake messages.
 * unsignedPayload = HELLO/RESPONSE/CONFIRM without the `signature` field
 */
function verifySignature(jwkPublicKey, unsignedPayload, signatureB64) {
  try {
    const pem = jwkToPem(jwkPublicKey);

    // Stringify payload canonically
    const message = JSON.stringify(unsignedPayload);

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(message);
    verify.end();

    const signature = Buffer.from(signatureB64, "base64");

    return verify.verify(pem, signature);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return false;
  }
}

module.exports = {
  verifySignature,
};
