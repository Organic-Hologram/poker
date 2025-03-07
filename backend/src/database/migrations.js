const { dbAsync } = require("./config");
const { logger } = require("../utils/logger");

const migrations = [
  // Tabela de API Keys
  `CREATE TABLE IF NOT EXISTS api_keys (
        key TEXT PRIMARY KEY,
        bot_name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        is_active BOOLEAN DEFAULT 1
    )`,

  // Tabela de Jogos
  `CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        pot INTEGER DEFAULT 0,
        current_bet INTEGER DEFAULT 0,
        current_player_index INTEGER,
        community_cards TEXT,
        round_history TEXT,
        final_community_cards TEXT,
        final_hands TEXT,
        final_pot INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        winner_id TEXT,
        winning_hand TEXT,
        winning_hand_description TEXT,
        last_action TEXT,
        last_raise_amount INTEGER
    )`,

  // Tabela de Jogadores
  `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT,
        name TEXT NOT NULL,
        chips INTEGER DEFAULT 1000,
        current_bet INTEGER DEFAULT 0,
        is_ready BOOLEAN DEFAULT 0,
        is_folded BOOLEAN DEFAULT 0,
        hand TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )`,

  // Tabela de Histórico de Rodadas
  `CREATE TABLE IF NOT EXISTS round_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        action TEXT NOT NULL,
        amount INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id)
    )`,
];

async function runMigrations() {
  try {
    for (const migration of migrations) {
      await dbAsync.run(migration);
      logger.info("Migration executed successfully");
    }
    logger.info("All migrations completed successfully");
  } catch (error) {
    logger.error("Error running migrations:", error);
    throw error;
  }
}

module.exports = {
  runMigrations,
};
