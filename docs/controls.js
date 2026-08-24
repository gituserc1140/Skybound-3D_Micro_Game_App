/**
 * controls.js – Input handling for Skybound 3D Platformer.
 *
 * Supports:
 *   - Keyboard (WASD / arrow keys) for desktop movement.
 *   - Spacebar / Enter for desktop jump.
 *   - Virtual joystick (touch) for mobile movement.
 *   - On-screen jump button for mobile jump.
 *
 * Exports a single `controls` object with:
 *   controls.move   – { x, z } normalised direction (-1…1 each)
 *   controls.jump   – boolean flag consumed by player.js
 *   controls.init() – call once after DOM is ready
 */

export const controls = {
  /** Normalised movement direction set each frame (-1 to 1). */
  move: { x: 0, z: 0 },

  /** Set to true when a jump is requested; player.js must reset it. */
  jump: false,

  // ── internal keyboard state ──────────────────────────────────────
  _keys: {},

  // ── internal joystick state ──────────────────────────────────────
  _joystick: {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  },

  /**
   * Initialise all input listeners.
   * Call once after the DOM is fully loaded.
   */
  init() {
    const MOVEMENT_KEYS = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
    ]);
    const JUMP_KEYS = new Set(['Space', 'Enter']);
    const CONTROL_KEYS = new Set([...MOVEMENT_KEYS, ...JUMP_KEYS]);

    // ── Keyboard ────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (CONTROL_KEYS.has(e.code)) {
        e.preventDefault(); // stop page scroll / focus movement
      }
      // Jump on Spacebar or Enter
      if (JUMP_KEYS.has(e.code)) {
        this.jump = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this._keys[e.code] = false;
      if (CONTROL_KEYS.has(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('blur', () => {
      this._keys = {};
      this.jump = false;
    });

    // ── On-screen jump button ────────────────────────────────────────
    const jumpBtn = document.getElementById('jump-btn');
    if (jumpBtn) {
      // touchstart for immediate response; also listen to mousedown for testing
      jumpBtn.addEventListener('touchstart', (e) => {
        this.jump = true;
        e.preventDefault();
      }, { passive: false });

      jumpBtn.addEventListener('mousedown', () => {
        this.jump = true;
      });
    }

    // ── Virtual joystick ────────────────────────────────────────────
    const zone = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    const base = document.getElementById('joystick-base');
    if (!zone) return;

    const getRadius = () => base.getBoundingClientRect().width / 2;

    zone.addEventListener('touchstart', (e) => {
      if (this._joystick.active) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = base.getBoundingClientRect();
      this._joystick.active = true;
      this._joystick.touchId = touch.identifier;
      this._joystick.startX = rect.left + rect.width / 2;
      this._joystick.startY = rect.top + rect.height / 2;
      this._updateJoystick(touch.clientX, touch.clientY, getRadius(), thumb);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this._joystick.active) return;
      const touch = this._getJoystickTouch(e.touches) || this._getJoystickTouch(e.changedTouches);
      if (!touch) return;
      this._updateJoystick(touch.clientX, touch.clientY, getRadius(), thumb);
    }, { passive: false });

    const endJoystick = (e) => {
      if (this._joystick.active && this._getJoystickTouch(e.changedTouches)) {
        this._resetJoystick(thumb);
      }
    };

    zone.addEventListener('touchend', endJoystick);
    zone.addEventListener('touchcancel', endJoystick);
  },

  _getJoystickTouch(touchList) {
    if (!touchList || this._joystick.touchId == null) return null;
    for (const touch of touchList) {
      if (touch.identifier === this._joystick.touchId) {
        return touch;
      }
    }
    return null;
  },

  _resetJoystick(thumb) {
    this._joystick.active = false;
    this._joystick.touchId = null;
    this._joystick.dx = 0;
    this._joystick.dy = 0;
    // Return thumb to centre
    if (thumb) {
      thumb.style.transform = 'translate(0, 0)';
    }
  },

  /**
   * Map joystick distance so small movements are ignored while the full
   * joystick range still reaches 100% speed near the edge.
   * @param {number} value
   * @returns {number}
   */
  _applyDeadZone(value) {
    const DEAD_ZONE = 0.18;
    if (value <= DEAD_ZONE) return 0;
    return Math.min((value - DEAD_ZONE) / (1 - DEAD_ZONE), 1);
  },

  /**
   * Update joystick visual and internal deltas from a touch position.
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} radius  – half the base element width
   * @param {HTMLElement} thumb
   */
  _updateJoystick(clientX, clientY, radius, thumb) {
    const rawDx = clientX - this._joystick.startX;
    const rawDy = clientY - this._joystick.startY;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (dist === 0) {
      this._joystick.dx = 0;
      this._joystick.dy = 0;
      if (thumb) {
        thumb.style.transform = 'translate(0, 0)';
      }
      return;
    }

    const clampedDist = Math.min(dist, radius);
    const angle = Math.atan2(rawDy, rawDx);
    const filteredDist = this._applyDeadZone(clampedDist / radius);

    // Normalised values (-1…1) with a radial dead zone for steadier mobile input.
    this._joystick.dx = Math.cos(angle) * filteredDist;
    this._joystick.dy = Math.sin(angle) * filteredDist;

    // Move thumb visually using the filtered direction.
    if (thumb) {
      const tx = this._joystick.dx * radius;
      const ty = this._joystick.dy * radius;
      thumb.style.transform = `translate(${tx}px, ${ty}px)`;
    }
  },

  /**
   * Call every frame (before physics update) to refresh move vector
   * from the current keyboard/joystick state.
   */
  update() {
    let x = 0;
    let z = 0;

    // ── Keyboard input ───────────────────────────────────────────────
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) x += 1;
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    z -= 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  z += 1;

    // ── Joystick overrides keyboard if active ────────────────────────
    if (this._joystick.active) {
      x = this._joystick.dx;
      z = this._joystick.dy;
    }

    // Normalise diagonal movement so speed is consistent
    const len = Math.sqrt(x * x + z * z);
    if (len > 1) {
      x /= len;
      z /= len;
    }

    this.move.x = x;
    this.move.z = z;
  },
};
