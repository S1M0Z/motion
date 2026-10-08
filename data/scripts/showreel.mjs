// Showreel motion design — chaque frame est une fonction pure de t.
// Rendu: sharp rasterise le SVG -> PNG, piping vers ffmpeg (libx264) -> MP4.
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 1920, H = 1080, FPS = 60, DUR = 15;
const CX = W / 2, CY = H / 2;
const CREAM = '#f0eee6', INK = '#171511', CLAY = '#cc785c', MUTE = '#a79f90';
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';

// ---------- helpers (purs) ----------
const f = x => Math.round(x * 1000) / 1000;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutExpo = u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
// réponse indicielle d'un ressort sous-amorti (léger overshoot), settle à 1
function spring(x, freq = 2.2, damping = 0.68) {
  if (x <= 0) return 0;
  const w = 2 * Math.PI * freq, z = damping;
  if (z >= 1) return 1 - Math.exp(-w * x) * (1 + w * x);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function mix(a, b, u) {
  const A = hx(a), B = hx(b);
  return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], clamp01(u))).toString(16).padStart(2, '0')).join('');
}
const seeded = i => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };
function polar(cx, cy, r, deg) { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a1), [x1, y1] = polar(cx, cy, r, a0);
  const large = (a1 - a0) % 360 <= 180 ? 0 : 1;
  return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} 0 ${f(x1)} ${f(y1)}`;
}
const circle = (x, y, r, fill, op = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(0, r))}" fill="${fill}" opacity="${f(op)}"/>`;
const txt = (x, y, s, size, fill, opts = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${f(size)}" font-weight="${opts.w || 800}" fill="${fill}" text-anchor="${opts.anchor || 'middle'}" letter-spacing="${opts.ls ?? -2}" opacity="${f(opts.op ?? 1)}" ${opts.extra || ''}>${s}</text>`;

// ---------- scènes ----------
const scenes = [
  { a: 0.0, b: 2.4, r: s1 },
  { a: 2.2, b: 5.1, r: s2 },
  { a: 4.9, b: 7.7, r: s3 },
  { a: 7.5, b: 10.3, r: s4 },
  { a: 10.1, b: 12.4, r: s5 },
  { a: 12.2, b: 14.6, r: s6 },
];

// S1 — point -> ligne -> grille
function s1(t) {
  let s = '';
  const dotR = 16 * spring(t, 2.4, 0.55);
  const lp = easeInOut(seg(t, 0.35, 1.05));
  const half = 540 * lp;
  s += `<rect x="${f(CX - half)}" y="${CY - 1.5}" width="${f(2 * half)}" height="3" fill="${INK}" opacity="${f(0.85 * lp)}"/>`;
  const gx = 9, gy = 5, sx = 150, sy = 150;
  for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) {
    const px = CX + (i - (gx - 1) / 2) * sx, py = CY + (j - (gy - 1) / 2) * sy;
    const d = Math.hypot(i - (gx - 1) / 2, j - (gy - 1) / 2);
    const ap = spring(t - 0.95 - d * 0.07, 2.6, 0.6);
    if (ap <= 0) continue;
    const near = d < 1.2;
    s += circle(px, py, 6 * ap, near ? CLAY : INK, 0.9 * clamp01(ap));
  }
  s += circle(CX, CY, dotR, CLAY);
  return s;
}

// S2 — kinetic typography : MOTION -> DESIGN
function s2(t) {
  const word = (str, size, revealAt, outAt) => {
    const w = size * 0.6 * str.length;
    const x0 = CX - w / 2;
    const ty = (1 - spring(t - revealAt, 2.2, 0.7)) * 70;
    const rp = easeOutExpo(seg(t, revealAt, revealAt + 0.55));
    const op = seg(t, outAt, outAt + 0.38);
    const outY = -90 * easeInOut(op), al = 1 - op;
    const id = 'clip' + revealAt.toString().replace('.', '');
    return `<clipPath id="${id}"><rect x="${f(x0 - 10)}" y="${CY - size}" width="${f((w + 20) * rp)}" height="${f(size * 1.6)}"/></clipPath>
<g clip-path="url(#${id})" transform="translate(0 ${f(ty + outY)})" opacity="${f(al)}">${txt(CX, CY + size * 0.33, str, size, INK, { ls: -6 })}</g>`;
  };
  let s = word('MOTION', 230, 2.35, 3.95);
  s += word('DESIGN', 230, 3.95, 5.5);
  // tiret accent qui pulse
  const pulse = 0.5 + 0.5 * Math.sin((t - 2.3) * 6);
  s += `<rect x="${CX - 60}" y="${CY + 150}" width="120" height="6" fill="${CLAY}" opacity="${f(0.4 + 0.5 * pulse)}"/>`;
  return s;
}

// S3 — morph de forme + barres en vague
function s3(t) {
  const p = seg(t, 5.0, 7.5);
  const size = lerp(260, 300, 0.5 - 0.5 * Math.cos(p * Math.PI * 2));
  const rx = 18 + 132 * Math.sin(clamp01(p) * Math.PI);
  const rot = 120 * easeInOut(p);
  const col = mix(CLAY, INK, 0.5 - 0.5 * Math.cos(p * Math.PI * 2));
  const appear = spring(t - 5.0, 2.4, 0.6);
  const sc = 0.4 + 0.6 * appear;
  const my = CY - 70;
  let s = `<g transform="translate(${CX} ${my}) rotate(${f(rot)}) scale(${f(sc)})"><rect x="${f(-size / 2)}" y="${f(-size / 2)}" width="${f(size)}" height="${f(size)}" rx="${f(rx)}" ry="${f(rx)}" fill="${col}"/></g>`;
  const n = 15, bw = 46, gap = 26, baseY = CY + 330;
  const totalW = n * bw + (n - 1) * gap, startX = CX - totalW / 2;
  for (let i = 0; i < n; i++) {
    const ba = spring(t - 5.1 - i * 0.03, 2.8, 0.6);
    if (ba <= 0) continue;
    const wave = Math.sin((t - 5.0) * 4 - i * 0.55);
    const hgt = (60 + 120 * (0.5 + 0.5 * wave)) * ba;
    const x = startX + i * (bw + gap);
    const mid = Math.abs(i - (n - 1) / 2) < 2;
    s += `<rect x="${f(x)}" y="${f(baseY - hgt)}" width="${bw}" height="${f(hgt)}" rx="8" fill="${mid ? CLAY : INK}" opacity="${f(0.9 * clamp01(ba))}"/>`;
  }
  return s;
}

// S4 — data-viz qui se dessine + compteur réel (60 fps / 900 frames)
function s4(t) {
  const x0 = 170, x1 = 1120, y0 = 800, y1 = 300;
  const vals = [0.18, 0.42, 0.33, 0.6, 0.52, 0.78, 0.68, 0.96];
  const n = vals.length;
  const px = i => x0 + (x1 - x0) * i / (n - 1);
  const py = v => lerp(y0, y1, v);
  const axp = easeOutCubic(seg(t, 7.7, 8.1));
  let s = `<rect x="${x0}" y="${f(y0)}" width="${f((x1 - x0) * axp)}" height="2.5" fill="${MUTE}"/>`;
  s += `<rect x="${x0}" y="${f(lerp(y0, y1, axp))}" width="2.5" height="${f((y0 - y1) * axp)}" fill="${MUTE}"/>`;
  const rp = easeInOut(seg(t, 8.0, 9.3));
  const clipW = (x1 - x0) * rp + 6;
  const pts = vals.map((v, i) => `${f(px(i))},${f(py(v))}`).join(' ');
  const area = `${x0},${y0} ${pts} ${f(px(n - 1))},${y0}`;
  s += `<clipPath id="rev"><rect x="${x0 - 3}" y="${y1 - 40}" width="${f(clipW)}" height="${f(y0 - y1 + 80)}"/></clipPath>`;
  s += `<g clip-path="url(#rev)">`;
  s += `<polygon points="${area}" fill="${CLAY}" opacity="0.14"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="${CLAY}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `</g>`;
  vals.forEach((v, i) => {
    const appear = clamp01((clipW - (px(i) - x0)) / 40);
    if (appear > 0) s += circle(px(i), py(v), 9 * spring(appear * 1.0, 3, 0.5), INK);
  });
  // compteur
  const cv = Math.round(60 * easeOutCubic(seg(t, 7.9, 9.5)));
  s += txt(1560, 560, String(cv), 300, CLAY, { ls: -10 });
  s += txt(1560, 650, 'FRAMES / SEC', 40, INK, { w: 700, ls: 8 });
  s += txt(1560, 300, '900 FRAMES · 15 S', 34, MUTE, { w: 700, ls: 6, op: easeOutCubic(seg(t, 8.6, 9.2)) });
  return s;
}

// S5 — arcs concentriques + anneau de progression
function s5(t) {
  const lt = t - 10.1;
  let s = '';
  const radii = [90, 150, 210, 270];
  radii.forEach((r, i) => {
    const dir = i % 2 ? -1 : 1;
    const spd = 40 + i * 18;
    const a0 = (lt * spd * dir) % 360;
    const span = 90 + i * 25;
    const ap = clamp01(spring(t - 10.1 - i * 0.08, 2.6, 0.6));
    s += `<path d="${arc(CX, CY, r, a0, a0 + span)}" fill="none" stroke="${i === 1 ? CLAY : INK}" stroke-width="${f(10 * ap)}" stroke-linecap="round" opacity="${f(0.85 * ap)}"/>`;
  });
  // ticks
  for (let k = 0; k < 48; k++) {
    const ang = k * 7.5;
    const [ix, iy] = polar(CX, CY, 320, ang), [ox, oy] = polar(CX, CY, 335, ang);
    const ap = clamp01(spring(t - 10.3 - (k / 48) * 0.5, 3, 0.6));
    if (ap > 0) s += `<line x1="${f(ix)}" y1="${f(iy)}" x2="${f(ox)}" y2="${f(oy)}" stroke="${MUTE}" stroke-width="2" opacity="${f(0.7 * ap)}"/>`;
  }
  // anneau de progression
  const prog = easeInOut(seg(t, 10.3, 12.1));
  const R = 355, C = 2 * Math.PI * R;
  s += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${INK}" stroke-width="4" opacity="0.1"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${CLAY}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${f(C)}" stroke-dashoffset="${f(C * (1 - prog))}" transform="rotate(-90 ${CX} ${CY})"/>`;
  const [hx2, hy2] = polar(CX, CY, R, prog * 360);
  s += circle(hx2, hy2, 11, CLAY);
  s += txt(CX, CY + 16, Math.round(prog * 100) + '%', 72, INK, { w: 800, ls: -2 });
  return s;
}

// S6 — payoff : le wordmark CLAUDE s'assemble
function s6(t) {
  const str = 'CLAUDE', size = 185, lw = size * 0.72;
  const total = str.length * lw, startX = CX - total / 2 + lw / 2;
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const d = 12.35 + i * 0.07;
    const sp = spring(t - d, 2.1, 0.62);
    const fx = startX + i * lw, fy = CY - 10;
    const dx = (seeded(i) - 0.5) * 900, dy = (seeded(i + 9) - 0.5) * 500;
    const x = lerp(fx + dx, fx, sp), y = lerp(fy + dy, fy, sp);
    const rot = lerp((seeded(i + 3) - 0.5) * 60, 0, sp);
    const op = clamp01(sp * 1.3);
    s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${txt(0, size * 0.34, str[i], size, INK, { ls: 0 })}</g>`;
  }
  const uw = easeOutExpo(seg(t, 13.4, 14.0));
  s += `<rect x="${f(CX - 230)}" y="${f(CY + 70)}" width="${f(460 * uw)}" height="7" fill="${CLAY}"/>`;
  s += txt(CX, CY + 150, 'MOTION DESIGNER', 40, MUTE, { w: 700, ls: 16, op: easeOutCubic(seg(t, 13.7, 14.3)) });
  return s;
}

// ---------- composition ----------
function env(t, a, b) {
  const u1 = clamp01((t - a) / 0.35), u2 = clamp01((b - t) / 0.3);
  const al = easeInOut(u1) * easeInOut(u2);
  const sc = (0.965 + 0.035 * easeOutCubic(u1)) * (1 + 0.05 * (1 - easeInOut(u2)));
  return { al, sc };
}
function draw(t) {
  let body = `<rect width="${W}" height="${H}" fill="${CREAM}"/>`;
  // léger grain de grille de fond, constant
  body += `<g opacity="0.04">`;
  for (let gx = 0; gx <= W; gx += 120) body += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${INK}" stroke-width="1"/>`;
  for (let gy = 0; gy <= H; gy += 120) body += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${INK}" stroke-width="1"/>`;
  body += `</g>`;
  for (const sc of scenes) {
    if (t < sc.a - 0.001 || t >= sc.b) continue;
    const e = env(t, sc.a, sc.b);
    if (e.al <= 0.001) continue;
    body += `<g opacity="${f(e.al)}" transform="translate(${CX} ${CY}) scale(${f(e.sc)}) translate(${-CX} ${-CY})">${sc.r(t)}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// ---------- rendu ----------
const OUT = '/Users/simon/Downloads/claude-showreel.mp4';
const STILLS = '/Users/simon/Downloads/frame-motion-studio/exemples/apercu';
mkdirSync(STILLS, { recursive: true });

async function renderStills() {
  for (const [name, t] of [['s-type', 3.0], ['s-morph', 6.2], ['s-chart', 9.0], ['s-word', 13.6]]) {
    await sharp(Buffer.from(draw(t))).png().toFile(`${STILLS}/reel-${name}.png`);
  }
  console.log('stills écrits dans', STILLS);
}

async function renderVideo() {
  const total = DUR * FPS;
  const ff = spawn(ffmpegPath, [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let n = 0; n < total; n++) {
    const png = await sharp(Buffer.from(draw(n / FPS))).png({ compressionLevel: 3 }).toBuffer();
    if (!ff.stdin.write(png)) await new Promise(res => ff.stdin.once('drain', res));
    if (n % 120 === 0) process.stdout.write(` ${Math.round(n / total * 100)}%`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  console.log('\nFINI -> ' + OUT);
}

await renderStills();
if (process.argv.includes('video')) await renderVideo();
