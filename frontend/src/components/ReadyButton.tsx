"use client";

import React from "react";
import { useReady } from "@/hooks/useReady";

interface ReadyButtonProps {
  playerId: string;
}

export const ReadyButton = ({ playerId }: ReadyButtonProps) => {
  const { fetchReady, data: ready, error, loading } = useReady();

  const handleReady = async () => {
    await fetchReady(playerId);
  };

  return (
    <div className="flex flex-col items-center">
      <button className="btn " onClick={handleReady} disabled={loading}>
        {loading ? "Loading..." : "Ready"}
      </button>
      {error && (
        <span className="text-red-500 text-sm mt-1">
          Error: {error.message}
        </span>
      )}
      {ready && (
        <span className="text-green-500 text-sm mt-1">{ready.message}</span>
      )}
    </div>
  );
};
