/**
 * ui.js – HUD and overlay management for Skybound 3D Platformer.
 *
 * Responsibilities:
 *   - Update the score counter in the HUD.
 *   - Show/hide the full-screen game-over / win overlay.
 *   - Wire the restart button.
 */

export const ui = {
  _scoreEl: null,
  _overlay: null,
  _titleEl: null,
  _msgEl: null,
  _restartBtn: null,

  /** Cached score value for display. */
  score: 0,

  /**
   * Initialise UI element references and wire the restart button.
   * @param {Function} onRestart – called when the player clicks Restart.
   */
  init(onRestart) {
    this._scoreEl   = document.getElementById('score-display');
    this._overlay   = document.getElementById('overlay');
    this._titleEl   = document.getElementById('overlay-title');
    this._msgEl     = document.getElementById('overlay-msg');
    this._restartBtn = document.getElementById('restart-btn');

    if (this._restartBtn) {
      this._restartBtn.addEventListener('click', () => {
        this.hideOverlay();
        onRestart();
      });
    }
  },

  /**
   * Update the on-screen score counter.
   * @param {number} value
   */
  setScore(value) {
    this.score = value;
    if (this._scoreEl) {
      this._scoreEl.textContent = `Score: ${value}`;
    }
  },

  /**
   * Increment the score by a given amount and refresh the display.
   * @param {number} delta – points to add (default 1)
   */
  addScore(delta = 1) {
    this.setScore(this.score + delta);
  },

  /**
   * Show the full-screen overlay with a title and message.
   * @param {string} title – large heading text
   * @param {string} msg   – secondary message (score, hint, etc.)
   */
  showOverlay(title, msg) {
    if (this._titleEl) this._titleEl.textContent = title;
    if (this._msgEl)   this._msgEl.textContent   = msg;
    if (this._overlay) this._overlay.classList.remove('hidden');
  },

  /** Hide the overlay (called on restart). */
  hideOverlay() {
    if (this._overlay) this._overlay.classList.add('hidden');
  },

  /**
   * Show the game-over screen.
   * @param {number} score – final score to display
   */
  showGameOver(score) {
    this.showOverlay('Game Over', `You fell off! Score: ${score}`);
  },

  /**
   * Show the win screen.
   * @param {number} score – final score to display
   */
  showWin(score) {
    this.showOverlay('🏆 You Win!', `Congratulations! Final score: ${score}`);
  },
};
