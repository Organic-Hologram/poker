// Carregar variáveis de ambiente do arquivo .env
require("dotenv").config({
  path: process.env.NODE_ENV === "development" ? ".env.development" : ".env",
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const gameRoutes = require("./routes/gameRoutes");
const { specs, swaggerUi } = require("./swagger");
const { logger, httpLogger, requestDetailLogger } = require("./utils/logger");
const PORT = process.env.PORT || 3001;

// Informar qual ambiente está sendo usado
logger.info(`API rodando em ambiente: ${process.env.NODE_ENV || PORT}`);

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

app.listen(PORT, () => {
  logger.info(`Poker Game API Server iniciado`, { port: PORT, environment: process.env.NODE_ENV });
  logger.info(`Documentação Swagger disponível em http://localhost:${PORT}/api-docs`);
  logger.info(`Dashboard de monitoramento disponível em http://localhost:${PORT}/dashboard.html`);
});
