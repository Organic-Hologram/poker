import { BASE_URL } from "@/constants";
import { useState, useCallback } from "react";
import { ReadyResponse } from "./types";

export const useReady = () => {
  const [data, setData] = useState<ReadyResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReady = useCallback(async (playerId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/ready/${playerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }
      const result: ReadyResponse = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error) setError(err);
      else setError(new Error("Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, fetchReady };
};
