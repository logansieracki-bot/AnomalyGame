// Static game data: rooms, anomaly types, entities, nights.
const W = 1280, H = 720;

// pos = [left, top] in percent of the floor-plan map; keys 1-9 select in this order.
const ROOMS = [
  { id: 'bedroom1',  name: 'Bedroom 1',      label: 'Bedroom\n1',      pos: [2, 2], wall: 24, floor: 15 },
  { id: 'bathroom1', name: 'Bathroom 1',     label: 'Bathroom\n1',     pos: [38, 2], wall: 30, floor: 20 },
  { id: 'garage',    name: 'Garage',         label: 'Garage',          pos: [74, 2], wall: 20, floor: 13 },
  { id: 'bedroom2',  name: 'Bedroom 2',      label: 'Bedroom\n2',      pos: [2, 30], wall: 26, floor: 16 },
  { id: 'bathroom2', name: 'Bathroom 2',     label: 'Bathroom\n2',     pos: [38, 30], wall: 32, floor: 21 },
  { id: 'laundry',   name: 'Laundry Room',   label: 'Laundry\nRoom',   pos: [74, 30], wall: 27, floor: 18 },
  { id: 'living',    name: 'Living Room',    label: 'Living\nRoom',    pos: [2, 58], wall: 22, floor: 14 },
  { id: 'kitchen',   name: 'Kitchen',        label: 'Kitchen',         pos: [38, 58], wall: 29, floor: 19 },
  { id: 'basement',  name: 'Basement Stairs', label: 'Basement\nStairs', pos: [74, 58], wall: 18, floor: 12 },
];
const ROOM = Object.fromEntries(ROOMS.map(r => [r.id, r]));

// Dropdown entries for environmental reports.
const ANOMALY_TYPES = [
  { id: 'lighting', hint: 'A lamp on/off, room brighter or darker',   label: 'Lighting change' },
  { id: 'structural', hint: 'A door open, curtains moved', label: 'Structural change' },
  { id: 'shadow', hint: 'A dark shape cast on a wall',     label: 'Misplaced shadow' },
  { id: 'surface', hint: 'Wet spots on the floor, cracks in the wall',    label: 'Surface change' },
  { id: 'relocated', hint: 'An object in a different spot',  label: 'Relocated object' },
  { id: 'rotation', hint: 'An object turned or tilted',   label: 'Object rotation' },
  { id: 'missing', hint: 'Something that should be here is gone',    label: 'Missing object' },
  { id: 'new', hint: 'Something here that was not before',        label: 'New object' },
];

// path = rooms it walks through; after the last room it is at its entry point.
const ENTITIES = {
  visitor: { name: 'The Visitor', entry: 'door', path: ['garage', 'laundry', 'kitchen', 'living'], tell: 'knock' },
  crawler: { name: 'The Crawler', entry: 'vent', path: ['bedroom2', 'bathroom2', 'laundry', 'basement'], tell: 'scratch' },
  watcher: { name: 'The Watcher', entry: 'door', path: ['bedroom1', 'bathroom1', 'bathroom2', 'kitchen'], tell: 'breath' },
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

// Hallways between rooms (drawn as lines on the map; entity paths must follow these).
const EDGES = [
  ['bedroom1', 'bathroom1'], ['bathroom1', 'garage'], ['bedroom1', 'bedroom2'], ['bathroom1', 'bathroom2'],
  ['garage', 'laundry'], ['bedroom2', 'bathroom2'], ['bathroom2', 'laundry'], ['bedroom2', 'living'],
  ['bathroom2', 'kitchen'], ['laundry', 'kitchen'], ['laundry', 'basement'], ['living', 'kitchen'],
  ['kitchen', 'basement'], ['basement', 'bathroom2'],
];
// Rooms that touch your office: the door opens onto living room + kitchen, the vent onto the basement stairs.
const ENTRY_LINKS = { door: ['living', 'kitchen'], vent: ['basement'] };

// Steps from each room to you (1 = next to your office), shown on the map.
const DIST = (() => {
  const d = {}, q = [];
  for (const rooms of Object.values(ENTRY_LINKS)) for (const r of rooms) { d[r] = 1; q.push(r); }
  while (q.length) {
    const r = q.shift();
    for (const [a, b] of EDGES) { const o = a === r ? b : b === r ? a : null; if (o && d[o] === undefined) { d[o] = d[r] + 1; q.push(o); } }
  }
  return d;
})();

// Door and vent wear out if you keep them shut: strain builds while closed, and at 100 they jam open.
const STRAIN = { build: 12, recover: 5, jam: 10 };
