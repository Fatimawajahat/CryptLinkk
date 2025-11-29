// backend/models/SecurityLog.js
const mongoose = require("mongoose");

const SecurityLogSchema = new mongoose.Schema({
  eventType: { type: String, required: true },   // e.g., AUTH_ATTEMPT, REPLAY_BLOCKED
  username: { type: String },                    // user performing the action
  details: { type: Object },                     // dynamic JSON (IP, reason, metadata)
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SecurityLog", SecurityLogSchema);
