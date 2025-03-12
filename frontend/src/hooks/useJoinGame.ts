import { BASE_URL } from "@/constants";
import { useState, useCallback } from "react";
import { JoinResponse } from "./types";

export const useJoinGame = () => {
  const [data, setData] = useState<JoinResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const joinGame = useCallback(async (playerName: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
      });
      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }
      const result: JoinResponse = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error) setError(err);
      else setError(new Error("Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, joinGame };
};
