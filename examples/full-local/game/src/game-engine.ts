export interface PlayerState {
  id: string;
  character: string;
  hp: number;
  maxHp: number;
  defending?: boolean;
}

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  currentTurn: string;
  turnNumber: number;
  gameOver: boolean;
  winner?: string;
}

export interface GameAction {
  type: string;
  playerId: string;
  data?: any;
  timestamp: number;
}

export interface GameEvent {
  type: string;
  message: string;
  data?: any;
}

export class GameEngine {
  private state: GameState | null = null;
  private stateChangeHandlers: Array<(state: GameState) => void> = [];
  private eventHandlers: Array<(event: GameEvent) => void> = [];

  startBattle(initialState: { player1: PlayerState; player2: PlayerState }) {
    this.state = {
      ...initialState,
      currentTurn: initialState.player1.id,
      turnNumber: 1,
      gameOver: false,
    };

    this.emitEvent({
      type: 'battle_start',
      message: 'Battle started!',
    });

    this.notifyStateChange();
  }

  processAction(action: GameAction) {
    if (!this.state || this.state.gameOver) return;

    // Validate it's the player's turn
    if (action.playerId !== this.state.currentTurn) {
      this.emitEvent({
        type: 'invalid_action',
        message: "It's not your turn!",
      });
      return;
    }

    const attacker = this.getPlayer(action.playerId);
    const defender = this.getOpponent(action.playerId);

    if (!attacker || !defender) return;

    switch (action.type) {
      case 'attack':
        this.handleAttack(attacker, defender);
        break;
      case 'defend':
        this.handleDefend(attacker);
        break;
      case 'special':
        this.handleSpecial(attacker, defender);
        break;
      case 'item':
        this.handleItem(attacker);
        break;
    }

    // Check for game over
    if (defender.hp <= 0) {
      this.state.gameOver = true;
      this.state.winner = attacker.id;
      this.emitEvent({
        type: 'game_over',
        message: `${attacker.id} wins!`,
      });
    } else {
      // Switch turns
      this.switchTurn();
    }

    this.notifyStateChange();
  }

  private handleAttack(attacker: PlayerState, defender: PlayerState) {
    const damage = defender.defending ? 10 : 20;
    defender.hp = Math.max(0, defender.hp - damage);
    defender.defending = false;

    this.emitEvent({
      type: 'attack',
      message: `${attacker.id} attacks for ${damage} damage!`,
      data: { damage, attacker: attacker.id, defender: defender.id },
    });
  }

  private handleDefend(attacker: PlayerState) {
    attacker.defending = true;

    this.emitEvent({
      type: 'defend',
      message: `${attacker.id} takes a defensive stance!`,
      data: { player: attacker.id },
    });
  }

  private handleSpecial(attacker: PlayerState, defender: PlayerState) {
    const damage = defender.defending ? 20 : 35;
    defender.hp = Math.max(0, defender.hp - damage);
    defender.defending = false;

    this.emitEvent({
      type: 'special',
      message: `${attacker.id} uses a special move for ${damage} damage!`,
      data: { damage, attacker: attacker.id, defender: defender.id },
    });
  }

  private handleItem(attacker: PlayerState) {
    const healing = 25;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healing);

    this.emitEvent({
      type: 'item',
      message: `${attacker.id} uses a potion and recovers ${healing} HP!`,
      data: { healing, player: attacker.id },
    });
  }

  private switchTurn() {
    if (!this.state) return;

    this.state.currentTurn =
      this.state.currentTurn === this.state.player1.id
        ? this.state.player2.id
        : this.state.player1.id;

    this.state.turnNumber++;

    this.emitEvent({
      type: 'turn_change',
      message: `Turn ${this.state.turnNumber}: ${this.state.currentTurn}'s turn!`,
    });
  }

  private getPlayer(playerId: string): PlayerState | null {
    if (!this.state) return null;
    return this.state.player1.id === playerId ? this.state.player1 : this.state.player2;
  }

  private getOpponent(playerId: string): PlayerState | null {
    if (!this.state) return null;
    return this.state.player1.id === playerId ? this.state.player2 : this.state.player1;
  }

  private notifyStateChange() {
    if (this.state) {
      this.stateChangeHandlers.forEach(handler => handler(this.state!));
    }
  }

  private emitEvent(event: GameEvent) {
    this.eventHandlers.forEach(handler => handler(event));
  }

  onStateChange(handler: (state: GameState) => void) {
    this.stateChangeHandlers.push(handler);
  }

  onEvent(handler: (event: GameEvent) => void) {
    this.eventHandlers.push(handler);
  }

  getState(): GameState | null {
    return this.state;
  }
}

