// Static game data: rooms, anomaly types, entities, nights.
const W = 1280, H = 720;

// pos = [left, top] in percent of the floor-plan map; keys 1-9 select in this order.
const ROOMS = [
  { id: 'bedroom1',  name: 'Bedroom 1',      label: 'Bed 1',      pos: [2, 2], wall: 24, floor: 15 },
  { id: 'bathroom1', name: 'Bathroom 1',     label: 'Bath 1',     pos: [38, 2], wall: 30, floor: 20 },
  { id: 'garage',    name: 'Garage',         label: 'Garage',          pos: [74, 2], wall: 20, floor: 13 },
  { id: 'bedroom2',  name: 'Bedroom 2',      label: 'Bed 2',      pos: [2, 30], wall: 26, floor: 16 },
  { id: 'bathroom2', name: 'Bathroom 2',     label: 'Bath 2',     pos: [38, 30], wall: 32, floor: 21 },
  { id: 'laundry',   name: 'Laundry Room',   label: 'Laundry',   pos: [74, 30], wall: 27, floor: 18 },
  { id: 'living',    name: 'Living Room',    label: 'Living',    pos: [2, 58], wall: 22, floor: 14 },
  { id: 'kitchen',   name: 'Kitchen',        label: 'Kitchen',         pos: [38, 58], wall: 29, floor: 19 },
  { id: 'basement',  name: 'Basement Stairs', label: 'Stairs', pos: [74, 58], wall: 18, floor: 12 },
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

// Hallways between rooms: [roomA, roomB, length in walking steps]. Drawn as lines on the map;
// entity paths must follow these, and entity travel time scales with the length.
const EDGES = [
  ['bedroom1', 'bathroom1', 14], ['bathroom1', 'garage', 22], ['bedroom1', 'bedroom2', 12], ['bathroom1', 'bathroom2', 10],
  ['garage', 'laundry', 18], ['bedroom2', 'bathroom2', 13], ['bathroom2', 'laundry', 15], ['bedroom2', 'living', 11],
  ['bathroom2', 'kitchen', 12], ['laundry', 'kitchen', 17], ['laundry', 'basement', 9], ['living', 'kitchen', 16],
  ['kitchen', 'basement', 19], ['basement', 'bathroom2', 24],
];
// Rooms that touch your office, with the walking steps from there: the door opens onto the
// living room and kitchen, the vent onto the basement stairs.
const ENTRY_LINKS = { door: { living: 7, kitchen: 10 }, vent: { basement: 6 } };
const AVG_HOP = 15;                       // typical hop length; entity step timing is relative to this

// Walking steps from each room to you (shortest route to the door or vent), shown on the map.
const DIST = (() => {
  const d = {};
  for (const links of Object.values(ENTRY_LINKS)) for (const [r, n] of Object.entries(links)) d[r] = Math.min(d[r] ?? Infinity, n);
  for (let changed = true; changed;) {            // Bellman-Ford style relaxation, tiny graph
    changed = false;
    for (const [a, b, n] of EDGES) {
      if (d[a] !== undefined && (d[b] === undefined || d[a] + n < d[b])) { d[b] = d[a] + n; changed = true; }
      if (d[b] !== undefined && (d[a] === undefined || d[b] + n < d[a])) { d[a] = d[b] + n; changed = true; }
    }
  }
  return d;
})();
// Length of one hop for an entity: room -> next room, or last room -> your entry.
function hopLength(entityId, stage) {
  const def = ENTITIES[entityId], path = def.path;
  if (stage + 1 >= path.length) return ENTRY_LINKS[def.entry][path[path.length - 1]];
  const a = path[stage], b = path[stage + 1];
  return EDGES.find(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))[2];
}

// Door and vent wear out if you keep them shut: strain builds while closed, and at 100 they jam open.
const STRAIN = { build: 12, recover: 5, jam: 10 };
