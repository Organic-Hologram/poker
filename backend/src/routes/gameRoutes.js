const express = require("express");
const router = express.Router();
const Game = require("../models/Game");
const Player = require("../models/Player");
const GameManager = require("../models/GameManager");
const GameHistory = require("../models/GameHistory");
const { v4: uuidv4 } = require("uuid");
const { gameLogger, logger } = require("../utils/logger");
const { authenticateApiKey } = require("../middleware/authMiddleware");
const { dbAsync } = require("../database/config");

// Create a single instance of GameManager that will be shared across all routes
const gameManager = new GameManager(5); // Limite de 5 salas

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
router.post("/join", authenticateApiKey, async (req, res) => {
  const playerName = req.body.playerName;
  const gameId = req.body.gameId;
  logger.info(`playerName: ${playerName}, gameId: ${gameId}`);
  try {
    // Create player object
    const player = {
      id: req.headers["x-api-key"],
      name: playerName,
      isReady: false,
      chips: 1000, // Default starting chips
    };

    const result = await gameManager.addPlayerToGame(player, gameId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      gameId: result.gameId,
      playerId: player.id,
      message: `Player ${playerName} joined the game successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /game/ready:
 *   post:
 *     summary: Mark player as ready
 *     description: Set player's status to ready. Game starts when all players are ready.
 *     tags: [Game]
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
router.post("/ready", authenticateApiKey, async (req, res) => {
  try {
    const playerId = req.headers["x-api-key"];
    const game = await gameManager.getPlayerGame(playerId);

    if (!game) {
      gameLogger.debug("Ready attempt but no game found for player", { playerId });
      return res.status(404).json({ error: "No game found for this player" });
    }

    if (game.isGameOver) {
      gameLogger.debug("Ready attempt but game is over", { gameId: game.id });
      return res.status(400).json({
        error: "Previous game is over. Please join a new game.",
        // Construímos o estado manualmente já que pode não haver o método getGameState
        gameState:
          typeof game.getGameState === "function"
            ? game.getGameState(playerId)
            : { gameId: game.id, isGameOver: true },
      });
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      gameLogger.debug("Ready attempt with invalid player ID", { playerId });
      return res.status(404).json({ error: "Player not found" });
    }

    player.isReady = true;

    // Update player ready status in the database
    await dbAsync.run("UPDATE players SET is_ready = 1 WHERE id = ?", [playerId]);

    gameLogger.debug("Player marked as ready", {
      gameId: game.id,
      playerId,
      playerName: player.name,
    });

    // Check if all players are ready and start the game if they are
    if (game.players.length === 2 && game.players.every((p) => p.isReady)) {
      // Aqui é onde precisamos garantir que os objetos jogador sejam instâncias da classe Player
      // Vamos carregar o jogo como uma instância da classe Game
      const Player = require("../models/Player");
      const Game = require("../models/Game");

      // Criar uma nova instância de Game
      const properGame = new Game();
      properGame.id = game.id;
      properGame.gameState = game.gameState;
      properGame.pot = game.pot || 0;
      properGame.currentBet = game.currentBet || 0;
      properGame.currentPlayer = game.currentPlayer || 0;
      properGame.smallBlind = game.smallBlind || 10;
      properGame.bigBlind = game.bigBlind || 20;
      properGame.communityCards = game.communityCards || [];
      properGame.lastAction = game.lastAction;
      properGame.lastRaiseAmount = game.lastRaiseAmount || 0;
      properGame.winner = game.winner;
      properGame.winningHand = game.winningHand;
      properGame.isGameOver = game.isGameOver || false;

      // Converter os jogadores para instâncias de Player
      properGame.players = game.players.map((p) => {
        const properPlayer = new Player(p.id, p.name);
        properPlayer.chips = p.chips || 1000;
        properPlayer.currentBet = p.currentBet || 0;
        properPlayer.isActive = p.isActive !== undefined ? p.isActive : true;
        properPlayer.isFolded = p.isFolded || false;
        properPlayer.isReady = p.isReady || false;
        properPlayer.hand = p.hand || [];
        return properPlayer;
      });

      // Iniciar o jogo com as instâncias adequadas
      properGame.startGame();

      // Atualizar o jogo original com os novos valores
      game.gameState = properGame.gameState;
      game.pot = properGame.pot;
      game.currentBet = properGame.currentBet;
      game.currentPlayer = properGame.currentPlayer;

      // Add debug logging to verify game state change
      gameLogger.debug("Game state after startGame", {
        gameId: game.id,
        originalState: game.gameState,
        properGameState: properGame.gameState,
      });

      // Ensure game state is definitely set to preflop if both players are ready
      if (
        game.players.length === 2 &&
        game.players.every((p) => p.isReady) &&
        game.gameState === "waiting"
      ) {
        game.gameState = "preflop";
        gameLogger.debug("Forcing game state to preflop", { gameId: game.id });
      }

      // Atualizar os jogadores originais
      for (let i = 0; i < game.players.length; i++) {
        game.players[i].hand = properGame.players[i].hand;
        game.players[i].currentBet = properGame.players[i].currentBet;
        game.players[i].chips = properGame.players[i].chips;
      }

      // Atualizar o jogo na memória do GameManager
      gameManager.games.set(game.id, game);

      // Update game state in database
      await dbAsync.run(
        "UPDATE games SET state = ?, pot = ?, current_bet = ?, current_player_index = ? WHERE id = ?",
        [game.gameState, game.pot, game.currentBet, game.currentPlayer, game.id],
      );

      // Verify the update was successful
      const updatedGame = await dbAsync.get("SELECT state FROM games WHERE id = ?", [game.id]);
      gameLogger.debug("Game state after database update", {
        gameId: game.id,
        dbState: updatedGame.state,
        memoryState: game.gameState,
      });

      // Update player hands in database
      for (const p of game.players) {
        await dbAsync.run("UPDATE players SET hand = ?, chips = ?, current_bet = ? WHERE id = ?", [
          JSON.stringify(p.hand),
          p.chips,
          p.currentBet,
          p.id,
        ]);
      }

      gameLogger.gameStarted(game.id);
    }

    // Construir resposta adequadamente dependendo se o objeto game tem o método getGameState
    let responseData = {
      success: true,
    };

    if (typeof game.getGameState === "function") {
      responseData.gameState = game.getGameState(playerId);
    } else {
      // Construir o estado manualmente se não houver o método
      const playerInfo = game.players.find((p) => p.id === playerId);
      responseData.gameState = {
        gameId: game.id,
        gameState: game.gameState,
        pot: game.pot,
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          isReady: p.isReady,
        })),
        hand: playerInfo?.hand || [],
      };
    }

    return res.json(responseData);
  } catch (error) {
    gameLogger.error("Error in /ready endpoint", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Server error", details: error.message });
  }
});

/**
 * @swagger
 * /game/state:
 *   get:
 *     summary: Get current game state for a player
 *     description: Get the current state of the game from the player's perspective
 *     tags: [Game]
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
router.get("/state", authenticateApiKey, async (req, res) => {
  try {
    const playerId = req.headers["x-api-key"];
    const game = await gameManager.getPlayerGame(playerId);

    if (!game) {
      gameLogger.debug("State request but no game found for player", { playerId });
      return res.status(404).json({ error: "No game found for this player" });
    }

    // Verificar se o game é uma instância da classe Game ou um objeto simples
    if (typeof game.getGameState !== "function") {
      // Se for um objeto simples, construir manualmente o estado do jogo
      const player = game.players.find((p) => p.id === playerId);
      if (!player) {
        gameLogger.debug("State request with invalid player ID", { playerId });
        return res.status(404).json({ error: "Player not found" });
      }

      const gameState = {
        gameId: game.id,
        pot: game.pot || 0,
        smallBlind: {
          amount: game.smallBlind || 10,
          player: game.players[0]?.name || "Unknown",
        },
        bigBlind: {
          amount: game.bigBlind || 20,
          player: game.players[1]?.name || "Unknown",
        },
        communityCards: game.communityCards || [],
        currentBet: game.currentBet || 0,
        currentPlayerIndex: game.currentPlayer || 0,
        currentPlayerName: game.players[game.currentPlayer || 0]?.name || "Unknown",
        players: game.players.map((p) => ({
          name: p.name,
          id: p.id,
          index: game.players.indexOf(p),
        })),
        gameState: game.gameState || "waiting",
        isCurrentPlayer:
          game.currentPlayer !== undefined && game.players[game.currentPlayer]?.id === playerId,
        hand: player.hand || [],
        chips: player.chips || 1000,
        canCheck: (game.currentBet || 0) <= (player.currentBet || 0),
        canCall: (game.currentBet || 0) > (player.currentBet || 0),
        currentPlayerBet: player.currentBet || 0,
        minimumRaise: (game.currentBet || 0) + (game.lastRaiseAmount || game.bigBlind || 20),
        isGameOver: game.isGameOver || false,
        winner: game.winner,
        winningHand: game.winningHand,
        possibleActions: ["fold", "check", "call", "raise", "all-in"].filter((action) => {
          if (action === "check" && (game.currentBet || 0) > (player.currentBet || 0)) return false;
          if (action === "call" && (game.currentBet || 0) <= (player.currentBet || 0)) return false;
          return true;
        }),
      };

      gameLogger.debug("Game state manually constructed", {
        gameId: game.id,
        playerId,
        gamePhase: gameState.gameState,
        isGameOver: gameState.isGameOver,
      });

      return res.json(gameState);
    }

    // Se for uma instância da classe Game, usar o método getGameState
    const gameState = game.getGameState(playerId);
    if (!gameState) {
      gameLogger.debug("State request with invalid player ID", { playerId });
      return res.status(404).json({ error: "Player not found" });
    }

    gameLogger.debug("Game state retrieved", {
      gameId: game.id,
      playerId,
      gamePhase: gameState.gameState,
      isGameOver: gameState.isGameOver,
    });

    res.json(gameState);
  } catch (error) {
    gameLogger.error("Error in /state endpoint", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Server error getting game state" });
  }
});

/**
 * @swagger
 * /game/action:
 *   post:
 *     summary: Make a move
 *     description: Execute a poker move (call, fold, or raise)
 *     tags: [Game]
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
router.post("/action", authenticateApiKey, async (req, res) => {
  try {
    const playerId = req.headers["x-api-key"];
    const { action, amount } = req.body;
    const game = await gameManager.getPlayerGame(playerId);

    if (!game) {
      gameLogger.debug("Action attempt but no game found for player", { playerId });
      return res.status(404).json({ error: "No game found for this player" });
    }

    if (game.isGameOver) {
      gameLogger.debug("Action attempt but game is over", { gameId: game.id });
      return res.status(400).json({ error: "Game is over" });
    }

    // Primeiro, convertemos os jogadores para instâncias da classe Player
    const Player = require("../models/Player");

    // Convertemos o jogador atual para uma instância proper da classe Player
    game.players = game.players.map((p) => {
      const properPlayer = new Player(p.id, p.name);
      properPlayer.chips = p.chips || 1000;
      properPlayer.hand = p.hand || [];
      properPlayer.currentBet = p.currentBet || 0;
      properPlayer.isActive = p.isActive !== undefined ? p.isActive : true;
      properPlayer.isFolded = p.isFolded || false;
      properPlayer.isReady = p.isReady || false;
      return properPlayer;
    });

    // Agora executamos a ação com os jogadores convertidos
    const result = game.handleAction(playerId, action, amount);
    if (result.success) {
      gameLogger.debug("Action successful", {
        gameId: game.id,
        playerId,
        action,
        amount,
      });

      // Registrar a ação no histórico de rodadas no banco de dados
      if (result.roundAction) {
        try {
          await dbAsync.run(
            "INSERT INTO round_history (game_id, player_id, action, amount) VALUES (?, ?, ?, ?)",
            [game.id, playerId, result.roundAction.action, result.roundAction.amount],
          );
          gameLogger.debug("Action recorded in history", {
            gameId: game.id,
            playerId,
            action: result.roundAction.action,
          });
        } catch (error) {
          gameLogger.error("Error recording action in history", {
            error,
            gameId: game.id,
            playerId,
          });
        }
      }

      // Se o jogo acabou após este movimento, limpa os jogos finalizados
      if (game.isGameOver) {
        // Registrar o resultado final na tabela round_history
        try {
          await dbAsync.run(
            "INSERT INTO round_history (game_id, player_id, action, amount) VALUES (?, ?, ?, ?)",
            [game.id, game.winner.id, "win", game.finalPot],
          );

          // Atualizar dados do vencedor na tabela games
          await dbAsync.run(
            "UPDATE games SET winner_id = ?, winning_hand = ?, winning_hand_description = ?, final_pot = ?, final_community_cards = ?, final_hands = ? WHERE id = ?",
            [
              game.winner.id,
              game.winningHand,
              game.winningHandDescription,
              game.finalPot,
              JSON.stringify(game.finalCommunityCards),
              JSON.stringify(game.finalHands),
              game.id,
            ],
          );

          gameLogger.debug("Game result recorded", {
            gameId: game.id,
            winnerId: game.winner.id,
            pot: game.finalPot,
            winningHand: game.winningHand,
          });
        } catch (error) {
          gameLogger.error("Error recording game result", {
            error,
            gameId: game.id,
          });
        }

        gameManager.cleanupFinishedGames();
      }

      // Atualizar o estado do jogo no banco de dados
      await dbAsync.run(
        "UPDATE games SET state = ?, pot = ?, current_bet = ?, current_player_index = ?, round_history = ? WHERE id = ?",
        [
          game.gameState,
          game.pot,
          game.currentBet,
          game.currentPlayer,
          JSON.stringify(game.roundHistory),
          game.id,
        ],
      );

      // Atualizar o estado dos jogadores no banco de dados
      for (const player of game.players) {
        await dbAsync.run(
          "UPDATE players SET chips = ?, current_bet = ?, is_folded = ? WHERE id = ?",
          [player.chips, player.currentBet, player.isFolded ? 1 : 0, player.id],
        );
      }

      res.json({ message: result.message, gameState: game.getGameState(playerId) });
    } else {
      gameLogger.debug("Action failed", {
        gameId: game.id,
        playerId,
        action,
        amount,
        error: result.message,
      });
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    gameLogger.error("Error in /action endpoint", error);
    res.status(500).json({ error: "Server error processing action" });
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
router.post("/start", authenticateApiKey, (req, res) => {
  try {
    if (!gameManager.hasActiveGames()) {
      gameLogger.debug("Start attempt but no game exists");
      return res.status(404).json({ error: "No game exists" });
    }

    if (gameManager.getActiveGames().length !== 2) {
      gameLogger.debug("Start attempt but not enough players", {
        gameCount: gameManager.getActiveGames().length,
      });
      return res.status(400).json({ error: "Need exactly 2 games to start" });
    }

    if (gameManager.startGames()) {
      const games = gameManager.getActiveGames().map((game) => ({
        id: game.id,
        players: game.players.map((p) => ({ id: p.id, name: p.name })),
        gameState: game.gameState,
        pot: game.pot,
        currentPlayerIndex: game.currentPlayer,
        communityCards: game.communityCards,
        createdAt: new Date().toISOString(),
      }));
      gameLogger.gameStarted(games);
      res.json({ message: "Games started successfully" });
    } else {
      gameLogger.debug("Start attempt failed");
      res.status(400).json({ error: "Could not start games" });
    }
  } catch (error) {
    gameLogger.error("Error in /start endpoint", error);
    res.status(500).json({ error: "Server error starting games" });
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
router.post("/new-game", authenticateApiKey, (req, res) => {
  try {
    // Log the old game ID if it exists
    if (gameManager.hasActiveGames()) {
      gameLogger.debug("Replacing existing games", {
        gameIds: gameManager.getActiveGames().map((g) => g.id),
      });
    }

    const newGame = gameManager.createNewGames();
    if (!newGame) {
      return res.status(400).json({ error: "Could not create new game" });
    }

    res.json({
      message: "New game created. Players can now join.",
      game: {
        id: newGame.id,
        players: [],
        state: "waiting",
        createdAt: new Date().toISOString(),
        maxPlayers: 2,
      },
    });
  } catch (error) {
    gameLogger.error("Error in /new-game endpoint", error);
    res.status(500).json({ error: "Server error creating new games" });
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
router.get("/games", async (req, res) => {
  try {
    const games = await gameManager.getAllGames();
    res.json({ games });
  } catch (error) {
    gameLogger.error("Error getting games:", error);
    res.status(500).json({ error: "Erro ao buscar jogos" });
  }
});

// Rota para listar salas disponíveis
router.get("/available-games", async (req, res) => {
  try {
    // Garantir que existam jogos disponíveis
    await gameManager.ensureAvailableGames();

    const allGames = await gameManager.getAllGames();
    const availableGames = allGames.filter(
      (game) => game.players.length < 2 && game.gameState === "waiting",
    );
    const activeGames = allGames.filter(
      (game) => game.gameState !== "waiting" && game.gameState !== "game_over",
    );
    const finishedGames = allGames.filter((game) => game.gameState === "game_over");

    const games = availableGames.map((game) => ({
      id: game.id,
      players: game.players.map((p) => ({
        // id: p.id, // TODO: add another way of identifying the player, maybe username
        name: p.name,
        isReady: p.isReady,
      })),
      createdAt: new Date().toISOString(),
      state: "available",
      playersNeeded: 2 - game.players.length,
    }));

    res.json({
      games,
      maxGames: gameManager.maxGames,
      currentGames: gameManager.games.size,
      canCreateNew: gameManager.games.size < gameManager.maxGames,
      stats: {
        available: availableGames.length,
        active: activeGames.length,
        finished: finishedGames.length,
        total: allGames.length,
      },
    });
  } catch (error) {
    gameLogger.error("Error getting available games:", error);
    res.status(500).json({ error: "Erro ao buscar jogos disponíveis" });
  }
});

// Rota para obter histórico de jogos
router.get("/game-history", async (req, res) => {
  try {
    const history = await GameHistory.getGameHistory();
    res.json({ history });
  } catch (error) {
    gameLogger.error("Error getting game history:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de jogos" });
  }
});

// Rota para obter estatísticas dos jogos
router.get("/stats", async (req, res) => {
  try {
    const stats = await GameHistory.getGameStats();
    res.json(stats);
  } catch (error) {
    gameLogger.error("Error getting game stats:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

/**
 * @swagger
 * /game/player-game:
 *   get:
 *     summary: Verificar se o jogador está em um jogo
 *     description: Retorna informações sobre o jogo atual do jogador, se existir
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Informações do jogo atual do jogador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inGame:
 *                   type: boolean
 *                   description: Indica se o jogador está em um jogo
 *                 gameId:
 *                   type: string
 *                   description: ID do jogo atual do jogador (se estiver em um jogo)
 *                 game:
 *                   type: object
 *                   description: Detalhes do jogo (se estiver em um jogo)
 *       404:
 *         description: Jogador não encontrado ou não está em nenhum jogo
 */
router.get("/player-game", authenticateApiKey, async (req, res) => {
  try {
    const playerId = req.headers["x-api-key"];

    // Buscar o jogo do jogador diretamente no banco de dados
    const playerGame = await dbAsync.get(
      "SELECT game_id FROM players WHERE id = ? AND game_id IS NOT NULL",
      [playerId],
    );

    if (!playerGame || !playerGame.game_id) {
      return res.json({
        inGame: false,
        message: "Jogador não está em nenhum jogo",
      });
    }

    const gameId = playerGame.game_id;

    // Buscar informações do jogo
    const gameData = await dbAsync.get("SELECT * FROM games WHERE id = ?", [gameId]);

    if (!gameData) {
      return res.json({
        inGame: false,
        message: "Jogo não encontrado no banco de dados",
      });
    }

    // Buscar jogadores do jogo
    const players = await dbAsync.all("SELECT id, name, is_ready FROM players WHERE game_id = ?", [
      gameId,
    ]);

    // Formatar resposta
    return res.json({
      inGame: true,
      gameId: gameId,
      game: {
        id: gameData.id,
        state: gameData.state,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          isReady: p.is_ready === 1,
        })),
        createdAt: gameData.created_at,
      },
    });
  } catch (error) {
    gameLogger.error("Error checking player game:", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Erro ao verificar jogo do jogador" });
  }
});

module.exports = router;
