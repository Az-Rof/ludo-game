const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const Room = require('./server/game/Room');
const LudoGame = require('./server/game/Ludo');
const Bot = require('./server/game/Bot');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// Create HTTP server
const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0]; // Strip query params
    
    // POST /save-board — persist board layout to file (localhost only)
    if (req.method === 'POST' && urlPath === '/save-board') {
        const addr = req.socket.remoteAddress;
        if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { layout } = JSON.parse(body);
                if (!layout || !Array.isArray(layout)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid layout' }));
                    return;
                }
                // Generate createLayout code
                let code = '    createLayout() {\n        var grid = Array(15).fill(null).map(function() { return Array(15).fill(0); });\n';
                for (let r = 0; r < 15; r++) {
                    for (let c = 0; c < 15; c++) {
                        if (layout[r] && layout[r][c] !== 0) {
                            code += '        grid[' + r + '][' + c + '] = ' + layout[r][c] + ';\n';
                        }
                    }
                }
                code += '        return grid;\n    }';
                
                const boardPath = path.join(__dirname, 'public', 'js', 'board.js');
                const content = fs.readFileSync(boardPath, 'utf8');
                const startMarker = 'createLayout() {';
                const endMarker = '\n    resize() {';
                const startIdx = content.indexOf(startMarker);
                const endIdx = content.indexOf(endMarker);
                
                if (startIdx === -1 || endIdx === -1) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Marker not found' }));
                    return;
                }
                
                const newContent = content.slice(0, startIdx) + code + content.slice(endIdx);
                fs.writeFileSync(boardPath, newContent);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content);
        }
    });
});

// Create Socket.IO server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Game state
const rooms = new Map();
const playerRooms = new Map(); // socketId -> roomCode
const games = new Map(); // roomCode -> LudoGame
const bots = new Map(); // roomCode -> Bot[]

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create room
    socket.on('createRoom', (data) => {
        const code = generateRoomCode();
        const room = new Room(code);
        const player = { name: data.name, socketId: socket.id };
        
        const result = room.addPlayer(player);
        if (result.success) {
            rooms.set(code, room);
            playerRooms.set(socket.id, code);
            socket.join(code);
            
            socket.emit('roomCreated', { 
                success: true, 
                code: code,
                player: { name: player.name, color: player.color }
            });
            
            console.log(`Room ${code} created by ${data.name}`);
        } else {
            socket.emit('roomCreated', { success: false, error: result.error });
        }
    });
    
    // Join room
    socket.on('joinRoom', (data) => {
        const room = rooms.get(data.code);
        if (!room) {
            socket.emit('roomJoined', { success: false, error: 'Room not found' });
            return;
        }
        
        const player = { name: data.name, socketId: socket.id };
        const result = room.addPlayer(player);
        
        if (result.success) {
            playerRooms.set(socket.id, data.code);
            socket.join(data.code);
            
            socket.emit('roomJoined', { 
                success: true, 
                code: data.code,
                player: { name: player.name, color: player.color },
                players: room.players.map(p => ({ name: p.name, color: p.color }))
            });
            
            // Notify other players
            socket.to(data.code).emit('playerJoined', {
                player: { name: player.name, color: player.color },
                players: room.players.map(p => ({ name: p.name, color: p.color }))
            });
            
            console.log(`${data.name} joined room ${data.code}`);
        } else {
            socket.emit('roomJoined', { success: false, error: result.error });
        }
    });
    
    // Start game
    socket.on('startGame', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || !room.canStart()) {
            socket.emit('gameStarted', { success: false, error: 'Cannot start game' });
            return;
        }
        
        room.started = true;
        
        // Create game instance
        const game = new LudoGame(room.players.length);
        room.players.forEach((player, index) => {
            game.players[index].name = player.name;
            game.players[index].socketId = player.socketId;
            game.players[index].isBot = player.isBot || false;
        });
        
        games.set(roomCode, game);
        
        // Create bots if needed
        const gameBots = [];
        room.players.forEach((player, index) => {
            if (player.isBot) {
                gameBots.push(new Bot(game, index));
            }
        });
        bots.set(roomCode, gameBots);
        
        // Emit game started to all players
        io.to(roomCode).emit('gameStarted', {
            success: true,
            state: game.getState(),
            players: room.players.map(p => ({ name: p.name, color: p.color, isBot: p.isBot }))
        });
        
        console.log(`Game started in room ${roomCode}`);
        
        // Start the game loop
        startGameLoop(roomCode);
    });
    
    // Add bot
    socket.on('addBot', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || room.started) {
            socket.emit('botAdded', { success: false, error: 'Cannot add bot' });
            return;
        }
        
        const botName = data.name || `Bot ${room.players.length + 1}`;
        const botPlayer = { 
            name: botName, 
            socketId: null, 
            isBot: true 
        };
        
        const result = room.addPlayer(botPlayer);
        
        if (result.success) {
            io.to(roomCode).emit('playerJoined', {
                player: { name: botName, color: botPlayer.color, isBot: true },
                players: room.players.map(p => ({ name: p.name, color: p.color, isBot: p.isBot }))
            });
            
            socket.emit('botAdded', { success: true, bot: { name: botName, color: botPlayer.color } });
            console.log(`Bot ${botName} added to room ${roomCode}`);
        } else {
            socket.emit('botAdded', { success: false, error: result.error });
        }
    });
    
    // Roll dice
    socket.on('rollDice', () => {
        const roomCode = playerRooms.get(socket.id);
        const game = games.get(roomCode);
        
        console.log(`rollDice called by ${socket.id} in room ${roomCode}`);
        console.log(`Game exists: ${!!game}`);
        if (game) {
            console.log(`canRoll: ${game.canRoll(socket.id)}`);
            console.log(`Current player: ${game.currentPlayer}`);
            game.players.forEach((p, i) => {
                console.log(`Player ${i}: ${p.name}, socketId: ${p.socketId}`);
            });
        }
        
        if (!game || !game.canRoll(socket.id)) {
            socket.emit('rollResult', { success: false, error: 'Cannot roll' });
            return;
        }
        
        const diceValue = game.rollDice();
        
        io.to(roomCode).emit('diceRolled', {
            playerId: game.currentPlayer,
            value: diceValue,
            playerName: game.getCurrentPlayer().name
        });
        
        console.log(`Player ${game.getCurrentPlayer().name} rolled ${diceValue} in room ${roomCode}`);
    });
    
    // Move token
    socket.on('moveToken', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const game = games.get(roomCode);
        
        if (!game) {
            socket.emit('moveResult', { success: false, error: 'No game' });
            return;
        }
        
        const player = game.getCurrentPlayer();
        if (player.socketId !== socket.id) {
            socket.emit('moveResult', { success: false, error: 'Not your turn' });
            return;
        }
        
        // Handle "no moves" case (tokenIndex = -1)
        if (data.tokenIndex === -1) {
            const selectable = game.getSelectableTokens(player);
            if (selectable.length === 0) {
                game.endTurn();
                io.to(roomCode).emit('turnEnded', {
                    nextPlayer: game.currentPlayer,
                    state: game.getState()
                });
                startGameLoop(roomCode);
                return;
            }
            socket.emit('moveResult', { success: false, error: 'Selectable tokens exist' });
            return;
        }
        
        if (!game.canMoveToken(player, data.tokenIndex)) {
            socket.emit('moveResult', { success: false, error: 'Cannot move this token' });
            return;
        }
        
        const result = game.moveToken(player, data.tokenIndex);
        
        io.to(roomCode).emit('tokenMoved', {
            playerId: player.id,
            tokenId: data.tokenIndex,
            result: result,
            state: game.getState()
        });
        
        // Handle capture
        if (result.captured) {
            io.to(roomCode).emit('tokenCaptured', {
                captures: result.captured,
                capturer: { playerId: player.id, playerName: player.name }
            });
        }
        
        // Handle shield absorption messages
        if (game.shieldAbsorbs && game.shieldAbsorbs.length > 0) {
            game.shieldAbsorbs.forEach(absorb => {
                const victim = game.players.find(p => p.id === absorb.playerId);
                io.to(roomCode).emit('powerupMessage', {
                    message: `🛡️ ${victim.name}'s token shield absorbed a capture from ${player.name}!`
                });
            });
            game.shieldAbsorbs = []; // Clear
        }
        
        // Check win
        if (game.gameOver) {
            io.to(roomCode).emit('gameOver', {
                winner: { id: player.id, name: player.name, color: player.color },
                state: game.getState()
            });
            return;
        }
        
        // End turn after delay
        setTimeout(() => {
            if (player.doubleMoveActive) {
                player.doubleMoveActive = false; // consume it
                io.to(roomCode).emit('powerupMessage', {
                    message: `⚡ ${player.name} is making a second move from Double Move!`
                });
                io.to(roomCode).emit('doubleMoveActive', {
                    playerId: player.id,
                    state: game.getState()
                });
                return;
            }

            const hadExtraTurn = game.diceValue === 6;
            game.endTurn();
            
            if (game.powerupRelocated) {
                game.powerupRelocated = false;
                io.to(roomCode).emit('powerupMessage', {
                    message: "🌀 Power-up squares have relocated to new tiles!"
                });
            }
            
            if (hadExtraTurn) {
                io.to(roomCode).emit('extraTurn', {
                    playerId: player.id,
                    state: game.getState()
                });
            } else {
                io.to(roomCode).emit('turnEnded', {
                    nextPlayer: game.currentPlayer,
                    state: game.getState()
                });
            }
            
            startGameLoop(roomCode);
        }, 500);
    });
    
    function getRandomPowerupParams(game, player, type) {
        switch (type) {
            case 'DICE_CONTROL':
                return { chosenValue: Math.floor(Math.random() * 6) + 1 };
            case 'SKIP_TURN':
                const opps = game.players.filter(p => p.id !== player.id);
                if (opps.length === 0) return {};
                return { targetPlayerId: opps[Math.floor(Math.random() * opps.length)].id };
            case 'STEAL':
                const oppsWithCards = game.players.filter(p => p.id !== player.id && p.powerups && p.powerups.length > 0);
                if (oppsWithCards.length === 0) return {};
                return { targetPlayerId: oppsWithCards[Math.floor(Math.random() * oppsWithCards.length)].id };
            case 'TELEPORT':
                const teleTokens = player.tokens.map((t, idx) => ({ t, idx })).filter(item => !item.t.finished);
                if (teleTokens.length === 0) return {};
                return { 
                    tokenIndex: teleTokens[Math.floor(Math.random() * teleTokens.length)].idx,
                    targetPosition: Math.floor(Math.random() * 52)
                };
            case 'SWAP_TOKENS':
                const ownActive = player.tokens.map((t, idx) => ({ t, idx })).filter(item => item.t.position >= 0 && item.t.position < 52 && !item.t.homeColumn && !item.t.finished);
                const oppActive = [];
                game.players.forEach(p => { 
                    if (p.id !== player.id) {
                        p.tokens.forEach((t, idx) => { 
                            if (t.position >= 0 && t.position < 52 && !t.homeColumn && !t.finished) {
                                oppActive.push({ pId: p.id, idx }); 
                            }
                        }); 
                    }
                });
                if (ownActive.length === 0 || oppActive.length === 0) return {};
                const ownChosen = ownActive[Math.floor(Math.random() * ownActive.length)].idx;
                const oppChosen = oppActive[Math.floor(Math.random() * oppActive.length)];
                return {
                    ownTokenIndex: ownChosen,
                    opponentPlayerId: oppChosen.pId,
                    opponentTokenIndex: oppChosen.idx
                };
            case 'SHIELD':
                const shieldTokens = player.tokens.map((t, idx) => ({ t, idx })).filter(item => !item.t.finished);
                if (shieldTokens.length === 0) return {};
                return { tokenIndex: shieldTokens[Math.floor(Math.random() * shieldTokens.length)].idx };
            case 'BOMB':
                const occupied = [];
                game.players.forEach(p => p.tokens.forEach(t => { if (t.position >= 0 && t.position < 52 && !t.homeColumn && !t.finished) occupied.push(t.position); }));
                const targetPosition = occupied.length > 0 ? occupied[Math.floor(Math.random() * occupied.length)] : Math.floor(Math.random() * 52);
                return { targetPosition };
            default:
                return {};
        }
    }
    // Use powerup
    socket.on('usePowerup', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const game = games.get(roomCode);
        
        if (!game) {
            socket.emit('powerupResult', { success: false, error: 'No game' });
            return;
        }
        
        const player = game.getPlayerBySocketId(socket.id);
        if (!player) {
            socket.emit('powerupResult', { success: false, error: 'Player not found' });
            return;
        }
        
        const powerup = player.powerups.find(p => p.id === data.powerupId);
        if (!powerup) {
            socket.emit('powerupResult', { success: false, error: 'Powerup not found' });
            return;
        }
        
        const isTargetable = ['TELEPORT', 'STEAL', 'SKIP_TURN', 'SHIELD', 'BOMB', 'DICE_CONTROL', 'SWAP_TOKENS'].includes(powerup.type);
        
        // 1. If powerup is targetable and player hasn't passed target params yet (first use click)
        if (isTargetable && (!data.params || Object.keys(data.params).length === 0)) {
            // Roll gacha target type: 50% Selected, 50% Random
            const targetGacha = Math.random() < 0.5 ? 'selected' : 'random';
            
            if (targetGacha === 'selected') {
                // Tell user selection is required
                socket.emit('powerupTargetRequired', { powerupId: data.powerupId, powerupType: powerup.type });
                io.to(roomCode).emit('powerupMessage', {
                    message: `🔮 ${player.name} is targeting ${powerup.name}...`
                });
                return;
            } else {
                // Random target!
                const params = getRandomPowerupParams(game, player, powerup.type);
                const result = game.usePowerup(player, data.powerupId, params);
                
                if (result.applied) {
                    if (powerup.type === 'EXTRA_ROLL') {
                        game.diceValue = 0;
                    }
                    io.to(roomCode).emit('powerupUsed', {
                        playerId: player.id,
                        playerName: player.name,
                        playerColor: player.color,
                        powerupType: powerup.type,
                        message: `🎲 (Random Target!) ${result.message}`,
                        effect: result.effect,
                        state: game.getState()
                    });
                    
                    if (result.effect && result.effect.captured) {
                        io.to(roomCode).emit('tokenCaptured', {
                            captures: result.effect.captured,
                            capturer: { playerId: player.id, playerName: player.name }
                        });
                    }
                    if (game.shieldAbsorbs && game.shieldAbsorbs.length > 0) {
                        game.shieldAbsorbs.forEach(absorb => {
                            const victim = game.players.find(p => p.id === absorb.playerId);
                            io.to(roomCode).emit('powerupMessage', {
                                message: `🛡️ ${victim.name}'s token shield absorbed a hit from ${player.name}!`
                            });
                        });
                        game.shieldAbsorbs = [];
                    }
                } else {
                    // Fallback to manual selection if random choice failed to find valid targets
                    socket.emit('powerupTargetRequired', { powerupId: data.powerupId, powerupType: powerup.type });
                    io.to(roomCode).emit('powerupMessage', {
                        message: `🔮 Random target for ${powerup.name} was unavailable. ${player.name} is choosing manually...`
                    });
                }
                return;
            }
        }
        
        // 2. Non-targetable, or target params already selected by user
        const result = game.usePowerup(player, data.powerupId, data.params || {});
        
        if (result.applied) {
            if (powerup.type === 'EXTRA_ROLL') {
                game.diceValue = 0;
            }
            io.to(roomCode).emit('powerupUsed', {
                playerId: player.id,
                playerName: player.name,
                playerColor: player.color,
                powerupType: powerup.type,
                message: result.message,
                effect: result.effect,
                state: game.getState()
            });
            
            if (result.effect && result.effect.captured) {
                io.to(roomCode).emit('tokenCaptured', {
                    captures: result.effect.captured,
                    capturer: { playerId: player.id, playerName: player.name }
                });
            }
            if (game.shieldAbsorbs && game.shieldAbsorbs.length > 0) {
                game.shieldAbsorbs.forEach(absorb => {
                    const victim = game.players.find(p => p.id === absorb.playerId);
                    io.to(roomCode).emit('powerupMessage', {
                        message: `🛡️ ${victim.name}'s token shield absorbed a hit from ${player.name}!`
                    });
                });
                game.shieldAbsorbs = [];
            }
            
            console.log(`Player ${player.name} successfully used ${powerup.type} in room ${roomCode}`);
        } else {
            socket.emit('powerupResult', { success: false, error: result.message || 'Could not apply power-up' });
        }
    });
    
    // Chat message
    socket.on('chatMessage', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.getPlayer(socket.id);
        if (!player) return;
        
        io.to(roomCode).emit('chatMessage', {
            playerName: player.name,
            playerColor: player.color,
            message: data.message,
            timestamp: Date.now()
        });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const roomCode = playerRooms.get(socket.id);
        
        if (roomCode) {
            const room = rooms.get(roomCode);
            if (room) {
                const result = room.removePlayer(socket.id);
                if (result.success) {
                    io.to(roomCode).emit('playerLeft', {
                        player: { name: result.player.name, color: result.player.color },
                        players: room.players.map(p => ({ name: p.name, color: p.color }))
                    });
                    
                    // If room is empty, clean up
                    if (room.players.length === 0) {
                        rooms.delete(roomCode);
                        games.delete(roomCode);
                        bots.delete(roomCode);
                        console.log(`Room ${roomCode} deleted (empty)`);
                    }
                }
            }
            
            playerRooms.delete(socket.id);
        }
        
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// Game loop for bot turns
async function startGameLoop(roomCode) {
    const game = games.get(roomCode);
    if (!game || game.gameOver) return;
    
    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer.isBot) return; // Only bots auto-play
    
    const gameBots = bots.get(roomCode);
    const bot = gameBots?.find(b => b.playerId === currentPlayer.id);
    
    if (bot) {
        await bot.takeTurn(io, roomCode);
        
        // Check if next player is also a bot
        if (!game.gameOver) {
            const nextPlayer = game.getCurrentPlayer();
            if (nextPlayer.isBot) {
                setTimeout(() => startGameLoop(roomCode), 500);
            }
        }
    }
}

// Start server
server.listen(PORT, () => {
    console.log(`Ludo server running at http://localhost:${PORT}`);
});
