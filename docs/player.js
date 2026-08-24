/**
 * player.js – Player entity for Skybound 3D Platformer.
 *
 * Responsibilities:
 *   - Create and manage the player mesh (a coloured box/capsule shape).
 *   - Apply gravity, jump velocity, and horizontal movement each frame.
 *   - Resolve collisions with platforms using bounding boxes.
 *   - Detect orb collection (sphere–box overlap).
 *   - Detect falling below a kill plane.
 *   - Detect reaching the goal platform.
 */

import * as THREE from 'three';

// ── Tuning constants ────────────────────────────────────────────────────────
const PLAYER_SPEED   = 8;     // horizontal movement speed (units/s)
const JUMP_VELOCITY  = 9;     // initial upward velocity on jump
const GRAVITY        = -22;   // downward acceleration (units/s²)
const KILL_Y         = -12;   // fall below this → game over
const PLAYER_W       = 0.6;   // player bounding box width
const PLAYER_H       = 1.0;   // player bounding box height
const PLAYER_D       = 0.6;   // player bounding box depth
const ORB_COLLECT_R  = 1.2;   // collection radius for orbs

export function createPlayer(scene, spawnPosition) {
  // ── Mesh (body + eyes for direction cue) ──────────────────────────────────
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(PLAYER_W, PLAYER_H, PLAYER_D);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
  const body    = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Eye (small white sphere to hint facing direction)
  const eyeGeo  = new THREE.SphereGeometry(0.1, 8, 8);
  const eyeMat  = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const eye     = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 0.2, -PLAYER_D / 2 - 0.05);
  group.add(eye);

  group.position.copy(spawnPosition);
  group.position.y += PLAYER_H / 2; // place bottom on platform surface
  scene.add(group);

  // ── Physics state ─────────────────────────────────────────────────────────
  const velocity = new THREE.Vector3(0, 0, 0);
  let   onGround = false;

  // Reusable bounding box for the player
  const playerBox = new THREE.Box3();

  // ── Helper: compute player's world-space AABB ────────────────────────────
  function computeBox() {
    const hw = PLAYER_W / 2;
    const hh = PLAYER_H / 2;
    const hd = PLAYER_D / 2;
    playerBox.set(
      new THREE.Vector3(group.position.x - hw, group.position.y - hh, group.position.z - hd),
      new THREE.Vector3(group.position.x + hw, group.position.y + hh, group.position.z + hd)
    );
  }

  /**
   * Update player physics, movement, collisions, and interactions.
   *
   * @param {number}              dt        – delta time in seconds
   * @param {{ x: number, z: number }} move – normalised direction from controls
   * @param {boolean}             jumpReq   – true if a jump was requested this frame
   * @param {Array}               platforms – level platform entries (from level.js)
   * @param {Array}               orbs      – level orb entries (from level.js)
   * @param {THREE.Mesh}          goalMesh  – the goal platform mesh
   * @param {THREE.Camera}        camera    – used to orient movement to camera yaw
   * @returns {{ fell: boolean, wonLevel: boolean, orbsCollected: number }}
   */
  function update(dt, move, jumpReq, platforms, orbs, goalMesh, camera) {
    let fell         = false;
    let wonLevel     = false;
    let orbsCollected = 0;

    // ── Horizontal movement (camera-relative) ───────────────────────────────
    // Extract camera yaw so WASD is always relative to the camera's horizontal
    // facing direction, giving intuitive controls.
    const cameraYaw = Math.atan2(
      -(camera.position.x - group.position.x),
       (camera.position.z - group.position.z)
    );
    // Build a flat direction in world space from the input and camera yaw
    const fwd   = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw),  0, -Math.sin(cameraYaw));

    const moveDir = new THREE.Vector3()
      .addScaledVector(right, move.x)
      .addScaledVector(fwd,  -move.z); // z axis: forward = negative in Three.js default

    // Apply horizontal velocity
    velocity.x = moveDir.x * PLAYER_SPEED;
    velocity.z = moveDir.z * PLAYER_SPEED;

    // Rotate player mesh to face movement direction
    if (moveDir.lengthSq() > 0.001) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      group.rotation.y  = targetAngle;
    }

    // ── Jump ────────────────────────────────────────────────────────────────
    if (jumpReq && onGround) {
      velocity.y = JUMP_VELOCITY;
      onGround   = false;
    }

    // ── Gravity ─────────────────────────────────────────────────────────────
    velocity.y += GRAVITY * dt;

    // ── Integrate position ──────────────────────────────────────────────────
    group.position.x += velocity.x * dt;
    group.position.y += velocity.y * dt;
    group.position.z += velocity.z * dt;

    // ── Platform collision resolution (AABB) ────────────────────────────────
    onGround = false;
    computeBox();

    for (const p of platforms) {
      if (!playerBox.intersectsBox(p.box)) continue;

      // Compute overlap on each axis
      const overlapX = Math.min(playerBox.max.x - p.box.min.x, p.box.max.x - playerBox.min.x);
      const overlapY = Math.min(playerBox.max.y - p.box.min.y, p.box.max.y - playerBox.min.y);
      const overlapZ = Math.min(playerBox.max.z - p.box.min.z, p.box.max.z - playerBox.min.z);

      // Resolve on the axis with the smallest penetration
      if (overlapY < overlapX && overlapY < overlapZ) {
        // Vertical collision
        if (group.position.y > p.mesh.position.y) {
          // Landing on top
          group.position.y += overlapY;
          if (velocity.y < 0) velocity.y = 0;
          onGround = true;
        } else {
          // Hit from below
          group.position.y -= overlapY;
          if (velocity.y > 0) velocity.y = 0;
        }
      } else if (overlapX < overlapZ) {
        // Side collision along X
        group.position.x += (group.position.x < p.mesh.position.x) ? -overlapX : overlapX;
        velocity.x = 0;
      } else {
        // Side collision along Z
        group.position.z += (group.position.z < p.mesh.position.z) ? -overlapZ : overlapZ;
        velocity.z = 0;
      }

      // Recompute after each resolution
      computeBox();
    }

    // ── Moving platform "carry" ─────────────────────────────────────────────
    // If standing on a moving platform, inherit its velocity to prevent sliding off.
    if (onGround) {
      for (const p of platforms) {
        if (!p.def.moving) continue;
        if (!playerBox.intersectsBox(p.box)) continue;
        // Only carry if player is on top
        const feetY = playerBox.min.y;
        const topY  = p.box.max.y;
        if (Math.abs(feetY - topY) < 0.1) {
          const { range, speed, axis } = p.def;
          const t  = performance.now() / 1000;
          const v  = Math.cos(t * speed + p.phase) * range * speed;
          if (axis === 'x') group.position.x += v * dt;
          else              group.position.z += v * dt;
          break;
        }
      }
    }

    // ── Orb collection ──────────────────────────────────────────────────────
    for (const orb of orbs) {
      if (orb.collected) continue;
      const dist = group.position.distanceTo(orb.mesh.position);
      if (dist < ORB_COLLECT_R) {
        orb.collected = true;
        orb.mesh.visible = false;
        orbsCollected++;
      }
    }

    // ── Goal detection ──────────────────────────────────────────────────────
    if (goalMesh) {
      const goalBox = new THREE.Box3().setFromObject(goalMesh);
      // Expand slightly so the player triggers it when standing on top
      goalBox.expandByScalar(0.3);
      computeBox();
      if (playerBox.intersectsBox(goalBox) && onGround) {
        wonLevel = true;
      }
    }

    // ── Fall detection ──────────────────────────────────────────────────────
    if (group.position.y < KILL_Y) {
      fell = true;
    }

    return { fell, wonLevel, orbsCollected };
  }

  /**
   * Reset the player to the given spawn position with zero velocity.
   * @param {THREE.Vector3} spawnPos
   */
  function reset(spawnPos) {
    group.position.set(spawnPos.x, spawnPos.y + PLAYER_H / 2, spawnPos.z);
    velocity.set(0, 0, 0);
    onGround = false;
  }

  return { mesh: group, update, reset };
}
