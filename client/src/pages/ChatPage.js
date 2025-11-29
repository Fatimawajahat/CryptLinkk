// client/src/pages/ChatPage.js
// ye page actual encrypted chat handle krta hae
// msg send sy pehle encrypt hon gy aur receive krne per decrypt hon gy
// sessionKey step 5 sy aaraha hota hae

import FileUpload from "./FileUpload";
import FileDownload from "./FileDownload";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  encryptMessageWithAES,
  decryptMessageWithAES,
} from "../crypto/messageEncryption";

function ChatPage({ sessionKey, peer }) {
  // peer = jis user k saath chat chal rhi hae
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");


  const me = localStorage.getItem("cryptlink_username");

  const box = {
    width: "360px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    background: "#fafafa",
  };

  const msgBox = {
    height: "270px",
    overflowY: "auto",
    background: "#fff",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "10px",
    fontSize: "14px",
    border: "1px solid #ccc",
  };

  const inputBox = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    marginBottom: "10px",
  };

  const btn = {
    width: "100%",
    padding: "10px",
    background: "black",
    color: "white",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  };

  /* ---------------------------------------------------
     FETCH MESSAGES + DECRYPT LOCALLY
  ----------------------------------------------------- */
  const loadMessages = async () => {
  if (!sessionKey) return;

  console.log("🔍 Loading messages between:", me, "and", peer); 

  const res = await axios.get("http://localhost:5000/api/messages/fetch", {
    params: { userA: me, userB: peer },
  });

  const msgs = res.data.messages;
  console.log("📩 Fetched messages:", msgs); 

  const out = [];
  for (let m of msgs) {
    const plain = await decryptMessageWithAES(
      m.ciphertext,
      m.iv,
      sessionKey
    );

    console.log("✉️ Decrypted:", m.sender, "→", m.receiver, ":", plain); 

    out.push({
      sender: m.sender,
      plaintext: plain,
      timestamp: m.timestamp,
    });
  }

  setMessages(out);
};

  /* ---------------------------------------------------
     SEND ENCRYPTED MESSAGE
  ----------------------------------------------------- */
  const sendMessage = async () => {
  if (!input.trim()) return;

  try {
    const enc = await encryptMessageWithAES(input, sessionKey);

    // 🔥 Fetch the last sequence from the server (not localStorage)
    const seqRes = await axios.get("http://localhost:5000/api/messages/last-seq", {
      params: { sender: me, receiver: peer }
    });
    
    const lastSeq = seqRes.data.lastSeq;
    const seq = lastSeq + 1;

    // Create replay-protection fields
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();

    await axios.post("http://localhost:5000/api/messages/send", {
      sessionId: "chat-session",
      sender: me,
      receiver: peer,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      timestamp: timestamp,
      nonce: nonce,
      seq: seq
    });

    setInput("");
    loadMessages();
  } catch (err) {
    console.error("❌ Send message error:", err);
    alert("Failed to send message: " + (err.response?.data?.error || err.message));
  }
};

  const msgEndRef = useRef(null);

    // auto refresh messages every 2 seconds
  useEffect(() => {
    if (!sessionKey || !peer) return;

    loadMessages(); // load once instantly

    const interval = setInterval(() => {
      loadMessages();
    }, 2000); // 2 sec polling plzzz chaljaaaaa meri maaaaaa

    return () => clearInterval(interval);
  }, [sessionKey, peer]);

  // auto scroll to bottom when messages update
useEffect(() => {
  if (msgEndRef.current) {
    msgEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [messages]);

const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "30px auto",
        padding: "35px 40px",
        background: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #e0e0e0",
        boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        minHeight: "600px"
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "40px",
          fontWeight: "700",
          fontSize: "32px",
          color: "#25D366",
          letterSpacing: "-0.5px"
        }}
      >
        🔐 CryptLink
      </h1>

      {/* MAIN WRAPPER FOR 2-COLUMN LAYOUT */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "32px",
        }}
      >
        {/* LEFT COLUMN — FILE SECTIONS */}
        <div
          style={{
            width: "35%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* FILE UPLOAD */}
          <div
            style={{
              background: "#f9f9f9",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #e8e8e8",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
            }}
          >
            <FileUpload sessionKey={sessionKey} peer={peer} />
          </div>

          {/* FILE DOWNLOAD */}
          <div
            style={{
              background: "#f9f9f9",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #e8e8e8",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
            }}
          >
            <FileDownload sessionKey={sessionKey} />
          </div>
        </div>

        {/* RIGHT COLUMN — CHAT UI */}
        <div
          style={{
            width: "65%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "600",
              fontSize: "20px",
              color: "#333",
            }}
          >
            💬 Chat with {peer}
          </h2>

          {/* CHAT MESSAGES */}
          <div
            style={{
              height: "450px",
              overflowY: "auto",
              background: "#f0f2f5",
              border: "1px solid #d9d9d9",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  maxWidth: "70%",
                  alignSelf: m.sender === me ? "flex-end" : "flex-start",
                  background: m.sender === me ? "#dcf8c6" : "#ffffff",
                  padding: "10px 14px",
                  borderRadius:
                    m.sender === me
                      ? "16px 16px 4px 16px"
                      : "16px 16px 16px 4px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  fontSize: "14px",
                  lineHeight: "1.4",
                  wordBreak: "break-word"
                }}
              >
                <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px", fontWeight: "600" }}>
                  {m.sender}
                </div>
                <div style={{ color: "#303030" }}>
                  {m.plaintext}
                </div>
              </div>
            ))}

            <div ref={msgEndRef}></div>
          </div>

          {/* MESSAGE INPUT */}
          <input
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "24px",
              border: "1px solid #d9d9d9",
              marginBottom: "12px",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              transition: "border 0.2s"
            }}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />

          {/* SEND BUTTON */}
          <button
            style={{
              width: "100%",
              padding: "12px",
              background: "#25D366",
              color: "white",
              borderRadius: "24px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              transition: "background 0.2s",
              boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)"
            }}
            onClick={sendMessage}
          >
            ✉️ Send
          </button>
        </div>
      </div>
    </div>
  );

}

export default ChatPage;
