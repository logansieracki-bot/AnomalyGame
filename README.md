# Anomaly Shift (prototype)

FNAF-style camera horror set in a house. Watch the cameras, report anomalies, and block whatever reaches your door or vent. See `docs/DESIGN.md` and `docs/SHOOT_LIST.md`.

## Run
No build step. Open `index.html` in a browser (or `python3 -m http.server` and visit it).

Debug URL params: `?night=3` skips the menu, `?speed=5` runs the clock faster. `window.__game` is exposed in the console.

## Audio
Real sound files go in `assets/audio/` (see `assets/audio/README.md` and `manifest.json`). Nothing is synthesized, so missing files are silent. Serve over http to load them. Audition everything at `?soundtest=1`.

## Controls
- Click the map or press `1`-`9`: switch camera
- `R` / Report button: choose what is wrong in the current room (delay, then cooldown)
- `Space`: lower/raise the monitor
- `Q` / `E` (monitor lowered, hold): flashlight on the door / vent. Without it you cannot see what is there
- `A` / `D` (monitor lowered): close door / seal vent. Keeping either shut builds strain and it jams open for 10s

## What's in
- Nights 1-6 (6 min each), clock, power, overload meter
- 8 environmental anomaly types, stackable, subtler on later nights
- Entities: Visitor (door), Crawler (vent), Watcher (door, only moves unobserved); Mimic not yet implemented
- Hallucinations (not reportable) that bait false reports
- Procedural placeholder rooms and synthesized audio, no asset files

## Swapping in real photos
`js/scene.js` draws each room from a fixed layout plus its active anomalies. To use photos, replace `drawRoom` with a baseline `drawImage` and per-anomaly overlay/variant images; the anomaly data model (`type`, `target`, room) stays the same.

## Deploying
`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main`. One-time setup: repo **Settings > Pages > Build and deployment > Source: GitHub Actions**. The site will be at `https://<user>.github.io/AnomalyGame/`.
