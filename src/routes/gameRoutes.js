const express = require("express");
const router = express.Router();
const Game = require("../models/Game");
const Player = require("../models/Player");
const { v4: uuidv4 } = require("uuid");

let currentGame = null;

// Create or join a game
router.post("/join", (req, res) => {
  const { playerName } = req.body;

  if (!playerName) {
    return res.status(400).json({ error: "Player name is required" });
  }

  const player = new Player(uuidv4(), playerName);

  if (!currentGame) {
    currentGame = new Game();
  }

  if (currentGame.addPlayer(player)) {
    res.json({
      playerId: player.id,
      gameId: currentGame.id,
      message: "Successfully joined the game. Use /ready endpoint when you're ready to play.",
    });
  } else {
    res.status(400).json({ error: "Game is full" });
  }
});

// Player indicates they're ready
router.post("/ready/:playerId", (req, res) => {
  const { playerId } = req.params;

  if (!currentGame) {
    return res.status(404).json({ error: "No game in progress" });
  }

  if (currentGame.isGameOver) {
    return res.status(400).json({
      error: "Previous game is over. Please start a new game.",
      gameState: currentGame.getGameState(playerId),
    });
  }

  const player = currentGame.players.find((p) => p.id === playerId);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  player.isReady = true;

  // Check if all players are ready
  const readyPlayers = currentGame.players.filter((p) => p.isReady).length;

  if (readyPlayers === 2) {
    // Start the game automatically when both players are ready
    if (currentGame.startGame()) {
      return res.json({
        message: "All players ready! Game starting...",
        gameState: currentGame.getGameState(playerId),
      });
    }
  } else if (currentGame.players.length < 2) {
    return res.json({
      message: "You're ready! Waiting for another player to join...",
      readyCount: readyPlayers,
      requiredPlayers: 2,
    });
  } else {
    return res.json({
      message: "You're ready! Waiting for other player to be ready...",
      readyCount: readyPlayers,
      requiredPlayers: 2,
    });
  }
});

// Get game state
router.get("/state/:playerId", (req, res) => {
  const { playerId } = req.params;

  if (!currentGame) {
    return res.status(404).json({ error: "No game in progress" });
  }

  const gameState = currentGame.getGameState(playerId);
  if (!gameState) {
    return res.status(404).json({ error: "Player not found" });
  }

  // Add ready status to game state
  gameState.readyPlayers = currentGame.players.filter((p) => p.isReady).length;
  gameState.totalPlayers = currentGame.players.length;

  res.json(gameState);
});

// Make a move
router.post("/move/:playerId", (req, res) => {
  const { playerId } = req.params;
  const { action, amount } = req.body;

  if (!currentGame) {
    return res.status(404).json({ error: "No game in progress" });
  }

  if (currentGame.isGameOver) {
    return res.status(400).json({
      error: "Game is over. Start a new game to continue playing.",
      gameState: currentGame.getGameState(playerId),
    });
  }

  const result = currentGame.handleMove(playerId, action, amount);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  res.json({
    message: result.message,
    gameState: currentGame.getGameState(playerId),
  });
});

// Start game endpoint - uses currentGame instance
router.post("/start", (req, res) => {
  if (!currentGame) {
    return res.status(404).json({ error: "No game exists" });
  }

  if (currentGame.players.length !== 2) {
    return res.status(400).json({ error: "Need exactly 2 players to start" });
  }

  if (currentGame.startGame()) {
    res.json({ message: "Game started successfully" });
  } else {
    res.status(400).json({ error: "Could not start game" });
  }
});

// Add a new endpoint to start a new game after game over or simply start a new game
router.post("/new-game", (req, res) => {
  currentGame = new Game();
  res.json({ message: "New game created. Players can now join." });
});

module.exports = router;
