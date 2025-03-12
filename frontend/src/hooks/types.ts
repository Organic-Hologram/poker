export type Card = string;

export interface RoundResult {
  number: number;
  results: number[];
}

export interface GameState {
  gameId: string;
  pot: number;
  smallBlind: {
    amount: number;
    player: string;
  };
  bigBlind: {
    amount: number;
    player: string;
  };
  communityCards: Card[];
  currentBet: number;
  currentPlayerIndex: number;
  currentPlayerName: string;
  players: {
    name: string;
    id: string;
    index: number;
  }[];
  gameState:
    | "waiting"
    | "preflop"
    | "flop"
    | "turn"
    | "river"
    | "showdown"
    | "game_over";
  readyPlayers: number;
  totalPlayers: number;
  roundHistory: RoundResult[];
  playerHand: Card[];
  playerChips: number;
  isGameOver: boolean;
  winner?: {
    name: string;
    id: string;
    chips: number;
  };
  winningHand?: string;
  handDescription?: string;
  finalCommunityCards?: Card[];
  allHands?: Array<{
    name: string;
    id: string;
    hand: Card[];
    chips: number;
  }>;
  finalPot?: number;
}

export interface JoinResponse {
  playerId: string;
  gameId: string;
  message: string;
}

export interface MoveResponse {
  message: string;
  gameState: GameState;
}

export interface StartResponse {
  message: string;
}

export interface NewGameResponse {
  message: string;
}

export interface ReadyResponse {
  message: string;
  gameState?: GameState;
  readyCount?: number;
  requiredPlayers?: number;
}
