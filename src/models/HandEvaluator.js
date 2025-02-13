class HandEvaluator {
  static HAND_RANKINGS = {
    ROYAL_FLUSH: 10,
    STRAIGHT_FLUSH: 9,
    FOUR_OF_A_KIND: 8,
    FULL_HOUSE: 7,
    FLUSH: 6,
    STRAIGHT: 5,
    THREE_OF_A_KIND: 4,
    TWO_PAIR: 3,
    ONE_PAIR: 2,
    HIGH_CARD: 1,
  };

  static CARD_VALUES = {
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };

  static evaluateHand(playerCards, communityCards) {
    const allCards = [...playerCards, ...communityCards];
    const result = {
      rank: 0,
      handName: "",
      value: 0,
      kickers: [],
      description: "",
    };

    // Check hands from highest to lowest ranking
    if (this.isRoyalFlush(allCards)) {
      result.rank = this.HAND_RANKINGS.ROYAL_FLUSH;
      result.handName = "Royal Flush";
      result.description = "Five cards of the same suit in sequence from 10 to Ace";
    } else if (this.isStraightFlush(allCards)) {
      result.rank = this.HAND_RANKINGS.STRAIGHT_FLUSH;
      result.handName = "Straight Flush";
      result.value = this.getStraightFlushValue(allCards);
      result.description = "Five cards of the same suit in sequence";
    } else if (this.isFourOfAKind(allCards)) {
      result.rank = this.HAND_RANKINGS.FOUR_OF_A_KIND;
      result.handName = "Four of a Kind";
      const { value, kickers, description } = this.getFourOfAKindValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else if (this.isFullHouse(allCards)) {
      result.rank = this.HAND_RANKINGS.FULL_HOUSE;
      result.handName = "Full House";
      const { value, kickers, description } = this.getFullHouseValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else if (this.isFlush(allCards)) {
      result.rank = this.HAND_RANKINGS.FLUSH;
      result.handName = "Flush";
      const { value, kickers, description } = this.getFlushValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else if (this.isStraight(allCards)) {
      result.rank = this.HAND_RANKINGS.STRAIGHT;
      result.handName = "Straight";
      result.value = this.getStraightValue(allCards);
      result.description = "Five cards in sequence";
    } else if (this.isThreeOfAKind(allCards)) {
      result.rank = this.HAND_RANKINGS.THREE_OF_A_KIND;
      result.handName = "Three of a Kind";
      const { value, kickers, description } = this.getThreeOfAKindValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else if (this.isTwoPair(allCards)) {
      result.rank = this.HAND_RANKINGS.TWO_PAIR;
      result.handName = "Two Pair";
      const { value, kickers, description } = this.getTwoPairValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else if (this.isOnePair(allCards)) {
      result.rank = this.HAND_RANKINGS.ONE_PAIR;
      result.handName = "One Pair";
      const { value, kickers, description } = this.getOnePairValue(allCards);
      result.value = value;
      result.kickers = kickers;
      result.description = description;
    } else {
      result.rank = this.HAND_RANKINGS.HIGH_CARD;
      result.handName = "High Card";
      result.value = this.getHighCardValue(allCards);
      result.description = `Highest card: ${this.getRankName(result.value)}`;
    }

    return result;
  }

  static getCardValue(card) {
    return this.CARD_VALUES[card.rank];
  }

  static getCardCounts(cards) {
    const counts = {};
    cards.forEach((card) => {
      counts[card.rank] = (counts[card.rank] || 0) + 1;
    });
    return counts;
  }

  static getSuitCounts(cards) {
    const counts = {};
    cards.forEach((card) => {
      counts[card.suit] = (counts[card.suit] || 0) + 1;
    });
    return counts;
  }

  static isRoyalFlush(cards) {
    const flush = this.isFlush(cards);
    if (!flush) return false;

    const straightFlush = this.isStraightFlush(cards);
    if (!straightFlush) return false;

    const values = cards.map((card) => this.getCardValue(card));
    return Math.max(...values) === this.CARD_VALUES["A"];
  }

  static isStraightFlush(cards) {
    const flush = this.isFlush(cards);
    return flush && this.isStraight(cards);
  }

  static isFourOfAKind(cards) {
    const counts = this.getCardCounts(cards);
    return Object.values(counts).includes(4);
  }

  static isFullHouse(cards) {
    const counts = this.getCardCounts(cards);
    const values = Object.values(counts);
    return values.includes(3) && values.includes(2);
  }

  static isFlush(cards) {
    const suits = this.getSuitCounts(cards);
    return Object.values(suits).some((count) => count >= 5);
  }

  static isStraight(cards) {
    const values = [...new Set(cards.map((card) => this.getCardValue(card)))].sort((a, b) => a - b);
    for (let i = 0; i <= values.length - 5; i++) {
      if (values[i + 4] - values[i] === 4) return true;
    }
    return false;
  }

  static isThreeOfAKind(cards) {
    const counts = this.getCardCounts(cards);
    return Object.values(counts).includes(3);
  }

  static isTwoPair(cards) {
    const counts = this.getCardCounts(cards);
    return Object.values(counts).filter((count) => count === 2).length === 2;
  }

  static isOnePair(cards) {
    const counts = this.getCardCounts(cards);
    return Object.values(counts).includes(2);
  }

  // Helper methods for getting hand values
  static getHighCardValue(cards) {
    return Math.max(...cards.map((card) => this.getCardValue(card)));
  }

  static getStraightFlushValue(cards) {
    const values = cards.map((card) => this.getCardValue(card)).sort((a, b) => a - b);
    for (let i = values.length - 1; i >= 4; i--) {
      if (values[i] - values[i - 4] === 4) {
        return values[i]; // Return highest card of straight flush
      }
    }
    return 0;
  }

  static getFourOfAKindValue(cards) {
    const counts = this.getCardCounts(cards);
    let fourKindRank;
    let kicker = 0;

    for (const [rank, count] of Object.entries(counts)) {
      if (count === 4) {
        fourKindRank = this.CARD_VALUES[rank];
      } else {
        kicker = Math.max(kicker, this.CARD_VALUES[rank]);
      }
    }

    return {
      value: fourKindRank,
      kickers: [kicker],
      description: `Four ${this.getRankName(fourKindRank)}s with a ${this.getRankName(kicker)} kicker`,
    };
  }

  static getFullHouseValue(cards) {
    const counts = this.getCardCounts(cards);
    let threeKindRank = 0;
    let pairRank = 0;

    for (const [rank, count] of Object.entries(counts)) {
      const value = this.CARD_VALUES[rank];
      if (count === 3) {
        threeKindRank = Math.max(threeKindRank, value);
      } else if (count === 2) {
        pairRank = Math.max(pairRank, value);
      }
    }

    return {
      value: threeKindRank,
      kickers: [pairRank],
      description: `Three ${this.getRankName(threeKindRank)}s with a pair of ${this.getRankName(pairRank)}s`,
    };
  }

  static getFlushValue(cards) {
    const suits = this.getSuitCounts(cards);
    const flushSuit = Object.entries(suits).find(([_, count]) => count >= 5)[0];

    const flushCards = cards
      .filter((card) => card.suit === flushSuit)
      .map((card) => this.getCardValue(card))
      .sort((a, b) => b - a)
      .slice(0, 5);

    return {
      value: flushCards[0],
      kickers: flushCards.slice(1),
      description: `${this.getRankName(flushCards[0])}-high flush in ${flushSuit}`,
    };
  }

  static getStraightValue(cards) {
    const values = [...new Set(cards.map((card) => this.getCardValue(card)))].sort((a, b) => a - b);
    for (let i = values.length - 1; i >= 4; i--) {
      if (values[i] - values[i - 4] === 4) {
        return values[i]; // Return highest card of straight
      }
    }
    return 0;
  }

  static getThreeOfAKindValue(cards) {
    const counts = this.getCardCounts(cards);
    let threeKindRank;
    const kickers = [];

    for (const [rank, count] of Object.entries(counts)) {
      const value = this.CARD_VALUES[rank];
      if (count === 3) {
        threeKindRank = value;
      } else {
        kickers.push(value);
      }
    }

    kickers.sort((a, b) => b - a);
    return {
      value: threeKindRank,
      kickers: kickers.slice(0, 2),
      description: `Three ${this.getRankName(threeKindRank)}s with ${this.getRankName(kickers[0])} and ${this.getRankName(kickers[1])} kickers`,
    };
  }

  static getTwoPairValue(cards) {
    const counts = this.getCardCounts(cards);
    const pairs = [];
    const kickers = [];

    for (const [rank, count] of Object.entries(counts)) {
      const value = this.CARD_VALUES[rank];
      if (count === 2) {
        pairs.push(value);
      } else {
        kickers.push(value);
      }
    }

    pairs.sort((a, b) => b - a);
    kickers.sort((a, b) => b - a);
    return {
      value: pairs[0],
      kickers: [pairs[1], ...kickers.slice(0, 1)],
      description: `Pair of ${this.getRankName(pairs[0])}s and ${this.getRankName(pairs[1])}s with a ${this.getRankName(kickers[0])} kicker`,
    };
  }

  static getOnePairValue(cards) {
    const counts = this.getCardCounts(cards);
    let pairRank;
    const kickers = [];

    for (const [rank, count] of Object.entries(counts)) {
      const value = this.CARD_VALUES[rank];
      if (count === 2) {
        pairRank = value;
      } else {
        kickers.push(value);
      }
    }

    kickers.sort((a, b) => b - a);
    return {
      value: pairRank,
      kickers: kickers.slice(0, 3),
      description: `Pair of ${this.getRankName(pairRank)}s with ${this.getRankName(kickers[0])}, ${this.getRankName(kickers[1])}, ${this.getRankName(kickers[2])} kickers`,
    };
  }

  static getRankName(value) {
    const rankNames = {
      14: "Ace",
      13: "King",
      12: "Queen",
      11: "Jack",
    };
    return rankNames[value] || value.toString();
  }
}

module.exports = HandEvaluator;
