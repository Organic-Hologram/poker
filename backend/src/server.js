// Carregar variáveis de ambiente do arquivo .env
require("dotenv").config({
  path: process.env.NODE_ENV === "development" ? ".env.development" : ".env",
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const gameRoutes = require("./routes/gameRoutes");
const authRoutes = require("./routes/authRoutes");
const { specs, swaggerUi } = require("./swagger");
const { logger, httpLogger, requestDetailLogger } = require("./utils/logger");
const { runMigrations } = require("./database/migrations");
const GameManager = require("./models/GameManager");
const PORT = process.env.PORT || 3001;

// Informar qual ambiente está sendo usado
logger.info(`API rodando em ambiente: ${process.env.NODE_ENV || PORT}`);

// Inicializar banco de dados e game manager
async function initializeDatabase() {
  try {
    await runMigrations();
    logger.info("Database initialized successfully");

    // Initialize game manager
    const gameManager = new GameManager(5);
    await gameManager.initializeGames();
    logger.info("Game manager initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize:", error);
    process.exit(1);
  }
}

const app = express();

// Enable CORS for all routes
app.use(cors());

// Add HTTP request logging
app.use(httpLogger);

// Add request details logging if enabled
app.use(requestDetailLogger);

// Configurar pasta de arquivos estáticos
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(express.json());
app.use("/api/game", gameRoutes);
app.use("/api/auth", authRoutes);

// Swagger documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));

// Redirecionar root para o dashboard
app.get("/", (req, res) => {
  res.redirect("/dashboard.html");
});

// Rota para documentação API
app.get("/documentation", (req, res) => {
  res.redirect("/api-docs");
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Server Error", { error: err.message, stack: err.stack });
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// Inicializar banco de dados antes de iniciar o servidor
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(`Poker Game API Server iniciado`, {
      port: PORT,
      environment: process.env.NODE_ENV,
    });
    logger.info(`Documentação Swagger disponível em http://localhost:${PORT}/api-docs`);
    logger.info(`Dashboard de monitoramento disponível em http://localhost:${PORT}/dashboard.html`);
  });
});
