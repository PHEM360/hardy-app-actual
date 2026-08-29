import { useCallback, useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  DEFAULT_HOME_TILES_STATE,
  mergeHomeTilesState,
  moveHomeTile,
  type HomeTilesState,
} from "@/lib/homeLayout";

export function useHomeTilesLayout() {
  const { profile, saveProfile } = useUserProfile();
  const layout = useMemo(() => mergeHomeTilesState(profile?.homeTiles), [profile?.homeTiles]);

  const save = useCallback(async (next: HomeTilesState) => {
    await saveProfile({ homeTiles: next });
  }, [saveProfile]);

  const setRowSize = useCallback(async (rowIndex: number, cols: number) => {
    const rowSizes = [...layout.rowSizes];
    while (rowSizes.length <= rowIndex) rowSizes.push(2);
    rowSizes[rowIndex] = cols;
    await save({ ...layout, rowSizes });
  }, [layout, save]);

  const addRowSize = useCallback(async () => {
    await save({ ...layout, rowSizes: [...layout.rowSizes, 2] });
  }, [layout, save]);

  const removeRowSize = useCallback(async (rowIndex: number) => {
    if (layout.rowSizes.length <= 1) return;
    await save({ ...layout, rowSizes: layout.rowSizes.filter((_, index) => index !== rowIndex) });
  }, [layout, save]);

  const moveTile = useCallback(async (id: string, delta: number) => {
    await save({ ...layout, order: moveHomeTile(layout.order, id, delta) });
  }, [layout, save]);

  const hideTile = useCallback(async (id: string) => {
    if (layout.hidden.includes(id)) return;
    await save({ ...layout, hidden: [...layout.hidden, id] });
  }, [layout, save]);

  const showTile = useCallback(async (id: string) => {
    await save({ ...layout, hidden: layout.hidden.filter((item) => item !== id) });
  }, [layout, save]);

  const resetLayout = useCallback(async () => {
    await save(DEFAULT_HOME_TILES_STATE);
  }, [save]);

  return { layout, setRowSize, addRowSize, removeRowSize, moveTile, hideTile, showTile, resetLayout };
}
