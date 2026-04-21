// ===== AUDIO ENGINE =====
const AudioEngine = (() => {
  let ctx;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playTone = (freq, duration, type = 'square', vol = 0.1) => {
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
    click: () => playTone(800, 0.06, 'sine', 0.08),
    open: () => { playTone(600, 0.08, 'sine', 0.06); playTone(900, 0.06, 'sine', 0.04); },
    flag: () => { playTone(500, 0.1, 'triangle', 0.08); playTone(700, 0.1, 'triangle', 0.06); },
    unflag: () => playTone(400, 0.12, 'triangle', 0.07),
    explode: () => {
      try {
        const c = getCtx();
        const bufferSize = c.sampleRate * 0.4;
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const source = c.createBufferSource();
        source.buffer = buffer;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.25, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, c.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.4);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(c.destination);
        source.start();
      } catch(e) {}
    },
    win: () => {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 0.3, 'sine', 0.1), i * 120);
      });
    }
  };
})();

// ===== VIBRATION =====
const Vibrate = {
  light: () => { try { navigator.vibrate && navigator.vibrate(15); } catch(e) {} },
  strong: () => { try { navigator.vibrate && navigator.vibrate([100, 50, 100, 50, 200]); } catch(e) {} },
  win: () => { try { navigator.vibrate && navigator.vibrate([50, 30, 50, 30, 100]); } catch(e) {} }
};

// ===== CONFETTI =====
const Confetti = (() => {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();

  const colors = ['#6c5ce7','#a29bfe','#fd79a8','#fdcb6e','#00cec9','#e17055','#2ecc71','#3498db'];

  const create = () => {
    particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: Math.random() * -18 - 4,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.35 + Math.random() * 0.15,
        opacity: 1,
        decay: 0.005 + Math.random() * 0.008
      });
    }
    animate();
  };

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;
      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
    });
    if (alive) {
      animId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const stop = () => {
    cancelAnimationFrame(animId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
  };

  return { create, stop };
})();

// ===== GAME =====
const LEVELS = {
  easy:   { rows: 8,  cols: 8,  mines: 5 },
  medium: { rows: 12, cols: 12, mines: 10 },
  hard:   { rows: 16, cols: 16, mines: 20 }
};

let currentLevel = 'easy';
let board = [];       // 2D: { mine, open, flagged, adjacent }
let rows, cols, totalMines;
let gameOver = false;
let gameStarted = false;
let firstClick = true;
let flagCount = 0;
let openedCount = 0;
let timerInterval = null;
let seconds = 0;
let flagMode = false;
let longPressTimer = null;
let isLongPress = false;

const gridEl = document.getElementById('grid');
const bombCountEl = document.getElementById('bomb-count');
const timerEl = document.getElementById('timer');
const overlayEl = document.getElementById('overlay');
const overlayEmoji = document.getElementById('overlay-emoji');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayBtn = document.getElementById('overlay-btn');
const btnRestart = document.getElementById('btn-restart');
const btnFlagMode = document.getElementById('btn-flag-mode');
const levelBtns = document.querySelectorAll('.level-btn');

// ===== INIT =====
function initGame(level) {
  currentLevel = level;
  const cfg = LEVELS[level];
  rows = cfg.rows;
  cols = cfg.cols;
  totalMines = cfg.mines;

  board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = { mine: false, open: false, flagged: false, adjacent: 0 };
    }
  }

  gameOver = false;
  gameStarted = false;
  firstClick = true;
  flagCount = 0;
  openedCount = 0;
  seconds = 0;
  stopTimer();
  updateTimer();
  updateBombCount();
  overlayEl.classList.remove('show');
  Confetti.stop();

  // Remove red flash
  document.querySelectorAll('.red-flash').forEach(el => el.remove());

  buildGrid();
}

function buildGrid() {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.r = r;
      tile.dataset.c = c;

      // Touch events
      tile.addEventListener('touchstart', handleTouchStart, { passive: false });
      tile.addEventListener('touchend', handleTouchEnd, { passive: false });
      tile.addEventListener('touchmove', handleTouchMove, { passive: false });
      tile.addEventListener('touchcancel', handleTouchCancel, { passive: false });

      // Mouse fallback
      tile.addEventListener('mousedown', handleMouseDown);
      tile.addEventListener('mouseup', handleMouseUp);
      tile.addEventListener('contextmenu', e => e.preventDefault());

      gridEl.appendChild(tile);
    }
  }
}

function placeMines(safeR, safeC) {
  // Create safe zone around first click
  const safeZone = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr, nc = safeC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeZone.add(nr * cols + nc);
      }
    }
  }

  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const idx = r * cols + c;
    if (!board[r][c].mine && !safeZone.has(idx)) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Calculate adjacents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
            count++;
          }
        }
      }
      board[r][c].adjacent = count;
    }
  }
}

// ===== TOUCH HANDLING =====
function handleTouchStart(e) {
  if (gameOver) return;
  e.preventDefault();
  isLongPress = false;
  const tile = e.currentTarget;
  const r = +tile.dataset.r, c = +tile.dataset.c;

  longPressTimer = setTimeout(() => {
    isLongPress = true;
    Vibrate.light();
    toggleFlag(r, c);
  }, 400);
}

function handleTouchEnd(e) {
  if (gameOver) return;
  e.preventDefault();
  clearTimeout(longPressTimer);
  if (!isLongPress) {
    const tile = e.currentTarget;
    const r = +tile.dataset.r, c = +tile.dataset.c;
    handleTap(r, c);
  }
}

function handleTouchMove(e) {
  clearTimeout(longPressTimer);
}

function handleTouchCancel(e) {
  clearTimeout(longPressTimer);
}

// Mouse fallback
let mouseDownPos = null;
function handleMouseDown(e) {
  if (gameOver) return;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  longPressTimer = setTimeout(() => {
    isLongPress = true;
    Vibrate.light();
    const tile = e.currentTarget;
    const r = +tile.dataset.r, c = +tile.dataset.c;
    toggleFlag(r, c);
  }, 400);
}

function handleMouseUp(e) {
  if (gameOver) return;
  clearTimeout(longPressTimer);
  if (isLongPress) {
    isLongPress = false;
    return;
  }
  if (e.button === 2) {
    const tile = e.currentTarget;
    const r = +tile.dataset.r, c = +tile.dataset.c;
    toggleFlag(r, c);
    return;
  }
  if (!isLongPress) {
    const tile = e.currentTarget;
    const r = +tile.dataset.r, c = +tile.dataset.c;
    handleTap(r, c);
  }
}

function handleTap(r, c) {
  const cell = board[r][c];
  if (cell.open || cell.flagged) return;

  if (flagMode) {
    toggleFlag(r, c);
    return;
  }

  if (firstClick) {
    firstClick = false;
    gameStarted = true;
    placeMines(r, c);
    startTimer();
  }

  if (cell.mine) {
    revealMine(r, c);
    return;
  }

  Vibrate.light();
  AudioEngine.click();
  openCell(r, c);
}

// ===== GAME LOGIC =====
function openCell(r, c) {
  const cell = board[r][c];
  if (cell.open || cell.flagged || cell.mine) return;

  cell.open = true;
  openedCount++;
  renderTile(r, c);

  if (cell.adjacent === 0) {
    // Flood fill
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          setTimeout(() => openCell(nr, nc), 15);
        }
      }
    }
  }

  checkWin();
}

function toggleFlag(r, c) {
  const cell = board[r][c];
  if (cell.open) return;

  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  updateBombCount();
  renderTile(r, c);

  if (cell.flagged) {
    AudioEngine.flag();
  } else {
    AudioEngine.unflag();
  }
}

function revealMine(r, c) {
  board[r][c].open = true;
  gameOver = true;
  stopTimer();

  // Show exploded mine
  const tile = getTileEl(r, c);
  tile.classList.add('mine-exploded');
  tile.innerHTML = '<span class="num">💥</span>';

  AudioEngine.explode();
  Vibrate.strong();

  // Red flash
  const flash = document.createElement('div');
  flash.className = 'red-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);

  // Reveal all mines and wrong flags
  setTimeout(() => {
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        const cell = board[rr][cc];
        if (cell.mine && !cell.flagged && !(rr === r && cc === c)) {
          const t = getTileEl(rr, cc);
          t.classList.add('mine-revealed');
          t.innerHTML = '<span class="num">💣</span>';
        }
        if (cell.flagged && !cell.mine) {
          const t = getTileEl(rr, cc);
          t.classList.add('wrong-flag');
          t.innerHTML = '<span class="num">❌</span>';
        }
      }
    }

    setTimeout(() => showOverlay(false), 400);
  }, 500);
}

function checkWin() {
  const totalSafe = rows * cols - totalMines;
  if (openedCount >= totalSafe) {
    gameOver = true;
    stopTimer();
    AudioEngine.win();
    Vibrate.win();

    // Auto-flag remaining mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine && !board[r][c].flagged) {
          board[r][c].flagged = true;
          flagCount++;
          renderTile(r, c);
        }
      }
    }
    updateBombCount();

    setTimeout(() => {
      Confetti.create();
      showOverlay(true);
    }, 300);
  }
}

// ===== RENDER =====
function getTileEl(r, c) {
  return gridEl.children[r * cols + c];
}

function renderTile(r, c) {
  const cell = board[r][c];
  const tile = getTileEl(r, c);

  if (cell.open) {
    tile.classList.add('open');
    tile.classList.remove('flagged');
    if (cell.adjacent > 0) {
      tile.innerHTML = `<span class="num n${cell.adjacent}">${cell.adjacent}</span>`;
    } else {
      tile.innerHTML = '';
    }
  } else if (cell.flagged) {
    tile.classList.add('flagged');
    tile.innerHTML = '';
  } else {
    tile.classList.remove('open', 'flagged', 'mine-exploded', 'mine-revealed', 'wrong-flag');
    tile.innerHTML = '';
  }
}

function updateBombCount() {
  const remaining = totalMines - flagCount;
  bombCountEl.textContent = remaining;
}

// ===== TIMER =====
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimer() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== OVERLAY =====
function showOverlay(win) {
  if (win) {
    overlayEmoji.textContent = '🎉';
    overlayTitle.textContent = 'You Win!';
    overlayMsg.textContent = `Selesai dalam ${timerEl.textContent}`;
    overlayTitle.style.color = 'var(--success)';
  } else {
    overlayEmoji.textContent = '💥';
    overlayTitle.textContent = 'Game Over';
    overlayMsg.textContent = `Bom meledak! Waktu: ${timerEl.textContent}`;
    overlayTitle.style.color = 'var(--danger)';
  }
  overlayEl.classList.add('show');
}

// ===== EVENT LISTENERS =====
btnRestart.addEventListener('click', () => initGame(currentLevel));
overlayBtn.addEventListener('click', () => initGame(currentLevel));

levelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    levelBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initGame(btn.dataset.level);
  });
});

btnFlagMode.addEventListener('click', () => {
  flagMode = !flagMode;
  btnFlagMode.textContent = `🚩 Flag Mode: ${flagMode ? 'ON' : 'OFF'}`;
  btnFlagMode.style.background = flagMode ? 'var(--gold)' : '';
  btnFlagMode.style.color = flagMode ? '#000' : '';
  btnFlagMode.style.borderColor = flagMode ? 'var(--gold)' : '';
  Vibrate.light();
});

// Prevent context menu globally
document.addEventListener('contextmenu', e => e.preventDefault());

// ===== START =====
initGame('easy');