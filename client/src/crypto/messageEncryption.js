// ye file aes gcm ka scene handle krti hae
// frontend pe msg encrypt aur decrypt dono yahi hon gy
// backend ko kabhi plaintext nahi bhejna warna e2ee fail ho jaye ga

// buffer → base64 helper
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return window.btoa(bin);
}

// base64 → buffer helper
function base64ToBuf(b64) {
  const bin = window.atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    buf[i] = bin.charCodeAt(i);
  }
  return buf.buffer;
}

/* ---------------------------------------------------
   ENCRYPT plaintext with AES-256-GCM
   ---------------------------------------------------
   input:
     plaintext (string)
     sessionKey (CryptoKey)
   output:
     {
       ciphertext: "base64",
       iv: "base64"
     }
---------------------------------------------------- */
export async function encryptMessageWithAES(plaintext, sessionKey) {
  // random iv -- 96 bit (12 bytes) recommended for gcm
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const enc = new TextEncoder();
  const ptBytes = enc.encode(plaintext);

  // actual encryption
  const cipherBuf = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sessionKey,
    ptBytes
  );

  return {
    ciphertext: bufToBase64(cipherBuf),
    iv: bufToBase64(iv),
  };
}

/* ---------------------------------------------------
   DECRYPT ciphertext with AES-256-GCM
   ---------------------------------------------------
   input:
     ciphertext (base64)
     iv (base64)
     sessionKey (CryptoKey)
   output:
     plaintext string
---------------------------------------------------- */
export async function decryptMessageWithAES(ciphertextB64, ivB64, sessionKey) {
  try {
    const cipherBuf = base64ToBuf(ciphertextB64);
    const iv = new Uint8Array(base64ToBuf(ivB64));

    const plainBuf = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      sessionKey,
      cipherBuf
    );

    const dec = new TextDecoder();
    return dec.decode(plainBuf);
  } catch (err) {
    console.error("decrypt fail", err);
    return "[decrypt error]";
  }
}
