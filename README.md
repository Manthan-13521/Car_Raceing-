# Virtual Steering

A real-time hand-gesture-based virtual steering wheel that uses a webcam to detect hand positions and translates them into driving controls (accelerate, steer left/right).

## How the Original Python Project Works

### Core Concept

The original `Steering.py` uses **MediaPipe** (via the `cvzone` wrapper) to track both hands through a webcam feed. The center point between the two index-finger tips determines the steering direction, and the system automatically accelerates when both hands are visible.

### Control Logic

| Condition | Action |
|-----------|--------|
| Both hands detected | Press **W** (accelerate) |
| Center of index fingers < 40% of frame width | Press **A** (steer left) |
| Center of index fingers > 60% of frame width | Press **D** (steer right) |
| Center between 40%-60% | Release A/D (go straight) |
| 0 or 1 hand detected | Release all keys (stop) |

### Key Parameters

- `LEFT_THRESHOLD = 0.40` — Normalized X position below which steering turns left
- `RIGHT_THRESHOLD = 0.60` — Normalized X position above which steering turns right
- `SMOOTHING_ALPHA = 0.15` — Exponential Moving Average smoothing factor to reduce jitter
- `DETECTION_CONFIDENCE = 0.8` — MediaPipe detection confidence threshold

### Technical Stack (Original)

- **Python 3.12** with OpenCV for video capture
- **MediaPipe** / **cvzone** for hand landmark detection
- **pynput** for macOS keyboard simulation
- Webcam feed displayed with OpenCV GUI overlay showing FPS, direction, and acceleration status

### Limitations of the Original

1. **No visual game** — It only simulates key presses (W, A, D). You need a separate game running.
2. **macOS-only** — Keyboard simulation via `pynput` is platform-specific.
3. **No feedback** — No visual representation of the "car" or steering wheel.

---

## Web Game Specification (This Project)

### Overview

A browser-based driving game controlled entirely by hand gestures via the webcam. The game renders a car on a procedurally generated road, and the player steers by moving both hands left/right in front of the camera.

### Tech Stack

- **Vite** — Fast dev server with HMR (`npm run dev`)
- **TypeScript** — Type-safe development
- **MediaPipe Hands** (`@mediapipe/hands` + `@mediapipe/camera_utils`) — Hand landmark detection in the browser
- **HTML5 Canvas** — Game rendering (no external game engine needed)

### Game Mechanics

1. **Acceleration**: Automatic when both hands are detected (like the original pressing W)
2. **Steering**: Center point between both index-finger tips maps to:
   - **Left** (center < 40% of frame) → car steers left
   - **Straight** (40%–60%) → car goes straight
   - **Right** (center > 60%) → car steers right
3. **Braking**: When hands are lost (0 or 1 hand), the car slows down
4. **Road**: Procedurally generated endless road with lanes and curves

### Project Structure

```
virtual-steering-web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts          — Entry point, sets up canvas and starts the loop
│   ├── game/
│   │   ├── Game.ts      — Main game loop, state management
│   │   ├── Car.ts       — Car entity (position, speed, rendering)
│   │   └── Road.ts      — Road generation and rendering
│   ├── input/
│   │   └── HandTracker.ts  — MediaPipe hand tracking wrapper
│   └── utils/
│       └── smoothing.ts — EMA filter for gesture data
└── public/
    └── (static assets if any)
```

### Data Flow

```
Webcam → MediaPipe Hands → Landmark positions
                              ↓
                        Compute center of index fingertips
                              ↓
                        EMA Smoothing
                              ↓
                        Map to steering direction (A/D)
                              ↓
                        Update car position
                              ↓
                        Render frame (road + car + overlay)
```

### How to Run

```bash
npm install
npm run dev
```

### Permissions

The browser will request camera access. The app works on any OS with a browser that supports WebRTC (Chrome, Edge, Firefox, Safari).

### Future Enhancements (Ideas)

- Speed control (bring hands closer/farther to accelerate/brake)
- Obstacles / other cars
- Score / distance tracking
- Mobile support with touch fallback
- Steering wheel visual overlay in the camera feed
