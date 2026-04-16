// ==================== GAME STATE ====================
const state = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  gameActive: true,
  mode: 'pvp',
  difficulty: 'medium',
  scores: { X: 0, O: 0, draw: 0 },
  soundEnabled: true,
  aiThinking: false,
  // Track placement order for sliding mechanic
  xHistory: [], // indices where X marks are placed (oldest first)
  oHistory: []  // indices where O marks are placed (oldest first)
};

const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// ==================== AUDIO ENGINE ====================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch(e) {
      console.log('Audio not supported');
    }
  }

  play(type) {
    if (!state.soundEnabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    switch(type) {
      case 'place': this._playPlace(); break;
      case 'remove': this._playRemove(); break;
      case 'win': this._playWin(); break;
      case 'draw': this._playDraw(); break;
      case 'click': this._playClick(); break;
      case 'start': this._playStart(); break;
    }
  }

  _osc(freq, type, duration, vol = 0.12, start = 0) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime + start);
    g.gain.setValueAtTime(vol, this.ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + start + duration);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(this.ctx.currentTime + start);
    o.stop(this.ctx.currentTime + start + duration);
  }

  _playPlace() {
    const base = state.currentPlayer === 'X' ? 587 : 494;
    this._osc(base, 'sine', 0.1, 0.1);
    this._osc(base * 1.5, 'sine', 0.06, 0.06, 0.04);
  }

  _playRemove() {
    this._osc(300, 'sine', 0.15, 0.08);
    this._osc(200, 'sine', 0.1, 0.05, 0.08);
  }

  _playWin() {
    [523, 659, 784, 1047].forEach((f, i) => {
      this._osc(f, 'sine', 0.25, 0.12, i * 0.1);
      this._osc(f * 1.5, 'triangle', 0.15, 0.05, i * 0.1 + 0.04);
    });
    setTimeout(() => {
      this._osc(1568, 'sine', 0.3, 0.06);
      this._osc(2093, 'sine', 0.25, 0.04, 0.1);
    }, 450);
  }

  _playDraw() {
    this._osc(330, 'sine', 0.25, 0.08);
    this._osc(290, 'sine', 0.25, 0.08, 0.12);
    this._osc(260, 'triangle', 0.35, 0.06, 0.24);
  }

  _playClick() {
    this._osc(700, 'sine', 0.04, 0.04);
  }

  _playStart() {
    this._osc(440, 'sine', 0.08, 0.08);
    this._osc(554, 'sine', 0.08, 0.08, 0.06);
    this._osc(659, 'sine', 0.12, 0.1, 0.12);
  }
}

const audio = new AudioEngine();

// ==================== PARTICLE SYSTEM ====================
class ParticleSystem {
  constructor() {
    this.canvas = document.getElementById('particleCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  explosion(x, y, count = 50, colors) {
    const c = colors || ['#6c5ce7','#a855f7','#fd79a8','#00cec9','#ff6b6b','#48dbfb','#feca57'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 4,
        color: c[Math.floor(Math.random() * c.length)],
        life: 1,
        decay: 0.01 + Math.random() * 0.012,
        type: Math.random() > 0.5 ? 'circle' : 'square',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.08
      });
    }
    if (!this.running) { this.running = true; this.animate(); }
  }

  confetti(count = 60) {
    const colors = ['#6c5ce7','#a855f7','#fd79a8','#00cec9','#ff6b6b','#48dbfb','#feca57','#54a0ff'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 3,
        vy: 1 + Math.random() * 2.5,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.003 + Math.random() * 0.004,
        type: 'rect',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.12,
        gravity: 0.015,
        wobble: Math.random() * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03
      });
    }
    if (!this.running) { this.running = true; this.animate(); }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.particles.length === 0) { this.running = false; return; }

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;
      if (p.wobble) p.vx += Math.sin(p.y * p.wobbleSpeed) * 0.1;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.fillStyle = p.color;

      if (p.type === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size * p.life, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        const s = p.size * p.life;
        this.ctx.fillRect(-s/2, -s/2, s, s * 0.5);
      }
      this.ctx.restore();
    });

    requestAnimationFrame(() => this.animate());
  }
}

const particles = new ParticleSystem();

// ==================== BACKGROUND PARTICLES ====================
function createBgParticles() {
  const container = document.getElementById('bgParticles');
  const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'bg-particle';
    const size = 3 + Math.random() * 6;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (12 + Math.random() * 18) + 's';
    p.style.animationDelay = -(Math.random() * 20) + 's';
    container.appendChild(p);
  }
}

// ==================== UI HELPERS ====================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function updateStatus(text, type = '') {
  const el = document.getElementById('statusText');
  el.textContent = text;
  el.className = 'status-text' + (type ? ' ' + type : '');
}

function updateMenuScores() {
  document.getElementById('menuScoreX').textContent = state.scores.X;
  document.getElementById('menuScoreO').textContent = state.scores.O;
  document.getElementById('menuScoreD').textContent = state.scores.draw;

  if (state.mode === 'ai') {
    document.getElementById('menuOLabel').textContent = '🤖 AI Menang';
  } else {
    document.getElementById('menuOLabel').textContent = '◯ Menang';
  }
}

function showScoreOverlay() {
  updateMenuScores();

  const overlay = document.getElementById('scoreOverlay');
  const lastWinner = state.lastWinner;

  if (lastWinner === 'X') {
    document.getElementById('resultIcon').textContent = '🎉';
    document.getElementById('resultTitle').textContent = state.mode === 'ai' ? 'Kamu Menang!' : 'Player X Menang!';
    document.getElementById('resultText').textContent = 'Selamat! Permainan yang luar biasa!';
  } else if (lastWinner === 'O') {
    document.getElementById('resultIcon').textContent = state.mode === 'ai' ? '🤖' : '🎉';
    document.getElementById('resultTitle').textContent = state.mode === 'ai' ? 'AI Menang!' : 'Player O Menang!';
    document.getElementById('resultText').textContent = state.mode === 'ai' ? 'Coba lagi untuk mengalahkan AI!' : 'Permainan yang seru!';
  } else {
    document.getElementById('resultIcon').textContent = '🤝';
    document.getElementById('resultTitle').textContent = 'Seri!';
    document.getElementById('resultText').textContent = 'Kedua pemain sama kuatnya!';
  }

  document.getElementById('sgX').textContent = state.scores.X;
  document.getElementById('sgO').textContent = state.scores.O;
  document.getElementById('sgD').textContent = state.scores.draw;

  if (state.mode === 'ai') {
    document.getElementById('sgOLabel').textContent = '🤖 AI';
  } else {
    document.getElementById('sgOLabel').textContent = '◯ Menang';
  }

  overlay.classList.add('show');
}

function hideScoreOverlay() {
  document.getElementById('scoreOverlay').classList.remove('show');
}

// ==================== SVG MARKS ====================
function createXSVG() {
  return `<div class="mark-container"><svg class="x-mark" viewBox="0 0 60 60">
    <line x1="12" y1="12" x2="48" y2="48"/>
    <line x1="48" y1="12" x2="12" y2="48"/>
  </svg></div>`;
}

function createOSVG() {
  return `<div class="mark-container"><svg class="o-mark" viewBox="0 0 60 60">
    <circle cx="30" cy="30" r="19"/>
  </svg></div>`;
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function startGame() {
  audio.init();
  audio.play('start');
  showScreen('gameScreen');
  resetGame();
}

function goToMenu() {
  audio.init();
  audio.play('click');
  hideScoreOverlay();
  state.gameActive = false;
  state.aiThinking = false;
  updateMenuScores();
  showScreen('menuScreen');
}

function playAgain() {
  audio.init();
  audio.play('click');
  hideScoreOverlay();
  resetGame();
}

// ==================== CLOSE GUIDE ====================
function closeGuide() {
  audio.init();
  audio.play('click');
  document.getElementById('guideOverlay').classList.remove('show');
  localStorage.setItem('ttt_visited_v2', 'true');
}

// ==================== GAME LOGIC ====================
function handleCellClick(index) {
  audio.init();

  if (!state.gameActive || state.board[index] !== null || state.aiThinking) {
    audio.play('remove'); // reusing as error-ish sound
    return;
  }

  makeMove(index);

  if (state.mode === 'ai' && state.gameActive && state.currentPlayer === 'O') {
    state.aiThinking = true;
    updateStatus('AI berpikir<span class="thinking"><span></span><span></span><span></span></span>', '');

    const delay = 300 + Math.random() * 400;
    setTimeout(() => {
      const aiMove = getAIMove();
      if (aiMove !== -1) {
        makeMove(aiMove);
      }
      state.aiThinking = false;
    }, delay);
  }
}

function makeMove(index) {
  const player = state.currentPlayer;
  const history = player === 'X' ? state.xHistory : state.oHistory;

  // Add new mark
  state.board[index] = player;
  history.push(index);

  // Sliding mechanic: if more than 3, remove oldest
  let removedIndex = -1;
  if (history.length > 3) {
    removedIndex = history.shift();
    state.board[removedIndex] = null;

    // Animate removal
    const removedCell = document.querySelectorAll('.cell')[removedIndex];
    removedCell.classList.add('removing');
    audio.play('remove');

    setTimeout(() => {
      removedCell.innerHTML = '';
      removedCell.classList.remove('taken', 'removing');
    }, 300);
  }

  // Place new mark
  const cell = document.querySelectorAll('.cell')[index];
  cell.innerHTML = player === 'X' ? createXSVG() : createOSVG();
  cell.classList.add('taken');
  cell.classList.remove('removing');

  audio.play('place');
  if (navigator.vibrate) navigator.vibrate(15);

  // Check win after a brief delay to allow removal animation
  setTimeout(() => {
    const winCombo = checkWin(player);
    if (winCombo) {
      handleWin(player, winCombo);
      return;
    }

    // Switch player
    state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
    updateTurnStatus();
  }, removedIndex !== -1 ? 320 : 0);
}

function checkWin(player) {
  for (const combo of WIN_COMBOS) {
    if (combo.every(i => state.board[i] === player)) {
      return combo;
    }
  }
  return null;
}

function updateTurnStatus() {
  const mark = state.currentPlayer === 'X' ? '✕' : '◯';
  const name = (state.mode === 'ai' && state.currentPlayer === 'O') ? 'AI' : mark;
  updateStatus(`Giliran ${name}`);
}

function handleWin(player, combo) {
  state.gameActive = false;
  state.lastWinner = player;
  state.scores[player]++;

  combo.forEach(i => {
    document.querySelectorAll('.cell')[i].classList.add('win-cell');
  });

  drawWinLine(combo);

  const name = state.mode === 'ai'
    ? (player === 'X' ? 'Kamu Menang! 🎉' : 'AI Menang! 🤖')
    : `Player ${player} Menang! 🎉`;
  updateStatus(name, 'winner');

  audio.play('win');
  if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);

  const board = document.getElementById('board');
  const rect = board.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const winColors = player === 'X'
    ? ['#ff6b6b','#ee5a24','#ff9ff3','#feca57']
    : ['#48dbfb','#0abde3','#54a0ff','#5f27cd'];

  setTimeout(() => particles.explosion(cx, cy, 45, winColors), 200);
  setTimeout(() => particles.confetti(35), 500);

  setTimeout(() => showScoreOverlay(), 1200);
}

function handleDraw() {
  state.gameActive = false;
  state.lastWinner = 'draw';
  state.scores.draw++;
  updateStatus('Seri! 🤝', 'draw');
  audio.play('draw');
  if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
  setTimeout(() => showScoreOverlay(), 800);
}

function drawWinLine(combo) {
  const overlay = document.getElementById('winLineOverlay');
  const line = document.getElementById('winLine');
  const board = document.getElementById('board');

  // Fixed: board padding is 10px, so content area starts at 10
  // Cell size depends on board size. We'll calculate based on actual cell positions
  const cells = document.querySelectorAll('.cell');
  const boardRect = board.getBoundingClientRect();

  const getCellCenter = (idx) => {
    const cell = cells[idx];
    const cellRect = cell.getBoundingClientRect();
    return {
      x: cellRect.left - boardRect.left + cellRect.width / 2 - 10, // -10 for padding
      y: cellRect.top - boardRect.top + cellRect.height / 2 - 10
    };
  };

  const start = getCellCenter(combo[0]);
  const end = getCellCenter(combo[2]);

  // Update viewBox to match actual board content size
  const contentSize = boardRect.width - 20;
  overlay.setAttribute('viewBox', `0 0 ${contentSize} ${contentSize}`);

  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', end.x);
  line.setAttribute('y2', end.y);

  overlay.style.display = 'block';
}

// ==================== AI LOGIC ====================
function getAIMove() {
  const available = state.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
  if (available.length === 0) return -1;

  switch(state.difficulty) {
    case 'easy': return aiEasy(available);
    case 'medium': return aiMedium(available);
    case 'hard': return aiHard();
    default: return aiMedium(available);
  }
}

function aiEasy(available) {
  if (Math.random() < 0.7) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return aiHard();
}

function aiMedium(available) {
  if (Math.random() < 0.4) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return aiHard();
}

function aiHard() {
  let bestScore = -Infinity;
  let bestMove = -1;

  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) {
      state.board[i] = 'O';
      const score = minimax(state.board, 0, false, -Infinity, Infinity);
      state.board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function minimax(board, depth, isMaximizing, alpha, beta) {
  if (checkWinFor(board, 'O')) return 10 - depth;
  if (checkWinFor(board, 'X')) return depth - 10;
  if (board.every(c => c !== null)) return 0;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        const eval_ = minimax(board, depth + 1, false, alpha, beta);
        board[i] = null;
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        const eval_ = minimax(board, depth + 1, true, alpha, beta);
        board[i] = null;
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break;
      }
    }
    return minEval;
  }
}

function checkWinFor(board, player) {
  return WIN_COMBOS.some(combo => combo.every(i => board[i] === player));
}

// ==================== RESET ====================
function resetGame() {
  audio.init();
  audio.play('start');

  state.board = Array(9).fill(null);
  state.currentPlayer = 'X';
  state.gameActive = true;
  state.aiThinking = false;
  state.xHistory = [];
  state.oHistory = [];
  state.lastWinner = null;

  document.querySelectorAll('.cell').forEach(cell => {
    cell.innerHTML = '';
    cell.classList.remove('taken', 'win-cell', 'removing');
  });

  document.getElementById('winLineOverlay').style.display = 'none';
  updateTurnStatus();

  if (navigator.vibrate) navigator.vibrate(10);
}

// ==================== MODE & DIFFICULTY ====================
function setMode(mode) {
  audio.init();
  audio.play('click');
  state.mode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const diffBar = document.getElementById('difficultyBar');
  diffBar.classList.toggle('hidden', mode !== 'ai');

  updateMenuScores();
}

function setDifficulty(diff) {
  audio.init();
  audio.play('click');
  state.difficulty = diff;

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === diff);
  });
}

// ==================== RIPPLE EFFECT ====================
document.querySelectorAll('.cell').forEach(cell => {
  cell.addEventListener('click', function(e) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });
});

// ==================== SOUND TOGGLE ====================
document.getElementById('soundToggle').addEventListener('click', function() {
  audio.init();
  state.soundEnabled = !state.soundEnabled;
  this.textContent = state.soundEnabled ? '🔊' : '🔇';
  this.classList.toggle('muted', !state.soundEnabled);
  if (state.soundEnabled) audio.play('click');
});

// ==================== CHECK DRAW (after sliding) ====================
// Override: we need to check for draw condition considering sliding
// A draw happens when all cells are filled AND no win is possible
// Since marks can slide, a "draw" is when the board is full and no one can win
// We'll check after each move if the board is full (9 cells)
// But since we have sliding, the board can never be "permanently" full with 9 marks
// Actually with sliding, each player max has 3 marks, so max 6 marks on board
// Draw means: no win possible AND the game has gone on long enough
// Let's say: if both players have 3 marks on board (total 6) and no win, it continues
// Draw only when the game reaches a stalemate state
// For simplicity: if both have 3 marks and we've cycled through many moves without winner
// Let's use: if total moves > 12 and no win, declare draw

// We need to track total moves
let totalMoves = 0;

// Override makeMove to track total moves
const originalMakeMove = makeMove;

// Actually, let's just add a move counter
function resetGame() {
  audio.init();
  audio.play('start');

  state.board = Array(9).fill(null);
  state.currentPlayer = 'X';
  state.gameActive = true;
  state.aiThinking = false;
  state.xHistory = [];
  state.oHistory = [];
  state.lastWinner = null;
  totalMoves = 0;

  document.querySelectorAll('.cell').forEach(cell => {
    cell.innerHTML = '';
    cell.classList.remove('taken', 'win-cell', 'removing');
  });

  document.getElementById('winLineOverlay').style.display = 'none';
  updateTurnStatus();

  if (navigator.vibrate) navigator.vibrate(10);
}

// Redefine makeMove with draw check
function makeMove(index) {
  const player = state.currentPlayer;
  const history = player === 'X' ? state.xHistory : state.oHistory;

  state.board[index] = player;
  history.push(index);
  totalMoves++;

  let removedIndex = -1;
  if (history.length > 3) {
    removedIndex = history.shift();
    state.board[removedIndex] = null;

    const removedCell = document.querySelectorAll('.cell')[removedIndex];
    removedCell.classList.add('removing');
    audio.play('remove');

    setTimeout(() => {
      removedCell.innerHTML = '';
      removedCell.classList.remove('taken', 'removing');
    }, 300);
  }

  const cell = document.querySelectorAll('.cell')[index];
  cell.innerHTML = player === 'X' ? createXSVG() : createOSVG();
  cell.classList.add('taken');
  cell.classList.remove('removing');

  audio.play('place');
  if (navigator.vibrate) navigator.vibrate(15);

  setTimeout(() => {
    const winCombo = checkWin(player);
    if (winCombo) {
      handleWin(player, winCombo);
      return;
    }

    // Check draw: if many cycles passed without win
    if (totalMoves >= 50) {
      handleDraw();
      return;
    }

    state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
    updateTurnStatus();

    // Continue AI
    if (state.mode === 'ai' && state.gameActive && state.currentPlayer === 'O') {
      state.aiThinking = true;
      updateStatus('Computer turn', '');

      const delay = 300 + Math.random() * 400;
      setTimeout(() => {
        const aiMove = getAIMove();
        if (aiMove !== -1) {
          makeMove(aiMove);
        }
        state.aiThinking = false;
      }, delay);
    }
  }, removedIndex !== -1 ? 320 : 0);
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

// ==================== INIT ====================
function init() {
  createBgParticles();
  updateMenuScores();

  if (!localStorage.getItem('ttt_visited_v2')) {
    setTimeout(() => {
      document.getElementById('guideOverlay').classList.add('show');
    }, 400);
  }
}

init();