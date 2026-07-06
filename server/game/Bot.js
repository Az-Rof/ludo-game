// Server-side Bot AI

class Bot {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.thinkTime = 800; // ms delay before bot acts
    }
    
    async takeTurn(io, roomCode) {
        const player = this.game.players[this.playerId];
        if (!player || this.game.gameOver) return;
        
        // Wait before acting (simulates thinking)
        await this.delay(this.thinkTime);
        
        // Roll dice
        const diceValue = this.game.rollDice();
        io.to(roomCode).emit('diceRolled', {
            playerId: this.playerId,
            value: diceValue,
            playerName: player.name
        });
        
        await this.delay(800);
        
        // Get selectable tokens
        const selectable = this.game.getSelectableTokens(player);
        
        if (selectable.length === 0) {
            // No moves available
            io.to(roomCode).emit('noMoves', {
                playerId: this.playerId,
                playerName: player.name
            });
            
            await this.delay(500);
            this.game.endTurn();
            io.to(roomCode).emit('turnEnded', {
                nextPlayer: this.game.currentPlayer,
                state: this.game.getState()
            });
            return;
        }
        
        // Pick best token using strategy
        const tokenIndex = this.pickBestToken(player, selectable);
        
        // Move token
        const result = this.game.moveToken(player, tokenIndex);
        
        io.to(roomCode).emit('tokenMoved', {
            playerId: this.playerId,
            tokenId: tokenIndex,
            result: result,
            state: this.game.getState()
        });
        
        await this.delay(result.type === 'move' ? (result.to - result.from + 1) * 200 : 500);
        
        // Handle capture
        if (result.captured) {
            io.to(roomCode).emit('tokenCaptured', {
                captures: result.captured,
                capturer: { playerId: this.playerId, playerName: player.name }
            });
            await this.delay(1000);
        }
        
        // Check win
        if (this.game.gameOver) {
            io.to(roomCode).emit('gameOver', {
                winner: { id: player.id, name: player.name, color: player.color },
                state: this.game.getState()
            });
            return;
        }
        
        // End turn
        await this.delay(300);
        const hadExtraTurn = this.game.diceValue === 6;
        this.game.endTurn();
        
        if (hadExtraTurn) {
            io.to(roomCode).emit('extraTurn', {
                playerId: this.playerId,
                state: this.game.getState()
            });
        } else {
            io.to(roomCode).emit('turnEnded', {
                nextPlayer: this.game.currentPlayer,
                state: this.game.getState()
            });
        }
    }
    
    pickBestToken(player, selectable) {
        let bestToken = selectable[0];
        let bestScore = -1;
        
        selectable.forEach(tokenIndex => {
            let score = 0;
            const token = player.tokens[tokenIndex];
            
            if (token.position === -1) {
                score = 5; // Enter from home
            } else {
                // Check for capture opportunity
                const targetPos = (token.position + this.game.diceValue) % 52;
                const wouldCapture = this.game.players.some(opponent => {
                    if (opponent.id === player.id) return false;
                    return opponent.tokens.some(t => 
                        t.position === targetPos && 
                        !t.homeColumn && 
                        !this.game.safeSquares.includes(targetPos) && 
                        targetPos !== this.game.startPositions[opponent.id]
                    );
                });
                
                if (wouldCapture) {
                    score = 20; // High priority
                } else if (token.homeColumn) {
                    score = 15; // Prefer moving in home column
                } else {
                    score = token.position; // Prefer advancing
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestToken = tokenIndex;
            }
        });
        
        return bestToken;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Bot;
