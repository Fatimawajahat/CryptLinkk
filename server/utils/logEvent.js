// backend/utils/logEvent.js
const SecurityLog = require("../models/SecurityLog");

async function logEvent(eventType, username, details = {}) {
  try {
    await SecurityLog.create({
      eventType,
      username,
      details,
    });
  } catch (err) {
    console.error("⚠️ Logging error:", err.message);
  }
}

module.exports = logEvent;
