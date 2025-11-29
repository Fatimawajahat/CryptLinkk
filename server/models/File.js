const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  sender: { type: String, required: true },
  receiver: { type: String, required: true },

  originalName: { type: String, required: true }, // example: image.png

  totalChunks: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("File", FileSchema);
