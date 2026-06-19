# Ludo Game — Development Plan

## Overview

Web-based Ludo game with online multiplayer. Classic rules, clean CSS graphics, real-time gameplay via WebSocket.

**Target URL:** `ludo.areyouai.fun` (Cloudflare Tunnel)
**Stack:** HTML + CSS + Canvas (frontend), Node.js + Socket.IO (backend), SQLite (rooms/state)

---

## Game Specifications

### Rules
- Classic Ludo rules (standard worldwide)
- 2–4 players per room
- Bot AI optional (fills empty seats on demand)
- Token movement: step-by-step animation
- Safe squares: standard (star squares + home column entries)
- Double dice: roll again on 6
- 3 consecutive 6s: turn forfeited
- Capture: opponent token sent back to home on landing same square
- Win: first player to get all 4 tokens home

### Board
- Standard cross/plus shape
- Colors: Red, Blue, Green, Yellow (classic)
- 15×15 grid (5×5 per arm + center)
- Star squares as safe zones
- Home columns colored per player
- Center: finish zone

### Tokens
- Simple circles (solid color with border)
- 4 tokens per player
- Starting position: home base (bottom-left of each arm)

### Dice
- CSS-rendered dice (dots pattern)
- Random 1–6
- Animation: brief roll effect before showing result

---

## Architecture

### Frontend
```
public/
├── index.html          # Entry point
├── css/
│   ├── style.css       # Main styles
│   ├── board.css       # Board layout
│   └── chat.css        # Chat panel
├── js/
│   ├── main.js         # App init, socket connection
│   ├── board.js        # Board rendering (Canvas)
│   ├── dice.js         # Dice logic + animation
│   ├── game.js         # Game state + player actions
│   ├── chat.js         # Chat functionality
│   └── ui.js           # Lobby, room, username UI
└── assets/             # (empty — all CSS/Canvas)
```

### Backend
```
server/
├── index.js            # Express + Socket.IO server
├── game/
│   ├── Room.js         # Room management
│   ├── Ludo.js         # Game logic (rules, state)
│   ├── Bot.js          # AI bot logic
│   └── Dice.js         # Server-side dice (secure random)
├── db/
│   └── store.js        # SQLite (rooms, game state)
└── utils.js            # Helpers
```

### Data Flow
```
Player rolls dice
  → Client sends 'roll' event
  → Server validates (is it your turn? valid move?)
  → Server calculates new state
  → Server broadcasts 'state_update' to all players
  → Client animates token movement
```

---

## Development Phases

### Phase 1: Core Board + Single Player
**Goal:** Playable Ludo on one screen, no network

- [ ] HTML structure (lobby + game area)
- [ ] CSS board (15×15 grid, colored arms)
- [ ] Canvas rendering (tokens, dice)
- [ ] Dice roll (click to roll, random 1–6)
- [ ] Token selection (click token to move)
- [ ] Basic movement logic (step-by-step)
- [ ] Turn management (2-4 players, local)
- [ ] Capture logic
- [ ] Home column logic
- [ ] Win condition

**Test checklist:**
- Board renders correctly (all squares visible)
- Dice shows correct dot pattern
- Tokens move step-by-step
- Capture sends token home
- Home column only accessible with exact roll
- Win detected correctly

---

### Phase 2: Server + Multiplayer
**Goal:** Real-time multiplayer via room codes

- [ ] Node.js server setup
- [ ] Socket.IO integration
- [ ] Room creation (generate 6-char code)
- [ ] Room joining (enter code)
- [ ] Player assignment (seat management)
- [ ] Server-side game state (source of truth)
- [ ] Dice rolling (server-side, emit result)
- [ ] Move validation (server rejects invalid moves)
- [ ] State sync (broadcast to all players)
- [ ] Reconnection handling
- [ ] Disconnect handling (pause/forfeit)

**Test checklist:**
- Room creation works (code generated)
- Second player can join via code
- Moves sync in real-time (both screens update)
- Invalid moves rejected by server
- Disconnect shows appropriate state
- Reconnection restores game state

---

### Phase 3: Bot AI
**Goal:** Bot fills empty seats

- [ ] Bot player class
- [ ] Simple AI strategy:
  - Prefer capturing opponent tokens
  - Prefer moving tokens to safe squares
  - Prefer advancing tokens toward home
  - Random otherwise
- [ ] Bot difficulty selection (easy/medium/hard)
- [ ] Bot turn delay (1-2 sec, feels natural)
- [ ] Toggle bot on/off per empty seat

**Test checklist:**
- Bot joins empty seats on request
- Bot makes legal moves
- Bot doesn't freeze/hang
- Bot strategy feels reasonable

---

### Phase 4: UI/UX Polish
**Goal:** Clean, intuitive interface

- [ ] Username input (before game)
- [ ] Lobby screen (create/join room)
- [ ] Waiting room (see players, start game)
- [ ] Player indicators (color + name)
- [ ] Turn indicator (whose turn)
- [ ] Token highlighting (selectable tokens glow)
- [ ] Move history/log (small panel)
- [ ] Responsive design (mobile-friendly)
- [ ] Sound effects (optional, CSS only)
- [ ] Victory screen

**Test checklist:**
- Username saved in localStorage
- Lobby flow intuitive
- Mobile: board scales, touch-friendly
- Victory screen shows winner

---

### Phase 5: Chat System
**Goal:** In-game text chat

- [ ] Chat panel (side/bottom)
- [ ] Message input
- [ ] Real-time message sync via Socket.IO
- [ ] Player name + color in messages
- [ ] System messages (player joined/left, game started)
- [ ] Chat toggle (show/hide)

**Test checklist:**
- Messages sync in real-time
- System messages appear
- Chat doesn't interfere with gameplay

---

### Phase 6: Deploy
**Goal:** Live on ludo.areyouai.fun

- [ ] Cloudflare Tunnel config
- [ ] Domain: ludo.areyouai.fun
- [ ] SSL/HTTPS
- [ ] Process manager (PM2 or systemd)
- [ ] Health check endpoint
- [ ] Error logging

---

## Development Loop Workflow

```
┌─────────────────────────────────────────┐
│  1. Codex: implement phase feature      │
│     → terminal(codex exec --full-auto)  │
├─────────────────────────────────────────┤
│  2. Hermes: start dev server            │
│     → terminal(npm run dev, background) │
├─────────────────────────────────────────┤
│  3. Hermes: test via browser            │
│     → browser_navigate → browser_vision │
│     → Check UI, interactions, logic     │
├─────────────────────────────────────────┤
│  4. Hermes: find bugs                   │
│     → Document in DEVLOG.md             │
├─────────────────────────────────────────┤
│  5. Codex: fix bugs                     │
│     → terminal(codex exec "Fix: ...")   │
├─────────────────────────────────────────┤
│  6. Repeat 2-5 until clean              │
├─────────────────────────────────────────┤
│  7. Hermes: mark phase complete         │
│     → Update PLAN.md checkboxes         │
└─────────────────────────────────────────┘
```

### Models
- **Hermes testing:** mimo-v2.5 (Xiaomi provider, 1M context)
- **Codex coding:** gpt-5.3-codex (high reasoning)
- **Fallback:** mimo-v2.5-pro (Xiaomi provider) if Codex hits limit

### Rules
- MiMo models MUST use Xiaomi provider (not 9Router/OpenGateway)
- Codex auto-compact context; new session if needed
- Hermes: 1M context, sufficient for entire project
- Progress logged to DEVLOG.md for continuity

---

## File Structure (Final)

```
~/projects/ludo-game/
├── PLAN.md                 # This file
├── DEVLOG.md               # Development log (auto-updated)
├── package.json
├── server/
│   ├── index.js
│   ├── game/
│   │   ├── Room.js
│   │   ├── Ludo.js
│   │   ├── Bot.js
│   │   └── Dice.js
│   └── db/
│       └── store.js
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   ├── board.css
│   │   └── chat.css
│   └── js/
│       ├── main.js
│       ├── board.js
│       ├── dice.js
│       ├── game.js
│       ├── chat.js
│       └── ui.js
└── data/
    └── ludo.db             # SQLite database
```

---

## Estimasi Waktu

| Phase | Estimasi | Notes |
|-------|----------|-------|
| Phase 1 | 1-2 jam | Core board + single player |
| Phase 2 | 2-3 jam | Server + multiplayer |
| Phase 3 | 1 jam | Bot AI |
| Phase 4 | 1-2 jam | UI/UX polish |
| Phase 5 | 30 menit | Chat system |
| Phase 6 | 30 menit | Deploy |
| **Total** | **6-9 jam** | Including testing loop |
