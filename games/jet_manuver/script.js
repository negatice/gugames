// ============================================================
// JET MANEUVER - Mobile Optimized
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Prevent iOS scroll/zoom
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// --- Audio System ---
const AudioSys = (() => {
  let actx = null;
  function init() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  }

  function playExplosion() {
    if (!actx) return;
    const now = actx.currentTime, dur = 0.35;
    const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    const src = actx.createBufferSource(); src.buffer = buf;
    const gain = actx.createGain(); gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const filter = actx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(1000, now); filter.frequency.exponentialRampToValueAtTime(80, now + dur);
    src.connect(filter).connect(gain).connect(actx.destination); src.start(now);
  }

  function playLaunch() {
    if (!actx) return;
    const now = actx.currentTime;
    const osc = actx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    const gain = actx.createGain(); gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(actx.destination); osc.start(now); osc.stop(now + 0.25);
  }

  function playTurbo() {
    if (!actx) return;
    const now = actx.currentTime;
    const osc = actx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(250, now); osc.frequency.linearRampToValueAtTime(700, now + 0.12);
    const gain = actx.createGain(); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(actx.destination); osc.start(now); osc.stop(now + 0.15);
  }

  return { init, playExplosion, playLaunch, playTurbo };
})();

// --- Resize & Canvas Setup ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const W = () => window.innerWidth;
const H = () => window.innerHeight;

// --- Utility ---
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
const angleDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; return d; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// --- Input System (Touch Only) ---
const Input = (() => {
  let joystick = { active: false, dx: 0, dy: 0, touchId: null, startX: 0, startY: 0 };
  let turbo = false;

  // Joystick
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < W() / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.startX = t.clientX;
        joystick.startY = t.clientY;
        joystick.dx = joystick.dy = 0;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.touchId && joystick.active) {
        const dx = t.clientX - joystick.startX;
        const dy = t.clientY - joystick.startY;
        const d = Math.hypot(dx, dy);
        const maxR = 50;
        joystick.dx = clamp(dx, -maxR, maxR) / maxR;
        joystick.dy = clamp(dy, -maxR, maxR) / maxR;
      }
    }
  }, { passive: false });

  const endJoystick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.touchId) {
        joystick.active = false; joystick.touchId = null; joystick.dx = joystick.dy = 0;
      }
    }
  };
  canvas.addEventListener('touchend', endJoystick, { passive: false });
  canvas.addEventListener('touchcancel', endJoystick, { passive: false });

  // Turbo
  const turboBtn = document.getElementById('turbo-btn');
  const setTurbo = (e, val) => { e.preventDefault(); turbo = val; };
  turboBtn.addEventListener('touchstart', e => setTurbo(e, true), { passive: false });
  turboBtn.addEventListener('touchend', e => setTurbo(e, false), { passive: false });
  turboBtn.addEventListener('touchcancel', e => setTurbo(e, false), { passive: false });

  function getInput() {
    return { dx: joystick.dx, dy: joystick.dy, turbo };
  }

  return { getInput, joystick };
})();

// --- Background ---
const Background = (() => {
  let stars = [];
  function init() {
    stars = Array.from({length: 120}, () => ({
      x: Math.random() * W(), y: Math.random() * H(),
      s: Math.random() * 1.2 + 0.4, spd: Math.random() * 0.2 + 0.05, br: Math.random()
    }));
  }
  function update() {
    for (const s of stars) {
      s.y += s.spd; s.br += (Math.random() - 0.5) * 0.03;
      s.br = clamp(s.br, 0.2, 0.9);
      if (s.y > H()) { s.y = 0; s.x = Math.random() * W(); }
    }
  }
  function render() {
    const g = ctx.createLinearGradient(0, 0, 0, H());
    g.addColorStop(0, '#050510'); g.addColorStop(0.5, '#0a0a2e'); g.addColorStop(1, '#0f0520');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W(), H());

    for (const s of stars) {
      ctx.globalAlpha = s.br; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  return { init, update, render };
})();

// --- Particles ---
const Particles = (() => {
  let list = [];
  function createExplosion(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed + speed * 0.2;
      list.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1, decay: 0.015 + Math.random()*0.025, sz: 2 + Math.random()*3, color });
    }
  }
  function createTrail(x, y, color) {
    list.push({ x, y, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4, life: 1, decay: 0.03 + Math.random()*0.02, sz: 1.5 + Math.random()*1.5, color });
  }
  function update() {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= p.decay;
      if (p.life <= 0) list.splice(i, 1);
    }
  }
  function render() {
    for (const p of list) {
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function clear() { list = []; }
  return { createExplosion, createTrail, update, render, clear };
})();

// --- Screen Shake ---
const ScreenShake = (() => {
  let intensity = 0;
  let ox = 0, oy = 0;
  function trigger(amount) { intensity = amount; }
  function update() {
    if (intensity > 0) {
      ox = (Math.random() - 0.5) * intensity; oy = (Math.random() - 0.5) * intensity;
      intensity *= 0.85;
      if (intensity < 0.2) { intensity = 0; ox = oy = 0; }
    }
  }
  return { trigger, update, getOffset: () => ({ x: ox, y: oy }) };
})();

// --- Jet ---
const Jet = (() => {
  let x, y, vx, vy, angle;
  const maxSpeed = 4.5, turboSpeed = 9;
  const accel = 0.25, friction = 0.955;
  let fuel = 100, fuelMax = 100, isTurbo = false, turboCooldown = 0;

  function reset() {
    x = W() / 2; y = H() / 2; vx = vy = 0; angle = -Math.PI/2;
    fuel = 100; turboCooldown = 0; isTurbo = false;
  }

  function update(input) {
    const curMax = (input.turbo && fuel > 0 && turboCooldown <= 0) ? turboSpeed : maxSpeed;
    isTurbo = curMax === turboSpeed;

    if (isTurbo) {
      fuel = Math.max(0, fuel - 1.2);
      if (fuel <= 0) turboCooldown = 100;
    } else {
      fuel = Math.min(fuelMax, fuel + 0.18);
      if (turboCooldown > 0) turboCooldown--;
    }

    if (input.dx || input.dy) {
      const targetAngle = Math.atan2(input.dy, input.dx);
      angle = lerp(angle, targetAngle, 0.12);
      vx = lerp(vx, input.dx * curMax, 0.1);
      vy = lerp(vy, input.dy * curMax, 0.1);
    }

    vx *= friction; vy *= friction;
    x += vx; y += vy;

    // Wrap
    const m = 20;
    if (x < -m) x = W() + m; if (x > W() + m) x = -m;
    if (y < -m) y = H() + m; if (y > H() + m) y = -m;

    // Trail
    const speed = Math.hypot(vx, vy);
    if (speed > 0.8 && Math.random() > 0.4) {
      const col = isTurbo ? '#ff6600' : '#00aaff';
      Particles.createTrail(x - vx*2 + (Math.random()-0.5)*4, y - vy*2 + (Math.random()-0.5)*4, col);
      if (isTurbo) Particles.createTrail(x - vx*2, y - vy*2, '#ffaa00');
    }

    return { fuel: fuel/fuelMax, isTurbo, cooldown: turboCooldown/100 };
  }

  function render() {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    
    // Glow
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 25);
    glow.addColorStop(0, isTurbo ? 'rgba(255,100,0,0.4)' : 'rgba(0,170,255,0.3)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();

    // Body
    ctx.fillStyle = isTurbo ? '#ff8844' : '#4488cc';
    ctx.strokeStyle = isTurbo ? '#ffaa66' : '#66aaff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-7, -9); ctx.lineTo(-3, -3.5);
    ctx.lineTo(-11, -2.5); ctx.lineTo(-11, 2.5); ctx.lineTo(-3, 3.5); ctx.lineTo(-7, 9);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Cockpit
    ctx.fillStyle = isTurbo ? '#ffcc88' : '#88ccff';
    ctx.beginPath(); ctx.ellipse(3, 0, 4.5, 2.5, 0, 0, Math.PI*2); ctx.fill();

    // Engine flame
    const flameLen = isTurbo ? 8 + Math.random()*6 : 3 + Math.random()*3;
    ctx.fillStyle = isTurbo ? '#ff4400' : '#4488ff';
    ctx.beginPath(); ctx.moveTo(-11, -1.5); ctx.lineTo(-11-flameLen, 0); ctx.lineTo(-11, 1.5); ctx.closePath(); ctx.fill();

    ctx.restore();
  }

  function getBounds() { return { x, y, r: 10 }; }
  return { reset, update, render, getBounds };
})();

// --- Rockets ---
const Rocket = (() => {
  let list = [];
  let timer = 0, interval = 150, gameTime = 0;
  const baseSpeed = 2.8, maxSpeed = 5.5, turnRate = 0.032;

  function reset() { list = []; timer = 0; interval = 150; gameTime = 0; }

  function spawn(jx, jy) {
    if (list.length >= 18) return; // Mobile perf limit
    let rx, ry, side = Math.floor(Math.random()*4), margin = 40;
    switch(side) {
      case 0: rx = -margin; ry = Math.random()*H(); break;
      case 1: rx = W()+margin; ry = Math.random()*H(); break;
      case 2: rx = Math.random()*W(); ry = -margin; break;
      case 3: rx = Math.random()*W(); ry = H()+margin; break;
    }
    const a = angleTo(rx, ry, jx, jy);
    const spd = clamp(baseSpeed + gameTime*0.0001 + Math.random()*0.5, 0, maxSpeed);
    list.push({ x: rx, y: ry, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, angle: a, spd, turn: turnRate + (gameTime>500?0.01:0), trail: [], alive: true });
    AudioSys.playLaunch();
  }

  function update(jx, jy) {
    gameTime++;
    interval = Math.max(45, 150 - gameTime*0.08);
    timer++;
    if (timer >= interval) { timer = 0; spawn(jx, jy); }

    for (let i = list.length-1; i >= 0; i--) {
      const r = list[i]; if (!r.alive) continue;
      const ta = angleTo(r.x, r.y, jx, jy);
      r.angle += clamp(angleDiff(r.angle, ta), -r.turn, r.turn);
      r.vx = Math.cos(r.angle)*r.spd; r.vy = Math.sin(r.angle)*r.spd;
      r.x += r.vx; r.y += r.vy;

      r.trail.push({x: r.x, y: r.y, life: 1});
      if (r.trail.length > 12) r.trail.shift();
      for (const t of r.trail) t.life -= 0.08;
      r.trail = r.trail.filter(t => t.life > 0);

      if (r.x < -250 || r.x > W()+250 || r.y < -250 || r.y > H()+250) list.splice(i, 1);
    }
  }

  function checkCollisions(jetBounds) {
    // Rocket vs Rocket
    for (let i = 0; i < list.length; i++) {
      for (let j = i+1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!a.alive || !b.alive) continue;
        if (dist(a.x, a.y, b.x, b.y) < 14) {
          a.alive = b.alive = false;
          const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
          Particles.createExplosion(mx, my, 25, '#ff8800', 4);
          Particles.createExplosion(mx, my, 10, '#ffff00', 2);
          AudioSys.playExplosion(); ScreenShake.trigger(5);
          list.splice(j, 1); list.splice(i, 1);
          break;
        }
      }
    }
    // Rocket vs Jet
    for (const r of list) {
      if (r.alive && dist(r.x, r.y, jetBounds.x, jetBounds.y) < jetBounds.r + 6) return true;
    }
    return false;
  }

  function render() {
    for (const r of list) {
      if (!r.alive) continue;
      // Trail
      for (const t of r.trail) {
        ctx.globalAlpha = t.life * 0.5; ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(t.x, t.y, 2*t.life, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Glow
      ctx.globalAlpha = 0.25;
      const g = ctx.createRadialGradient(r.x, r.y, 2, r.x, r.y, 14);
      g.addColorStop(0, 'rgba(255,60,0,0.6)'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, 14, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.angle);
      ctx.fillStyle = '#ff2200'; ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-5,-3.5); ctx.lineTo(-7,-2.5); ctx.lineTo(-7,2.5); ctx.lineTo(-5,3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.moveTo(-7,-1.5); ctx.lineTo(-7-3-Math.random()*4, 0); ctx.lineTo(-7,1.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  return { reset, update, render, checkCollisions };
})();

// --- Game State ---
let state = 'menu', score = 0, scoreTimer = 0, gameOver = false;
const uiScore = document.getElementById('score-display');
const uiFuel = document.getElementById('fuel-bar');
const uiCooldown = document.getElementById('cooldown-indicator');
const screenStart = document.getElementById('start-screen');
const screenEnd = document.getElementById('game-over-screen');
const uiFinalScore = document.getElementById('final-score');

function startGame() {
  AudioSys.init();
  state = 'playing'; score = 0; scoreTimer = 0; gameOver = false;
  Jet.reset(); Rocket.reset(); Particles.clear(); Background.init();
  screenStart.classList.add('hide'); screenEnd.classList.add('hide');
}

function endGame() {
  if (gameOver) return;
  gameOver = true; state = 'gameover';
  uiFinalScore.textContent = `SCORE: ${Math.floor(score)}`;
  const b = Jet.getBounds();
  Particles.createExplosion(b.x, b.y, 50, '#ff4400', 5);
  Particles.createExplosion(b.x, b.y, 25, '#ffff00', 3);
  ScreenShake.trigger(12); AudioSys.playExplosion();
  setTimeout(() => screenEnd.classList.remove('hide'), 700);
}

document.getElementById('start-btn').addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, { passive: false });
document.getElementById('restart-btn').addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, { passive: false });

// --- Main Loop ---
function loop() {
  ScreenShake.update();
  const sh = ScreenShake.getOffset();

  if (state === 'playing') {
    const input = Input.getInput();
    const jStat = Jet.update(input);
    Rocket.update(Jet.getBounds().x, Jet.getBounds().y);
    Rocket.checkCollisions(Jet.getBounds());

    if (Rocket.checkCollisions(Jet.getBounds())) endGame();

    scoreTimer++; score += 0.08 + (scoreTimer * 0.0001);
    uiScore.textContent = `SCORE: ${Math.floor(score)}`;
    uiFuel.style.width = `${jStat.fuel * 100}%`;
    uiFuel.style.background = jStat.fuel < 0.2 ? 'linear-gradient(90deg,#ff0000,#ff4400)' : 'linear-gradient(90deg,#ff6600,#ffcc00,#00ff88)';
    
    if (jStat.cooldown > 0) {
      uiCooldown.classList.add('active');
      uiCooldown.textContent = `⚡ COOLDOWN ${Math.ceil(jStat.cooldown*100)}%`;
    } else {
      uiCooldown.classList.remove('active');
    }

    Particles.update();
    Background.update();
  } else if (state === 'gameover') {
    Particles.update();
    Background.update();
  } else {
    Background.update();
  }

  // Render
  ctx.save(); ctx.translate(sh.x, sh.y);
  Background.render();
  if (state !== 'menu') {
    Particles.render();
    Rocket.render();
    if (state === 'playing') Jet.render();
    // Joystick visual
    const j = Input.joystick;
    if (j.active) {
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(j.startX, j.startY, 45, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(j.startX, j.startY, 45, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#00ccff';
      ctx.beginPath(); ctx.arc(j.startX + j.dx*45, j.startY + j.dy*45, 18, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  requestAnimationFrame(loop);
}

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

loop();