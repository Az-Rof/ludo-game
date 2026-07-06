// Ludo Game Logic

const COLORS = ['red', 'yellow', 'blue', 'green'];
const TOKENS_PER_PLAYER = 4;

// Board layout: 15x15 grid
// Track positions (main path): 0-51 (52 squares total)
// Home columns: 52-57 (6 squares per player)
// Home base: separate positions

class LudoGame {
    constructor(numPlayers) {
        this.numPlayers = numPlayers;
        this.players = [];
        this.currentPlayer = 0;
        this.diceValue = 0;
        this.consecutiveSixes = 0;
        this.gameOver = false;
        this.winner = null;
        
        // Initialize players
        for (let i = 0; i < numPlayers; i++) {
            this.players.push({
                id: i,
                color: COLORS[i],
                name: COLORS[i].charAt(0).toUpperCase() + COLORS[i].slice(1),
                tokens: [],
                isBot: i !== 0, // Player 0 is human
                captureCount: 0
            });
        }
        
        // Initialize tokens for each player
        this.players.forEach(player => {
            for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
                player.tokens.push({
                    id: i,
                    position: -1, // -1 means in home base
                    homeColumn: false,
                    finished: false,
                    shielded: false
                });
            }
        });
        
        // Track layout (standard Ludo)
        // Each player has a starting position on the main track
        this.startPositions = [0, 13, 26, 39]; // Red, Yellow, Blue, Green
        
        // Home column entry points (when token reaches here, enters home column)
        this.homeEntries = [50, 11, 24, 37]; // Before each start position
        
        // Safe squares (star positions)
        this.safeSquares = [8, 21, 34, 47];
        this.powerupSquares = [4, 17, 30, 43];
    }
    
    // Roll dice
    rollDice() {
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        return this.diceValue;
    }
    
    // Get current player
    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }
    
    canRoll() {
        if (this.gameOver) return false;
        return this.diceValue === 0;
    }
    
    // Get selectable tokens for current player
    getSelectableTokens(player) {
        const selectable = [];
        
        player.tokens.forEach((token, index) => {
            if (this.canMoveToken(player, index)) {
                selectable.push(index);
            }
        });
        
        return selectable;
    }
    
    // Check if a track position is blocked by a 2+ same-color blockade
    isBlocked(trackPos, movingPlayerId) {
        if (this.safeSquares.includes(trackPos) || this.startPositions.includes(trackPos)) return false;
        const counts = {};
        this.players.forEach(p => {
            if (p.id === movingPlayerId) return;
            p.tokens.forEach(t => {
                if (!t.homeColumn && !t.finished && t.position === trackPos && t.position >= 0) {
                    counts[p.id] = (counts[p.id] || 0) + 1;
                }
            });
        });
        return Object.values(counts).some(c => c >= 2);
    }
    
    // Check if a token can move
    canMoveToken(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        
        // Token finished
        if (token.finished) return false;
        const playerIndex = this.players.indexOf(player);
        
        // Token in home base
        if (token.position === -1) {
            // Can only enter if dice is 6
            if (this.diceValue !== 6) return false;
            const dest = this.startPositions[playerIndex];
            if (this.isBlocked(dest, player.id)) return false;
            return true;
        }
        
        // Token in home column
        if (token.homeColumn) {
            const homeColPos = token.position - 52;
            const newPos = homeColPos + this.diceValue;
            
            // Can't overshoot home
            if (newPos > 6) return false;
            
            return true;
        }
        
        // Token on main track - check all steps for blockade
        for (let step = 1; step <= this.diceValue; step++) {
            const checkPos = (token.position + step) % 52;
            if (this.isBlocked(checkPos, player.id)) return false;
        }
        
        return true;
    }
    
    // Move a token
    moveToken(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        const playerIndex = this.players.indexOf(player);
        
        // Token in home base
        if (token.position === -1) {
            token.position = this.startPositions[playerIndex];
            this.checkCapture(player, tokenIndex);
            return { type: 'enter', position: token.position };
        }
        
        // Token in home column
        if (token.homeColumn) {
            const homeColPos = token.position - 52;
            const newPos = homeColPos + this.diceValue;
            
            if (newPos === 6) {
                // Reached home!
                token.finished = true;
                token.position = -2; // Special finished position
                this.checkWin(player);
                return { type: 'finish', tokenIndex };
            }
            
            token.position = 52 + newPos;
            return { type: 'homeColumn', position: token.position };
        }
        
        // Token on main track
        const oldPos = token.position;
        let newPos = (token.position + this.diceValue) % 52;
        
        // Check if entering home column (handles wrapping correctly)
        const homeEntry = this.homeEntries[playerIndex];
        const distanceToHomeEntry = (homeEntry - oldPos + 52) % 52;
        if (distanceToHomeEntry < this.diceValue) {
            const homeColPos = this.diceValue - distanceToHomeEntry - 1;
            if (homeColPos < 6) {
                // Entering home column
                token.homeColumn = true;
                token.position = 52 + homeColPos;
                
                if (homeColPos === 5) {
                    // Reached home!
                    token.finished = true;
                    token.position = -2;
                    this.checkWin(player);
                    return { type: 'finish', tokenIndex };
                }
                
                return { type: 'enterHome', position: token.position };
            }
        }
        
        // Normal move
        token.position = newPos;
        
        // Check for capture
        const captured = this.checkCapture(player, tokenIndex);
        
        return { type: 'move', from: oldPos, to: newPos, captured };
    }
    
    // Check if landing on opponent's token
    checkCapture(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        if (this.safeSquares.includes(token.position)) return null;
        const captured = [];
        
        // Check each opponent
        this.players.forEach(opponent => {
            if (opponent.id === player.id) return;
            
            opponent.tokens.forEach((oppToken, oppIndex) => {
                if (oppToken.position === token.position && !oppToken.homeColumn && !oppToken.finished) {
                    // Start squares are safe zones for the owner
                    if (oppToken.position === this.startPositions[opponent.id]) return;
                    
                    // Check for token shield
                    if (oppToken.shielded) {
                        oppToken.shielded = false; // Consume shield
                        return; // Shield absorbs capture
                    }
                    
                    // Capture! Send back to home base
                    oppToken.position = -1;
                    oppToken.homeColumn = false;
                    captured.push({ player: opponent.id, token: oppIndex });
                }
            });
        });
        
        return captured.length > 0 ? captured : null;
    }
    
    // Check for win condition
    checkWin(player) {
        const allFinished = player.tokens.every(token => token.finished);
        if (allFinished) {
            this.gameOver = true;
            this.winner = player;
        }
    }
    
    // End current turn
    endTurn() {
        // Extra turn if rolled 6
        if (this.diceValue !== 6) {
            this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
            this.consecutiveSixes = 0;
        } else {
            this.consecutiveSixes++;
            
            // Three consecutive 6s = forfeit
            if (this.consecutiveSixes >= 3) {
                this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
                this.consecutiveSixes = 0;
            }
        }
        
        this.diceValue = 0;
    }
    
    // Get token position for rendering
    getTokenPosition(playerIndex, tokenIndex) {
        const player = this.players[playerIndex];
        const token = player.tokens[tokenIndex];
        
        if (token.position === -1) {
            // In home base
            return { type: 'home', base: playerIndex, index: tokenIndex };
        }
        
        if (token.finished) {
            // In center
            return { type: 'finished', base: playerIndex, index: tokenIndex };
        }
        
        if (token.homeColumn) {
            // In home column
            return { type: 'homeColumn', base: playerIndex, position: token.position - 52 };
        }
        
        // On main track
        return { type: 'track', position: token.position };
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LudoGame;
}
