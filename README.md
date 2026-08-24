# Skybound – 3D Platformer

A mobile-friendly 3D platformer built with [Three.js](https://threejs.org/).  
Runs in any modern browser and is deployable via GitHub Pages.

## Gameplay

- **Spawn** on the starting platform.
- **Move** across floating platforms to reach the glowing **green Goal platform**.
- **Collect** yellow orbs (+10 pts each) along the way.
- **Avoid** falling off platforms – that triggers Game Over.
- Some platforms **move** horizontally – time your jumps!

## Controls

| Action      | Desktop          | Mobile                     |
|-------------|------------------|----------------------------|
| Move        | `W A S D` or Arrow keys | Virtual joystick (bottom-left) |
| Jump        | `Spacebar` or `Enter` | **JUMP** button (bottom-right) |

## Project Structure

```
/docs
  index.html   – HTML shell, Three.js import-map, UI overlay
  style.css    – Responsive mobile-first styles
  main.js      – Scene setup, game loop, camera follow
  player.js    – Player mesh, physics, collision detection
  level.js     – Platform definitions, orbs, moving platforms
  controls.js  – WASD keyboard + virtual joystick + jump button
  ui.js        – Score HUD, game-over / win overlay
index.html     – Root redirect to /docs (for local convenience)
```

## Running Locally

Open `docs/index.html` directly in your browser **or** use a local static server to avoid CORS issues with ES modules:

```bash
# Python 3
python -m http.server 8080 --directory docs
# Then open http://localhost:8080
```

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment** choose:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default branch)
   - **Folder:** `/docs`
4. Save and wait for GitHub Pages to publish.

Your game will be live at:

```
https://<your-username>.github.io/<your-repo>/
```

## Technical Notes

- **Three.js** loaded via CDN import-map (no build step required).
- **Physics:** simple gravity + jump velocity + AABB bounding-box collisions.
- **Responsive canvas:** renderer resizes on `window.resize`; pixel-ratio capped at 2 for performance.
- **Mobile controls:** virtual joystick uses raw touch events; jump button uses `touchstart` for zero-latency response.
