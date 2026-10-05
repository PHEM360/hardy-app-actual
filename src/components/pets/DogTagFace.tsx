import { useMemo } from "react";
import type { DogTag } from "@/hooks/useDogTags";
import { APP_BASE_URL } from "@/lib/appUrl";
import { compactQrModules, qrModulesToPath } from "@/lib/compactQr";
import { faceDimensionsCm, PRINT_PX_PER_CM } from "@/lib/dogTagPrint";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";

export { faceDimensionsCm, PRINT_PX_PER_CM };

export type TagSide = "front" | "back";

type TagLinkFields = Pick<DogTag, "shortCode" | "slug" | "petId" | "id" | "code">;

/** The address a person would read or type. Shortest available link first. */
export function publicTagUrl(tag: TagLinkFields): string {
  if (tag.shortCode) return `${APP_BASE_URL}/t/${tag.shortCode}`;
  if (tag.slug) return `${APP_BASE_URL}/p/${tag.slug}`;
  return `${APP_BASE_URL}/tag/${tag.petId}/${tag.id}?c=${tag.code}`;
}

/**
 * What the QR encodes. The short link is uppercased as a whole (scheme and
 * host are case-insensitive, the /T/ route and code lookup are too) so it
 * fits QR alphanumeric mode: a 25×25 grid with medium error correction
 * instead of a 37×37 one, which is what makes it engraving friendly.
 */
export function tagQrValue(tag: TagLinkFields): string {
  const url = publicTagUrl(tag);
  return tag.shortCode ? url.toUpperCase() : url;
}

export function tagQrModuleCount(tag: TagLinkFields): number {
  return compactQrModules(tagQrValue(tag)).length;
}

function TagQr({ value, color, sizePx }: { value: string; color: string; sizePx: number }) {
  const modules = useMemo(() => compactQrModules(value), [value]);
  const path = useMemo(() => qrModulesToPath(modules), [modules]);
  return (
    <svg
      viewBox={`0 0 ${modules.length} ${modules.length}`}
      width={sizePx}
      height={sizePx}
      shapeRendering="crispEdges"
      style={{ width: "100%", height: "100%" }}
      data-testid="qr"
    >
      <path d={path} fill={color} />
    </svg>
  );
}

export function TagFace({
  tag,
  side,
  pxPerCm,
}: {
  tag: DogTag;
  side: TagSide;
  pxPerCm: number;
}) {
  const { widthCm, heightCm } = faceDimensionsCm(tag.shape, tag.sizeCm);
  const qrPx = tag.qrSizeCm * pxPerCm;

  return (
    <div
      className="flex flex-col items-center justify-center gap-[2%] shadow-lg border border-black/10 overflow-hidden"
      style={{
        width: widthCm * pxPerCm,
        height: heightCm * pxPerCm,
        backgroundColor: tag.bgColor,
        ...dogTagShapeStyle(tag.shape),
      }}
    >
      {side === "front" ? (
        <>
          <div className="dog-tag-qr" style={{ width: qrPx, height: qrPx }}>
            <TagQr value={tagQrValue(tag)} color={tag.fgColor} sizePx={qrPx} />
          </div>
          {tag.stickerText.trim() && (
            <p
              className="text-center font-bold leading-tight break-words px-1"
              style={{ color: tag.fgColor, fontSize: tag.stickerTextSizeCm * pxPerCm }}
            >
              {tag.stickerText}
            </p>
          )}
        </>
      ) : tag.backText.trim() ? (
        <p
          className="text-center font-bold leading-snug break-words whitespace-pre-line px-2"
          style={{ color: tag.fgColor, fontSize: tag.backTextSizeCm * pxPerCm }}
        >
          {tag.backText}
        </p>
      ) : null}
    </div>
  );
}
