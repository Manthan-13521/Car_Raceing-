# Virtual Steering

A browser-based hand-gesture racing game — drive by moving your hands in front of the webcam. Uses **MediaPipe Hands** for real-time hand tracking and **Three.js** for 3D rendering in a cyberpunk tunnel circuit.

---

## Demo

Open the app, show both hands, and steer left/right. The car accelerates automatically when both hands are detected. No controller, no keyboard required (though both are supported as fallback).

---

## Features

### Hand Tracking Controls
- **Show both hands** → car accelerates
- **Move hands left/right** → steer (palm-center tracked for stability)
- **Hide hands** → car slows down
- Sensitivity slider adjusts responsiveness

### Keyboard Controls
| Key | Action |
|-----|--------|
| `W` / `Arrow Up` | Accelerate |
| `A` / `Arrow Left` | Steer left |
| `D` / `Arrow Right` | Steer right |
| `U` | Toggle auto-accelerate |

### Touch / Mobile Controls
- On-screen buttons: gas, left, right, auto-accelerate toggle
- Double-tap the mode label to switch between touch and gyroscope steering
- Auto-shown on touch devices

### Gameplay
- Endless tunnel with obstacles (AI cars to dodge)
- 90-second race duration
- Score based on speed + time
- Position ranking against AI opponents
- Progressive difficulty: speed cap and obstacle frequency increase over time
- Collision = race over (with screen shake + flash)

### Landing Page (Main Menu)
- **START RACE** — begins the game
- **HOW TO PLAY** — explains hand tracking, keyboard, and obstacle rules
- **SETTINGS** — sensitivity slider and auto-accelerate toggle

### HUD (Heads-Up Display)
- Speed (digital + analog gauge with color-coded zones)
- Position / total cars
- Lap counter
- Race timer (flashes red when under 10s)
- Score

### Visual / Juice
- 3D tunnel with neon strips, wall arrows, lane markings, ceiling lights
- Cockpit view with hood, dashboard, steering wheel (moves with steering)
- Headlights that follow the car
- Speed lines at high speed
- Speed vignette effect
- Collision flash + screen shake
- Engine sound (sawtooth oscillator, pitch tracks speed)
- Collision sound effect
- Countdown animation (3, 2, 1, GO)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite + TypeScript |
| 3D Engine | Three.js |
| Hand Tracking | MediaPipe Hands (`@mediapipe/hands`) |
| Camera | MediaPipe Camera Utils (`@mediapipe/camera_utils`) |
| Styling | CSS custom properties (Orbitron / Rajdhani / Inter fonts) |

---

## Project Structure

```
src/
├── main.ts               Entry point, UI, menu flow, game loop orchestration
├── style.css             Full design system + all UI styles
├── game/
│   └── Game.ts           Three.js scene, physics, steering, collision, spawning
├── input/
│   ├── HandTracker.ts    MediaPipe wrapper, palm-center averaging, EMA smoothing
│   └── Keyboard.ts       Keyboard input handler
└── utils/
    └── smoothing.ts      Generic EMA smooth filter
```

### Data Flow

```
Webcam → MediaPipe Hands → Palm-center landmarks (wrist + index MCP + middle MCP)
                              ↓
                        EMA Smoothing (adaptive)
                              ↓
                        Map to steering input (non-linear curve + dead zone)
                              ↓
                        Update camera + cockpit position
                              ↓
                        Move tunnel segments + obstacle cars
                              ↓
                        Render frame (Three.js)
                              ↓
                        Update HUD + juice effects
```

---

## How to Run

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Production Build

```bash
npm run build
npm run preview
```

---

## Controls Reference

### Steering Accuracy
- Palm center (average of wrist + index MCP + middle MCP) is used instead of fingertips for stable, jitter-free tracking
- Non-linear steering curve (`pow(0.85)`) gives fine precision near center while maintaining full range at edges
- Double EMA smoothing with configurable sensitivity
- Dead zone (2%) prevents drift when hands are centered

### Input Priority
1. Touch controls (if active)
2. Gyroscope (if enabled on mobile)
3. Keyboard
4. Hand tracking (always active as base layer)

---

## Browser Requirements

- Chrome / Edge / Firefox / Safari (desktop or mobile)
- WebRTC support for camera access
- Camera permission must be granted

---

## UI/UX Design

Built following racing game UI/UX principles from the `GAME UI:UX SKILL` reference kit:
- Dark theme with neon accents (red = primary, gold = accent, blue = speed, green = active)
- Orbitron font for display/data, Rajdhani for HUD labels
- Glanceable HUD: position top-left, timer top-center, score top-right, speed bottom-right
- "Quiet by default, loud on the moment" — HUD stays calm during normal driving, uses color shifts and glow for significant events
- Touch targets sized for thumbs (44px+)
- Reduced-motion support via `prefers-reduced-motion`
