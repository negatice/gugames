// ═══════════════════════════════════════════════════════
//  NOVA STRIKE — Balanced + BGM + Optimized Mobile
// ═══════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── DOM Refs ──
const $ = id => document.getElementById(id);
const startScreen    = $('startScreen');
const gameOverScreen = $('gameOverScreen');
const hud            = $('hud');
const scoreDisplay   = $('scoreDisplay');
const waveDisplay    = $('waveDisplay');
const healthBar      = $('healthBar');
const notification   = $('notification');
const powerUpIndicator = $('powerUpIndicator');
const bossBarWrap    = $('bossBarWrap');
const bossBarFill    = $('bossBarFill');
const goTitle        = $('goTitle');
const finalScore     = $('finalScore');
const finalStats     = $('finalStats');

// ═══════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════

let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, type, dur, vol = 0.1) {
  if (!audioCtx || !masterGain) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g);
  g.connect(masterGain);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}

const SFX = {
  shoot:    () => tone(880, 'square', 0.05, 0.04),
  hit:      () => tone(220, 'sawtooth', 0.1, 0.08),
  explode:  () => { tone(70, 'sawtooth', 0.3, 0.1); tone(45, 'square', 0.4, 0.06); },
  powerUp:  () => { tone(523,'sine',0.06,0.07); setTimeout(()=>tone(659,'sine',0.06,0.07),60); setTimeout(()=>tone(784,'sine',0.1,0.07),120); },
  damage:   () => tone(120, 'sawtooth', 0.2, 0.12),
  bossShoot:() => tone(100, 'square', 0.12, 0.08),
  phaseChange:() => { tone(180,'sine',0.1,0.1); setTimeout(()=>tone(280,'sine',0.1,0.1),100); setTimeout(()=>tone(380,'sine',0.15,0.1),200); },
  victory:  () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.25,0.1),i*120)); }
};

// ── BGM Procedural Synthwave ──
let bgmPlaying = false, bgmNode = null;

function startBGM() {
  if (bgmPlaying || !audioCtx) return;
  bgmPlaying = true;
  const bpm = 100, stepLen = 60 / bpm / 4;
  const totalSteps = 16, loopDur = totalSteps * stepLen;
  const sr = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(2, sr * loopDur, sr);
  const bass = [55,0,73.4,0,65.4,0,87.3,0, 55,0,73.4,0,65.4,0,87.3,0];
  const arp  = [110,130.8,146.8,174.6,130.8,146.8,174.6,220, 110,130.8,146.8,174.6,130.8,146.8,174.6,220];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const step = Math.floor(t / stepLen) % totalSteps;
      let val = 0;
      // Pad/Drone
      val += Math.sin(t * 40 * Math.PI * 2) * 0.02;
      val += Math.sin(t * 41.2 * Math.PI * 2) * 0.015;
      // Bass
      if (bass[step] > 0) {
        const env = Math.exp(-((t - step * stepLen) / (stepLen * 0.8)));
        val += Math.sin(t * bass[step] * Math.PI * 2) * env * 0.15;
      }
      // Arp
      if (arp[step] > 0) {
        const env = Math.exp(-((t - step * stepLen) / (stepLen * 0.4)));
        val += Math.sin(t * arp[step] * Math.PI * 2) * env * 0.06;
      }
      data[i] = val * 0.85;
    }
  }

  bgmNode = audioCtx.createBufferSource();
  bgmNode.buffer = buffer;
  bgmNode.loop = true;
  const bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.3;
  bgmNode.connect(bgmGain);
  bgmGain.connect(masterGain);
  bgmNode.start();
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmNode) { bgmNode.stop(); bgmNode = null; }
}

// ═══════════════════════════════════════════════════════
//  DIFFICULTY
// ═══════════════════════════════════════════════════════

let difficulty = 'easy';
const DIFF = {
  easy:   { playerHP: 6, enemyHP: 0.6, enemySpeed: 0.75, spawnRate: 0.5, bossHP: 100, scoreMult: 0.9 },
  medium: { playerHP: 4, enemyHP: 0.9, enemySpeed: 0.95, spawnRate: 0.8, bossHP: 160, scoreMult: 1.1 },
  hard:   { playerHP: 3, enemyHP: 1.3, enemySpeed: 1.2, spawnRate: 1.2, bossHP: 240, scoreMult: 1.4 }
};

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    difficulty = btn.dataset.diff;
  });
});

// ═══════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════

let gameRunning = false, paused = false;
let score = 0, wave = 0, waveTimer = 0;
let playerHP = 4, maxHP = 4;
let combo = 0, comboTimer = 0;
let shakeTimer = 0, shakeIntensity = 0;
let totalKills = 0, maxCombo = 0;
let bossActive = false, boss = null, gameWon = false;

// ── Player ──
const player = {
  x: 0, y: 0, speed: 7,
  shootTimer: 0, fireRate: 14,
  rapidFire: false, rapidFireTimer: 0,
  shield: false, shieldTimer: 0,
  invincible: false, invincibleTimer: 0,
  trail: []
};

// ── Arrays ──
let bullets = [], enemies = [], particles = [], stars = [], powerUps = [], enemyBullets = [];
let bgNebulae = [];

// ═══════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════

const keys = {};
let mouseX = 0, mouseDown = false;

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
  if (e.key.toLowerCase() === 'p' && gameRunning) paused = !paused;
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousemove', e => mouseX = e.clientX);
canvas.addEventListener('mousedown', () => { mouseDown = true; ensureAudio(); startBGM(); });
canvas.addEventListener('mouseup', () => mouseDown = false);

// ── Mobile Touch Input (Optimized) ──
let mLeft = false, mRight = false, mFire = false;

function setupMobileBtn(btnId, onDown, onUp) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('pressed');
    ensureAudio();
    startBGM();
    onDown();
  }, { passive: false });

  btn.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.remove('pressed');
    onUp();
  }, { passive: false });

  btn.addEventListener('touchcancel', e => {
    btn.classList.remove('pressed');
    onUp();
  });

  // Mouse fallback for desktop testing
  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    btn.classList.add('pressed');
    ensureAudio();
    startBGM();
    onDown();
  });
  btn.addEventListener('mouseup', e => {
    btn.classList.remove('pressed');
    onUp();
  });
  btn.addEventListener('mouseleave', e => {
    btn.classList.remove('pressed');
    onUp();
  });
}

setupMobileBtn('mbLeft',  () => { mLeft  = true;  }, () => { mLeft  = false; });
setupMobileBtn('mbRight', () => { mRight = true;  }, () => { mRight = false; });
setupMobileBtn('mbFire',  () => { mFire  = true;  }, () => { mFire  = false; });

// ═══════════════════════════════════════════════════════
//  STARS & BACKGROUND
// ═══════════════════════════════════════════════════════

function initStars() {
  stars = []; bgNebulae = [];
  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.4,
      speed: Math.random() * 2 + 0.3,
      brightness: Math.random(),
      hue: Math.random() > 0.8 ? (Math.random() > 0.5 ? 200 : 280) : 0
    });
  }
  for (let i = 0; i < 4; i++) {
    bgNebulae.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 180 + 80,
      hue: Math.random() * 360,
      alpha: Math.random() * 0.03 + 0.01,
      speed: Math.random() * 0.2 + 0.05
    });
  }
}

function updateStars() {
  for (const s of stars) {
    s.y += s.speed;
    s.brightness += (Math.random() - 0.5) * 0.03;
    s.brightness = Math.max(0.2, Math.min(1, s.brightness));
    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
  }
  for (const n of bgNebulae) {
    n.y += n.speed;
    if (n.y - n.r > canvas.height) { n.y = -n.r; n.x = Math.random() * canvas.width; }
  }
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#050510');
  bg.addColorStop(0.5, '#0a0a22');
  bg.addColorStop(1, '#150525');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const n of bgNebulae) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, `hsla(${n.hue},70%,40%,${n.alpha * 1.5})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  for (const s of stars) {
    ctx.fillStyle = s.hue ? `hsla(${s.hue},60%,80%,${s.brightness * 0.7})` : `rgba(190,200,240,${s.brightness * 0.7})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════

function spawnP(x, y, cnt, col, spd = 3, life = 35, sz = 3) {
  for (let i = 0; i < cnt; i++) {
    const a = Math.random() * Math.PI * 2, sp = Math.random() * spd + 0.2;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.random() * life + life * 0.4, maxLife: life * 1.3, color: col, size: Math.random() * sz + 0.5, type: 'c' });
  }
}

function spawnSpark(x, y, cnt, col, dir = -1, spd = 3.5) {
  for (let i = 0; i < cnt; i++) {
    const a = (Math.random() - 0.5) * 0.7 + (dir < 0 ? -Math.PI / 2 : Math.PI / 2);
    particles.push({ x, y, vx: Math.cos(a) * spd * 0.2, vy: Math.sin(a) * spd, life: Math.random() * 20 + 12, maxLife: 32, color: col, size: Math.random() * 1.8 + 0.4, type: 's' });
  }
}

function spawnRing(x, y, col, cnt = 18, spd = 4.5) {
  for (let i = 0; i < cnt; i++) {
    const a = (Math.PI * 2 / cnt) * i;
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 30, maxLife: 30, color: col, size: 2, type: 'c' });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.97;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.type === 's') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-p.size * 2, -p.size * 0.2, p.size * 4, p.size * 0.4);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════
//  DRAW PLAYER
// ═══════════════════════════════════════════════════════

function drawPlayer() {
  player.trail.push({ x: player.x, y: player.y + 24, a: 1, sz: 4 + Math.random() * 2 });
  if (player.trail.length > 14) player.trail.shift();
  for (const t of player.trail) {
    t.a -= 0.065; t.y += 2;
    if (t.a > 0) {
      ctx.fillStyle = `rgba(0,170,240,${t.a * 0.35})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.sz * t.a, 0, Math.PI * 2); ctx.fill();
    }
  }
  player.trail = player.trail.filter(t => t.a > 0);

  if (player.shield) {
    const sa = 0.2 + Math.sin(Date.now() * 0.008) * 0.08;
    ctx.strokeStyle = `rgba(0,240,255,${sa})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(player.x, player.y, 34, 0, Math.PI * 2); ctx.stroke();
  }
  if (player.invincible && Math.floor(Date.now() / 70) % 2) return;

  ctx.save(); ctx.translate(player.x, player.y);
  const fh = 12 + Math.sin(Date.now() * 0.025) * 2;
  const fg = ctx.createLinearGradient(0, 16, 0, 16 + fh + 6);
  fg.addColorStop(0, 'rgba(0,200,255,0.8)');
  fg.addColorStop(1, 'rgba(150,50,255,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-5, 16); ctx.quadraticCurveTo(0, 16 + fh + 6, 5, 16); ctx.fill();

  ctx.fillStyle = '#dce4f8';
  ctx.beginPath();
  ctx.moveTo(0, -24); ctx.lineTo(-7, -6); ctx.lineTo(-20, 16);
  ctx.lineTo(-9, 12); ctx.lineTo(0, 20); ctx.lineTo(9, 12);
  ctx.lineTo(20, 16); ctx.lineTo(7, -6); ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#252540';
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-5, 0); ctx.lineTo(5, 0); ctx.closePath(); ctx.fill();

  const cg = ctx.createRadialGradient(0, -10, 0, 0, -10, 6);
  cg.addColorStop(0, '#00e0ff'); cg.addColorStop(1, '#005090');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(0, -10, 3, 6, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#7b2fff';
  ctx.beginPath(); ctx.moveTo(-13, 8); ctx.lineTo(-22, 18); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, 8); ctx.lineTo(22, 18); ctx.lineTo(9, 12); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ff2d95';
  ctx.beginPath(); ctx.arc(-20, 16, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(20, 16, 1.8, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════
//  DRAW ALIENS
// ═══════════════════════════════════════════════════════

function drawAlien(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  const t = e.time * 0.04;
  ctx.shadowColor = e.color; ctx.shadowBlur = 14;

  if (e.type === 'grunt') {
    const b = Math.sin(t * 2) * 2; ctx.translate(0, b);
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 3, e.w / 3, e.h / 3.2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -3, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -3, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-3, -2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -e.h / 2.2); ctx.quadraticCurveTo(-7, -e.h / 2.2 - 8, -2, -e.h / 2.2 - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -e.h / 2.2); ctx.quadraticCurveTo(7, -e.h / 2.2 - 8, 2, -e.h / 2.2 - 10); ctx.stroke();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(-2, -e.h / 2.2 - 10, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -e.h / 2.2 - 10, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'flyer') {
    const f = Math.sin(t * 4) * 0.25;
    ctx.fillStyle = 'rgba(255,180,0,0.25)';
    ctx.beginPath(); ctx.ellipse(-e.w / 2 - 4, 0, 10, 5, f, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(e.w / 2 + 4, 0, 10, 5, -f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2.4, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-e.w / 3.5, -1.5, e.w * 0.7, 2.5);
    ctx.fillRect(-e.w / 3.5, 4, e.w * 0.7, 2.5);
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(-3, -4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.moveTo(0, e.h / 2); ctx.lineTo(-1.5, e.h / 2 + 5); ctx.lineTo(1.5, e.h / 2 + 5); ctx.fill();
  } else if (e.type === 'tank') {
    const p = 1 + Math.sin(t * 1.2) * 0.02; ctx.scale(p, p);
    ctx.fillStyle = '#4a2060';
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2); ctx.lineTo(e.w / 2, -e.h / 6); ctx.lineTo(e.w / 2, e.h / 3);
    ctx.lineTo(e.w / 4, e.h / 2); ctx.lineTo(-e.w / 4, e.h / 2); ctx.lineTo(-e.w / 2, e.h / 3);
    ctx.lineTo(-e.w / 2, -e.h / 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2 + 3); ctx.lineTo(e.w / 2 - 3, -e.h / 6 + 2);
    ctx.lineTo(e.w / 2 - 3, e.h / 3 - 2); ctx.lineTo(0, e.h / 2 - 3);
    ctx.lineTo(-e.w / 2 + 3, e.h / 3 - 2); ctx.lineTo(-e.w / 2 + 3, -e.h / 6 + 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(0, -1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f00';
    ctx.beginPath(); ctx.arc(0, -1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 7 - 2.5, -e.h / 2); ctx.lineTo(i * 7, -e.h / 2 - 7); ctx.lineTo(i * 7 + 2.5, -e.h / 2); ctx.fill();
    }
  } else if (e.type === 'shooter') {
    const aim = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.strokeStyle = '#cc2244'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ta = t * 1.5 + i * Math.PI / 1.5;
      ctx.beginPath(); ctx.moveTo(0, e.h / 3); ctx.quadraticCurveTo(Math.cos(ta) * 8, e.h / 3 + 10, Math.cos(ta) * 5, e.h / 3 + 16); ctx.stroke();
    }
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, e.w / 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f00';
    ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, -2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.save(); ctx.rotate(aim); ctx.fillRect(0, -2.5, 16, 5); ctx.restore();
  }

  ctx.shadowBlur = 0;

  if (e.maxHp > 1) {
    const bw = e.w + 4, bh = 3, by = -e.h / 2 - 9;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-bw / 2, by, bw, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#30d158' : '#ff2d55';
    ctx.fillRect(-bw / 2, by, bw * (e.hp / e.maxHp), bh);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════
//  DRAW BOSS
// ═══════════════════════════════════════════════════════

function drawBoss() {
  if (!boss) return;
  ctx.save(); ctx.translate(boss.x, boss.y);
  const t = boss.time * 0.015;
  const p = 1 + Math.sin(t * 2.5) * 0.015;
  ctx.scale(p, p);

  const ag = ctx.createRadialGradient(0, 0, boss.w * 0.4, 0, 0, boss.w);
  ag.addColorStop(0, `rgba(255,40,90,${0.04 + Math.sin(t * 3) * 0.02})`);
  ag.addColorStop(1, 'transparent');
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(0, 0, boss.w, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#8b0025'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 / 6) * i, w = Math.sin(t * 2.5 + i) * 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22 + 18);
    ctx.quadraticCurveTo(Math.cos(a) * (35 + w), Math.sin(a) * (35 + w) + 35, Math.cos(a + 0.25) * (45 + w), Math.sin(a + 0.25) * (45 + w) + 60);
    ctx.stroke();
  }

  ctx.fillStyle = '#250012';
  ctx.beginPath(); ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2); ctx.fill();

  const bg = ctx.createRadialGradient(0, -8, 0, 0, 0, boss.w / 2.2);
  bg.addColorStop(0, '#600020'); bg.addColorStop(1, '#2a0010');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, -4, boss.w / 2.2, boss.h / 2.2, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#4a0018';
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 / 5) * i + t;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 18, Math.sin(a) * 16 - 4, 7, 0, Math.PI * 2); ctx.fill();
  }

  const eyes = [[-13, -12], [13, -12], [0, -22]];
  for (const [ex, ey] of eyes) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, ey, 7, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = boss.phase >= 2 ? '#ffcc00' : '#ff2244';
    ctx.beginPath(); ctx.arc(ex, ey + 1.5, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ex, ey + 1.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(ex + 1.5, ey - 1, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 4, 10, 0.15, Math.PI - 0.15); ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4.5 - 1.8, 4); ctx.lineTo(i * 4.5, 8); ctx.lineTo(i * 4.5 + 1.8, 4); ctx.fill();
  }

  if (boss.phase >= 2) {
    ctx.strokeStyle = 'rgba(255,255,0,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, boss.w / 2 + 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════
//  BULLETS
// ═══════════════════════════════════════════════════════

function spawnBullet() {
  if (player.shootTimer > 0) return;
  const r = player.rapidFire ? Math.floor(player.fireRate / 3) : player.fireRate;
  player.shootTimer = r;
  bullets.push({ x: player.x - 9, y: player.y - 26, vx: 0, vy: -10, w: 3, h: 14, color: '#00f0ff' });
  bullets.push({ x: player.x + 9, y: player.y - 26, vx: 0, vy: -10, w: 3, h: 14, color: '#00f0ff' });
  SFX.shoot();
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx; b.y += b.vy;
    if (b.y < -20 || b.x < -20 || b.x > canvas.width + 20) bullets.splice(i, 1);
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]; b.x += b.vx; b.y += b.vy;
    if (b.y > canvas.height + 20 || b.x < -20 || b.x > canvas.width + 20) enemyBullets.splice(i, 1);
  }
}

function drawBullets() {
  for (const b of bullets) {
    ctx.shadowColor = b.color; ctx.shadowBlur = 10;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  for (const b of enemyBullets) {
    ctx.shadowColor = b.color || '#ff2d55'; ctx.shadowBlur = 8;
    ctx.fillStyle = b.color || '#ff2d55';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r || 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ═══════════════════════════════════════════════════════
//  ENEMIES
// ═══════════════════════════════════════════════════════

const enemyDefs = {
  grunt:   { w: 26, h: 24, hp: 1, speed: 1.6, score: 100, color: '#44cc44', shoot: 0,        sway: 1.8 },
  flyer:   { w: 20, h: 26, hp: 1, speed: 2.8, score: 150, color: '#ff9500', shoot: 0,        sway: 2.5 },
  tank:    { w: 34, h: 34, hp: 3, speed: 0.9, score: 300, color: '#af52de', shoot: 0.0015,   sway: 1 },
  shooter: { w: 28, h: 30, hp: 2, speed: 1.1, score: 250, color: '#ff3b30', shoot: 0.006,   sway: 1.3 }
};

function spawnEnemy() {
  let type; const r = Math.random();
  if (wave >= 3 && r < 0.12) type = 'tank';
  else if (wave >= 2 && r < 0.3) type = 'shooter';
  else if (r < 0.5) type = 'flyer';
  else type = 'grunt';

  const ed = enemyDefs[type], d = DIFF[difficulty];
  enemies.push({
    x: Math.random() * (canvas.width - 100) + 50,
    y: -50, w: ed.w, h: ed.h,
    hp: Math.ceil(ed.hp * d.enemyHP + wave * 0.08),
    maxHp: Math.ceil(ed.hp * d.enemyHP + wave * 0.08),
    speed: ed.speed * d.enemySpeed + wave * 0.03,
    score: ed.score, color: ed.color, type,
    shoot: ed.shoot + wave * 0.0008,
    time: 0, sway: Math.random() * Math.PI * 2, swayA: ed.sway
  });
}

function updateEnemies() {
  const d = DIFF[difficulty];
  if (Math.random() < 0.01 * d.spawnRate + wave * 0.003) spawnEnemy();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.time++; e.y += e.speed;
    e.x += Math.sin(e.time * 0.02 + e.sway) * e.swayA;

    if (e.shoot > 0 && Math.random() < e.shoot) {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, r: 3.5, color: '#ff4466' });
    }
    if (e.y > canvas.height + 60) enemies.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════════════
//  BOSS
// ═══════════════════════════════════════════════════════

function spawnBoss() {
  bossActive = true;
  const d = DIFF[difficulty];
  boss = { x: canvas.width / 2, y: -80, w: 90, h: 80, hp: d.bossHP, maxHp: d.bossHP, time: 0, phase: 1, atkTimer: 0, targetY: 110 };
  bossBarWrap.classList.add('visible');
  showNotification('⚠️ FINAL BOSS');
  SFX.phaseChange();
}

function updateBoss() {
  if (!boss) return;
  boss.time++; boss.atkTimer++;

  if (boss.y < boss.targetY) {
    boss.y += 1;
  } else {
    boss.x += Math.sin(boss.time * 0.012) * 1.8;
    boss.x = Math.max(boss.w / 2 + 10, Math.min(canvas.width - boss.w / 2 - 10, boss.x));
  }

  const ratio = boss.hp / boss.maxHp;
  const np = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
  if (np !== boss.phase) {
    boss.phase = np;
    spawnRing(boss.x, boss.y, '#ffcc00', 25, 5);
    SFX.phaseChange();
    showNotification(boss.phase === 2 ? 'PHASE 2 — ENRAGED!' : 'PHASE 3 — DESPERATION!');
  }

  const rate = boss.phase === 1 ? 70 : boss.phase === 2 ? 45 : 28;
  if (boss.atkTimer >= rate) {
    boss.atkTimer = 0;

    if (boss.phase === 1) {
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(player.y - boss.y, player.x - boss.x) + i * 0.18;
        enemyBullets.push({ x: boss.x, y: boss.y + 25, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, r: 4, color: '#ff2d55' });
      }
    } else if (boss.phase === 2) {
      const ba = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -2; i <= 2; i++) {
        const a = ba + i * 0.14;
        enemyBullets.push({ x: boss.x, y: boss.y + 25, vx: Math.cos(a) * 3.8, vy: Math.sin(a) * 3.8, r: 4, color: '#ff9500' });
      }
    } else {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 / 10) * i + boss.time * 0.04;
        enemyBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, r: 3.5, color: '#ffcc00' });
      }
    }
    if (boss.phase >= 2) SFX.bossShoot();
  }

  bossBarFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
  if (boss.hp <= 0) { gameWon = true; gameOver(); }
}

// ═══════════════════════════════════════════════════════
//  POWER-UPS
// ═══════════════════════════════════════════════════════

function spawnPowerUp(x, y) {
  if (Math.random() > 0.55) return;
  const types = ['rapid', 'shield', 'health'];
  const type = types[Math.floor(Math.random() * types.length)];
  powerUps.push({ x, y, type, time: 0, vy: 0.6, color: type === 'rapid' ? '#ff9500' : type === 'shield' ? '#00f0ff' : '#30d158' });
}

function updatePowerUps() {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.y += p.vy; p.time++;
    if (p.y > canvas.height + 20) { powerUps.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < 26 && Math.abs(p.y - player.y) < 26) {
      applyPU(p.type);
      powerUps.splice(i, 1);
    }
  }
}

function applyPU(type) {
  SFX.powerUp();
  if (type === 'rapid') {
    player.rapidFire = true; player.rapidFireTimer = 320;
    powerUpIndicator.textContent = '⚡ RAPID FIRE';
    powerUpIndicator.style.background = 'rgba(255,149,0,0.25)';
  } else if (type === 'shield') {
    player.shield = true; player.shieldTimer = 420;
    powerUpIndicator.textContent = '🛡️ SHIELD';
    powerUpIndicator.style.background = 'rgba(0,240,255,0.25)';
  } else {
    playerHP = Math.min(playerHP + 1, maxHP);
    powerUpIndicator.textContent = '❤️ HEALTH +1';
    powerUpIndicator.style.background = 'rgba(48,209,88,0.25)';
    updateHealthBar();
  }
  powerUpIndicator.classList.add('active');
  showNotification(type === 'health' ? '+1 HP' : type === 'shield' ? 'SHIELD' : 'RAPID FIRE');
}

function drawPowerUps() {
  for (const p of powerUps) {
    ctx.save(); ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(p.time * 0.08) * 0.1;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = p.color; ctx.shadowBlur = 22;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ rapid: '⚡', shield: '🛡', health: '+' }[p.type] || '?', 0, 1);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
//  COLLISIONS
// ═══════════════════════════════════════════════════════

function checkCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.abs(b.x - e.x) < e.w / 2 + 2 && Math.abs(b.y - e.y) < e.h / 2 + 6) {
        e.hp--; bullets.splice(i, 1); hit = true;
        spawnP(b.x, b.y, 3, e.color, 1.5, 12, 1.5);
        spawnSpark(b.x, b.y, 2, '#fff', 1, 1.5);
        if (e.hp <= 0) { onKill(e); enemies.splice(j, 1); } else SFX.hit();
        break;
      }
    }
    if (hit) continue;
    if (boss && boss.y > -20 && Math.abs(b.x - boss.x) < boss.w / 2 && Math.abs(b.y - boss.y) < boss.h / 2) {
      boss.hp--; bullets.splice(i, 1);
      spawnP(b.x, b.y, 2, '#ffcc00', 1.5, 10, 1.5);
      SFX.hit();
    }
  }

  if (player.invincible) return;

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (Math.abs(b.x - player.x) < 13 && Math.abs(b.y - player.y) < 17) {
      enemyBullets.splice(i, 1);
      player.shield ? spawnP(b.x, b.y, 8, '#00f0ff', 2.5, 18) : damagePlayer();
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (Math.abs(e.x - player.x) < (e.w / 2 + 13) && Math.abs(e.y - player.y) < (e.h / 2 + 18)) {
      if (!player.shield) {
        damagePlayer(); e.hp -= 2;
        if (e.hp <= 0) { onKill(e); enemies.splice(i, 1); }
      } else {
        e.hp -= 2;
        spawnP(player.x, player.y, 8, '#00f0ff', 2.5, 18); SFX.hit();
        if (e.hp <= 0) { onKill(e); enemies.splice(i, 1); }
      }
    }
  }

  if (boss && !player.invincible && Math.abs(boss.x - player.x) < (boss.w / 2 + 8) && Math.abs(boss.y - player.y) < (boss.h / 2 + 14)) {
    player.shield ? spawnP(player.x, player.y, 10, '#00f0ff', 3, 20) : damagePlayer();
  }
}

function onKill(e) {
  combo++; comboTimer = 90;
  if (combo > maxCombo) maxCombo = combo;
  totalKills++;
  const d = DIFF[difficulty];
  score += Math.floor(e.score * Math.min(combo, 8) * d.scoreMult);
  scoreDisplay.textContent = score.toLocaleString();
  if (combo >= 4) showNotification(`${combo}x COMBO!`);

  spawnP(e.x, e.y, e.type === 'tank' ? 20 : 10, e.color, e.type === 'tank' ? 4 : 2.5, e.type === 'tank' ? 45 : 30, 3);
  spawnSpark(e.x, e.y, e.type === 'tank' ? 8 : 4, '#fff', 1, 3);
  if (e.type === 'tank') spawnRing(e.x, e.y, e.color, 14, 3.5);
  SFX.explode();
  shakeTimer = e.type === 'tank' ? 10 : 5;
  shakeIntensity = e.type === 'tank' ? 6 : 3.5;
  spawnPowerUp(e.x, e.y);
}

function damagePlayer() {
  playerHP--;
  player.invincible = true; player.invincibleTimer = 80;
  combo = 0; updateHealthBar();
  SFX.damage();
  shakeTimer = 8; shakeIntensity = 7;
  spawnP(player.x, player.y, 18, '#ff2d55', 4, 28, 3.5);
  spawnSpark(player.x, player.y, 6, '#ffcc00', 1, 4);
  if (playerHP <= 0) { gameWon = false; gameOver(); }
}

function updateHealthBar() {
  healthBar.innerHTML = '';
  for (let i = 0; i < maxHP; i++) {
    const s = document.createElement('span');
    s.className = 'heart' + (i >= playerHP ? ' lost' : '');
    s.textContent = '❤️';
    healthBar.appendChild(s);
  }
}

function showNotification(t) {
  notification.textContent = t;
  notification.classList.remove('show');
  void notification.offsetWidth;
  notification.classList.add('show');
}

// ═══════════════════════════════════════════════════════
//  WAVE SYSTEM
// ═══════════════════════════════════════════════════════

function updateWave() {
  waveTimer++;
  if (waveTimer >= 1400 + wave * 280) {
    wave++; waveDisplay.textContent = wave; waveTimer = 0;
    showNotification(`WAVE ${wave}`);
    if (wave === 5 && !bossActive) setTimeout(spawnBoss, 1200);
  }
}

// ═══════════════════════════════════════════════════════
//  PLAYER UPDATE
// ═══════════════════════════════════════════════════════

function updatePlayer() {
  let mx = 0;
  if (keys['arrowleft'] || keys['a'] || mLeft) mx = -1;
  if (keys['arrowright'] || keys['d'] || mRight) mx = 1;

  // Mouse following (only on click-drag)
  if (mouseDown) {
    const dx = mouseX - player.x;
    if (Math.abs(dx) > 8) {
      mx = dx > 0 ? 1 : -1;
      if (Math.abs(dx) < 35) player.x += dx * 0.08;
    }
  }

  player.x += mx * player.speed;
  player.x = Math.max(24, Math.min(canvas.width - 24, player.x));
  player.y = canvas.height - 75;

  if (keys[' '] || mouseDown || mFire) spawnBullet();
  if (player.shootTimer > 0) player.shootTimer--;

  if (player.rapidFireTimer > 0) {
    player.rapidFireTimer--;
    if (player.rapidFireTimer <= 0) { player.rapidFire = false; powerUpIndicator.classList.remove('active'); }
  }
  if (player.shieldTimer > 0) {
    player.shieldTimer--;
    if (player.shieldTimer <= 0) { player.shield = false; powerUpIndicator.classList.remove('active'); }
  }
  if (player.invincibleTimer > 0) {
    player.invincibleTimer--;
    if (player.invincibleTimer <= 0) player.invincible = false;
  }
  if (comboTimer > 0) { comboTimer--; if (comboTimer <= 0) combo = 0; }
}

// ═══════════════════════════════════════════════════════
//  GAME OVER
// ═══════════════════════════════════════════════════════

function gameOver() {
  gameRunning = false;
  hud.classList.remove('visible');
  bossBarWrap.classList.remove('visible');
  bossActive = false; boss = null;

  goTitle.textContent = gameWon ? '🏆 VICTORY!' : 'Mission Failed';
  goTitle.className = gameWon ? 'victory-text' : '';
  finalScore.textContent = `Score: ${score.toLocaleString()}`;
  finalStats.innerHTML = `Difficulty: ${difficulty.toUpperCase()}<br>Waves: ${wave}<br>Kills: ${totalKills}<br>Max Combo: ${maxCombo}x`;

  gameOverScreen.classList.remove('hidden');
  canvas.style.cursor = 'default';
  if (gameWon) SFX.victory();
}

// ═══════════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════════

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameRunning && !paused) {
    updateStars(); updatePlayer(); updateBullets();
    updateEnemies(); updateParticles(); updatePowerUps();
    updateBoss(); checkCollisions(); updateWave();
    if (shakeTimer > 0) shakeTimer--;
  }

  ctx.save();
  if (shakeTimer > 0) {
    const s = (shakeTimer / 12) * shakeIntensity;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground();
  if (gameRunning) {
    drawBullets(); drawPowerUps();
    for (const e of enemies) drawAlien(e);
    if (boss) drawBoss();
    drawPlayer(); drawParticles();
  } else {
    drawParticles();
  }
  ctx.restore();

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 2.5rem Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.font = '0.8rem Orbitron, sans-serif';
    ctx.fillStyle = '#5a6a90';
    ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 35);
  }

  requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════════
//  START GAME
// ═══════════════════════════════════════════════════════

function startGame() {
  ensureAudio();
  const d = DIFF[difficulty];
  score = 0; wave = 1; waveTimer = 0;
  playerHP = maxHP = d.playerHP;
  combo = 0; comboTimer = 0; totalKills = 0; maxCombo = 0;
  bossActive = false; boss = null; gameWon = false;

  player.x = canvas.width / 2; player.y = canvas.height - 75;
  player.rapidFire = false; player.shield = false;
  player.invincible = false; player.shootTimer = 0;
  player.trail = [];
  bullets = []; enemies = []; particles = [];
  powerUps = []; enemyBullets = [];

  scoreDisplay.textContent = '0';
  waveDisplay.textContent = '1';
  bossBarFill.style.width = '100%';
  bossBarWrap.classList.remove('visible');
  updateHealthBar();
  powerUpIndicator.classList.remove('active');
  initStars();

  gameRunning = true; paused = false;
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.add('visible');
  canvas.style.cursor = 'none';
  startBGM();
}

$('startBtn').addEventListener('click', () => { ensureAudio(); startGame(); });
$('restartBtn').addEventListener('click', () => { ensureAudio(); startGame(); });

(function() {
  const btn = document.getElementById('homeReturnBtn');
  if (!btn) return;

  let holdTimer = null;

  function startHold(e) {
    if (e.cancelable) e.preventDefault();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => {
      // Feedback haptic (jika device mendukung)
      if (navigator.vibrate) navigator.vibrate(30);
      // Ganti path ini jika struktur folder kamu berbeda
      window.location.href = '../../index.html';
    }, 1000); // 1000ms = 1 detik
  }

  function cancelHold() {
    btn.classList.remove('holding');
    clearTimeout(holdTimer);
  }

  // Mouse events
  btn.addEventListener('mousedown', startHold);
  btn.addEventListener('mouseup', cancelHold);
  btn.addEventListener('mouseleave', cancelHold);

  // Touch events
  btn.addEventListener('touchstart', startHold, { passive: false });
  btn.addEventListener('touchend', cancelHold);
  btn.addEventListener('touchcancel', cancelHold);
})();

// ── Init ──
initStars();
gameLoop();