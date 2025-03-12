"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { NewGameResponse } from "@/hooks/types";

interface GameContextProps {
  newGame: NewGameResponse | null;
  setNewGame: (game: NewGameResponse | null) => void;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [newGame, setNewGame] = useState<NewGameResponse | null>(null);

  return (
    <GameContext.Provider value={{ newGame, setNewGame }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
};
