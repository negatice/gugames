class Game2048 {
  constructor() {
    this.size = 4;
    this.grid = [];
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('2048_best') || '0');
    this.state = 'MENU';
    this.won = false;
    this.keepPlaying = false;
    this.prevState = null;

    this.stats = JSON.parse(localStorage.getItem('2048_stats') || '{}');
    this.stats.gamesPlayed = this.stats.gamesPlayed || 0;
    this.stats.wins = this.stats.wins || 0;
    this.stats.highestTile = this.stats.highestTile || 0;
    this.stats.totalScore = this.stats.totalScore || 0;
    this.stats.totalMoves = this.stats.totalMoves || 0;
    this.stats.totalMerges = this.stats.totalMerges || 0;

    this.audioCtx = null;
    this.isDarkMode = localStorage.getItem('2048_dark') === 'true';

    this.gridEl = document.getElementById('grid');
    this.tileLayer = document.getElementById('tileLayer');
    this.scoreEl = document.getElementById('score');
    this.bestScoreEl = document.getElementById('bestScore');

    this.init();
  }

  /* ===== INIT ===== */
  init() {
    this.setupAudio();
    this.setupEvents();
    this.updateBestScoreDisplay();
    this.applyTheme();
  }

  /* ===== AUDIO ===== */
  setupAudio() {
    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { /* silent */ }
  }

  ensureAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  playSound(type) {
    this.ensureAudio();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain); gain.connect(this.audioCtx.destination);

    switch(type) {
      case 'move':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t); osc.stop(t + 0.08);
        break;
      case 'merge':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
        break;
      case 'bigMerge':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.18);
        break;
      case 'win':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(659, t + 0.12);
        osc.frequency.setValueAtTime(784, t + 0.24);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
        break;
      case 'lose':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
        break;
    }
  }

  vibrate(ms = 10) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  /* ===== GAME ===== */
  newGame() {
    this.grid = Array.from({ length: 4 }, () => Array(4).fill(0));
    this.score = 0;
    this.won = false;
    this.keepPlaying = false;
    this.state = 'PLAYING';

    this.updateScore();
    this.hideOverlays();
    this.addRandomTile();
    this.addRandomTile();
    this.renderTiles();

    this.stats.gamesPlayed++;
    this.saveStats();
  }

  addRandomTile() {
    const empty = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (this.grid[r][c] === 0) empty.push([r, c]);

    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return { r, c };
  }

  /* ===== MOVEMENT ===== */
  move(direction) {
    if (this.state !== 'PLAYING') return false;

    let moved = false;
    let totalMergeScore = 0;
    let mergeValues = [];

    let totalMergeCount = 0; // ✅ tambahkan variabel ini

    for (let i = 0; i < 4; i++) {
      let line = this.getLine(i, direction);
      const result = this.processLine(line);
      this.setLine(i, direction, result.line);

      if (!moved) {
        for (let j = 0; j < 4; j++) {
          if (line[j] !== result.line[j]) { moved = true; break; }
        }
      }
      totalMergeScore += result.score;
      mergeValues.push(...result.mergeValues);
      totalMergeCount += result.mergeCount || 0; // ✅ akumulasi di dalam loop
    }

    const prevScore = this.score;
    this.score += totalMergeScore;
    this.stats.totalScore += (this.score - prevScore);
    this.stats.totalMoves++;
    this.stats.totalMerges += totalMergeCount; // ✅ gunakan variabel yang benar

    const maxTile = this.getMaxTile();
    if (maxTile > this.stats.highestTile) this.stats.highestTile = maxTile;
    this.saveStats();
    this.updateScore();

    this.addRandomTile();
    this.renderTiles();

    this.vibrate(mergeValues.length ? 15 : 5);
    if (mergeValues.length) {
      const maxM = Math.max(...mergeValues);
      this.playSound(maxM >= 128 ? 'bigMerge' : 'merge');
    } else {
      this.playSound('move');
    }

    if (!this.won && !this.keepPlaying && maxTile >= 2048) {
      this.won = true;
      this.stats.wins++;
      this.saveStats();
      setTimeout(() => this.showWin(), 300);
      this.playSound('win');
    }

    if (!this.canMove()) {
      this.state = 'GAME_OVER';
      setTimeout(() => this.showGameOver(), 400);
      this.playSound('lose');
    }

    return true;
  }

  getLine(index, dir) {
    const line = [];
    for (let i = 0; i < 4; i++) {
      switch(dir) {
        case 'left':  line.push(this.grid[index][i]); break;
        case 'right': line.push(this.grid[index][3 - i]); break;
        case 'up':    line.push(this.grid[i][index]); break;
        case 'down':  line.push(this.grid[3 - i][index]); break;
      }
    }
    return line;
  }

  setLine(index, dir, line) {
    for (let i = 0; i < 4; i++) {
      switch(dir) {
        case 'left':  this.grid[index][i] = line[i]; break;
        case 'right': this.grid[index][3 - i] = line[i]; break;
        case 'up':    this.grid[i][index] = line[i]; break;
        case 'down':  this.grid[3 - i][index] = line[i]; break;
      }
    }
  }

  processLine(line) {
    let filtered = line.filter(v => v !== 0);
    let result = [], score = 0, mergeValues = [];

    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const merged = filtered[i] * 2;
        result.push(merged);
        score += merged;
        mergeValues.push(merged);
        i += 2;
      } else {
        result.push(filtered[i]);
        i++;
      }
    }
    while (result.length < 4) result.push(0);
    return { line: result, score, mergeValues, mergeCount: mergeValues.length };
  }

  canMove() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (this.grid[r][c] === 0) return true;
        if (c + 1 < 4 && this.grid[r][c] === this.grid[r][c + 1]) return true;
        if (r + 1 < 4 && this.grid[r][c] === this.grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  getMaxTile() {
    let max = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (this.grid[r][c] > max) max = this.grid[r][c];
    return max;
  }

  /* ===== RENDER ===== */
  renderTiles() {
    this.tileLayer.innerHTML = '';
    const wrapper = document.getElementById('gridWrapper');
    const pad = parseFloat(getComputedStyle(wrapper).paddingLeft);
    const gap = parseFloat(getComputedStyle(this.gridEl).gap) || 10;

    const avail = wrapper.clientWidth - pad * 2;
    const cellSize = (avail - gap * 3) / 4;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = this.grid[r][c];
        if (val === 0) continue;

        const tile = document.createElement('div');
        tile.className = 'tile ' + (val <= 2048 ? `tile-${val}` : 'tile-super');

        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);
        tile.style.cssText = `left:${x}px;top:${y}px;width:${cellSize}px;height:${cellSize}px;`;

        let fs;
        if (val < 100) fs = cellSize * 0.45;
        else if (val < 1000) fs = cellSize * 0.35;
        else if (val < 10000) fs = cellSize * 0.28;
        else fs = cellSize * 0.22;

        tile.style.fontSize = fs + 'px';
        tile.textContent = val;
        this.tileLayer.appendChild(tile);
      }
    }
  }

  /* ===== SCORE ===== */
  updateScore() {
    this.scoreEl.textContent = this.score.toLocaleString();
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('2048_best', this.bestScore.toString());
      this.updateBestScoreDisplay();
    }
  }

  updateBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('2048_best', this.bestScore.toString());
      this.updateBestScoreDisplay();
    }
  }

  updateBestScoreDisplay() {
    this.bestScoreEl.textContent = this.bestScore.toLocaleString();
  }

  /* ===== OVERLAYS ===== */
  showGameOver() {
    document.getElementById('gameOverScore').textContent = `Score: ${this.score.toLocaleString()}`;
    document.getElementById('gameOverOverlay').classList.add('active');
  }

  showWin() {
    document.getElementById('winScore').textContent = `Score: ${this.score.toLocaleString()}`;
    document.getElementById('winOverlay').classList.add('active');
  }

  hideOverlays() {
    document.getElementById('gameOverOverlay').classList.remove('active');
    document.getElementById('winOverlay').classList.remove('active');
  }

  continueAfterWin() {
    this.keepPlaying = true;
    this.hideOverlays();
    this.state = 'PLAYING';
  }

  /* ===== UNDO ===== */
  saveState() {
    this.prevState = {
      grid: this.grid.map(r => [...r]),
      score: this.score
    };
  }

  undo() {
    if (!this.prevState || this.state !== 'PLAYING') return;
    this.grid = this.prevState.grid.map(r => [...r]);
    this.score = this.prevState.score;
    this.prevState = null;
    this.updateScore();
    this.renderTiles();
    this.vibrate(10);
  }

  /* ===== SHUFFLE ===== */
  shuffle() {
    if (this.state !== 'PLAYING') return;
    this.saveState();

    const vals = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (this.grid[r][c]) vals.push(this.grid[r][c]);

    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }

    this.grid = Array.from({ length: 4 }, () => Array(4).fill(0));
    let idx = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (idx < vals.length) this.grid[r][c] = vals[idx++];

    this.renderTiles();
    this.vibrate(20);

    if (!this.canMove()) {
      this.state = 'GAME_OVER';
      setTimeout(() => this.showGameOver(), 400);
    }
  }

  /* ===== STATS ===== */
  saveStats() { localStorage.setItem('2048_stats', JSON.stringify(this.stats)); }

  showStats() {
    document.getElementById('statGames').textContent = this.stats.gamesPlayed;
    document.getElementById('statWins').textContent = this.stats.wins;
    document.getElementById('statHighest').textContent = this.stats.highestTile;
    document.getElementById('statTotalScore').textContent = this.stats.totalScore.toLocaleString();
    document.getElementById('statMoves').textContent = this.stats.totalMoves;
    document.getElementById('statMerges').textContent = this.stats.totalMerges;
    document.getElementById('statsPanel').classList.add('open');
    document.getElementById('statsBackdrop').classList.add('open');
  }

  hideStats() {
    document.getElementById('statsPanel').classList.remove('open');
    document.getElementById('statsBackdrop').classList.remove('open');
  }

  /* ===== THEME ===== */
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('2048_dark', this.isDarkMode.toString());
    this.applyTheme();
    this.vibrate(10);
  }

  applyTheme() {
    document.body.classList.toggle('dark-mode', this.isDarkMode);
  }

  /* ===== EVENTS ===== */
  setupEvents() {
    // Buttons
    document.getElementById('btnRestart').addEventListener('click', () => { this.newGame(); this.vibrate(10); });
    document.getElementById('btnRestartOverlay').addEventListener('click', () => { this.newGame(); this.vibrate(10); });
    document.getElementById('btnRestartWin').addEventListener('click', () => { this.newGame(); this.vibrate(10); });
    document.getElementById('btnContinue').addEventListener('click', () => { this.continueAfterWin(); this.vibrate(10); });
    document.getElementById('btnUndo').addEventListener('click', () => { this.undo(); });
    document.getElementById('btnShuffle').addEventListener('click', () => { this.saveState(); this.shuffle(); });
    document.getElementById('btnStats').addEventListener('click', () => { this.showStats(); });
    document.getElementById('btnCloseStats').addEventListener('click', () => { this.hideStats(); });
    document.getElementById('statsBackdrop').addEventListener('click', () => { this.hideStats(); });
    document.getElementById('btnTheme').addEventListener('click', () => { this.toggleTheme(); });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      const dir = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                    w:'up', s:'down', a:'left', d:'right' }[e.key];
      if (dir) { e.preventDefault(); this.saveState(); this.move(dir); }
    });

    // Touch swipe
    this.setupSwipe();

    // Resize
    window.addEventListener('resize', () => {
      if (this.state === 'PLAYING' || this.state === 'WIN') this.renderTiles();
    });

    // Prevent scroll on grid
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.grid-wrapper')) e.preventDefault();
    }, { passive: false });

    // Init audio on first interaction
    const wake = () => { this.ensureAudio(); document.removeEventListener('touchstart', wake); document.removeEventListener('click', wake); };
    document.addEventListener('touchstart', wake, { once: true });
    document.addEventListener('click', wake, { once: true });
  }

  setupSwipe() {
    const wrapper = document.getElementById('gridWrapper');
    let sx, sy, st;
    const THRESHOLD = 30;

    wrapper.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
      if (sx == null || sy == null) return;
      const t = e.changedTouches[0];
      if (Date.now() - st > 1000) { sx = sy = null; return; }

      const dx = t.clientX - sx, dy = t.clientY - sy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < THRESHOLD) { sx = sy = null; return; }

      let dir = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.saveState();
      this.move(dir);
      sx = sy = null;
    }, { passive: true });

    // Mouse fallback
    let mDown = false, msx, msy;
    wrapper.addEventListener('mousedown', (e) => { mDown = true; msx = e.clientX; msy = e.clientY; });
    wrapper.addEventListener('mouseup', (e) => {
      if (!mDown) return; mDown = false;
      const dx = e.clientX - msx, dy = e.clientY - msy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < THRESHOLD) return;
      let dir = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.saveState();
      this.move(dir);
    });
  }
}

/* ===== START ===== */
const game = new Game2048();
setTimeout(() => game.newGame(), 200);