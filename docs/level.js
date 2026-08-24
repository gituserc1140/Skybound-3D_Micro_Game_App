/**
 * level.js – Platform, orb, and level geometry for Skybound 3D Platformer.
 *
 * Responsibilities:
 *   - Define all platform descriptors (position, size, optional movement).
 *   - Build Three.js meshes for each platform and add them to the scene.
 *   - Build collectible orbs floating above platforms.
 *   - Mark the final (goal) platform.
 *   - Provide per-frame update for moving platforms.
 *   - Provide bounding-box helpers used by the player for collision detection.
 */

import * as THREE from 'three';

// ── Colour palette ──────────────────────────────────────────────────────────
const PLATFORM_COLOUR   = 0x4a90d9;
const MOVING_COLOUR     = 0xf59e0b;
const GOAL_COLOUR       = 0x22c55e;
const ORB_COLOUR        = 0xfde68a;

// ── Platform definitions ────────────────────────────────────────────────────
// Each entry: { x, y, z, w (width), h (height), d (depth),
//               moving?: true, range?: number, speed?: number, axis?: 'x'|'z',
//               isGoal?: true }

const PLATFORM_DEFS = [
  // Start platform – wide and easy
  { x:  0,   y:  0,  z:  0,   w: 6,   h: 0.5, d: 6 },

  // Step up
  { x:  5,   y:  0.5, z: -5,  w: 3.5, h: 0.5, d: 3.5 },

  // Moving platform (horizontal x)
  { x:  10,  y:  1,  z: -10,  w: 3,   h: 0.5, d: 3,
    moving: true, range: 3.5, speed: 1.4, axis: 'x' },

  // Narrower gap
  { x:  16,  y:  1.5, z: -12, w: 2.5, h: 0.5, d: 2.5 },

  // Step up again
  { x:  20,  y:  2,  z: -16,  w: 3,   h: 0.5, d: 3 },

  // Moving platform (horizontal z)
  { x:  22,  y:  2.5, z: -22, w: 2.5, h: 0.5, d: 2.5,
    moving: true, range: 3, speed: 1.8, axis: 'z' },

  // Tiny platform – precision jump needed
  { x:  25,  y:  3,  z: -28,  w: 2,   h: 0.5, d: 2 },

  // Two stepping-stones
  { x:  27,  y:  3.5, z: -33, w: 2,   h: 0.5, d: 2 },
  { x:  30,  y:  4,  z: -37,  w: 2.5, h: 0.5, d: 2.5 },

  // Moving platform (x)
  { x:  32,  y:  4.5, z: -42, w: 3,   h: 0.5, d: 3,
    moving: true, range: 4, speed: 2.0, axis: 'x' },

  // Goal platform – large and bright green
  { x:  34,  y:  5,  z: -48,  w: 5,   h: 0.5, d: 5, isGoal: true },
];

// ── Orb definitions (platform index → local offset) ───────────────────────
// Orbs are placed above certain platforms.
const ORB_PLATFORM_INDICES = [1, 2, 4, 5, 7, 8, 9];
const ORB_HEIGHT_OFFSET    = 1.4; // above platform surface

export function buildLevel(scene) {
  const platforms  = [];   // { mesh, box (Three.Box3), def, baseX, baseZ, phase }
  const orbs       = [];   // { mesh, collected: false }
  let   goalMesh   = null;

  // ── Build platforms ──────────────────────────────────────────────────────
  for (const def of PLATFORM_DEFS) {
    const geo  = new THREE.BoxGeometry(def.w, def.h, def.d);
    const mat  = new THREE.MeshLambertMaterial({
      color: def.isGoal ? GOAL_COLOUR : def.moving ? MOVING_COLOUR : PLATFORM_COLOUR,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.x, def.y, def.z);
    mesh.receiveShadow = true;
    mesh.castShadow    = true;
    scene.add(mesh);

    // Pre-compute world-space bounding box (updated each frame for moving ones)
    const box = new THREE.Box3().setFromObject(mesh);

    const entry = {
      mesh,
      box,
      def,
      baseX: def.x,
      baseZ: def.z,
      phase: Math.random() * Math.PI * 2, // random start phase for variety
    };

    platforms.push(entry);
    if (def.isGoal) goalMesh = mesh;
  }

  // ── Build orbs ───────────────────────────────────────────────────────────
  for (const idx of ORB_PLATFORM_INDICES) {
    if (idx >= platforms.length) continue;
    const { def } = platforms[idx];
    const geo  = new THREE.SphereGeometry(0.3, 16, 12);
    const mat  = new THREE.MeshLambertMaterial({ color: ORB_COLOUR, emissive: 0xfbbf24, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      def.x,
      def.y + def.h / 2 + ORB_HEIGHT_OFFSET,
      def.z
    );
    mesh.castShadow = true;
    scene.add(mesh);
    orbs.push({ mesh, collected: false });
  }

  // ── Update function (call every frame with elapsed time) ─────────────────
  /**
   * Move any moving platforms and refresh their bounding boxes.
   * Also animate orb bob.
   * @param {number} t – total elapsed time in seconds
   */
  function update(t) {
    for (const p of platforms) {
      if (p.def.moving) {
        const { range, speed, axis } = p.def;
        const offset = Math.sin(t * speed + p.phase) * range;
        if (axis === 'x') {
          p.mesh.position.x = p.baseX + offset;
        } else {
          p.mesh.position.z = p.baseZ + offset;
        }
        // Refresh bounding box after movement
        p.box.setFromObject(p.mesh);
      }
    }

    // Animate orbs: gentle bob and spin
    for (const orb of orbs) {
      if (!orb.collected) {
        orb.mesh.position.y += Math.sin(t * 2 + orb.mesh.position.x) * 0.002;
        orb.mesh.rotation.y += 0.02;
      }
    }
  }

  return { platforms, orbs, goalMesh, update };
}
