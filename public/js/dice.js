// Ludo Dice

class LudoDice {
    constructor() {
        this.value = 0;
        this.isRolling = false;
        this.diceElement = document.getElementById('dice');
        this.valueElement = document.getElementById('dice-value');
        this.isMultiplayer = false;
        
        // Click to roll
        this.diceElement.addEventListener('click', () => this.handleClick());
    }
    
    handleClick() {
        if (this.isRolling) return;
        
        // In multiplayer mode, send roll to server
        if (this.isMultiplayer && window.ui?.socketClient) {
            window.ui.socketClient.rollDice();
            return;
        }
        
        // Local mode
        this.roll();
    }
    
    roll() {
        if (this.isRolling) return;
        
        this.isRolling = true;
        this.diceElement.classList.add('rolling');
        this.valueElement.textContent = 'Rolling...';
        
        // Animate dice roll
        let rollCount = 0;
        const maxRolls = 10;
        const rollInterval = setInterval(() => {
            const tempValue = Math.floor(Math.random() * 6) + 1;
            this.diceElement.setAttribute('data-value', tempValue);
            rollCount++;
            
            if (rollCount >= maxRolls) {
                clearInterval(rollInterval);
                this.finishRoll();
            }
        }, 50);
    }
    
    finishRoll() {
        this.value = Math.floor(Math.random() * 6) + 1;
        this.diceElement.setAttribute('data-value', this.value);
        this.diceElement.classList.remove('rolling');
        this.valueElement.textContent = this.value;
        this.isRolling = false;
        
        // Dispatch roll event
        const event = new CustomEvent('diceRoll', { detail: { value: this.value } });
        document.dispatchEvent(event);
    }
    
    // For server-driven results
    showValue(value) {
        this.value = value;
        this.diceElement.setAttribute('data-value', value);
        this.valueElement.textContent = value;
        this.isRolling = false;
    }
    
    animateToValue(value) {
        if (this.isRolling) return;
        
        this.isRolling = true;
        this.diceElement.classList.add('rolling');
        this.valueElement.textContent = 'Rolling...';
        
        let rollCount = 0;
        const maxRolls = 8;
        const rollInterval = setInterval(() => {
            const tempValue = Math.floor(Math.random() * 6) + 1;
            this.diceElement.setAttribute('data-value', tempValue);
            rollCount++;
            
            if (rollCount >= maxRolls) {
                clearInterval(rollInterval);
                this.showValue(value);
                this.diceElement.classList.remove('rolling');
            }
        }, 60);
    }
    
    setValue(value) {
        this.value = value;
        this.diceElement.setAttribute('data-value', value);
        this.valueElement.textContent = value;
    }
    
    reset() {
        this.value = 0;
        this.diceElement.removeAttribute('data-value');
        this.valueElement.textContent = '';
    }
    
    disable() {
        this.diceElement.style.pointerEvents = 'none';
        this.diceElement.style.opacity = '0.5';
    }
    
    enable() {
        this.diceElement.style.pointerEvents = 'auto';
        this.diceElement.style.opacity = '1';
    }
    
    setMultiplayer(enabled) {
        this.isMultiplayer = enabled;
    }
}
