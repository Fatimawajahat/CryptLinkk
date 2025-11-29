import { useState } from "react";
import axios from "axios";

import {
  getIdentityPublicKeyJWK,
  getIdentityPrivateKey,
  importPeerIdentityKey,
} from "../crypto/keyUtils";

import {
  generateEphemeralECDHKeyPair,
  deriveSharedSecretRaw,
  hkdf,
} from "../crypto/ecdhUtils";

import { signPayload, verifySignature } from "../crypto/signatureUtils";

function CryptoPanel({ onSessionKeyReady }) {
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [myECDHKeys, setMyECDHKeys] = useState(null);
  const [savedHello, setSavedHello] = useState(null);
  const [savedResponse, setSavedResponse] = useState(null);
  const [partnerName, setPartnerName] = useState(null);

  const addLog = (msg) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const currentUser = () => localStorage.getItem("cryptlink_username") || "";

  // decide peer from HELLO msg (works for both initiator + responder)
  const getPeerFromHello = (hello) => {
    const me = currentUser();
    return hello.from === me ? hello.to : hello.from;
  };

  /* ---------------------------------------------------------
     1) Initiator sends HELLO
  --------------------------------------------------------- */
  const startHello = async () => {
    try {
      const toUser = prompt("Start secure session with which user?");
      if (!toUser) return;

      addLog("Generating ephemeral ECDH keys...");
      const eph = await generateEphemeralECDHKeyPair();
      setMyECDHKeys(eph);

      setPartnerName(toUser);

      const nonceA = crypto.randomUUID();
      const timestampA = Date.now();
      
      const publicIdentity = await getIdentityPublicKeyJWK();
      if (!publicIdentity) {
        addLog("❌ ERROR: Identity key not found. Please logout and login again.");
        return;
      }
      
      const privateIdentity = await getIdentityPrivateKey();
      if (!privateIdentity) {
        addLog("❌ ERROR: Private key not found. Please logout and login again.");
        return;
      }

      addLog("✅ Identity keys loaded successfully");

      const helloPayload = {
  type: "HELLO",
  from: currentUser(),
  to: toUser,
  ecdhPublic: eph.publicJwk,
  nonce: nonceA,
  timestamp: timestampA,
  seq: 1, // first msg from initiator
  protocolVersion: "CLINK-1.0",
  identityPublicJwk: publicIdentity,
};


      addLog("Signing HELLO message...");
      const signature = await signPayload(privateIdentity, helloPayload);
      const helloMessage = { ...helloPayload, signature };

      addLog("Sending HELLO message to server...");

      const res = await axios.post(
        "http://localhost:5000/api/key-exchange/start",
        {
          from: helloPayload.from,
          to: toUser,
          helloMessage,
        }
      );

      setSessionId(res.data.sessionId);
      setSavedHello(helloMessage);

      addLog("✅ HELLO sent. SessionId: " + res.data.sessionId);
    } catch (err) {
      console.error("HELLO error details:", err);
      addLog("❌ HELLO error: " + err.message);
    }
  };

  /* ---------------------------------------------------------
     2) Responder loads pending HELLO
  --------------------------------------------------------- */
  const loadPendingSessions = async () => {
    try {
      addLog("Loading pending sessions...");
      const me = currentUser();

      const res = await axios.get(
        `http://localhost:5000/api/key-exchange/pending?user=${me}`
      );

      if (res.data.sessions.length === 0) {
        addLog("No pending sessions found.");
        return;
      }

      const s = res.data.sessions[0];
      setSessionId(s.sessionId);
      setSavedHello(s.helloMessage);

      addLog(
        "✅ Pending session found: " +
          s.sessionId +
          " from " +
          s.helloMessage.from +
          " to " +
          s.helloMessage.to
      );
    } catch (err) {
      addLog("❌ Pending error: " + err.message);
    }
  };

  /* ---------------------------------------------------------
     3) Responder sends RESPONSE + derives key
  --------------------------------------------------------- */
  const sendResponse = async () => {
    try {
      if (!savedHello) {
        addLog("❌ No HELLO loaded.");
        return;
      }

      addLog("Verifying HELLO signature...");

      const peerIdentityKey = await importPeerIdentityKey(
        savedHello.identityPublicJwk
      );

      const helloCopy = { ...savedHello };
      delete helloCopy.signature;

      const sigOK = await verifySignature(
        peerIdentityKey,
        helloCopy,
        savedHello.signature
      );

      if (!sigOK) {
        addLog("❌ HELLO signature invalid. Abort.");
        return;
      }

      addLog("✅ HELLO signature verified.");

      const eph = await generateEphemeralECDHKeyPair();
      setMyECDHKeys(eph);

      const nonceB = crypto.randomUUID();
      const timestampB = Date.now();
      const myIdentity = await getIdentityPublicKeyJWK();
      const privateIdentity = await getIdentityPrivateKey();

      const responsePayload = {
  type: "RESPONSE",
  from: currentUser(),
  to: getPeerFromHello(savedHello),
  sessionId,
  ecdhPublic: eph.publicJwk,
  nonce: nonceB,
  timestamp: timestampB,
  seq: 1, // first msg from responder
  protocolVersion: "CLINK-1.0",
  originalNonce: savedHello.nonce,
  identityPublicJwk: myIdentity,
};


      const signature = await signPayload(privateIdentity, responsePayload);
      const responseMessage = { ...responsePayload, signature };

      addLog("Sending RESPONSE to server...");

      await axios.post("http://localhost:5000/api/key-exchange/respond", {
        sessionId,
        responseMessage,
      });

      setSavedResponse(responseMessage);

      addLog("🔐 Deriving shared secret (responder)...");
      
      const shared = await deriveSharedSecretRaw(
        eph.privateKey,
        savedHello.ecdhPublic
      );
      
      const sharedB64 = btoa(String.fromCharCode(...shared));
      addLog("🔑 Shared secret: " + sharedB64.substring(0, 20) + "...");

      const info_chat = `cryptlink-chat-${sessionId}`;
      
      const rawChatKey = await hkdf(shared, info_chat, 32);

      const aesKey = await crypto.subtle.importKey(
        "raw",
        rawChatKey,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
      );

      const peerUsername = getPeerFromHello(savedHello);
      addLog("✅ Session key ready (Responder)");
      addLog("👤 Me: " + currentUser() + " | Peer: " + peerUsername);

      if (onSessionKeyReady) {
        onSessionKeyReady(aesKey, peerUsername);
      }

      addLog("✅ RESPONSE sent successfully.");
    } catch (err) {
      addLog("❌ Response error: " + err.message);
      console.error("Full error:", err);
    }
  };

  /* ---------------------------------------------------------
     4) Initiator fetches RESPONSE + sends CONFIRM + derives key
  --------------------------------------------------------- */
  const sendConfirm = async () => {
    try {
      if (!sessionId) {
        addLog("❌ No sessionId.");
        return;
      }

      addLog("Fetching session to get RESPONSE...");
      const res = await axios.get(
        `http://localhost:5000/api/key-exchange/session/${sessionId}`
      );

      const sess = res.data.session;
      const response = sess.responseMessage;

      if (!response) {
        addLog("❌ No RESPONSE available.");
        return;
      }

      setSavedResponse(response);

      const peerIdentityKey = await importPeerIdentityKey(
        response.identityPublicJwk
      );

      const copy = { ...response };
      delete copy.signature;

      const sigOK = await verifySignature(
        peerIdentityKey,
        copy,
        response.signature
      );

      if (!sigOK) {
        addLog("❌ RESPONSE signature invalid.");
        return;
      }

      addLog("✅ RESPONSE signature verified.");

      addLog("🔐 Deriving shared secret (initiator)...");

      const shared = await deriveSharedSecretRaw(
        myECDHKeys.privateKey,
        response.ecdhPublic
      );
      
      const sharedB64 = btoa(String.fromCharCode(...shared));
      addLog("🔑 Shared secret: " + sharedB64.substring(0, 20) + "...");

      const info_chat = `cryptlink-chat-${sessionId}`;
      
      const rawChatKey = await hkdf(shared, info_chat, 32);

      const aesKey = await crypto.subtle.importKey(
        "raw",
        rawChatKey,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
      );

      // confirm hash
      const confirmInput =
        sharedB64 +
        "|" +
        savedHello.nonce +
        "|" +
        response.nonce +
        "|" +
        sessionId;

      const confirmBuf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(confirmInput)
      );

      const confirmHash = btoa(
        String.fromCharCode(...new Uint8Array(confirmBuf))
      );

      addLog("Sending CONFIRM...");

      const confirmNonce = crypto.randomUUID();

await axios.post("http://localhost:5000/api/key-exchange/confirm", {
  sessionId,
  confirmMessage: {
    type: "CONFIRM",
    sessionId,
    confirmHash,
    nonce: confirmNonce,
    timestamp: Date.now(),
    seq: 2, // second msg from initiator (after HELLO)
  },
});


      addLog("✅ CONFIRM sent. Key exchange complete!");

      const peerUsername = getPeerFromHello(savedHello);
      addLog("✅ Session key ready (Initiator)");
      addLog("👤 Me: " + currentUser() + " | Peer: " + peerUsername);

      if (onSessionKeyReady) {
        onSessionKeyReady(aesKey, peerUsername);
      }
    } catch (err) {
      addLog("❌ Confirm error: " + err.message);
      console.error("Full error:", err);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "700px",
        padding: "40px 35px",
        border: "1px solid #e0e0e0",
        borderRadius: "16px",
        background: "#ffffff",
        boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
      }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "35px" }}>
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔐</div>
          <h2 style={{ 
            margin: "0 0 8px 0",
            fontSize: "28px",
            fontWeight: "700",
            color: "#25D366"
          }}>
            CryptLink
          </h2>
          <p style={{
            margin: "0",
            fontSize: "15px",
            color: "#666",
            fontWeight: "500"
          }}>
            Secure Key Exchange Protocol
          </p>
        </div>

        {/* Key Exchange Steps */}
        <div style={{
          background: "#f9f9f9",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #e8e8e8",
          marginBottom: "24px"
        }}>
          <h3 style={{
            margin: "0 0 20px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: "#333",
            textAlign: "center"
          }}>
            Key Exchange Steps
          </h3>

          {/* Step 1 */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Step 1 — Initiator
            </div>
            <button 
              onClick={startHello}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#ffffff",
                color: "#333",
                fontSize: "15px",
                fontWeight: "500",
                border: "2px solid #25D366",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#25D366";
                e.target.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "#ffffff";
                e.target.style.color = "#333";
              }}
            >
              <span style={{ fontSize: "18px" }}>🚀</span>
              <span>Start HELLO - Generate Ephemeral Keys</span>
            </button>
          </div>

          {/* Step 2 */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Step 2 — Responder
            </div>
            <button 
              onClick={loadPendingSessions}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#ffffff",
                color: "#333",
                fontSize: "15px",
                fontWeight: "500",
                border: "2px solid #667eea",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#667eea";
                e.target.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "#ffffff";
                e.target.style.color = "#333";
              }}
            >
              <span style={{ fontSize: "18px" }}>📥</span>
              <span>Load Pending Sessions</span>
            </button>
          </div>

          {/* Step 3 */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Step 3 — Responder
            </div>
            <button 
              onClick={sendResponse}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#ffffff",
                color: "#333",
                fontSize: "15px",
                fontWeight: "500",
                border: "2px solid #667eea",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#667eea";
                e.target.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "#ffffff";
                e.target.style.color = "#333";
              }}
            >
              <span style={{ fontSize: "18px" }}>📤</span>
              <span>Send RESPONSE - Compute Shared Secret</span>
            </button>
          </div>

          {/* Step 4 */}
          <div>
            <div style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Step 4 — Initiator
            </div>
            <button 
              onClick={sendConfirm}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#ffffff",
                color: "#333",
                fontSize: "15px",
                fontWeight: "500",
                border: "2px solid #25D366",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#25D366";
                e.target.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "#ffffff";
                e.target.style.color = "#333";
              }}
            >
              <span style={{ fontSize: "18px" }}>✅</span>
              <span>Send CONFIRM - Complete Handshake</span>
            </button>
          </div>
        </div>

        {/* Activity Log */}
        <div style={{
          background: "#f9f9f9",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e8e8e8"
        }}>
          <h3 style={{
            margin: "0 0 16px 0",
            fontSize: "16px",
            fontWeight: "600",
            color: "#333",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>📋</span>
            <span>Activity Log</span>
          </h3>
          
          <div style={{
            maxHeight: "280px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "14px"
          }}>
            {logs.length === 0 ? (
              <div style={{
                textAlign: "center",
                color: "#999",
                fontSize: "14px",
                padding: "20px"
              }}>
                No activity yet. Start by clicking a button above.
              </div>
            ) : (
              logs.map((log, i) => (
                <div 
                  key={i}
                  style={{
                    padding: "8px 0",
                    borderBottom: i < logs.length - 1 ? "1px solid #f0f0f0" : "none",
                    fontSize: "13px",
                    color: "#333",
                    lineHeight: "1.5"
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div style={{
          marginTop: "24px",
          padding: "16px",
          background: "#e8f5e9",
          borderRadius: "8px",
          fontSize: "13px",
          color: "#2e7d32",
          lineHeight: "1.6",
          border: "1px solid #c8e6c9"
        }}>
          <strong>ℹ️ Protocol Info:</strong> This demonstrates a secure Diffie-Hellman key exchange. 
          The initiator starts the handshake, the responder completes it, and both parties derive a shared secret.
        </div>
      </div>
    </div>
  );
}

export default CryptoPanel;