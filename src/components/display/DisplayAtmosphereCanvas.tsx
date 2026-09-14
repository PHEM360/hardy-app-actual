import { useEffect, useRef } from "react";

export type AtmosphereScene = "plasma" | "orion" | "biolume" | "startrails" | "lava" | "ionstorm";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  hue: number;
  a: number;
  layer: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  inner = "rgba(255,255,255,0.9)",
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.22, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Full-bleed animated atmospheres for the wall display. Drawn onto a canvas
 * that sizes from its wrapping div (TVs often report 0×0 on the canvas itself
 * until later), with an opaque base fill so the scene still reads when a
 * calendar or clock sits on top as glass.
 */
export function DisplayAtmosphereCanvas({ scene }: { scene: AtmosphereScene }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const particles: Particle[] = [];
    const bolts: { life: number; points: { x: number; y: number }[] }[] = [];

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

    const count = (n: number) => Math.round(n * Math.max(0.7, w / 420));

    const seed = () => {
      particles.length = 0;
      bolts.length = 0;
      const n =
        scene === "startrails" ? count(70)
          : scene === "biolume" ? count(90)
            : scene === "lava" ? 7
              : scene === "orion" ? count(80)
                : count(40);
      for (let i = 0; i < n; i++) {
        particles.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.2, 0.2),
          vy: scene === "biolume" ? rand(-0.45, -0.08) : rand(-0.12, 0.12),
          r: scene === "lava" ? rand(w * 0.12, w * 0.28) : rand(0.6, 2.2),
          life: rand(0, Math.PI * 2),
          hue: scene === "biolume" ? rand(160, 195) : scene === "lava" ? rand(8, 38) : rand(200, 320),
          a: rand(0.35, 1),
          layer: i % 4,
        });
      }
    };

    const draw = (time: number) => {
      const t = time / 1000;
      if (scene === "plasma") drawPlasma(ctx, t, w, h);
      else if (scene === "orion") drawOrion(ctx, t, w, h, particles);
      else if (scene === "biolume") drawBiolume(ctx, t, w, h, particles);
      else if (scene === "startrails") drawStartrails(ctx, t, w, h, particles);
      else if (scene === "lava") drawLava(ctx, t, w, h, particles);
      else drawIons(ctx, t, w, h, particles, bolts);
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
  }, [scene]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

function drawPlasma(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  ctx.fillStyle = "#070014";
  ctx.fillRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, w, h);
  sky.addColorStop(0, "rgba(90,0,80,0.55)");
  sky.addColorStop(0.45, "rgba(20,0,50,0.2)");
  sky.addColorStop(1, "rgba(0,40,90,0.5)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const hue = 280 + i * 18 + Math.sin(t * 0.2 + i) * 12;
    ctx.strokeStyle = `hsla(${hue},100%,68%,0.28)`;
    ctx.lineWidth = 18 - i * 2;
    ctx.lineCap = "round";
    for (let x = 0; x <= w; x += 6) {
      const y =
        h * (0.28 + i * 0.1) +
        Math.sin(x / (90 + i * 20) + t * (0.35 + i * 0.08)) * h * 0.16 +
        Math.sin(x / 40 + t * 0.7 + i) * 18;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  glow(ctx, w * 0.55, h * 0.42, w * 0.28, "rgba(180,40,255,0.22)", "rgba(255,180,255,0.35)");
  glow(ctx, w * 0.3, h * 0.62, w * 0.2, "rgba(40,180,255,0.2)", "rgba(180,240,255,0.4)");
  ctx.globalCompositeOperation = "source-over";
}

function drawOrion(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, stars: Particle[]) {
  ctx.fillStyle = "#050014";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const clouds = [
    { x: w * 0.42 + Math.sin(t * 0.07) * 18, y: h * 0.46, r: w * 0.55, c: "rgba(255,70,140,0.38)" },
    { x: w * 0.62 + Math.cos(t * 0.05) * 14, y: h * 0.38, r: w * 0.42, c: "rgba(80,140,255,0.34)" },
    { x: w * 0.28, y: h * 0.58 + Math.sin(t * 0.06) * 10, r: w * 0.32, c: "rgba(90,255,220,0.16)" },
    { x: w * 0.78, y: h * 0.62, r: w * 0.26, c: "rgba(255,200,90,0.14)" },
  ];
  for (const cloud of clouds) {
    const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
    g.addColorStop(0, cloud.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.r, cloud.r * 0.62, t * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,0,18,0.55)";
  ctx.beginPath();
  ctx.moveTo(w * 0.36, 0);
  ctx.quadraticCurveTo(w * 0.48 + Math.sin(t * 0.05) * 8, h * 0.5, w * 0.3, h);
  ctx.lineTo(w * 0.52, h);
  ctx.quadraticCurveTo(w * 0.5, h * 0.48, w * 0.58, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.5, h * 0.48, 22, "rgba(255,240,210,0.55)", "rgba(255,255,255,0.95)");
  for (const s of stars) {
    const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + s.life));
    ctx.fillStyle = `hsla(${s.hue},90%,90%,${s.a * tw})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawBiolume(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, bits: Particle[]) {
  const sea = ctx.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, "#03101c");
  sea.addColorStop(0.45, "#06283a");
  sea.addColorStop(1, "#01080f");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.7, h * 0.15, w * 0.35, "rgba(20,80,120,0.25)", "rgba(40,120,160,0.08)");
  for (const p of bits) {
    p.y += p.vy;
    p.x += Math.sin(t * 0.6 + p.life) * 0.25;
    if (p.y < -8) {
      p.y = h + 8;
      p.x = rand(0, w);
    }
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + p.life));
    glow(
      ctx,
      p.x,
      p.y,
      5 + p.layer * 3,
      `hsla(${p.hue},100%,60%,${0.18 * pulse})`,
      `hsla(${p.hue + 20},100%,82%,${0.85 * pulse * p.a})`,
    );
    ctx.strokeStyle = `hsla(${p.hue},100%,70%,${0.18 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 12 + p.layer * 8);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawStartrails(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, stars: Particle[]) {
  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.52;
  const cy = h * 0.42;
  const sky = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.8);
  sky.addColorStop(0, "rgba(18,40,90,0.55)");
  sky.addColorStop(1, "rgba(4,6,16,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const s of stars) {
    const radius = 20 + s.layer * 28 + (s.x / Math.max(1, w)) * Math.max(w, h) * 0.42;
    const start = s.life + t * (0.04 + s.layer * 0.015);
    const sweep = 0.35 + s.a * 0.55;
    ctx.strokeStyle = `hsla(${210 + s.layer * 18},90%,88%,${0.22 + s.a * 0.35})`;
    ctx.lineWidth = 0.7 + s.layer * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + sweep);
    ctx.stroke();
  }
  glow(ctx, cx, cy, 16, "rgba(180,210,255,0.25)", "rgba(255,255,255,0.7)");
  ctx.globalCompositeOperation = "source-over";
}

function drawLava(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, blobs: Particle[]) {
  ctx.fillStyle = "#140404";
  ctx.fillRect(0, 0, w, h);
  const heat = ctx.createLinearGradient(0, h, 0, 0);
  heat.addColorStop(0, "rgba(120,10,0,0.7)");
  heat.addColorStop(0.4, "rgba(80,0,20,0.25)");
  heat.addColorStop(1, "rgba(10,0,8,0)");
  ctx.fillStyle = heat;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  for (const b of blobs) {
    b.x += Math.sin(t * 0.18 + b.life) * 0.35;
    b.y += Math.cos(t * 0.14 + b.life) * 0.22;
    const r = b.r * (0.86 + 0.14 * Math.sin(t * 0.4 + b.life));
    glow(
      ctx,
      b.x,
      b.y,
      r,
      `hsla(${b.hue},100%,48%,0.32)`,
      `hsla(${b.hue + 18},100%,72%,0.78)`,
    );
  }
  glow(ctx, w * 0.5, h * 1.05, w * 0.55, "rgba(255,80,10,0.28)", "rgba(255,160,40,0.12)");
  ctx.globalCompositeOperation = "source-over";
}

function drawIons(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  stars: Particle[],
  bolts: { life: number; points: { x: number; y: number }[] }[],
) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#120628");
  sky.addColorStop(0.5, "#1a0840");
  sky.addColorStop(1, "#070112");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const g = ctx.createLinearGradient(0, h * (0.15 + i * 0.18), w, h * (0.35 + i * 0.2));
    g.addColorStop(0, "rgba(80,0,160,0)");
    g.addColorStop(0.5, `rgba(${80 + i * 40},${40 + i * 30},255,0.18)`);
    g.addColorStop(1, "rgba(180,80,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w * (0.3 + i * 0.2), h * (0.32 + i * 0.12) + Math.sin(t * 0.2 + i) * 10, w * 0.42, h * 0.16, 0.2 * i, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of stars) {
    const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2.4 + s.life));
    ctx.fillStyle = `rgba(230,210,255,${s.a * tw})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (bolts.length < 2 && Math.random() < 0.012) {
    const startX = rand(w * 0.15, w * 0.85);
    const points = [{ x: startX, y: rand(0, h * 0.2) }];
    let x = startX;
    let y = points[0].y;
    while (y < h * 0.85) {
      x += rand(-28, 28);
      y += rand(18, 42);
      points.push({ x, y });
    }
    bolts.push({ life: 1, points });
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i];
    bolt.life -= 0.04;
    if (bolt.life <= 0) {
      bolts.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `rgba(220,190,255,${0.85 * bolt.life})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    bolt.points.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.strokeStyle = `rgba(180,120,255,${0.35 * bolt.life})`;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}
