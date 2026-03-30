export const DEFAULT_DOMAIN = "game";

export const DEFAULT_ACTION_SCHEMA = Object.freeze({
  produce: {
    required: ["resource", "amount"]
  },
  consume: {
    required: ["resource", "amount"]
  },
  transport: {
    required: ["from", "to", "amount"]
  },
  build: {
    required: ["machine", "count"]
  },
  inspect: {
    required: []
  },
  set_tile_type: {
    required: ["x", "y", "tileType"]
  },
  generate_world: {
    required: ["seed"]
  },
  regenerate_world: {
    required: ["seed"]
  }
});

export const DEFAULT_MUTATION_MATRIX = Object.freeze({
  game: [
    "resources.ore",
    "resources.copper",
    "resources.iron",
    "resources.gears",
    "machines.miners",
    "machines.conveyors",
    "machines.assemblers",
    "logistics.storageA",
    "logistics.storageB",
    "world.seed",
    "world.size",
    "world.meta",
    "world.tiles",
    "meta.lastAction",
    "meta.revision"
  ]
});

export const BUILD_COSTS = Object.freeze({
  miner: 5,
  conveyor: 2,
  assembler: 8
});

export const TILE_OUTPUT_LABELS = Object.freeze({
  empty: "",
  mine: "Erz",
  storage: "Lager",
  factory: "Fabrik",
  connector: "Verbindung"
});

export const PROGRESSION_LEVELS = Object.freeze([
  Object.freeze({ id: "seed", title: "Seed", threshold: 0 }),
  Object.freeze({ id: "sprout", title: "Sprout", threshold: 16 }),
  Object.freeze({ id: "builder", title: "Builder", threshold: 40 }),
  Object.freeze({ id: "flow", title: "Flow", threshold: 76 }),
  Object.freeze({ id: "assembly", title: "Assembly", threshold: 124 }),
  Object.freeze({ id: "horizon", title: "Horizon", threshold: 188 })
]);

export const REWARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "ore-first",
    title: "Ore First",
    description: "First ore signal online.",
    when: (snapshot) => snapshot.resources.ore > 0
  }),
  Object.freeze({
    id: "copper-first",
    title: "Copper First",
    description: "Copper flow established.",
    when: (snapshot) => snapshot.resources.copper > 0
  }),
  Object.freeze({
    id: "iron-first",
    title: "Iron First",
    description: "Iron flow established.",
    when: (snapshot) => snapshot.resources.iron > 0
  }),
  Object.freeze({
    id: "gear-first",
    title: "Gear First",
    description: "Gear stock is available.",
    when: (snapshot) => snapshot.resources.gears > 0
  }),
  Object.freeze({
    id: "machine-first",
    title: "Machine First",
    description: "At least one machine is working.",
    when: (snapshot) => snapshot.machines.total > 0
  }),
  Object.freeze({
    id: "assembler-line",
    title: "Assembler Line",
    description: "Assembler capacity is online.",
    when: (snapshot) => snapshot.machines.assemblers > 0
  }),
  Object.freeze({
    id: "logistics-flow",
    title: "Logistics Flow",
    description: "Storage is carrying load.",
    when: (snapshot) => snapshot.logistics.total > 0
  })
]);
