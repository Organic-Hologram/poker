const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { logger } = require("../utils/logger");

// Caminho para o arquivo do banco de dados
const dbPath = path.join(__dirname, "../../data/poker.db");

// Criar conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error("Error connecting to the database:", err);
    return;
  }
  logger.info("Connected to the SQLite database");
});

// Habilitar foreign keys
db.run("PRAGMA foreign_keys = ON");

// Wrapper para promises
const dbAsync = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          logger.error("Database error:", err);
          reject(err);
          return;
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, result) => {
        if (err) {
          logger.error("Database error:", err);
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error("Database error:", err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  },
};

module.exports = {
  db,
  dbAsync,
};
