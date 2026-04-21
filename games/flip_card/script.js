// ===== AUDIO ENGINE =====
const AudioEngine = (() => {
  let ctx;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };
  const playTone = (freq, duration, type = 'sine', vol = 0.15) => {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch(e) {}
  };
  return {
    flip: () => playTone(600, 0.08, 'sine', 0.1),
    match: () => { playTone(523, 0.1, 'sine', 0.12); setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 80); setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 160); },
    combo: () => { playTone(600, 0.08, 'sine', 0.12); setTimeout(() => playTone(800, 0.08, 'sine', 0.12), 60); setTimeout(() => playTone(1000, 0.08, 'sine', 0.12), 120); setTimeout(() => playTone(1200, 0.15, 'sine', 0.12), 180); },
    wrong: () => { playTone(200, 0.15, 'square', 0.08); setTimeout(() => playTone(150, 0.2, 'square', 0.08), 100); },
    win: () => { [523,587,659,698,784,880,988,1047].forEach((n,i) => setTimeout(() => playTone(n, 0.2, 'sine', 0.1), i*80)); }
  };
})();

// ===== CONFIG & STATE =====
const LEVELS = {
  easy:   { cols: 4, rows: 4 },
  medium: { cols: 5, rows: 4 },
  hard:   { cols: 6, rows: 6 }
};

const ICONS = [
  '🍎','🍊','🍋','🍇','🍓','🍒','🥝','🍑','🫐','🥭','🍌','🥥','🍍','🥑','🫒','🌽',
  '🍆','🥕','🧄','🧅','🍅','🥦','🍄','🌶️','🕐','🕑','🕒','🕓','🕔','🕕','⭐','🌙',
  '🌞','🌈','🦋','🐝','🐞','🐢','🐬','🦊','🐼','🐨','🐯','🦁','🐸','🐙','🦄','🎈'
];

let state = {
  level: 'easy',
  cards: [],
  flipped: [],
  matched: [],
  moves: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  timer: 0,
  timerInterval: null,
  isRunning: false,
  isPaused: false,
  totalPairs: 0,
  foundPairs: 0,
  locked: false
};

// ===== DOM =====
const $ = id => document.getElementById(id);
const menuPage = $('menuPage');
const gamePage = $('gamePage');
const gridEl = $('grid');
const movesEl = $('movesDisplay');
const scoreEl = $('scoreDisplay');
const comboEl = $('comboDisplay');
const bestEl = $('bestDisplay');
const timerEl = $('timer');
const menuBestEl = $('menuBestScores');

// ===== INIT & NAVIGATION =====
function init() {
  setupEventListeners();
  updateMenuBestScores();
}

function setupEventListeners() {
  // Menu level buttons
  document.querySelectorAll('.menu-level-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.level));
  });

  // Back / Menu buttons
  $('btnBack').addEventListener('click', backToMenu);
  $('btnMainMenu').addEventListener('click', backToMenu);
  $('btnPauseMenu').addEventListener('click', () => { closePause(); backToMenu(); });

  // Pause controls
  $('btnPause').addEventListener('click', togglePause);
  $('btnResume').addEventListener('click', togglePause);
  $('btnPauseRestart').addEventListener('click', () => { closePause(); startGame(state.level); });

  // Modal buttons
  $('btnReplay').addEventListener('click', () => { $('winModal').classList.remove('show'); startGame(state.level); });
}

function showPage(page) {
  menuPage.classList.toggle('active', page === 'menu');
  gamePage.classList.toggle('active', page === 'game');
}

function backToMenu() {
  stopTimer();
  state.isRunning = false;
  state.isPaused = false;
  closePause();
  $('winModal').classList.remove('show');
  showPage('menu');
  updateMenuBestScores();
}

function startGame(level) {
  const config = LEVELS[level];
  state.level = level;
  state.cards = [];
  state.flipped = [];
  state.matched = [];
  state.moves = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.timer = 0;
  state.isRunning = false;
  state.isPaused = false;
  state.totalPairs = (config.cols * config.rows) / 2;
  state.foundPairs = 0;
  state.locked = false;

  // Prepare cards
  const shuffledIcons = [...ICONS].sort(() => Math.random() - 0.5).slice(0, state.totalPairs);
  const cardPairs = [...shuffledIcons, ...shuffledIcons];
  state.cards = shuffleArray(cardPairs.map((icon, i) => ({ id: i, icon, flipped: false, matched: false })));

  // Build grid
  gridEl.className = `grid g${config.cols}x${config.rows}`;
  gridEl.innerHTML = '';
  state.cards.forEach((card, index) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.index = index;
    el.style.animationDelay = `${index * 0.025}s`;
    el.innerHTML = `<div class="card-inner"><div class="card-face card-front"></div><div class="card-face card-back">${card.icon}</div></div>`;
    el.addEventListener('click', () => handleCardClick(index));
    gridEl.appendChild(el);
  });

  updateUI();
  timerEl.textContent = '⏱️ 00:00';
  showPage('game');
}

// ===== GAMEPLAY =====
function handleCardClick(index) {
  const card = state.cards[index];
  if (!card || card.flipped || card.matched || state.locked || state.isPaused) return;

  if (!state.isRunning) {
    state.isRunning = true;
    startTimer();
  }

  AudioEngine.flip();
  card.flipped = true;
  state.flipped.push(index);
  gridEl.children[index].classList.add('flipped');

  if (state.flipped.length === 2) {
    state.locked = true;
    state.moves++;
    movesEl.textContent = state.moves;

    const [i1, i2] = state.flipped;
    const c1 = state.cards[i1], c2 = state.cards[i2];

    if (c1.icon === c2.icon) handleMatch(i1, i2);
    else handleMismatch(i1, i2);
  }
}

function handleMatch(i1, i2) {
  setTimeout(() => {
    state.cards[i1].matched = state.cards[i2].matched = true;
    state.foundPairs++;

    const e1 = gridEl.children[i1], e2 = gridEl.children[i2];
    e1.classList.add('matched');
    e2.classList.add('matched');

    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    let pts = 100 + (state.combo >= 2 ? state.combo * 25 : 0);
    state.score += pts;

    AudioEngine.match();
    if (state.combo >= 2) {
      AudioEngine.combo();
      showFloatingScore(e1, `🔥 ${state.combo}x`, 'combo-text', true);
    } else {
      showFloatingScore(e1, `+${pts}`, 'positive');
    }

    updateUI();
    state.flipped = [];
    state.locked = false;

    if (state.foundPairs === state.totalPairs) handleWin();
  }, 300);
}

function handleMismatch(i1, i2) {
  state.combo = 0;
  setTimeout(() => {
    const e1 = gridEl.children[i1], e2 = gridEl.children[i2];
    e1.classList.add('wrong');
    e2.classList.add('wrong');
    AudioEngine.wrong();

    setTimeout(() => {
      e1.classList.remove('flipped', 'wrong');
      e2.classList.remove('flipped', 'wrong');
      state.cards[i1].flipped = state.cards[i2].flipped = false;
      state.flipped = [];
      state.locked = false;
    }, 600);
  }, 400);
}

// ===== WIN & PAUSE =====
function handleWin() {
  stopTimer();
  state.isRunning = false;
  AudioEngine.win();
  spawnConfetti();

  const timeBonus = Math.max(0, 500 - state.timer * 2);
  state.score += timeBonus + (state.maxCombo >= 3 ? state.maxCombo * 50 : 0);
  updateUI();

  const currentBest = getBestScore();
  const isNew = state.score > currentBest;
  if (isNew) saveBestScore(state.score);

  setTimeout(() => {
    $('winTitle').textContent = state.level === 'hard' ? '🏆 Master!' : state.level === 'medium' ? '🌟 Amazing!' : '🎉 Level Complete!';
    $('winSubtitle').textContent = state.maxCombo >= 3 ? `Max Combo: ${state.maxCombo}x!` : 'All pairs found!';
    $('winTime').textContent = formatTime(state.timer);
    $('winMoves').textContent = state.moves;
    $('winScore').textContent = state.score;
    $('winBest').textContent = isNew ? state.score : currentBest;
    $('winNewRecord').style.display = isNew ? 'block' : 'none';
    $('winModal').classList.add('show');
  }, 700);
}

function togglePause() {
  if (state.foundPairs === state.totalPairs && state.totalPairs > 0) return;

  state.isPaused = !state.isPaused;
  $('pauseOverlay').classList.toggle('show', state.isPaused);

  if (state.isPaused) {
    stopTimer();
  } else {
    if (state.isRunning) {
      startTimer();
    }
  }
}

function closePause() {
  $('pauseOverlay').classList.remove('show');
  state.isPaused = false;
}

// ===== TIMER =====
function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    if (!state.isPaused) {
      state.timer++;
      timerEl.textContent = '⏱️ ' + formatTime(state.timer);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ===== UI HELPERS =====
function updateUI() {
  movesEl.textContent = state.moves;
  scoreEl.textContent = state.score;
  comboEl.innerHTML = state.combo >= 2 ? `<span class="combo-indicator">🔥 ${state.combo}x</span>` : (state.combo === 1 ? '1x' : '-');
  bestEl.textContent = getBestScore();
}

function updateMenuBestScores() {
  const levels = ['easy', 'medium', 'hard'];
  let html = '<h3>🏆 Best Scores</h3>';
  levels.forEach(lv => {
    const sc = getBestScore(lv);
    html += `<div class="best-row"><span>${lv.charAt(0).toUpperCase() + lv.slice(1)}</span><span>${sc}</span></div>`;
  });
  menuBestEl.innerHTML = html;
}

function showFloatingScore(el, text, cls, offsetX = false) {
  const rect = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float-score ${cls}`;
  d.textContent = text;
  d.style.left = (offsetX ? rect.right - 20 : rect.left + rect.width/2 - 20) + 'px';
  d.style.top = (rect.top - 10) + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

function spawnConfetti() {
  const colors = ['#ffd866','#ff6b6b','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#feca57'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animation = `confettiFall ${1.5 + Math.random()*1.5}s ease ${Math.random()*0.4}s forwards`;
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    p.style.width = (4 + Math.random()*6) + 'px';
    p.style.height = (4 + Math.random()*6) + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3500);
  }
}

// ===== STORAGE =====
function getBestScore(lv = state.level) {
  try { return parseInt(localStorage.getItem(`flipcard_best_${lv}`)) || 0; } catch { return 0; }
}
function saveBestScore(sc, lv = state.level) {
  try { localStorage.setItem(`flipcard_best_${lv}`, sc.toString()); } catch {}
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== START =====
init();