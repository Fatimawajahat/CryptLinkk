// server/routes/authRoutes.js

// ye file auth ka sara scene handle krti hae bro
// register login aur public key ka store fetch waghera

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 🔥 ADD THIS
const logEvent = require("../utils/logEvent");

const router = express.Router();

/* ---------------------------------------------------------
   REGISTER
--------------------------------------------------------- */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      // 🔥 Log failed attempt
      logEvent("AUTH_REGISTER_FAILED", username, {
        reason: "Missing username/password",
        ip: req.ip,
      });

      return res.status(400).json({ message: "Username and password required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      // 🔥 Log username conflict
      logEvent("AUTH_REGISTER_FAILED", username, {
        reason: "Username already taken",
        ip: req.ip,
      });

      return res.status(409).json({ message: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      passwordHash,
      publicKey: null,
    });

    await user.save();

    // 🔥 Log success
    logEvent("AUTH_REGISTER_SUCCESS", username, { ip: req.ip });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err);

    // 🔥 Log server error
    logEvent("AUTH_REGISTER_ERROR", null, {
      error: err.message,
      ip: req.ip,
    });

    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------------------------------------
   LOGIN
--------------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      // 🔥 Log failed login
      logEvent("AUTH_LOGIN_FAILED", username, {
        reason: "User not found",
        ip: req.ip,
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // 🔥 Log failed password attempt
      logEvent("AUTH_LOGIN_FAILED", username, {
        reason: "Incorrect password",
        ip: req.ip,
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 🔥 Log successful login
    logEvent("AUTH_LOGIN_SUCCESS", username, {
      hasPublicKey: !!user.publicKey,
      ip: req.ip,
    });

    res.json({
      token,
      username: user.username,
      hasPublicKey: !!user.publicKey,
    });
  } catch (err) {
    console.error("Login error:", err);

    // 🔥 Log error
    logEvent("AUTH_LOGIN_ERROR", null, {
      error: err.message,
      ip: req.ip,
    });

    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------------------------------------
   SAVE PUBLIC KEY
--------------------------------------------------------- */
router.post("/save-public-key", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split(" ")[1];

    if (!token) {
      logEvent("AUTH_PUBLICKEY_FAILED", null, {
        reason: "No token provided",
        ip: req.ip,
      });

      return res.status(401).json({ message: "No token provided" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      logEvent("AUTH_PUBLICKEY_FAILED", null, {
        reason: "Invalid token",
        ip: req.ip,
      });

      return res.status(401).json({ message: "Invalid token" });
    }

    const { publicKey } = req.body;

    if (!publicKey) {
      logEvent("AUTH_PUBLICKEY_FAILED", payload.username, {
        reason: "Missing public key",
        ip: req.ip,
      });

      return res.status(400).json({ message: "Public key is required" });
    }

    await User.findByIdAndUpdate(payload.userId, { publicKey });

    // 🔥 Log key save
    logEvent("AUTH_PUBLICKEY_SAVED", payload.username, {
      ip: req.ip,
    });

    res.json({ message: "Public key saved successfully" });
  } catch (err) {
    console.error("Save public key error:", err);

    logEvent("AUTH_PUBLICKEY_ERROR", null, {
      error: err.message,
      ip: req.ip,
    });

    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------------------------------------
   FETCH PUBLIC KEY
--------------------------------------------------------- */
router.get("/public-key/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user || !user.publicKey) {
      logEvent("AUTH_PUBLICKEY_FETCH_FAILED", username, {
        reason: "Public key not found",
        ip: req.ip,
      });

      return res
        .status(404)
        .json({ message: "Public key not found for this user" });
    }

    // 🔥 Log key fetch access
    logEvent("AUTH_PUBLICKEY_FETCHED", username, { ip: req.ip });

    res.json({
      username: user.username,
      publicKey: user.publicKey,
    });
  } catch (err) {
    console.error("Fetch public key error:", err);

    logEvent("AUTH_PUBLICKEY_FETCH_ERROR", null, {
      error: err.message,
      ip: req.ip,
    });

    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
