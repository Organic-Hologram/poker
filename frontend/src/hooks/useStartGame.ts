import { BASE_URL } from "@/constants";
import { useState, useCallback } from "react";
import { StartResponse } from "./types";

export const useStartGame = () => {
  const [data, setData] = useState<StartResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const startGame = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }
      const result: StartResponse = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error) setError(err);
      else setError(new Error("Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, startGame };
};
