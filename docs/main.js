/**
 * main.js – Game loop and scene setup for Skybound 3D Platformer.
 *
 * Responsibilities:
 *   - Initialise Three.js renderer, scene, camera, and lighting.
 *   - Wire up controls, level, player, and UI modules.
 *   - Run the requestAnimationFrame game loop.
 *   - Handle game-over and win state transitions.
 *   - Handle responsive canvas resizing.
 */

import * as THREE from 'three';
import { controls } from './controls.js';
import { buildLevel } from './level.js';
import { createPlayer } from './player.js';
import { ui } from './ui.js';

// ── Spawn position (centre of first platform, slightly above) ──────────────
const SPAWN = new THREE.Vector3(0, 0.25, 0);

// ── State ──────────────────────────────────────────────────────────────────
let gameRunning = false;
let score       = 0;
let lastTime    = 0;

// Three.js globals
let renderer, scene, camera;
let levelData, player;

// ── Initialise renderer ────────────────────────────────────────────────────
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for perf
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  const container = document.getElementById('game-container');
  container.appendChild(renderer.domElement);

  // Prevent the canvas from stealing keyboard focus.
  // Keyboard listeners are on `window`, so we keep focus there at all times.
  const canvas = renderer.domElement;
  canvas.setAttribute('tabindex', '-1');
  canvas.style.outline = 'none';
  // Re-focus window whenever the player clicks/taps the canvas.
  canvas.addEventListener('pointerdown', () => window.focus(), { passive: true });

  // Size renderer to viewport immediately
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
}

/** Resize the renderer and camera to match the current window size. */
function resizeRenderer() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// ── Build scene ────────────────────────────────────────────────────────────
function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e3a5f);
  scene.fog        = new THREE.Fog(0x1e3a5f, 30, 90);

  // Camera – perspective, positioned behind and above the player
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(20, 40, 20);
  sun.castShadow             = true;
  sun.shadow.mapSize.width   = 2048;
  sun.shadow.mapSize.height  = 2048;
  sun.shadow.camera.near     = 1;
  sun.shadow.camera.far      = 120;
  sun.shadow.camera.left     = -50;
  sun.shadow.camera.right    = 50;
  sun.shadow.camera.top      = 50;
  sun.shadow.camera.bottom   = -50;
  scene.add(sun);

  // Soft fill from below
  const fill = new THREE.HemisphereLight(0x4444aa, 0x002244, 0.4);
  scene.add(fill);

  // Decorative sky backdrop – large translucent sphere
  const skyGeo = new THREE.SphereGeometry(90, 16, 8);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x0d2240, side: THREE.BackSide });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ── Start / restart game ───────────────────────────────────────────────────
function startGame() {
  // Clear previous level objects from scene (except camera, lights, skybox)
  if (levelData) {
    for (const p of levelData.platforms) scene.remove(p.mesh);
    for (const o of levelData.orbs)      scene.remove(o.mesh);
    if (levelData.goalMesh) scene.remove(levelData.goalMesh);
  }
  if (player) scene.remove(player.mesh);

  // Build level
  levelData = buildLevel(scene);

  // Create player
  player = createPlayer(scene, SPAWN);

  // Reset score
  score = 0;
  ui.setScore(0);

  gameRunning = true;
  lastTime    = performance.now();
}

// ── Camera follow ──────────────────────────────────────────────────────────
// Smooth third-person camera that follows the player from behind and above.
const CAMERA_OFFSET  = new THREE.Vector3(0, 7, 11); // offset in player-local space
const cameraTarget   = new THREE.Vector3();
const CAMERA_LERP    = 0.08; // smoothing factor (lower = smoother)

function updateCamera() {
  const playerPos = player.mesh.position;

  // Desired camera position: behind the player based on their facing direction
  const yaw    = player.mesh.rotation.y;
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  // Rotate offset by player yaw (only horizontal rotation)
  const wx = CAMERA_OFFSET.x * cosYaw + CAMERA_OFFSET.z * sinYaw;
  const wz = -CAMERA_OFFSET.x * sinYaw + CAMERA_OFFSET.z * cosYaw;

  const desired = new THREE.Vector3(
    playerPos.x + wx,
    playerPos.y + CAMERA_OFFSET.y,
    playerPos.z + wz
  );

  // Lerp camera toward desired position
  camera.position.lerp(desired, CAMERA_LERP);

  // Look slightly ahead of the player (at chest level)
  cameraTarget.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
  camera.lookAt(cameraTarget);
}

// ── Game loop ──────────────────────────────────────────────────────────────
function loop(timestamp) {
  requestAnimationFrame(loop);

  // Delta time, capped to avoid large steps on tab switch/resume
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!gameRunning) {
    renderer.render(scene, camera);
    return;
  }

  // Update input
  controls.update();

  // Consume the jump flag after handing it to the player
  const jumpThisFrame = controls.jump;
  controls.jump = false;

  // Update level (moving platforms, orb animation)
  const elapsed = timestamp / 1000;
  levelData.update(elapsed);

  // Update player (physics, collisions, interactions)
  const { fell, wonLevel, orbsCollected } = player.update(
    dt,
    controls.move,
    jumpThisFrame,
    levelData.platforms,
    levelData.orbs,
    levelData.goalMesh,
    camera
  );

  // Apply score for collected orbs
  if (orbsCollected > 0) {
    score += orbsCollected * 10;
    ui.setScore(score);
  }

  // ── End-state checks ─────────────────────────────────────────────────────
  if (fell) {
    gameRunning = false;
    ui.showGameOver(score);
    return;
  }

  if (wonLevel) {
    gameRunning = false;
    ui.showWin(score);
    return;
  }

  // Update camera to follow player
  updateCamera();

  // Render
  renderer.render(scene, camera);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
function main() {
  // Initialise renderer and scene
  initRenderer();
  buildScene();

  // Initialise controls (event listeners)
  controls.init();

  // Initialise UI and wire restart
  ui.init(() => startGame());

  // Start first game session
  startGame();

  // Begin render loop
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

main();
