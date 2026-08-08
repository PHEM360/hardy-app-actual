import type { DogTagShape } from "@/hooks/useDogTags";
import type { CSSProperties } from "react";

export const DOG_TAG_SHAPES: { value: DogTagShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded square" },
  { value: "oval", label: "Oval" },
  { value: "heart", label: "Heart" },
];

const HEART_CLIP_PATH =
  "polygon(50% 15%, 61% 5%, 75% 5%, 88% 15%, 95% 30%, 95% 45%, 50% 95%, 5% 45%, 5% 30%, 12% 15%, 25% 5%, 39% 5%)";

/** CSS for the outer sticker shape — used for on-screen preview, thumbnails, and the print target. */
export function dogTagShapeStyle(shape: DogTagShape): CSSProperties {
  switch (shape) {
    case "circle":
      return { borderRadius: "50%" };
    case "oval":
      return { borderRadius: "50%" };
    case "heart":
      return { clipPath: HEART_CLIP_PATH, borderRadius: 0 };
    case "rounded":
    default:
      return { borderRadius: "18%" };
  }
}

/** Aspect ratio (width / height) the sticker should render at for a given shape. */
export function dogTagAspectRatio(shape: DogTagShape): number {
  if (shape === "oval") return 1.5;
  if (shape === "heart") return 1.05;
  return 1;
}
