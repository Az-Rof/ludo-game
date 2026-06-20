// Room Management

class Room {
    constructor(code) {
        this.code = code;
        this.players = [];
        this.maxPlayers = 4;
        this.started = false;
        this.createdAt = Date.now();
    }
    
    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }
        if (this.started) {
            return { success: false, error: 'Game already started' };
        }
        
        player.color = ['red', 'yellow', 'blue', 'green'][this.players.length];
        player.socketId = player.socketId || null;
        this.players.push(player);
        
        return { success: true, color: player.color };
    }
    
    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            const removed = this.players.splice(index, 1)[0];
            return { success: true, player: removed };
        }
        return { success: false, error: 'Player not found' };
    }
    
    getPlayer(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }
    
    getPlayerByColor(color) {
        return this.players.find(p => p.color === color);
    }
    
    isFull() {
        return this.players.length >= this.maxPlayers;
    }
    
    canStart() {
        return this.players.length >= 2 && !this.started;
    }
    
    toJSON() {
        return {
            code: this.code,
            players: this.players.map(p => ({
                name: p.name,
                color: p.color,
                socketId: p.socketId,
                isBot: p.isBot || false
            })),
            started: this.started,
            maxPlayers: this.maxPlayers
        };
    }
}

module.exports = Room;
