// client/src/pages/FileUpload.js
// ye page file upload + encryption handle krta hae

import { useState } from "react";
import axios from "axios";
import {
  readFileAsArrayBuffer,
  splitFileIntoChunks,
  encryptChunk,
} from "../crypto/fileEncryption";

function FileUpload({ sessionKey, peer }) {
  const [status, setStatus] = useState("");
  const me = localStorage.getItem("cryptlink_username");

  const box = {
    width: "360px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    background: "#fafafa",
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

  const uploadEncryptedFile = async (file) => {
    try {
      setStatus("reading file...");
      const arrayBuffer = await readFileAsArrayBuffer(file);

      const chunks = splitFileIntoChunks(arrayBuffer, 80 * 1024); // 80 KB
      const totalChunks = chunks.length;

      const fileId = crypto.randomUUID();

      setStatus(`found ${totalChunks} chunks, encrypting...`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];

        const encrypted = await encryptChunk(chunk, sessionKey);

        await axios.post("http://localhost:5000/api/files/upload-chunk", {
          fileId,
          chunkNumber: i + 1,
          totalChunks,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          sender: me,
          receiver: peer,
          originalName: file.name,
        });

        setStatus(`uploaded chunk ${i + 1} / ${totalChunks}`);
      }

      setStatus(`upload complete 🎉 File ID: ${fileId} (share this with receiver)`);
    } catch (err) {
      console.error(err);
      setStatus("error uploading file");
    }
  };

  const onFilePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadEncryptedFile(file);
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
        Send Encrypted File
      </h3>

      <label style={{
        display: "block",
        width: "100%",
        padding: "12px",
        background: "#ffffff",
        border: "2px dashed #25D366",
        borderRadius: "8px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        fontSize: "14px",
        color: "#666"
      }}>
        <input
          type="file"
          onChange={onFilePick}
          style={{ display: "none" }}
        />
        📎 Choose File
      </label>

      <p style={{ 
        marginTop: "12px", 
        fontSize: "13px",
        color: status.includes('Selected') ? "#25D366" : "#888",
        textAlign: "center",
        minHeight: "18px"
      }}>
        {status}
      </p>
    </div>
  );
}

export default FileUpload;
