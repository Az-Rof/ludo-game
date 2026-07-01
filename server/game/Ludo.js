// Server-side Ludo Game Logic

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
            this.players.push({
                id: i,
                color: colors[i],
                name: colors[i].charAt(0).toUpperCase() + colors[i].slice(1),
                tokens: [],
                isBot: false
            });
        }
        
        // Initialize tokens
        this.players.forEach(player => {
            for (let i = 0; i < 4; i++) {
                player.tokens.push({
                    id: i,
                    position: -1,
                    homeColumn: false,
                    finished: false
                });
            }
        });
        
        // Track layout
        this.startPositions = [0, 13, 26, 39]; // Red, Yellow, Blue, Green
        this.homeEntries = [50, 11, 24, 37];
        this.safeSquares = [8, 21, 34, 47];
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
            this.checkCapture(player, tokenIndex);
            return { type: 'enter', position: token.position, captured: null };
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
        if (this.safeSquares.includes(trackPos)) return false;
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
                    oppToken.position = -1;
                    oppToken.homeColumn = false;
                    captured.push({ playerId: opponent.id, tokenId: oppIndex });
                }
            });
        });
        
        return captured.length > 0 ? captured : null;
    }
    
    checkWin(player) {
        const allFinished = player.tokens.every(token => token.finished);
        if (allFinished) {
            this.gameOver = true;
            this.winner = player;
        }
    }
    
    endTurn() {
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
    }
    
    getState() {
        return {
            currentPlayer: this.currentPlayer,
            diceValue: this.diceValue,
            gameOver: this.gameOver,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                isBot: p.isBot,
                tokens: p.tokens.map(t => ({
                    id: t.id,
                    position: t.position,
                    homeColumn: t.homeColumn,
                    finished: t.finished
                }))
            }))
        };
    }
}

module.exports = LudoGame;
