import type { DogTag } from "@/hooks/useDogTags";
import { dogTagAspectRatio } from "@/lib/dogTagShapes";

export const A4_WIDTH_CM = 21;
export const A4_HEIGHT_CM = 29.7;
export const PRINT_PX_PER_CM = 96 / 2.54;
export const DEFAULT_PRINT_GAP_CM = 0.4;

export const PRINT_PLACEMENT_STORAGE_KEY = "hardy-hub.dog-tag-print-placement";

export type PrintPlacement = {
  topCm: number;
  leftCm: number;
  gapCm: number;
};

export type PrintFace = {
  key: string;
  tagId: string;
  petId: string;
  petName: string;
  label: string;
  side: "front" | "back";
  widthCm: number;
  heightCm: number;
};

export type PlacedFace = PrintFace & {
  xCm: number;
  yCm: number;
  page: number;
};

export function faceDimensionsCm(shape: DogTag["shape"], sizeCm: number) {
  const aspect = dogTagAspectRatio(shape);
  return {
    widthCm: aspect >= 1 ? sizeCm : sizeCm * aspect,
    heightCm: aspect >= 1 ? sizeCm / aspect : sizeCm,
  };
}

export function clampPrintCm(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value * 10) / 10));
}

export function normalizePrintPlacement(placement: Partial<PrintPlacement> | null | undefined): PrintPlacement {
  return {
    topCm: clampPrintCm(Number(placement?.topCm), A4_HEIGHT_CM - 0.5),
    leftCm: clampPrintCm(Number(placement?.leftCm), A4_WIDTH_CM - 0.5),
    gapCm: clampPrintCm(Number(placement?.gapCm ?? DEFAULT_PRINT_GAP_CM), 3),
  };
}

export function readStoredPrintPlacement(): PrintPlacement {
  try {
    const raw = window.localStorage.getItem(PRINT_PLACEMENT_STORAGE_KEY);
    return normalizePrintPlacement(raw ? JSON.parse(raw) as Partial<PrintPlacement> : { gapCm: DEFAULT_PRINT_GAP_CM });
  } catch {
    return normalizePrintPlacement({ gapCm: DEFAULT_PRINT_GAP_CM });
  }
}

export function storePrintPlacement(placement: PrintPlacement) {
  window.localStorage.setItem(PRINT_PLACEMENT_STORAGE_KEY, JSON.stringify(normalizePrintPlacement(placement)));
}

export function layoutPrintFaces(faces: PrintFace[], placement: PrintPlacement): PlacedFace[] {
  const { topCm, leftCm, gapCm } = normalizePrintPlacement(placement);
  const margin = 0.4;
  const placed: PlacedFace[] = [];
  let page = 1;
  let x = leftCm;
  let y = topCm;
  let rowHeight = 0;

  const startPage = (nextPage: number) => {
    page = nextPage;
    x = leftCm;
    y = nextPage === 1 ? topCm : 0;
    rowHeight = 0;
  };

  for (const face of faces) {
    if (x > leftCm + 0.001 && x + face.widthCm > A4_WIDTH_CM - margin) {
      x = leftCm;
      y += rowHeight + gapCm;
      rowHeight = 0;
    }
    if (y + face.heightCm > A4_HEIGHT_CM - margin && (page > 1 || y > (page === 1 ? topCm : 0) + 0.001 || x > leftCm + 0.001)) {
      startPage(page + 1);
    }
    placed.push({ ...face, xCm: x, yCm: y, page });
    rowHeight = Math.max(rowHeight, face.heightCm);
    x += face.widthCm + gapCm;
  }

  return placed;
}

export function usedStripBottomCm(placed: PlacedFace[], page = 1) {
  const onPage = placed.filter((face) => face.page === page);
  if (onPage.length === 0) return 0;
  return Math.max(...onPage.map((face) => face.yCm + face.heightCm));
}

export function nextTopAfterPrint(placed: PlacedFace[], gapCm: number) {
  const bottom = usedStripBottomCm(placed, 1);
  if (bottom <= 0) return 0;
  return clampPrintCm(bottom + gapCm, A4_HEIGHT_CM - 0.5);
}

export function printTagKey(petId: string, tagId: string) {
  return `${petId}/${tagId}`;
}

export function buildPrintFaces(
  items: Array<{ tag: DogTag; petName: string; front: boolean; back: boolean }>,
): PrintFace[] {
  const faces: PrintFace[] = [];
  for (const item of items) {
    if (!item.front && !item.back) continue;
    const { widthCm, heightCm } = faceDimensionsCm(item.tag.shape, item.tag.sizeCm);
    if (item.front) {
      faces.push({
        key: `${printTagKey(item.tag.petId, item.tag.id)}:front`,
        tagId: item.tag.id,
        petId: item.tag.petId,
        petName: item.petName,
        label: item.tag.label,
        side: "front",
        widthCm,
        heightCm,
      });
    }
    if (item.back) {
      faces.push({
        key: `${printTagKey(item.tag.petId, item.tag.id)}:back`,
        tagId: item.tag.id,
        petId: item.tag.petId,
        petName: item.petName,
        label: item.tag.label,
        side: "back",
        widthCm,
        heightCm,
      });
    }
  }
  return faces;
}
