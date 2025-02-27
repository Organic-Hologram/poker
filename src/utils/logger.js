const winston = require("winston");
const morgan = require("morgan");

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
  }`;
});

// Determinar o nível de log com base na variável de ambiente
const logLevel = process.env.LOG_LEVEL || "info";

// Create the Winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    logFormat,
  ),
  defaultMeta: { service: "poker-game-api" },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Create HTTP request logger middleware for Express
const httpLogger = morgan(
  // Custom format - shows method, url, status, response time
  ":method :url :status :response-time ms",
  {
    // Log to Winston instead of console
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  },
);

// Development-only middleware for detailed request logging
const requestDetailLogger = (req, res, next) => {
  if (process.env.ENABLE_DETAILED_LOGGING === "true") {
    logger.debug("Request Details", {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
    });
  }
  next();
};

// Game action logger - use for poker game specific events
const gameLogger = {
  gameCreated: (gameId) => {
    logger.info(`Game created with ID: ${gameId}`);
  },

  playerJoined: (gameId, playerId, playerName) => {
    logger.info(`Player joined game`, { gameId, playerId, playerName });
  },

  gameStarted: (gameId, players) => {
    logger.info(`Game started`, { gameId, players });
  },

  playerMove: (gameId, playerId, action, amount) => {
    logger.info(`Player move`, { gameId, playerId, action, amount });
  },

  gameEnded: (gameId, winner, pot) => {
    logger.info(`Game ended`, { gameId, winner, pot });
  },

  error: (message, error) => {
    logger.error(message, { error: error.message, stack: error.stack });
  },

  debug: (message, data) => {
    if (process.env.LOG_LEVEL === "debug") {
      logger.debug(message, data);
    }
  },
};

module.exports = {
  logger,
  httpLogger,
  requestDetailLogger,
  gameLogger,
};
