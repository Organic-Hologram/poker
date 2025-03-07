const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");
const { gameLogger, logger } = require("../utils/logger");
// Admin secret key for managing API keys (should be in environment variables)
const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin";

// Middleware to check admin authentication
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  // Log usando tanto o logger quanto o gameLogger para debug
  logger.debug("Admin authentication attempt", {
    hasAdminKey: !!adminKey,
    headers: req.headers,
  });

  gameLogger.debug("Admin authentication attempt", {
    hasAdminKey: !!adminKey,
    headers: req.headers,
  });

  console.log("Admin authentication attempt", {
    hasAdminKey: !!adminKey,
    adminKey,
    expectedSecret: ADMIN_SECRET,
  });

  if (!adminKey) {
    logger.warn("Admin authentication failed: No admin key provided");
    return res.status(401).json({ error: "Admin key is required" });
  }

  if (adminKey !== ADMIN_SECRET) {
    logger.warn("Admin authentication failed: Invalid admin key");
    return res.status(401).json({ error: "Invalid admin key" });
  }

  logger.info("Admin authentication successful");
  next();
};

// Generate new API key for a bot
router.post("/generate-key", authenticateAdmin, (req, res) => {
  const { botName } = req.body;

  if (!botName) {
    return res.status(400).json({ error: "Bot name is required" });
  }

  // Generate a random API key
  const apiKey = crypto.randomBytes(32).toString("hex");

  // Store the API key
  ApiKey.addKey(apiKey, botName);

  logger.info(`Generated new API key for bot: ${botName}`);

  res.json({
    success: true,
    botName,
    apiKey,
  });
});

// List all API keys (admin only)
router.get("/keys", authenticateAdmin, async (req, res) => {
  const keys = await ApiKey.getAllKeys();
  logger.debug(`Retrieved ${keys.length} API keys`, { keys });
  res.json({ keys });
});

// Revoke an API key
router.delete("/revoke-key/:apiKey", authenticateAdmin, (req, res) => {
  const { apiKey } = req.params;

  if (ApiKey.removeKey(apiKey)) {
    logger.info(`API key revoked: ${apiKey.substring(0, 8)}...`);
    res.json({ success: true, message: "API key revoked successfully" });
  } else {
    logger.warn(`Failed to revoke API key: ${apiKey.substring(0, 8)}... (not found)`);
    res.status(404).json({ error: "API key not found" });
  }
});

// Validate API key (for bots to check their key)
router.post("/validate", (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key is required" });
  }

  const keyData = ApiKey.validateKey(apiKey);
  if (keyData) {
    logger.debug(`API key validated successfully for bot: ${keyData.botName}`);
    res.json({
      valid: true,
      botName: keyData.botName,
    });
  } else {
    logger.warn(`Invalid API key validation attempt: ${apiKey.substring(0, 8)}...`);
    res.status(401).json({
      valid: false,
      error: "Invalid API key",
    });
  }
});

module.exports = router;
