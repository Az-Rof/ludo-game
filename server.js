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
            res.writeHead(200, { 'Content-Type': contentType });
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
                
                // If next player is bot, trigger bot turn
                startGameLoop(roomCode);
                return;
            }
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
            game.endTurn();
            io.to(roomCode).emit('turnEnded', {
                nextPlayer: game.currentPlayer,
                state: game.getState()
            });
            
            // If next player is bot, trigger bot turn
            startGameLoop(roomCode);
        }, 500);
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
