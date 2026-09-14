import { useEffect, useRef } from "react";
import type { ChromeSceneId } from "@/lib/chromeScenes";

export const CANVAS_SCENES = new Set<ChromeSceneId>([
  "rainglass",
  "fireflies",
  "ocean",
  "bokeh",
  "embers",
  "fireworks",
  "glass",
  "meteor",
  "nebula",
  "blizzard",
]);

type Props = { scene: ChromeSceneId; compact?: boolean };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  hue: number;
  layer: number;
  a: number;
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
  inner = "rgba(255,255,255,0.95)",
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.35) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.restore();
}

export function ChromeCanvasScene({ scene, compact = false }: Props) {
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
    const particles: Particle[] = [];
    const extras: Particle[] = [];

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

    const count = (n: number) => Math.round(n * (compact ? 0.6 : 1) * Math.max(0.75, w / 380));

    const seed = () => {
      particles.length = 0;
      extras.length = 0;
      if (scene === "rainglass") {
        for (let i = 0; i < count(36); i++) {
          particles.push({
            x: rand(0, w), y: rand(0, h), vx: rand(-0.04, 0.05), vy: rand(-0.08, -0.02),
            r: rand(0.6, 1.8), life: rand(0, Math.PI * 2), max: 1, hue: 38, layer: i % 3, a: rand(0.25, 0.7),
          });
        }
      } else if (scene === "fireflies") {
        for (let i = 0; i < (compact ? 3 : 5); i++) {
          particles.push({
            x: (0.14 + i * 0.18) * w, y: h * (0.58 + (i % 2) * 0.12), vx: 0, vy: 0,
            r: rand(5, 8), life: rand(0, Math.PI * 2), max: 1, hue: 38, layer: i, a: 1,
          });
        }
      } else if (scene === "bokeh") {
        for (let i = 0; i < count(18); i++) {
          particles.push({
            x: rand(-30, w + 30), y: rand(-16, h + 16), vx: rand(-0.07, 0.07), vy: rand(-0.03, 0.03),
            r: rand(10, 46), life: rand(0, Math.PI * 2), max: rand(0.22, 0.5),
            hue: [28, 38, 210, 330, 160, 48][i % 6], layer: i % 3, a: rand(0.16, 0.42),
          });
        }
      } else if (scene === "embers") {
        for (let i = 0; i < count(56); i++) {
          particles.push({
            x: rand(0, w), y: rand(h * 0.35, h + 24), vx: rand(-0.08, 0.08), vy: rand(-0.55, -0.16),
            r: rand(0.55, 2.4), life: rand(0, 1), max: rand(80, 190), hue: rand(12, 44), layer: i % 3, a: 1,
          });
        }
      } else if (scene === "blizzard") {
        for (let i = 0; i < count(120); i++) {
          const layer = i % 3;
          particles.push({
            x: rand(-20, w + 20), y: rand(-h, h),
            vx: 0.12 + layer * 0.18, vy: 0.22 + layer * 0.35,
            r: 0.5 + layer * 1.55, life: rand(0, Math.PI * 2), max: 1, hue: 210, layer, a: 0.22 + layer * 0.32,
          });
        }
      } else if (scene === "meteor" || scene === "nebula") {
        for (let i = 0; i < count(scene === "nebula" ? 90 : 110); i++) {
          particles.push({
            x: rand(0, w), y: rand(0, h), vx: 0, vy: 0,
            r: rand(0.35, 1.9), life: rand(0, Math.PI * 2), max: rand(0.35, 1),
            hue: scene === "nebula" ? rand(200, 320) : 220, layer: i % 4, a: rand(0.28, 1),
          });
        }
      } else if (scene === "fireworks") {
        for (let i = 0; i < (compact ? 2 : 3); i++) {
          extras.push({
            x: w * (0.22 + i * 0.28), y: h + 10, vx: 0, vy: 0,
            r: 40, life: i * 1.4, max: 1, hue: [42, 200, 330][i % 3], layer: i, a: 1,
          });
        }
      }
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);

      if (scene === "rainglass") drawGoldenHour(ctx, t, w, h, particles);
      else if (scene === "fireflies") drawCandles(ctx, t, w, h, particles);
      else if (scene === "ocean") drawOcean(ctx, t, w, h);
      else if (scene === "bokeh") drawBokeh(ctx, t, w, h, particles);
      else if (scene === "embers") drawEmbers(ctx, t, w, h, particles);
      else if (scene === "fireworks") drawSpotlights(ctx, t, w, h, extras);
      else if (scene === "glass") drawInkWash(ctx, t, w, h);
      else if (scene === "meteor") drawMeteors(ctx, t, w, h, particles, extras, compact);
      else if (scene === "nebula") drawNebula(ctx, t, w, h, particles);
      else if (scene === "blizzard") drawBlizzard(ctx, t, w, h, particles);

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
  }, [scene, compact]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

function drawGoldenHour(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, dust: Particle[]) {
  const sky = ctx.createLinearGradient(0, 0, w * 0.2, h);
  sky.addColorStop(0, "rgba(255,176,92,0.42)");
  sky.addColorStop(0.45, "rgba(255,120,70,0.16)");
  sky.addColorStop(1, "rgba(40,18,28,0.22)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.08, h * 0.72, 90, "rgba(255,140,50,0.28)", "rgba(255,230,160,0.85)");
  for (let i = 0; i < 4; i++) {
    const x = w * (0.02 + i * 0.08) + Math.sin(t * 0.08 + i) * 6;
    const shaft = ctx.createLinearGradient(x, h, x + 70, 0);
    shaft.addColorStop(0, "rgba(255,200,110,0.22)");
    shaft.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + 18, h);
    ctx.lineTo(x + 92, 0);
    ctx.lineTo(x + 48, 0);
    ctx.closePath();
    ctx.fill();
  }
  for (const p of dust) {
    p.x += p.vx + Math.sin(t * 0.25 + p.life) * 0.04;
    p.y += p.vy;
    if (p.y < -4) {
      p.y = h + 4;
      p.x = rand(0, w);
    }
    glow(ctx, p.x, p.y, 3.5, `rgba(255,220,150,${0.12 * p.a})`, `rgba(255,245,210,${0.55 * p.a})`);
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawCandles(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, candles: Particle[]) {
  const room = ctx.createLinearGradient(0, 0, 0, h);
  room.addColorStop(0, "rgba(8,6,16,0.4)");
  room.addColorStop(1, "rgba(28,14,8,0.28)");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const c of candles) {
    const flicker = 0.78 + 0.22 * Math.sin(t * 7 + c.life) * Math.sin(t * 11 + c.x);
    glow(ctx, c.x, c.y - 10, 36 * flicker, "rgba(255,120,30,0.18)", "rgba(255,200,90,0.35)");
    glow(ctx, c.x, c.y - 16, 10 * flicker, "rgba(255,180,60,0.55)", "rgba(255,250,210,0.95)");
    ctx.fillStyle = `rgba(255,236,180,${0.9 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 18, 2.2 * flicker, 6.5 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(245,236,220,0.78)";
  for (const c of candles) {
    ctx.fillRect(c.x - 3.5, c.y - 8, 7, 18);
  }
}

function drawOcean(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(255,168,110,0.42)");
  sky.addColorStop(0.28, "rgba(255,140,150,0.22)");
  sky.addColorStop(0.5, "rgba(90,130,190,0.16)");
  sky.addColorStop(1, "rgba(4,42,72,0.55)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.76;
  const sunY = h * 0.26;
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, sunX, sunY, 58, "rgba(255,150,70,0.32)", "rgba(255,236,190,0.95)");
  glow(ctx, sunX, sunY, 18, "rgba(255,220,160,0.55)", "rgba(255,255,240,1)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255,244,210,0.95)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 6.5, 0, Math.PI * 2);
  ctx.fill();

  const glitter = ctx.createLinearGradient(sunX, sunY, sunX, h);
  glitter.addColorStop(0, "rgba(255,230,170,0)");
  glitter.addColorStop(0.35, "rgba(255,220,160,0.18)");
  glitter.addColorStop(1, "rgba(255,200,140,0)");
  ctx.fillStyle = glitter;
  ctx.beginPath();
  ctx.moveTo(sunX - 6, sunY);
  ctx.lineTo(sunX + 6, sunY);
  ctx.lineTo(sunX + w * 0.16, h);
  ctx.lineTo(sunX - w * 0.16, h);
  ctx.closePath();
  ctx.fill();

  const waves = [
    { amp: h * 0.04, len: 150, speed: 0.22, y: h * 0.5, color: "rgba(255,150,120,0.14)", foam: "rgba(255,220,190,0.2)" },
    { amp: h * 0.055, len: 220, speed: 0.14, y: h * 0.6, color: "rgba(20,110,160,0.32)", foam: "rgba(180,230,255,0.16)" },
    { amp: h * 0.038, len: 110, speed: 0.3, y: h * 0.72, color: "rgba(6,70,110,0.4)", foam: "rgba(255,255,255,0.14)" },
    { amp: h * 0.02, len: 80, speed: 0.42, y: h * 0.84, color: "rgba(255,255,255,0.08)", foam: "rgba(255,255,255,0.22)" },
  ];
  for (const wave of waves) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) {
      const y =
        wave.y +
        Math.sin(x / wave.len + t * wave.speed) * wave.amp +
        Math.sin(x / (wave.len * 0.42) + t * wave.speed * 1.55) * wave.amp * 0.32;
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
      const y =
        wave.y +
        Math.sin(x / wave.len + t * wave.speed) * wave.amp +
        Math.sin(x / (wave.len * 0.42) + t * wave.speed * 1.55) * wave.amp * 0.32;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 18; i++) {
    const x = sunX + Math.sin(t * 0.35 + i * 1.7) * (w * 0.12) + (i - 9) * 3;
    const y = h * 0.64 + Math.sin(t * 0.5 + i) * 4 + i * 1.2;
    glow(ctx, x, y, 5, "rgba(255,230,160,0.1)", "rgba(255,255,230,0.45)");
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawBokeh(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, orbs: Particle[]) {
  const room = ctx.createLinearGradient(0, 0, w, h);
  room.addColorStop(0, "rgba(18,10,22,0.22)");
  room.addColorStop(1, "rgba(8,16,28,0.18)");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  for (const o of orbs) {
    o.x += o.vx + Math.sin(t * 0.28 + o.life) * 0.06;
    o.y += o.vy + Math.cos(t * 0.22 + o.life) * 0.03;
    if (o.x < -60) o.x = w + 50;
    if (o.x > w + 60) o.x = -50;
    if (o.y < -50) o.y = h + 40;
    if (o.y > h + 50) o.y = -40;
    const breathe = 0.84 + 0.16 * Math.sin(t * 0.7 + o.life);
    const r = o.r * breathe * (0.7 + o.layer * 0.18);
    const g = ctx.createRadialGradient(o.x - r * 0.18, o.y - r * 0.22, 0, o.x, o.y, r);
    g.addColorStop(0, `hsla(${o.hue},85%,78%,${o.a + 0.12})`);
    g.addColorStop(0.38, `hsla(${o.hue},75%,58%,${o.a * 0.42})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    if (o.layer === 2) hexPath(ctx, o.x, o.y, r);
    else {
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = `hsla(${o.hue + 40},90%,85%,${o.a * 0.35})`;
    ctx.beginPath();
    ctx.arc(o.x - r * 0.22, o.y - r * 0.28, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawEmbers(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, bits: Particle[]) {
  const heat = ctx.createLinearGradient(0, h, 0, 0);
  heat.addColorStop(0, "rgba(255,56,8,0.38)");
  heat.addColorStop(0.28, "rgba(255,90,16,0.16)");
  heat.addColorStop(0.62, "rgba(40,8,0,0.06)");
  heat.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = heat;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  glow(ctx, w * 0.5, h * 1.05, w * 0.55, "rgba(255,80,10,0.2)", "rgba(255,140,40,0.08)");
  for (const p of bits) {
    p.x += p.vx + Math.sin(t * 0.9 + p.life) * 0.08;
    p.y += p.vy;
    p.life += 0.45;
    if (p.y < -10 || p.life > p.max) {
      p.x = rand(0, w);
      p.y = h + rand(0, 18);
      p.life = 0;
      p.vy = rand(-0.55, -0.16);
      p.hue = rand(12, 44);
    }
    const fade = 1 - p.life / p.max;
    const flicker = 0.55 + 0.45 * Math.sin(t * 22 + p.x * 0.4);
    const hot = p.r < 1.1;
    glow(
      ctx,
      p.x,
      p.y,
      6 + p.r * 4,
      `hsla(${p.hue},100%,${hot ? 62 : 50}%,${0.2 * fade * flicker})`,
      `hsla(${p.hue + (hot ? 28 : 12)},100%,${hot ? 78 : 62}%,${0.9 * fade})`,
    );
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawSpotlights(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, lights: Particle[]) {
  ctx.fillStyle = "rgba(4,6,16,0.38)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  lights.forEach((light, i) => {
    const swing = Math.sin(t * 0.22 + i * 1.3) * 0.22;
    const x = light.x + swing * w * 0.12;
    const g = ctx.createLinearGradient(x, -10, x + swing * 40, h);
    g.addColorStop(0, `hsla(${light.hue},90%,75%,0.38)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 10, 0);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + w * 0.16, h);
    ctx.lineTo(x - w * 0.16, h);
    ctx.closePath();
    ctx.fill();
    glow(ctx, x, 8, 16, `hsla(${light.hue},90%,70%,0.25)`, "rgba(255,255,255,0.8)");
  });
  ctx.globalCompositeOperation = "source-over";
}

function drawInkWash(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  ctx.fillStyle = "rgba(244,240,232,0.12)";
  ctx.fillRect(0, 0, w, h);
  const blooms = [
    { x: w * 0.3, y: h * 0.45, r: w * 0.34, c: "rgba(20,24,36,0.28)" },
    { x: w * 0.72, y: h * 0.4, r: w * 0.3, c: "rgba(50,40,70,0.2)" },
    { x: w * 0.5, y: h * 0.7, r: w * 0.22, c: "rgba(90,30,40,0.12)" },
  ];
  for (const [i, bloom] of blooms.entries()) {
    const pulse = 0.86 + 0.14 * Math.sin(t * 0.18 + i);
    const g = ctx.createRadialGradient(bloom.x + Math.sin(t * 0.1 + i) * 10, bloom.y, 0, bloom.x, bloom.y, bloom.r * pulse);
    g.addColorStop(0, bloom.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bloom.x, bloom.y, bloom.r * pulse, bloom.r * 0.62 * pulse, t * 0.03 + i, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMeteors(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  stars: Particle[],
  meteors: Particle[],
  compact: boolean,
) {
  const night = ctx.createLinearGradient(0, 0, w, h);
  night.addColorStop(0, "rgba(4,8,28,0.42)");
  night.addColorStop(0.55, "rgba(18,12,42,0.22)");
  night.addColorStop(1, "rgba(28,16,48,0.16)");
  ctx.fillStyle = night;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  const band = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
  band.addColorStop(0, "rgba(80,100,180,0)");
  band.addColorStop(0.45, "rgba(120,140,220,0.1)");
  band.addColorStop(1, "rgba(80,60,140,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    const tw = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * 2.1 + s.life));
    ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (s.layer === 0 ? 0.55 : 1), 0, Math.PI * 2);
    ctx.fill();
    if (s.layer === 3 && tw > 0.75) sparkle(ctx, s.x, s.y, 3.2 + s.r, tw * 0.55);
  }

  if (meteors.length < (compact ? 1 : 3) && Math.random() < 0.025) {
    const fireball = Math.random() < 0.22;
    meteors.push({
      x: rand(-30, w * 0.65),
      y: rand(-10, h * 0.4),
      vx: rand(6.2, 9.4),
      vy: rand(2.1, 4.4),
      r: fireball ? rand(2.2, 3.2) : rand(1.1, 1.8),
      life: 1,
      max: rand(0.62, 1),
      hue: fireball ? 28 : 205,
      layer: fireball ? 1 : 0,
      a: 1,
    });
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx;
    m.y += m.vy;
    m.life -= 0.012;
    if (m.life <= 0 || m.x > w + 50 || m.y > h + 50) {
      meteors.splice(i, 1);
      continue;
    }
    const len = 10 + m.layer * 6;
    const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * len, m.y - m.vy * len);
    grad.addColorStop(0, `rgba(255,255,255,${0.98 * m.life})`);
    grad.addColorStop(0.18, `hsla(${m.hue},100%,78%,${0.7 * m.life})`);
    grad.addColorStop(1, "rgba(80,140,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.r + 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * len, m.y - m.vy * len);
    ctx.stroke();
    glow(ctx, m.x, m.y, 12 + m.layer * 8, `hsla(${m.hue},100%,70%,${0.28 * m.life})`, "rgba(255,255,255,0.95)");
  }
  ctx.globalCompositeOperation = "source-over";
  const earth = ctx.createLinearGradient(0, h * 0.72, 0, h);
  earth.addColorStop(0, "rgba(40,80,160,0)");
  earth.addColorStop(1, "rgba(40,90,180,0.16)");
  ctx.fillStyle = earth;
  ctx.fillRect(0, 0, w, h);
}

function drawNebula(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, stars: Particle[]) {
  ctx.fillStyle = "rgba(8,4,24,0.36)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const clouds = [
    { x: w * 0.3 + Math.sin(t * 0.11) * 22, y: h * 0.42, r: w * 0.48, c: "rgba(220,60,160,0.26)" },
    { x: w * 0.72 + Math.cos(t * 0.09) * 18, y: h * 0.38, r: w * 0.42, c: "rgba(70,110,255,0.24)" },
    { x: w * 0.52, y: h * 0.58 + Math.sin(t * 0.07) * 12, r: w * 0.32, c: "rgba(255,150,210,0.14)" },
    { x: w * 0.18 + Math.cos(t * 0.08) * 10, y: h * 0.62, r: w * 0.28, c: "rgba(90,210,255,0.1)" },
    { x: w * 0.84, y: h * 0.7, r: w * 0.22, c: "rgba(255,190,90,0.08)" },
  ];
  for (const cloud of clouds) {
    const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
    g.addColorStop(0, cloud.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.r, cloud.r * 0.62, t * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,2,16,0.18)";
  ctx.beginPath();
  ctx.ellipse(w * 0.46 + Math.sin(t * 0.06) * 10, h * 0.5, w * 0.18, h * 0.12, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "lighter";
  for (const s of stars) {
    const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.life));
    ctx.fillStyle = `hsla(${s.hue},80%,88%,${s.a * tw})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.layer === 3) glow(ctx, s.x, s.y, 6, `hsla(${s.hue},90%,70%,${0.12 * tw})`, `hsla(${s.hue},100%,90%,${0.4 * tw})`);
  }
  ctx.globalCompositeOperation = "source-over";
  vignette(ctx, w, h, 0.3);
}

function drawBlizzard(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, flakes: Particle[]) {
  const fog = ctx.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, "rgba(186,210,240,0.22)");
  fog.addColorStop(0.5, "rgba(220,232,248,0.08)");
  fog.addColorStop(1, "rgba(240,246,255,0.04)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);

  const gust = 0.12 + Math.sin(t * 0.22) * 0.35 + Math.sin(t * 0.08) * 0.16;
  ctx.fillStyle = "rgba(230,240,255,0.08)";
  ctx.beginPath();
  ctx.ellipse(w * 0.3 + Math.sin(t * 0.2) * 30, h * 0.4, w * 0.28, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const f of flakes) {
    f.x += f.vx + gust + Math.sin(t * 1.4 + f.life) * 0.25;
    f.y += f.vy + Math.abs(gust) * 0.15;
    if (f.y > h + 10) {
      f.y = -8;
      f.x = rand(-30, w + 10);
    }
    if (f.x > w + 16) f.x = -10;
    if (f.x < -16) f.x = w + 8;
    ctx.fillStyle = `rgba(255,255,255,${f.a})`;
    if (f.layer === 2) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(t * 0.8 + f.life);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * f.r * 1.8, Math.sin(a) * f.r * 1.8);
      }
      ctx.strokeStyle = `rgba(255,255,255,${f.a})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
