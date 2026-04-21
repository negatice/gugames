// ===== AUDIO CONTEXT (simple beeps) =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playTone(freq, dur, vol=0.08, type='sine') {
  try {
    initAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function soundTap() { playTone(800, 0.08, 0.05); }
function soundPlace() { playTone(600, 0.1, 0.07); playTone(900, 0.08, 0.05); }
function soundError() { playTone(200, 0.3, 0.1, 'square'); }
function soundWin() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,0.1),i*150)); }
function soundGameOver() { [400,350,300,200].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,0.08,'square'),i*200)); }

// ===== GAME STATE =====
let state = {
  screen: 'menu',
  level: 'easy',
  board: [],       // current board (0 = empty)
  solution: [],    // full solution
  initial: [],     // initial puzzle (true/false for given cells)
  notes: [],       // 9x9 array of Sets
  selectedCell: -1,
  lives: 3,
  maxLives: 3,
  timer: 0,
  timerInterval: null,
  history: [],     // undo stack
  notesMode: false,
  hintsLeft: 3,
  gameOver: false,
  completed: false,
};

const LEVEL_CONFIG = {
  easy:   { clues: 36, label: 'Mudah' },
  medium: { clues: 28, label: 'Sedang' },
  hard:   { clues: 22, label: 'Sulit' },
};

// ===== SUDOKU GENERATOR =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValidPlacement(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (board[r][c] === num) return false;
  return true;
}

function solveSudoku(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = shuffle([1,2,3,4,5,6,7,8,9]);
        for (const num of nums) {
          if (isValidPlacement(board, r, c, num)) {
            board[r][c] = num;
            if (solveSudoku(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generatePuzzle(difficulty) {
  const board = Array.from({length:9}, ()=>Array(9).fill(0));
  solveSudoku(board);
  const solution = board.map(r=>[...r]);

  const clues = LEVEL_CONFIG[difficulty].clues;
  const toRemove = 81 - clues;
  const positions = shuffle([...Array(81).keys()]);

  const puzzle = board.map(r=>[...r]);
  let removed = 0;
  for (const pos of positions) {
    if (removed >= toRemove) break;
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    puzzle[r][c] = 0;
    removed++;
  }

  return { puzzle, solution };
}

// ===== GAME INIT =====
function startGame(level) {
  initAudio();
  const { puzzle, solution } = generatePuzzle(level);

  state.screen = 'playing';
  state.level = level;
  state.solution = solution;
  state.board = puzzle.map(r=>[...r]);
  state.initial = puzzle.map(r=>r.map(v=>v!==0));
  state.notes = Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  state.selectedCell = -1;
  state.lives = 3;
  state.timer = 0;
  state.history = [];
  state.notesMode = false;
  state.hintsLeft = 3;
  state.gameOver = false;
  state.completed = false;

  showScreen('gameScreen');
  buildGrid();
  buildNumpad();
  updateDisplay();
  startTimer();
  saveGame();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== BUILD GRID =====
function buildGrid() {
  const container = document.getElementById('gridContainer');
  container.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = r * 9 + c;
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', ()=>selectCell(r*9+c));

      if (state.initial[r][c]) {
        cell.classList.add('default');
        cell.textContent = state.board[r][c];
      } else if (state.board[r][c] !== 0) {
        cell.classList.add('user-input');
        cell.textContent = state.board[r][c];
      }

      renderNotes(cell, r, c);
      container.appendChild(cell);
    }
  }
}

function renderNotes(cellEl, r, c) {
  const existing = cellEl.querySelector('.notes-grid');
  if (existing) existing.remove();

  if (state.board[r][c] === 0 && state.notes[r][c].size > 0 && !state.initial[r][c]) {
    const ng = document.createElement('div');
    ng.className = 'notes-grid';
    for (let n = 1; n <= 9; n++) {
      const span = document.createElement('span');
      span.textContent = state.notes[r][c].has(n) ? n : '';
      ng.appendChild(span);
    }
    cellEl.appendChild(ng);
  }
}

// ===== BUILD NUMPAD =====
function buildNumpad() {
  const pad = document.getElementById('numpad');
  pad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.dataset.num = n;
    btn.innerHTML = `${n}<span class="remaining">${countRemaining(n)}</span>`;
    btn.addEventListener('click', ()=>inputNumber(n));
    pad.appendChild(btn);
  }
}

function countRemaining(num) {
  let count = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (state.board[r][c] === num) count++;
  return Math.max(0, 9 - count);
}

// ===== CELL SELECTION =====
function selectCell(index) {
  if (state.gameOver || state.completed) return;
  soundTap();
  state.selectedCell = index;
  highlightGrid();
}

function highlightGrid() {
  const cells = document.querySelectorAll('.cell');
  const sel = state.selectedCell;

  cells.forEach(c => {
    c.classList.remove('highlight-same', 'highlight-line', 'highlight-active', 'selected', 'error');
  });

  if (sel === -1) return;

  const sr = Math.floor(sel / 9);
  const sc = sel % 9;
  const sNum = state.board[sr][sc];

  cells.forEach(c => {
    const r = parseInt(c.dataset.row);
    const cc = parseInt(c.dataset.col);
    const idx = parseInt(c.dataset.index);

    if (idx === sel) {
      c.classList.add('selected');
    } else if (r === sr || cc === sc) {
      c.classList.add('highlight-line');
    }

    if (sNum !== 0 && state.board[r][cc] === sNum && idx !== sel) {
      c.classList.add('highlight-same');
    }
  });
}

// ===== INPUT NUMBER =====
function inputNumber(num) {
  if (state.gameOver || state.completed) return;
  const sel = state.selectedCell;
  if (sel === -1) return;

  const r = Math.floor(sel / 9);
  const c = sel % 9;

  if (state.initial[r][c]) {
    soundError();
    shakeGrid();
    return;
  }

  if (state.notesMode) {
    // Toggle note
    soundTap();
    if (state.board[r][c] !== 0) return;
    state.history.push({
      type: 'note',
      row: r, col: c,
      prevNotes: new Set(state.notes[r][c]),
      prevValue: 0
    });
    if (state.notes[r][c].has(num)) {
      state.notes[r][c].delete(num);
    } else {
      state.notes[r][c].add(num);
    }
    updateCellDisplay(r, c);
    highlightGrid();
    updateNumpad();
    saveGame();
    return;
  }

  // Normal input
  const correct = state.solution[r][c];

  if (num === correct) {
    soundPlace();
    state.history.push({
      type: 'input',
      row: r, col: c,
      prevValue: state.board[r][c],
      prevNotes: new Set(state.notes[r][c])
    });
    state.board[r][c] = num;
    state.notes[r][c].clear();

    // Remove this number from notes in same row/col/box
    removeNotesFor(r, c, num);

    updateCellDisplay(r, c);
    highlightGrid();
    updateNumpad();
    glowCell(sel);

    // Check win
    if (checkWin()) {
      setTimeout(()=>winGame(), 300);
    }
    saveGame();
  } else {
    soundError();
    if (navigator.vibrate) navigator.vibrate(100);
    state.history.push({
      type: 'error',
      row: r, col: c,
      prevValue: state.board[r][c],
      prevNotes: new Set(state.notes[r][c])
    });
    state.lives--;
    updateLivesDisplay();

    // Flash error
    const cellEl = getCellElement(r, c);
    cellEl.classList.add('error');
    cellEl.textContent = num;
    cellEl.style.animation = 'shake 0.4s ease';
    setTimeout(()=>{
      cellEl.classList.remove('error');
      cellEl.textContent = state.board[r][c] || '';
      cellEl.style.animation = '';
      highlightGrid();
    }, 600);

    if (state.lives <= 0) {
      state.gameOver = true;
      setTimeout(()=>gameOverScreen(), 700);
    }
    saveGame();
  }
}

function removeNotesFor(row, col, num) {
  for (let i = 0; i < 9; i++) {
    state.notes[row][i].delete(num);
    state.notes[i][col].delete(num);
  }
  const br = Math.floor(row/3)*3;
  const bc = Math.floor(col/3)*3;
  for (let r = br; r < br+3; r++)
    for (let c = bc; c < bc+3; c++)
      state.notes[r][c].delete(num);
}

function updateCellDisplay(r, c) {
  const cellEl = getCellElement(r, c);
  cellEl.classList.remove('default', 'user-input', 'error');
  cellEl.textContent = '';

  if (state.board[r][c] !== 0) {
    cellEl.classList.add(state.initial[r][c] ? 'default' : 'user-input');
    cellEl.textContent = state.board[r][c];
  }

  renderNotes(cellEl, r, c);
}

function getCellElement(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function shakeGrid() {
  const g = document.getElementById('gridContainer');
  g.style.animation = 'shake 0.4s ease';
  setTimeout(()=>g.style.animation='', 400);
}

function glowCell(index) {
  const el = document.querySelector(`.cell[data-index="${index}"]`);
  if (el) {
    el.style.animation = 'glow 0.5s ease';
    setTimeout(()=>el.style.animation='', 500);
  }
}

// ===== TOOLS =====
function doUndo() {
  if (state.history.length === 0 || state.gameOver) return;
  soundTap();
  const move = state.history.pop();
  const { row, col, prevValue, prevNotes } = move;
  state.board[row][col] = prevValue;
  state.notes[row][col] = new Set(prevNotes);
  updateCellDisplay(row, col);
  highlightGrid();
  updateNumpad();
  saveGame();
}

function doErase() {
  if (state.selectedCell === -1 || state.gameOver) return;
  const r = Math.floor(state.selectedCell / 9);
  const c = state.selectedCell % 9;
  if (state.initial[r][c]) { soundError(); return; }

  if (state.board[r][c] !== 0 || state.notes[r][c].size > 0) {
    soundTap();
    state.history.push({
      type: 'erase',
      row: r, col: c,
      prevValue: state.board[r][c],
      prevNotes: new Set(state.notes[r][c])
    });
    state.board[r][c] = 0;
    state.notes[r][c].clear();
    updateCellDisplay(r, c);
    highlightGrid();
    updateNumpad();
    saveGame();
  }
}

function toggleNotes() {
  soundTap();
  state.notesMode = !state.notesMode;
  document.getElementById('btnNotes').classList.toggle('active-tool', state.notesMode);
}

function doHint() {
  if (state.hintsLeft <= 0 || state.gameOver || state.completed) return;
  if (state.selectedCell === -1) {
    // Find first empty cell
    const empties = [];
    for (let r=0;r<9;r++)
      for (let c=0;c<9;c++)
        if (state.board[r][c]===0) empties.push(r*9+c);
    if (empties.length === 0) return;
    state.selectedCell = empties[Math.floor(Math.random()*empties.length)];
  }

  const r = Math.floor(state.selectedCell / 9);
  const c = state.selectedCell % 9;
  if (state.board[r][c] !== 0 || state.initial[r][c]) return;

  soundPlace();
  state.hintsLeft--;
  document.getElementById('hintBadge').textContent = state.hintsLeft;

  state.history.push({
    type: 'hint',
    row: r, col: c,
    prevValue: state.board[r][c],
    prevNotes: new Set(state.notes[r][c])
  });

  state.board[r][c] = state.solution[r][c];
  state.notes[r][c].clear();
  removeNotesFor(r, c, state.board[r][c]);
  updateCellDisplay(r, c);
  highlightGrid();
  updateNumpad();
  glowCell(state.selectedCell);

  if (state.hintsLeft <= 0) {
    document.getElementById('btnHint').style.opacity = '0.4';
  }

  if (checkWin()) setTimeout(()=>winGame(), 300);
  saveGame();
}

// ===== VALIDATION =====
function checkWin() {
  for (let r=0;r<9;r++)
    for (let c=0;c<9;c++)
      if (state.board[r][c] !== state.solution[r][c]) return false;
  return true;
}

// ===== TIMER =====
function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(()=>{
    state.timer++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = Math.floor(state.timer / 60);
  const s = state.timer % 60;
  document.getElementById('timerDisplay').textContent = `${m}:${s.toString().padStart(2,'0')}`;
}

// ===== LIVES =====
function updateLivesDisplay() {
  let html = '';
  for (let i = 0; i < state.maxLives; i++) {
    html += i < state.lives ? '❤️' : '<span class="lost">🖤</span>';
  }
  document.getElementById('livesDisplay').innerHTML = html;
}

// ===== NUMPAD UPDATE =====
function updateNumpad() {
  document.querySelectorAll('.num-btn').forEach(btn => {
    const num = parseInt(btn.dataset.num);
    const rem = countRemaining(num);
    btn.querySelector('.remaining').textContent = rem;
    btn.classList.toggle('completed', rem <= 0);
  });
}

// ===== SCREENS =====
function gameOverScreen() {
  stopTimer();
  soundGameOver();
  document.getElementById('goTime').textContent = formatTime(state.timer);
  document.getElementById('goLevel').textContent = LEVEL_CONFIG[state.level].label;
  document.getElementById('gameOverOverlay').classList.add('active');
  localStorage.removeItem('sudoku_save');
}

function winGame() {
  stopTimer();
  state.completed = true;
  soundWin();
  spawnConfetti();

  document.getElementById('winTime').textContent = formatTime(state.timer);
  document.getElementById('winLives').textContent = '❤️'.repeat(state.lives) + '🖤'.repeat(state.maxLives - state.lives);
  document.getElementById('winLevel').textContent = LEVEL_CONFIG[state.level].label;

  // Save best time
  const key = `sudoku_best_${state.level}`;
  const prev = localStorage.getItem(key);
  if (!prev || state.timer < parseInt(prev)) {
    localStorage.setItem(key, state.timer);
  }

  document.getElementById('completeOverlay').classList.add('active');
  localStorage.removeItem('sudoku_save');
}

function showPause() {
  stopTimer();
  document.getElementById('pauseTime').textContent = formatTime(state.timer);
  document.getElementById('pauseLevel').textContent = LEVEL_CONFIG[state.level].label;
  document.getElementById('pauseLives').textContent = '❤️'.repeat(state.lives) + '🖤'.repeat(state.maxLives - state.lives);
  document.getElementById('pauseOverlay').classList.add('active');
}

function resumeGame() {
  document.getElementById('pauseOverlay').classList.remove('active');
  startTimer();
}

function restartGame() {
  closeOverlays();
  startGame(state.level);
}

function exitGame() {
  stopTimer();
  saveGame();
  closeOverlays();
  goToMenu();
}

function goToMenu() {
  closeOverlays();
  stopTimer();
  state.screen = 'menu';
  showScreen('menuScreen');
  updateBestTimeDisplay();
  localStorage.removeItem('sudoku_save');
}

function closeOverlays() {
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
}

function formatTime(s) {
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// ===== CONFETTI =====
function spawnConfetti() {
  const colors = ['#2EA0D6','#e74c3c','#f39c12','#2ecc71','#9b59b6','#e91e63','#ff9800'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random()*100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDelay = Math.random()*1.5 + 's';
    piece.style.animationDuration = (2 + Math.random()*2) + 's';
    piece.style.width = (6 + Math.random()*8) + 'px';
    piece.style.height = (6 + Math.random()*8) + 'px';
    piece.style.borderRadius = Math.random()>0.5 ? '50%' : '2px';
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(), 5000);
  }
}

// ===== SAVE / LOAD =====
function saveGame() {
  if (state.gameOver || state.completed) return;
  const data = {
    level: state.level,
    board: state.board,
    solution: state.solution,
    initial: state.initial,
    notes: state.notes.map(r=>r.map(s=>[...s])),
    lives: state.lives,
    timer: state.timer,
    history: state.history,
    hintsLeft: state.hintsLeft,
    selectedCell: state.selectedCell,
  };
  try {
    localStorage.setItem('sudoku_save', JSON.stringify(data));
  } catch(e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('sudoku_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.screen = 'playing';
    state.level = data.level;
    state.board = data.board;
    state.solution = data.solution;
    state.initial = data.initial;
    state.notes = data.notes.map(r=>r.map(s=>new Set(s)));
    state.lives = data.lives;
    state.timer = data.timer;
    state.history = data.history || [];
    state.hintsLeft = data.hintsLeft;
    state.selectedCell = data.selectedCell ?? -1;
    state.gameOver = false;
    state.completed = false;
    state.notesMode = false;
    return true;
  } catch(e) { return false; }
}

function updateBestTimeDisplay() {
  const bestEasy = localStorage.getItem('sudoku_best_easy');
  const bestMed = localStorage.getItem('sudoku_best_medium');
  const bestHard = localStorage.getItem('sudoku_best_hard');
  const best = [bestEasy, bestMed, bestHard].filter(Boolean).map(Number).sort((a,b)=>a-b)[0];
  document.getElementById('bestTimeDisplay').textContent = best ? formatTime(best) : '--:--';
}

// ===== DISPLAY UPDATE =====
function updateDisplay() {
  updateTimerDisplay();
  updateLivesDisplay();
  document.getElementById('hintBadge').textContent = state.hintsLeft;
  document.getElementById('btnHint').style.opacity = state.hintsLeft > 0 ? '1' : '0.4';
  document.getElementById('btnNotes').classList.remove('active-tool');
  state.notesMode = false;
  buildGrid();
  buildNumpad();
  if (state.selectedCell !== -1) {
    highlightGrid();
  }
}

// ===== KEYBOARD SUPPORT (desktop) =====
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'playing' || state.gameOver) return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    inputNumber(num);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    doErase();
    return;
  }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    doUndo();
    return;
  }
  if (e.key === 'n') {
    toggleNotes();
    return;
  }
  // Arrow keys
  if (state.selectedCell === -1) return;
  let r = Math.floor(state.selectedCell / 9);
  let c = state.selectedCell % 9;
  if (e.key === 'ArrowUp') r = Math.max(0, r-1);
  if (e.key === 'ArrowDown') r = Math.min(8, r+1);
  if (e.key === 'ArrowLeft') c = Math.max(0, c-1);
  if (e.key === 'ArrowRight') c = Math.min(8, c+1);
  if (r !== Math.floor(state.selectedCell/9) || c !== state.selectedCell%9) {
    selectCell(r*9+c);
  }
});

// ===== INIT =====
updateBestTimeDisplay();

// Try to load saved game
if (loadGame() && state.screen === 'playing') {
  showScreen('gameScreen');
  buildGrid();
  buildNumpad();
  updateDisplay();
  if (state.lives > 0) {
    startTimer();
  }
}