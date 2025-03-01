const express = require("express");
const router = express.Router();
const Game = require("../models/Game");
const Player = require("../models/Player");
const { v4: uuidv4 } = require("uuid");
const { gameLogger } = require("../utils/logger");

let currentGame = null;

/**
 * @swagger
 * components:
 *   schemas:
 *     Player:
 *       type: object
 *       required:
 *         - id
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: Unique player ID
 *         name:
 *           type: string
 *           description: Player name
 *         chips:
 *           type: integer
 *           description: Current amount of chips
 *         hand:
 *           type: array
 *           description: Player's current hand of cards
 *           items:
 *             $ref: '#/components/schemas/Card'
 *         isReady:
 *           type: boolean
 *           description: Whether the player is ready to start the game
 *
 *     Card:
 *       type: object
 *       properties:
 *         suit:
 *           type: string
 *           description: Card suit (♠, ♣, ♥, ♦)
 *         rank:
 *           type: string
 *           description: Card rank (2-10, J, Q, K, A)
 *
 *     GameState:
 *       type: object
 *       properties:
 *         gameId:
 *           type: string
 *           description: Unique game ID
 *         pot:
 *           type: integer
 *           description: Current pot size
 *         communityCards:
 *           type: array
 *           description: Cards on the table
 *           items:
 *             $ref: '#/components/schemas/Card'
 *         currentPlayerIndex:
 *           type: integer
 *           description: Index of the current player's turn
 *         gameState:
 *           type: string
 *           description: Current state of the game (waiting, preflop, flop, turn, river, showdown)
 *         isGameOver:
 *           type: boolean
 *           description: Whether the game is over
 */

/**
 * @swagger
 * /game/join:
 *   post:
 *     summary: Join a poker game
 *     description: Create a player and join a game. Creates a new game if none exists.
 *     tags: [Game]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerName
 *             properties:
 *               playerName:
 *                 type: string
 *                 description: The name of the player
 *     responses:
 *       200:
 *         description: Successfully joined the game
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 playerId:
 *                   type: string
 *                   description: Unique player ID
 *                 gameId:
 *                   type: string
 *                   description: Unique game ID
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Bad request (game is full or missing player name)
 */
router.post("/join", (req, res) => {
  try {
    const { playerName } = req.body;

    if (!playerName) {
      gameLogger.debug("Join attempt with missing player name");
      return res.status(400).json({ error: "Player name is required" });
    }

    const player = new Player(uuidv4(), playerName);

    if (!currentGame) {
      currentGame = new Game();
      gameLogger.gameCreated(currentGame.id);
    }

    if (currentGame.addPlayer(player)) {
      gameLogger.playerJoined(currentGame.id, player.id, playerName);
      res.json({
        playerId: player.id,
        gameId: currentGame.id,
        message: "Successfully joined the game. Use /ready endpoint when you're ready to play.",
      });
    } else {
      gameLogger.debug("Join attempt but game is full", { gameId: currentGame.id });
      res.status(400).json({ error: "Game is full" });
    }
  } catch (error) {
    gameLogger.error("Error in /join endpoint", error);
    res.status(500).json({ error: "Server error joining game" });
  }
});

/**
 * @swagger
 * /game/ready/{playerId}:
 *   post:
 *     summary: Mark player as ready
 *     description: Set player's status to ready. Game starts when all players are ready.
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: playerId
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique ID of the player
 *     responses:
 *       200:
 *         description: Player is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Status message
 *                 gameState:
 *                   $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Player not found or no game in progress
 */
router.post("/ready/:playerId", (req, res) => {
  try {
    const { playerId } = req.params;

    if (!currentGame) {
      gameLogger.debug("Ready attempt but no game in progress");
      return res.status(404).json({ error: "No game in progress" });
    }

    if (currentGame.isGameOver) {
      gameLogger.debug("Ready attempt but game is over", { gameId: currentGame.id });
      return res.status(400).json({
        error: "Previous game is over. Please start a new game.",
        gameState: currentGame.getGameState(playerId),
      });
    }

    const player = currentGame.players.find((p) => p.id === playerId);
    if (!player) {
      gameLogger.debug("Ready attempt with invalid player ID", { playerId });
      return res.status(404).json({ error: "Player not found" });
    }

    player.isReady = true;
    gameLogger.debug("Player marked as ready", {
      gameId: currentGame.id,
      playerId,
      playerName: player.name,
    });

    // Check if all players are ready
    const readyPlayers = currentGame.players.filter((p) => p.isReady).length;

    if (readyPlayers === 2) {
      // Start the game automatically when both players are ready
      if (currentGame.startGame()) {
        const players = currentGame.players.map((p) => ({ id: p.id, name: p.name }));
        gameLogger.gameStarted(currentGame.id, players);
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
  } catch (error) {
    gameLogger.error("Error in /ready endpoint", error);
    res.status(500).json({ error: "Server error marking player ready" });
  }
});

/**
 * @swagger
 * /game/state/{playerId}:
 *   get:
 *     summary: Get game state
 *     description: Get the current state of the game from a player's perspective
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: playerId
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique ID of the player
 *     responses:
 *       200:
 *         description: Current game state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Player not found or no game in progress
 */
router.get("/state/:playerId", (req, res) => {
  try {
    const { playerId } = req.params;

    if (!currentGame) {
      gameLogger.debug("State request but no game in progress");
      return res.status(404).json({ error: "No game in progress" });
    }

    const gameState = currentGame.getGameState(playerId);
    if (!gameState) {
      gameLogger.debug("State request with invalid player ID", { playerId });
      return res.status(404).json({ error: "Player not found" });
    }

    // Add ready status to game state
    gameState.readyPlayers = currentGame.players.filter((p) => p.isReady).length;
    gameState.totalPlayers = currentGame.players.length;

    gameLogger.debug("Game state retrieved", {
      gameId: currentGame.id,
      playerId,
      gamePhase: gameState.gameState,
      isGameOver: gameState.isGameOver,
    });

    res.json(gameState);
  } catch (error) {
    gameLogger.error("Error in /state endpoint", error);
    res.status(500).json({ error: "Server error retrieving game state" });
  }
});

/**
 * @swagger
 * /game/move/{playerId}:
 *   post:
 *     summary: Make a move
 *     description: Execute a poker move (call, fold, or raise)
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: playerId
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique ID of the player
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 description: The action to take (call, fold, raise)
 *                 enum: [call, fold, raise]
 *               amount:
 *                 type: integer
 *                 description: Amount to raise (required for 'raise' action)
 *     responses:
 *       200:
 *         description: Move executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 gameState:
 *                   $ref: '#/components/schemas/GameState'
 *       400:
 *         description: Invalid move or not player's turn
 *       404:
 *         description: Player not found or no game in progress
 */
router.post("/move/:playerId", (req, res) => {
  try {
    const { playerId } = req.params;
    const { action, amount } = req.body;

    if (!currentGame) {
      gameLogger.debug("Move attempt but no game in progress");
      return res.status(404).json({ error: "No game in progress" });
    }

    if (currentGame.isGameOver) {
      gameLogger.debug("Move attempt but game is over", { gameId: currentGame.id });
      return res.status(400).json({
        error: "Game is over. Start a new game to continue playing.",
        gameState: currentGame.getGameState(playerId),
      });
    }

    gameLogger.playerMove(currentGame.id, playerId, action, amount);

    const result = currentGame.handleMove(playerId, action, amount);
    if (!result.success) {
      gameLogger.debug("Invalid move attempt", {
        gameId: currentGame.id,
        playerId,
        action,
        amount,
        error: result.message,
      });
      return res.status(400).json({ error: result.message });
    }

    // Check if the game has ended with this move
    if (currentGame.isGameOver && currentGame.winner) {
      gameLogger.gameEnded(
        currentGame.id,
        { id: currentGame.winner.id, name: currentGame.winner.name },
        currentGame.finalPot,
      );
    }

    res.json({
      message: result.message,
      gameState: currentGame.getGameState(playerId),
    });
  } catch (error) {
    gameLogger.error("Error in /move endpoint", error);
    res.status(500).json({ error: "Server error processing move" });
  }
});

/**
 * @swagger
 * /game/start:
 *   post:
 *     summary: Start a game manually
 *     description: Manually start a game (alternative to ready endpoint)
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Game started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Cannot start game (not enough players)
 *       404:
 *         description: No game exists
 */
router.post("/start", (req, res) => {
  try {
    if (!currentGame) {
      gameLogger.debug("Start attempt but no game exists");
      return res.status(404).json({ error: "No game exists" });
    }

    if (currentGame.players.length !== 2) {
      gameLogger.debug("Start attempt but not enough players", {
        gameId: currentGame.id,
        playerCount: currentGame.players.length,
      });
      return res.status(400).json({ error: "Need exactly 2 players to start" });
    }

    if (currentGame.startGame()) {
      const players = currentGame.players.map((p) => ({ id: p.id, name: p.name }));
      gameLogger.gameStarted(currentGame.id, players);
      res.json({ message: "Game started successfully" });
    } else {
      gameLogger.debug("Start attempt failed", { gameId: currentGame.id });
      res.status(400).json({ error: "Could not start game" });
    }
  } catch (error) {
    gameLogger.error("Error in /start endpoint", error);
    res.status(500).json({ error: "Server error starting game" });
  }
});

/**
 * @swagger
 * /game/new-game:
 *   post:
 *     summary: Start a new game
 *     description: Create a new game instance, discarding any existing game
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: New game created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 */
router.post("/new-game", (req, res) => {
  try {
    // Log the old game ID if it exists
    if (currentGame) {
      gameLogger.debug("Replacing existing game", { oldGameId: currentGame.id });
    }

    currentGame = new Game();
    gameLogger.gameCreated(currentGame.id);
    res.json({ message: "New game created. Players can now join." });
  } catch (error) {
    gameLogger.error("Error in /new-game endpoint", error);
    res.status(500).json({ error: "Server error creating new game" });
  }
});

/**
 * @swagger
 * /game/games:
 *   get:
 *     summary: Listar todos os jogos
 *     description: Retorna informações sobre todos os jogos para o dashboard
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Lista de jogos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/games", (req, res) => {
  try {
    if (!currentGame) {
      return res.json({ games: [] });
    }

    // Este é um ponto de partida. Na implementação real, você manteria
    // um array com todos os jogos ativos em vez de apenas um jogo por vez.
    // Para demonstração, retornamos apenas o jogo atual se ele existir
    const gameInfo = {
      id: currentGame.id,
      players: currentGame.players.map((player) => ({
        id: player.id,
        name: player.name,
        chips: player.chips,
        index: currentGame.players.indexOf(player),
      })),
      gameState: currentGame.gameState,
      pot: currentGame.pot,
      currentPlayerIndex: currentGame.currentPlayer,
      communityCards: currentGame.communityCards,
      createdAt: new Date().toISOString(), // Simulado, normalmente você armazenaria isso quando o jogo é criado
    };

    // Se o jogo terminou, adicionamos informações sobre o vencedor
    if (currentGame.isGameOver && currentGame.winner) {
      gameInfo.winner = {
        id: currentGame.winner.id,
        name: currentGame.winner.name,
        chips: currentGame.winner.chips,
      };
      gameInfo.finalPot = currentGame.finalPot;
      gameInfo.winningHand = currentGame.winningHand;
    }

    res.json({ games: [gameInfo] });
  } catch (error) {
    gameLogger.error("Error in /games endpoint", error);
    res.status(500).json({ error: "Server error retrieving games list" });
  }
});

module.exports = router;
