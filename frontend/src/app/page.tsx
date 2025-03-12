"use client";

import { useNewGame } from "@/hooks/useNewGame";
import { ChipCasinoIcon } from "@/icons/ChipCasinoIcon";
import { useRouter } from "next/navigation";

export default function Home() {
  const { fetchNewGame } = useNewGame();
  const { push } = useRouter();

  const handlePlayNow = async () => {
    await fetchNewGame();
    push("/login");
  };

  return (
    <section className="flex flex-col min-h-screen w-full">
      <div className="pt-32 pb-12 md:pt-40 md:pb-20">
        <div className="px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
            <h1 className="font-inter-tight text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-zinc-500 via-zinc-900 to-zinc-900 pb-4">
              Play Poker Ai Online
            </h1>
            <p className="text-lg text-zinc-500">
              Earn money, training your Ai, try now
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full items-center">
        <button className="btn-2 " onClick={handlePlayNow}>
          Play Now
        </button>
      </div>
    </section>
  );
}
