// ═══════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════
const G = {
  totalRounds: 5,
  difficulty: 'medium',
  currentRound: 0,
  target: 10.00,
  startTime: 0,
  elapsed: 0,
  running: false,
  frozen: false,
  raf: null,
  scores: [],
  totalScore: 0,
  combo: 0,
  comboMultiplier: 1,
  maxTarget: 0,
};

// ═══════════════════════════════════════
//  DOM REFS
// ═══════════════════════════════════════
const $ = id => document.getElementById(id);
const screens = { menu: $('screenMenu'), game: $('screenGame'), final: $('screenFinal') };
const timerDisplay = $('timerDisplay');
const timerProgress = $('timerProgress');
const timerStatus = $('timerStatus');
const btnFreeze = $('btnFreeze');
const resultOverlay = $('resultOverlay');

const CIRCUMFERENCE = 2 * Math.PI * 100; // 628.32

// ═══════════════════════════════════════
//  AUDIO (Web Audio API)
// ═══════════════════════════════════════
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playTone(freq, dur, type='sine', vol=.15) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxFreeze() { playTone(880, .15, 'sine', .12); setTimeout(()=>playTone(1320,.1,'sine',.08),80); }
function sfxTick() { playTone(600, .05, 'square', .04); }
function sfxPerfect() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,.2,'sine',.1),i*100)); }
function sfxGreat() { [523,659,784].forEach((f,i)=>setTimeout(()=>playTone(f,.15,'sine',.1),i*80)); }
function sfxOk() { playTone(440,.2,'sine',.08); }
function sfxBad() { playTone(220,.3,'sawtooth',.06); }
function sfxClick() { playTone(1000,.05,'sine',.06); }

// ═══════════════════════════════════════
//  TARGET GENERATION
// ═══════════════════════════════════════
function generateTarget() {
  const ranges = {
    easy:   { min: 5, max: 7 },
    medium: { min: 7, max: 10 },
    hard:   { min: 10, max: 15 },
  };
  const r = ranges[G.difficulty];
  let t;
  do {
    t = +(r.min + Math.random() * (r.max - r.min)).toFixed(2);
  } while (Math.abs(t - 10) < 0.5 && G.difficulty === 'hard'); // avoid too easy on hard
  return t;
}

// ═══════════════════════════════════════
//  SCREENS
// ═══════════════════════════════════════
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function backToMenu() {
  sfxClick();
  showScreen('menu');
}

// ═══════════════════════════════════════
//  START GAME
// ═══════════════════════════════════════
function startGame() {
  initAudio();
  sfxClick();
  G.totalRounds = parseInt($('selRounds').value);
  G.difficulty = $('selTarget').value;
  G.currentRound = 0;
  G.scores = [];
  G.totalScore = 0;
  G.combo = 0;
  G.comboMultiplier = 1;
  nextRound();
}

// ═══════════════════════════════════════
//  ROUND SETUP
// ═══════════════════════════════════════
function nextRound() {
  sfxClick();
  resultOverlay.classList.remove('active');
  showScreen('game');

  G.currentRound++;
  if (G.currentRound > G.totalRounds) {
    showFinal();
    return;
  }

  G.target = generateTarget();
  G.maxTarget = G.target + 5; // ring goes a bit past target
  G.running = false;
  G.frozen = false;
  G.elapsed = 0;

  // UI updates
  $('gameSubtitle').textContent = `Ronde ${G.currentRound} / ${G.totalRounds}`;
  $('roundTarget').textContent = G.target.toFixed(2) + 's';
  $('targetDisplay').innerHTML = G.target.toFixed(2) + '<span class="unit">s</span>';
  $('roundScore').textContent = G.totalScore;
  $('roundCombo').textContent = 'x' + G.comboMultiplier;
  btnFreeze.textContent = '❄️ FREEZE';
  btnFreeze.classList.remove('frozen');
  btnFreeze.disabled = false;
  timerStatus.textContent = 'BERSIAP...';
  timerStatus.style.color = 'var(--dim)';
  timerDisplay.innerHTML = '0.00<span class="ms">00</span>';

  // Progress ring
  timerProgress.style.strokeDashoffset = CIRCUMFERENCE;
  timerProgress.classList.remove('danger', 'perfect');

  // Round dots
  buildRoundDots();

  // Combo display
  updateComboDisplay();

  // Countdown then start
  startCountdown();
}

function buildRoundDots() {
  const container = $('roundProgress');
  container.innerHTML = '';
  for (let i = 1; i <= G.totalRounds; i++) {
    const dot = document.createElement('div');
    dot.className = 'round-dot';
    if (i < G.currentRound) dot.classList.add('done');
    if (i === G.currentRound) dot.classList.add('current');
    container.appendChild(dot);
  }
}

// ═══════════════════════════════════════
//  COUNTDOWN
// ═══════════════════════════════════════
function startCountdown() {
  let count = 3;
  timerStatus.textContent = count + '...';
  timerStatus.style.color = 'var(--accent)';
  playTone(440, .1, 'sine', .08);

  const iv = setInterval(() => {
    count--;
    if (count > 0) {
      timerStatus.textContent = count + '...';
      playTone(440, .1, 'sine', .08);
    } else if (count === 0) {
      timerStatus.textContent = 'MULAI!';
      timerStatus.style.color = 'var(--green)';
      playTone(880, .15, 'sine', .1);
    } else {
      clearInterval(iv);
      timerStatus.textContent = '⏱ BERJALAN...';
      timerStatus.style.color = 'var(--accent)';
      G.running = true;
      G.startTime = performance.now();
      tick();
    }
  }, 600);
}

// ═══════════════════════════════════════
//  TIMER TICK
// ═══════════════════════════════════════
function tick() {
  if (!G.running) return;

  const now = performance.now();
  G.elapsed = (now - G.startTime) / 1000;

  // Display
  const secs = Math.floor(G.elapsed);
  const ms = Math.floor((G.elapsed - secs) * 100);
  const msFull = Math.floor((G.elapsed - secs) * 1000);
  timerDisplay.innerHTML = secs + '.' + String(msFull).padStart(3, '0').slice(0, 2);

  // Ring progress
  const ratio = Math.min(G.elapsed / G.maxTarget, 1);
  const offset = CIRCUMFERENCE * (1 - ratio);
  timerProgress.style.strokeDashoffset = offset;

  // Color changes
  if (G.elapsed >= G.target - 0.5 && G.elapsed <= G.target + 0.5) {
    timerProgress.classList.add('perfect');
    timerProgress.classList.remove('danger');
  } else if (G.elapsed > G.target + 0.5) {
    timerProgress.classList.remove('perfect');
    timerProgress.classList.add('danger');
  } else {
    timerProgress.classList.remove('perfect', 'danger');
  }

  // Tick sound near target
  if (Math.abs(G.elapsed - G.target) < 0.3 && Math.abs(G.elapsed - G.target) > 0.01) {
    if (Math.floor(G.elapsed * 10) !== Math.floor((G.elapsed - 0.02) * 10)) {
      // sfxTick();
    }
  }

  G.raf = requestAnimationFrame(tick);
}

// ═══════════════════════════════════════
//  FREEZE
// ═══════════════════════════════════════
function freezeTime() {
  if (!G.running || G.frozen) return;
  G.frozen = true;
  G.running = false;
  cancelAnimationFrame(G.raf);

  sfxFreeze();

  // Visual effects
  btnFreeze.textContent = '⏱ TERBEKUKAN';
  btnFreeze.classList.add('frozen');
  btnFreeze.disabled = true;
  timerStatus.textContent = '⏱ TERBEKUKAN!';
  timerStatus.style.color = 'var(--accent)';

  // Freeze pulse
  const pulse = document.createElement('div');
  pulse.className = 'freeze-effect';
  $('screenGame').appendChild(pulse);
  setTimeout(() => pulse.remove(), 700);

  // Particles
  spawnParticles(20);

  // Show result after delay
  setTimeout(() => showResult(), 800);
}

// ═══════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════
function spawnParticles(count) {
  const rect = $('timerRing').getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 4 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 100;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${cx}px;top:${cy}px;
      background:${['var(--accent)','var(--accent2)','var(--gold)','var(--green)'][Math.floor(Math.random()*4)]};
      --tx:${tx}px;--ty:${ty}px;
      position:fixed;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

// ═══════════════════════════════════════
//  RESULT
// ═══════════════════════════════════════
function showResult() {
  const diff = Math.abs(G.elapsed - G.target);
  let score, icon, title, subtitle, sfx, diffClass;

  if (diff < 0.05) {
    score = 100; icon = '💎'; title = 'SEMPURNA!'; subtitle = 'Luar biasa! Nyaris tidak mungkin!';
    sfx = sfxPerfect; diffClass = 'great';
  } else if (diff < 0.15) {
    score = 80; icon = '🎯'; title = 'HEBAT!'; subtitle = 'Hampir sempurna!';
    sfx = sfxGreat; diffClass = 'great';
  } else if (diff < 0.35) {
    score = 60; icon = '👍'; title = 'BAGUS!'; subtitle = 'Lumayan dekat!';
    sfx = sfxOk; diffClass = 'good';
  } else if (diff < 0.7) {
    score = 40; icon = '😅'; title = 'CUKUP'; subtitle = 'Masih bisa lebih baik!';
    sfx = sfxOk; diffClass = 'ok';
  } else if (diff < 1.5) {
    score = 20; icon = '🤏'; title = 'JAUH...'; subtitle = 'Coba lagi di ronde berikutnya!';
    sfx = sfxBad; diffClass = 'bad';
  } else {
    score = 10; icon = '😵'; title = 'MELESET!'; subtitle = 'Terlauh jauh dari target!';
    sfx = sfxBad; diffClass = 'bad';
  }

  // Combo
  if (score >= 60) {
    G.combo++;
    G.comboMultiplier = Math.min(G.combo + 1, 5);
  } else {
    G.combo = 0;
    G.comboMultiplier = 1;
  }

  const finalScore = score * G.comboMultiplier;
  G.totalScore += finalScore;
  G.scores.push({ round: G.currentRound, target: G.target, elapsed: +G.elapsed.toFixed(2), diff: +diff.toFixed(2), score: finalScore, baseScore: score });

  sfx();

  // Populate result
  $('resultIcon').textContent = icon;
  $('resultTitle').textContent = title;
  $('resultSubtitle').textContent = subtitle;
  $('resultTime').textContent = G.elapsed.toFixed(2);
  $('resultTime').style.color = diffClass === 'great' ? 'var(--green)' : diffClass === 'good' ? 'var(--accent)' : diffClass === 'ok' ? 'var(--gold)' : 'var(--red)';
  $('resultTargetText').textContent = `Target: ${G.target.toFixed(2)}s`;
  $('resultDiff').textContent = `±${diff.toFixed(2)}s`;
  $('resultDiff').className = 'result-diff ' + diffClass;
  $('resultScore').textContent = finalScore + (G.comboMultiplier > 1 ? ` (x${G.comboMultiplier})` : '');

  // Scoreboard
  const sb = $('roundScoreboard');
  sb.innerHTML = '';
  G.scores.forEach(s => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="round">R${s.round}</span>
      <span class="time">${s.elapsed.toFixed(2)}s / ${s.target.toFixed(2)}s</span>
      <span class="score">${s.score}</span>
    `;
    sb.appendChild(row);
  });

  // Next button text
  const btn = $('btnNext');
  if (G.currentRound >= G.totalRounds) {
    btn.textContent = '🏆 LIHAT HASIL';
  } else {
    btn.textContent = 'RONDE BERIKUTNYA →';
  }

  resultOverlay.classList.add('active');
}

// ═══════════════════════════════════════
//  COMBO DISPLAY
// ═══════════════════════════════════════
function updateComboDisplay() {
  const el = $('comboDisplay');
  if (G.combo > 0) {
    el.textContent = `🔥 Combo x${G.comboMultiplier}!`;
    el.className = 'combo-display active';
  } else {
    el.textContent = '';
    el.className = 'combo-display';
  }
}

// ═══════════════════════════════════════
//  FINAL SCREEN
// ═══════════════════════════════════════
function showFinal() {
  showScreen('final');

  $('finalTotal').textContent = G.totalScore;

  // Save best
  const best = getBestScore();
  if (G.totalScore > best) {
    localStorage.setItem('tfd_best', G.totalScore);
    $('finalBest').innerHTML = `Skor Terbaik: <span>${G.totalScore} 🎉 REKOR BARU!</span>`;
  } else {
    $('finalBest').innerHTML = `Skor Terbaik: <span>${best}</span>`;
  }

  const container = $('finalScores');
  container.innerHTML = '';

  // Calculate and display best scores per round
  const bestScoresPerRound = G.scores.map(s => s.score).reduce((acc, score, index) => {
    acc[index + 1] = Math.max(acc[index + 1] || 0, score);
    return acc;
  }, {});

  G.scores.forEach(s => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="round">Ronde ${s.round}</span>
      <span class="time">${s.elapsed.toFixed(2)}s → ${s.target.toFixed(2)}s (±${s.diff}s)</span>
      <span class="score">${s.score} pts</span>
    `;
    container.appendChild(row);
  });

  // Display best scores per round
  Object.entries(bestScoresPerRound).forEach(([round, score]) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.color = 'var(--gold)';
    row.innerHTML = `
      <span class="round">Skor Terbaik Ronde ${round}</span>
      <span class="score">${score} pts</span>
    `;
    container.appendChild(row);
  });

  // Add average accuracy
  const avgDiff = (G.scores.reduce((a, s) => a + s.diff, 0) / G.scores.length).toFixed(2);
  const avgRow = document.createElement('div');
  avgRow.className = 'score-row';
  avgRow.style.borderTop = '1px solid rgba(255,255,255,.1)';
  avgRow.style.marginTop = '4px';
  avgRow.innerHTML = `
    <span class="round" style="color:var(--accent)">Rata-rata</span>
    <span class="time">Ketepatan: ±${avgDiff}s</span>
    <span class="score">${G.totalScore} pts</span>
  `;
  container.appendChild(avgRow);
}

function getBestScore() {
  return parseInt(localStorage.getItem('tfd_best') || '0');
}

function showBest() {
  initAudio();
  sfxClick();
  const best = getBestScore();
  alert(`🏆 Skor Terbaik: ${best}\n\nMain lagi untuk mengalahkan rekor!`);
}

// ═══════════════════════════════════════
//  PREVENT ZOOM / SCROLL
// ═══════════════════════════════════════
document.addEventListener('touchmove', e => { if (e.target.closest('.final-scores')) return; e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ═══════════════════════════════════════
//  KEYBOARD SUPPORT (desktop testing)
// ═══════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (G.running && !G.frozen) freezeTime();
  }
});

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