class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
  }

  toString() {
    return `${this.rank}${this.suit}`;
  }
}

module.exports = Card;
