// server/routes/messageRoutes.js
// is file mei hum encrypted msgs save aur fetch kr rhy hen
// backend plaintext touch nahi krna warna pura e2ee flop ho jaye ga
// ps i want to die thanks MAAAR DO MUJHAAIIIII AAAAAAAA

const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// 60s window for msg timestamp freshness
const ALLOWED_MESSAGE_WINDOW_MS = 60 * 1000;

// send encrypted message
router.post("/send", async (req, res) => {
  try {
    const {
      sessionId,
      sender,
      receiver,
      ciphertext,
      iv,
      timestamp,
      nonce,
      seq,
    } = req.body;

    // basic sanity check warna half baked data ajata hae
    if (!sessionId || !sender || !receiver || !ciphertext || !iv) {
      return res.status(400).json({ error: "missing msg fields" });
    }

    if (!nonce || typeof nonce !== "string") {
      return res.status(400).json({ error: "nonce missing ya ghalat hae" });
    }

    if (typeof seq !== "number") {
      return res.status(400).json({ error: "seq number missing ya ghalat hae" });
    }

    // timestamp freshness check (client side time vs server time)
    const now = Date.now();
    if (
      typeof timestamp !== "number" ||
      Math.abs(now - timestamp) > ALLOWED_MESSAGE_WINDOW_MS
    ) {
      console.warn("⏱ stale / future message blocked", {
        sender,
        receiver,
        timestamp,
        now,
      });
      return res.status(400).json({ error: "stale msg detected (replay chance)" });
    }

    // replay detect 1: same sender+receiver+seq already exist
    const existingSeq = await Message.findOne({ sender, receiver, seq });
    if (existingSeq) {
      console.warn("🚫 replay blocked by seq", {
        sender,
        receiver,
        seq,
      });
      return res
        .status(409)
        .json({ error: "replay detected: seq already used for this pair" });
    }

    // replay detect 2: same nonce seen before with same sender+receiver
    const existingNonce = await Message.findOne({ sender, receiver, nonce });
    if (existingNonce) {
      console.warn("🚫 replay blocked by nonce", {
        sender,
        receiver,
        nonce,
      });
      return res
        .status(409)
        .json({ error: "replay detected: nonce already used for this pair" });
    }

    // thora logging chorr dein for marks
    console.log("📩 encrypted msg recv", {
      sender,
      receiver,
      time: new Date(timestamp).toISOString(),
      seq,
      nonce,
    });

    

    const msg = new Message({
      sessionId,
      sender,
      receiver,
      ciphertext,
      iv,
      timestamp,
      nonce,
      seq,
    });

    await msg.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ message save error", err);
    // duplicate key case bhi yahan ajaye ga agar index trigger ho
    if (err.code === 11000) {
      return res.status(409).json({ error: "duplicate msg (replay / seq clash)" });
    }
    res.status(500).json({ error: "msg store fail hogya" });
  }
});

router.get("/last-seq", async (req, res) => {
  try {
    const { sender, receiver } = req.query;

    if (!sender || !receiver) {
      return res.status(400).json({ error: "sender and receiver required" });
    }

    // Find the highest seq number for this pair
    const lastMsg = await Message.findOne({ sender, receiver })
      .sort({ seq: -1 })
      .limit(1);

    const lastSeq = lastMsg ? lastMsg.seq : 0;

    return res.json({ lastSeq });
  } catch (err) {
    console.error("❌ last-seq fetch error", err);
    res.status(500).json({ error: "failed to get last seq" });
  }
});

// fetch encrypted messages between two users
router.get("/fetch", async (req, res) => {
  try {
    const { userA, userB } = req.query;

    console.log("🗂 fetching encrypted msgs between", userA, userB);

    const msgs = await Message.find({
      $or: [
        { sender: userA, receiver: userB },
        { sender: userB, receiver: userA },
      ],
    }).sort({ timestamp: 1 });

    return res.json({ messages: msgs });
  } catch (err) {
    console.error("❌ message fetch error", err);
    res.status(500).json({ error: "msg fetch fail hogya" });
  }
});

module.exports = router;
