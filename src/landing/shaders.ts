/**
 * Fragment shaders for the section artwork. Each one is a seamless loop drawn
 * in code, in the reference's language: pure red light on black, peaking near
 * rgb(148, 0, 0). u_time runs from 0 to the loop length and wraps.
 */
export type ArtName = "rings" | "bloom" | "hex";

const HEAD = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
const float PI = 3.14159265;
const float TAU = 6.28318531;
// Square frame from -1 to 1 on the longer side, like object-fit: cover.
vec2 frame() { return (gl_FragCoord.xy - 0.5 * u_res) / (0.5 * max(u_res.x, u_res.y)); }
vec4 red(float v) { v = clamp(v, 0.0, 1.0); return vec4(v * 0.58, v * 0.004, v * 0.03, 1.0); }
`;

/* Two half discs of concentric ridges, half a ridge apart. A light low on the
   horizon rises and sets over the loop: thin lines at the ends, full bands mid
   loop, and the ridges drift outward by one spacing each time round. */
const rings = `${HEAD}
const float LOOP = 16.0;
const float R = 0.76;
const float P = 0.155;

void main() {
  vec2 p = frame();
  float px = 2.0 / max(u_res.x, u_res.y);
  float r = length(p);
  float s = u_time / LOOP;
  float rise = sin(PI * s);
  float aa = 1.5 * px / P;

  float f = fract(r / P - s + (p.y < 0.0 ? 0.5 : 0.0));
  float w = mix(0.07, 0.97, pow(rise, 2.4));
  float next = smoothstep(1.0 - aa, 1.0, f);
  float lit = max(1.0 - smoothstep(w - aa, w, f), next);
  float shade = mix(1.0 - mix(0.72, 0.3, rise) * clamp(f / w, 0.0, 1.0), 1.0, next);

  float level = mix(0.22, 1.0, smoothstep(0.0, 0.3, rise));
  float sinA = abs(p.y) / max(r, 1e-4);
  float reach = clamp((clamp(rise * 3.2, 0.0, 1.4) - sinA) / 0.35, 0.0, 1.0);

  float quiet = pow(1.0 - rise, 3.0);
  float edge = max(1.0 - smoothstep(0.0, 2.0 * aa, f), next);
  float outline = 0.16 * quiet * edge;
  float spike = 0.85 * quiet * exp(-abs(p.y) / 0.028) * (1.0 - smoothstep(0.0, 0.22, f));

  float disc = 1.0 - smoothstep(R - px, R + px, r);
  gl_FragColor = red(disc * (lit * shade * level * reach + outline + spike));
}
`;

/* A disc cut into six wedges. Every wedge holds the same rose of glossy cup
   petals, turned a little differently, so each petal breaks at the cuts.
   Rings turn against each other and breathe. */
const bloom = `${HEAD}
const float LOOP = 16.0;
const float R = 0.84;

// Lay one ring of elliptical petals over v, each lit on its outer side.
void ring(inout float v, float r, float th, float c, float len, float wid, float rot, float px) {
  float sector = TAU / 6.0;
  float la = mod(th - rot + 0.5 * sector, sector) - 0.5 * sector;
  vec2 e = vec2(r * cos(la) - c, r * sin(la)) / vec2(len, wid);
  float alpha = 1.0 - smoothstep(1.0 - 1.5 * px / wid, 1.0, length(e));
  float shade = 0.1 + 0.9 * pow(clamp(0.5 + 0.5 * e.x, 0.0, 1.0), 1.8);
  v = mix(v, shade, alpha);
}

void main() {
  vec2 p = frame();
  float px = 2.0 / max(u_res.x, u_res.y);
  float r = length(p);
  float th = atan(p.y, p.x);
  float s = u_time / LOOP;

  // Six wedges split along 0, 60 and 120 degrees; each turns its own way.
  float k = floor((th + PI) / (PI / 3.0));
  float twist = (0.2 + 0.1 * sin(TAU * s + 0.8)) * (mod(k, 2.0) * 2.0 - 1.0);
  float spin = TAU / 6.0 * s;
  float breathe = sin(TAU * 2.0 * s + k * 1.3);

  float v = 0.15;
  ring(v, r, th, 0.66 + 0.02 * breathe, 0.21, 0.3, spin + twist, px);
  ring(v, r, th, 0.43 + 0.03 * breathe, 0.14, 0.155, 0.52 - spin - twist, px);
  ring(v, r, th, 0.24 + 0.02 * breathe, 0.095, 0.095, spin + 0.6 * twist, px);
  ring(v, r, th, 0.08, 0.06, 0.036, 0.26 - 2.0 * spin, px);

  float disc = 1.0 - smoothstep(R - px, R + px, r);
  gl_FragColor = red(disc * v);
}
`;

const hex = `${HEAD}
const float LOOP = 8.0;
const float H = 0.93;

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

// A soft pulse on the loop, centred on c.
float bump(float t, float c, float w) {
  float d = t - c;
  d -= LOOP * floor(d / LOOP + 0.5);
  return exp(-(d / w) * (d / w));
}

// Teardrop along +y: point of radius r1 at the origin, round end r2 at h.
float tear(vec2 p, float r1, float r2, float h) {
  p.x = abs(p.x);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(p, vec2(-b, a));
  if (k < 0.0) return length(p) - r1;
  if (k > a * h) return length(p - vec2(0.0, h)) - r2;
  return dot(p, vec2(a, b)) - r1;
}

float petals(float r, float th, float n, float rot, float r0, float r1, float r2, float h) {
  float sector = TAU / n;
  float la = mod(th - rot + 0.5 * sector, sector) - 0.5 * sector;
  return tear(vec2(r * sin(la), r * cos(la) - r0), r1, r2, h);
}

void main() {
  vec2 p = frame();
  float t = u_time;
  float a = TAU * t / LOOP;

  // Where this pixel lands on the tilted plate. Nearly face on at the start.
  float phase = a - 0.39;
  mat3 M = rotY(0.3 * sin(2.0 * phase)) * rotX(0.38 * sin(phase)) * rotZ(0.3 * sin(phase));
  vec3 n = M * vec3(0.0, 0.0, 1.0);
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = vec3(p / 3.2, -1.0);
  vec3 hit = ro + rd * (-dot(ro, n) / dot(rd, n));
  vec2 q = vec2(dot(hit, M * vec3(1.0, 0.0, 0.0)), dot(hit, M * vec3(0.0, 1.0, 0.0)));
  float px = 2.0 / max(u_res.x, u_res.y) / max(abs(n.z), 0.4);

  vec2 aq = abs(q);
  float edge = max(aq.x * 0.866025 + aq.y * 0.5, aq.y);
  float plate = 1.0 - smoothstep(H * 0.866025 - px, H * 0.866025 + px, edge);

  float r = length(q);
  float th = atan(q.y, q.x);

  // Twelve pleats, each shaded across like folded paper.
  float ls = 0.1 + 0.9 * bump(t, 3.3, 1.5);
  float pleat = pow(fract(th / (TAU / 12.0)), mix(5.0, 0.6, ls));
  float vs = 0.07 + ls * (0.35 + 0.65 * pleat) * (0.6 + 0.4 * smoothstep(0.0, H, r));

  // Two rings of cup shaped petals over the pleats.
  float turn = 0.15 * sin(a + 0.4);
  float dOut = petals(r, th, 12.0, turn + PI / 12.0, 0.3, 0.03, 0.15, 0.33);
  float dIn = petals(r, th, 12.0, -turn, 0.06, 0.008, 0.045, 0.2);
  float d = min(dOut, dIn);
  float inside = 1.0 - smoothstep(-px, px, d);
  float lp = 0.06 + 0.94 * bump(t, 5.4, 1.3);
  // As the light leaves, only the outer rims of the petals keep a glint.
  float rimOut = (1.0 - smoothstep(0.0, 0.035, -dOut)) * smoothstep(0.55, 0.75, r);
  float rimIn = (1.0 - smoothstep(0.0, 0.02, -dIn)) * smoothstep(0.2, 0.29, r) * step(dIn, dOut);
  float vp = lp * (0.6 + 0.4 * smoothstep(0.0, 0.06, -d)) + 0.45 * bump(t, 7.4, 0.8) * max(rimOut, rimIn);

  gl_FragColor = red(plate * mix(vs, vp, inside));
}
`;

export const SHADERS: Record<ArtName, { source: string; loop: number; still: number }> = {
  rings: { source: rings, loop: 16, still: 8 },
  bloom: { source: bloom, loop: 16, still: 0 },
  hex: { source: hex, loop: 8, still: 5.4 },
};
