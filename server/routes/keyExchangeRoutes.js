const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const crypto = require("crypto");
const logEvent = require("../utils/logEvent");
const { verifySignature } = require("../utils/signatureUtils");


//added for demo of mitm
//const SKIP_SIGNATURE_CHECK = false;

// Generate random session ID
function generateSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

// simple 5 min freshness window for all handshake msgs
const TIME_WINDOW_MS = 5 * 60 * 1000;

function isFresh(timestamp) {
  if (!timestamp) return false;
  const now = Date.now();
  return Math.abs(now - timestamp) <= TIME_WINDOW_MS;
}

/*
------------------------------------------------------ 
    POST /start
    A sends HELLO message → server creates session
    (nonce + timestamp + seq check)
------------------------------------------------------
*/
router.post("/start", async (req, res) => {
  try {
    const { from, to, helloMessage } = req.body;

    if (!helloMessage || helloMessage.type !== "HELLO") {
  logEvent("HELO_INVALID", from, {
    reason: "invalid hello message",
    ip: req.ip,
  });
  return res.status(400).json({ error: "invalid hello message" });
}

if (!isFresh(helloMessage.timestamp)) {
  logEvent("HELO_STALE", from, {
    timestamp: helloMessage.timestamp,
    ip: req.ip,
  });
  return res.status(400).json({ error: "stale HELLO (possible replay)" });
}

if (!helloMessage.nonce) {
  logEvent("HELO_MISSING_NONCE", from, { ip: req.ip });
  return res.status(400).json({ error: "HELLO must contain nonce" });
}
// --------------------------------------------------
// SIGNATURE VERIFICATION (HELLO) - toggle ON/OFF
// --------------------------------------------------
/*
if (!SKIP_SIGNATURE_CHECK) {
  const unsignedHello = { ...helloMessage };
  delete unsignedHello.signature;

  const ok = verifySignature(
    helloMessage.identityPublicJwk,
    unsignedHello,
    helloMessage.signature
  );

  if (!ok) {
    logEvent("INVALID_SIGNATURE_HELLO", from, { ip: req.ip });
    return res.status(400).json({ error: "Invalid HELLO signature" });
  }
}
  */

    const existing = await Session.findOne({
      initiator: from,
      responder: to,
      "helloMessage.nonce": helloMessage.nonce,
    });

    if (existing) {
  logEvent("HELO_REPLAY_NONCE", from, {
    nonce: helloMessage.nonce,
    ip: req.ip,
  });
  return res.status(400).json({ error: "HELLO nonce already used for this pair" });
}

    const sessionId = generateSessionId();

    await Session.create({
      sessionId,
      initiator: from,
      responder: to,
      helloMessage,
      status: "hello_sent",
      usedNonces: [helloMessage.nonce],
      lastSeqInitiator:
        typeof helloMessage.seq === "number" ? helloMessage.seq : 1,
    });

    logEvent("HELO_ACCEPTED", from, {
  to,
  sessionId,
  nonce: helloMessage.nonce,
  seq: helloMessage.seq,
  ip: req.ip,
});

    return res.json({ ok: true, sessionId });
  } catch (err) {
    console.error("start error:", err);
    return res.status(500).json({ error: "session not created" });
  }


});

/*
------------------------------------------------------
    GET /pending?user=Bob
    Bob checks if someone sent a HELLO
------------------------------------------------------
*/
router.get("/pending", async (req, res) => {
  try {
    const user = req.query.user;

    const sessions = await Session.find({
      responder: user,
      status: "hello_sent",
    });

    return res.json({ ok: true, sessions });
  } catch (err) {
    console.error("pending error:", err);
    return res.status(500).json({ error: "error loading sessions" });
  }
});

/*
------------------------------------------------------
    POST /respond
    Bob sends RESPONSE message
    (checks originalNonce, nonce reused, timestamp, seq)
------------------------------------------------------
*/
router.post("/respond", async (req, res) => {
  try {
    const { sessionId, responseMessage } = req.body;

    const session = await Session.findOne({ sessionId });
    if (!session) {
  logEvent("RESP_SESSION_NOT_FOUND", null, { sessionId, ip: req.ip });
  return res.status(404).json({ error: "session not found" });
}

if (!responseMessage || responseMessage.type !== "RESPONSE") {
  logEvent("RESP_INVALID", session?.initiator, {
    reason: "invalid type",
    ip: req.ip,
  });
  return res.status(400).json({ error: "invalid RESPONSE message" });
}

if (!isFresh(responseMessage.timestamp)) {
  logEvent("RESP_STALE", session.responder, {
    timestamp: responseMessage.timestamp,
    ip: req.ip,
  });
  return res.status(400).json({ error: "stale RESPONSE (possible replay)" });
}

if (responseMessage.originalNonce !== session.helloMessage.nonce) {
  logEvent("RESP_ORIGINAL_NONCE_MISMATCH", session.responder, {
    sent: responseMessage.originalNonce,
    expected: session.helloMessage.nonce,
    ip: req.ip,
  });
  return res.status(400).json({ error: "RESPONSE originalNonce mismatch" });
}

// --------------------------------------------------
// SIGNATURE VERIFICATION (RESPONSE) - toggle ON/OFF
// --------------------------------------------------
/*
if (!SKIP_SIGNATURE_CHECK) {
  const unsignedResponse = { ...responseMessage };
  delete unsignedResponse.signature;

  const ok = verifySignature(
    responseMessage.identityPublicJwk,
    unsignedResponse,
    responseMessage.signature
  );

  if (!ok) {
    logEvent("INVALID_SIGNATURE_RESPONSE", session.responder, { ip: req.ip });
    return res.status(400).json({ error: "Invalid RESPONSE signature" });
  }
}
*/

if (session.usedNonces.includes(responseMessage.nonce)) {
  logEvent("RESP_REPLAY_NONCE", session.responder, {
    nonce: responseMessage.nonce,
    ip: req.ip,
  });
  return res.status(400).json({ error: "RESPONSE nonce already used (replay detected)" });
}



    // simple sequence check for responder flow
    const incomingSeq =
      typeof responseMessage.seq === "number" ? responseMessage.seq : 0;
    if (incomingSeq <= session.lastSeqResponder) {
  logEvent("RESP_SEQ_REPLAY", session.responder, {
    incomingSeq,
    lastSeq: session.lastSeqResponder,
    ip: req.ip,
  });
  return res.status(400).json({ error: "RESPONSE sequence not increasing" });
}

    session.usedNonces.push(responseMessage.nonce);
    session.lastSeqResponder = incomingSeq;

    session.responseMessage = responseMessage;
    session.status = "response_sent";

    await session.save();

    logEvent("RESP_ACCEPTED", session.responder, {
  sessionId,
  nonce: responseMessage.nonce,
  seq: responseMessage.seq,
  ip: req.ip,
});


    return res.json({ ok: true });
  } catch (err) {
    console.error("respond error:", err);
    return res.status(500).json({ error: "response failed" });
  }
});

/*
------------------------------------------------------
    GET /session/:sessionId
    Fetch hello + response + confirm messages
------------------------------------------------------
*/
router.get("/session/:sessionId", async (req, res) => {
  try {
    const id = req.params.sessionId;

    const session = await Session.findOne({ sessionId: id });
    if (!session) return res.status(404).json({ error: "session not found" });

    return res.json({ ok: true, session });
  } catch (err) {
    console.error("load session error:", err);
    return res.status(500).json({ error: "failed to load session" });
  }
});

/*
------------------------------------------------------
    POST /confirm
    Alice sends final CONFIRM message
    (nonce + timestamp + seq check for initiator)
------------------------------------------------------
*/
router.post("/confirm", async (req, res) => {
  try {
    const { sessionId, confirmMessage } = req.body;

    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: "session not found" });

    if (!confirmMessage || confirmMessage.type !== "CONFIRM") {
      return res.status(400).json({ error: "invalid CONFIRM message" });
    }

    // freshness
    if (!isFresh(confirmMessage.timestamp)) {
  logEvent("CONFIRM_STALE", session.initiator, {
    timestamp: confirmMessage.timestamp,
    ip: req.ip,
  });
  return res.status(400).json({ error: "stale CONFIRM (possible replay)" });
}

    if (!confirmMessage.nonce) {
      return res.status(400).json({ error: "CONFIRM must contain nonce" });
    }

    // --------------------------------------------------
// SIGNATURE VERIFICATION (CONFIRM) - toggle ON/OFF
// --------------------------------------------------
/*
if (!SKIP_SIGNATURE_CHECK) {
  const unsignedConfirm = { ...confirmMessage };
  delete unsignedConfirm.signature;

  const ok = verifySignature(
    confirmMessage.identityPublicJwk,
    unsignedConfirm,
    confirmMessage.signature
  );

  if (!ok) {
    logEvent("INVALID_SIGNATURE_CONFIRM", session.initiator, { ip: req.ip });
    return res.status(400).json({ error: "Invalid CONFIRM signature" });
  }
}
*/

    if (session.usedNonces.includes(confirmMessage.nonce)) {
  logEvent("CONFIRM_REPLAY_NONCE", session.initiator, {
    nonce: confirmMessage.nonce,
    ip: req.ip,
  });
  return res.status(400).json({ error: "CONFIRM nonce already used (replay detected)" });
}

    // sequence from initiator should move forward compared to HELLO
    const incomingSeq =
      typeof confirmMessage.seq === "number" ? confirmMessage.seq : 0;
    if (incomingSeq <= session.lastSeqInitiator) {
      return res
        .status(400)
        .json({ error: "CONFIRM sequence not increasing" });
    }

    session.usedNonces.push(confirmMessage.nonce);
    session.lastSeqInitiator = incomingSeq;

    session.confirmMessage = confirmMessage;
    session.status = "confirmed";

    await session.save();

    logEvent("CONFIRM_ACCEPTED", session.initiator, {
  sessionId,
  nonce: confirmMessage.nonce,
  seq: confirmMessage.seq,
  ip: req.ip,
});

    return res.json({ ok: true });
  } catch (err) {
    console.error("confirm error:", err);
    return res.status(500).json({ error: "confirm failed" });
  }
});

module.exports = router;
