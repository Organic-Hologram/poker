class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.chips = 1000; // Starting chips
    this.hand = [];
    this.currentBet = 0;
    this.isActive = true;
    this.isFolded = false;
    this.isReady = false;
  }

  receiveCard(card) {
    this.hand.push(card);
  }

  placeBet(amount) {
    if (amount > this.chips) {
      return false;
    }
    this.chips -= amount;
    this.currentBet += amount;
    return true;
  }

  fold() {
    this.isFolded = true;
  }

  resetHand() {
    this.hand = [];
    this.currentBet = 0;
    this.isFolded = false;
  }
}

module.exports = Player;
