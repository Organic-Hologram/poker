"use client";

import { FormEvent, useState } from "react";
import { useJoinGame } from "@/hooks/useJoinGame";
import { ReadyButton } from "./ReadyButton";

interface PlayerJoinFormProps {
  playerNumber: number;
  onJoin: (playerName: string) => void;
  loading: boolean;
  error: Error | null;
  joinData: {
    gameId: string;
    playerId: string;
    message: string;
  } | null;
}

const PlayerJoinForm = ({
  playerNumber,
  onJoin,
  loading,
  error,
  joinData,
}: PlayerJoinFormProps) => {
  const [playerName, setPlayerName] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onJoin(playerName.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 p-4 border rounded shadow-md"
    >
      <label htmlFor={`playerName-${playerNumber}`} className="font-bold">
        Player Name {playerNumber}:
      </label>
      <input
        type="text"
        id={`playerName-${playerNumber}`}
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Type your name"
        className="border border-gray-300 p-2 rounded"
      />
      <button type="submit" disabled={loading} className="btn">
        {loading ? "Joining..." : "Join Game"}
      </button>
      {error && <p className="text-red-500">Erro: {error.message}</p>}
      {joinData && (
        <div className="mt-2 text-green-700">
          <p>Welcome, {playerName}!</p>
          <p>Game ID: {joinData.gameId}</p>
          <p>Player ID: {joinData.playerId}</p>
        </div>
      )}
    </form>
  );
};

export const JoinGameForms = () => {
  const player1 = useJoinGame();
  const player2 = useJoinGame();

  return (
    <div className="flex flex-col gap-10 items-center">
      <h1 className="text-2xl font-bold">Join Game</h1>
      <div className="flex gap-4">
        <PlayerJoinForm
          playerNumber={1}
          onJoin={player1.joinGame}
          loading={player1.loading}
          error={player1.error}
          joinData={player1.data}
        />
        <PlayerJoinForm
          playerNumber={2}
          onJoin={player2.joinGame}
          loading={player2.loading}
          error={player2.error}
          joinData={player2.data}
        />
      </div>
      {player1.data && player2.data && (
        <>
          <p className="text-green-600 font-semibold">
            Game is full. 2 Players Connected.
          </p>
          <div className="flex justify-between w-full ">
            <ReadyButton playerId={player1.data.playerId} />
            <ReadyButton playerId={player2.data.playerId} />
          </div>
        </>
      )}
    </div>
  );
};
