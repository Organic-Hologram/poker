const { dbAsync } = require("../database/config");
const { logger } = require("../utils/logger");

class ApiKey {
  static async addKey(apiKey, botName) {
    try {
      await dbAsync.run("INSERT INTO api_keys (key, bot_name) VALUES (?, ?)", [apiKey, botName]);
      logger.info(`API key added for bot: ${botName}`);
      return true;
    } catch (error) {
      logger.error("Error adding API key:", error);
      return false;
    }
  }

  static async validateKey(apiKey) {
    try {
      const key = await dbAsync.get("SELECT * FROM api_keys WHERE key = ? AND is_active = 1", [
        apiKey,
      ]);

      if (key) {
        // Atualizar last_used_at
        await dbAsync.run("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?", [
          apiKey,
        ]);
        return {
          botName: key.bot_name,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
        };
      }
      return null;
    } catch (error) {
      logger.error("Error validating API key:", error);
      return null;
    }
  }

  static async getBotName(apiKey) {
    try {
      const key = await dbAsync.get(
        "SELECT bot_name FROM api_keys WHERE key = ? AND is_active = 1",
        [apiKey],
      );
      return key ? key.bot_name : null;
    } catch (error) {
      logger.error("Error getting bot name:", error);
      return null;
    }
  }

  static async removeKey(apiKey) {
    try {
      const result = await dbAsync.run("UPDATE api_keys SET is_active = 0 WHERE key = ?", [apiKey]);
      return result.changes > 0;
    } catch (error) {
      logger.error("Error removing API key:", error);
      return false;
    }
  }

  static async getAllKeys() {
    try {
      const keys = await dbAsync.all(
        "SELECT key, bot_name, created_at, last_used_at FROM api_keys WHERE is_active = 1",
      );
      return keys.map((key) => ({
        key: key.key,
        botName: key.bot_name,
        createdAt: key.created_at,
        lastUsedAt: key.last_used_at,
      }));
    } catch (error) {
      logger.error("Error getting all keys:", error);
      return [];
    }
  }
}

module.exports = ApiKey;
