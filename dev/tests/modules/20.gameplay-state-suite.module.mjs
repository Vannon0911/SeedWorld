import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "20-gameplay-state-suite";

export async function test({ assert, root }) {
  const mkSeed = (...parts) => `suite-${id}-${parts.join("-")}`;
  const gameLogicModule = await import(pathToFileURL(path.join(root, "app/src/game/GameLogicController.js")).href);
  const radialModule = await import(pathToFileURL(path.join(root, "app/src/plugins/radialBuildController.js")).href);
  const { reduceGameState, GameLogicController } = gameLogicModule;
  const { getWorldTile } = radialModule;

  const base = { resources: { ore: 50 }, level: 1 };
  const clone = reduceGameState(base, []);
  assert.deepEqual(clone, base);
  assert.notEqual(clone, base);

  const patched = reduceGameState(base, [{ op: "set", domain: "game", path: "level", value: 7 }]);
  assert.equal(patched.level, 7);
  assert.equal(base.level, 1);

  assert.throws(
    () => reduceGameState({}, [{ op: "delete", path: "resources.ore", value: null }]),
    /Unsupported patch operation/
  );

  const logic = new GameLogicController({
    plan: async () => ({}),
    apply: async () => ({})
  });

  const worldState = logic.applyActionLocally(
    { type: "generate_world", payload: { seed: mkSeed("world"), width: 8, height: 6 } },
    {}
  ).previewState;
  assert.equal(worldState.world.tiles.length, 48);

  const variants = [
    { x: 2, y: 3, tileType: "mine", expectedOutput: "Erz" },
    { x: 1, y: 1, tileType: "storage", expectedOutput: "Lager" },
    { x: 0, y: 0, tileType: "factory", expectedOutput: "Fabrik" },
    { x: 4, y: 2, tileType: "connector", expectedOutput: "Verbindung" }
  ];
  let current = worldState;
  for (const variant of variants) {
    current = logic.applyActionLocally({ type: "set_tile_type", payload: variant }, current).previewState;
    const tile = current.world.tiles.find((t) => t.x === variant.x && t.y === variant.y);
    assert.equal(tile?.type, variant.tileType);
    assert.equal(tile?.outputText, variant.expectedOutput);
    assert.equal(tile?.isActive, true);
    assert.equal(tile?.isEmpty, false);
  }

  const cleared = logic.applyActionLocally(
    { type: "set_tile_type", payload: { x: 2, y: 3, tileType: "empty" } },
    current
  ).previewState.world.tiles.find((t) => t.x === 2 && t.y === 3);
  assert.equal(cleared?.type, "empty");
  assert.equal(cleared?.isActive, false);
  assert.equal(cleared?.isEmpty, true);

  assert.throws(
    () => logic.applyActionLocally({ type: "set_tile_type", payload: { x: 99, y: 99, tileType: "mine" } }, worldState),
    /Tile ausserhalb der Welt/
  );

  assert.equal(getWorldTile(null, 0, 0), null);
  assert.equal(getWorldTile({ tiles: "bad" }, 0, 0), null);
  assert.equal(getWorldTile({ tiles: [{ x: 0, y: 0, type: "mine" }] }, NaN, 0), null);
  assert.equal(getWorldTile({ tiles: [{ x: 0, y: 0, type: "mine" }] }, 0, 0)?.type, "mine");

  const indexedWorld = {
    size: { width: 3 },
    tiles: [
      { x: 0, y: 0, type: "empty" },
      { x: 1, y: 0, type: "mine" },
      { x: 2, y: 0, type: "factory" },
      { x: 0, y: 1, type: "storage" },
      { x: 1, y: 1, type: "connector" },
      { x: 2, y: 1, type: "empty" }
    ]
  };
  assert.equal(getWorldTile(indexedWorld, 1, 1)?.type, "connector");
  assert.equal(getWorldTile(indexedWorld, "2", "0")?.type, "factory");
}

export const run = test;
