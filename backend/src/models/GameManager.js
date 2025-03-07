const Game = require("./Game");
const { logger, gameLogger } = require("../utils/logger");
const { dbAsync } = require("../database/config");

class GameManager {
  constructor(maxGames = 5) {
    if (GameManager.instance) {
      return GameManager.instance;
    }

    this.maxGames = maxGames;
    this.games = new Map();
    this.playerGameMap = new Map();
    GameManager.instance = this;
  }

  async initializeGames() {
    try {
      // Load existing games from database
      const games = await dbAsync.all(`
        SELECT g.*, 
          GROUP_CONCAT(p.id) as player_ids,
          GROUP_CONCAT(p.name) as player_names,
          GROUP_CONCAT(p.is_ready) as player_ready_states,
          GROUP_CONCAT(p.chips) as player_chips,
          GROUP_CONCAT(p.current_bet) as player_bets,
          GROUP_CONCAT(p.is_folded) as player_folded
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        GROUP BY g.id
      `);

      // Clear existing games
      this.games.clear();
      this.playerGameMap.clear();

      // Load games into memory
      for (const gameData of games) {
        if (!gameData || !gameData.id) {
          gameLogger.warn("Skipping invalid game data");
          continue;
        }

        const game = new Game();
        game.id = gameData.id;
        game.gameState = gameData.state || "waiting";
        game.pot = parseInt(gameData.pot) || 0;
        game.currentBet = parseInt(gameData.current_bet) || 0;
        game.currentPlayer = parseInt(gameData.current_player_index) || 0;
        game.communityCards = gameData.community_cards ? JSON.parse(gameData.community_cards) : [];
        game.lastAction = gameData.last_action;
        game.lastRaiseAmount = parseInt(gameData.last_raise_amount) || 0;
        game.roundHistory = gameData.round_history ? JSON.parse(gameData.round_history) : [];
        game.finalPot = parseInt(gameData.final_pot) || 0;
        game.finalCommunityCards = gameData.final_community_cards
          ? JSON.parse(gameData.final_community_cards)
          : [];
        game.finalHands = gameData.final_hands ? JSON.parse(gameData.final_hands) : [];

        if (gameData.winner_id) {
          game.isGameOver = true;
          game.winningHand = gameData.winning_hand;
          game.winningHandDescription = gameData.winning_hand_description;
        }

        // Check if there are players for this game
        if (gameData.player_ids && typeof gameData.player_ids === "string") {
          const playerIds = gameData.player_ids.split(",");
          const playerNames = gameData.player_names ? gameData.player_names.split(",") : [];
          const playerReadyStates = gameData.player_ready_states
            ? gameData.player_ready_states.split(",").map((state) => state === "1")
            : [];
          const playerChips = gameData.player_chips
            ? gameData.player_chips.split(",").map((chips) => parseInt(chips) || 1000)
            : [];
          const playerBets = gameData.player_bets
            ? gameData.player_bets.split(",").map((bet) => parseInt(bet) || 0)
            : [];
          const playerFolded = gameData.player_folded
            ? gameData.player_folded.split(",").map((folded) => folded === "1")
            : [];

          for (let i = 0; i < playerIds.length; i++) {
            if (!playerIds[i]) continue;

            const player = {
              id: playerIds[i],
              name: playerNames[i] || `Player ${i + 1}`,
              isReady: playerReadyStates[i] || false,
              chips: playerChips[i] || 1000,
              currentBet: playerBets[i] || 0,
              isFolded: playerFolded[i] || false,
              hand: null, // Hand will be dealt when game starts
            };
            game.players.push(player);
            this.playerGameMap.set(player.id, game.id);
          }
        } else {
          // If there are no players, initialize with empty array
          game.players = [];
        }

        this.games.set(game.id, game);
      }

      // Create new games if needed
      while (this.games.size < this.maxGames) {
        await this.createGame();
      }

      logger.info("Games initialized from database", { count: this.games.size });
    } catch (error) {
      gameLogger.error("Error initializing games:", error);
      throw error;
    }
  }

  async createGame() {
    if (this.games.size >= this.maxGames) {
      return null;
    }

    try {
      const game = new Game();
      await dbAsync.run(
        `
        INSERT INTO games (id, state, pot, current_bet, current_player_index, community_cards)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          game.id,
          game.gameState,
          game.pot,
          game.currentBet,
          game.currentPlayer,
          JSON.stringify(game.communityCards),
        ],
      );

      this.games.set(game.id, game);
      gameLogger.gameCreated(game.id);
      return game;
    } catch (error) {
      gameLogger.error("Error creating game:", error);
      throw error;
    }
  }

  async addPlayerToGame(player, gameId = null) {
    try {
      // Validate that the player exists in api_keys table
      const apiKey = await dbAsync.get("SELECT * FROM api_keys WHERE key = ? AND is_active = 1", [
        player.id,
      ]);

      if (!apiKey) {
        return {
          success: false,
          message: "Invalid or inactive API key",
        };
      }

      // Check if player is already in a game
      const existingGame = await dbAsync.get(
        "SELECT game_id FROM players WHERE id = ? AND game_id IS NOT NULL",
        [player.id],
      );

      if (existingGame) {
        const gameState = await dbAsync.get("SELECT state FROM games WHERE id = ?", [
          existingGame.game_id,
        ]);

        if (gameState && gameState.state !== "game_over") {
          return {
            success: false,
            message: "Player is already in an active game",
            gameId: existingGame.game_id,
          };
        } else {
          // Remove old game association if game is over
          await dbAsync.run("UPDATE players SET game_id = NULL WHERE id = ?", [player.id]);
        }
      }

      let game;
      if (gameId) {
        game = this.games.get(gameId);
        if (!game) {
          return {
            success: false,
            message: "Game not found",
          };
        }
      } else {
        game = await this.getAvailableGame();
        if (!game) {
          return {
            success: false,
            message: "No available games",
          };
        }
      }

      if (game.addPlayer(player)) {
        // Add player to database
        await dbAsync.run(
          `
          INSERT INTO players (id, game_id, name, chips, current_bet, is_ready, is_folded, hand)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            player.id,
            game.id,
            player.name,
            player.chips,
            player.currentBet,
            player.isReady,
            player.isFolded,
            null,
          ],
        );

        // Update last_used_at in api_keys table
        await dbAsync.run("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?", [
          player.id,
        ]);

        this.playerGameMap.set(player.id, game.id);
        gameLogger.playerJoined(game.id, player.id, player.name);
        return {
          success: true,
          message: "Successfully joined the game",
          gameId: game.id,
        };
      }

      return {
        success: false,
        message: "Game is full",
      };
    } catch (error) {
      gameLogger.error("Error adding player to game:", error);
      throw error;
    }
  }

  async getAvailableGame() {
    try {
      // First try to find an available game in memory
      for (const game of this.games.values()) {
        if (game.players.length < 2 && game.gameState === "waiting") {
          return game;
        }
      }

      // If not found in memory, check database
      const availableGame = await dbAsync.get(`
        SELECT g.* FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        WHERE g.state = 'waiting'
        GROUP BY g.id
        HAVING COUNT(p.id) < 2
        LIMIT 1
      `);

      if (availableGame) {
        const game = new Game();
        game.id = availableGame.id;
        game.gameState = availableGame.state;
        game.pot = availableGame.pot;
        game.currentBet = availableGame.current_bet;
        game.currentPlayer = availableGame.current_player_index;
        game.communityCards = availableGame.community_cards
          ? JSON.parse(availableGame.community_cards)
          : [];

        // Load players for this game
        const players = await dbAsync.all(
          `
          SELECT * FROM players
          WHERE game_id = ?
        `,
          [game.id],
        );

        game.players = players.map((p) => ({
          id: p.id,
          name: p.name,
          chips: p.chips,
          currentBet: p.current_bet,
          isReady: p.is_ready === 1,
          isFolded: p.is_folded === 1,
          hand: p.hand ? JSON.parse(p.hand) : null,
        }));

        this.games.set(game.id, game);
        return game;
      }

      // If no available game found and we haven't reached the limit, create a new one
      if (this.games.size < this.maxGames) {
        return await this.createGame();
      }

      return null;
    } catch (error) {
      gameLogger.error("Error getting available game:", error);
      throw error;
    }
  }

  async removeGame(gameId) {
    try {
      const game = this.games.get(gameId);
      if (game) {
        // Remove from database (cascade will handle related records)
        await dbAsync.run("DELETE FROM games WHERE id = ?", [gameId]);

        // Remove from memory
        game.players.forEach((player) => {
          this.playerGameMap.delete(player.id);
        });
        this.games.delete(gameId);
        gameLogger.debug("Game removed", { gameId });
        return true;
      }
      return false;
    } catch (error) {
      gameLogger.error("Error removing game:", error);
      throw error;
    }
  }

  async cleanupFinishedGames() {
    try {
      for (const [gameId, game] of this.games) {
        if (game.isGameOver) {
          // Em vez de remover o jogo, apenas atualize seu estado no banco e libere recursos em memória
          await dbAsync.run(
            "UPDATE games SET state = 'ended', updated_at = CURRENT_TIMESTAMP, final_pot = ?, final_community_cards = ?, final_hands = ? WHERE id = ?",
            [
              game.finalPot || game.pot,
              JSON.stringify(game.finalCommunityCards || game.communityCards),
              JSON.stringify(game.finalHands || []),
              gameId,
            ],
          );

          // Apenas remover da memória, não do banco de dados
          game.players.forEach((player) => {
            this.playerGameMap.delete(player.id);
          });
          this.games.delete(gameId);
          gameLogger.debug("Game ended and resources released", { gameId });
        }
      }
      await this.ensureAvailableGames();
    } catch (error) {
      gameLogger.error("Error cleaning up finished games:", error);
      throw error;
    }
  }

  async getPlayerGame(playerId) {
    try {
      const gameId = this.playerGameMap.get(playerId);
      if (!gameId) return null;

      const game = this.games.get(gameId);
      if (!game) return null;

      // Assegurar que a instância do jogo tenha todos os métodos necessários
      const Player = require("./Player");

      // Log para depuração
      gameLogger.debug("Verificando jogadores antes da conversão", {
        gameId: game.id,
        playerCount: game.players.length,
        playersHaveFold: game.players.map((p) => Boolean(p.fold && typeof p.fold === "function")),
      });

      // Converter os jogadores para instâncias da classe Player caso ainda não sejam
      game.players = game.players.map((p) => {
        // Se já for uma instância de Player com o método fold, retorna o objeto diretamente
        if (p.fold && typeof p.fold === "function") {
          return p;
        }

        // Caso contrário, cria uma nova instância de Player
        const properPlayer = new Player(p.id, p.name);
        properPlayer.chips = p.chips || 1000;
        properPlayer.hand = p.hand || [];
        properPlayer.currentBet = p.currentBet || 0;
        properPlayer.isActive = p.isActive !== undefined ? p.isActive : true;
        properPlayer.isFolded = p.isFolded || false;
        properPlayer.isReady = p.isReady || false;
        return properPlayer;
      });

      // Log após a conversão
      gameLogger.debug("Jogadores após conversão", {
        gameId: game.id,
        playerCount: game.players.length,
        playersHaveFold: game.players.map((p) => Boolean(p.fold && typeof p.fold === "function")),
      });

      return game;
    } catch (error) {
      gameLogger.error("Error getting player game:", error);
      return null;
    }
  }

  async ensureAvailableGames() {
    try {
      const availableGames = Array.from(this.games.values()).filter(
        (game) => game.players.length < 2 && game.gameState === "waiting",
      );

      const neededGames = this.maxGames - availableGames.length;
      for (let i = 0; i < neededGames && this.games.size < this.maxGames; i++) {
        await this.createGame();
      }

      return availableGames;
    } catch (error) {
      gameLogger.error("Error ensuring available games:", error);
      throw error;
    }
  }

  async getAllGames() {
    try {
      const games = await dbAsync.all(`
        SELECT g.*, 
          GROUP_CONCAT(p.id) as player_ids,
          GROUP_CONCAT(p.name) as player_names,
          GROUP_CONCAT(p.is_ready) as player_ready_states,
          GROUP_CONCAT(p.chips) as player_chips,
          GROUP_CONCAT(p.current_bet) as player_bets,
          GROUP_CONCAT(p.is_folded) as player_folded
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        WHERE g.state != 'ended'
        GROUP BY g.id
      `);

      return games.map((game) => ({
        id: game.id,
        players: game.player_ids
          ? game.player_ids.split(",").map((id, index) => ({
              id: id,
              name: game.player_names
                ? game.player_names.split(",")[index] || `Player ${index + 1}`
                : `Player ${index + 1}`,
              chips: game.player_chips
                ? parseInt(game.player_chips.split(",")[index]) || 1000
                : 1000,
              isReady: game.player_ready_states
                ? game.player_ready_states.split(",")[index] === "1"
                : false,
              currentBet: game.player_bets ? parseInt(game.player_bets.split(",")[index]) || 0 : 0,
              isFolded: game.player_folded ? game.player_folded.split(",")[index] === "1" : false,
            }))
          : [],
        gameState: game.state,
        pot: game.pot || 0,
        currentBet: game.current_bet || 0,
        currentPlayer: game.current_player_index || 0,
        communityCards: game.community_cards ? JSON.parse(game.community_cards) : [],
        isGameOver: game.state === "ended",
      }));
    } catch (error) {
      gameLogger.error("Error getting all games:", error);
      throw error;
    }
  }

  hasActiveGames() {
    return this.games.size > 0;
  }

  getActiveGames() {
    return Array.from(this.games.values()).filter(
      (game) => game.gameState !== "waiting" && game.gameState !== "game_over",
    );
  }
}

module.exports = GameManager;
