# Design: House Anomaly Camera Game (working title)

A first-person horror game in the spirit of FNAF, set in an ordinary house shown through real-photo night-vision cameras. Your twist: you **report anomalies** to keep the house (and yourself) safe.

## Pitch
You work the night shift (12am-6am) in a small monitor room. Cameras cover every room. Things change. Report what's wrong, and defend your door and vents when something gets close.

## Structure
- One night = **6 real-time minutes** (60 seconds per in-game hour, 12am to 6am).
- Survive until 6am to win the night.
- No upgrade shop. Progression is new rooms, anomaly types, and entities each night.
- Psychological early, interactive and hunting later.

## Core loop
```
Watch cameras -> spot something wrong -> report (delay) -> cooldown
      \ if ignored / wrong
   overload + entity pressure builds -> it reaches the door/vent -> block it in time
```

## Camera UI
- FNAF-style **floor-plan map** showing every room and **where the player's room is**.
- Select a room camera from the map. Only one camera is viewed at a time.
- Viewing cameras drains monitor power; lowering the monitor saves power but blinds you.
- Later nights: the map glitches, mislabels rooms, or drops cameras.

## Reporting
1. Select the room camera.
2. Press **Report**.
3. Pick the anomaly type from the **dropdown**.
4. The report **processes for a few seconds** (delay). Then the **cooldown** starts; no new report until it ends.

Outcomes:
| Situation | Result |
|---|---|
| Correct environmental report | Anomaly is fixed and removed; overload drops |
| Correct entity report (right type) | Entity pushed away or temporarily removed |
| Right room, wrong type | No or weak effect; cooldown still applies |
| Nothing real there / a hallucination | False report; cooldown, wasted time |

There is **no sanity meter**. The penalty for a bad report is lost time (the cooldown) while the threat keeps advancing.

## Anomaly tiers

### Tier 1: Environmental (not dangerous, but they overload)
Reporting the right type fixes and removes the anomaly. Anomalies may **stack** (several in one room at once).

| Dropdown entry | Examples |
|---|---|
| Lighting change | lamp on/off, TV glow, light under a door |
| Structural change | door/window/cabinet open or closed, curtain moved |
| Misplaced shadow | shadow with no source, wrong direction |
| Surface change | stain, crack, wet floor, smeared mirror |
| Relocated object | remote, mug, shoes in a new spot |
| Object rotation | frame turned, chair rotated |
| Missing object | vase, book, or item gone |
| New object | box, doll, coat that was not there |

Ideas for later: scale change, count change, reflection mismatch, clock/time wrong.

Difficulty is tuned by size of change, contrast, position in frame, whether it appears gradually or while you look away, and camera quality. Early nights use big changes; later nights use subtle ones.

### Tier 2: Entity presence (dangerous)
Report choice is **Entity Presence -> type select**. Correct type pushes it away or temporarily removes it.

Four entities at launch:
| Entity | Rule |
|---|---|
| **The Watcher** | Only advances while you are *not* looking at its room's camera |
| **The Crawler** | Travels through vents; quiet until it is right there |
| **The Visitor** | Comes to the door and knocks; opening/late blocking is fatal |
| **The Mimic** | Creates fake-looking anomalies and imitates others to waste reports |

(Names and rules are placeholders to iterate on.)

### Tier 3: Hallucinations (not reportable)
Semi-transparent figures, faces in windows, flickering shapes, whispers. They do nothing mechanically, but they **try to bait a false report**. They get more frequent and more convincing in later hours and later nights, and are placed near real anomalies to hide them. Tell: they are semi-transparent, flicker, or fade on a timer; real entities are solid.

## Defense (the room you are in)
Inspired by FNAF 4: audio tells and fast reactions.
- Entry points: **door** and **vents** (window possible later).
- Each entity approaches a specific entry point with an audio tell (breathing, scratching, knocking, vent rattle).
- Block it with the right action (close door, seal vent) **before it arrives**. Wasting a block costs power.
- Watching an entry point means not watching cameras.

## Resources and lose conditions
- **Monitor power** drains while the monitor is up and when using defenses.
- You lose if:
  1. You are **too late** blocking an entity at the door or a vent.
  2. **Entity overload**: unresolved anomalies and entity pressure pass a threshold.
  3. **Monitor power runs out.**

## Night progression (draft)
| Night | New element |
|---|---|
| 1 | Cameras and environmental reports only |
| 2 | More simultaneous anomalies, hallucinations begin |
| 3 | First entity at the door; blocking introduced |
| 4 | Vent entity added |
| 5 | Mimic and map glitches; harder hallucinations |
| 6+ | Multiple entities, window threat, cameras fail at bad times |

## Tech direction
- **Web (HTML/JS, Canvas/WebGL)**. Chosen because the game is 2D photo layers + UI, easy to share, and no Godot required.
- Real photos as layered images; anomalies are overlays, masks, or swapped crops.
- Night-vision grade, grain, and glitch applied by shader or canvas filter.
- State machine for night clock, report system, entity AI, and power.
- Audio is core to the defense gameplay.

## Open questions
- Exact delay and cooldown lengths per night.
- Whether the entity "distance" is visible to the player or hidden.
- Window as a third entry point.
- Final names and lore for the house and entities.
