// ============================================
// STACK TOWER — Premium Edition
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI
const scoreDisplay = document.getElementById('score-display');
const highscoreDisplay = document.getElementById('highscore-display');
const comboDisplay = document.getElementById('combo-display');
const perfectText = document.getElementById('perfect-text');
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl = document.getElementById('final-score');
const finalBestEl = document.getElementById('final-best');
const newBestEl = document.getElementById('new-best');
const menuHighscore = document.getElementById('menu-highscore');
const flashOverlay = document.getElementById('flash-overlay');
const statMaxCombo = document.getElementById('stat-max-combo');
const statPerfects = document.getElementById('stat-perfects');

// ---- AUDIO ----
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }

function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur);
}

function playDrop() { tone(280, 0.06, 'square', 0.06); }
function playSlice() { if (!audioCtx) return; const t = audioCtx.currentTime; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.12); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.12); }
function playPerfect() { tone(523, 0.12, 'sine', 0.14, 0); tone(659, 0.12, 'sine', 0.14, 0.08); tone(784, 0.25, 'sine', 0.16, 0.16); tone(1047, 0.3, 'sine', 0.1, 0.24); }
function playGameOver() { [350, 300, 250, 150].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.1, i * 0.12)); }
function playCombo(n) { tone(600 + n * 40, 0.1, 'sine', 0.1, 0); tone(750 + n * 40, 0.12, 'sine', 0.1, 0.05); }
function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

// ---- RESIZE ----
let W, H, dpr;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ---- COLORS ----
const PALETTES = [
  ['#FF6B6B', '#FFA07A', '#FFD93D', '#6BCB77', '#4D96FF'],
  ['#9B59B6', '#FF6B9D', '#C44569', '#574B90', '#303952'],
  ['#0ABDE3', '#10AC84', '#EE5A24', '#F79F1F', '#A3CB38'],
  ['#D980FA', '#B53471', '#009432', '#0652DD', '#1B1464'],
];

function getColor(idx) {
  const pal = PALETTES[Math.floor(idx / 5) % PALETTES.length];
  return pal[idx % pal.length];
}

function hexRgb(hex) { return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) }; }
function rgbHex(r,g,b) { return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join(''); }
function lighten(hex, n) { const {r,g,b} = hexRgb(hex); return rgbHex(r+n, g+n, b+n); }
function darken(hex, n) { const {r,g,b} = hexRgb(hex); return rgbHex(r-n, g-n, b-n); }

// ---- CONSTANTS ----
const BLOCK_H = 30;
const PERFECT_PX = 6;
const BASE_SPEED = 2.8;
const SPEED_INC = 0.13;
const MAX_SPEED = 11;
const INIT_W_RATIO = 0.42;
const MIN_W = 12;
const BLOCKS_VISIBLE = 12; // how many blocks to keep above the moving block

// ---- STATE ----
const ST = { MENU: 0, PLAY: 1, OVER: 2 };
let state = ST.MENU;
let score = 0, hi = parseInt(localStorage.getItem('stkHi') || '0');
let combo = 0, maxCombo = 0, totalPerfects = 0;

let blocks = [], moving = null, falls = [], parts = [];
let camY = 0, targetCamY = 0;
let shakeX = 0, shakeY = 0, shakeInt = 0;
let bgHue = 220, targetHue = 220;
let flashTimer = 0;
let stars = [];
let time = 0;

// ---- STARS ----
function genStars() {
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 3,
      size: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.3
    });
  }
}
genStars();
window.addEventListener('resize', genStars);

// ---- BLOCK ----
class Block {
  constructor(x, y, w, c, base=false) {
    this.x = x; this.y = y; this.w = w; this.h = BLOCK_H; this.c = c; this.base = base;
    this.glow = 0; this.perfect = false; this.born = time;
  }
  draw(ctx) {
    const sy = this.y - camY;
    if (sy < -this.h - 20 || sy > H + 20) return;
    const {r,g,b} = hexRgb(this.c);
    // Shadow
    ctx.fillStyle = `rgba(0,0,0,${0.12 + this.base * 0.05})`;
    ctx.fillRect(this.x + 2, sy + 2, this.w, this.h);
    // Main
    const gr = ctx.createLinearGradient(this.x, sy, this.x, sy + this.h);
    gr.addColorStop(0, `rgb(${r+40},${g+40},${b+40})`);
    gr.addColorStop(0.45, this.c);
    gr.addColorStop(1, `rgb(${Math.max(0,r-35)},${Math.max(0,g-35)},${Math.max(0,b-35)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(this.x, sy, this.w, this.h);
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(this.x, sy, this.w, 2);
    ctx.fillRect(this.x, sy, 2, this.h);
    // Perfect glow
    if (this.glow > 0) {
      const a = this.glow / 40;
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 25 * a;
      ctx.fillStyle = `rgba(255,215,0,${a * 0.2})`;
      ctx.fillRect(this.x - 4, sy - 4, this.w + 8, this.h + 8);
      ctx.shadowBlur = 0; this.glow--;
    }
  }
}

// ---- FALLING PIECE ----
class Fall {
  constructor(x,y,w,h,c) { this.x=x; this.y=y; this.w=w; this.h=h; this.c=c; this.vy=0; this.vx=(Math.random()-0.5)*3; this.rot=0; this.vr=(Math.random()-0.5)*0.08; this.a=1; }
  update() { this.vy+=0.6; this.y+=this.vy; this.x+=this.vx; this.rot+=this.vr; this.a-=0.018; }
  draw(ctx) {
    if (this.a<=0) return;
    const sy = this.y - camY;
    ctx.save(); ctx.globalAlpha=this.a;
    ctx.translate(this.x+this.w/2, sy+this.h/2); ctx.rotate(this.rot);
    ctx.fillStyle=this.c;
    ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(-this.w/2, -this.h/2, this.w, 2);
    ctx.restore();
  }
}

// ---- PARTICLE ----
class Part {
  constructor(x,y,c) {
    this.x=x; this.y=y; this.c=c;
    const ang = Math.random()*Math.PI*2, spd=Math.random()*5+2;
    this.vx=Math.cos(ang)*spd; this.vy=Math.sin(ang)*spd-2;
    this.sz=Math.random()*5+2; this.a=1; this.life=Math.random()*40+25;
  }
  update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.12; this.a-=1/this.life; this.sz*=0.97; }
  draw(ctx) {
    if (this.a<=0) return;
    const sy=this.y-camY;
    ctx.save(); ctx.globalAlpha=this.a;
    ctx.fillStyle=this.c;
    ctx.beginPath(); ctx.arc(this.x, sy, this.sz, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ---- INIT ----
function initGame() {
  score=0; combo=0; maxCombo=0; totalPerfects=0;
  blocks=[]; falls=[]; parts=[];
  camY=0; targetCamY=0; shakeInt=0; flashTimer=0;
  time=0;

  const bw = W * INIT_W_RATIO;
  const bx = (W - bw) / 2;
  const by = H * 0.65;

  blocks.push(new Block(bx, by, bw, getColor(0), true));
  spawnMove();
  updateUI();
}

function spawnMove() {
  const last = blocks[blocks.length - 1];
  const w = last.w;
  const spd = Math.min(BASE_SPEED + (score) * SPEED_INC, MAX_SPEED);
  const dir = score % 2 === 0 ? 1 : -1;

  moving = {
    x: dir === 1 ? -w : W,
    y: last.y - BLOCK_H,
    w: w, h: BLOCK_H,
    spd: spd, dir: dir,
    c: getColor(score), alive: true
  };

  // Camera target: keep top block at ~30% from top of screen
  targetCamY = moving.y - H * 0.3;
}

// ---- DROP ----
function drop() {
  if (!moving || !moving.alive) return;
  initAudio();
  playDrop();

  const last = blocks[blocks.length - 1];
  const mb = moving;

  const os = Math.max(mb.x, last.x);
  const oe = Math.min(mb.x + mb.w, last.x + last.w);
  const ov = oe - os;

  if (ov <= 0) { triggerGO(mb); return; }

  const perfect = Math.abs(mb.x - last.x) < PERFECT_PX && ov < last.w * 0.1;
  let nw, nx;

  if (perfect) {
    nw = last.w; nx = last.x;
    combo++; if (combo > maxCombo) maxCombo = combo;
    totalPerfects++;
    playPerfect();
    flash('#FFD700', 0.3);
    spawnParts(nx + nw/2, mb.y, '#FFD700', 25);
    spawnParts(nx + nw/2, mb.y, '#FFFFFF', 12);
    showPerfect();
    if (combo >= 2) { playCombo(combo); showCombo(combo); }
    vibrate([25]);
  } else {
    combo = 0; hideCombo();
    playSlice();
    if (mb.x < last.x) {
      nw = ov; nx = last.x;
      falls.push(new Fall(mb.x, mb.y, last.x - mb.x, BLOCK_H, mb.c));
    } else {
      nw = ov; nx = os;
      falls.push(new Fall(oe, mb.y, (mb.x + mb.w) - oe, BLOCK_H, mb.c));
    }
  }

  if (nw < MIN_W) { triggerGO(mb); return; }

  const nb = new Block(nx, mb.y, nw, mb.c);
  if (perfect) { nb.perfect = true; nb.glow = 40; }
  blocks.push(nb);

  score++;
  updateUI();

  targetHue = (220 + score * 6) % 360;
  spawnMove();
}

function triggerGO(mb) {
  state = ST.OVER;
  playGameOver();
  shakeInt = 15;
  vibrate([60, 40, 60, 40]);
  if (mb.alive) falls.push(new Fall(mb.x, mb.y, mb.w, mb.h, mb.c));

  const isNew = score > hi;
  if (isNew) { hi = score; localStorage.setItem('stkHi', hi); }

  setTimeout(() => {
    finalScoreEl.textContent = score;
    finalBestEl.textContent = hi;
    newBestEl.className = isNew ? 'new-best show' : 'new-best';
    statMaxCombo.textContent = maxCombo;
    statPerfects.textContent = totalPerfects;
    gameoverScreen.classList.add('show');
  }, 700);

  moving.alive = false; moving = null;
}

// ---- UI ----
function updateUI() {
  scoreDisplay.textContent = score;
  highscoreDisplay.textContent = `BEST ${hi}`;
  scoreDisplay.classList.add('pop');
  setTimeout(() => scoreDisplay.classList.remove('pop'), 120);
}
function showPerfect() {
  perfectText.textContent = 'PERFECT!';
  perfectText.style.opacity = ''; perfectText.className = '';
  void perfectText.offsetWidth;
  perfectText.className = 'animate';
}
function showCombo(c) {
  comboDisplay.textContent = `🔥 COMBO ×${c}`;
  comboDisplay.className = 'show';
}
function hideCombo() { comboDisplay.className = 'hide'; }
function flash(color, dur) {
  flashOverlay.style.background = color;
  flashOverlay.style.opacity = dur;
  setTimeout(() => { flashOverlay.style.opacity = 0; }, 80);
}

// ---- DRAW ----
function draw() {
  time++;
  ctx.clearRect(0, 0, W, H);

  // BG
  bgHue += (targetHue - bgHue) * 0.015;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `hsl(${bgHue}, 35%, 6%)`);
  bg.addColorStop(1, `hsl(${(bgHue + 30) % 360}, 30%, 10%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    s.twinkle += 0.02 * s.speed;
    const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const sy = ((s.y - camY * 0.2) % (H * 3) + H * 3) % (H * 3) - H;
    ctx.beginPath(); ctx.arc(s.x, sy, s.size, 0, Math.PI*2); ctx.fill();
  }

  // Camera + shake
  ctx.save();
  camY += (targetCamY - camY) * 0.09;
  if (shakeInt > 0) {
    shakeX = (Math.random()-0.5) * shakeInt;
    shakeY = (Math.random()-0.5) * shakeInt;
    shakeInt *= 0.88;
    if (shakeInt < 0.3) { shakeInt = 0; shakeX = 0; shakeY = 0; }
    ctx.translate(shakeX, shakeY);
  }

  // Draw blocks
  for (const b of blocks) b.draw(ctx);

  // Guide lines
  if (moving && moving.alive && blocks.length > 0) {
    const last = blocks[blocks.length-1];
    const sy = moving.y - camY;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(last.x, sy); ctx.lineTo(last.x, sy + BLOCK_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(last.x + last.w, sy); ctx.lineTo(last.x + last.w, sy + BLOCK_H); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Moving block
  if (moving && moving.alive) {
    const sy = moving.y - camY;
    const {r,g,b} = hexRgb(moving.c);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(moving.x + 3, sy + 3, moving.w, moving.h);
    // Block
    const gr = ctx.createLinearGradient(moving.x, sy, moving.x, sy + moving.h);
    gr.addColorStop(0, `rgb(${r+40},${g+40},${b+40})`);
    gr.addColorStop(0.5, moving.c);
    gr.addColorStop(1, `rgb(${Math.max(0,r-35)},${Math.max(0,g-35)},${Math.max(0,b-35)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(moving.x, sy, moving.w, moving.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(moving.x, sy, moving.w, 2);
    ctx.fillRect(moving.x, sy, 2, moving.h);
    // Glow
    ctx.shadowColor = moving.c; ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(moving.x, sy, moving.w, moving.h);
    ctx.shadowBlur = 0;
  }

  // Falls
  for (const f of falls) { f.update(); f.draw(ctx); }
  falls = falls.filter(f => f.a > 0 && f.y - camY < H + 200);

  // Particles
  for (const p of parts) { p.update(); p.draw(ctx); }
  parts = parts.filter(p => p.a > 0);

  ctx.restore();
}

// ---- LOOP ----
function loop() {
  if (state === ST.PLAY && moving && moving.alive) {
    moving.x += moving.spd * moving.dir;
    if (moving.dir === 1 && moving.x > W + moving.w * 0.4) moving.dir = -1;
    else if (moving.dir === -1 && moving.x < -moving.w * 0.4) moving.dir = 1;
  }
  draw();
  requestAnimationFrame(loop);
}

// ---- INPUT ----
function tap(e) {
  if (e) e.preventDefault();
  if (state === ST.PLAY) drop();
}
// canvas.addEventListener('pointerdown', tap);
canvas.addEventListener('touchstart', tap, { passive: false });
document.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') tap(e); });
document.addEventListener('dblclick', e => e.preventDefault());

document.getElementById('startBtn').addEventListener('click', () => {
  initAudio(); initGame(); state = ST.PLAY;
  menuScreen.classList.add('hidden');
  setTimeout(() => { menuScreen.style.display = 'none'; }, 400);
  gameoverScreen.classList.remove('show');
});

document.getElementById('retryBtn').addEventListener('click', () => {
  initGame(); state = ST.PLAY;
  gameoverScreen.classList.remove('show');
  menuScreen.style.display = '';
});

// ---- INIT ----
function init() {
  resize();
  highscoreDisplay.textContent = `BEST ${hi}`;
  menuHighscore.textContent = hi > 0 ? `🏆 Best Score: ${hi}` : '';
  loop();
}
init();