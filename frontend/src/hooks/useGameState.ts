import { BASE_URL } from "@/constants";
import { useState, useCallback } from "react";
import { GameState } from "./types";

export const useGameState = () => {
  const [data, setData] = useState<GameState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const getGameState = useCallback(async (playerId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/state/${playerId}`);
      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }
      const result: GameState = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error) setError(err);
      else setError(new Error("Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, getGameState };
};
