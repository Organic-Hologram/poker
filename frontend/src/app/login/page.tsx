"use client";

import { JoinGameForms } from "@/components/JoinGameForms";
import { useGameContext } from "@/contexts/GameContext";
// import { PokerTable } from "@/components/PokerTable";

export default function Home() {
  const { newGame } = useGameContext();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {newGame && <JoinGameForms />}
      {/* <div className="bg-red-500 w-full">
        <PokerTable />
      </div> */}
    </div>
  );
}
