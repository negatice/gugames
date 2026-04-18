// ============================================================
//  AUDIO ENGINE
// ============================================================
const AudioEngine = (() => {
  let ctx;
  const init = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); };
  const playTone = (freq, dur, type='square', vol=0.1) => {
    if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + dur);
  };
  return {
    init,
    tick: () => playTone(800, 0.08, 'square', 0.08),
    tickFinal: () => playTone(1200, 0.15, 'square', 0.12),
    success: () => { playTone(523, 0.15, 'sine', 0.12); setTimeout(()=>playTone(659,0.15,'sine',0.12),120); setTimeout(()=>playTone(784,0.3,'sine',0.15),240); },
    explode: () => {
      if (!ctx) return;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const src=ctx.createBufferSource(); src.buffer=buf;
      const g=ctx.createGain(); g.gain.setValueAtTime(0.3,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.5);
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3000,ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(100,ctx.currentTime+1);
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    },
    swap: () => playTone(600, 0.06, 'sine', 0.08),
    select: () => playTone(400, 0.05, 'sine', 0.06),
    wrong: () => { playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(()=>playTone(150,0.3,'sawtooth',0.1),150); }
  };
})();

// ============================================================
//  GAME STATE MACHINE
// ============================================================
const Game = (() => {
  const STATES = { MENU:0, LEVEL_INTRO:1, SHOW_SEQ:2, PLAYER_INPUT:3, RESULT:4, GAME_OVER:5, WIN:6 };
  let state = STATES.MENU;

      const LEVELS = [
    { wires:2, memTime:3000, defuseTime:5 },   // Level 1: 5 detik
    { wires:3, memTime:3000, defuseTime:7 },   // Level 2: 7 detik
    { wires:4, memTime:3500, defuseTime:9 },   // Level 3: 9 detik
    { wires:5, memTime:4000, defuseTime:12 },   // Level 4: 12 detik
    { wires:6, memTime:4500, defuseTime:15 }   // Level 5: 15 detik
  ];

  const COLORS = [
    { name:'MERAH', hex:'#ff3344', dark:'#cc2233' },
    { name:'BIRU', hex:'#3399ff', dark:'#2266cc' },
    { name:'HIJAU', hex:'#33ff88', dark:'#22cc66' },
    { name:'KUNING', hex:'#ffcc33', dark:'#cc9922' },
    { name:'UNGU', hex:'#cc66ff', dark:'#9944cc' },
    { name:'ORANYE', hex:'#ff8833', dark:'#cc6622' },
    { name:'CYAN', hex:'#33ffcc', dark:'#22cc99' },
    { name:'PINK', hex:'#ff66aa', dark:'#cc4488' },
    { name:'PUTIH', hex:'#eeeeee', dark:'#bbbbbb' },
    { name:'COKLAT', hex:'#aa7744', dark:'#886633' }
  ];

  let hardcore = false, currentLevel = 0, score = 0, combo = 0, maxCombo = 0;
  let sequence = [], shuffled = [], selectedSlot = -1, swapCount = 0, startTime = 0;
  let memTimer = null, tickInterval = null, defuseTimer = null;

  const $ = id => document.getElementById(id);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function updateHUD() {
    $('hud-level').textContent = `LEVEL ${currentLevel + 1}`;
    $('hud-score').textContent = `SCORE: ${score}`;
    $('hud-combo').textContent = combo > 1 ? `🔥 x${combo}` : '';
    $('progress-fill').style.width = `${(currentLevel / 4) * 100}%`;
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.every((v, i) => v === arr[i]) && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
    return a;
  }

  function renderWires(containerId, wireOrder, interactive = false) {
    const container = $(containerId);
    container.innerHTML = '';
    wireOrder.forEach((colorIdx, i) => {
      const c = COLORS[colorIdx];
      const slot = document.createElement('div');
      slot.className = 'wire-slot';
      slot.dataset.index = i;
      if (interactive) slot.onclick = () => handleSlotTap(i);
      slot.innerHTML = `<div class="wire-num">${i + 1}</div><div class="wire-color" style="background:${c.hex}"></div><div class="wire-label">${c.name}</div>`;
      container.appendChild(slot);
    });
  }

  function handleSlotTap(index) {
    AudioEngine.init();
    if (state !== STATES.PLAYER_INPUT) return;
    const slots = document.querySelectorAll('#play-wires .wire-slot');

    if (selectedSlot === -1) {
      selectedSlot = index;
      AudioEngine.select();
      slots[index].classList.add('selected');
    } else if (selectedSlot === index) {
      slots[selectedSlot].classList.remove('selected');
      selectedSlot = -1;
    } else {
      AudioEngine.swap();
      [shuffled[selectedSlot], shuffled[index]] = [shuffled[index], shuffled[selectedSlot]];
      swapCount++;
      slots[selectedSlot].classList.remove('selected');
      renderWires('play-wires', shuffled, true);
      selectedSlot = -1;
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }

  function startMemTimer(duration) {
    let remaining = Math.ceil(duration / 1000);
    $('timer-display').textContent = remaining;
    $('timer-display').className = '';

    tickInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        $('timer-display').textContent = remaining;
        AudioEngine.tick();
      } else {
        $('timer-display').textContent = 'GO!';
        $('timer-display').className = 'go';
        AudioEngine.tickFinal();
        clearInterval(tickInterval); tickInterval = null;
      }
    }, 1000);

    memTimer = setTimeout(() => {
      clearInterval(tickInterval); tickInterval = null;
      enterPlayerInput();
    }, duration + 600);
  }

  function startDefuseTimer() {
    let timeLeft = LEVELS[currentLevel].defuseTime; // ⬅️ ambil dari config level
    const el = $('defuse-timer');
    el.textContent = timeLeft < 10 ? `0${timeLeft}` : timeLeft; // ⬅️ format otomatis
    el.className = '';

    defuseTimer = setInterval(() => {
      timeLeft--;
      el.textContent = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
      AudioEngine.tick();
      
      if (timeLeft <= 2) el.className = 'urgent';
      if (timeLeft <= 0) {
        clearInterval(defuseTimer); defuseTimer = null;
        enterGameOver();
      }
    }, 1000);
  }

  function triggerExplosion() {
    const el = $('explosion');
    el.innerHTML = '<div class="explosion-core"></div>';
    el.classList.add('active');
    const flash = document.createElement('div'); flash.className = 'flash'; document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div'); p.className = 'particle';
      const a = (Math.PI * 2 * i) / 20, d = 80 + Math.random() * 120;
      p.style.cssText = `left:50%;top:50%;--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;background:${['#ff3344','#ff8800','#ffcc33','#fff'][Math.floor(Math.random()*4)]};width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;`;
      el.appendChild(p);
    }
    setTimeout(() => { el.classList.remove('active'); el.innerHTML = ''; }, 1500);
  }

  function triggerGreenFlash() {
    const f = document.createElement('div'); f.className = 'green-flash'; document.body.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }

  function enterLevelIntro() {
    state = STATES.LEVEL_INTRO;
    const lvl = LEVELS[currentLevel];
    $('intro-level').textContent = `LEVEL ${currentLevel + 1}`;
    $('intro-info').textContent = `${lvl.wires} Kabel — ${(lvl.memTime/1000).toFixed(1)}s Ingat`;
    showScreen('level-intro'); updateHUD();
    setTimeout(() => enterShowSequence(), 1500);
  }

  function enterShowSequence() {
    state = STATES.SHOW_SEQ; showScreen('show-sequence');
    sequence = []; const used = []; const count = LEVELS[currentLevel].wires;
    while (used.length < count) { const r = Math.floor(Math.random() * COLORS.length); if (!used.includes(r)) used.push(r); }
    sequence = [...used];
    shuffled = shuffleArray(sequence);
    renderWires('mem-wires', sequence, false);
    startMemTimer(LEVELS[currentLevel].memTime);
  }

  function enterPlayerInput() {
    clearTimeout(memTimer); clearInterval(tickInterval); memTimer = null; tickInterval = null;
    state = STATES.PLAYER_INPUT; selectedSlot = -1; swapCount = 0; startTime = Date.now();
    showScreen('player-input');
    renderWires('play-wires', shuffled, true);
    updateHUD();
    startDefuseTimer();
  }

  function enterSuccess() {
    state = STATES.RESULT;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const base = (currentLevel + 1) * 100, tBonus = Math.max(0, 100 - elapsed * 5), sBonus = Math.max(0, 50 - swapCount * 5);
    const lvlScore = Math.floor((base + tBonus + sBonus) * (1 + combo * 0.2));
    score += lvlScore; combo++; if (combo > maxCombo) maxCombo = combo;

    AudioEngine.success(); triggerGreenFlash();
    document.querySelectorAll('#play-wires .wire-slot').forEach(s => s.classList.add('correct'));

    setTimeout(() => {
      $('stat-time').textContent = `${elapsed}s`; $('stat-swaps').textContent = swapCount;
      $('stat-score').textContent = `+${lvlScore}`; $('stat-combo').textContent = combo > 1 ? `x${combo}` : 'x1';
      if (currentLevel >= 4) setTimeout(() => enterWin(), 500);
      else showScreen('result-success');
      updateHUD();
    }, 500);
  }

  function enterGameOver() {
    state = STATES.GAME_OVER; combo = 0;
    AudioEngine.explode(); triggerExplosion();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    setTimeout(() => {
      $('fail-level').textContent = currentLevel + 1; $('fail-score').textContent = score;
      showScreen('result-fail');
    }, 1000);
  }

  function enterWin() {
    state = STATES.WIN; AudioEngine.success(); triggerGreenFlash();
    setTimeout(() => { $('win-score').textContent = score; $('win-combo').textContent = `x${maxCombo}`; showScreen('result-win'); updateHUD(); }, 600);
  }

  return {
    start(isHardcore) {
      AudioEngine.init();
      hardcore = isHardcore; currentLevel = 0; score = 0; combo = 0; maxCombo = 0;
      if (hardcore) {
        LEVELS.forEach(l => l.memTime = 1000); // Hanya override kalau mode Hardcore aktif
        }
      $('hud').style.display = 'flex'; $('progress-bar').style.display = 'block'; updateHUD();
      enterLevelIntro();
    },
    defuse() {
      AudioEngine.init();
      if (state !== STATES.PLAYER_INPUT) return;
      clearInterval(defuseTimer); defuseTimer = null;

      const correct = sequence.every((v, i) => v === shuffled[i]);
      if (correct) {
        enterSuccess();
      } else {
        document.querySelectorAll('#play-wires .wire-slot').forEach((s, i) => {
          if (sequence[i] !== shuffled[i]) s.classList.add('wrong');
        });
        AudioEngine.wrong();
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        setTimeout(() => enterGameOver(), 700);
      }
    },
    nextLevel() {
      currentLevel++;
      if (currentLevel >= 5) enterWin();
      else { selectedSlot = -1; enterLevelIntro(); }
    },
    retry() { currentLevel = 0; score = 0; combo = 0; maxCombo = 0; clearInterval(defuseTimer); defuseTimer = null; updateHUD(); enterLevelIntro(); },
    toMenu() {
      state = STATES.MENU; $('hud').style.display = 'none'; $('progress-bar').style.display = 'none';
      clearInterval(defuseTimer); defuseTimer = null; showScreen('menu');
    }
  };
})();

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