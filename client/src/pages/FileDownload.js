// client/src/pages/FileDownload.js
// ye page encrypted file ko download aur decrypt krne ka scene handle krta hae

import { useState } from "react";
import axios from "axios";
import { decryptChunk, mergeChunksToBlob } from "../crypto/fileEncryption";

function FileDownload({ sessionKey }) {
  const [fileId, setFileId] = useState("");
  const [status, setStatus] = useState("");

  const box = {
    width: "360px",
    margin: "20px auto",
    padding: "15px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    background: "#f5f5f5",
  };

  const inputBox = {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    marginTop: "5px",
  };

  const btn = {
    marginTop: "10px",
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    background: "black",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  };

  const handleDownload = async () => {
    if (!fileId.trim()) {
      setStatus("file id daal pehle");
      return;
    }
    if (!sessionKey) {
      setStatus("session key missing yaar");
      return;
    }

    try {
      setStatus("fetching encrypted chunks...");

      const res = await axios.get("http://localhost:5000/api/files/get-file", {
        params: { fileId },
      });

      const { chunks, originalName } = res.data;

      if (!chunks || !chunks.length) {
        setStatus("no chunks found for this file id");
        return;
      }

      setStatus(`decrypting ${chunks.length} chunks... sabr kro zra`);

      const decryptedParts = [];

      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];

        const plainBuf = await decryptChunk(
          ch.ciphertext,
          ch.iv,
          sessionKey
        );

        decryptedParts.push(plainBuf);
        setStatus(`decrypted chunk ${i + 1} / ${chunks.length}`);
      }

      setStatus("merging chunks...");

      const blob = mergeChunksToBlob(decryptedParts);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName || "cryptlink_file.bin";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus("download complete 🎉 file decrypted locally");
    } catch (err) {
      console.error(err);
      setStatus("error while downloading or decrypting");
    }
  };

  return (
    <div>
      <h3 style={{ 
        textAlign: "center", 
        marginBottom: "15px",
        fontSize: "16px",
        fontWeight: "600",
        color: "#333"
      }}>
        Download Encrypted File
      </h3>

      <label style={{ 
        fontSize: "13px",
        color: "#555",
        fontWeight: "500",
        display: "block",
        marginBottom: "6px"
      }}>
        File ID
      </label>
      
      <input
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          outline: "none",
          fontSize: "14px",
          marginBottom: "12px",
          boxSizing: "border-box"
        }}
        type="text"
        placeholder="Paste file ID here"
        value={fileId}
        onChange={(e) => setFileId(e.target.value)}
      />

      <button 
        style={{
          width: "100%",
          padding: "10px",
          background: "#25D366",
          color: "white",
          borderRadius: "8px",
          fontWeight: "600",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          transition: "background 0.2s"
        }}
        onClick={handleDownload}
      >
        📥 Download & Decrypt
      </button>

      <p style={{ 
        marginTop: "10px", 
        fontSize: "13px",
        color: status.includes('Please') ? "#e74c3c" : "#888",
        textAlign: "center",
        minHeight: "18px"
      }}>
        {status}
      </p>
    </div>
  );
}

export default FileDownload;
