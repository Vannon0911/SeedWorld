import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "09-game-logic-tile-action";

/**
 * Run a test that verifies placing and clearing a tile via GameLogicController.
 *
 * Verifies that applying a `set_tile_type` action with `tileType: "mine"` at (2,3)
 * sets the tile's `type`, `isActive`, `isEmpty`, and `outputText` as expected, and
 * that applying `tileType: "empty"` at the same coordinates restores the tile to
 * an empty, inactive state.
 *
 * @param {Object} ctx - Test context.
 * @param {Object} ctx.assert - Assertion utilities (e.g., from the test harness).
 * @param {string} ctx.root - Filesystem root path of the project under test.
 */
export async function test({ assert, root }) {
  const gameLogicModule = await import(pathToFileURL(path.join(root, "app/src/game/GameLogicController.js")));

  const logic = new gameLogicModule.GameLogicController({
    plan: async () => ({}),
    apply: async () => ({})
  });

  const initialState = logic.applyActionLocally(
    {
      type: "generate_world",
      payload: {
        seed: "tile-action-seed",
        width: 8,
        height: 6
      }
    },
    {}
  ).previewState;

  const result = logic.applyActionLocally(
    {
      type: "set_tile_type",
      payload: {
        x: 2,
        y: 3,
        tileType: "mine"
      }
    },
    initialState
  );

  const placed = result.previewState.world.tiles.find((tile) => tile.x === 2 && tile.y === 3);
  assert.equal(placed?.type, "mine", "set_tile_type muss den Tile-Typ setzen.");
  assert.equal(placed?.isActive, true, "set_tile_type muss Aktivstatus setzen.");
  assert.equal(placed?.isEmpty, false, "set_tile_type darf gesetzte Tiles nicht als leer markieren.");
  assert.equal(placed?.outputText, "Erz", "set_tile_type muss den Tile-Output setzen.");

  const cleared = logic.applyActionLocally(
    {
      type: "set_tile_type",
      payload: {
        x: 2,
        y: 3,
        tileType: "empty"
      }
    },
    result.previewState
  ).previewState.world.tiles.find((tile) => tile.x === 2 && tile.y === 3);

  assert.equal(cleared?.type, "empty", "Tile muss wieder auf empty gesetzt werden koennen.");
  assert.equal(cleared?.isActive, false, "Leere Tiles duerfen nicht aktiv sein.");
  assert.equal(cleared?.isEmpty, true, "Leere Tiles muessen isEmpty=true setzen.");
}

export const run = test;
