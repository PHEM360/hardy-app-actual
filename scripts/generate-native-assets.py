#!/usr/bin/env python3
"""Pad the existing Hardy Hub icon onto a 1024 square and a 2732 splash."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "App Icon.png"
RESOURCES = ROOT / "resources"
ASSETS = ROOT / "assets"
BG = (15, 25, 35, 255)  # #0f1923


def contain(src: Image.Image, size: int, pad_ratio: float = 0.82) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    inner = int(size * pad_ratio)
    fitted = src.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    RESOURCES.mkdir(exist_ok=True)
    ASSETS.mkdir(exist_ok=True)

    icon = contain(src, 1024, 0.88)
    icon.save(RESOURCES / "icon.png", "PNG")
    icon.save(ASSETS / "logo.png", "PNG")
    icon.save(ASSETS / "icon-only.png", "PNG")

    splash = Image.new("RGBA", (2732, 2732), BG)
    mark = contain(src, 1024, 0.72)
    x = (2732 - mark.width) // 2
    y = (2732 - mark.height) // 2
    splash.paste(mark, (x, y), mark)
    splash.save(RESOURCES / "splash.png", "PNG")
    splash.save(ASSETS / "splash.png", "PNG")
    print("Wrote resources/icon.png, resources/splash.png and assets copies")


if __name__ == "__main__":
    main()
