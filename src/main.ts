import { HandTracker, HandData, getDirection, HAND_CONNECTIONS } from './input/HandTracker';
import { KeyboardHandler, GameKeys } from './input/Keyboard';
import { Game, GameState } from './game/Game';

// ─── DOM refs ───────────────────────────────────────────────────────
const video = document.getElementById('webcam') as HTMLVideoElement;
const gameCanvas = document.getElementById('game') as HTMLCanvasElement;
const camOverlay = document.getElementById('cam-overlay') as HTMLCanvasElement;
const gameOverlayCanvas = document.getElementById('game-overlay-canvas') as HTMLCanvasElement;
const handSkeletonCanvas = document.getElementById('hand-skeleton-canvas') as HTMLCanvasElement;

const faceLabel = document.getElementById('face-label')!;
const handLeftLabel = document.getElementById('hand-left-label')!;
const handRightLabel = document.getElementById('hand-right-label')!;
const camError = document.getElementById('cam-error')!;

const steerDir = document.getElementById('steer-dir')!;
const steerSub = document.getElementById('steer-sub')!;
const steerLine = document.getElementById('steer-line')!;
const steerArc = document.getElementById('steer-arc')!;

const telemFps = document.getElementById('telem-fps')!;
const telemHandDist = document.getElementById('telem-hand-dist')!;
const telemLR = document.getElementById('telem-lr')!;
const telemConfidence = document.getElementById('telem-confidence')!;

const camFpsLabel = document.getElementById('cam-fps')!;
const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityValue = document.getElementById('sensitivity-value')!;

const statusHand = document.getElementById('status-hand')!;
const statusKeyboard = document.getElementById('status-keyboard')!;
const statusCamera = document.getElementById('status-camera')!;
const statusCameraDot = document.getElementById('status-camera-dot')!;

const navCamDot = document.getElementById('nav-cam-dot')!;
const navCamText = document.getElementById('nav-cam-text')!;

const hudPosition = document.getElementById('hud-position')!;
const hudLap = document.getElementById('hud-lap')!;
const hudTime = document.getElementById('hud-time')!;
const hudBest = document.getElementById('hud-best')!;
const hudSpeed = document.getElementById('hud-speed')!;
const hudLapInfo = document.getElementById('hud-lap-info')!;

// ─── State ──────────────────────────────────────────────────────────
let game: Game;
let tracker: HandTracker;
let keys: GameKeys = { up: false, down: false, left: false, right: false };
let cameraActive = false;
let handTrackingActive = false;
let autoAccelerate = false;

const statusAuto = document.getElementById('status-auto')!;
const statusAutoDot = document.getElementById('status-auto-dot')!;

let overlayFps = 0;
let fpsCounter = 0;
let lastFpsTime = performance.now();

// ─── Camera overlay drawing ────────────────────────────────────────
function drawCamOverlay(data: HandData): void {
  const w = (camOverlay.width = camOverlay.clientWidth);
  const h = (camOverlay.height = camOverlay.clientHeight);
  const ctx = camOverlay.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  faceLabel.style.display = data.handsDetected > 0 ? 'block' : 'none';

  const leftIdx = data.handedness.indexOf('Left');
  const rightIdx = data.handedness.indexOf('Right');
  handLeftLabel.style.display = leftIdx >= 0 ? 'block' : 'none';
  handRightLabel.style.display = rightIdx >= 0 ? 'block' : 'none';

  for (let hi = 0; hi < data.landmarks.length; hi++) {
    const lm = data.landmarks[hi];

    // Bounding box
    if (lm.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of lm) {
        const px = p.x * w;
        const py = p.y * h;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      const pad = 10;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad);
      maxY = Math.min(h, maxY + pad);

      ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }

    // Skeleton
    for (const [i, j] of HAND_CONNECTIONS) {
      if (i < lm.length && j < lm.length) {
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lm[i].x * w, lm[i].y * h);
        ctx.lineTo(lm[j].x * w, lm[j].y * h);
        ctx.stroke();
      }
    }

    // Points
    for (const p of lm) {
      ctx.fillStyle = 'rgba(0, 255, 65, 0.5)';
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Finger tips
    for (const tipIdx of [4, 8, 12, 16, 20]) {
      if (tipIdx < lm.length) {
        const p = lm[tipIdx];
        ctx.fillStyle = 'rgba(0, 255, 65, 0.8)';
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Border glow when driving
  if (data.handsDetected >= 2) {
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
}

// ─── Dashboard gauge drawing ──────────────────────────────────────
function drawDashboard(state: GameState): void {
  const w = (gameOverlayCanvas.width = gameOverlayCanvas.clientWidth);
  const h = (gameOverlayCanvas.height = gameOverlayCanvas.clientHeight);
  const ctx = gameOverlayCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  if (!state.started || state.gameOver) return;

  const speedKmh = Math.floor(state.speed * 120);
  const speedFrac = Math.min(1, state.speed / 3);

  // Speedometer arc (bottom center)
  const cx = w / 2;
  const cy = h - 28;
  const r = Math.min(w, h) * 0.16;

  // Arc bg
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Arc fill
  const green = Math.floor(255 * (1 - speedFrac * 0.5));
  const blue = Math.floor(65 + speedFrac * 50);
  ctx.strokeStyle = `rgba(0, ${green}, ${blue}, 0.5)`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.1 + Math.PI * 0.8 * speedFrac);
  ctx.stroke();

  // Speed text
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 24px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${speedKmh}`, cx, cy);

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText('KM/H', cx, cy + 18);

  // Gear
  const gear = state.speed < 0.5 ? 'N' : state.speed < 0.8 ? '1' : state.speed < 1.2 ? '2' : state.speed < 1.8 ? '3' : state.speed < 2.4 ? '4' : '5';
  ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`Gear ${gear}`, cx, cy - r - 12);
}

// ─── Hand skeleton in game view ────────────────────────────────────
function drawHandSkeleton(data: HandData): void {
  const canvas = handSkeletonCanvas;
  const w = (canvas.width = canvas.clientWidth);
  const h = (canvas.height = canvas.clientHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  if (data.landmarks.length === 0) return;

  const lm = data.landmarks[0];

  for (const [i, j] of HAND_CONNECTIONS) {
    if (i < lm.length && j < lm.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lm[i].x * w, lm[i].y * h);
      ctx.lineTo(lm[j].x * w, lm[j].y * h);
      ctx.stroke();
    }
  }

  for (const p of lm) {
    ctx.fillStyle = 'rgba(0, 255, 65, 0.4)';
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const tipIdx of [4, 8, 12, 16, 20]) {
    if (tipIdx < lm.length) {
      const p = lm[tipIdx];
      ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Steering UI update ────────────────────────────────────────────
function updateSteeringUI(centerX: number, handsDetected: number): void {
  const dir = getDirection(centerX);

  steerDir.textContent = dir === 'LEFT' ? 'TURNING LEFT' : dir === 'RIGHT' ? 'TURNING RIGHT' : 'STRAIGHT';
  steerDir.className = `steer-dir ${dir === 'LEFT' ? 'active-left' : dir === 'RIGHT' ? 'active-right' : ''}`;

  steerSub.textContent =
    handsDetected >= 2
      ? dir === 'LEFT'
        ? 'Steering left'
        : dir === 'RIGHT'
          ? 'Steering right'
          : 'Keep hands steady'
      : handsDetected === 1
        ? 'Show both hands'
        : 'No hands detected';

  // Steering wheel rotation
  const angle = (centerX - 0.5) * 80;
  steerLine?.setAttribute('transform', `rotate(${angle}, 50, 50)`);

  // Arc color
  if (dir === 'LEFT') {
    steerArc.setAttribute('stroke', 'var(--blue)');
    steerLine.setAttribute('stroke', 'var(--blue)');
  } else if (dir === 'RIGHT') {
    steerArc.setAttribute('stroke', 'var(--gold)');
    steerLine.setAttribute('stroke', 'var(--gold)');
  } else {
    steerArc.setAttribute('stroke', 'var(--green)');
    steerLine.setAttribute('stroke', 'var(--green)');
  }
}

// ─── Telemetry update ──────────────────────────────────────────────
function updateTelemetry(data: HandData, _state: GameState): void {
  telemFps.textContent = `${overlayFps}`;
  camFpsLabel.textContent = `FPS: ${overlayFps}`;

  const dist =
    data.landmarks.length >= 2
      ? Math.sqrt(
          (data.landmarks[0][0].x - data.landmarks[1][0].x) ** 2 +
            (data.landmarks[0][0].y - data.landmarks[1][0].y) ** 2,
        ) * 800
      : 0;
  telemHandDist.textContent = dist > 0 ? `${Math.floor(dist)} px` : '-- px';

  const dirLabel = getDirection(data.centerX);
  telemLR.textContent = dirLabel === 'LEFT' ? 'LEFT' : dirLabel === 'RIGHT' ? 'RIGHT' : 'CENTER';

  telemConfidence.textContent = data.confidence > 0 ? data.confidence.toFixed(2) : '--';
}

// ─── Game HUD update ───────────────────────────────────────────────
function updateGameHUD(state: GameState): void {
  hudPosition.textContent = `${state.position}/${state.totalCars}`;
  hudLap.textContent = `${state.lap}/${state.totalLaps}`;

  // Countdown timer
  const remaining = Math.max(0, state.raceDuration - state.raceTime);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  hudTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  hudTime.style.color = remaining < 10 ? 'var(--red)' : '';

  hudLapInfo.textContent = `TIME ${mins}:${secs.toString().padStart(2, '0')}`;

  hudBest.textContent = `Score: ${Math.floor(state.score)}`;

  hudSpeed.textContent = `${game ? game.getSpeedKmh() : 0}`;
}

// ─── Status update ─────────────────────────────────────────────────
function updateStatus(): void {
  statusHand.textContent = handTrackingActive ? 'Active' : 'Inactive';
  statusHand.className = `status-val ${handTrackingActive ? '' : 'inactive'}`;
  statusKeyboard.textContent = 'Active';
  statusKeyboard.className = 'status-val';
  statusCamera.textContent = cameraActive ? 'Active' : 'Inactive';
  statusCamera.className = `status-val ${cameraActive ? '' : 'inactive'}`;
  statusCameraDot.style.background = cameraActive ? 'var(--green)' : '#f44';
  statusCameraDot.style.boxShadow = cameraActive ? '0 0 6px var(--green)' : '0 0 6px #f44';
  navCamDot.className = `cam-dot ${cameraActive ? 'on' : ''}`;
  navCamText.textContent = cameraActive ? 'Camera: ON' : 'Camera: OFF';
  statusAuto.textContent = autoAccelerate ? 'ON' : 'OFF';
  statusAuto.className = `status-val ${autoAccelerate ? '' : 'inactive'}`;
  statusAutoDot.style.background = autoAccelerate ? 'var(--gold)' : 'var(--text3)';
  statusAutoDot.style.boxShadow = autoAccelerate ? '0 0 6px var(--gold)' : 'none';
}

// ─── Keyboard callback ─────────────────────────────────────────────
function onKeys(newKeys: GameKeys): void {
  keys = newKeys;
  const keyBoxes = document.querySelectorAll('.key-box');
  for (const box of keyBoxes) {
    const k = box.getAttribute('data-key');
    if (k === 'w') box.classList.toggle('active', keys.up);
    if (k === 'a') box.classList.toggle('active', keys.left);
    if (k === 'd') box.classList.toggle('active', keys.right);
  }
  const uBox = document.querySelector('.key-box[data-key="u"]')!;
  uBox.classList.toggle('active', autoAccelerate);

  if (game) {
    if (keys.up) {
      let steerX = 0.5;
      if (keys.left) steerX = 0;
      else if (keys.right) steerX = 1;
      game.setHandData(steerX, 2);
      if (!game.started || game.gameOver) {
        game.start();
        document.getElementById('game-overlay')!.classList.remove('visible');
        document.getElementById('game-over-overlay')!.classList.remove('visible');
      }
    } else if (keys.left || keys.right) {
      game.setHandData(keys.left ? 0 : 1, autoAccelerate ? 2 : 1);
    }
  }
}

// ─── Hand tracker callback ────────────────────────────────────────
function onHandData(data: HandData): void {
  handTrackingActive = true;
  updateStatus();

  if (!game) return;

  if (!keys.up && !keys.left && !keys.right) {
    game.setHandData(data.centerX, autoAccelerate ? 2 : data.handsDetected);
  }

  if (data.landmarks.length > 0) {
    game.setHandSkeleton(data.landmarks[0]);
  }

  if (!game.started && data.handsDetected >= 2) {
    game.start();
    document.getElementById('game-overlay')!.classList.remove('visible');
    document.getElementById('game-over-overlay')!.classList.remove('visible');
  }

  if (game.gameOver && data.handsDetected >= 2) {
    game.start();
    document.getElementById('game-over-overlay')!.classList.remove('visible');
  }

  drawCamOverlay(data);
  drawHandSkeleton(data);
  updateSteeringUI(data.centerX, data.handsDetected);
  updateTelemetry(data, game.getState());
}

// ─── Game loop ─────────────────────────────────────────────────────
function gameLoop(): void {
  fpsCounter++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    overlayFps = fpsCounter;
    fpsCounter = 0;
    lastFpsTime = now;
  }

  if (game) {
    // Auto-accelerate: keep accelerating without holding W
    if (autoAccelerate && !keys.up && !keys.left && !keys.right) {
      game.setHandData(game.steerCenterX, 2);
      if (!game.started) {
        game.start();
        document.getElementById('game-overlay')!.classList.remove('visible');
        document.getElementById('game-over-overlay')!.classList.remove('visible');
      }
    }

    game.update();
    game.render();

    const state = game.getState();
    updateGameHUD(state);
    drawDashboard(state);

    const startOvr = document.getElementById('game-overlay')!;
    const gameOverOvr = document.getElementById('game-over-overlay')!;
    const finalScoreEl = document.getElementById('final-score')!;
    if (state.started && !state.gameOver) {
      startOvr.classList.remove('visible');
      gameOverOvr.classList.remove('visible');
    } else if (state.gameOver) {
      startOvr.classList.remove('visible');
      gameOverOvr.classList.add('visible');
      finalScoreEl.textContent = `${Math.floor(state.score)}`;
    } else {
      startOvr.classList.add('visible');
      gameOverOvr.classList.remove('visible');
    }
  }

  requestAnimationFrame(gameLoop);
}

// ─── Sensitivity ───────────────────────────────────────────────────
function setupSensitivity(): void {
  sensitivitySlider.addEventListener('input', () => {
    const val = parseInt(sensitivitySlider.value, 10);
    sensitivityValue.textContent = `${val}%`;
    const alpha = val / 100;
    if (tracker) tracker.setSmoothing(1 - alpha * 0.85);
    if (game) game.setSensitivity(alpha);
  });
}

// ─── Resize ────────────────────────────────────────────────────────
function handleResize(): void {
  if (!game) return;
  const viewport = document.getElementById('game-viewport')!;
  game.resize(viewport.clientWidth, viewport.clientHeight);
}

// ─── Init ──────────────────────────────────────────────────────────
async function init(): Promise<void> {
  game = new Game(gameCanvas);
  handleResize();
  window.addEventListener('resize', handleResize);

  new KeyboardHandler(onKeys);
  setupSensitivity();

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'u') {
      e.preventDefault();
      autoAccelerate = !autoAccelerate;
      updateStatus();
    }
  });

  faceLabel.style.display = 'none';
  handLeftLabel.style.display = 'none';
  handRightLabel.style.display = 'none';

  tracker = new HandTracker(video, onHandData);
  try {
    await tracker.start();
    cameraActive = true;
    camError.classList.add('hidden');
  } catch {
    cameraActive = false;
    camError.classList.remove('hidden');
    camError.querySelectorAll('span')[1].textContent = 'Camera permission denied';
    faceLabel.style.display = 'none';
    handLeftLabel.style.display = 'none';
    handRightLabel.style.display = 'none';
  }

  updateStatus();
  gameLoop();
}

init();
