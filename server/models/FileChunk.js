const mongoose = require("mongoose");

const FileChunkSchema = new mongoose.Schema({
  fileId: { type: String, required: true },
  chunkNumber: { type: Number, required: true },

  ciphertext: { type: String, required: true }, // base64
  iv: { type: String, required: true },         // base64

  sender: { type: String, required: true },
  receiver: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
});

FileChunkSchema.index({ fileId: 1, chunkNumber: 1 }, { unique: true });

module.exports = mongoose.model("FileChunk", FileChunkSchema);
