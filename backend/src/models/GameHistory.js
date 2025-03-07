const { dbAsync } = require("../database/config");
const { logger } = require("../utils/logger");

class GameHistory {
  static async getGameHistory(limit = 100) {
    try {
      const games = await dbAsync.all(
        `
                SELECT 
                    g.*,
                    p.id as player_id,
                    p.name as player_name,
                    p.chips as player_chips,
                    p.is_folded,
                    rh.action,
                    rh.amount,
                    rh.created_at as action_time
                FROM games g
                LEFT JOIN players p ON g.id = p.game_id
                LEFT JOIN round_history rh ON g.id = rh.game_id AND p.id = rh.player_id
                WHERE g.state = 'ended' OR g.state = 'game_over'
                ORDER BY g.updated_at DESC
                LIMIT ?
            `,
        [limit],
      );

      // Agrupar jogadores e ações por jogo
      const gameMap = new Map();
      games.forEach((row) => {
        if (!gameMap.has(row.id)) {
          gameMap.set(row.id, {
            id: row.id,
            state: row.state,
            pot: row.pot,
            finalPot: row.final_pot,
            winnerId: row.winner_id,
            winningHand: row.winning_hand,
            winningHandDescription: row.winning_hand_description,
            finalCommunityCards: row.final_community_cards
              ? JSON.parse(row.final_community_cards)
              : [],
            finalHands: row.final_hands ? JSON.parse(row.final_hands) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            players: [],
            roundHistory: [],
          });
        }

        const game = gameMap.get(row.id);

        // Adicionar jogador se não existir
        if (row.player_id && !game.players.find((p) => p.id === row.player_id)) {
          game.players.push({
            id: row.player_id,
            name: row.player_name,
            chips: row.player_chips,
            isFolded: row.is_folded,
            isWinner: row.player_id === row.winner_id,
          });
        }

        // Adicionar ação se existir
        if (row.action) {
          game.roundHistory.push({
            playerId: row.player_id,
            playerName: row.player_name,
            action: row.action,
            amount: row.amount,
            timestamp: row.action_time,
          });
        }
      });

      return Array.from(gameMap.values());
    } catch (error) {
      logger.error("Error getting game history:", error);
      return [];
    }
  }

  static async getGameStats() {
    try {
      const stats = await dbAsync.get(`
                SELECT 
                    COUNT(*) as total_games,
                    SUM(CASE WHEN state = 'game_over' THEN 1 ELSE 0 END) as completed_games,
                    MAX(final_pot) as biggest_pot,
                    AVG(julianday(updated_at) - julianday(created_at)) * 24 * 60 * 60 as avg_game_duration
                FROM games
            `);

      return {
        totalGames: stats.total_games || 0,
        completedGames: stats.completed_games || 0,
        biggestPot: stats.biggest_pot || 0,
        averageGameDuration: Math.round(stats.avg_game_duration || 0),
      };
    } catch (error) {
      logger.error("Error getting game stats:", error);
      return {
        totalGames: 0,
        completedGames: 0,
        biggestPot: 0,
        averageGameDuration: 0,
      };
    }
  }
}

module.exports = GameHistory;
