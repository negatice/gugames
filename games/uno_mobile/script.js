// ============ GAME STATE ============
let G = {
  deck: [], discard: [], drawPile: [],
  players: [], // [{hand:[], name:'', isAI:false}]
  currentPlayer: 0, direction: 1,
  colorCount: 1, // number of AI opponents
  activeColor: '', activeValue: '',
  phase: 'idle', // idle, playing, drawing, choosing, gameover
  pendingDraw: 0, // cumulative draw from +2/+4
  playerCalledUno: false,
  scores: [0, 0, 0, 0],
  drawOnce: false, // after drawing one card, can play or pass
  turnTimer: null,
  audioEnabled: true
};

const COLORS = ['red','yellow','green','blue'];
const COLOR_EMOJI = {red:'🔴',yellow:'🟡',green:'🟢',blue:'🔵'};
const COLOR_HEX = {red:'#e74c3c',yellow:'#f1c40f',green:'#2ecc71',blue:'#3498db'};

// ============ AUDIO SYSTEM (Web Audio API) ============
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!G.audioEnabled) return;
  
  const ctx = initAudio();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  switch(type) {
    case 'draw':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      break;
      
    case 'play':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      break;
      
    case 'undo':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      break;
      
    case 'uno':
      osc.type = 'square';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
      
    case 'skip':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
      
    case 'reverse':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      break;
      
    case 'draw2':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.setValueAtTime(450, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(550, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
      
    case 'wild':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
      
    case 'wild4':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      break;
      
    case 'win':
      osc.type = 'square';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(587, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.3);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.45);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      break;
      
    case 'lose':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      break;
      
    case 'error':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      break;
  }
}

// ============ DECK GENERATION ============
function createDeck() {
  let deck = [];
  let id = 0;
  for (let c of COLORS) {
    deck.push({id:id++, color:c, type:'number', value:'0', display:'0'});
    for (let n = 1; n <= 9; n++) {
      deck.push({id:id++, color:c, type:'number', value:String(n), display:String(n)});
      deck.push({id:id++, color:c, type:'number', value:String(n), display:String(n)});
    }
    deck.push({id:id++, color:c, type:'skip', value:'skip', display:'🚫'});
    deck.push({id:id++, color:c, type:'skip', value:'skip', display:'🚫'});
    deck.push({id:id++, color:c, type:'reverse', value:'reverse', display:'🔁'});
    deck.push({id:id++, color:c, type:'reverse', value:'reverse', display:'🔁'});
    deck.push({id:id++, color:c, type:'draw2', value:'draw2', display:'+2'});
    deck.push({id:id++, color:c, type:'draw2', value:'draw2', display:'+2'});
  }
  for (let i = 0; i < 4; i++) {
    deck.push({id:id++, color:'wild', type:'wild', value:'wild', display:'🌈'});
    deck.push({id:id++, color:'wild', type:'wild4', value:'wild4', display:'+4'});
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============ GAME INIT ============
let aiCount = 1;

function selectAI(n) {
  aiCount = n;
  document.querySelectorAll('.ai-select button').forEach((b, i) => {
    b.classList.toggle('selected', i + 1 === n);
  });
}

function startGame() {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('game').style.display = 'flex';
  document.getElementById('gameOverScreen').classList.add('hidden');
  initGame();
  initAudio();
  setTimeout(() => playSound('undo'), 300);
}

function restartGame() {
  document.getElementById('gameOverScreen').classList.add('hidden');
  initGame();
  playSound('undo');
}

function initGame() {
  G.deck = shuffle(createDeck());
  G.discard = [];
  G.players = [];
  G.currentPlayer = 0;
  G.direction = 1;
  G.pendingDraw = 0;
  G.playerCalledUno = false;
  G.drawOnce = false;
  G.phase = 'idle';
  G.scores = [0, 0, 0, 0];

  G.players.push({hand: [], name: 'Kamu', isAI: false});
  for (let i = 0; i < aiCount; i++) {
    G.players.push({hand: [], name: `AI ${i+1}`, isAI: true});
  }

  for (let p of G.players) {
    p.hand = G.deck.splice(0, 7);
  }

  let firstCard = G.deck.shift();
  while (firstCard.type === 'wild' || firstCard.type === 'wild4') {
    G.deck.push(firstCard);
    shuffle(G.deck);
    firstCard = G.deck.shift();
  }
  G.discard.push(firstCard);
  G.activeColor = firstCard.color;
  G.activeValue = firstCard.value;

  if (firstCard.type === 'skip' || firstCard.type === 'reverse') {
    G.currentPlayer = 0;
  } else if (firstCard.type === 'draw2') {
    G.pendingDraw = 2;
  }

  updateUI();
  showMessage('Game Dimulai! 🎉', 'Habiskan semua kartu!', 1200);

  if (G.players[0].isAI) {
    setTimeout(() => aiTurn(), 800);
  }
}

// ============ GAME LOGIC ============
function canPlay(hand, color, value) {
  return hand.some(c => isValidCard(c, color, value));
}

function isValidCard(card, color, value) {
  if (card.type === 'wild' || card.type === 'wild4') return true;
  if (card.color === color) return true;
  if (card.value === value) return true;
  return false;
}

function getValidCards(hand) {
  return hand.filter(c => isValidCard(c, G.activeColor, G.activeValue));
}

function canPlayAny(playerIdx) {
  if (G.pendingDraw > 0) {
    return G.players[playerIdx].hand.some(c =>
      (c.type === 'draw2' && G.activeValue === 'draw2') ||
      (c.type === 'wild4' && G.activeValue === 'wild4')
    );
  }
  return canPlay(G.players[playerIdx].hand, G.activeColor, G.activeValue);
}

function drawCards(playerIdx, count) {
  for (let i = 0; i < count; i++) {
    if (G.deck.length === 0) {
      if (G.discard.length <= 1) break;
      let top = G.discard.pop();
      G.deck = shuffle(G.discard);
      G.discard = [top];
    }
    if (G.deck.length > 0) {
      G.players[playerIdx].hand.push(G.deck.pop());
    }
  }
}

function nextPlayer() {
  let n = G.players.length;
  G.currentPlayer = (G.currentPlayer + G.direction + n) % n;
}

function playCard(playerIdx, cardIdx, animate = true) {
  let player = G.players[playerIdx];
  let card = player.hand[cardIdx];
  
  if (animate && playerIdx === 0) {
    // Show flying card animation
    showFlyingCardAnimation(cardIdx);
  }

  player.hand.splice(cardIdx, 1);
  G.discard.push(card);
  G.activeValue = card.value;

  if (card.type === 'wild' || card.type === 'wild4') {
    if (card.type === 'wild4') G.pendingDraw += 4;
    if (card.type === 'wild4') playSound('wild4');
    else playSound('wild');
    
    if (player.isAI) {
      let colorCounts = {red:0,yellow:0,green:0,blue:0};
      player.hand.forEach(c => { if(c.color !== 'wild') colorCounts[c.color]++; });
      let best = Object.entries(colorCounts).sort((a,b)=>b[1]-a[1])[0];
      G.activeColor = best[0];
      processAction(playerIdx, card);
    } else {
      G.phase = 'choosing';
      playSound('wild');
      showColorPicker(playerIdx, card);
      return;
    }
  } else {
    G.activeColor = card.color;
    playSound('play');
    processAction(playerIdx, card);
  }
}

function processAction(playerIdx, card) {
  let n = G.players.length;

  if (card.type === 'skip') {
    playSound('skip');
    showMessage('🚫 Skip!', `${G.players[playerIdx].name} skip pemain berikutnya!`, 1000);
    nextPlayer();
    nextPlayer();
  } else if (card.type === 'reverse') {
    playSound('reverse');
    G.direction *= -1;
    showMessage('🔁 Reverse!', `Arah dibalik!`, 800);
    if (n === 2) {
      nextPlayer();
    }
    nextPlayer();
  } else if (card.type === 'draw2') {
    playSound('draw2');
    let next = (G.currentPlayer + G.direction + n) % n;
    showMessage('➕2!', `${G.players[next].name} harus draw 2!`, 1000);
    G.pendingDraw += 2;
    if (!canStack(next)) {
      setTimeout(() => {
        drawCards(next, G.pendingDraw);
        G.pendingDraw = 0;
        nextPlayer();
        afterPlay(playerIdx);
      }, 1100);
      return;
    } else {
      nextPlayer();
      afterPlay(playerIdx);
      return;
    }
  } else {
    nextPlayer();
  }

  afterPlay(playerIdx);
}

function canStack(playerIdx) {
  if (G.pendingDraw > 0) {
    if (G.activeValue === 'draw2') {
      return G.players[playerIdx].hand.some(c => c.type === 'draw2');
    } else if (G.activeValue === 'wild4') {
      return G.players[playerIdx].hand.some(c => c.type === 'wild4');
    }
  }
  return false;
}

function afterPlay(playerIdx) {
  let player = G.players[playerIdx];

  if (player.hand.length === 0) {
    endGame(playerIdx);
    return;
  }

  if (player.hand.length === 1 && !player.isAI) {
    if (!G.playerCalledUno) {
      showMessage('😱 UNO!', 'Kamu lupa teriak UNO! +2 kartu', 1500);
      playSound('error');
      drawCards(playerIdx, 2);
    }
    G.playerCalledUno = false;
  }

  if (player.hand.length === 1 && player.isAI) {
    if (Math.random() < 0.3) {
      showMessage('😱 AI Lupa UNO!', `${player.name} dapat +2!`, 1000);
      setTimeout(() => drawCards(playerIdx, 2), 500);
    }
  }

  G.pendingDraw = 0;
  G.drawOnce = false;
  updateUI();

  setTimeout(() => {
    if (G.phase === 'gameover') return;
    G.phase = 'playing';
    let cp = G.players[G.currentPlayer];
    if (cp.isAI) {
      aiTurn();
    } else {
      updateUI();
      if (!canPlayAny(G.currentPlayer)) {
        if (!G.drawOnce) {
          playerDraw();
        }
      }
    }
  }, 600);
}

function endGame(winnerIdx) {
  G.phase = 'gameover';
  let player = G.players[winnerIdx];
  G.scores[winnerIdx]++;

  if (winnerIdx === 0) {
    document.getElementById('resultTitle').textContent = '🎉 MENANG!';
    document.getElementById('resultText').textContent = 'Kamu menghabakan semua kartu!';
    playSound('win');
  } else {
    document.getElementById('resultTitle').textContent = '😢 KALAH!';
    document.getElementById('resultText').textContent = `${player.name} menang!`;
    playSound('lose');
  }
  document.getElementById('resultScore').textContent = `Skor: Kamu ${G.scores[0]} - ${player.name} ${G.scores[winnerIdx]}`;

  setTimeout(() => {
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }, 800);
}

// ============ FLYING CARD ANIMATION ============
function showFlyingCardAnimation(handIdx) {
  let card = G.players[0].hand[handIdx];
  let cardEl = document.querySelector(`.hand-card[data-idx="${handIdx}"]`);
  if (!cardEl) return;

  let rect = cardEl.getBoundingClientRect();
  let discardRect = document.getElementById('discardCard').getBoundingClientRect();
  
  let flyingCard = document.createElement('div');
  flyingCard.className = 'flying-card';
  flyingCard.innerHTML = `
    <span class="card-corner corner-tl">${card.display}</span>
    <span class="card-center">${card.display}</span>
    <span class="card-corner corner-br">${card.display}</span>
  `;
  
  if (card.type === 'number') {
    flyingCard.style.background = COLOR_HEX[card.color];
  } else if (card.type === 'wild' || card.type === 'wild4') {
    flyingCard.style.background = 'linear-gradient(135deg,#e74c3c,#f1c40f,#2ecc71,#3498db)';
  } else {
    flyingCard.style.background = 'linear-gradient(135deg,#6b7280,#9ca3af)';
  }

  flyingCard.style.left = rect.left + 'px';
  flyingCard.style.top = rect.top + 'px';
  flyingCard.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
  
  document.body.appendChild(flyingCard);

  setTimeout(() => {
    let centerX = discardRect.left + discardRect.width / 2 - 30;
    let centerY = discardRect.top + discardRect.height / 2 - 42.5;
    flyingCard.style.transition = 'all 0.4s cubic-bezier(0.47, 0, 0.745, 0.715)';
    flyingCard.style.transform = `translate(${centerX - rect.left}px, ${centerY - rect.top}px) rotate(180deg)`;
  }, 50);

  setTimeout(() => {
    flyingCard.remove();
  }, 500);
}

// ============ PLAYER ACTIONS ============
function playerDraw() {
  if (G.phase === 'gameover') return;
  if (G.currentPlayer !== 0) return;
  if (G.phase === 'choosing') return;

  playSound('draw');

  if (G.pendingDraw > 0) {
    if (!canStack(0)) {
      showMessage(`➕${G.pendingDraw}`, `Kamu harus ambil ${G.pendingDraw} kartu!`, 1000);
      drawCards(0, G.pendingDraw);
      G.pendingDraw = 0;
      G.drawOnce = false;
      nextPlayer();
      updateUI();
      setTimeout(() => {
        if (G.phase === 'gameover') return;
        G.phase = 'playing';
        if (G.players[G.currentPlayer].isAI) aiTurn();
      }, 600);
      return;
    }
    updateUI();
    return;
  }

  if (!G.drawOnce) {
    drawCards(0, 1);
    G.drawOnce = true;
    updateUI();

    let drawnCard = G.players[0].hand[G.players[0].hand.length - 1];
    if (isValidCard(drawnCard, G.activeColor, G.activeValue)) {
      document.getElementById('btnPass').disabled = false;
    } else {
      G.drawOnce = false;
      nextPlayer();
      updateUI();
      setTimeout(() => {
        if (G.phase === 'gameover') return;
        G.phase = 'playing';
        if (G.players[G.currentPlayer].isAI) aiTurn();
      }, 600);
    }
  }
}

function playerPass() {
  if (!G.drawOnce) return;
  playSound('undo');
  G.drawOnce = false;
  nextPlayer();
  updateUI();
  setTimeout(() => {
    if (G.phase === 'gameover') return;
    G.phase = 'playing';
    if (G.players[G.currentPlayer].isAI) aiTurn();
  }, 600);
}

function playPlayerCard(cardIdx) {
  if (G.phase === 'gameover') return;
  if (G.currentPlayer !== 0) return;
  if (G.phase === 'choosing') return;

  let card = G.players[0].hand[cardIdx];

  if (G.pendingDraw > 0) {
    if (!((card.type === 'draw2' && G.activeValue === 'draw2') ||
          (card.type === 'wild4' && G.activeValue === 'wild4'))) {
      shakeHand();
      playSound('error');
      return;
    }
  } else if (!isValidCard(card, G.activeColor, G.activeValue)) {
    shakeHand();
    playSound('error');
    return;
  }

  G.phase = 'playing';
  G.drawOnce = false;
  document.getElementById('btnPass').disabled = true;

  let cardEl = document.querySelector(`.hand-card[data-idx="${cardIdx}"]`);
  if (cardEl) cardEl.classList.add('playing');

  setTimeout(() => {
    playCard(0, cardIdx);
  }, 300);
}

function callUno() {
  if (G.players[0].hand.length === 2) {
    G.playerCalledUno = true;
    showMessage('🔴 UNO!', 'Siap! Satu kartu lagi!', 800);
    playSound('uno');
    document.getElementById('btnUno').disabled = true;
    document.getElementById('unoFloating').classList.remove('show');
  }
}

function pickColor(color) {
  G.activeColor = color;
  G.phase = 'playing';
  document.getElementById('colorPicker').classList.remove('show');
  let card = G.discard[G.discard.length - 1];
  processAction(0, card);
}

function showColorPicker(playerIdx, card) {
  document.getElementById('colorPicker').classList.add('show');
}

function shakeHand() {
  let hc = document.getElementById('handContainer');
  hc.classList.add('shake');
  setTimeout(() => hc.classList.remove('shake'), 300);
}

// ============ AI LOGIC ============
function aiTurn() {
  if (G.phase === 'gameover') return;
  let ai = G.players[G.currentPlayer];
  if (!ai.isAI) return;

  G.phase = 'ai-thinking';
  updateUI();

  let delay = 600 + Math.random() * 600;

  setTimeout(() => {
    if (G.phase === 'gameover') return;

    if (G.pendingDraw > 0) {
      if (!canStack(G.currentPlayer)) {
        showMessage(`➕${G.pendingDraw}`, `${ai.name} ambil ${G.pendingDraw} kartu!`, 1000);
        drawCards(G.currentPlayer, G.pendingDraw);
        G.pendingDraw = 0;
        G.drawOnce = false;
        nextPlayer();
        updateUI();
        setTimeout(() => {
          if (G.phase === 'gameover') return;
          G.phase = 'playing';
          if (G.players[G.currentPlayer].isAI) aiTurn();
        }, 600);
        return;
      }
    }

    let valid = [];
    for (let i = 0; i < ai.hand.length; i++) {
      let c = ai.hand[i];
      if (G.pendingDraw > 0) {
        if ((c.type === 'draw2' && G.activeValue === 'draw2') ||
            (c.type === 'wild4' && G.activeValue === 'wild4')) {
          valid.push(i);
        }
      } else if (isValidCard(c, G.activeColor, G.activeValue)) {
        valid.push(i);
      }
    }

    if (valid.length === 0) {
      drawCards(G.currentPlayer, 1);
      updateUI();

      let drawn = ai.hand[ai.hand.length - 1];
      if (G.pendingDraw > 0) {
        if (!((drawn.type === 'draw2' && G.activeValue === 'draw2') ||
              (drawn.type === 'wild4' && G.activeValue === 'wild4'))) {
          nextPlayer();
          updateUI();
          setTimeout(() => {
            if (G.phase === 'gameover') return;
            G.phase = 'playing';
            if (G.players[G.currentPlayer].isAI) aiTurn();
          }, 600);
          return;
        }
      } else if (!isValidCard(drawn, G.activeColor, G.activeValue)) {
        nextPlayer();
        updateUI();
        setTimeout(() => {
          if (G.phase === 'gameover') return;
          G.phase = 'playing';
          if (G.players[G.currentPlayer].isAI) aiTurn();
        }, 600);
        return;
      }

      let drawnIdx = ai.hand.length - 1;
      setTimeout(() => {
        playCard(G.currentPlayer, drawnIdx);
      }, 500);
      return;
    }

    let chosenIdx = valid[0];

    let scores = valid.map(i => {
      let c = ai.hand[i];
      let score = 0;
      if (c.type === 'number') score = 1;
      else if (c.type === 'skip') score = 3;
      else if (c.type === 'reverse') score = 3;
      else if (c.type === 'draw2') score = 5;
      else if (c.type === 'wild') score = 2;
      else if (c.type === 'wild4') score = 6;

      if (c.type === 'wild4' && G.players[0].hand.length <= 3) score += 10;
      if (c.type === 'draw2' && G.players[0].hand.length <= 3) score += 5;

      if (c.type === 'wild' || c.type === 'wild4') {
        if (ai.hand.filter(x => x.type !== 'wild' && x.type !== 'wild4').length > 0) {
          score -= 3;
        }
        if (ai.hand.length === 1) score += 20;
      }

      if (c.color === G.activeColor) score += 1;

      return {idx: i, score};
    });

    scores.sort((a, b) => b.score - a.score);
    chosenIdx = scores[0].idx;

    playCard(G.currentPlayer, chosenIdx);
  }, delay);
}

// --- Turn Text di Tengah Layar ---
function updateTurnText() {
  const turnText = document.getElementById('turnText');
  
  if (G.phase === 'gameover') {
    turnText.textContent = '🎮 Game Over';
    turnText.className = 'center-turn-text player';
    return;
  }
  
  for (let i = 0; i < G.players.length; i++) {
    turnText.classList.toggle('player', i === G.currentPlayer);
    turnText.classList.toggle('ai', i !== G.currentPlayer);
  }
  
  if (G.currentPlayer === 0) {
    turnText.textContent = 'Giliranmu!';
  } else {
    turnText.textContent = `${G.players[G.currentPlayer].name}...`;
  }
  
  turnText.style.animation = 'none';
  setTimeout(() => {
    turnText.style.animation = '';
  }, 10);
}

// ============ UI RENDERING ============
function updateUI() {
  document.getElementById('direction').textContent = G.direction === 1 ? '🔄 →' : '🔄 ←';
  renderAICards();
  updateTurnText();
  renderDiscard();

  let ci = document.getElementById('colorIndicator');
  ci.style.background = COLOR_HEX[G.activeColor] || '#fff';
  document.getElementById('currentColorText').textContent =
    `Warna: ${COLOR_EMOJI[G.activeColor] || ''}`;

  renderHand();

  document.getElementById('btnDraw').disabled =
    G.currentPlayer !== 0 || G.phase === 'gameover' || G.phase === 'choosing' || G.phase === 'ai-thinking';
  document.getElementById('btnPass').disabled =
    !G.drawOnce || G.phase === 'gameover';

  document.getElementById('btnUno').disabled =
    G.players[0].hand.length !== 2 || G.playerCalledUno;

  if (G.players[0].hand.length === 2 && !G.playerCalledUno) {
    document.getElementById('unoFloating').classList.add('show');
    document.getElementById('btnUno').disabled = false;
  } else {
    document.getElementById('unoFloating').classList.remove('show');
  }

  document.getElementById('scorePlayer').textContent = G.scores[0];
  let aiScoreHTML = '';
  for (let i = 1; i < G.players.length; i++) {
    aiScoreHTML += `<span>${G.players[i].name}: <span class="score-val">${G.scores[i]}</span></span>`;
  }
  document.getElementById('aiScores').innerHTML = aiScoreHTML;
}

function renderAICards() {
  let area = document.getElementById('aiArea');
  area.innerHTML = '';
  for (let i = 1; i < G.players.length; i++) {
    let p = G.players[i];
    let row = document.createElement('div');
    row.className = 'ai-row';
    row.innerHTML = `
      <span class="ai-label">${p.isAI ? '🤖' : '👤'} ${p.name}</span>
      <div class="ai-cards">
        ${p.hand.map(() => '<div class="ai-card-back">UNO</div>').join('')}
      </div>
      <span class="ai-count">${p.hand.length} cards</span>
    `;
    if (G.currentPlayer === i) {
      row.style.opacity = '1';
    }
    area.appendChild(row);
  }
}

function renderDiscard() {
  let dc = document.getElementById('discardCard');
  if (G.discard.length === 0) {
    dc.innerHTML = '';
    dc.className = '';
    return;
  }
  let card = G.discard[G.discard.length - 1];
  dc.innerHTML = `
    <span class="card-corner corner-tl">${card.display}</span>
    <span class="card-center">${card.display}</span>
    <span class="card-corner corner-br">${card.display}</span>
  `;
  dc.className = card.type === 'wild' || card.type === 'wild4' ? 'wild-card' : 
               card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2' ? 'gray-card' : '';

  if (card.type === 'number') {
    dc.style.background = COLOR_HEX[card.color];
  } else if (card.type === 'wild' || card.type === 'wild4') {
    dc.style.background = 'linear-gradient(135deg,#e74c3c,#f1c40f,#2ecc71,#3498db)';
  } else if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') {
    dc.style.background = 'linear-gradient(135deg,#6b7280,#9ca3af)';
  } else {
    dc.style.background = '#e5e7eb';
  }
}

function renderHand() {
  let hc = document.getElementById('handContainer');
  hc.innerHTML = '';

  for (let i = 0; i < G.players[0].hand.length; i++) {
    let card = G.players[0].hand[i];
    let el = document.createElement('div');
    el.className = 'hand-card';
    el.dataset.idx = i;

    let isValid = false;
    if (G.currentPlayer === 0 && G.phase !== 'choosing' && G.phase !== 'gameover') {
      if (G.pendingDraw > 0) {
        isValid = (card.type === 'draw2' && G.activeValue === 'draw2') ||
                  (card.type === 'wild4' && G.activeValue === 'wild4');
      } else {
        isValid = isValidCard(card, G.activeColor, G.activeValue);
      }
    }

    if (isValid) {
      el.classList.add('valid');
    } else {
      el.classList.add('invalid');
    }

    if (card.type === 'number') {
      el.classList.add('number-card');
      el.style.background = COLOR_HEX[card.color];
    } else if (card.type === 'wild' || card.type === 'wild4') {
      el.classList.add('wild');
    } else if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') {
      el.classList.add('action-card');
    }

    el.innerHTML = `
      <span class="card-corner corner-tl">${card.display}</span>
      <span class="card-center">${card.display}</span>
      <span class="card-corner corner-br">${card.display}</span>
    `;

    el.addEventListener('click', () => playPlayerCard(i));
    el.addEventListener('touchstart', () => {}, {passive: true});

    hc.appendChild(el);
  }

  setTimeout(() => {
    let validCards = hc.querySelectorAll('.hand-card.valid');
    if (validCards.length > 0 && G.currentPlayer === 0) {
      validCards[0].scrollIntoView({behavior: 'smooth', inline: 'center', block: 'nearest'});
    }
  }, 100);
}

function showMessage(text, sub, duration) {
  let overlay = document.getElementById('messageOverlay');
  document.getElementById('msgText').textContent = text;
  document.getElementById('msgSub').textContent = sub || '';
  overlay.classList.add('show');
  if (duration) {
    setTimeout(() => overlay.classList.remove('show'), duration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Preload
});