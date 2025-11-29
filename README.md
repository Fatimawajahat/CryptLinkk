# 🚀 CryptLink — End-to-End Encrypted Messaging Protocol

CryptLink is a custom **end-to-end encrypted (E2EE)** messaging and file-sharing system built for academic evaluation and real secure-protocol demonstration.  
It features a **3-step authenticated handshake**, **hybrid cryptography**, **MITM-resistant key exchange**, **strong replay protection**, **AES-GCM messaging**, and **secure file encryption**.

---

## 🔒 Core Features

### ✅ 1. Custom 3-Message Handshake (HELLO → RESPONSE → CONFIRM)

A unique authenticated key-establishment protocol that:

- Uses **3 messages** instead of a basic 2-step DH
- Includes **transcript-style binding**
- Uses a random **sessionId** to tie the flow together
- Signs all important fields, not just the ECDH key

This makes it **harder to tamper with** and easy to reason about in a report.

---

### ✅ 2. Strong Authentication & Identity Binding

Every handshake message contains:

- **RSA-2048 identity public key** (per user)
- Signature over:
  - ECDH public key (ephemeral)
  - Username
  - Timestamp
  - Nonce
  - Sequence number
  - Protocol version

This prevents:

- Impersonation  
- Silent man-in-the-middle  
- “Key substitution” attacks

---

### ✅ 3. Ephemeral ECDH (P-256) Key Exchange

We use:

- **ECDH on curve P-256** for forward secrecy
- Each handshake results in a shared secret
- That secret is expanded via **HKDF** into **two keys**:

1. `chatKey` → used for AES-256-GCM text messaging  
2. `fileKey` → used for AES-256-GCM file encryption

This separation avoids key reuse and is more professional than a single session key.

---

### ✅ 4. Replay Attack Protection

Replay protection is implemented using **all four**:

- **Nonces** → random values per HELLO / RESPONSE / CONFIRM and per message
- **Timestamps** → checked with a freshness window on the backend
- **Sequence numbers** → strictly increasing per direction
- **Verification logic** → server rejects:
  - Reused nonces
  - Old timestamps
  - Non-increasing sequence numbers

Replay attempts are also logged as **security events**.

---

### ✅ 5. Secure Messages (AES-256-GCM)

For each chat message:

- A unique **96-bit IV** is generated on the client
- Message is encrypted using **AES-256-GCM(sessionKey)**
- Stored on the server as:
  - ciphertext  
  - IV  
  - sender  
  - receiver  
  - timestamp  
  - nonce / seq metadata

Decryption is always done on the **client side**, so the backend **never sees plaintext**.

---

### ✅ 6. Secure File Sharing

File flow:

1. User selects a file in the browser
2. File is **chunked** (e.g., 64 KB / 128 KB per chunk)
3. Each chunk:
   - Gets its own IV
   - Is encrypted with **AES-256-GCM(fileKey)**
4. Encrypted chunks are uploaded to the backend
5. Receiver:
   - Downloads encrypted chunks
   - Decrypts locally with the same `fileKey`
   - Reassembles the original file in the browser

Server only stores **encrypted blobs**, never raw files.

---

### ✅ 7. MITM Attack Demonstrations

The project explicitly supports **two modes**:

- **With signature verification enabled** →  
  Modifying ECDH keys via Burp Suite causes **signature verification to fail**.  
  The handshake is rejected and no session key is established.

- **With signature verification disabled (for demo)** →  
  Attacker can modify ECDH keys in-flight.  
  The server accepts the handshake and the attacker can derive the same key, proving a successful MITM.

This is perfect for recording **attack vs defense demos**.

---

### ✅ 8. Logging & Security Auditing

Backend logs:

- Authentication attempts
- Key exchange attempts (HELLO, RESPONSE, CONFIRM)
- Failed decryptions
- Replay attack detections
- Invalid signatures
- Server-side metadata access

Each log entry includes:

- Event type
- Username (if known)
- IP address
- Timestamp
- Additional details (nonce, seq, etc.)

Logs can be exported / screenshotted for the report.

---

## 🧩 System Architecture

```text
    ┌──────────────────────────┐
    │         Frontend         │
    │      React.js Client     │
    │                          │
    │  - Registration/Login    │
    │  - Key generation (RSA)  │
    │  - ECDH handshake        │
    │  - AES-GCM messaging     │
    │  - File encryption       │
    └─────────────┬────────────┘
                  │
          JSON API over HTTPS
                  │
    ┌─────────────▼────────────┐
    │      Node.js Backend      │
    │        (Express)          │
    │                          │
    │  /api/auth               │
    │  /api/key-exchange       │
    │  /api/messages           │
    │  /api/files              │
    │  + Security logging      │
    └─────────────┬────────────┘
                  │
             MongoDB Storage
    ┌─────────────▼────────────┐
    │   Users   Sessions   Logs │
    │  Messages  Files   Chunks │
    └──────────────────────────┘
