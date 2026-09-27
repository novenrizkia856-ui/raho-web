/**
 * Section artwork: each <canvas data-art> runs one looping shader from
 * shaders.ts in the slot where the reference plays a video. Only canvases on
 * screen draw, at the video's 30 fps. Reduced motion holds one still frame.
 * Without WebGL the canvas keeps a flat red glow from raho.css.
 */
import { $$, reducedMotion } from "../shared/dom.ts";
import { SHADERS, type ArtName } from "./shaders.ts";

const VERTEX = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}";
const FRAME_MS = 1000 / 30;

type Art = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  res: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  loop: number;
  offset: number;
  visible: boolean;
};

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("Raho art:", gl.getShaderInfoLog(shader));
  return null;
}

function create(canvas: HTMLCanvasElement, name: ArtName): Art | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, SHADERS[name].source);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  // One triangle that covers the whole canvas.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  return {
    canvas,
    gl,
    res: gl.getUniformLocation(program, "u_res"),
    time: gl.getUniformLocation(program, "u_time"),
    loop: SHADERS[name].loop,
    offset: Number(canvas.dataset.artOffset ?? 0),
    visible: false,
  };
}

function draw(art: Art, seconds: number): void {
  const { canvas, gl } = art;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  gl.uniform2f(art.res, w, h);
  gl.uniform1f(art.time, (((seconds + art.offset) % art.loop) + art.loop) % art.loop);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function initArt(): void {
  const still = reducedMotion();
  const arts: Art[] = [];
  for (const canvas of $$<HTMLCanvasElement>("canvas[data-art]")) {
    const name = canvas.dataset.art as ArtName;
    const art = name in SHADERS ? create(canvas, name) : null;
    if (art) arts.push(art);
    else canvas.classList.add("raho-art--flat");
  }
  if (!arts.length) return;

  if (still) {
    const paint = () => arts.forEach((art) => draw(art, SHADERS[art.canvas.dataset.art as ArtName].still - art.offset));
    paint();
    addEventListener("resize", paint);
    return;
  }

  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    frame = 0;
    if (now - last >= FRAME_MS - 2) {
      last = now;
      for (const art of arts) if (art.visible) draw(art, now / 1000);
    }
    run();
  };
  const run = () => {
    if (!frame && !document.hidden && arts.some((art) => art.visible)) frame = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const art = arts.find((a) => a.canvas === entry.target);
        if (art) art.visible = entry.isIntersecting;
      }
      run();
    },
    { rootMargin: "120px 0px" },
  );
  arts.forEach((art) => io.observe(art.canvas));
  document.addEventListener("visibilitychange", run);
}
