/**
 * Fire Character Logic
 * 
 * This module exports the character's behavior and abilities.
 */

export class FireCharacter {
  constructor(stats) {
    this.stats = stats;
    this.currentHp = stats.baseStats.hp;
    this.statusEffects = [];
  }

  /**
   * Calculate damage for an attack
   */
  calculateDamage(move, target) {
    let baseDamage = this.stats.baseStats.attack;
    
    // Apply move multiplier
    if (move.power) {
      baseDamage *= move.power;
    }
    
    // Apply type effectiveness
    if (this.isEffectiveAgainst(target.element)) {
      baseDamage *= 1.5;
    } else if (this.isWeakAgainst(target.element)) {
      baseDamage *= 0.5;
    }
    
    // Apply defense
    const defense = target.stats.baseStats.defense;
    const finalDamage = Math.max(1, baseDamage - defense);
    
    return Math.floor(finalDamage);
  }

  /**
   * Check type effectiveness
   */
  isEffectiveAgainst(targetElement) {
    // Fire is effective against Grass
    return targetElement === 'grass';
  }

  isWeakAgainst(targetElement) {
    // Fire is weak against Water
    return targetElement === 'water';
  }

  /**
   * Take damage
   */
  takeDamage(amount) {
    this.currentHp = Math.max(0, this.currentHp - amount);
    return this.currentHp;
  }

  /**
   * Heal
   */
  heal(amount) {
    this.currentHp = Math.min(this.stats.baseStats.hp, this.currentHp + amount);
    return this.currentHp;
  }

  /**
   * Check if character is defeated
   */
  isDefeated() {
    return this.currentHp <= 0;
  }

  /**
   * Apply status effect
   */
  applyStatusEffect(effect) {
    this.statusEffects.push(effect);
  }

  /**
   * Process status effects at turn start
   */
  processTurnStart() {
    const events = [];
    
    for (const effect of this.statusEffects) {
      if (effect.type === 'burn') {
        const damage = Math.floor(this.stats.baseStats.hp * 0.1);
        this.takeDamage(damage);
        events.push({
          type: 'status_damage',
          effect: 'burn',
          damage
        });
      }
      
      effect.duration--;
    }
    
    // Remove expired effects
    this.statusEffects = this.statusEffects.filter(e => e.duration > 0);
    
    return events;
  }
}

export default FireCharacter;

