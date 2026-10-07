# Audio assets

Drop real recordings here using the file names in `manifest.json`. Anything missing falls back to a quiet synthesized stand-in, so the game always runs. Add extra variants by appending more paths to an array (random, no-repeat shuffle).

Audition everything with headphones at `index.html?soundtest=1` (serve over http, e.g. `python3 -m http.server`; `file://` can't load audio files). The page lists which files loaded.

Format: `.ogg` (or `.mp3`/`.wav`), keep the total around 10 MB. Loops (`*_bed`, `*_loop`, `rooms/*`) must be trimmed to loop seamlessly. Heartbeat is **one** lub-dub; the game repeats it at the right tempo. Record the license of every file in `CREDITS.md`.

| Folder | What | Character |
|---|---|---|
| `cam/` | VHS/CCTV bed (tape hiss, mains hum, faint CRT whine) and short tape dropouts | thin, "heard through a camera mic" |
| `rooms/` | one loop per room: kitchen fridge hum, living room clock, bathroom drip, laundry dryer tick, garage cold wind, stairs drone, bedrooms quiet HVAC | subtle, under the camera bed |
| `office/` | vent/duct air bed; one-shot house sounds (creaks, pipe ticks) | close, clear |
| `phantoms/` | far-off domestic sounds: footsteps overhead, floorboard, latch, chair drag, pipe knock, voices through a wall, glass | **never** knock/scratch/breathe; the game muffles and reverbs them |
| `tells/` | knock, claw scratch, close breathing | close, dry, physical; played only after you have seen the entity |
| `body/` | single heartbeat, breaths, gasp, tinnitus loop | |
| `impacts/` | sight drop, door crack, vent wrench, power down thunk, approach footsteps | dry and heavy; no screams, orchestral hits or music boxes |
| `ui/` | small interface sounds (optional) | |
