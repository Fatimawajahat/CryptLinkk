const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },

  initiator: { type: String, required: true },
  responder: { type: String, required: true },

  helloMessage: { type: Object, default: null },
  responseMessage: { type: Object, default: null },
  confirmMessage: { type: Object, default: null },

  status: {
    type: String,
    enum: ["hello_sent", "response_sent", "confirmed"],
    default: "hello_sent",
  },

  // new stuff for replay protection
  usedNonces: { type: [String], default: [] },        // all nonces seen in this session
  lastSeqInitiator: { type: Number, default: 0 },     // last seq from initiator (HELLO / CONFIRM)
  lastSeqResponder: { type: Number, default: 0 },     // last seq from responder (RESPONSE)

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Session", SessionSchema);
