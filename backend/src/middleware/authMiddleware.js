const ApiKey = require("../models/ApiKey");

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key is required" });
  }

  const keyData = ApiKey.validateKey(apiKey);
  if (!keyData) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Add bot info to request object
  req.bot = {
    name: keyData.botName,
    apiKey: apiKey,
  };

  next();
}

module.exports = {
  authenticateApiKey,
};
