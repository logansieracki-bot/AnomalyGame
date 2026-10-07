# Audio assets (analog horror)

**Nothing in the game is synthesized.** Every sound is a recording from this folder, named in `manifest.json`. A missing file is simply silent. Add more variants by appending paths to an array (shuffled, no immediate repeats). Per-sound loudness trims go in the manifest's `"gains"` object. Players also get Volume and Ambience sliders on the menu.

Audition at `index.html?soundtest=1` (serve over http, e.g. `python3 -m http.server`; `file://` can't load audio) with headphones. The page lists which files loaded and which are silent.

Format: `.ogg` (or mp3/wav), ~10 MB total. Loops (`cam/vhs_bed`, `rooms/*`, `office/*_bed`, `body/tinnitus_loop`) must loop seamlessly. `body/heartbeat_single` is **one** lub-dub; the game repeats it at the right tempo. Record the license of every file in `CREDITS.md` (prefer CC0 / royalty-free, no attribution).

## Sound direction: go off analog horror
Reference: Local 58, The Mandela Catalogue, Gemini Home Entertainment, Petscop, Don't Hug Me I'm Scared, the Walten Files, "Backrooms" found footage, late-night public-access and "lost broadcast" tapes. The vocabulary:
- **The medium is the monster.** Worn VHS and CRT hardware: tape hiss, tracking noise, wow and flutter, head-switching buzz, dropouts, signal collapsing into static, the 15 kHz CRT whine, degauss thump when a monitor powers on.
- **Mundane, then wrong.** Warm domestic room tones (fridge, clock, dryer, vents) that go dead for a few seconds; a TV or radio left on in another room; a phone ringing next door; sounds that don't belong.
- **Hardware as UI.** Every click is a machine: VCR transport buttons, tape insert / eject / rewind, camcorder REC beeps, relay ticks, a CRT flicking on and off.
- **Abrupt cuts and silence** beat loud noise. Bursts of static as punctuation, not music.
- **Avoid** orchestral hits, screams, laughter, music boxes, children singing, cartoon stingers.

## Files (where to search; Freesound CC0 filter, Sonniss GDC bundles, Pixabay, OpenGameArt)
| Folder / file | Search terms |
|---|---|
| `cam/vhs_bed` | "VHS tape hiss", "CRT TV whine", "CCTV monitor hum", "tape wow flutter", "static between channels". Keep it **quiet and thin**. |
| `cam/dropout1-3` | "tape dropout", "VHS glitch", "signal interference short", "tracking error" |
| `rooms/*` | one per room: "refrigerator hum", "wall clock ticking", "bathroom drip", "dryer tumble", "garage wind", "basement drone", "bedroom hvac room tone" |
| `office/crt_vents_bed` | "old CRT monitor hum", "air duct vent", "fluorescent ballast hum" |
| `office/*` one-shots | "house creak", "pipe tick expansion", "relay click" |
| `ir/wall_ir.wav` (optional) | free impulse response of a small room / "through a wall" (OpenAIR). Without it phantoms are just low-passed. |
| `phantoms/*` | muffled: "television in another room", "radio tuning static far away", "telephone ringing muffled", "footsteps upstairs", "floorboard creak", "door latch", "chair dragged", "pipe knock", "muffled voices through wall", "VHS rewind far away", "glass clink". **Never** knock / scratch / breathing (those are the entity family). |
| `tells/*` | "slow knocking on wooden door", "claws scratching wood / duct", "close heavy breathing" |
| `body/*` | "single heartbeat", "breathing panic", "gasp", "tinnitus ring loop" |
| `impacts/tape_slow_drop` | "tape slowing down", "VHS tape stop warble", "sub drop" (the room holds its breath when you see something) |
| `impacts/door_crack`, `vent_wrench` | "wood door splinter slam", "metal grate wrench" |
| `impacts/signal_collapse` | "signal collapse static roar", "tape chew" (overload death) |
| `impacts/crt_power_off` | "CRT TV power off thump whine" (power death) |
| `impacts/approach_steps` | "slow footsteps approaching, quiet room" |
| `ui/tape_insert_play` | "VHS tape insert play button" (night start) |
| `ui/channel_static_burst` | "channel change static", "TV static burst short" (camera switch) |
| `ui/vcr_button` | "VCR button click", "VHS player mechanical button" |
| `ui/crt_on` / `crt_off` | "CRT TV turn on degauss", "CRT TV turn off" (raise / lower the monitor) |
| `ui/camcorder_beep` | "camcorder record beep" (report submitted) |
| `ui/tape_spool` | "VHS rewind whir", "tape spooling" (plays while the report processes; its speed is stretched to match) |
| `ui/tape_stop_clunk` | "VCR stop button clunk" (report accepted) |
| `ui/signal_error` | "signal error tone distorted", "static zap" (report rejected) |
| `ui/relay_tick` | "relay click", quiet (cooldown over) |
| `ui/flashlight_on/off` | "old flashlight switch click" |
| `ui/door_slam_heavy`, `metal_groan` | "heavy metal door close", "metal groan strain" (door/vent close, jam) |
| `ui/dawn_signal_clears` | "static clearing to birdsong", "old radio tuning in" (6 AM) |
