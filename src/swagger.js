const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Poker Game API",
      version: "1.0.0",
      description: "A RESTful API for a two-player Texas Hold'em poker game",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Path to the API routes files
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };
