class Powerup {
    constructor() {
        this.types = {
            EXTRA_ROLL: 'extra_roll',
            PROTECTION: 'protection',
            DOUBLE_MOVE: 'double_move',
            TELEPORT: 'teleport',
            STEAL: 'steal',
            SKIP_TURN: 'skip_turn',
            DICE_BOOST: 'dice_boost',
            SHIELD: 'shield',
            BOMB: 'bomb',
            DICE_CONTROL: 'dice_control',
            SWAP_TOKENS: 'swap_tokens',
            GLOBAL_SKIP: 'global_skip',
            GLOBAL_BOMB: 'global_bomb',
            GLOBAL_STEAL: 'global_steal'
        };
        
        this.durations = {
            INSTANT: 'instant',
            TURN: 'turn',
            ROUND: 'round'
        };
    }
    
    static getPowerupTypes() {
        return [
            { id: 'EXTRA_ROLL', name: 'Extra Roll', description: 'Get an additional dice roll', icon: '🎲', rarity: 'common', global: false },
            { id: 'PROTECTION', name: 'Global Protection', description: 'Protect all players from capture for 1 turn', icon: '🏰', rarity: 'common', global: true },
            { id: 'DOUBLE_MOVE', name: 'Double Move', description: 'Move two tokens this turn', icon: '⚡', rarity: 'rare', global: false },
            { id: 'TELEPORT', name: 'Teleport', description: 'Move a token to any position', icon: '🌀', rarity: 'epic', global: false },
            { id: 'STEAL', name: 'Steal', description: 'Take a random powerup from an opponent', icon: '✂️', rarity: 'rare', global: false },
            { id: 'SKIP_TURN', name: 'Skip Turn', description: 'Force an opponent to skip their turn', icon: '⏭️', rarity: 'epic', global: false },
            { id: 'DICE_BOOST', name: 'Dice Boost', description: 'Add +2 to your current dice roll', icon: '➕', rarity: 'common', global: false },
            { id: 'SHIELD', name: 'Shield', description: 'Protect a token from its next capture', icon: '🛡️', rarity: 'rare', global: false },
            { id: 'BOMB', name: 'Bomb', description: 'Blow up a tile, sending all tokens back to base', icon: '💣', rarity: 'rare', global: false },
            { id: 'DICE_CONTROL', name: 'Dice Control', description: 'Choose your next dice roll (1-6)', icon: '🎯', rarity: 'epic', global: false },
            { id: 'SWAP_TOKENS', name: 'Swap Tokens', description: 'Swap position of your token with an opponent\'s', icon: '🔄', rarity: 'epic', global: false },
            { id: 'GLOBAL_SKIP', name: 'Global Skip', description: 'Force all opponents to skip their next turns', icon: '🌀', rarity: 'epic', global: true },
            { id: 'GLOBAL_BOMB', name: 'Global Bomb', description: 'Send all opponents\' track tokens back to base', icon: '💥', rarity: 'epic', global: true },
            { id: 'GLOBAL_STEAL', name: 'Global Steal', description: 'Steal a random powerup from all opponents', icon: '💰', rarity: 'epic', global: true }
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
                game.players.forEach(p => {
                    p.protectedForTurns = 1;
                });
                result.applied = true;
                result.effect = { type: 'protection', global: true };
                result.message = 'Global Protection active! All players immune from capture for 1 turn!';
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
                const targetOpponent = game.players.find(p => p.id === params.targetPlayerId);
                if (targetOpponent && targetOpponent.powerups && targetOpponent.powerups.length > 0) {
                    const stolen = Powerup.stealRandomPowerup(targetOpponent, player);
                    if (stolen) {
                        result.applied = true;
                        result.effect = { type: 'steal', stolen: stolen, fromPlayerId: targetOpponent.id };
                        result.message = `Stole ${stolen.name} from ${targetOpponent.name}!`;
                    }
                } else {
                    result.message = 'Target opponent has no power-ups to steal!';
                }
                break;
                
            case 'SKIP_TURN':
                result.applied = true;
                result.effect = { type: 'skip_turn', targetPlayerId: params.targetPlayerId };
                result.message = 'Opponent turn skipped!';
                break;

            case 'DICE_BOOST':
                if (game.diceValue === 0) {
                    result.message = 'Roll the dice first to use Dice Boost!';
                } else {
                    game.diceValue += 2;
                    result.applied = true;
                    result.effect = { type: 'dice_boost', newValue: game.diceValue };
                    result.message = `Dice value boosted by +2 to ${game.diceValue}!`;
                }
                break;

            case 'SHIELD':
                if (params.tokenIndex !== undefined && player.tokens[params.tokenIndex]) {
                    const token = player.tokens[params.tokenIndex];
                    if (token.finished) {
                        result.message = 'Cannot shield a finished token!';
                    } else {
                        token.shielded = true;
                        result.applied = true;
                        result.effect = { type: 'shield', tokenIndex: params.tokenIndex };
                        result.message = `Shield applied to token ${params.tokenIndex + 1}!`;
                    }
                } else {
                    result.message = 'Invalid token selected for shield!';
                }
                break;

            case 'BOMB':
                if (params.targetPosition !== undefined && params.targetPosition >= 0 && params.targetPosition < 52) {
                    let hitCount = 0;
                    game.players.forEach(p => {
                        p.tokens.forEach(t => {
                            if (!t.homeColumn && !t.finished && t.position === params.targetPosition) {
                                t.position = -1;
                                t.homeColumn = false;
                                t.shielded = false;
                                hitCount++;
                            }
                        });
                    });
                    result.applied = true;
                    result.effect = { type: 'bomb', targetPosition: params.targetPosition };
                    result.message = `Bomb exploded at position ${params.targetPosition}! ${hitCount} token(s) sent back to base.`;
                } else {
                    result.message = 'Invalid target for bomb!';
                }
                break;

            case 'DICE_CONTROL':
                if (game.diceValue !== 0) {
                    result.message = 'You have already rolled the dice!';
                } else {
                    const val = parseInt(params.chosenValue);
                    if (val >= 1 && val <= 6) {
                        game.diceValue = val;
                        result.applied = true;
                        result.effect = { type: 'dice_control', value: val };
                        result.message = `Dice set to ${val}!`;
                    } else {
                        result.message = 'Invalid chosen dice value!';
                    }
                }
                break;

            case 'SWAP_TOKENS':
                if (params.ownTokenIndex !== undefined && params.opponentPlayerId !== undefined && params.opponentTokenIndex !== undefined) {
                    const ownToken = player.tokens[params.ownTokenIndex];
                    const oppPlayer = game.players.find(p => p.id === params.opponentPlayerId);
                    const oppToken = oppPlayer ? oppPlayer.tokens[params.opponentTokenIndex] : null;
                    
                    if (ownToken && oppToken) {
                        const ownOnTrack = ownToken.position >= 0 && ownToken.position < 52 && !ownToken.homeColumn && !ownToken.finished;
                        const oppOnTrack = oppToken.position >= 0 && oppToken.position < 52 && !oppToken.homeColumn && !oppToken.finished;
                        
                        if (ownOnTrack && oppOnTrack) {
                            const tempPos = ownToken.position;
                            ownToken.position = oppToken.position;
                            oppToken.position = tempPos;
                            
                            result.applied = true;
                            result.effect = { 
                                type: 'swap_tokens', 
                                ownTokenIndex: params.ownTokenIndex, 
                                opponentPlayerId: params.opponentPlayerId, 
                                opponentTokenIndex: params.opponentTokenIndex 
                            };
                            result.message = `Swapped positions with ${oppPlayer.name}'s token!`;
                        } else {
                            result.message = 'Both tokens must be active on the track to swap!';
                        }
                    } else {
                        result.message = 'Tokens not found!';
                    }
                } else {
                    result.message = 'Invalid targets for swap!';
                }
                break;

            case 'GLOBAL_SKIP':
                game.players.forEach(p => {
                    if (p.id !== playerId) {
                        p.skipped = true;
                    }
                });
                result.applied = true;
                result.effect = { type: 'global_skip' };
                result.message = 'Global Skip activated! All opponents will skip their next turn!';
                break;

            case 'GLOBAL_BOMB':
                let globalHitCount = 0;
                game.players.forEach(p => {
                    if (p.id !== playerId) {
                        p.tokens.forEach(t => {
                            if (t.position >= 0 && t.position < 52 && !t.homeColumn && !t.finished) {
                                t.position = -1;
                                t.homeColumn = false;
                                t.shielded = false;
                                globalHitCount++;
                            }
                        });
                    }
                });
                result.applied = true;
                result.effect = { type: 'global_bomb' };
                result.message = `Global Bomb exploded! Sent ${globalHitCount} opponent token(s) back to base!`;
                break;

            case 'GLOBAL_STEAL':
                const stolenList = [];
                game.players.forEach(p => {
                    if (p.id !== playerId && p.powerups && p.powerups.length > 0) {
                        const stolen = Powerup.stealRandomPowerup(p, player);
                        if (stolen) {
                            stolenList.push({ name: stolen.name, from: p.name });
                        }
                    }
                });
                result.applied = true;
                result.effect = { type: 'global_steal', stolen: stolenList };
                if (stolenList.length > 0) {
                    result.message = `Global Steal! Stolen cards: ${stolenList.map(s => `${s.name} from ${s.from}`).join(', ')}`;
                } else {
                    result.message = 'Global Steal used, but opponents had no power-ups to steal!';
                }
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
