# Photo Shoot List

Real photos are the look of the game, so shooting discipline matters. Anomalies are defined as **variants of one locked baseline photo per camera angle**.

## Shooting rules
- Tripod, **fixed position**, fixed focal length, fixed focus, manual exposure, manual white balance. Never move the tripod between a baseline and its variants.
- Shoot with room lights off or very low (night look). The night-vision grade, grain, and noise are added in the game, so shoot **clean**.
- Use RAW or highest-quality JPEG; same resolution for every frame (e.g. 1920x1080 or higher, 16:9).
- Use a remote shutter or timer to avoid shake.
- For every variant, change **only** the anomaly. Keep a note of what was changed.
- Shoot **extra empty "plates"** of each room for entity compositing (no people/pets).
- Name files: `room_angle_baseline.jpg`, `room_angle_a01_lighting_lamp.jpg`, etc.

## Difficulty tags
`E` easy (obvious), `M` medium, `H` hard (subtle). Aim for a spread in every room.

## Per-room checklist
Each camera angle needs:
1. 1 baseline
2. 6-10 environmental variants (below)
3. 1 empty plate for entity composites
4. Hallucination plates (see end)

### Living Room (already have a baseline)
- Lighting: floor lamp on (E), TV glowing (M), dim light in far corner (H)
- Structural: curtain pulled open (M), window cracked open (M)
- Shadow: figure-shaped shadow on wall (M), extra shadow under table (H)
- Surface: wet patch on couch cushion (H)
- Relocated: remote moved, mug moved, throw pillow moved (E/M/H)
- Rotation: coffee-table item rotated (M), wall frame crooked (E)
- Missing: item on coffee table gone (M)
- New: box or doll on the couch (E)
- Entry points: door and vent angle shots if visible

### Kitchen
- Lighting: stove light on (E), fridge light on (M)
- Structural: cabinet open (E), fridge door ajar (M), drawer pulled out (M)
- Shadow: shadow with no source under table (H)
- Surface: spill on counter or floor (M), smear on window (H)
- Relocated: chair out from table (E), item on counter moved (M)
- Rotation: mug handle direction changed (H), chair turned (M)
- Missing: fruit bowl or knife block item gone (H)
- New: unfamiliar object on the counter (M)

### Bedroom 1 and Bedroom 2
- Lighting: nightstand lamp on (E), closet light under door (M)
- Structural: closet door open (E), blind raised (M), door ajar (M)
- Shadow: shape at bed edge (M)
- Surface: wrinkle or imprint on the bed (M), mirror smeared (H)
- Relocated: shoes moved (M), items on dresser moved (H)
- Rotation: pillow turned, chair rotated (M)
- Missing: item from dresser gone (H)
- New: toy or clothes pile (M)

### Bathroom 1 and Bathroom 2
- Lighting: light on under door (E), night-light on (M)
- Structural: shower curtain open or closed (E), cabinet open (M), door ajar (M)
- Shadow: shape behind shower curtain (M)
- Surface: fogged mirror (E), water on floor (M), handprint on mirror (H)
- Relocated: towel moved (M), toiletries moved (H)
- Missing: toothbrush gone (H)
- New: unfamiliar item in the sink (M)

### Laundry Room
- Lighting: light flicker (M), dryer light (M)
- Structural: dryer door open (E), cabinet ajar (M), washer lid up (M)
- Surface: wet floor (M), stain on wall (H)
- Relocated: basket moved (E), detergent moved (H)
- New: object in dryer (M)
- Missing: clothes basket gone (E/M)

### Garage
- Lighting: light on at the far end (M), under-door light (M)
- Structural: garage door open a few inches (M), side door ajar (M)
- Shadow: tall shadow by shelf (M)
- Surface: oil or water stain (H)
- Relocated: bike, tools, boxes moved (M/H)
- Rotation: item turned (H)
- Missing: tool or box gone (H)
- New: unfamiliar box or object (M)

### Basement Stairs
- Lighting: light on at bottom (E), flicker (M)
- Structural: door at top open (E), railing item changed (H)
- Shadow: shape at the bottom of the stairs (M)
- Surface: stain on steps (H)
- Relocated: shoes or item on steps moved (M)
- New: item on a step (M)
- Missing: item from step gone (H)

## Entity plates
For each entity, shoot a costume or stand-in subject in key spots, same camera setup, to composite into the plates:
- **The Watcher:** standing far in a room, facing the camera; shoot from at least two rooms.
- **The Crawler:** vent or low-angle shots; hands/face at a vent opening.
- **The Visitor:** at the door (and in the doorway of one or two rooms).
- **The Mimic:** a stand-in subject in positions that look like an environmental anomaly (e.g. looks like a coat, or like a shadow).

Shoot on a clear background where possible, matching the room's lighting, so figures can be cut out.

## Hallucination assets
- Semi-transparent figures, faces in windows, flickers, and wall shapes.
- These can be made from the entity shots with opacity/blur, so keep source frames.
- Variants of **low / medium / high** convincingness, to scale with the night.

## Suggested order
1. **Living Room, Kitchen, Basement Stairs** (3 rooms for the first prototype).
2. Add door/vent angle shots for the monitor room.
3. Remaining rooms.
4. Entity and hallucination plates.

## Notes
- Many anomalies do not need a full re-shoot: lights, shadows, and some surfaces can be done as in-engine masks over the baseline. Only shoot variants for objects that move, appear, or disappear.
- Log every variant (room, angle, anomaly type, difficulty, location in frame) in a spreadsheet. The game needs this metadata to tell whether a report is correct.
