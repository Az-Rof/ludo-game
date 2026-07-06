// Server-side Ludo Game Logic
const Powerup = require('./Powerup');

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
        const colors = ['red', 'yellow', 'blue', 'green'];
        for (let i = 0; i < numPlayers; i++) {
            const player = {
                id: i,
                color: colors[i],
                name: colors[i].charAt(0).toUpperCase() + colors[i].slice(1),
                tokens: [],
                isBot: false,
                powerups: [],
                protectedForTurns: 0,
                captureCount: 0
            };
            this.players.push(player);
            // Grant 1 starting power-up
            this.grantPowerup(player);
        }
        
        // Initialize tokens
        this.players.forEach(player => {
            for (let i = 0; i < 4; i++) {
                player.tokens.push({
                    id: i,
                    position: -1,
                    homeColumn: false,
                    finished: false,
                    shielded: false
                });
            }
        });
        
        // Track layout
        this.startPositions = [0, 13, 26, 39]; // Red, Yellow, Blue, Green
        this.homeEntries = [50, 11, 24, 37];
        this.safeSquares = [8, 21, 34, 47];
        this.powerupSquares = [4, 17, 30, 43];
        this.turnCount = 0;
    }
    
    rollDice() {
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        return this.diceValue;
    }
    
    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }
    
    canRoll(socketId) {
        if (this.gameOver) return false;
        const player = this.getPlayerBySocketId(socketId);
        if (!player || player.id !== this.currentPlayer) return false;
        return this.diceValue === 0;
    }
    
    getPlayerBySocketId(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }
    
    getSelectableTokens(player) {
        const selectable = [];
        player.tokens.forEach((token, index) => {
            if (this.canMoveToken(player, index)) {
                selectable.push(index);
            }
        });
        return selectable;
    }
    
    canMoveToken(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        if (token.finished) return false;
        const playerIndex = this.players.indexOf(player);
        
        if (token.position === -1) {
            if (this.diceValue !== 6) return false;
            const dest = this.startPositions[playerIndex];
            if (this.isBlocked(dest, player.id)) return false;
            return true;
        }
        
        if (token.homeColumn) {
            const homeColPos = token.position - 52;
            return (homeColPos + this.diceValue) <= 6;
        }
        
        // Token on main track - check all steps for blockade
        for (let step = 1; step <= this.diceValue; step++) {
            const checkPos = (token.position + step) % 52;
            // Can pass through own blockade, cannot pass opponent blockade
            if (this.isBlocked(checkPos, player.id)) {
                // If final destination, blocked entirely
                if (step === this.diceValue) return false;
                // Passing through a blockade is not allowed
                return false;
            }
        }
        
        return true;
    }
    
    moveToken(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        const playerIndex = this.players.indexOf(player);
        
        if (token.position === -1) {
            token.position = this.startPositions[playerIndex];
            const captured = this.checkCapture(player, tokenIndex);
            if (captured) {
                player.captureCount = (player.captureCount || 0) + captured.length;
                while (player.captureCount >= 2) {
                    player.captureCount -= 2;
                    this.grantPowerup(player);
                }
            }
            return { type: 'enter', position: token.position, captured };
        }
        
        if (token.homeColumn) {
            const homeColPos = token.position - 52;
            const newPos = homeColPos + this.diceValue;
            
            if (newPos === 6) {
                token.finished = true;
                token.position = -2;
                this.checkWin(player);
                return { type: 'finish', tokenIndex, captured: null };
            }
            
            token.position = 52 + newPos;
            return { type: 'homeColumn', position: token.position, captured: null };
        }
        
        const oldPos = token.position;
        let newPos = (token.position + this.diceValue) % 52;
        const homeEntry = this.homeEntries[playerIndex];
        
        // Check if token crosses home entry (handles wrapping correctly)
        const distanceToHomeEntry = (homeEntry - oldPos + 52) % 52;
        if (distanceToHomeEntry < this.diceValue) {
            const homeColPos = this.diceValue - distanceToHomeEntry - 1;
            if (homeColPos < 6) {
                token.homeColumn = true;
                token.position = 52 + homeColPos;
                
                if (homeColPos === 5) {
                    token.finished = true;
                    token.position = -2;
                    this.checkWin(player);
                    return { type: 'finish', tokenIndex, captured: null };
                }
                
                return { type: 'enterHome', position: token.position, captured: null };
            }
        }
        
        token.position = newPos;
        const captured = this.checkCapture(player, tokenIndex);
        if (captured) {
            player.captureCount = (player.captureCount || 0) + captured.length;
            while (player.captureCount >= 2) {
                player.captureCount -= 2;
                this.grantPowerup(player);
            }
        }
        if (this.powerupSquares.includes(newPos)) {
            this.grantPowerup(player);
        }
        
        return { type: 'move', from: oldPos, to: newPos, captured };
    }
    
    // Get count of same-color tokens on a track position (for blockade)
    getBlockCount(trackPos, excludePlayerId) {
        let count = 0;
        this.players.forEach(p => {
            if (p.id === excludePlayerId) return;
            p.tokens.forEach(t => {
                if (!t.homeColumn && !t.finished && t.position === trackPos && t.position >= 0) {
                    count++;
                }
            });
        });
        return count;
    }
    
    // Check if a track position is blocked by a 2+ same-color blockade
    isBlocked(trackPos, movingPlayerId) {
        if (this.safeSquares.includes(trackPos) || this.startPositions.includes(trackPos)) return false;
        const counts = {};
        this.players.forEach(p => {
            if (p.id === movingPlayerId) return;
            p.tokens.forEach(t => {
                if (!t.homeColumn && !t.finished && t.position === trackPos && t.position >= 0) {
                    const key = p.id;
                    counts[key] = (counts[key] || 0) + 1;
                }
            });
        });
        return Object.values(counts).some(c => c >= 2);
    }
    
    checkCapture(player, tokenIndex) {
        const token = player.tokens[tokenIndex];
        if (this.safeSquares.includes(token.position)) return null;
        const captured = [];
        
        this.players.forEach(opponent => {
            if (opponent.id === player.id) return;
            
            opponent.tokens.forEach((oppToken, oppIndex) => {
                if (oppToken.position === token.position && !oppToken.homeColumn && !oppToken.finished) {
                    // Start squares are safe zones for the owner
                    if (oppToken.position === this.startPositions[opponent.id]) return;
                    
                    // Check for protection
                    if (opponent.protectedForTurns > 0) return;
                    
                    // Check for token shield
                    if (oppToken.shielded) {
                        oppToken.shielded = false; // Consume shield
                        this.shieldAbsorbs = this.shieldAbsorbs || [];
                        this.shieldAbsorbs.push({ playerId: opponent.id, tokenId: oppIndex, byPlayerId: player.id });
                        return; // Shield absorbs capture
                    }
                    oppToken.position = -1;
                    oppToken.homeColumn = false;
                    captured.push({ playerId: opponent.id, tokenId: oppIndex });
                }
            });
        });
        
        Powerup.checkProtections(this);
        return captured.length > 0 ? captured : null;
    }
    
    // Grant a random powerup to a player
    grantPowerup(player) {
        const powerupData = Powerup.getRandomPowerup();
        if (powerupData) {
            player.powerups.push({
                id: Date.now() + Math.random(),
                type: powerupData.id,
                name: powerupData.name,
                icon: powerupData.icon,
                obtainedAt: Date.now()
            });
            return powerupData;
        }
        return null;
    }
    
    // Use a powerup
    usePowerup(player, powerupId, params = {}) {
        const powerup = player.powerups.find(p => p.id === powerupId);
        if (!powerup) return { success: false, error: 'Powerup not found' };
        
        const result = Powerup.applyPowerup(this, player.id, powerup.type, params);
        if (result.applied) {
            player.powerups = player.powerups.filter(p => p.id !== powerupId);
            
            // Apply special side effects
            if (powerup.type === 'SKIP_TURN') {
                const targetPlayer = this.players.find(p => p.id === parseInt(params.targetPlayerId));
                if (targetPlayer) {
                    targetPlayer.skipped = true;
                }
            } else if (powerup.type === 'DOUBLE_MOVE') {
                player.doubleMoveActive = true;
            }
        }
        return result;
    }
    
    checkWin(player) {
        const allFinished = player.tokens.every(token => token.finished);
        if (allFinished) {
            this.gameOver = true;
            this.winner = player;
        }
    }
    
    endTurn() {
        // Decrement protection for all players at the end of every turn so it
        // reliably expires even when no capture was attempted. (Powerup.checkProtections
        // in checkCapture only runs when a capture is tried, which previously
        // left protection permanent if no one attacked the protected player.)
        this.players.forEach(p => {
            if (p.protectedForTurns > 0) p.protectedForTurns--;
        });

        let safetyCounter = 0;
        do {
            if (this.diceValue !== 6) {
                this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
                this.consecutiveSixes = 0;
            } else {
                this.consecutiveSixes++;
                if (this.consecutiveSixes >= 3) {
                    this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
                    this.consecutiveSixes = 0;
                }
            }
            this.diceValue = 0;
            
            // Check if next player is marked for skip. Loop until we find a
            // player who is NOT skipped, or until we've checked every player
            // once (safety cap) -- in the latter case the current player simply
            // gets their turn (everyone was skipped, so play resumes normally).
            if (this.players[this.currentPlayer].skipped) {
                this.players[this.currentPlayer].skipped = false;
            } else {
                break;
            }
            safetyCounter++;
        } while (safetyCounter < this.numPlayers);
        
        // Turn tracking for power-up squares relocation
        this.turnCount = (this.turnCount || 0) + 1;
        if (this.turnCount >= 3 * this.numPlayers) {
            this.turnCount = 0;
            this.relocatePowerupSquares();
        }
    }
    
    relocatePowerupSquares() {
        const forbidden = [...this.safeSquares, ...this.startPositions];
        const newSquares = [];
        while (newSquares.length < 4) {
            const rand = Math.floor(Math.random() * 52);
            if (!forbidden.includes(rand) && !newSquares.includes(rand)) {
                newSquares.push(rand);
            }
        }
        this.powerupSquares = newSquares;
        this.powerupRelocated = true; // flag to notify socket clients
    }
    
    getState() {
        return {
            currentPlayer: this.currentPlayer,
            diceValue: this.diceValue,
            gameOver: this.gameOver,
            powerupSquares: this.powerupSquares,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                isBot: p.isBot,
                powerups: p.powerups || [],
                protectedForTurns: p.protectedForTurns || 0,
                captureCount: p.captureCount || 0,
                tokens: p.tokens.map(t => ({
                    id: t.id,
                    position: t.position,
                    homeColumn: t.homeColumn,
                    finished: t.finished,
                    shielded: t.shielded || false
                }))
            }))
        };
    }
}

module.exports = LudoGame;
