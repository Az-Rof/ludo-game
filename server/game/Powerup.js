class Powerup {
    constructor() {
        this.types = {
            EXTRA_ROLL: 'extra_roll',
            PROTECTION: 'protection',
            DOUBLE_MOVE: 'double_move',
            TELEPORT: 'teleport',
            STEAL: 'steal',
            SKIP_TURN: 'skip_turn'
        };
        
        this.durations = {
            INSTANT: 'instant',
            TURN: 'turn',
            ROUND: 'round'
        };
    }
    
    static getPowerupTypes() {
        return [
            { id: 'EXTRA_ROLL', name: 'Extra Roll', description: 'Get an additional dice roll', icon: '🎲', rarity: 'common' },
            { id: 'PROTECTION', name: 'Protection', description: 'Immune from capture for 1 turn', icon: '🛡️', rarity: 'common' },
            { id: 'DOUBLE_MOVE', name: 'Double Move', description: 'Move two tokens this turn', icon: '⚡', rarity: 'rare' },
            { id: 'TELEPORT', name: 'Teleport', description: 'Move a token to any position', icon: '🌀', rarity: 'epic' },
            { id: 'STEAL', name: 'Steal', description: 'Take a random powerup from opponent', icon: '✂️', rarity: 'rare' },
            { id: 'SKIP_TURN', name: 'Skip Turn', description: 'Force opponent to skip their turn', icon: '⏭️', rarity: 'epic' }
        ];
    }
    
    static getRandomPowerup() {
        const types = Powerup.getPowerupTypes();
        const weights = { common: 50, rare: 30, epic: 15, legendary: 5 };
        const weighted = types.flatMap(t => Array(weights[t.rarity] || 30).fill(t));
        return weighted[Math.floor(Math.random() * weighted.length)];
    }
    
    static applyPowerup(game, playerId, powerupType, params = {}) {
        const result = { applied: false, effect: null, message: '' };
        const player = game.players.find(p => p.id === playerId);
        if (!player) return result;
        
        switch (powerupType) {
            case 'EXTRA_ROLL':
                result.applied = true;
                result.effect = { type: 'extra_roll' };
                result.message = 'You got an extra roll!';
                break;
                
            case 'PROTECTION':
                player.protectedForTurns = (player.protectedForTurns || 0) + 1;
                result.applied = true;
                result.effect = { type: 'protection', turns: player.protectedForTurns };
                result.message = 'Your tokens are protected!';
                break;
                
            case 'DOUBLE_MOVE':
                result.applied = true;
                result.effect = { type: 'double_move' };
                result.message = 'You can move two tokens this turn!';
                break;
                
            case 'TELEPORT':
                if (params.tokenIndex !== undefined && params.targetPosition !== undefined) {
                    if (player.tokens[params.tokenIndex]) {
                        player.tokens[params.tokenIndex].position = params.targetPosition;
                        result.applied = true;
                        result.effect = { type: 'teleport', tokenIndex: params.tokenIndex, targetPosition: params.targetPosition };
                        result.message = 'Token teleported!';
                    }
                }
                break;
                
            case 'STEAL':
                const opponents = game.players.filter(p => p.id !== playerId && p.powerups && p.powerups.length > 0);
                if (opponents.length > 0) {
                    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
                    const stolen = Powerup.stealRandomPowerup(randomOpponent, player);
                    if (stolen) {
                        result.applied = true;
                        result.effect = { type: 'steal', stolen: stolen, fromPlayerId: randomOpponent.id };
                        result.message = `Stole ${stolen.name} from ${randomOpponent.name}!`;
                    }
                } else {
                    result.message = 'No opponents have power-ups to steal!';
                }
                break;
                
            case 'SKIP_TURN':
                result.applied = true;
                result.effect = { type: 'skip_turn', targetPlayerId: params.targetPlayerId };
                result.message = 'Opponent turn skipped!';
                break;
        }
        
        return result;
    }
    
    static stealRandomPowerup(fromPlayer, toPlayer) {
        const powerups = fromPlayer.powerups || [];
        if (powerups.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * powerups.length);
        const stolen = powerups.splice(randomIndex, 1)[0];
        
        if (toPlayer) {
            toPlayer.powerups = toPlayer.powerups || [];
            toPlayer.powerups.push(stolen);
        }
        
        return stolen;
    }
    
    static checkProtections(game) {
        game.players.forEach(player => {
            if (player.protectedForTurns > 0) {
                player.protectedForTurns--;
            }
        });
    }
}

module.exports = Powerup;
