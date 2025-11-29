// client/src/crypto/fileEncryption.js

// file ko chunks mei split karny ka helper
export function splitFileIntoChunks(arrayBuffer, chunkSize = 64 * 1024) {
  const chunks = [];
  let offset = 0;

  while (offset < arrayBuffer.byteLength) {
    const end = Math.min(offset + chunkSize, arrayBuffer.byteLength);
    chunks.push(arrayBuffer.slice(offset, end));
    offset = end;
  }

  return chunks;
}

// arraybuffer ko base64 string mei convert karne ka helper
function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// base64 ko wapis arraybuffer bana ne ka helper
function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// main encryption helper ek chunk k liye
export async function encryptChunk(chunkArrayBuffer, sessionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bit iv

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sessionKey,
    chunkArrayBuffer
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  };
}

// file ko read krny ka helper
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsArrayBuffer(file);
  });
}

// ek chunk ko decrypt krny ka helper
export async function decryptChunk(ciphertextB64, ivB64, sessionKey) {
  const ctBuf = base64ToArrayBuffer(ciphertextB64);
  const ivBuf = base64ToArrayBuffer(ivB64);

  const plaintextBuf = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuf),
    },
    sessionKey,
    ctBuf
  );

  return plaintextBuf; // arraybuffer
}

// sare chunks ko merge kr k final blob banana
export function mergeChunksToBlob(chunks, mimeType = "application/octet-stream") {
  let totalLen = 0;
  chunks.forEach((c) => {
    totalLen += c.byteLength;
  });

  const merged = new Uint8Array(totalLen);
  let offset = 0;

  chunks.forEach((c) => {
    const u8 = new Uint8Array(c);
    merged.set(u8, offset);
    offset += u8.byteLength;
  });

  return new Blob([merged], { type: mimeType });
}
