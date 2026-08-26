import QRCodeSVG from "react-qr-code";
import type { DogTag } from "@/hooks/useDogTags";
import { APP_BASE_URL } from "@/lib/appUrl";
import { faceDimensionsCm, PRINT_PX_PER_CM } from "@/lib/dogTagPrint";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";

export { faceDimensionsCm, PRINT_PX_PER_CM };

export type TagSide = "front" | "back";

export function publicTagUrl(tag: Pick<DogTag, "slug" | "petId" | "id" | "code">): string {
  if (tag.slug) return `${APP_BASE_URL}/p/${tag.slug}`;
  return `${APP_BASE_URL}/tag/${tag.petId}/${tag.id}?c=${tag.code}`;
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
            <QRCodeSVG value={publicTagUrl(tag)} fgColor={tag.fgColor} bgColor="transparent" size={qrPx} style={{ width: "100%", height: "100%" }} />
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
