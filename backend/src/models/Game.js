const Deck = require("./Deck");
const { v4: uuidv4 } = require("uuid");
const HandEvaluator = require("./HandEvaluator");
const { dbAsync } = require("../database/config");
const { gameLogger } = require("../utils/logger");

class Game {
  constructor() {
    this.id = uuidv4();
    this.players = [];
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentPlayer = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.currentBet = 0;
    this.gameState = "waiting"; // waiting, preflop, flop, turn, river, showdown
    this.roundStates = ["preflop", "flop", "turn", "river", "showdown"];
    this.lastAction = null;
    this.lastRaiseAmount = 0;
    this.winner = null;
    this.winningHand = null;
    this.isGameOver = false;
    this.playersActed = 0; // Add this to track number of actions in current betting round
    this.bettingRoundComplete = false; // Add this to track if betting round is complete
    this.winningHandDescription = null;
    this.finalHands = [];
    this.finalCommunityCards = [];
    this.roundHistory = []; // Add this to track round history
    this.finalPot = 0; // Should never be reseted
  }

  addPlayer(player) {
    if (this.players.length < 2) {
      this.players.push(player);
      return true;
    }
    return false;
  }

  startGame() {
    if (this.players.length !== 2) {
      return false;
    }

    // Check if both players are ready
    if (!this.players.every((p) => p.isReady)) {
      return false;
    }

    // Log original game state
    console.log(`Game ${this.id}: Changing state from ${this.gameState} to preflop`);

    this.gameState = "preflop";
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.isGameOver = false;
    this.winner = null;
    this.winningHand = null;
    this.playersActed = 0; // Initialize players acted

    // Log confirmation of state change
    console.log(`Game ${this.id}: State is now ${this.gameState}`);

    // Deal cards to players
    this.players.forEach((player) => {
      player.resetHand();
      player.receiveCard(this.deck.deal());
      player.receiveCard(this.deck.deal());
    });

    // Handle blinds
    this.players[0].placeBet(this.smallBlind);
    this.players[1].placeBet(this.bigBlind);
    this.pot = this.smallBlind + this.bigBlind;
    this.currentBet = this.bigBlind;

    return true;
  }

  getGameState(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;

    const baseState = {
      gameId: this.id,
      pot: this.pot,
      smallBlind: {
        amount: this.smallBlind,
        player: this.players[0]?.name || "Unknown",
      },
      bigBlind: {
        amount: this.bigBlind,
        player: this.players[1]?.name || "Unknown",
      },
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayer,
      currentPlayerName: this.players[this.currentPlayer]?.name || "Unknown",
      players: this.players.map((p) => ({
        name: p.name,
        id: p.id,
        index: this.players.indexOf(p),
      })),
      gameState: this.gameState,
      readyPlayers: this.players.filter((p) => p.isReady).length,
      totalPlayers: this.players.length,
      roundHistory: this.roundHistory, // Add round history to game state
    };

    if (this.isGameOver) {
      return {
        ...baseState,
        isGameOver: true,
        winner: this.winner
          ? {
              name: this.winner.name,
              id: this.winner.id,
              chips: this.winner.chips,
            }
          : null,
        winningHand: this.winningHand,
        handDescription: this.winningHandDescription,
        finalCommunityCards: this.finalCommunityCards,
        allHands: this.finalHands,
        roundHistory: this.roundHistory,
        finalPot: this.finalPot,
      };
    }

    // During active game, only show player's own hand
    return {
      ...baseState,
      playerHand: player.hand,
      playerChips: player.chips,
      isGameOver: false,
    };
  }

  handleAction(playerId, action, amount = 0) {
    if (this.isGameOver) {
      return { success: false, message: "Game is over. Start a new game to continue playing." };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: "Player not found" };

    if (this.players[this.currentPlayer].id !== playerId) {
      return { success: false, message: "Not your turn" };
    }

    // Add check for showdown state
    if (this.gameState === "showdown") {
      this.determineWinner();
      return {
        success: true,
        message: "Game is over, winner has been determined",
      };
    }

    // Registra a ação no histórico de rodadas em memória
    const roundAction = {
      playerId,
      playerName: player.name,
      action: action.toLowerCase(),
      amount: action.toLowerCase() === "raise" ? amount : this.currentBet - player.currentBet,
      state: this.gameState,
      timestamp: new Date().toISOString(),
    };

    this.roundHistory.push(roundAction);

    switch (action.toLowerCase()) {
      case "fold":
        player.fold();
        this.lastAction = "fold";
        this.playersActed++;
        this.nextTurn();
        return { success: true, message: "Player folded", roundAction };

      case "call":
        const callAmount = this.currentBet - player.currentBet;
        if (!player.placeBet(callAmount)) {
          return { success: false, message: "Not enough chips" };
        }
        this.pot += callAmount;
        this.lastAction = "call";
        this.playersActed++;
        this.nextTurn();
        return { success: true, message: "Call successful", roundAction };

      case "raise":
        if (amount < this.currentBet * 2) {
          return { success: false, message: "Raise must be at least double the current bet" };
        }
        if (!player.placeBet(amount)) {
          return { success: false, message: "Not enough chips" };
        }
        this.pot += amount;
        this.currentBet = amount;
        this.lastAction = "raise";
        this.lastRaiseAmount = amount;
        this.playersActed = 1; // Reset players acted when someone raises
        this.nextTurn();
        return { success: true, message: "Raise successful", roundAction };

      default:
        return { success: false, message: "Invalid action" };
    }
  }

  nextTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % 2;

    // Check if round is complete
    if (this.shouldAdvanceRound()) {
      this.advanceRound();
    }
  }

  shouldAdvanceRound() {
    // If someone folded, advance the round
    const activePlayers = this.players.filter((p) => !p.isFolded);
    if (activePlayers.length === 1) return true;

    // Check if all players have acted and bets are equal
    const betsAreEqual = this.players[0].currentBet === this.players[1].currentBet;
    const allPlayersActed = this.playersActed >= 2;

    // If we're at showdown and conditions are met, determine winner
    if (this.gameState === "showdown" && betsAreEqual && allPlayersActed) {
      this.determineWinner();
      return false; // Don't advance round, game is over
    }

    return betsAreEqual && allPlayersActed;
  }

  advanceRound() {
    const currentIndex = this.roundStates.indexOf(this.gameState);
    if (currentIndex < this.roundStates.length - 1) {
      this.gameState = this.roundStates[currentIndex + 1];
      this.lastAction = null;
      this.currentBet = 0;
      this.playersActed = 0; // Reset players acted for new round
      this.players.forEach((p) => (p.currentBet = 0));

      // Deal community cards based on the round
      switch (this.gameState) {
        case "flop":
          this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
          break;
        case "turn":
        case "river":
          this.communityCards.push(this.deck.deal());
          break;
        case "showdown":
          this.determineWinner();
          break;
      }
    }
  }

  determineWinner() {
    if (this.players[0].isFolded) {
      this.handleWinner(this.players[1], "Opponent folded");
      return;
    }
    if (this.players[1].isFolded) {
      this.handleWinner(this.players[0], "Opponent folded");
      return;
    }

    const hand1 = HandEvaluator.evaluateHand(this.players[0].hand, this.communityCards);
    const hand2 = HandEvaluator.evaluateHand(this.players[1].hand, this.communityCards);

    let winner;
    let winningHand;
    if (hand1.rank > hand2.rank) {
      winner = this.players[0];
      winningHand = hand1;
    } else if (hand2.rank > hand1.rank) {
      winner = this.players[1];
      winningHand = hand2;
    } else {
      // If ranks are equal, compare values
      if (hand1.value > hand2.value) {
        winner = this.players[0];
        winningHand = hand1;
      } else if (hand2.value > hand1.value) {
        winner = this.players[1];
        winningHand = hand2;
      } else {
        // Compare kickers if necessary
        const kicker1 = Math.max(...hand1.kickers);
        const kicker2 = Math.max(...hand2.kickers);
        winner = kicker1 >= kicker2 ? this.players[0] : this.players[1];
        winningHand = kicker1 >= kicker2 ? hand1 : hand2;
      }
    }

    this.handleWinner(winner, winningHand);
  }

  handleWinner(winner, handEvaluation) {
    this.winner = winner;

    // Verifica se handEvaluation é uma string (caso de fold) ou um objeto (avaliação de mão)
    if (typeof handEvaluation === "string") {
      this.winningHand = "fold";
      this.winningHandDescription = handEvaluation;
    } else {
      this.winningHand = handEvaluation.handName;
      this.winningHandDescription = handEvaluation.description;
    }

    // Store final hands before clearing them
    this.finalHands = this.players.map((p) => ({
      name: p.name,
      id: p.id,
      hand: [...p.hand],
      chips: p.chips, // Include chips in final hands
      currentBet: p.currentBet,
      isFolded: p.isFolded,
    }));

    // Store final community cards and pot
    this.finalCommunityCards = [...this.communityCards];
    this.finalPot = this.pot; // Store the final pot amount BEFORE clearing it

    // Registrar resultado final no histórico de rodadas em memória
    const finalAction = {
      playerId: winner.id,
      playerName: winner.name,
      action: "win",
      amount: this.pot,
      state: "game_over",
      timestamp: new Date().toISOString(),
      winningHand: this.winningHand,
      winningHandDescription: this.winningHandDescription,
    };

    this.roundHistory.push(finalAction);

    winner.chips += this.pot; // Update winner's chips
    this.pot = 0; // Clear the pot AFTER storing finalPot
    this.gameState = "game_over";
    this.isGameOver = true;
  }

  static async getAllGames() {
    try {
      const games = await dbAsync.all(
        `SELECT g.*, 
          GROUP_CONCAT(DISTINCT p.id) as player_ids,
          GROUP_CONCAT(DISTINCT p.name) as player_names,
          GROUP_CONCAT(DISTINCT p.chips) as player_chips,
          GROUP_CONCAT(DISTINCT p.is_ready) as player_ready,
          GROUP_CONCAT(DISTINCT p.current_bet) as player_bets,
          GROUP_CONCAT(DISTINCT p.is_folded) as player_folded
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        WHERE g.state != 'ended'
        GROUP BY g.id`,
      );

      return games.map((game) => ({
        id: game.id,
        players: game.player_ids
          ? game.player_ids.split(",").map((id, index) => ({
              id: id,
              name: game.player_names
                ? game.player_names.split(",")[index] || `Player ${index + 1}`
                : `Player ${index + 1}`,
              chips: game.player_chips ? parseInt(game.player_chips.split(",")[index]) || 0 : 0,
              isReady: game.player_ready_states
                ? game.player_ready_states.split(",")[index] === "1"
                : false,
              currentBet: game.player_bets ? parseInt(game.player_bets.split(",")[index]) || 0 : 0,
              isFolded: game.player_folded ? game.player_folded.split(",")[index] === "1" : false,
            }))
          : [],
        gameState: game.state,
        pot: game.pot,
        isGameOver: game.status === "ended",
        lastUpdateTime: game.last_update,
        currentBet: game.current_bet,
        lastAction: game.last_action,
        lastRaiseAmount: game.last_raise_amount,
        currentPlayerIndex: game.current_player,
        communityCards: JSON.parse(game.community_cards || "[]"),
        roundHistory: JSON.parse(game.round_history || "[]"),
        winner: game.winner_id
          ? {
              id: game.winner_id,
              name: game.winner_name,
              winningHand: game.winning_hand,
              handDescription: game.winning_hand_description,
            }
          : null,
        finalHands: JSON.parse(game.final_hands || "[]"),
        finalCommunityCards: JSON.parse(game.final_community_cards || "[]"),
        finalPot: game.final_pot,
      }));
    } catch (error) {
      gameLogger.error("Error getting all games:", error);
      return [];
    }
  }
}

module.exports = Game;
