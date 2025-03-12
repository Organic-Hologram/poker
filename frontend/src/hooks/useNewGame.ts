import useSWRMutation from "swr/mutation";
import { BASE_URL } from "@/constants";
import { NewGameResponse } from "@/hooks/types";
import { useGameContext } from "@/contexts/GameContext";

const newGameFetcher = async (url: string): Promise<NewGameResponse> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Error: ${res.statusText}`);
  }
  return res.json();
};

export const useNewGame = () => {
  const { setNewGame } = useGameContext();
  const { trigger, data, error, isMutating } = useSWRMutation<
    NewGameResponse,
    Error,
    string
  >(`${BASE_URL}/new-game`, newGameFetcher);

  const fetchNewGame = async (): Promise<void> => {
    const result = await trigger();
    if (result) {
      setNewGame(result);
    }
  };

  return { data, error, loading: isMutating, fetchNewGame };
};
