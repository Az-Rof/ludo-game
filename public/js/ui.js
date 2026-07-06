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
        
        // Power-up elements
        this.powerupsContainer = document.getElementById('powerups-container');
        this.powerupsList = document.getElementById('powerups-list');
        this.powerupModal = document.getElementById('powerup-modal');
        this.powerupModalTitle = document.getElementById('powerup-modal-title');
        this.powerupModalBody = document.getElementById('powerup-modal-body');
        this.powerupModalCancel = document.getElementById('powerup-modal-cancel');
        this.powerupModalConfirm = document.getElementById('powerup-modal-confirm');
        
        // State
        this.username = '';
        this.isLocalGame = false;
        this.localGame = null;
        this.teleportState = { active: false, powerupId: null, tokenIndex: null };
        this.shieldState = { active: false, powerupId: null };
        this.bombState = { active: false, powerupId: null };
        this.swapState = { active: false, powerupId: null, ownTokenIndex: null };
        
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
        
        // Power-up modal cancel
        this.powerupModalCancel?.addEventListener('click', () => {
            this.powerupModal.style.display = 'none';
        });
        
        // Play again
        document.getElementById('play-again-btn')?.addEventListener('click', () => {
            location.reload();
        });
    }
    
    setupSocketCallbacks() {
        this.socketClient.onRoomCreated = (data) => {
            this.clearLoading(this.createRoomBtn);
            if (data.success) {
                this.showWaitingRoom(data.code, [data.player]);
            } else {
                this.showLobbyError(data.error);
            }
        };
        
        this.socketClient.onRoomJoined = (data) => {
            this.clearLoading(this.joinRoomBtn);
            if (data.success) {
                this.showWaitingRoom(data.code, data.players);
            } else {
                this.showLobbyError(data.error);
            }
        };
        
        this.socketClient.onPlayerJoined = (data) => {
            this.clearLoading(this.addBotBtn);
            this.updateWaitingPlayers(data.players);
            this.addSystemChatMessage(`${data.player.name} joined the room`);
        };
        
        this.socketClient.onPlayerLeft = (data) => {
            this.updateWaitingPlayers(data.players);
            this.addSystemChatMessage(`${data.player.name} left the room`);
        };
        
        this.socketClient.onGameStarted = (data) => {
            this.clearLoading(this.startGameBtn);
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

            const captureInfo = data.result.captured;
            const hasCapture = captureInfo && captureInfo.length > 0;

            // Animate capture first, then move, then final render
            if (hasCapture) {
                this.animateCapture(data, () => {
                    this.animateMultiplayerMove(data);
                });
            } else {
                this.animateMultiplayerMove(data);
            }
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
        
        this.socketClient.onPowerupUsed = (data) => {
            this.addSystemChatMessage(`⚡ ${data.playerName} used ${data.powerupType}! ${data.message}`);
            // Animate dice if value was controlled or boosted
            if (data.effect && data.effect.type === 'dice_control') {
                window.dice?.animateToValue(data.effect.value);
            } else if (data.effect && data.effect.type === 'dice_boost') {
                window.dice?.animateToValue(data.effect.newValue);
            }
            
            this.updateGameState(data.state);
            this.renderBoard();
            this.updateStatus();
            
            // If it is our turn, re-evaluate selectables!
            const isMyTurn = this.socketClient.player && 
                             data.playerName === this.socketClient.player.name;
            if (isMyTurn) {
                const player = window.game.getCurrentPlayer();
                const selectable = window.game.getSelectableTokens(player);
                
                // Clear highlights
                document.querySelectorAll('.token').forEach(t => t.classList.remove('selectable', 'selected'));
                
                if (selectable.length > 0) {
                    this.highlightSelectableTokens(selectable);
                } else if (window.game.diceValue > 0) {
                    // Dice value was boosted but no moves are valid, auto-end turn
                    setTimeout(() => {
                        this.socketClient.socket.emit('moveToken', { tokenIndex: -1 });
                    }, 800);
                }
            }
        };
        
        this.socketClient.onDoubleMoveActive = (data) => {
            this.updateGameState(data.state);
            this.renderBoard();
            this.updateStatus();
            
            // Highlight tokens for another move
            const isMyTurn = this.socketClient.player && 
                             window.game.players[data.playerId].name === this.socketClient.player.name;
            if (isMyTurn) {
                const player = window.game.getCurrentPlayer();
                const selectable = window.game.getSelectableTokens(player);
                if (selectable.length > 0) {
                    this.highlightSelectableTokens(selectable);
                }
            }
        };
        
        this.socketClient.onPowerupMessage = (data) => {
            this.addSystemChatMessage(data.message);
        };
        this.socketClient.onPowerupTargetRequired = (data) => {
            const playerObj = window.game.players.find(p => p.name === this.socketClient.player.name);
            if (playerObj) {
                this.engagePowerupTargeting(data.powerupId, data.powerupType, playerObj);
            }
        };
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    }

    setLoading(btn) {
        if (!btn) return;
        btn.disabled = true;
        btn.classList.add('loading');
        btn._origText = btn.textContent;
        btn.textContent = '···';
    }

    clearLoading(btn) {
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove('loading');
        if (btn._origText) btn.textContent = btn._origText;
    }

    showLobbyError(error) {
        // Show error message
        alert(error);
    }
    
    createRoom() {
        this.username = this.usernameInput.value.trim() || 'Player';
        this.setLoading(this.createRoomBtn);
        this.socketClient.createRoom(this.username);
    }
    
    joinRoom() {
        this.username = this.usernameInput.value.trim() || 'Player';
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        
        if (!roomCode) {
            this.showLobbyError('Please enter a room code');
            return;
        }
        
        this.setLoading(this.joinRoomBtn);
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
        this.setLoading(this.addBotBtn);
        this.socketClient.addBot(`Bot ${botNumber}`);
    }
    
    startGame() {
        this.setLoading(this.startGameBtn);
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
        window.dice = new LudoDice3D();
        window.dice.setMultiplayer(true);
        
        // Setup player bar
        this.setupPlayerBar();
        
        // Show powerups panel
        if (this.powerupsContainer) {
            this.powerupsContainer.style.display = 'block';
        }
        
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
        
        if (serverState.powerupSquares) {
            window.game.powerupSquares = serverState.powerupSquares;
            if (window.board) {
                window.board.powerupSquares = serverState.powerupSquares;
            }
        }
        
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
                window.game.players[index].powerups = playerState.powerups || [];
                window.game.players[index].protectedForTurns = playerState.protectedForTurns || 0;
            }
        });
        
        this.renderPowerups();
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
    
    animateCapture(data, callback) {
        const captures = data.result.captured;
        if (!captures || captures.length === 0) { if (callback) callback(); return; }

        let done = 0;
        const total = captures.length;

        captures.forEach(c => {
            const el = document.getElementById(`token-${c.playerId}-${c.tokenId}`);
            if (el) {
                const homePos = window.board.getHomeBasePosition(c.playerId, c.tokenId);
                const cs = window.board.cellSize;
                const cx = homePos.c * cs + cs * 0.15;
                const cy = homePos.r * cs + cs * 0.15;

                el.style.transition = 'all 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                el.style.left = cx + 'px';
                el.style.top = cy + 'px';
                el.style.opacity = '0';
                el.style.transform = 'scale(0.3) rotate(180deg)';

                setTimeout(() => {
                    done++;
                    if (done >= total && callback) callback();
                }, 500);
            } else {
                done++;
                if (done >= total && callback) callback();
            }
        });
    }

    animateMultiplayerMove(data) {
        const { playerId, tokenId, result } = data;
        const el = document.getElementById(`token-${playerId}-${tokenId}`);

        if (result.type === 'move') {
            // Track movement — step-by-step through intermediate cells
            if (!el) { this.renderBoard(); return; }
            el.classList.add('moving');

            const from = result.from;
            const to = result.to;
            let pos = from;
            const steps = [];
            while (pos !== to) {
                pos = (pos + 1) % 52;
                steps.push(pos);
            }

            const cs = window.board.cellSize;
            const boardWrapper = document.querySelector('.board-wrapper');

            let stepIdx = 0;
            const animate = () => {
                if (stepIdx >= steps.length) {
                    // Keep labels visible for 1.5s after animation, then clean
                    setTimeout(() => {
                        document.querySelectorAll('.step-label').forEach(t => t.remove());
                        this.renderBoard();
                    }, 1500);
                    return;
                }

                const g = window.board.trackToGrid(steps[stepIdx]);
                el.style.left = (g.c * cs + cs * 0.15) + 'px';
                el.style.top = (g.r * cs + cs * 0.15) + 'px';

                // Show step number on this cell (accumulates — previous labels stay)
                const label = document.createElement('div');
                label.className = 'step-label';
                label.style.cssText = `position:absolute;left:${g.c * cs + 2}px;top:${g.r * cs + 2}px;font-size:${cs * 0.25}px;font-weight:700;color:#000;opacity:0.75;pointer-events:none;z-index:35;font-family:Arial,sans-serif;`;
                label.textContent = stepIdx + 1;
                boardWrapper.appendChild(label);

                stepIdx++;
                setTimeout(animate, 140);
            };
            animate();

        } else if (result.type === 'enter') {
            // Enter from home — pop onto the start tile with a bounce
            if (!el) { this.renderBoard(); return; }

            const startPos = window.game.startPositions[playerId];
            const g = window.board.trackToGrid(startPos);
            const cs = window.board.cellSize;

            // Start small at home, scale up and move to start tile
            el.style.transition = 'none';
            el.style.transform = 'scale(0.3)';
            el.style.opacity = '0';

            requestAnimationFrame(() => {
                el.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
                el.style.left = (g.c * cs + cs * 0.15) + 'px';
                el.style.top = (g.r * cs + cs * 0.15) + 'px';
                el.style.transform = 'scale(1)';
                el.style.opacity = '1';
                setTimeout(() => {
                    el.style.transition = '';
                    this.renderBoard();
                }, 400);
            });

        } else if (result.type === 'enterHome') {
            // Entering home column — slide from track onto the first home column cell
            if (!el) { this.renderBoard(); return; }
            el.classList.add('moving');

            const colPos = window.board.getHomeColumnPosition(playerId, 0);
            const cs = window.board.cellSize;
            el.style.left = (colPos.c * cs + cs * 0.15) + 'px';
            el.style.top = (colPos.r * cs + cs * 0.15) + 'px';
            setTimeout(() => this.renderBoard(), 200);

        } else if (result.type === 'homeColumn') {
            // Moving within home column
            if (!el) { this.renderBoard(); return; }
            el.classList.add('moving');

            const idx = result.position - 52;
            const colPos = window.board.getHomeColumnPosition(playerId, idx);
            const cs = window.board.cellSize;
            el.style.left = (colPos.c * cs + cs * 0.15) + 'px';
            el.style.top = (colPos.r * cs + cs * 0.15) + 'px';
            setTimeout(() => this.renderBoard(), 200);

        } else {
            // finish, or any other type — just render
            this.renderBoard();
        }
    }
    
    renderBoard() {
        // Clear previous tokens and step labels
        document.querySelectorAll('.token, .step-label').forEach(t => t.remove());
        
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
        if (token.shielded) {
            tokenElement.classList.add('shielded');
        }
        tokenElement.id = `token-${playerIndex}-${tokenIndex}`;
        tokenElement.dataset.playerIndex = playerIndex;
        tokenElement.dataset.tokenIndex = tokenIndex;
        tokenElement.style.left = `${x + offX}px`;
        tokenElement.style.top = `${y + offY}px`;
        tokenElement.style.width = `${size}px`;
        tokenElement.style.height = `${size}px`;
        
        // Highlight active selection in swap mode
        if (this.swapState && this.swapState.active && this.swapState.ownTokenIndex === tokenIndex && playerIndex === window.game.currentPlayer) {
            tokenElement.classList.add('selected');
        }
        
        // Click handler for human players
        tokenElement.addEventListener('click', (e) => {
            const currentPlayer = window.game.getCurrentPlayer();
            const isMyTurn = this.socketClient.player && 
                             currentPlayer.name === this.socketClient.player.name;
            
            if (!isMyTurn) return;

            // 1. Shield Mode Click Interception
            if (this.shieldState && this.shieldState.active) {
                if (playerIndex === currentPlayer.id) {
                    if (token.finished) {
                        this.addSystemChatMessage("Cannot shield a finished token!");
                        return;
                    }
                    this.socketClient.usePowerup(this.shieldState.powerupId, 'SHIELD', {
                        tokenIndex: tokenIndex
                    });
                    this.cancelShieldMode();
                } else {
                    this.addSystemChatMessage("Please select one of your own tokens to shield.");
                }
                return;
            }

            // 2. Swap Mode Click Interception
            if (this.swapState && this.swapState.active) {
                // Step 1: select own active token on track
                if (this.swapState.ownTokenIndex === null) {
                    if (playerIndex === currentPlayer.id) {
                        const isOnTrack = token.position >= 0 && token.position < 52 && !token.homeColumn && !token.finished;
                        if (isOnTrack) {
                            this.swapState.ownTokenIndex = tokenIndex;
                            this.renderBoard();
                            this.statusElement.textContent = "Now click an opponent's active token on the track to swap!";
                            this.statusElement.style.color = "#f1c40f";
                            this.renderPowerups();
                            
                            // Highlight opponent active track tokens
                            document.querySelectorAll('.token').forEach(t => {
                                t.classList.remove('selectable');
                                const pIdx = parseInt(t.dataset.playerIndex);
                                const tIdx = parseInt(t.dataset.tokenIndex);
                                const tObj = window.game.players[pIdx].tokens[tIdx];
                                const tOnTrack = tObj.position >= 0 && tObj.position < 52 && !tObj.homeColumn && !tObj.finished;
                                if (pIdx !== currentPlayer.id && tOnTrack) {
                                    t.classList.add('selectable');
                                }
                            });
                        } else {
                            this.addSystemChatMessage("You must select an active token on the track!");
                        }
                    } else {
                        this.addSystemChatMessage("First select one of your own active tokens on the track.");
                    }
                    return;
                }
                // Step 2: select opponent active token on track
                if (this.swapState.ownTokenIndex !== null) {
                    if (playerIndex !== currentPlayer.id) {
                        const isOnTrack = token.position >= 0 && token.position < 52 && !token.homeColumn && !token.finished;
                        if (isOnTrack) {
                            this.socketClient.usePowerup(this.swapState.powerupId, 'SWAP_TOKENS', {
                                ownTokenIndex: this.swapState.ownTokenIndex,
                                opponentPlayerId: playerIndex,
                                opponentTokenIndex: tokenIndex
                            });
                            this.cancelSwapMode();
                        } else {
                            this.addSystemChatMessage("Target opponent token must be active on the track!");
                        }
                    } else {
                        this.addSystemChatMessage("Select an opponent's active token on the track to swap with.");
                    }
                    return;
                }
            }

            // Check if Teleport Mode is active and waiting for a token selection
            if (this.teleportState && this.teleportState.active && this.teleportState.tokenIndex === null) {
                // Verify this token belongs to the player
                if (playerIndex === currentPlayer.id) {
                    this.teleportState.tokenIndex = tokenIndex;
                    
                    // Highlight selected token visually
                    document.querySelectorAll('.token').forEach(t => t.classList.remove('selected'));
                    tokenElement.classList.add('selected');
                    
                    // Update status
                    this.statusElement.textContent = "Click on any track square on the board to teleport your token!";
                    this.statusElement.style.color = "#f1c40f"; // yellow prompt
                    
                    // Redraw powerups panel to show the next step of instructions
                    this.renderPowerups();
                    
                    // Register the canvas click callback
                    window.board.onCanvasClick = (r, c) => {
                        const trackPos = window.board.gridToTrack(r, c);
                        if (trackPos >= 0 && trackPos < 52) {
                            this.socketClient.usePowerup(this.teleportState.powerupId, 'TELEPORT', {
                                tokenIndex: this.teleportState.tokenIndex,
                                targetPosition: trackPos
                            });
                            // Reset teleport state
                            this.cancelTeleportMode();
                        } else {
                            this.addSystemChatMessage("Invalid target square. Please click on a valid path square (white tiles on the track).");
                        }
                    };
                }
                return;
            }
            
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
        this.dismissChatEmpty();
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
        this.dismissChatEmpty();
        const el = document.createElement('div');
        el.className = 'chat-message system';
        el.textContent = message;
        this.chatMessages.appendChild(el);
        
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    dismissChatEmpty() {
        const empty = document.getElementById('chat-empty');
        if (empty) empty.style.display = 'none';
    }
    
    cancelTeleportMode() {
        this.teleportState = { active: false, powerupId: null, tokenIndex: null };
        if (window.board) {
            window.board.onCanvasClick = null;
            window.board.canvas.style.pointerEvents = 'none';
        }
        document.querySelectorAll('.token').forEach(t => t.classList.remove('selected', 'selectable'));
        this.updateStatus();
        this.renderBoard();
        this.renderPowerups();
    }
    
    cancelShieldMode() {
        this.shieldState = { active: false, powerupId: null };
        document.querySelectorAll('.token').forEach(t => t.classList.remove('selected', 'selectable'));
        this.updateStatus();
        this.renderBoard();
        this.renderPowerups();
    }
    
    cancelBombMode() {
        this.bombState = { active: false, powerupId: null };
        if (window.board) {
            window.board.onCanvasClick = null;
            window.board.canvas.style.pointerEvents = 'none';
        }
        this.updateStatus();
        this.renderBoard();
        this.renderPowerups();
    }
    
    cancelSwapMode() {
        this.swapState = { active: false, powerupId: null, ownTokenIndex: null };
        document.querySelectorAll('.token').forEach(t => t.classList.remove('selected', 'selectable'));
        this.updateStatus();
        this.renderBoard();
        this.renderPowerups();
    }
    
    cancelAllPowerupModes() {
        this.cancelTeleportMode();
        this.cancelShieldMode();
        this.cancelBombMode();
        this.cancelSwapMode();
    }
    
    renderPowerups() {
        if (!window.game || !this.socketClient.player || !this.powerupsList) return;
        
        const playerObj = window.game.players.find(p => p.name === this.socketClient.player.name);
        if (!playerObj) return;
        
        this.powerupsList.innerHTML = '';
        
        // Handle active targeting mode banner display
        let activeBanner = null;
        if (this.teleportState && this.teleportState.active) {
            activeBanner = {
                title: this.teleportState.tokenIndex === null 
                    ? '🌀 Click one of your tokens on the board to select it' 
                    : '🌀 Now click a white path square on the board to teleport',
                cancelText: 'Cancel Teleport',
                cancelFn: () => this.cancelTeleportMode()
            };
        } else if (this.shieldState && this.shieldState.active) {
            activeBanner = {
                title: '🛡️ Click one of your active tokens on the board to apply shield',
                cancelText: 'Cancel Shield',
                cancelFn: () => this.cancelShieldMode()
            };
        } else if (this.bombState && this.bombState.active) {
            activeBanner = {
                title: '💣 Click on any track square on the board to place a bomb!',
                cancelText: 'Cancel Bomb',
                cancelFn: () => this.cancelBombMode()
            };
        } else if (this.swapState && this.swapState.active) {
            activeBanner = {
                title: this.swapState.ownTokenIndex === null
                    ? '🔄 Click one of your active track tokens to select it'
                    : '🔄 Now click an opponent\'s active track token to swap positions',
                cancelText: 'Cancel Swap',
                cancelFn: () => this.cancelSwapMode()
            };
        }
        
        if (activeBanner) {
            const container = document.createElement('div');
            container.className = 'active-powerup-banner';
            container.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 12px; border: 2px dashed #f1c40f; border-radius: 8px; background: rgba(241, 196, 21, 0.05);';
            
            const text = document.createElement('div');
            text.style.cssText = 'font-weight: bold; color: #f1c40f; margin-bottom: 8px; font-size: 0.9rem;';
            text.textContent = activeBanner.title;
                
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'secondary-btn';
            cancelBtn.style.cssText = 'padding: 6px 14px; font-size: 0.8rem; height: auto;';
            cancelBtn.textContent = activeBanner.cancelText;
            cancelBtn.onclick = activeBanner.cancelFn;
            
            container.appendChild(text);
            container.appendChild(cancelBtn);
            this.powerupsList.appendChild(container);
            return;
        }
        
        const powerups = playerObj.powerups || [];
        
        if (powerups.length === 0) {
            this.powerupsList.innerHTML = '<div class="no-powerups-msg">No power-ups yet. Land on safe squares or capture opponents to get them!</div>';
            return;
        }
        
        const isMyTurn = window.game.currentPlayer === playerObj.id;
        const powerupTypes = Powerup.getPowerupTypes();
        
        powerups.forEach(p => {
            const definition = powerupTypes.find(t => t.id === p.type);
            if (!definition) return;
            
            const card = document.createElement('div');
            card.className = `powerup-card ${definition.rarity}`;
            if (!isMyTurn) {
                card.classList.add('disabled');
            }
            
            const badge = document.createElement('span');
            badge.className = 'powerup-rarity-badge';
            badge.textContent = definition.rarity;
            card.appendChild(badge);
            
            const icon = document.createElement('div');
            icon.className = 'powerup-icon';
            icon.textContent = definition.icon;
            card.appendChild(icon);
            
            const name = document.createElement('div');
            name.className = 'powerup-name';
            name.textContent = definition.name;
            card.appendChild(name);
            
            const desc = document.createElement('div');
            desc.className = 'powerup-desc';
            desc.textContent = definition.description;
            card.appendChild(desc);
            
            const btn = document.createElement('button');
            btn.className = 'powerup-btn';
            btn.textContent = 'Use';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isMyTurn) {
                    this.handleUsePowerup(p.id, p.type, playerObj);
                }
            });
            card.appendChild(btn);
            
            this.powerupsList.appendChild(card);
        });
    }
    
    handleUsePowerup(powerupId, powerupType, playerObj) {
        // First, notify server we want to use the card so it can run gacha checks
        this.socketClient.usePowerup(powerupId, powerupType);
    }

    engagePowerupTargeting(powerupId, powerupType, playerObj) {
        this.cancelAllPowerupModes();
        
        if (powerupType === 'TELEPORT') {
            // Activate Teleport Mode
            this.teleportState = { active: true, powerupId: powerupId, tokenIndex: null };
            if (window.board) {
                window.board.canvas.style.pointerEvents = 'auto'; // enable canvas clicking
            }
            this.statusElement.textContent = "Select one of your tokens on the board to teleport.";
            this.statusElement.style.color = "#f1c40f";
            
            // Highlight player's active tokens on the board
            document.querySelectorAll('.token').forEach(t => {
                if (parseInt(t.dataset.playerIndex) === playerObj.id) {
                    t.classList.add('selectable');
                }
            });
            this.renderPowerups();
            
        } else if (powerupType === 'SKIP_TURN') {
            const opponents = window.game.players.filter(p => p.id !== playerObj.id);
            this.powerupModalTitle.textContent = '⏭️ Skip Opponent Turn';
            this.powerupModalBody.innerHTML = `
                <div>
                    <label for="skip-target">Select Opponent to Skip:</label>
                    <select id="skip-target" class="modal-select">
                        ${opponents.map(opp => `<option value="${opp.id}">${opp.name} (${opp.color.toUpperCase()})</option>`).join('')}
                    </select>
                </div>
            `;
            
            this.powerupModalConfirm.onclick = () => {
                const targetPlayerId = parseInt(document.getElementById('skip-target').value);
                this.socketClient.usePowerup(powerupId, powerupType, {
                    targetPlayerId: targetPlayerId
                });
                this.powerupModal.style.display = 'none';
            };
            this.powerupModal.style.display = 'flex';
            
        } else if (powerupType === 'STEAL') {
            const opponents = window.game.players.filter(p => p.id !== playerObj.id);
            this.powerupModalTitle.textContent = '✂️ Steal from Opponent';
            this.powerupModalBody.innerHTML = `
                <div>
                    <label for="steal-target">Select Opponent to Steal From:</label>
                    <select id="steal-target" class="modal-select">
                        ${opponents.map(opp => `<option value="${opp.id}">${opp.name} (${opp.color.toUpperCase()})</option>`).join('')}
                    </select>
                </div>
            `;
            
            this.powerupModalConfirm.onclick = () => {
                const targetPlayerId = parseInt(document.getElementById('steal-target').value);
                this.socketClient.usePowerup(powerupId, powerupType, {
                    targetPlayerId: targetPlayerId
                });
                this.powerupModal.style.display = 'none';
            };
            this.powerupModal.style.display = 'flex';

        } else if (powerupType === 'DICE_CONTROL') {
            const values = [1, 2, 3, 4, 5, 6];
            this.powerupModalTitle.textContent = '🎯 Dice Control';
            this.powerupModalBody.innerHTML = `
                <div>
                    <label for="dice-value-select">Choose Dice Value (1-6):</label>
                    <select id="dice-value-select" class="modal-select">
                        ${values.map(val => `<option value="${val}">${val}</option>`).join('')}
                    </select>
                </div>
            `;
            
            this.powerupModalConfirm.onclick = () => {
                const chosenValue = parseInt(document.getElementById('dice-value-select').value);
                this.socketClient.usePowerup(powerupId, powerupType, {
                    chosenValue: chosenValue
                });
                this.powerupModal.style.display = 'none';
            };
            this.powerupModal.style.display = 'flex';
            
        } else if (powerupType === 'SHIELD') {
            this.shieldState = { active: true, powerupId: powerupId };
            this.statusElement.textContent = "Click one of your active tokens on the board to shield it!";
            this.statusElement.style.color = "#f1c40f";
            
            // Highlight player's non-finished tokens
            document.querySelectorAll('.token').forEach(t => {
                const pIdx = parseInt(t.dataset.playerIndex);
                const tIdx = parseInt(t.dataset.tokenIndex);
                const token = window.game.players[pIdx].tokens[tIdx];
                if (pIdx === playerObj.id && !token.finished) {
                    t.classList.add('selectable');
                }
            });
            this.renderPowerups();
            
        } else if (powerupType === 'BOMB') {
            this.bombState = { active: true, powerupId: powerupId };
            if (window.board) {
                window.board.canvas.style.pointerEvents = 'auto';
            }
            this.statusElement.textContent = "Click on any track square on the board to place a bomb!";
            this.statusElement.style.color = "#f1c40f";
            
            // Register canvas click listener
            window.board.onCanvasClick = (r, c) => {
                const trackPos = window.board.gridToTrack(r, c);
                if (trackPos >= 0 && trackPos < 52) {
                    this.socketClient.usePowerup(powerupId, 'BOMB', {
                        targetPosition: trackPos
                    });
                    this.cancelBombMode();
                } else {
                    this.addSystemChatMessage("Invalid target square. Please click on a valid path square (white tiles on the track).");
                }
            };
            this.renderPowerups();
            
        } else if (powerupType === 'SWAP_TOKENS') {
            const hasOwnActive = playerObj.tokens.some(t => t.position >= 0 && t.position < 52 && !t.homeColumn && !t.finished);
            const hasOppActive = window.game.players.some(p => p.id !== playerObj.id && p.tokens.some(t => t.position >= 0 && t.position < 52 && !t.homeColumn && !t.finished));
            
            if (!hasOwnActive) {
                this.addSystemChatMessage("You don't have any active tokens on the track to swap!");
                return;
            }
            if (!hasOppActive) {
                this.addSystemChatMessage("Opponents do not have any active tokens on the track to swap!");
                return;
            }
            
            this.swapState = { active: true, powerupId: powerupId, ownTokenIndex: null };
            this.statusElement.textContent = "Click one of your active tokens on the track to swap!";
            this.statusElement.style.color = "#f1c40f";
            
            // Highlight player's active tokens on the track
            document.querySelectorAll('.token').forEach(t => {
                const pIdx = parseInt(t.dataset.playerIndex);
                const tIdx = parseInt(t.dataset.tokenIndex);
                const token = window.game.players[pIdx].tokens[tIdx];
                const isOnTrack = token.position >= 0 && token.position < 52 && !token.homeColumn && !token.finished;
                if (pIdx === playerObj.id && isOnTrack) {
                    t.classList.add('selectable');
                }
            });
            this.renderPowerups();
        } else {
            this.socketClient.usePowerup(powerupId, powerupType);
        }
    }
}
