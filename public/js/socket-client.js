// Socket.IO Client Connection

class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomCode = null;
        this.player = null;
        
        // Event callbacks
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStarted = null;
        this.onDiceRolled = null;
        this.onTokenMoved = null;
        this.onTokenCaptured = null;
        this.onTurnEnded = null;
        this.onExtraTurn = null;
        this.onGameOver = null;
        this.onChatMessage = null;
        this.onNoMoves = null;
        this.onPowerupUsed = null;
        this.onDoubleMoveActive = null;
        this.onPowerupMessage = null;
        this.onPowerupTargetRequired = null;
    }
    
    connect() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Disconnected from server');
        });
        
        this.socket.on('powerupTargetRequired', (data) => {
            if (this.onPowerupTargetRequired) this.onPowerupTargetRequired(data);
        });
        
        // Room events
        this.socket.on('roomCreated', (data) => {
            if (data.success) {
                this.roomCode = data.code;
                this.player = data.player;
            }
            if (this.onRoomCreated) this.onRoomCreated(data);
        });
        
        this.socket.on('roomJoined', (data) => {
            if (data.success) {
                this.roomCode = data.code;
                this.player = data.player;
            }
            if (this.onRoomJoined) this.onRoomJoined(data);
        });
        
        this.socket.on('playerJoined', (data) => {
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });
        
        this.socket.on('playerLeft', (data) => {
            if (this.onPlayerLeft) this.onPlayerLeft(data);
        });
        
        // Game events
        this.socket.on('gameStarted', (data) => {
            if (this.onGameStarted) this.onGameStarted(data);
        });
        
        this.socket.on('diceRolled', (data) => {
            if (this.onDiceRolled) this.onDiceRolled(data);
        });
        
        this.socket.on('tokenMoved', (data) => {
            if (this.onTokenMoved) this.onTokenMoved(data);
        });
        
        this.socket.on('tokenCaptured', (data) => {
            if (this.onTokenCaptured) this.onTokenCaptured(data);
        });
        
        this.socket.on('turnEnded', (data) => {
            if (this.onTurnEnded) this.onTurnEnded(data);
        });
        
        this.socket.on('extraTurn', (data) => {
            if (this.onExtraTurn) this.onExtraTurn(data);
        });
        
        this.socket.on('gameOver', (data) => {
            if (this.onGameOver) this.onGameOver(data);
        });
        
        this.socket.on('noMoves', (data) => {
            if (this.onNoMoves) this.onNoMoves(data);
        });
        
        // Chat events
        this.socket.on('chatMessage', (data) => {
            if (this.onChatMessage) this.onChatMessage(data);
        });
        
        // Power-up events
        this.socket.on('powerupUsed', (data) => {
            if (this.onPowerupUsed) this.onPowerupUsed(data);
        });
        
        this.socket.on('doubleMoveActive', (data) => {
            if (this.onDoubleMoveActive) this.onDoubleMoveActive(data);
        });
        
        this.socket.on('powerupMessage', (data) => {
            if (this.onPowerupMessage) this.onPowerupMessage(data);
        });
    }
    
    createRoom(playerName) {
        this.socket.emit('createRoom', { name: playerName });
    }
    
    joinRoom(roomCode, playerName) {
        this.socket.emit('joinRoom', { code: roomCode, name: playerName });
    }
    
    addBot(botName) {
        this.socket.emit('addBot', { name: botName });
    }
    
    startGame() {
        this.socket.emit('startGame');
    }
    
    rollDice() {
        this.socket.emit('rollDice');
    }
    
    moveToken(tokenIndex) {
        this.socket.emit('moveToken', { tokenIndex: tokenIndex });
    }
    
    sendChat(message) {
        this.socket.emit('chatMessage', { message: message });
    }
    
    usePowerup(powerupId, powerupType, params = {}) {
        if (this.socket) {
            this.socket.emit('usePowerup', { powerupId, powerupType, params });
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}
