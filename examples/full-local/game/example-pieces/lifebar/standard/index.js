/**
 * Standard Life Bar
 * 
 * A mandatory UI piece that displays character health.
 * This is loaded before the game starts and is required for all games.
 */

export class LifeBar {
  constructor(config = {}) {
    this.style = config.style || 'standard';
    this.width = config.width || 200;
    this.height = config.height || 30;
    this.colors = {
      high: '#4ade80',    // Green when HP > 50%
      medium: '#fbbf24',  // Yellow when HP 25-50%
      low: '#ef4444',     // Red when HP < 25%
      background: '#1f2937',
      border: '#374151'
    };
  }

  /**
   * Render the life bar
   */
  render(currentHp, maxHp, element) {
    const percentage = (currentHp / maxHp) * 100;
    const color = this.getColor(percentage);
    
    // Create life bar HTML
    const html = `
      <div class="lifebar" style="
        width: ${this.width}px;
        height: ${this.height}px;
        background: ${this.colors.background};
        border: 2px solid ${this.colors.border};
        border-radius: 15px;
        overflow: hidden;
        position: relative;
      ">
        <div class="lifebar-fill" style="
          width: ${percentage}%;
          height: 100%;
          background: linear-gradient(90deg, ${color} 0%, ${this.lighten(color)} 100%);
          transition: width 0.5s ease-out;
        "></div>
        <div class="lifebar-text" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: bold;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        ">
          ${currentHp} / ${maxHp}
        </div>
      </div>
    `;
    
    if (element) {
      element.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Update the life bar with animation
   */
  update(currentHp, maxHp, element) {
    const percentage = (currentHp / maxHp) * 100;
    const color = this.getColor(percentage);
    
    const fill = element.querySelector('.lifebar-fill');
    const text = element.querySelector('.lifebar-text');
    
    if (fill) {
      fill.style.width = `${percentage}%`;
      fill.style.background = `linear-gradient(90deg, ${color} 0%, ${this.lighten(color)} 100%)`;
    }
    
    if (text) {
      text.textContent = `${currentHp} / ${maxHp}`;
    }
  }

  /**
   * Get color based on HP percentage
   */
  getColor(percentage) {
    if (percentage > 50) return this.colors.high;
    if (percentage > 25) return this.colors.medium;
    return this.colors.low;
  }

  /**
   * Lighten a color for gradient effect
   */
  lighten(color) {
    // Simple color lightening
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 40);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 40);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 40);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Animate damage taken
   */
  animateDamage(damage, element) {
    const damageText = document.createElement('div');
    damageText.textContent = `-${damage}`;
    damageText.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      color: #ef4444;
      font-weight: bold;
      font-size: 20px;
      animation: damage-float 1s ease-out forwards;
    `;
    
    element.style.position = 'relative';
    element.appendChild(damageText);
    
    setTimeout(() => {
      damageText.remove();
    }, 1000);
  }

  /**
   * Animate healing
   */
  animateHeal(amount, element) {
    const healText = document.createElement('div');
    healText.textContent = `+${amount}`;
    healText.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      color: #4ade80;
      font-weight: bold;
      font-size: 20px;
      animation: heal-float 1s ease-out forwards;
    `;
    
    element.style.position = 'relative';
    element.appendChild(healText);
    
    setTimeout(() => {
      healText.remove();
    }, 1000);
  }
}

export default LifeBar;

