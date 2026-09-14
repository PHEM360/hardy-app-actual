import { useEffect, useRef } from "react";

export type PlaceScene = "pasture" | "harvest" | "sailing" | "harbour" | "clouds" | "snow" | "aurora";

type Cloud = { x: number; y: number; s: number; speed: number; shade: number };
type Flake = { x: number; y: number; vx: number; vy: number; r: number; layer: number; a: number; spin: number };

export function DisplayPlaceCanvas({ scene, stormy = false }: { scene: PlaceScene; stormy?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const clouds: Cloud[] = [];
    const flakes: Flake[] = [];

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(2, Math.floor(rect.width));
      h = Math.max(2, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const seed = () => {
      clouds.length = 0;
      flakes.length = 0;
      const n = Math.round(6 * Math.max(0.85, w / 420));
      for (let i = 0; i < n; i++) {
        clouds.push({
          x: (i / n) * (w + 280) - 80,
          y: h * (0.08 + (i % 3) * 0.09 + (i % 2) * 0.03),
          s: 70 + (i % 5) * 28,
          speed: 8 + (i % 4) * 5,
          shade: 0.72 + (i % 3) * 0.08,
        });
      }
      const count = Math.round(160 * Math.max(0.8, w / 380));
      for (let i = 0; i < count; i++) {
        const layer = i % 3;
        flakes.push({
          x: Math.random() * (w + 40) - 20,
          y: Math.random() * h,
          vx: 0.08 + layer * 0.16,
          vy: 0.22 + layer * 0.38,
          r: 0.7 + layer * 1.7,
          layer,
          a: 0.28 + layer * 0.28,
          spin: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      if (scene === "pasture") drawPasture(ctx, t, w, h);
      else if (scene === "harvest") drawHarvest(ctx, t, w, h);
      else if (scene === "sailing") drawSailing(ctx, t, w, h);
      else if (scene === "harbour") drawHarbour(ctx, t, w, h);
      else if (scene === "clouds") drawCloudSky(ctx, t, w, h, clouds, stormy);
      else if (scene === "snow") drawSnowfall(ctx, t, w, h, flakes);
      else drawAuroraSky(ctx, t, w, h);
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [scene, stormy]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  inner: string,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.3, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function hill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  y: number,
  amp: number,
  len: number,
  t: number,
  speed: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const rise = Math.sin(x / len + t * speed) * amp + Math.sin(x / (len * 0.46) + t * speed * 0.7) * amp * 0.32;
    ctx.lineTo(x, y + rise);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function canopyTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, leaf: string, trunk = "rgba(47, 32, 18, 0.82)") {
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.07, y);
  ctx.lineTo(x + s * 0.07, y);
  ctx.lineTo(x + s * 0.04, y - s * 0.42);
  ctx.lineTo(x - s * 0.04, y - s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = leaf;
  const lobes = [
    [0, -0.62, 0.38],
    [-0.28, -0.42, 0.3],
    [0.26, -0.4, 0.28],
    [-0.08, -0.82, 0.24],
    [0.14, -0.72, 0.2],
  ];
  ctx.beginPath();
  for (const [dx, dy, r] of lobes) {
    ctx.moveTo(x + s * dx + s * r, y + s * dy);
    ctx.arc(x + s * dx, y + s * dy, s * r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function sheep(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, i: number) {
  const bob = Math.sin(t * 0.9 + i * 1.3) * 1.1;
  ctx.fillStyle = "rgba(24, 24, 27, 0.55)";
  ctx.fillRect(x - s * 0.55, y + s * 0.2 + bob, s * 0.18, s * 0.42);
  ctx.fillRect(x + s * 0.28, y + s * 0.2 + bob, s * 0.18, s * 0.42);
  ctx.fillStyle = "rgba(250, 250, 249, 0.94)";
  ctx.beginPath();
  ctx.ellipse(x, y + bob, s, s * 0.62, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(39, 39, 42, 0.88)";
  ctx.beginPath();
  ctx.ellipse(x + s * 0.82, y - s * 0.08 + bob, s * 0.28, s * 0.24, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, shade: number, stormy: boolean) {
  const light = stormy ? 168 : 252;
  const dark = stormy ? 110 : 210;
  const alpha = stormy ? 0.55 : 0.78;
  const lobes: [number, number, number, number][] = [
    [0, 0, 1, 0.52],
    [-0.62, 0.08, 0.72, 0.44],
    [0.58, 0.1, 0.7, 0.42],
    [-0.22, -0.32, 0.55, 0.4],
    [0.26, -0.28, 0.5, 0.36],
    [0.02, 0.16, 0.92, 0.34],
  ];
  ctx.fillStyle = `rgba(${dark}, ${dark + 8}, ${dark + 14}, ${alpha * 0.45})`;
  ctx.beginPath();
  for (const [dx, dy, rx, ry] of lobes) {
    ctx.ellipse(x + s * dx, y + s * (dy + 0.12), s * rx, s * ry, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = `rgba(${light}, ${light}, ${Math.min(255, light + 6)}, ${alpha * shade})`;
  ctx.beginPath();
  for (const [dx, dy, rx, ry] of lobes) {
    ctx.ellipse(x + s * dx, y + s * dy, s * rx * 0.96, s * ry * 0.92, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawCloudSky(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, clouds: Cloud[], stormy: boolean) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (stormy) {
    sky.addColorStop(0, "rgba(51, 65, 85, 0.55)");
    sky.addColorStop(0.45, "rgba(30, 41, 59, 0.28)");
    sky.addColorStop(1, "rgba(15, 23, 42, 0.5)");
  } else {
    sky.addColorStop(0, "rgba(125, 211, 252, 0.5)");
    sky.addColorStop(0.42, "rgba(186, 230, 253, 0.22)");
    sky.addColorStop(1, "rgba(148, 163, 184, 0.2)");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (!stormy) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, w * 0.78, h * 0.18, w * 0.26, "rgba(253, 224, 71, 0.28)", "rgba(254, 249, 195, 0.9)");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.18, Math.max(7, w * 0.016), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const cloud of clouds) {
    const x = ((cloud.x + t * cloud.speed) % (w + cloud.s * 3)) - cloud.s * 1.4;
    puff(ctx, x, cloud.y, cloud.s, cloud.shade, stormy);
  }
}

function drawSnowfall(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, flakes: Flake[]) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(100, 116, 139, 0.42)");
  sky.addColorStop(0.45, "rgba(148, 163, 184, 0.18)");
  sky.addColorStop(1, "rgba(226, 232, 240, 0.16)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(226, 232, 240, 0.12)";
  ctx.beginPath();
  ctx.ellipse(w * 0.28 + Math.sin(t * 0.12) * 24, h * 0.28, w * 0.32, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72 + Math.cos(t * 0.1) * 18, h * 0.22, w * 0.28, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const gust = 0.18 + Math.sin(t * 0.2) * 0.32;
  for (const f of flakes) {
    f.x += f.vx + gust + Math.sin(t * 1.3 + f.spin) * 0.22;
    f.y += f.vy;
    f.spin += 0.012 + f.layer * 0.008;
    if (f.y > h + 8) {
      f.y = -10;
      f.x = Math.random() * (w + 30) - 15;
    }
    if (f.x > w + 16) f.x = -10;
    if (f.x < -16) f.x = w + 8;
    if (f.layer === 2) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.spin);
      ctx.strokeStyle = `rgba(255,255,255,${f.a})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * f.r * 2.1, Math.sin(a) * f.r * 2.1);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(255,255,255,${f.a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const ground = ctx.createLinearGradient(0, h * 0.72, 0, h);
  ground.addColorStop(0, "rgba(241, 245, 249, 0)");
  ground.addColorStop(1, "rgba(248, 250, 252, 0.28)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);
}

function drawAuroraSky(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(2, 6, 23, 0.72)");
  sky.addColorStop(0.55, "rgba(15, 23, 42, 0.28)");
  sky.addColorStop(1, "rgba(6, 24, 32, 0.4)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 28; i++) {
    const x = ((i * 97) % 1000) / 1000 * w;
    const y = ((i * 53) % 700) / 700 * h * 0.62;
    ctx.globalAlpha = 0.25 + ((i * 13) % 7) / 14;
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 1.4 : 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = "lighter";
  const bands = [
    { inner: "rgba(52, 211, 153, 0.28)", y: h * 0.18, amp: h * 0.08, phase: 0, width: w * 0.22 },
    { inner: "rgba(45, 212, 191, 0.2)", y: h * 0.28, amp: h * 0.1, phase: 1.2, width: w * 0.18 },
    { inner: "rgba(167, 139, 250, 0.18)", y: h * 0.22, amp: h * 0.07, phase: 2.1, width: w * 0.16 },
    { inner: "rgba(125, 211, 252, 0.14)", y: h * 0.34, amp: h * 0.06, phase: 0.6, width: w * 0.14 },
  ];
  for (const [i, band] of bands.entries()) {
    const drift = Math.sin(t * 0.12 + band.phase) * w * 0.08;
    for (let k = 0; k < 7; k++) {
      const x = w * (0.08 + k * 0.14) + drift + Math.sin(t * 0.18 + i + k) * 18;
      const y = band.y + Math.sin(t * 0.22 + k * 0.7 + band.phase) * band.amp;
      const g = ctx.createRadialGradient(x, y, 0, x, y + h * 0.42, band.width);
      g.addColorStop(0, band.inner);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.18, band.width * 0.55, h * 0.42, Math.sin(t * 0.08 + k) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPasture(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(125, 211, 252, 0.58)");
  sky.addColorStop(0.38, "rgba(186, 230, 253, 0.2)");
  sky.addColorStop(1, "rgba(21, 128, 61, 0.16)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.8, h * 0.16, w * 0.3, "rgba(253, 224, 71, 0.26)", "rgba(254, 249, 195, 0.88)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.16, Math.max(8, w * 0.018), 0, Math.PI * 2);
  ctx.fill();

  hill(ctx, w, h, h * 0.46, h * 0.028, 260, t, 0.04, "rgba(134, 239, 172, 0.22)");
  hill(ctx, w, h, h * 0.56, h * 0.04, 190, t, 0.07, "rgba(74, 222, 128, 0.34)");
  hill(ctx, w, h, h * 0.68, h * 0.032, 140, t, 0.11, "rgba(34, 197, 94, 0.48)");
  hill(ctx, w, h, h * 0.8, h * 0.018, 90, t, 0.16, "rgba(21, 128, 61, 0.58)");

  canopyTree(ctx, w * 0.12, h * 0.58, 54, "rgba(22, 101, 52, 0.72)");
  canopyTree(ctx, w * 0.2, h * 0.6, 38, "rgba(21, 128, 61, 0.58)");
  canopyTree(ctx, w * 0.86, h * 0.62, 46, "rgba(22, 101, 52, 0.5)");
  canopyTree(ctx, w * 0.78, h * 0.58, 28, "rgba(20, 83, 45, 0.4)");

  sheep(ctx, w * 0.42, h * 0.7, 11, t, 0);
  sheep(ctx, w * 0.5, h * 0.73, 9, t, 1);
  sheep(ctx, w * 0.58, h * 0.69, 10, t, 2);
  sheep(ctx, w * 0.34, h * 0.76, 8, t, 3);

  ctx.strokeStyle = "rgba(190, 242, 100, 0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const y = h * 0.78 + i * (h * 0.01);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const rise = Math.sin(x / 28 + t * 1.35 + i * 0.4) * 2.8;
      if (x === 0) ctx.moveTo(x, y + rise);
      else ctx.lineTo(x, y + rise);
    }
    ctx.stroke();
  }
}

function hayBale(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + ry * 0.55, rx * 1.05, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createLinearGradient(x - rx, y, x + rx, y);
  body.addColorStop(0, "rgba(146, 64, 14, 0.9)");
  body.addColorStop(0.4, "rgba(217, 119, 6, 0.95)");
  body.addColorStop(1, "rgba(120, 53, 15, 0.92)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(253, 224, 71, 0.4)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.7, ry * 0.52, -0.16, 0, Math.PI * 2);
  ctx.stroke();
}

function barn(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "rgba(69, 26, 3, 0.72)";
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y - s * 0.45);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x - s * 0.7, y);
  ctx.lineTo(x - s * 0.7, y - s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(120, 53, 15, 0.8)";
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.72, y - s * 0.42);
  ctx.lineTo(x - s * 0.72, y - s * 0.42);
  ctx.closePath();
  ctx.fill();
}

function drawHarvest(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(253, 186, 116, 0.58)");
  sky.addColorStop(0.36, "rgba(251, 146, 60, 0.26)");
  sky.addColorStop(1, "rgba(120, 53, 15, 0.4)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.16, h * 0.3, w * 0.36, "rgba(251, 146, 60, 0.32)", "rgba(254, 243, 199, 0.88)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(254, 215, 170, 0.95)";
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.3, Math.max(9, w * 0.02), 0, Math.PI * 2);
  ctx.fill();

  hill(ctx, w, h, h * 0.5, h * 0.024, 280, t, 0.04, "rgba(217, 119, 6, 0.32)");
  hill(ctx, w, h, h * 0.62, h * 0.036, 180, t, 0.07, "rgba(180, 83, 9, 0.48)");
  hill(ctx, w, h, h * 0.76, h * 0.02, 110, t, 0.12, "rgba(146, 64, 14, 0.62)");

  barn(ctx, w * 0.14, h * 0.58, 42);
  canopyTree(ctx, w * 0.26, h * 0.58, 26, "rgba(69, 26, 3, 0.45)", "rgba(69, 26, 3, 0.6)");

  ctx.strokeStyle = "rgba(253, 224, 71, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x0 = (i / 40) * w;
    ctx.beginPath();
    for (let y = h * 0.62; y < h; y += 6) {
      const bend = Math.sin(y / 18 + t * 1.1 + i * 0.35) * 3.4;
      if (y === h * 0.62) ctx.moveTo(x0 + bend, y);
      else ctx.lineTo(x0 + bend, y);
    }
    ctx.stroke();
  }

  hayBale(ctx, w * 0.38, h * 0.78, 30, 17);
  hayBale(ctx, w * 0.52, h * 0.74, 22, 13);
  hayBale(ctx, w * 0.78, h * 0.8, 34, 18);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const x = w * (0.1 + (i / 14) * 0.5) + Math.sin(t * 0.28 + i) * 10;
    const y = h * 0.36 + Math.sin(t * 0.38 + i * 0.7) * 12;
    glow(ctx, x, y, 6, "rgba(253, 224, 71, 0.08)", "rgba(254, 243, 199, 0.32)");
  }
  ctx.globalCompositeOperation = "source-over";
}

function yacht(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.85) * 4);
  ctx.rotate(Math.sin(t * 0.65) * 0.045);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(8, 47, 73, 0.28)";
  ctx.beginPath();
  ctx.ellipse(4, 22, 30, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
  ctx.beginPath();
  ctx.moveTo(-32, 10);
  ctx.quadraticCurveTo(4, 6, 40, 10);
  ctx.lineTo(28, 20);
  ctx.lineTo(-20, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(14, 116, 144, 0.55)";
  ctx.fillRect(-18, 16, 40, 3);
  ctx.fillStyle = "rgba(226, 232, 240, 0.95)";
  ctx.fillRect(-2, -40, 2.4, 50);
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.quadraticCurveTo(-18, -8, -26, 8);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -30);
  ctx.quadraticCurveTo(18, -4, 22, 8);
  ctx.lineTo(2, 8);
  ctx.closePath();
  ctx.fillStyle = "rgba(186, 230, 253, 0.78)";
  ctx.fill();
  ctx.restore();
}

function gull(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, i: number) {
  const flap = Math.sin(t * 3.4 + i) * s * 0.35;
  ctx.strokeStyle = "rgba(248, 250, 252, 0.72)";
  ctx.lineWidth = 1.35;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.45 + flap, x - s, y + flap * 0.2);
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.45 + flap, x + s, y + flap * 0.2);
  ctx.stroke();
}

function sea(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  waves: { y: number; amp: number; len: number; speed: number; color: string; foam: string }[],
) {
  for (const wave of waves) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) {
      const y = wave.y
        + Math.sin(x / wave.len + t * wave.speed) * wave.amp
        + Math.sin(x / (wave.len * 0.4) + t * wave.speed * 1.4) * wave.amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = wave.color;
    ctx.fill();
    ctx.strokeStyle = wave.foam;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const y = wave.y
        + Math.sin(x / wave.len + t * wave.speed) * wave.amp
        + Math.sin(x / (wave.len * 0.4) + t * wave.speed * 1.4) * wave.amp * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawSailing(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(125, 211, 252, 0.48)");
  sky.addColorStop(0.3, "rgba(56, 189, 248, 0.16)");
  sky.addColorStop(0.52, "rgba(14, 116, 144, 0.28)");
  sky.addColorStop(1, "rgba(8, 47, 73, 0.64)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.82, h * 0.16, w * 0.24, "rgba(253, 224, 71, 0.22)", "rgba(254, 249, 195, 0.82)");
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w * 0.18, h * 0.42);
  ctx.lineTo(w * 0.28, h * 0.5);
  ctx.lineTo(0, h * 0.54);
  ctx.closePath();
  ctx.fill();

  sea(ctx, t, w, h, [
    { y: h * 0.52, amp: h * 0.028, len: 190, speed: 0.26, color: "rgba(14, 116, 144, 0.32)", foam: "rgba(224, 242, 254, 0.2)" },
    { y: h * 0.64, amp: h * 0.042, len: 240, speed: 0.16, color: "rgba(7, 89, 133, 0.46)", foam: "rgba(186, 230, 253, 0.18)" },
    { y: h * 0.78, amp: h * 0.026, len: 120, speed: 0.32, color: "rgba(12, 74, 110, 0.58)", foam: "rgba(255, 255, 255, 0.16)" },
  ]);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 16; i++) {
    const x = w * 0.82 + Math.sin(t * 0.4 + i) * w * 0.1 + (i - 8) * 4;
    const y = h * 0.58 + i * 6 + Math.sin(t * 0.6 + i) * 3;
    glow(ctx, x, y, 5, "rgba(255, 236, 180, 0.08)", "rgba(255, 255, 230, 0.35)");
  }
  ctx.globalCompositeOperation = "source-over";

  yacht(ctx, w * 0.46, h * 0.54, Math.max(0.95, w / 860), t);
  yacht(ctx, w * 0.72, h * 0.6, Math.max(0.48, w / 1500), t + 1.7);
  gull(ctx, w * 0.3, h * 0.28, 10, t, 0);
  gull(ctx, w * 0.38, h * 0.22, 8, t, 1);
  gull(ctx, w * 0.62, h * 0.26, 7, t, 2);
}

function lighthouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const sweep = (t * 0.18) % (Math.PI * 2);
  ctx.save();
  ctx.translate(x, y - s * 0.82);
  ctx.rotate(sweep);
  const beam = ctx.createLinearGradient(0, 0, s * 4.5, 0);
  beam.addColorStop(0, "rgba(254, 240, 138, 0.45)");
  beam.addColorStop(1, "rgba(254, 240, 138, 0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 4.6, -s * 0.55);
  ctx.lineTo(s * 4.6, s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y);
  ctx.lineTo(x + s * 0.22, y);
  ctx.lineTo(x + s * 0.14, y - s);
  ctx.lineTo(x - s * 0.14, y - s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(185, 28, 28, 0.88)";
  ctx.fillRect(x - s * 0.2, y - s * 0.55, s * 0.4, s * 0.12);
  ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
  ctx.fillRect(x - s * 0.1, y - s * 1.08, s * 0.2, s * 0.12);
  ctx.fillStyle = "rgba(185, 28, 28, 0.9)";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, y - s);
  ctx.lineTo(x + s * 0.16, y - s);
  ctx.lineTo(x, y - s * 1.18);
  ctx.closePath();
  ctx.fill();
}

function drawHarbour(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(255, 168, 110, 0.5)");
  sky.addColorStop(0.28, "rgba(255, 140, 150, 0.22)");
  sky.addColorStop(0.5, "rgba(90, 130, 190, 0.18)");
  sky.addColorStop(1, "rgba(4, 42, 72, 0.58)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.72;
  const sunY = h * 0.24;
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, sunX, sunY, 62, "rgba(255, 150, 70, 0.32)", "rgba(255, 236, 190, 0.95)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255, 244, 210, 0.95)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.52);
  ctx.lineTo(w * 0.72, h * 0.38);
  ctx.lineTo(w * 0.86, h * 0.44);
  ctx.lineTo(w, h * 0.4);
  ctx.lineTo(w, h * 0.56);
  ctx.lineTo(w * 0.55, h * 0.56);
  ctx.closePath();
  ctx.fill();

  sea(ctx, t, w, h, [
    { y: h * 0.52, amp: h * 0.03, len: 160, speed: 0.2, color: "rgba(255, 150, 120, 0.14)", foam: "rgba(255, 220, 190, 0.18)" },
    { y: h * 0.62, amp: h * 0.048, len: 220, speed: 0.14, color: "rgba(20, 110, 160, 0.34)", foam: "rgba(180, 230, 255, 0.16)" },
    { y: h * 0.74, amp: h * 0.032, len: 110, speed: 0.28, color: "rgba(6, 70, 110, 0.46)", foam: "rgba(255, 255, 255, 0.14)" },
    { y: h * 0.86, amp: h * 0.018, len: 80, speed: 0.4, color: "rgba(255, 255, 255, 0.08)", foam: "rgba(255, 255, 255, 0.2)" },
  ]);

  lighthouse(ctx, w * 0.84, h * 0.5, Math.max(36, h * 0.12), t);

  ctx.fillStyle = "rgba(41, 37, 36, 0.72)";
  ctx.fillRect(0, h * 0.7, w * 0.28, h * 0.06);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(w * (0.03 + i * 0.05), h * 0.7, 3, h * 0.12);
  }

  yacht(ctx, w * 0.36, h * 0.58, Math.max(0.7, w / 1100), t + 0.4);
}
