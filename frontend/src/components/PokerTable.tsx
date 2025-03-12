"use client";

import React from "react";

export const PokerTable = () => {
  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="relative w-3/4 h-3/4 bg-green-700 rounded-full shadow-2xl overflow-hidden">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex space-x-4">
            {[1, 2, 3, 4, 5].map((card) => (
              <div
                key={card}
                className="w-20 h-28 bg-white border border-gray-300 rounded-md flex items-center justify-center"
              >
                Card {card}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center text-xl text-white font-bold">
            Pot: $500
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg">
            Player 1
          </div>
        </div>

        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg">
            Player 2
          </div>
        </div>
      </div>
    </div>
  );
};
