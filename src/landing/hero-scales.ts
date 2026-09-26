/**
 * Hero backdrop: a sphere covered in overlapping red scales that spiral into
 * a vortex, drawn procedurally on a 2D canvas and turning slowly.
 *
 * Scales sit on a Fibonacci lattice around a pole that faces the viewer,
 * packed tighter and smaller towards the pole. Each scale is one prerendered
 * sprite drawn with an affine transform, so a frame is a few thousand
 * drawImage calls and no per scale gradients.
 */
import { reducedMotion } from "../shared/dom.ts";

type V3 = [number, number, number];

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SHADES = 7;

const add = (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** One scale: a rounded shell, near black at its root, deep red at its rim. */
function makeSprites(): HTMLCanvasElement[] {
  return Array.from({ length: SHADES }, (_, k) => {
    const light = 0.5 + (0.5 * k) / (SHADES - 1);
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    const g = c.getContext("2d")!;
    const tone = (r: number, a = 1) => `rgba(${Math.round(r * light)},0,0,${a})`;
    // Radial from the root, so the red reads as a crescent along the rim.
    const body = g.createRadialGradient(34, 80, 6, 34, 80, 226);
    body.addColorStop(0, tone(8));
    body.addColorStop(0.5, tone(20));
    body.addColorStop(0.66, tone(60));
    body.addColorStop(0.8, tone(135));
    body.addColorStop(0.92, tone(165));
    body.addColorStop(1, tone(118));
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(128, 80, 126, 78, 0, 0, Math.PI * 2);
    g.fill();
    // Soft shadow across the root so each scale reads as tucked under the next.
    const shade = g.createRadialGradient(40, 80, 10, 40, 80, 150);
    shade.addColorStop(0, "rgba(0,0,0,0.75)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = shade;
    g.fillRect(0, 0, 256, 160);
    return c;
  });
}

interface Scale {
  phi: number;
  theta: number;
  size: number;
}

function lattice(count: number): Scale[] {
  const out: Scale[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const phiU = Math.acos(1 - 2 * t);
    // Pull points towards the pole so the vortex is denser, and shrink them to match.
    const k = 1.45;
    const phi = Math.PI * Math.pow(phiU / Math.PI, k);
    if (phi > Math.PI * 0.62) break;
    const density = k * Math.pow(phiU / Math.PI, k - 1) * (Math.sin(phi) / Math.max(1e-3, Math.sin(phiU)));
    out.push({ phi, theta: i * GOLDEN, size: Math.sqrt(Math.max(0.02, density)) });
  }
  return out;
}

export function initHeroScales(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-scales]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const sprites = makeSprites();
  const small = matchMedia("(max-width: 767px)").matches;
  const count = small ? 1300 : 1900;
  const scales = lattice(count);
  const spacing = Math.sqrt((4 * Math.PI) / count);
  const still = reducedMotion();

  let w = 0;
  let h = 0;
  let dpr = 1;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const draw = (time: number) => {
    const R = Math.max(w * 0.555, h * 1.02);
    const cx = w * 0.4;
    const cy = h * 0.66;
    // The pole leans towards the viewer, slightly up and left, and drifts a little.
    const drift = time * 0.00004;
    const pole = norm([-0.12 + Math.sin(drift) * 0.03, -0.25 + Math.cos(drift * 0.7) * 0.02, 0.96]);
    const u = norm(cross(pole, [0, 1, 0]));
    const v = cross(pole, u);
    const spin = time * 0.00006;
    const light = norm([-0.35, -0.55, 0.75]);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer scales first, so each scale's rim lands on the root of the one beyond it.
    for (let i = scales.length - 1; i >= 0; i--) {
      const s = scales[i];
      const theta = s.theta + spin;
      const sp = Math.sin(s.phi);
      const cp = Math.cos(s.phi);
      const ring = add(scale(u, Math.cos(theta)), v, Math.sin(theta));
      const n = add(scale(pole, cp), ring, sp);
      if (n[2] < -0.02) continue;
      // Meridian direction away from the pole, twisted into a spiral.
      const meridian = add(scale(pole, -sp), ring, cp);
      const side = cross(n, meridian);
      const twist = 0.55 + 0.45 * (1 - s.phi / Math.PI);
      const tDir = add(scale(meridian, Math.cos(twist)), side, Math.sin(twist));
      const bDir = cross(n, tDir);

      // Scales nearer the bottom of the frame read as closer, so draw them larger.
      const near = 0.72 + 0.62 * Math.min(1, Math.max(0, (cy + n[1] * R) / h));
      const len = spacing * 1.1 * s.size * near;
      const wid = spacing * 0.78 * s.size * near;
      const centre = add(n, tDir, len * 0.55);
      const px = (cx + centre[0] * R) * dpr;
      const py = (cy + centre[1] * R) * dpr;
      if (px < -200 || py < -200 || px > canvas.width + 200 || py > canvas.height + 200) continue;

      const facing = Math.max(0, n[2]);
      const lit = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const shade = Math.min(SHADES - 1, Math.max(0, Math.round((0.25 + 0.5 * lit + 0.35 * facing) * (SHADES - 1))));

      const ax = tDir[0] * len * R * dpr;
      const ay = tDir[1] * len * R * dpr;
      const bx = bDir[0] * wid * R * dpr;
      const by = bDir[1] * wid * R * dpr;
      ctx.setTransform(ax / 128, ay / 128, bx / 80, by / 80, px, py);
      ctx.drawImage(sprites[shade], -128, -80);
    }
  };

  resize();
  addEventListener("resize", () => {
    resize();
    draw(performance.now());
  });

  if (still) {
    draw(0);
    return;
  }

  // Animate only while the hero is on screen and the tab is visible, at about 30 fps.
  let visible = true;
  let raf = 0;
  let last = 0;
  const loop = (t: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (t - last > 33) {
      last = t;
      draw(t);
    }
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(canvas);
  document.addEventListener("visibilitychange", start);
  draw(performance.now());
  start();
}
