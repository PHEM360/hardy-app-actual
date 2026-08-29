import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_TILES_STATE,
  mergeHomeTilesState,
  moveHomeTile,
  packHomeTiles,
} from "@/lib/homeLayout";

describe("home tile packing", () => {
  it("puts Quick Links on its own full-width row by default", () => {
    const rows = packHomeTiles(DEFAULT_HOME_TILES_STATE, DEFAULT_HOME_TILES_STATE.order);
    expect(rows[0]).toMatchObject({ cols: 1 });
    expect(rows[0].tiles.map((tile) => tile.id)).toEqual(["quick_links"]);
    expect(rows[1].cols).toBe(2);
    expect(rows[1].tiles).toHaveLength(2);
  });

  it("hides tiles and reflows the rest", () => {
    const rows = packHomeTiles(
      { ...DEFAULT_HOME_TILES_STATE, hidden: ["quick_links"] },
      DEFAULT_HOME_TILES_STATE.order,
    );
    expect(rows[0].tiles[0].id).toBe("finance");
    expect(rows[0].tiles).toHaveLength(1);
  });

  it("uses 3- and 4-wide rows later in the default pattern", () => {
    const rows = packHomeTiles(DEFAULT_HOME_TILES_STATE, DEFAULT_HOME_TILES_STATE.order);
    expect(rows.some((row) => row.cols === 3)).toBe(true);
    expect(rows.some((row) => row.cols === 4)).toBe(true);
  });

  it("reorders tiles and appends newly added page ids", () => {
    expect(moveHomeTile(["finance", "pets", "notes"], "notes", -1)).toEqual(["finance", "notes", "pets"]);
    const merged = mergeHomeTilesState({ order: ["pets", "finance"], hidden: [], rowSizes: [2] });
    expect(merged.order[0]).toBe("pets");
    expect(merged.order).toContain("quick_links");
  });
});
