const express = require("express");
const router = express.Router();

const File = require("../models/File");
const FileChunk = require("../models/FileChunk");

// -----------------------------
// Upload a single encrypted chunk
// -----------------------------
router.post("/upload-chunk", async (req, res) => {
  try {
    const {
      fileId,
      chunkNumber,
      totalChunks,
      ciphertext,
      iv,
      sender,
      receiver,
      originalName,
    } = req.body;

    if (!fileId || !ciphertext || !iv) {
      return res.status(400).json({ error: "missing fields" });
    }

    // store chunk
    await FileChunk.create({
      fileId,
      chunkNumber,
      ciphertext,
      iv,
      sender,
      receiver,
    });

    // only create main File entry for chunk 1
    if (chunkNumber == 1) {
      await File.create({
        fileId,
        sender: sender,
        receiver: receiver,
        originalName,
        totalChunks,
      });
    }

    return res.json({ success: true, chunk: chunkNumber });
  } catch (err) {
    console.error("UPLOAD CHUNK ERROR", err);
    res.status(500).json({ error: "upload failed" });
  }
});


// -----------------------------
// Get all encrypted chunks for a file
// -----------------------------
router.get("/get-file", async (req, res) => {
  try {
    const { fileId } = req.query;

    const file = await File.findOne({ fileId });
    if (!file) return res.status(404).json({ error: "file not found" });

    // fetch chunks in correct order
    const chunks = await FileChunk.find({ fileId }).sort("chunkNumber");

    return res.json({
      fileId: file.fileId,
      sender: file.sender,
      receiver: file.receiver,
      originalName: file.originalName,
      totalChunks: file.totalChunks,
      chunks,
    });
  } catch (err) {
    console.error("get-file error", err);
    return res.status(500).json({ error: "fetch failed" });
  }
});

module.exports = router;
