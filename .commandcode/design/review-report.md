# Design Review: Ludo Game

**Report**: design review  
**Project**: Ludo Game  
**Date**: 2026-07-01  
**Score**: 32/50  

---

## Overall

**Score: 32/50** — Functional foundation with a clear direction, but the game-side experience is where the real design work is needed. The warm palette swap fixed the mood, but the interaction layer and typographic voice haven't caught up yet.

---

## TL;DR

The redesign moved this from generic dark-glass to a warm game table, which was the right call. The lobby and waiting room feel inviting. But the game screen itself — where players spend all their time — still feels like a web form with a board in it. Token movement has no animation, there are no loading states, and the typography doesn't say "game." Fix the game surface first, then the rest.

**Fix**: `/design motion` for token animation, `/design interaction` for loading/empty/error states, `/design refine` for the game screen composition.

---

## Heuristic Scores

| # | Heuristic | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | First impression | 7/10 | Warm palette is memorable; layout still reads as default centered-card |
| 2 | Hierarchy | 7/10 | Clear per-screen; game screen is a long vertical stack on mobile |
| 3 | Color voice | 7/10 | Intentional warm palette with accent identities per screen; amber slightly overused |
| 4 | Type voice | 6/10 | Clean but anonymous — no "game" character in typography |
| 5 | Interaction feel | 5/10 | Hover/focus states exist; no loading, empty, or error states; tokens teleport |

---

## Cognitive Load / Risk

**Medium-High** — The biggest risk is that the game screen feels static. Board games are about anticipation and movement feedback. Without token animation, every move feels like a refresh, not a play.

| Signal | Detail |
|--------|--------|
| PASS | Warm cream palette is a strong, differentiated choice |
| PASS | Screen-specific accent colors communicate mood |
| WATCH | Amber appears on buttons, highlights, borders, selectable tokens — it's doing too many jobs |
| FAIL | Tokens teleport between positions — zero movement feedback in a movement-based game |
| FAIL | No loading states on any async action (create room, join, start game) |
| FAIL | Only error feedback is `alert()` — breaks the UI contract |

---

## What's Working

### Palette Direction
The warm cream background with dark brown text is a genuine departure from the dark-mode reflex. It says "game table" not "SaaS dashboard." The screen-specific accent colors (amber lobby, blue waiting) show intentional mood mapping.

### Player Color System
Using the four game colors (red, blue, green, yellow) as first-class design tokens unifies the board and the UI. The status component inheriting the current player's color is a nice touch of system thinking.

### Dice Interaction
The dice has hover scale, active scale-down, and a spring-cubic-bezier roll animation. Small tactile moments like this make the game feel physical. The border + shadow treatment gives it weight.

### Token Treatment
Radial gradients with highlight positioning give tokens a 3D marble look. The amber pulse ring on selectable tokens is clear affordance. The stacking algorithm for multiple tokens on one cell is thoughtful.

---

## Priority Issues

### P0: Token Movement Has No Animation
**Evidence**: In `ui.js`, `animateMultiplayerMove()` just calls `renderBoard()` — tokens disappear and reappear at new positions. There's no slide, no path, no visual connection between old and new position. A board game about moving pieces has invisible movement.

**Fix**: `/design motion` — add step-by-step token animation that slides tokens along the track path before snapping to final position. 200ms per step at most.

### P0: No Loading States on Async Actions
**Evidence**: `createRoom()`, `joinRoom()`, `startGame()`, `addBot()` all fire socket events with zero visual feedback. The button just stays idle. Users can click multiple times. No spinner, no disabled state change, no "joining..." text.

**Fix**: `/design interaction` — add loading state to all async buttons. Disable on click, show a spinner or text change, re-enable on response or timeout.

### P1: Game Screen Vertical Scroll Problem
**Evidence**: On mobile (≤600px), the game screen stacks: player bar → board → tile editor → dice → status → chat. That's 6 sections. The board takes most of the viewport, pushing chat far below. Players can't see chat and board simultaneously.

**Fix**: `/design refine` — consider collapsible chat, tabbed layout, or moving chat to an overlay that slides from the side. At minimum, make the chat toggleable.

### P1: Typography Has No Game Voice
**Evidence**: Font stack is `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` — the browser default on Windows. The lobby title at 3.5rem/800 weight is strong, but everything else is clean/system. For a product named "LUDO" that's a game, the type doesn't carry any energy or playfulness.

**Fix**: `/design typeset` — introduce a display typeface for the game title and key headings. System fonts are fine for body/UI, but the game identity needs more character at the top of the hierarchy.

### P1: Victory Pulse Animation Runs Indefinitely
**Evidence**: The `pulse-victory` keyframe runs `infinite` on the victory heading. A pulsing trophy emoji might feel celebratory for 2 seconds, then becomes distracting. No user control to stop it.

**Fix**: Limit the animation to 3-4 cycles, then settle. Or use a CSS animation with `forwards` fill and a finite iteration count.

### P2: Amber Accent Overuse
**Evidence**: Amber is used for: lobby top border, primary buttons, button hover shadow, input focus ring, player-btn selected state, room-code highlight, active player-indicator border, dice value text, selectable token ring, chat send button, victory top border. It's everywhere. An accent that appears 10+ times per screen is not an accent.

**Fix**: `/design recolor` — reserve amber for primary actions only (create room, roll dice, send chat). Use blue for navigation/waiting states, green for success/completion. Let the player colors carry more of the visual energy in the game screen.

### P2: Unused Color Token Classes
**Evidence**: style.css defines `.c-red`, `.c-blue`, `.c-green`, `.c-yellow`, `.bg-red`, `.bg-blue`, `.bg-green`, `.bg-yellow` utility classes. None of these are used in the HTML. The JS applies colors via inline `style.color` and `style.backgroundColor`. The CSS tokens are dead code.

**Fix**: Either wire them into the HTML/JS, or remove them. Dead design tokens create maintenance drag and suggest the design system isn't fully adopted.

### P2: No Empty/Error States for Components
**Evidence**: Chat panel has no empty state ("No messages yet"). Player bar renders nothing if game is null. The status element shows "Your turn!" with no fallback for edge cases. No error state for failed room creation beyond `alert()`.

**Fix**: `/design surface` — add empty states (chat, player list), error states (connection failure, room full), and loading skeletons for async content.

---

## Next Modes

| Mode | Rationale |
|------|-----------|
| `/design motion` | Token movement animation is the #1 UX gap |
| `/design interaction` | Loading states, error handling, button feedback |
| `/design refine` | Game screen composition on mobile |
| `/design typeset` | Typography needs a game voice at the top |
| `/design recolor` | Reduce amber frequency, let player colors carry more weight |
| `/design surface` | Empty states, error states, edge case coverage |
