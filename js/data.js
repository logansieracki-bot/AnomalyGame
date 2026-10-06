// Static game data: rooms, anomaly types, entities, nights.
const W = 1280, H = 720;

// cell = [col,row] on the 3-wide FNAF-style map; keys 1-9 select in this order.
const ROOMS = [
  { id: 'bedroom1',  name: 'Bedroom 1',      label: 'Bedroom\n1',      cell: [0, 0], wall: 24, floor: 15 },
  { id: 'bathroom1', name: 'Bathroom 1',     label: 'Bathroom\n1',     cell: [1, 0], wall: 30, floor: 20 },
  { id: 'garage',    name: 'Garage',         label: 'Garage',          cell: [2, 0], wall: 20, floor: 13 },
  { id: 'bedroom2',  name: 'Bedroom 2',      label: 'Bedroom\n2',      cell: [0, 1], wall: 26, floor: 16 },
  { id: 'bathroom2', name: 'Bathroom 2',     label: 'Bathroom\n2',     cell: [1, 1], wall: 32, floor: 21 },
  { id: 'laundry',   name: 'Laundry Room',   label: 'Laundry\nRoom',   cell: [2, 1], wall: 27, floor: 18 },
  { id: 'living',    name: 'Living Room',    label: 'Living\nRoom',    cell: [0, 2], wall: 22, floor: 14 },
  { id: 'kitchen',   name: 'Kitchen',        label: 'Kitchen',         cell: [1, 2], wall: 29, floor: 19 },
  { id: 'basement',  name: 'Basement Stairs', label: 'Basement\nStairs', cell: [2, 2], wall: 18, floor: 12 },
];
const ROOM = Object.fromEntries(ROOMS.map(r => [r.id, r]));

// Dropdown entries for environmental reports.
const ANOMALY_TYPES = [
  { id: 'lighting',   label: 'Lighting change' },
  { id: 'structural', label: 'Structural change' },
  { id: 'shadow',     label: 'Misplaced shadow' },
  { id: 'surface',    label: 'Surface change' },
  { id: 'relocated',  label: 'Relocated object' },
  { id: 'rotation',   label: 'Object rotation' },
  { id: 'missing',    label: 'Missing object' },
  { id: 'new',        label: 'New object' },
];

// path = rooms it walks through; after the last room it is at its entry point.
const ENTITIES = {
  visitor: { name: 'The Visitor', entry: 'door', path: ['garage', 'laundry', 'kitchen', 'living'], tell: 'knock' },
  crawler: { name: 'The Crawler', entry: 'vent', path: ['basement', 'bathroom2', 'bedroom2'],      tell: 'scratch' },
  watcher: { name: 'The Watcher', entry: 'door', path: ['bedroom1', 'bathroom1', 'kitchen'],       tell: 'breath' },
};

// spawn = seconds between anomalies, active = max simultaneous (+2 by 6am),
// subtle = 0..1 how small the changes get, halluc = hallucination intensity,
// move = seconds between entity steps, kill = seconds you have to block.
const NIGHTS = [
  { n: 1, spawn: [20, 30], active: 3, subtle: 0.05, halluc: 0,   ents: [],                                  move: [0, 0],  kill: 6,   delay: 3,   cooldown: 6 },
  { n: 2, spawn: [16, 26], active: 4, subtle: 0.25, halluc: 0.5, ents: [],                                  move: [0, 0],  kill: 6,   delay: 3.5, cooldown: 7 },
  { n: 3, spawn: [15, 24], active: 5, subtle: 0.4,  halluc: 0.8, ents: ['visitor'],                         move: [11, 17], kill: 5,   delay: 4,   cooldown: 8 },
  { n: 4, spawn: [14, 22], active: 5, subtle: 0.55, halluc: 1.1, ents: ['visitor', 'crawler'],              move: [10, 15], kill: 4.5, delay: 4,   cooldown: 8 },
  { n: 5, spawn: [12, 20], active: 6, subtle: 0.7,  halluc: 1.5, ents: ['visitor', 'crawler', 'watcher'],  move: [9, 14],  kill: 4,   delay: 4.5, cooldown: 9 },
  { n: 6, spawn: [10, 17], active: 7, subtle: 0.85, halluc: 2.0, ents: ['visitor', 'crawler', 'watcher'],  move: [7, 12],  kill: 3.5, delay: 4.5, cooldown: 9 },
];

const NIGHT_LENGTH = 360;          // 6 minutes: 60s per in-game hour
const HOURS = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM'];
