(function(){
  'use strict';

  // ============ STATE ============
  let state = 'MENU';
  let gridSize = 6;
  let totalTiles = 0;
  let tiles = [];
  let emptyRow, emptyCol;
  let moves = 0;
  let timerInterval = null;
  let startTime = 0;
  let elapsed = 0;
  let imageData = null;
  let audioCtx = null;
  let timerStarted = false; // 🔽 TAMBAHKAN: flag untuk timer pertama

  // ============ DOM REFS ============
  const $ = id => document.getElementById(id);
  const menuScreen = $('menuScreen');
  const gameScreen = $('gameScreen');
  const uploadArea = $('uploadArea');
  const fileInput = $('fileInput');
  const previewContainer = $('previewContainer');
  const previewImg = $('previewImg');
  const startBtn = $('startBtn');
  const gridSelector = $('gridSelector');
  const board = $('board');
  const timerEl = $('timer');
  const moveCountEl = $('moveCount');
  const gridLabelEl = $('gridLabel');
  const gameGridLabel = $('gameGridLabel');
  const hintOverlay = $('hintOverlay');
  const hintImg = $('hintImg');
  const winOverlay = $('winOverlay');
  const winTime = $('winTime');
  const winMoves = $('winMoves');
  const hsNotice = $('hsNotice');
  const confettiContainer = $('confettiContainer');
  const hiddenCanvas = $('hiddenCanvas');
  const highscoresSection = $('highscoresSection');
  const hsList = $('hsList');

  // ============ AUDIO ============
  function getAudioCtx(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playClick(){
    try{
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    }catch(e){}
  }

  function playSuccess(){
    try{
      const ctx = getAudioCtx();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }catch(e){}
  }

  function vibrate(ms){
    if(navigator.vibrate) navigator.vibrate(ms || 15);
  }

  // ============ IMAGE UPLOAD ============
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', e => {
    if(e.target.files.length) handleFile(e.target.files[0]);
  });

  function handleFile(file){
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      imageData = { src: e.target.result, width: 0, height: 0 };
      const img = new Image();
      img.onload = () => {
        imageData.width = img.width;
        imageData.height = img.height;
        previewImg.src = e.target.result;
        previewContainer.style.display = 'flex';
        startBtn.disabled = false;
        uploadArea.querySelector('.label').textContent = 'Upload Gambar Lain';
        uploadArea.classList.add('compact');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============ GRID SIZE ============
  gridSelector.addEventListener('click', e => {
    const btn = e.target.closest('.grid-btn');
    if(!btn) return;
    gridSelector.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gridSize = parseInt(btn.dataset.size);
  });

  // ============ HIGH SCORES ============
  function getHighScores(){
    try{ return JSON.parse(localStorage.getItem('puzzleHS') || '{}'); }catch(e){ return {}; }
  }
  function setHighScores(data){
    try{ localStorage.setItem('puzzleHS', JSON.stringify(data)); }catch(e){}
  }
  function displayHighScores(){
    const hs = getHighScores();
    const keys = Object.keys(hs).sort((a,b) => parseInt(a) - parseInt(b));
    if(!keys.length){ highscoresSection.style.display = 'none'; return; }
    highscoresSection.style.display = 'block';
    hsList.innerHTML = keys.map(g => {
      const d = hs[g];
      return `<div class="hs-row">
        <span class="hs-grid">${g}×${g}</span>
        <span class="hs-time">${formatTime(d.time)}</span>
        <span class="hs-moves">${d.moves} langkah</span>
      </div>`;
    }).join('');
  }

  function checkHighScore(size, time, moves){
    const hs = getHighScores();
    const key = String(size);
    const isBetter = !hs[key] || time < hs[key].time || (time === hs[key].time && moves < hs[key].moves);
    if(isBetter){
      hs[key] = { time, moves };
      setHighScores(hs);
    }
    return isBetter;
  }

  // ============ SCREEN SWITCH ============
  function showScreen(screen){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    state = screen === menuScreen ? 'MENU' : (screen === gameScreen ? 'PLAYING' : state);
  }

  // ============ GAME INIT ============
  startBtn.addEventListener('click', () => {
    if(!imageData) return;
    startGame();
  });

  function startGame(){
    showScreen(gameScreen);
    moves = 0;
    elapsed = 0;
    timerStarted = false; // 🔽 Reset flag timer
    updateHUD();
    gameGridLabel.textContent = `Grid: ${gridSize}×${gridSize}`;
    gridLabelEl.textContent = `${gridSize}×${gridSize}`;
    clearInterval(timerInterval); // 🔽 Stop timer lama jika ada
    createPuzzle();
    // 🔽 shufflePuzzle() & startTimer() dipindahkan ke createPuzzle() & swapTiles()
  }

  function createPuzzle(){
    board.innerHTML = '';
    tiles = [];
    totalTiles = gridSize * gridSize;
    const tileSize = 100 / gridSize;

    const canvas = hiddenCanvas;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

      const tilePixelSize = size / gridSize;
      for(let r = 0; r < gridSize; r++){
        for(let c = 0; c < gridSize; c++){
          const id = r * gridSize + c;
          if(id === totalTiles - 1) {
            emptyRow = r; emptyCol = c;
            continue;
          }
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = tilePixelSize;
          tileCanvas.height = tilePixelSize;
          const tCtx = tileCanvas.getContext('2d');
          tCtx.drawImage(canvas, c * tilePixelSize, r * tilePixelSize, tilePixelSize, tilePixelSize, 0, 0, tilePixelSize, tilePixelSize);
          const tileDataUrl = tileCanvas.toDataURL();

          const el = document.createElement('div');
          el.className = 'tile';
          el.style.width = tileSize + '%';
          el.style.height = tileSize + '%';
          el.style.left = (c * tileSize) + '%';
          el.style.top = (r * tileSize) + '%';
          const tileImg = document.createElement('img');
          tileImg.src = tileDataUrl;
          tileImg.draggable = false;
          el.appendChild(tileImg);
          el.dataset.id = id;
          el.dataset.row = r;
          el.dataset.col = c;

          el.addEventListener('click', (e) => {
            e.preventDefault();
            const row = parseInt(e.currentTarget.dataset.row);
            const col = parseInt(e.currentTarget.dataset.col);
            if (!isNaN(row) && !isNaN(col)) onTileClick(row, col);
          });
          
          el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const row = parseInt(e.currentTarget.dataset.row);
            const col = parseInt(e.currentTarget.dataset.col);
            if (!isNaN(row) && !isNaN(col)) onTileClick(row, col);
          });

          board.appendChild(el);
          tiles.push({ id, row: r, col: c, el });
        }
      }
      // Add empty tile
      const emptyEl = document.createElement('div');
      emptyEl.className = 'tile empty';
      emptyEl.style.width = tileSize + '%';
      emptyEl.style.height = tileSize + '%';
      emptyEl.style.left = (emptyCol * tileSize) + '%';
      emptyEl.style.top = (emptyRow * tileSize) + '%';
      emptyEl.dataset.id = totalTiles - 1;
      emptyEl.dataset.row = emptyRow;
      emptyEl.dataset.col = emptyCol;
      board.appendChild(emptyEl);
      tiles.push({ id: totalTiles - 1, row: emptyRow, col: emptyCol, el: emptyEl });
      
      // 🔽 Shuffle DIPINDAH KE SINI (setelah tile siap)
      shufflePuzzle();
    };
    img.src = imageData.src;
  }

  // ============ SHUFFLE ============
  function shufflePuzzle(){
    const shuffleMoves = gridSize * gridSize * 40;
    const directions = [[-1,0],[1,0],[0,-1],[0,1]];
    let lastDir = -1;

    for(let i = 0; i < shuffleMoves; i++){
      const validDirs = [];
      directions.forEach((d, idx) => {
        if(lastDir !== -1 && idx === (lastDir ^ 1)) return;
        const nr = emptyRow + d[0], nc = emptyCol + d[1];
        if(nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) validDirs.push({r: nr, c: nc, dir: idx});
      });
      if(!validDirs.length) {
        directions.forEach((d, idx) => {
          const nr = emptyRow + d[0], nc = emptyCol + d[1];
          if(nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) validDirs.push({r: nr, c: nc, dir: idx});
        });
      }
      const chosen = validDirs[Math.floor(Math.random() * validDirs.length)];
      const tile = getTileAt(chosen.r, chosen.c);
      if(tile){
        swapTiles(tile, null, true);
        lastDir = chosen.dir;
      }
    }
    moves = 0;
    updateHUD();
    highlightMovable();
  }

  function getTileAt(row, col){
    return tiles.find(t => t.row === row && t.col === col && t.id !== totalTiles - 1);
  }
  function getEmptyTile(){
    return tiles.find(t => t.id === totalTiles - 1);
  }

  function swapTiles(tile, empty, silent){
    const tileSize = 100 / gridSize;
    const tempR = tile.row, tempC = tile.col;
    tile.row = emptyRow; tile.col = emptyCol;
    emptyRow = tempR; emptyCol = tempC;

    tile.el.style.left = (tile.col * tileSize) + '%';
    tile.el.style.top = (tile.row * tileSize) + '%';
    tile.el.dataset.row = tile.row;
    tile.el.dataset.col = tile.col;

    const emptyTile = getEmptyTile();
    emptyTile.row = emptyRow; emptyTile.col = emptyCol;
    emptyTile.el.style.left = (emptyCol * tileSize) + '%';
    emptyTile.el.style.top = (emptyRow * tileSize) + '%';
    emptyTile.el.dataset.row = emptyRow;
    emptyTile.el.dataset.col = emptyCol;

    if(!silent){
      // 🔽 START TIMER HANYA SAAT LANGKAH PERTAMA
      if(!timerStarted) {
        startTimer();
        timerStarted = true;
      }
      moves++;
      updateHUD();
      playClick();
      vibrate(15);
      highlightMovable();
      checkWin();
    }
  }

  function onTileClick(row, col){
    if(state !== 'PLAYING') return;
    const dr = Math.abs(row - emptyRow);
    const dc = Math.abs(col - emptyCol);
    if((dr === 1 && dc === 0) || (dr === 0 && dc === 1)){
      const tile = getTileAt(row, col);
      if(tile) swapTiles(tile, null, false);
    }
  }

  function highlightMovable(){
    tiles.forEach(t => {
      if(t.id === totalTiles - 1) return;
      const dr = Math.abs(t.row - emptyRow);
      const dc = Math.abs(t.col - emptyCol);
      if((dr === 1 && dc === 0) || (dr === 0 && dc === 1)){
        t.el.classList.add('movable');
      } else {
        t.el.classList.remove('movable');
      }
    });
  }

  // ============ WIN CHECK ============
  function checkWin(){
    for(const t of tiles){
      if(t.id !== totalTiles - 1){
        const correctRow = Math.floor(t.id / gridSize);
        const correctCol = t.id % gridSize;
        if(t.row !== correctRow || t.col !== correctCol) return;
      }
    }
    state = 'COMPLETED';
    clearInterval(timerInterval);
    playSuccess();
    showWin();
  }

  function showWin(){
    const isHS = checkHighScore(gridSize, elapsed, moves);
    winTime.textContent = formatTime(elapsed);
    winMoves.textContent = moves;
    hsNotice.style.display = isHS ? 'block' : 'none';
    winOverlay.classList.add('active');
    launchConfetti();
  }

  // ============ CONFETTI ============
  function launchConfetti(){
    confettiContainer.innerHTML = '';
    const colors = ['#7c3aed','#a78bfa','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'];
    for(let i = 0; i < 80; i++){
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (2 + Math.random() * 3) + 's';
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.width = (6 + Math.random() * 8) + 'px';
      c.style.height = (6 + Math.random() * 8) + 'px';
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      confettiContainer.appendChild(c);
    }
    setTimeout(() => confettiContainer.innerHTML = '', 5000);
  }

  // ============ TIMER ============
  function startTimer(){
    clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
      if(state !== 'PLAYING') return;
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      updateTimerDisplay();
    }, 200);
  }

  function updateTimerDisplay(){
    timerEl.textContent = formatTime(elapsed);
  }

  function formatTime(sec){
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateHUD(){
    moveCountEl.textContent = moves;
    updateTimerDisplay();
  }

  // ============ HINT ============
  $('hintBtn').addEventListener('click', () => {
    hintImg.src = imageData.src;
    hintOverlay.classList.add('active');
  });
  hintOverlay.addEventListener('click', () => hintOverlay.classList.remove('active'));

  // ============ SHUFFLE BTN ============
  $('shuffleBtn').addEventListener('click', () => {
    if(state !== 'PLAYING') return;
    shufflePuzzle();
    moves = 0;
    elapsed = 0;
    timerStarted = false; // 🔽 Reset flag
    clearInterval(timerInterval); // 🔽 Stop timer
    updateHUD();
  });

  // ============ RESTART BTN ============
  $('restartBtn').addEventListener('click', () => {
    if(state !== 'PLAYING') return;
    clearInterval(timerInterval);
    moves = 0;
    elapsed = 0;
    timerStarted = false; // 🔽 Reset flag
    updateHUD();
    createPuzzle();
    // shufflePuzzle() sudah dipanggil di dalam createPuzzle()
  });

  // ============ MENU BTN ============
  $('menuBtn').addEventListener('click', goToMenu);
  $('winMenuBtn').addEventListener('click', goToMenu);

  function goToMenu(){
    clearInterval(timerInterval);
    state = 'MENU';
    winOverlay.classList.remove('active');
    hintOverlay.classList.remove('active');
    showScreen(menuScreen);
    displayHighScores();
  }

  // ============ PLAY AGAIN ============
  $('playAgainBtn').addEventListener('click', () => {
    winOverlay.classList.remove('active');
    state = 'PLAYING';
    moves = 0;
    elapsed = 0;
    timerStarted = false; // 🔽 Reset flag
    updateHUD();
    createPuzzle();
    // shufflePuzzle() sudah dipanggil di dalam createPuzzle()
  });

  // ============ INIT ============
  displayHighScores();

})();