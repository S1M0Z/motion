// Présentation Shopify — vidéo seek(t) + voix (macOS say) + bed procédural + mux ffmpeg.
// Phases: `audio` (VO + bed + mix + timeline.json), `video` (frames + mux final + .srt).
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const W = 1920, H = 1080, FPS = 60, CX = W / 2, CY = H / 2;
const GROUND = '#f6f5f0', INK = '#1d1d1a', GREEN = '#5e8e3e', LIME = '#7cb342', MUTE = '#9a978c';
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const DIR = '/Users/simon/Downloads/frame-motion-studio/scripts/shopify';
const OUT = '/Users/simon/Downloads/shopify-presentation.mp4';
const SRT = '/Users/simon/Downloads/shopify-presentation.srt';
mkdirSync(DIR, { recursive: true });
const FF = ffmpegPath;

// narration (fr) + ancre à l'écran (2 lignes courtes)
const LINES = [
  { vo: "Vous avez un produit. Il vous manque juste une boutique.", h: ['Il vous manque', 'une boutique.'] },
  { vo: "Avec Shopify, créez votre boutique en ligne en quelques minutes, sans écrire une seule ligne de code.", h: ['Votre boutique,', 'sans une ligne de code.'] },
  { vo: "Présentez vos produits, encaissez les paiements, suivez vos commandes, au même endroit.", h: ['Tout au', 'même endroit.'] },
  { vo: "Des premières ventes jusqu'à des millions de commandes, Shopify grandit avec vous.", h: ['Shopify grandit', 'avec vous.'] },
  { vo: "Shopify. Lancez. Vendez. Grandissez.", h: ['Lancez. Vendez.', 'Grandissez.'] },
];

// ---------- helpers ----------
const f = x => Math.round(x * 1000) / 1000;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutExpo = u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
function spring(x, freq = 2.1, damping = 0.66) {
  if (x <= 0) return 0;
  const w = 2 * Math.PI * freq, z = damping;
  if (z >= 1) return 1 - Math.exp(-w * x) * (1 + w * x);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x, y, s, size, fill, o = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${f(size)}" font-weight="${o.w || 800}" fill="${fill}" text-anchor="${o.anchor || 'middle'}" letter-spacing="${o.ls ?? -2}" opacity="${f(o.op ?? 1)}">${esc(s)}</text>`;
const circle = (x, y, r, fill, op = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(0, r))}" fill="${fill}" opacity="${f(op)}"/>`;
const rrect = (x, y, w, h, r, fill, op = 1) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ry="${f(r)}" fill="${fill}" opacity="${f(op)}"/>`;

// sac Shopify stylisé (pas le logo exact)
function bag(cx, cy, s, fill) {
  const w = s, h = s * 1.1, x = cx - w / 2, y = cy - h / 2;
  return `<g>
    <path d="M ${f(x + w * 0.28)} ${f(y + h * 0.26)} a ${f(w * 0.22)} ${f(w * 0.22)} 0 0 1 ${f(w * 0.44)} 0" fill="none" stroke="${fill}" stroke-width="${f(s * 0.09)}"/>
    <rect x="${f(x)}" y="${f(y + h * 0.22)}" width="${f(w)}" height="${f(h * 0.78)}" rx="${f(s * 0.16)}" fill="${fill}"/>
    <text x="${f(cx)}" y="${f(cy + h * 0.2)}" font-family="${FONT}" font-size="${f(s * 0.52)}" font-weight="800" fill="${GROUND}" text-anchor="middle">S</text>
  </g>`;
}

// ---------- scènes ----------
function headline(lt, lines, y = CY + 60) {
  const sz = 92;
  let s = '';
  lines.forEach((ln, i) => {
    const sp = spring(lt - 0.15 - i * 0.08, 2.2, 0.7);
    const ty = (1 - sp) * 55, op = clamp01(sp * 1.2);
    s += `<g transform="translate(0 ${f(ty)})" opacity="${f(op)}">${txt(CX, y + i * sz * 1.05, ln, sz, i ? GREEN : INK, { ls: -4 })}</g>`;
  });
  return s;
}

function sc0(lt) { // hook : carton produit
  const sp = spring(lt, 2.0, 0.6), y = CY - 150;
  const sc = 0.6 + 0.4 * sp, rot = (1 - sp) * -12;
  let s = `<g transform="translate(${CX} ${f(y)}) rotate(${f(rot)}) scale(${f(sc)})" opacity="${f(clamp01(sp * 1.3))}">`;
  s += rrect(-90, -75, 180, 150, 14, INK);
  s += `<path d="M -90 -30 L 90 -30" stroke="${GROUND}" stroke-width="5"/>`;
  s += rrect(-26, -75, 52, 45, 6, GREEN);
  s += `</g>`;
  s += headline(lt, ['Il vous manque', 'une boutique.']);
  return s;
}

function sc1(lt) { // storefront se construit
  const bw = 1180, bh = 640, bx = CX - bw / 2, by = CY - bh / 2 - 40;
  const open = easeOutExpo(seg(lt, 0.0, 0.5));
  let s = `<g opacity="${f(open)}" transform="translate(${CX} ${f(by + bh / 2)}) scale(${f(0.9 + 0.1 * open)}) translate(${-CX} ${f(-(by + bh / 2))})">`;
  s += rrect(bx, by, bw, bh, 22, '#ffffff');
  s += rrect(bx, by, bw, 56, 22, '#ece9e0');
  s += rrect(bx, by + 34, bw, 22, 0, '#ece9e0');
  [0, 1, 2].forEach(i => s += circle(bx + 34 + i * 26, by + 28, 7, i === 0 ? GREEN : '#cfcabd'));
  s += rrect(bx + 120, by + 16, 420, 24, 12, '#f3f1ea');
  // header boutique
  s += rrect(bx + 40, by + 90, 180, 26, 6, INK);
  s += rrect(bx + bw - 150, by + 90, 110, 30, 15, GREEN);
  // grille produits (stagger)
  const cols = 3, cw = 320, ch = 210, gap = 40, gx = bx + 60, gy = by + 160;
  for (let i = 0; i < 3; i++) {
    const a = spring(lt - 0.4 - i * 0.12, 2.6, 0.6);
    if (a <= 0) continue;
    const x = gx + i * (cw + gap), yy = gy + (1 - a) * 40;
    s += `<g opacity="${f(clamp01(a))}">`;
    s += rrect(x, yy, cw, ch, 14, '#f3f1ea');
    s += rrect(x + 20, yy + 20, cw - 40, ch - 90, 10, i === 1 ? LIME : '#dcd8cc');
    s += rrect(x + 20, yy + ch - 54, 150, 16, 8, INK);
    s += rrect(x + 20, yy + ch - 30, 90, 14, 7, MUTE);
    s += `</g>`;
  }
  s += `</g>`;
  s += headline(lt, ['Votre boutique,', 'sans une ligne de code.'], CY + 360);
  return s;
}

function sc2(lt) { // 3 cartes features
  const items = [
    { t: 'Produits', icon: 'bag' }, { t: 'Paiements', icon: 'card' }, { t: 'Commandes', icon: 'box' },
  ];
  const cw = 400, ch = 300, gap = 60, total = 3 * cw + 2 * gap, x0 = CX - total / 2, y0 = CY - 190;
  let s = '';
  items.forEach((it, i) => {
    const a = spring(lt - 0.15 - i * 0.14, 2.3, 0.6);
    if (a <= 0) return;
    const x = x0 + i * (cw + gap), yy = y0 + (1 - a) * 60;
    s += `<g opacity="${f(clamp01(a))}">`;
    s += rrect(x, yy, cw, ch, 20, '#ffffff');
    const ix = x + cw / 2, iy = yy + 110;
    if (it.icon === 'bag') s += bag(ix, iy, 110, GREEN);
    else if (it.icon === 'card') { s += rrect(ix - 70, iy - 45, 140, 95, 12, GREEN); s += rrect(ix - 70, iy - 20, 140, 16, 0, INK); }
    else { s += rrect(ix - 60, iy - 50, 120, 100, 12, GREEN); s += `<path d="M ${f(ix - 26)} ${f(iy)} l 20 22 l 38 -44" stroke="${GROUND}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; }
    s += txt(ix, yy + ch - 50, it.t, 46, INK, { w: 800, ls: -1 });
    s += `</g>`;
  });
  s += headline(lt, ['Tout au', 'même endroit.'], CY + 230);
  return s;
}

function sc3(lt) { // courbe de croissance + compteur
  const x0 = 260, x1 = 1150, y0 = 720, y1 = 300;
  const vals = [0.12, 0.2, 0.17, 0.34, 0.46, 0.6, 0.74, 0.97];
  const n = vals.length, px = i => x0 + (x1 - x0) * i / (n - 1), py = v => lerp(y0, y1, v);
  let s = `<rect x="${x0}" y="${y0}" width="${f((x1 - x0) * easeOutCubic(seg(lt, 0, 0.4)))}" height="3" fill="${MUTE}"/>`;
  const rp = easeInOut(seg(lt, 0.3, 1.5)), clipW = (x1 - x0) * rp + 6;
  const pts = vals.map((v, i) => `${f(px(i))},${f(py(v))}`).join(' ');
  s += `<clipPath id="r3"><rect x="${x0 - 3}" y="${y1 - 40}" width="${f(clipW)}" height="${f(y0 - y1 + 80)}"/></clipPath>`;
  s += `<g clip-path="url(#r3)"><polygon points="${x0},${y0} ${pts} ${f(px(n - 1))},${y0}" fill="${GREEN}" opacity="0.13"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="${GREEN}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></g>`;
  vals.forEach((v, i) => { const ap = clamp01((clipW - (px(i) - x0)) / 40); if (ap > 0) s += circle(px(i), py(v), 9 * spring(ap, 3, 0.5), INK); });
  const cv = Math.round(15000 * easeOutCubic(seg(lt, 0.4, 1.8)));
  s += txt(1480, 470, cv.toLocaleString('fr-FR') + '+', 130, GREEN, { ls: -4 });
  s += txt(1480, 540, 'COMMANDES', 36, INK, { w: 700, ls: 8 });
  s += headline(lt, ['Shopify grandit', 'avec vous.'], CY + 260);
  return s;
}

function sc4(lt) { // payoff + CTA
  const sp = spring(lt, 2.0, 0.6);
  let s = `<g opacity="${f(clamp01(sp * 1.3))}" transform="translate(0 ${f((1 - sp) * 40)})">`;
  s += bag(CX, CY - 250, 132, GREEN);
  s += txt(CX, CY - 10, 'Shopify', 150, INK, { ls: -6 });
  s += `</g>`;
  const cta = easeOutExpo(seg(lt, 0.5, 1.1));
  s += `<g opacity="${f(cta)}" transform="translate(${CX} ${CY + 150}) scale(${f(0.9 + 0.1 * cta)}) translate(${-CX} ${-(CY + 150)})">`;
  s += rrect(CX - 240, CY + 110, 480, 86, 43, GREEN);
  s += txt(CX, CY + 166, 'Créer ma boutique', 40, GROUND, { w: 800, ls: -1 });
  s += `</g>`;
  return s;
}
const SCENES = [sc0, sc1, sc2, sc3, sc4];

function env(t, a, b) {
  const u1 = clamp01((t - a) / 0.35), u2 = clamp01((b - t) / 0.3);
  return { al: easeInOut(u1) * easeInOut(u2), sc: (0.97 + 0.03 * easeOutCubic(u1)) * (1 + 0.04 * (1 - easeInOut(u2))) };
}
function draw(t, tl) {
  let body = `<rect width="${W}" height="${H}" fill="${GROUND}"/>`;
  body += `<g opacity="0.05">`;
  for (let gx = 0; gx <= W; gx += 120) body += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${INK}" stroke-width="1"/>`;
  for (let gy = 0; gy <= H; gy += 120) body += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${INK}" stroke-width="1"/>`;
  body += `</g>`;
  tl.lines.forEach((L, i) => {
    const a = L.sStart, b = L.sEnd;
    if (t < a - 0.001 || t >= b) return;
    const e = env(t, a, b);
    if (e.al <= 0.001) return;
    body += `<g opacity="${f(e.al)}" transform="translate(${CX} ${CY}) scale(${f(e.sc)}) translate(${-CX} ${-CY})">${SCENES[i](t - a)}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// ---------- AUDIO ----------
function durOf(file) {
  try { execFileSync(FF, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) { const m = e.stderr.toString().match(/Duration: (\d+):(\d+):(\d+\.\d+)/); if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]); }
  return 0;
}
function run(args) { execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'inherit'] }); }

// bed musical procédural -> wav
function synthBed(dur) {
  const rate = 44100, n = Math.floor(dur * rate);
  const L = new Float32Array(n), R = new Float32Array(n);
  const chords = [[220, 277.18, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [146.83, 220, 293.66]];
  const bpm = 100, beat = 60 / bpm;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const ci = Math.floor(t / 4) % chords.length, ch = chords[ci];
    const blend = clamp01((t % 4) / 0.6); // petit crossfade d'accord
    let v = 0;
    ch.forEach((fr, k) => { v += Math.sin(2 * Math.PI * fr * t) * (0.5 - 0.12 * k); v += 0.3 * Math.sin(2 * Math.PI * fr * 2 * t); });
    v *= 0.05 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.1 * t)) * blend;
    // kick doux
    const bp = t % beat;
    if (bp < 0.12) { const e = Math.exp(-bp * 34); v += Math.sin(2 * Math.PI * 58 * t) * e * 0.12; }
    const pan = 0.0012 * Math.sin(2 * Math.PI * 0.05 * t);
    L[i] = v * (1 - pan); R[i] = v * (1 + pan);
  }
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let o = 44; for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-1, Math.min(1, L[i])) * 32767 | 0, o); buf.writeInt16LE(Math.max(-1, Math.min(1, R[i])) * 32767 | 0, o + 2); o += 4; }
  writeFileSync(`${DIR}/bed.wav`, buf);
}
const srtTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = (s % 60).toFixed(3).replace('.', ','); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.padStart(6, '0')}`; };

async function phaseAudio() {
  const gap = 0.4, tail = 1.3;
  const tl = { lines: [] }; let cursor = 0.3;
  LINES.forEach((L, i) => {
    const aiff = `${DIR}/vo${i}.aiff`;
    execFileSync('say', ['-v', 'Thomas', '-r', '178', '-o', aiff, L.vo]);
    const d = durOf(aiff);
    tl.lines.push({ i, vo: L.vo, start: cursor, end: cursor + d });
    cursor += d + gap;
  });
  const dur = Math.ceil((cursor - gap + tail) * 10) / 10;
  tl.dur = dur;
  // fenêtres de scène = autour de chaque ligne, contiguës, avec léger chevauchement
  tl.lines.forEach((L, i) => {
    L.sStart = i === 0 ? 0 : tl.lines[i].start - 0.5;
    L.sEnd = (i === tl.lines.length - 1) ? dur : tl.lines[i + 1].start - 0.2;
  });
  writeFileSync(`${DIR}/timeline.json`, JSON.stringify(tl, null, 2));
  // VO combinée (adelay + amix)
  const ins = [], filt = [];
  tl.lines.forEach((L, i) => { ins.push('-i', `${DIR}/vo${i}.aiff`); const ms = Math.round(L.start * 1000); filt.push(`[${i}:a]adelay=${ms}|${ms}[v${i}]`); });
  const mixIn = tl.lines.map((_, i) => `[v${i}]`).join('');
  run([...ins, '-filter_complex', `${filt.join(';')};${mixIn}amix=inputs=${tl.lines.length}:normalize=0[vo]`, '-map', '[vo]', '-ar', '44100', '-ac', '2', '-y', `${DIR}/vo.wav`]);
  synthBed(dur);
  // mix final : bed bas + VO, ducking léger (sidechain), puis loudnorm
  run(['-i', `${DIR}/vo.wav`, '-i', `${DIR}/bed.wav`,
    '-filter_complex', `[1:a]volume=0.5[b];[b][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=15:release=320[bd];[0:a][bd]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
    '-map', '[out]', '-ar', '48000', '-ac', '2', '-t', String(dur), '-y', `${DIR}/audio.wav`]);
  // .srt
  const srt = tl.lines.map((L, i) => `${i + 1}\n${srtTime(L.start)} --> ${srtTime(L.end)}\n${L.vo}\n`).join('\n');
  writeFileSync(SRT, srt);
  console.log('AUDIO ok · durée', dur, 's · lignes', tl.lines.map(l => `${l.start.toFixed(1)}-${l.end.toFixed(1)}`).join(' '));
}

async function phaseVideo() {
  const tl = JSON.parse(readFileSync(`${DIR}/timeline.json`, 'utf8'));
  const total = Math.round(tl.dur * FPS);
  const silent = `${DIR}/video.mp4`;
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let n = 0; n < total; n++) {
    const png = await sharp(Buffer.from(draw(n / FPS, tl))).png({ compressionLevel: 3 }).toBuffer();
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 120 === 0) process.stdout.write(` ${Math.round(n / total * 100)}%`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg video ' + c))));
  // mux vidéo + audio
  run(['-i', silent, '-i', `${DIR}/audio.wav`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', '-y', OUT]);
  console.log('\nVIDEO ok -> ' + OUT);
}

const mode = process.argv[2];
if (mode === 'audio') await phaseAudio();
else if (mode === 'video') await phaseVideo();
else { await phaseAudio(); await phaseVideo(); }
