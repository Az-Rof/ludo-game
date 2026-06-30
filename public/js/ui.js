// Ludo UI Manager (Multiplayer)

class LudoUI {
    constructor() {
        this.screens = {
            lobby: document.getElementById('lobby'),
            waitingRoom: document.getElementById('waiting-room'),
            game: document.getElementById('game'),
            victory: document.getElementById('victory')
        };
        
        // Lobby elements
        this.usernameInput = document.getElementById('username');
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        
        // Waiting room elements
        this.roomCodeDisplay = document.getElementById('room-code');
        this.waitingPlayers = document.getElementById('waiting-players');
        this.addBotBtn = document.getElementById('add-bot-btn');
        this.startGameBtn = document.getElementById('start-game-btn');
        
        // Game elements
        this.playerBar = document.getElementById('player-bar');
        this.statusElement = document.getElementById('status');
        this.winnerName = document.getElementById('winner-name');
        
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send-btn');
        
        // State
        this.username = '';
        this.isLocalGame = false;
        this.localGame = null;
        
        // Socket client
        this.socketClient = new SocketClient();
        this.setupSocketCallbacks();
        this.socketClient.connect();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Lobby
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        
        // Waiting room
        this.addBotBtn.addEventListener('click', () => this.addBot());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        
        // Chat
        this.chatSendBtn.addEventListener('click', () => this.sendChat());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
        
        // Play again
        document.getElementById('play-again-btn')?.addEventListener('click', () => {
            location.reload();
        });
    }
    
    setupSocketCallbacks() {
        this.socketClient.onRoomCreated = (data) => {
            if (data.success) {
                this.showWaitingRoom(data.code, [data.player]);
            } else {
                this.showLobbyError(data.error);
            }
        };
        
        this.socketClient.onRoomJoined = (data) => {
            if (data.success) {
                this.showWaitingRoom(data.code, data.players);
            } else {
                this.showLobbyError(data.error);
            }
        };
        
        this.socketClient.onPlayerJoined = (data) => {
            this.updateWaitingPlayers(data.players);
            this.addSystemChatMessage(`${data.player.name} joined the room`);
        };
        
        this.socketClient.onPlayerLeft = (data) => {
            this.updateWaitingPlayers(data.players);
            this.addSystemChatMessage(`${data.player.name} left the room`);
        };
        
        this.socketClient.onGameStarted = (data) => {
            if (data.success) {
                this.initMultiplayerGame(data);
            }
        };
        
        this.socketClient.onDiceRolled = (data) => {
            window.dice?.animateToValue(data.value);
            
            // Update local game state
            if (window.game) {
                window.game.diceValue = data.value;
            }
            
            this.addSystemChatMessage(`${data.playerName} rolled ${data.value}`);
            
            // If it's our turn, show selectable tokens
            const isMyTurn = this.socketClient.player && 
                             data.playerName === this.socketClient.player.name;
            if (isMyTurn) {
                setTimeout(() => {
                    this.renderBoard();
                    const player = window.game.getCurrentPlayer();
                    const selectable = window.game.getSelectableTokens(player);
                    if (selectable.length > 0) {
                        this.highlightSelectableTokens(selectable);
                    } else {
                        // No moves - end turn automatically
                        setTimeout(() => {
                            this.socketClient.socket.emit('moveToken', { tokenIndex: -1 });
                        }, 500);
                    }
                }, 700);
            }
        };
        
        this.socketClient.onTokenMoved = (data) => {
            // Update game state
            this.updateGameState(data.state);
            // Animate move
            this.animateMultiplayerMove(data);
        };
        
        this.socketClient.onTokenCaptured = (data) => {
            data.captures.forEach(capture => {
                const player = window.game?.players[capture.playerId];
                if (player) {
                    this.addSystemChatMessage(`💥 ${data.capturer.playerName} captured ${player.name}'s token!`);
                }
            });
        };
        
        this.socketClient.onTurnEnded = (data) => {
            this.updateGameState(data.state);
            this.updatePlayerBar();
            this.updateStatus();
            this.renderBoard();
        };
        
        this.socketClient.onExtraTurn = (data) => {
            this.updateGameState(data.state);
            this.updateStatus();
            this.renderBoard();
            this.addSystemChatMessage('Extra turn! Rolled a 6');
        };
        
        this.socketClient.onGameOver = (data) => {
            this.winnerName.textContent = `${data.winner.name} (${data.winner.color.toUpperCase()})`;
            this.winnerName.style.color = this.getColorHex(data.winner.color);
            this.showScreen('victory');
        };
        
        this.socketClient.onNoMoves = (data) => {
            this.addSystemChatMessage(`${data.playerName} has no moves available`);
        };
        
        this.socketClient.onChatMessage = (data) => {
            this.addChatMessage(data.playerName, data.playerColor, data.message);
        };
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    }
    
    showLobbyError(error) {
        // Show error message
        alert(error);
    }
    
    createRoom() {
        this.username = this.usernameInput.value.trim() || 'Player';
        this.socketClient.createRoom(this.username);
    }
    
    joinRoom() {
        this.username = this.usernameInput.value.trim() || 'Player';
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        
        if (!roomCode) {
            this.showLobbyError('Please enter a room code');
            return;
        }
        
        this.socketClient.joinRoom(roomCode, this.username);
    }
    
    showWaitingRoom(roomCode, players) {
        this.roomCodeDisplay.textContent = roomCode;
        this.updateWaitingPlayers(players);
        this.showScreen('waitingRoom');
    }
    
    updateWaitingPlayers(players) {
        this.waitingPlayers.innerHTML = '';
        
        players.forEach(player => {
            const el = document.createElement('div');
            el.className = `waiting-player${player.isBot ? ' is-bot' : ''}`;
            
            const dot = document.createElement('div');
            dot.className = 'player-dot';
            dot.style.backgroundColor = this.getColorHex(player.color);
            
            const name = document.createElement('span');
            name.textContent = player.name;
            
            el.appendChild(dot);
            el.appendChild(name);
            this.waitingPlayers.appendChild(el);
        });
        
        // Enable start button if 2+ players
        this.startGameBtn.disabled = players.length < 2;
    }
    
    addBot() {
        const botNumber = this.waitingPlayers.children.length + 1;
        this.socketClient.addBot(`Bot ${botNumber}`);
    }
    
    startGame() {
        this.socketClient.startGame();
    }
    
    initMultiplayerGame(data) {
        // Create local game state from server state
        this.isLocalGame = false;
        
        // Initialize game with server state
        window.game = new LudoGame(data.players.length);
        data.players.forEach((player, index) => {
            window.game.players[index].name = player.name;
            window.game.players[index].color = player.color;
            window.game.players[index].isBot = player.isBot || false;
        });
        
        // Create board
        window.board = new LudoBoard('board-canvas');
        window.board.onResize = () => this.renderBoard();
        
        // Create dice
        window.dice = new LudoDice();
        window.dice.setMultiplayer(true);
        
        // Setup player bar
        this.setupPlayerBar();
        
        // Update state from server
        this.updateGameState(data.state);
        
        // Show game screen
        this.showScreen('game');
        this.updateStatus();
        this.renderBoard();
        
        this.addSystemChatMessage('Game started!');
    }
    
    updateGameState(serverState) {
        if (!window.game) return;
        
        window.game.currentPlayer = serverState.currentPlayer;
        window.game.diceValue = serverState.diceValue;
        window.game.gameOver = serverState.gameOver;
        
        if (serverState.winner) {
            window.game.winner = window.game.players[serverState.winner.id];
        }
        
        serverState.players.forEach((playerState, index) => {
            if (window.game.players[index]) {
                window.game.players[index].tokens = playerState.tokens.map(t => ({
                    id: t.id,
                    position: t.position,
                    homeColumn: t.homeColumn,
                    finished: t.finished
                }));
            }
        });
    }
    
    setupPlayerBar() {
        this.playerBar.innerHTML = '';
        
        window.game.players.forEach((player, index) => {
            const indicator = document.createElement('div');
            indicator.className = 'player-indicator';
            indicator.id = `player-${index}`;
            indicator.style.color = this.getColorHex(player.color);
            
            const dot = document.createElement('div');
            dot.className = 'player-dot';
            dot.style.backgroundColor = this.getColorHex(player.color);
            
            const name = document.createElement('span');
            name.textContent = player.name;
            
            indicator.appendChild(dot);
            indicator.appendChild(name);
            this.playerBar.appendChild(indicator);
        });
        
        this.updatePlayerBar();
    }
    
    updatePlayerBar() {
        if (!window.game) return;
        
        window.game.players.forEach((player, index) => {
            const indicator = document.getElementById(`player-${index}`);
            if (indicator) {
                if (index === window.game.currentPlayer) {
                    indicator.classList.add('active');
                } else {
                    indicator.classList.remove('active');
                }
            }
        });
    }
    
    getColorHex(color) {
        const colors = {
            red: '#e74c3c',
            blue: '#3498db',
            green: '#2ecc71',
            yellow: '#f1c40f'
        };
        return colors[color] || '#fff';
    }
    
    updateStatus() {
        if (!window.game) return;
        
        const player = window.game.getCurrentPlayer();
        
        if (window.game.gameOver) {
            this.statusElement.textContent = `🏆 ${window.game.winner.name} WINS!`;
            this.statusElement.style.color = this.getColorHex(window.game.winner.color);
            return;
        }
        
        const isMyTurn = this.socketClient.player && 
                         player.name === this.socketClient.player.name;
        
        if (isMyTurn) {
            this.statusElement.textContent = `Your turn, ${player.name}!`;
            window.dice?.enable();
        } else if (player.isBot) {
            this.statusElement.textContent = `${player.name} is thinking...`;
        } else {
            this.statusElement.textContent = `${player.name}'s turn`;
        }
        
        this.statusElement.style.color = this.getColorHex(player.color);
    }
    
    animateMultiplayerMove(data) {
        // Simple animation - just update the board
        this.renderBoard();
    }
    
    renderBoard() {
        // Clear previous tokens
        document.querySelectorAll('.token').forEach(t => t.remove());
        
        // Group tokens by tile to handle stacking
        const tileMap = new Map();
        const tokenList = [];
        window.game.players.forEach((player, playerIndex) => {
            player.tokens.forEach((token, tokenIndex) => {
                if (token.finished) return;
                const pos = window.game.getTokenPosition(playerIndex, tokenIndex);
                let key = null;
                if (pos.type === 'track') {
                    const g = window.board.trackToGrid(pos.position);
                    key = `t-${g.r}-${g.c}`;
                } else if (pos.type === 'homeColumn') {
                    const g = window.board.getHomeColumnPosition(pos.base, pos.position);
                    key = `t-${g.r}-${g.c}`;
                } else if (pos.type === 'home') {
                    const g = window.board.getHomeBasePosition(pos.base, pos.index);
                    key = `t-${g.r}-${g.c}`;
                }
                if (!key) return;
                tokenList.push({ playerIndex, tokenIndex, color: player.color, key });
            });
        });
        
        const counts = {};
        tokenList.forEach(t => { counts[t.key] = (counts[t.key] || 0) + 1; });
        
        const placed = {};
        tokenList.forEach(t => {
            placed[t.key] = (placed[t.key] || 0) + 1;
            this.createTokenElement(t.playerIndex, t.tokenIndex, t.color, placed[t.key], counts[t.key]);
        });
        
        // Redraw board background
        window.board?.draw();
    }
    
    createTokenElement(playerIndex, tokenIndex, color, stackIndex, stackCount) {
        const token = window.game.players[playerIndex].tokens[tokenIndex];
        const pos = window.game.getTokenPosition(playerIndex, tokenIndex);
        
        let x, y;
        
        if (pos.type === 'track') {
            const gridPos = window.board.trackToGrid(pos.position);
            x = gridPos.c * window.board.cellSize;
            y = gridPos.r * window.board.cellSize;
        } else if (pos.type === 'homeColumn') {
            const colPos = window.board.getHomeColumnPosition(pos.base, pos.position);
            x = colPos.c * window.board.cellSize;
            y = colPos.r * window.board.cellSize;
        } else if (pos.type === 'home') {
            const basePos = window.board.getHomeBasePosition(pos.base, pos.index);
            x = basePos.c * window.board.cellSize;
            y = basePos.r * window.board.cellSize;
        } else if (pos.type === 'finished') {
            return; // Don't render finished tokens
        } else {
            return;
        }
        
        const cs = window.board.cellSize;
        let size = cs * 0.7;
        let offX = cs * 0.15;
        let offY = cs * 0.15;
        
        // Stacked tokens: shrink + offset each so all visible
        if (stackCount > 1) {
            size = cs * 0.5;
            const cols = stackCount <= 4 ? 2 : 3;
            const col = (stackIndex - 1) % cols;
            const row = Math.floor((stackIndex - 1) / cols);
            offX = cs * 0.08 + col * (cs * 0.44);
            offY = cs * 0.08 + row * (cs * 0.44);
        }
        
        const tokenElement = document.createElement('div');
        tokenElement.className = `token ${color}`;
        tokenElement.id = `token-${playerIndex}-${tokenIndex}`;
        tokenElement.dataset.playerIndex = playerIndex;
        tokenElement.dataset.tokenIndex = tokenIndex;
        tokenElement.style.left = `${x + offX}px`;
        tokenElement.style.top = `${y + offY}px`;
        tokenElement.style.width = `${size}px`;
        tokenElement.style.height = `${size}px`;
        
        // Click handler for human players
        tokenElement.addEventListener('click', () => {
            const currentPlayer = window.game.getCurrentPlayer();
            const isMyTurn = this.socketClient.player && 
                             currentPlayer.name === this.socketClient.player.name;
            
            if (isMyTurn && window.game.diceValue > 0) {
                this.socketClient.moveToken(tokenIndex);
            }
        });
        
        document.querySelector('.board-wrapper').appendChild(tokenElement);
    }
    
    highlightSelectableTokens(tokenIndices) {
        // Remove existing highlights
        document.querySelectorAll('.token').forEach(t => t.classList.remove('selectable'));
        
        // Add highlight to selectable tokens
        const currentPlayer = window.game.currentPlayer;
        tokenIndices.forEach(index => {
            const tokenEl = document.getElementById(`token-${currentPlayer}-${index}`);
            if (tokenEl) {
                tokenEl.classList.add('selectable');
            }
        });
    }
    
    // Chat functions
    sendChat() {
        const message = this.chatInput.value.trim();
        if (!message) return;
        
        this.socketClient.sendChat(message);
        this.chatInput.value = '';
    }
    
    addChatMessage(playerName, playerColor, message) {
        const el = document.createElement('div');
        el.className = 'chat-message';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.style.color = this.getColorHex(playerColor);
        nameSpan.textContent = playerName + ':';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = ' ' + message;
        
        el.appendChild(nameSpan);
        el.appendChild(textSpan);
        this.chatMessages.appendChild(el);
        
        // Auto-scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    addSystemChatMessage(message) {
        const el = document.createElement('div');
        el.className = 'chat-message system';
        el.textContent = message;
        this.chatMessages.appendChild(el);
        
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}
