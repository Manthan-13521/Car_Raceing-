import * as THREE from 'three';
import { SmoothFilter } from '../utils/smoothing';
import type { Landmark } from '../input/HandTracker';

const SEG_LEN = 24;
const NUM_SEG = 18;
const ROAD_W = 10;
const LANE_X = [-3.3, 0, 3.3];
const TUNNEL_W = 14;
const TUNNEL_H = 5;
const FOV = 78;
const CAM_Y = 1.3;
const RACE_DURATION = 90;

export interface GameState {
  speed: number;
  score: number;
  raceTime: number;
  bestTime: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;
  started: boolean;
  gameOver: boolean;
  raceDuration: number;
  shakeIntensity: number;
  justCollided: boolean;
}

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private segments: THREE.Group[] = [];
  private obstacles: THREE.Group[] = [];

  private speed = 0;
  private baseSpeed = 0.2;
  private maxSpeed = 3.0;
  private score = 0;
  private raceTime = 0;
  private bestTime = Infinity;
  private lap = 1;
  private totalLaps = 2;
  private position = 2;
  private totalCars = 6;
  private _gameOver = false;
  private _started = false;

  private centerX = 0.5;
  private _handsDetected = 0;
  private cameraX = 0;
  private smoothSteer = new SmoothFilter(0.12, 0);
  private sensitivity = 1.0;

  private spawnTimer = 0;
  private spawnInterval = 100;
  private lastFrameTime = 0;

  private shakeIntensity = 0;
  private _justCollided = false;

  private headlight1!: THREE.PointLight;
  private headlight2!: THREE.PointLight;

  private handSkeleton: Landmark[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080a0e);
    this.scene.fog = new THREE.Fog(0x080a0e, 50, 250);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 300);
    this.camera.position.set(0, CAM_Y, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;

    this.setupLights();
    this.buildRoad();
    this.buildSegments();
    this.buildCockpit();
    this.lastFrameTime = performance.now();
  }

  get gameOver(): boolean { return this._gameOver; }
  get started(): boolean { return this._started; }
  get handsDetected(): number { return this._handsDetected; }
  get steerCenterX(): number { return this.centerX; }
  get justCollided(): boolean { return this._justCollided; }

  getState(): GameState {
    return {
      speed: this.speed,
      score: this.score,
      raceTime: this.raceTime,
      bestTime: this.bestTime === Infinity ? 0 : this.bestTime,
      lap: Math.min(this.lap, this.totalLaps),
      totalLaps: this.totalLaps,
      position: this._gameOver ? this.totalCars : this.position,
      totalCars: this.totalCars,
      started: this._started,
      gameOver: this._gameOver,
      raceDuration: RACE_DURATION,
      shakeIntensity: this.shakeIntensity,
      justCollided: this._justCollided,
    };
  }

  getSpeedKmh(): number {
    return Math.floor(this.speed * 120);
  }

  setHandData(centerX: number, handsDetected: number): void {
    this.centerX = centerX;
    this._handsDetected = handsDetected;
  }

  setHandSkeleton(landmarks: Landmark[]): void {
    this.handSkeleton = landmarks;
  }

  setSensitivity(val: number): void {
    this.sensitivity = val;
  }

  start(): void {
    this._started = true;
    this._gameOver = false;
    this.score = 0;
    this.speed = this.baseSpeed;
    this.raceTime = 0;
    this.lap = 1;
    this.position = 2;
    this.spawnTimer = 0;
    this.cameraX = 0;
    this.smoothSteer.reset(0);
    this.shakeIntensity = 0;
    this._justCollided = false;
    for (const c of this.obstacles) this.scene.remove(c);
    this.obstacles = [];
    this.spawnCar();
    this.spawnCar();
    this.spawnCar();
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0x6688aa, 1.8));

    this.headlight1 = new THREE.PointLight(0xffeedd, 10, 100);
    this.headlight1.position.set(-2, 2.5, -7);
    this.scene.add(this.headlight1);

    this.headlight2 = new THREE.PointLight(0xffeedd, 10, 100);
    this.headlight2.position.set(2, 2.5, -7);
    this.scene.add(this.headlight2);

    const spot = new THREE.SpotLight(0xffffff, 3, 150, Math.PI / 5, 0.4);
    spot.position.set(0, 8, 8);
    spot.target.position.set(0, 0, -40);
    this.scene.add(spot);
    this.scene.add(spot.target);

    this.scene.add(new THREE.HemisphereLight(0x88aacc, 0x445566, 0.8));

    const fill = new THREE.PointLight(0x4488cc, 4, 60);
    fill.position.set(0, 4, -20);
    this.scene.add(fill);
  }

  private buildRoad(): void {
    const geo = new THREE.PlaneGeometry(ROAD_W, 600);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a3c40,
      roughness: 0.7,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(geo, mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -300);
    this.scene.add(road);
  }

  private buildSeg(z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.z = z;

    // Walls — slightly brighter
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a4e55,
      roughness: 0.8,
      metalness: 0.15,
    });
    const wallGeo = new THREE.BoxGeometry(0.6, TUNNEL_H, SEG_LEN);

    const lw = new THREE.Mesh(wallGeo, wallMat);
    lw.position.set(-TUNNEL_W / 2 - 0.3, TUNNEL_H / 2, 0);
    g.add(lw);

    const rw = new THREE.Mesh(wallGeo, wallMat);
    rw.position.set(TUNNEL_W / 2 + 0.3, TUNNEL_H / 2, 0);
    g.add(rw);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x3e4248,
      roughness: 0.7,
      metalness: 0.1,
    });
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(TUNNEL_W + 1.2, SEG_LEN),
      ceilMat,
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, TUNNEL_H, 0);
    g.add(ceil);

    // Neon strip lights on walls (red)
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
    const neonGeo = new THREE.BoxGeometry(0.08, 0.12, SEG_LEN);
    for (const side of [-1, 1]) {
      const neon = new THREE.Mesh(neonGeo, neonMat);
      neon.position.set(side * (TUNNEL_W / 2 + 0.05), 1.2, 0);
      g.add(neon);
    }

    // Neon strip on ceiling (blue)
    const ceilNeonMat = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    const ceilNeon = new THREE.Mesh(
      new THREE.BoxGeometry(TUNNEL_W * 0.6, 0.06, 0.15),
      ceilNeonMat,
    );
    ceilNeon.position.set(0, TUNNEL_H - 0.04, 0);
    g.add(ceilNeon);

    // Barrier strips at road edges
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x882222,
      roughness: 0.5,
      emissive: 0x440000,
      emissiveIntensity: 0.5,
    });
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.5, SEG_LEN),
        barMat,
      );
      bar.position.set(side * (ROAD_W / 2 + 0.5), 0.25, 0);
      g.add(bar);
    }

    // Tunnel lights (brighter, warmer)
    const lMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    const lGeo = new THREE.BoxGeometry(0.5, 0.08, 14);
    const l1 = new THREE.Mesh(lGeo, lMat);
    l1.position.set(-2.5, TUNNEL_H - 0.04, 0);
    g.add(l1);
    const l2 = new THREE.Mesh(lGeo, lMat);
    l2.position.set(2.5, TUNNEL_H - 0.04, 0);
    g.add(l2);

    // Red direction arrows on walls (brighter)
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.6,
    });
    for (const side of [-1, 1]) {
      for (let dz = -8; dz <= 8; dz += 8) {
        const arrow = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.6),
          arrowMat,
        );
        arrow.position.set(
          side * (TUNNEL_W / 2 + 0.35),
          1.5,
          dz,
        );
        arrow.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(arrow);
      }
    }

    // Lane edge markings (bright white)
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const edgeGeo = new THREE.PlaneGeometry(0.15, SEG_LEN);
    for (const ex of [-ROAD_W / 2, ROAD_W / 2]) {
      const e = new THREE.Mesh(edgeGeo, edgeMat);
      e.rotation.x = -Math.PI / 2;
      e.position.set(ex, 0.02, 0);
      g.add(e);
    }

    // Dashed center lines
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (let lane = 0; lane < 2; lane++) {
      const lx = LANE_X[lane] + 1.65;
      for (let d = -SEG_LEN / 2; d < SEG_LEN / 2; d += 7) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 3.5),
          dashMat,
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.02, d + 1.75);
        g.add(dash);
      }
    }

    this.scene.add(g);
    return g;
  }

  private buildSegments(): void {
    for (let i = 0; i < NUM_SEG; i++) {
      this.segments.push(this.buildSeg(-i * SEG_LEN));
    }
  }

  private buildCockpit(): void {
    // Car hood — dark but visible
    const hoodMat = new THREE.MeshStandardMaterial({
      color: 0x1e2838,
      roughness: 0.3,
      metalness: 0.7,
    });
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.12, 2.0),
      hoodMat,
    );
    hood.position.set(0, 0.06, -1.5);
    this.scene.add(hood);

    // Dashboard panel — minimal
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0x0e1218,
      roughness: 0.6,
      metalness: 0.3,
    });
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.3, 0.4),
      dashMat,
    );
    dash.position.set(0, 0.5, -0.9);
    this.scene.add(dash);

    // Dashboard screen — green glow
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ff41 });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.15),
      screenMat,
    );
    screen.position.set(0, 0.58, -0.68);
    this.scene.add(screen);

    // Steering wheel — small, subtle
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a22,
      roughness: 0.4,
      metalness: 0.5,
    });
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.04, 10, 20),
      wheelMat,
    );
    wheel.position.set(0, 0.8, -0.6);
    wheel.rotation.x = 0.5;
    this.scene.add(wheel);

    // Side pillars — thin
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.3,
      metalness: 0.6,
    });
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.8, 0.1),
        pillarMat,
      );
      p.position.set(side * 1.3, 1.3, -0.5);
      this.scene.add(p);
    }
  }

  private spawnCar(): void {
    const g = new THREE.Group();
    const colors = [
      0xff2222, 0xffaa00, 0xaa44ff, 0x00ddaa,
      0xff6600, 0x2299ff, 0xffffff, 0x44dd44,
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Car body — emissive for visibility
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.4,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.0), bodyMat);
    body.position.y = 0.55;
    body.position.z = -0.1;
    g.add(body);

    // Cabin
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.2,
      metalness: 0.6,
    });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 1.8), cabinMat);
    cabin.position.set(0, 1.3, 0.4);
    g.add(cabin);

    // Tail lights — bright red glow
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    for (const side of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, 0.08),
        tailMat,
      );
      tl.position.set(side, 0.65, 2.02);
      g.add(tl);
    }
    const tailGlow = new THREE.PointLight(0xff2200, 2, 10);
    tailGlow.position.set(0, 0.65, 2.2);
    g.add(tailGlow);

    // Headlights — bright white/yellow
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    for (const side of [-0.7, 0.7]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.08),
        hlMat,
      );
      hl.position.set(side, 0.55, -2.02);
      g.add(hl);
    }
    const hlGlow = new THREE.PointLight(0xffffdd, 4, 20);
    hlGlow.position.set(0, 0.55, -2.3);
    g.add(hlGlow);

    // Underbody glow
    const underGlow = new THREE.PointLight(color, 1.5, 6);
    underGlow.position.set(0, 0.1, 0);
    g.add(underGlow);

    const lane = Math.floor(Math.random() * 3);
    g.position.set(LANE_X[lane], 0, -100 - Math.random() * 60);
    this.scene.add(g);
    this.obstacles.push(g);
  }

  update(): void {
    if (!this._started || this._gameOver) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 16.67, 3);
    this.lastFrameTime = now;
    const delta = dt / 60;

    // Speed
    if (this._handsDetected >= 2) {
      this.speed = Math.min(this.maxSpeed, this.speed + 0.004 * dt);
      this.score += this.speed * 2 * dt;
      this.raceTime += delta;
    } else {
      this.speed = Math.max(0.05, this.speed - 0.007 * dt);
    }

    // Game over after 90 seconds
    if (this.raceTime >= RACE_DURATION) {
      this._gameOver = true;
    }

    // Position
    this.position = Math.max(
      1,
      Math.min(
        this.totalCars,
        Math.floor((this.obstacles.length / 6) * (this.totalCars - 1)) + 2,
      ),
    );

    // Steering — smooth with dead zone
    const rawSteer = (this.centerX - 0.5) * 2 * this.sensitivity;
    const deadZone = 0.08;
    const steerInput = Math.abs(rawSteer) < deadZone ? 0 : (rawSteer > 0 ? (rawSteer - deadZone) / (1 - deadZone) : (rawSteer + deadZone) / (1 - deadZone));
    const targetX = steerInput * 5;
    this.cameraX = this.smoothSteer.update(targetX);
    this.cameraX = Math.max(-4, Math.min(4, this.cameraX));

    // Camera shake decay
    this._justCollided = false;
    if (this.shakeIntensity > 0.01) {
      this.shakeIntensity *= 0.9;
    } else {
      this.shakeIntensity = 0;
    }

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.8;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.5;
    const rollExtra = (Math.random() - 0.5) * this.shakeIntensity * 0.04;

    this.camera.position.x = this.cameraX + shakeX;
    this.camera.position.y = CAM_Y + shakeY;
    this.camera.rotation.z = this.cameraX * -0.025 + rollExtra;

    // Headlights follow
    this.headlight1.position.x = this.cameraX - 2.5;
    this.headlight2.position.x = this.cameraX + 2.5;

    // Move tunnel segments
    const moveAmount = this.speed * dt;
    for (const seg of this.segments) {
      seg.position.z += moveAmount;
      if (seg.position.z > SEG_LEN) {
        seg.position.z -= NUM_SEG * SEG_LEN;
      }
    }

    // Spawn obstacles
    this.spawnTimer += dt;
    const interval = Math.max(18, this.spawnInterval - this.speed * 30);
    if (this.spawnTimer >= interval && this._handsDetected >= 2) {
      this.spawnTimer = 0;
      this.spawnCar();
    }

    // Move obstacles and check collision
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const car = this.obstacles[i];
      car.position.z += moveAmount;

      if (car.position.z > 15) {
        this.scene.remove(car);
        this.obstacles.splice(i, 1);
        continue;
      }

      const dx = Math.abs(this.cameraX - car.position.x);
      const dz = Math.abs(car.position.z);
      if (dx < 1.5 && dz < 2.5) {
        this._gameOver = true;
        this._justCollided = true;
        this.shakeIntensity = 2.0;
      }
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
