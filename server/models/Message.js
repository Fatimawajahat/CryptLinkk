// ye model sirf encrypted msg store krta
// koi plaintext backend tak nahi ana chahiye warna marks ud jain gy

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true }, // kis key exchange session se link hae
  sender: { type: String, required: true },
  receiver: { type: String, required: true },

  ciphertext: { type: String, required: true }, // encrypted data
  iv: { type: String, required: true }, // aes gcm iv

  // yeh timestamp basically client side ka msg time hae
  // isko replay detect k liye 60s window se check karen gy
  timestamp: { type: Number, required: true },

  // step 8 replay protection extras
  // har msg ka unique random nonce
  nonce: { type: String, required: true },

  // har sender→receiver flow k liye increasing sequence number
  seq: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now },
});

// extra safety: same sender + receiver + seq combination dobara allow nahi
messageSchema.index({ sender: 1, receiver: 1, seq: 1 }, { unique: true });

module.exports = mongoose.model("Message", messageSchema);
