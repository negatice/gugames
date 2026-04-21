// ─── SOUND ENGINE ───
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let soundEnabled = true;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type = 'sine', vol = 0.15) {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function sndDraw() { playTone(600, 0.08, 'sine', 0.1); playTone(800, 0.06, 'sine', 0.08); }
function sndFlip() { playTone(400, 0.1, 'triangle', 0.1); }
function sndWin() {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.15), 200);
}
function sndLose() {
  playTone(400, 0.2, 'sawtooth', 0.08);
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.06), 150);
}
function sndBJ() {
  playTone(523, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.15), 80);
  setTimeout(() => playTone(784, 0.1, 'sine', 0.15), 160);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.18), 240);
}
function sndChip() { playTone(1200, 0.05, 'sine', 0.1); }

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-btn').textContent = soundEnabled ? '🔊' : '🔇';
}

// ─── GAME STATE ───
let balance = 1000;
let currentBet = 100;
let deck = [];
let playerHand = [];
let dealerHand = [];
let gamePhase = 'betting';
let stats = { wins: 0, losses: 0, draws: 0, bj: 0, profit: 0, streak: 0, currentStreak: 0 };

const suits = ['♠','♥','♦','♣'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// ─── DECK FUNCTIONS ───
function createDeck() {
  deck = [];
  for (let s of suits) {
    for (let r of ranks) {
      let points = (r === 'A') ? 11 : (['K','Q','J'].includes(r)) ? 10 : parseInt(r);
      deck.push({ suit: s, rank: r, points: points });
    }
  }
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function drawCard() {
  if (deck.length < 10) { createDeck(); shuffleDeck(); }
  return deck.pop();
}

// ─── SCORE ───
function calcScore(hand) {
  let total = 0, aces = 0;
  for (let card of hand) {
    total += card.points;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && calcScore(hand) === 21;
}

// ─── BET ───
function selectBet(el, value) {
  if (gamePhase !== 'betting') return;
  sndChip();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  if (value === 'all') {
    currentBet = balance;
  } else {
    currentBet = Math.min(value, balance);
  }
  document.getElementById('bet-display').textContent = `💰 ${currentBet}`;
}

// ─── RENDER CARDS ───
function renderCard(card, hidden = false, index = 0, isPlayer = true) {
  const div = document.createElement('div');
  div.className = 'card dealing';
  div.style.animationDelay = `${index * 200}ms`;
  div.style.opacity = '0';

  const isRed = card.suit === '♥' || card.suit === '♦';

  div.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-front ${isRed ? 'red' : 'black'}">
        <div class="card-corner top-left">
          <span class="rank">${card.rank}</span>
          <span class="suit-small">${card.suit}</span>
        </div>
        <div class="card-center">${card.suit}</div>
        <div class="card-corner bottom-right">
          <span class="rank">${card.rank}</span>
          <span class="suit-small">${card.suit}</span>
        </div>
      </div>
      <div class="card-face card-back"></div>
    </div>
  `;

  const area = document.getElementById(isPlayer ? 'player-cards' : 'dealer-cards');
  area.appendChild(div);

  if (hidden) {
    div.classList.add('flipped');
  }

  return div;
}

function updateScores(showDealerFull = false) {
  const pScore = calcScore(playerHand);
  const pBadge = document.getElementById('player-score');
  pBadge.textContent = pScore;
  pBadge.className = 'score-badge';
  if (isBlackjack(playerHand)) pBadge.classList.add('blackjack');
  if (pScore > 21) pBadge.classList.add('bust');

  const dBadge = document.getElementById('dealer-score');
  if (showDealerFull) {
    dBadge.textContent = calcScore(dealerHand);
    dBadge.className = 'score-badge';
    if (isBlackjack(dealerHand)) dBadge.classList.add('blackjack');
    if (calcScore(dealerHand) > 21) dBadge.classList.add('bust');
  } else {
    dBadge.textContent = dealerHand.length > 0 ? `${dealerHand[0].points}+?` : '0';
    dBadge.className = 'score-badge';
  }
}

// ─── GAME FLOW ───
async function startRound() {
  if (balance <= 0) return;
  if (currentBet > balance) {
    currentBet = balance;
    document.getElementById('bet-display').textContent = `💰 ${currentBet}`;
  }

  sndChip();
  gamePhase = 'playing';

  // FIX: Kurangi balance saat deal (sebelumnya tidak pernah dikurangi!)
  balance -= currentBet;
  updateBalanceDisplay();

  // Clear
  document.getElementById('player-cards').innerHTML = '';
  document.getElementById('dealer-cards').innerHTML = '';
  playerHand = [];
  dealerHand = [];

  createDeck();
  shuffleDeck();

  // Hide bet area
  document.getElementById('bet-area').classList.add('hidden');

  // Sembunyikan tombol play again
  const playAgainBtn = document.getElementById('play-again-btn');
  playAgainBtn.classList.remove('visible');

  // Deal cards with delay
  const p1 = drawCard(); playerHand.push(p1); renderCard(p1, false, 0, true); sndDraw();
  await delay(250);

  const d1 = drawCard(); dealerHand.push(d1); renderCard(d1, false, 0, false); sndDraw();
  await delay(250);

  const p2 = drawCard(); playerHand.push(p2); renderCard(p2, false, 1, true); sndDraw();
  await delay(250);

  const d2 = drawCard(); dealerHand.push(d2); renderCard(d2, true, 1, false); sndDraw();
  await delay(300);

  updateScores(false);

  // Check instant blackjack
  if (isBlackjack(playerHand)) {
    if (isBlackjack(dealerHand)) {
      await endRound('draw');
    } else {
      await endRound('blackjack');
    }
    return;
  }

  if (isBlackjack(dealerHand)) {
    await endRound('dealer-bj');
    return;
  }

  // Show controls
  document.getElementById('game-controls').style.display = 'flex';
  updateDoubleAvailability();
}

function updateDoubleAvailability() {
  const doubleBtn = document.querySelector('.btn-double');
  // FIX: balance sudah dikurangi bet, jadi cek apakah masih ada cukup untuk double (satu bet lagi)
  doubleBtn.disabled = balance < currentBet || playerHand.length > 2;
}

async function playerHit() {
  if (gamePhase !== 'playing') return;
  sndDraw();

  const card = drawCard();
  playerHand.push(card);
  renderCard(card, false, 0, true);
  updateScores(false);
  updateDoubleAvailability();

  const score = calcScore(playerHand);
  if (score > 21) {
    await delay(400);
    await endRound('bust');
  } else if (score === 21) {
    await delay(300);
    await playerStand();
  }
}

async function playerStand() {
  if (gamePhase !== 'playing') return;
  gamePhase = 'dealer';

  document.getElementById('game-controls').style.display = 'none';

  // Reveal dealer hidden card
  const dealerCards = document.getElementById('dealer-cards').children;
  if (dealerCards.length > 1) {
    const hiddenCard = dealerCards[1];
    hiddenCard.classList.remove('flipped');
    sndFlip();
  }

  updateScores(true);
  await delay(500);

  // Dealer draws
  while (calcScore(dealerHand) < 17) {
    sndDraw();
    const card = drawCard();
    dealerHand.push(card);
    renderCard(card, false, 0, false);
    updateScores(true);
    await delay(500);
  }

  await delay(300);

  // Compare
  const pScore = calcScore(playerHand);
  const dScore = calcScore(dealerHand);

  if (dScore > 21) {
    await endRound('dealer-bust');
  } else if (pScore > dScore) {
    await endRound('win');
  } else if (pScore < dScore) {
    await endRound('lose');
  } else {
    await endRound('draw');
  }
}

async function playerDouble() {
  if (gamePhase !== 'playing' || balance < currentBet || playerHand.length > 2) return;

  sndChip();
  // FIX: Kurangi balance sebesar currentBet (bet tambahan), lalu double currentBet
  balance -= currentBet;
  currentBet *= 2;
  updateBalanceDisplay();

  sndDraw();
  const card = drawCard();
  playerHand.push(card);
  renderCard(card, false, 0, true);
  updateScores(false);

  await delay(400);

  const score = calcScore(playerHand);
  if (score > 21) {
    await endRound('bust');
  } else {
    await playerStand();
  }
}

async function endRound(result) {
  gamePhase = 'result';
  document.getElementById('game-controls').style.display = 'none';

  let resultText, resultSub, resultAmount, overlayClass, textClass, amountClass;
  // FIX: 'payout' adalah total yang dikembalikan ke balance (termasuk bet asli jika menang)
  // Balance sudah dikurangi saat deal, jadi:
  // - Win: kembalikan currentBet x2 (bet + profit)
  // - Blackjack: kembalikan currentBet + floor(currentBet * 1.5) (bet + 1.5x profit)
  // - Draw: kembalikan currentBet (bet saja, tanpa untung rugi)
  // - Lose/Bust: tidak kembalikan apa-apa (bet sudah hangus)
  let payout = 0;
  let profitDelta = 0;

  switch(result) {
    case 'blackjack':
      payout = currentBet + Math.floor(currentBet * 1.5);
      profitDelta = Math.floor(currentBet * 1.5);
      balance += payout;
      resultText = 'BLACKJACK!';
      resultSub = 'Natural 21!';
      resultAmount = `+${profitDelta}`;
      overlayClass = 'blackjack-win';
      textClass = 'bj-text';
      amountClass = 'positive';
      stats.bj++;
      stats.wins++;
      stats.profit += profitDelta;
      stats.currentStreak++;
      if (stats.currentStreak > stats.streak) stats.streak = stats.currentStreak;
      break;

    case 'win':
    case 'dealer-bust':
      payout = currentBet * 2;
      profitDelta = currentBet;
      balance += payout;
      resultText = 'YOU WIN!';
      resultSub = result === 'dealer-bust' ? 'Dealer Bust!' : 'Closer to 21!';
      resultAmount = `+${profitDelta}`;
      overlayClass = 'win';
      textClass = 'win-text';
      amountClass = 'positive';
      stats.wins++;
      stats.profit += profitDelta;
      stats.currentStreak++;
      if (stats.currentStreak > stats.streak) stats.streak = stats.currentStreak;
      break;

    case 'bust':
    case 'lose':
    case 'dealer-bj':
      // Tidak ada payout — bet sudah hangus saat deal
      profitDelta = -currentBet;
      resultText = result === 'bust' ? 'BUST!' : (result === 'dealer-bj' ? 'DEALER BJ!' : 'YOU LOSE');
      resultSub = result === 'bust' ? 'Over 21!' : (result === 'dealer-bj' ? 'Dealer has Blackjack' : 'Dealer wins');
      resultAmount = `${profitDelta}`;
      overlayClass = 'lose';
      textClass = 'lose-text';
      amountClass = 'negative';
      stats.losses++;
      stats.profit += profitDelta;
      stats.currentStreak = 0;
      break;

    case 'draw':
      // Kembalikan bet asli
      balance += currentBet;
      profitDelta = 0;
      resultText = 'PUSH';
      resultSub = 'Tie game!';
      resultAmount = '±0';
      overlayClass = 'draw';
      textClass = 'draw-text';
      amountClass = '';
      stats.draws++;
      stats.currentStreak = 0;
      break;
  }

  updateBalanceDisplay();

  // Show overlay
  const overlay = document.getElementById('result-overlay');
  overlay.className = `result-overlay ${overlayClass} show`;
  document.getElementById('result-text').className = `result-text ${textClass}`;
  document.getElementById('result-text').textContent = resultText;
  document.getElementById('result-sub').textContent = resultSub;
  document.getElementById('result-amount').className = `result-amount ${amountClass}`;
  document.getElementById('result-amount').textContent = resultAmount;

  // Sounds & FX
  if (result === 'blackjack') { sndBJ(); spawnConfetti(); }
  else if (result === 'win' || result === 'dealer-bust') { sndWin(); }
  else if (result === 'bust' || result === 'lose' || result === 'dealer-bj') { sndLose(); }

  const gc = document.getElementById('game-container');
  if (result === 'win' || result === 'blackjack' || result === 'dealer-bust') {
    gc.classList.add('glow-green');
    setTimeout(() => gc.classList.remove('glow-green'), 1500);
  } else if (result === 'bust' || result === 'lose' || result === 'dealer-bj') {
    gc.classList.add('glow-red');
    setTimeout(() => gc.classList.remove('glow-red'), 1500);
  }

  // Tampilkan tombol Play Again setelah delay (ada di dalam overlay)
  setTimeout(() => {
    document.getElementById('play-again-btn').classList.add('visible');
  }, 800);

  // Check game over
  if (balance <= 0) {
    setTimeout(() => {
      document.getElementById('gameover-overlay').classList.add('show');
    }, 1200);
  }
}

function resetForNewRound() {
  // Sembunyikan overlay
  document.getElementById('result-overlay').classList.remove('show');
  document.getElementById('play-again-btn').classList.remove('visible');

  // Clear cards
  document.getElementById('player-cards').innerHTML = '';
  document.getElementById('dealer-cards').innerHTML = '';
  playerHand = [];
  dealerHand = [];

  // Reset scores
  document.getElementById('player-score').textContent = '0';
  document.getElementById('player-score').className = 'score-badge';
  document.getElementById('dealer-score').textContent = '0';
  document.getElementById('dealer-score').className = 'score-badge';

  // Reset bet
  currentBet = Math.min(100, balance);
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  const defaultChip = document.querySelector('.chip-100');
  if (defaultChip) defaultChip.classList.add('selected');
  document.getElementById('bet-display').textContent = `💰 ${currentBet}`;

  // Show bet area
  document.getElementById('bet-area').classList.remove('hidden');

  gamePhase = 'betting';
  updateBalanceDisplay();
}

function restartGame() {
  document.getElementById('gameover-overlay').classList.remove('show');
  balance = 1000;
  updateBalanceDisplay();
  stats = { wins: 0, losses: 0, draws: 0, bj: 0, profit: 0, streak: 0, currentStreak: 0 };
  resetForNewRound();
}

function updateBalanceDisplay() {
  document.getElementById('balance-display').textContent = balance;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── STATS ───
function toggleStats() {
  const panel = document.getElementById('stats-panel');
  if (panel.classList.contains('show')) {
    panel.classList.remove('show');
  } else {
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-losses').textContent = stats.losses;
    document.getElementById('stat-draws').textContent = stats.draws;
    document.getElementById('stat-bj').textContent = stats.bj;
    document.getElementById('stat-profit').textContent = (stats.profit >= 0 ? '+' : '') + stats.profit;
    document.getElementById('stat-profit').style.color = stats.profit >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('stat-streak').textContent = stats.streak;
    panel.classList.add('show');
  }
}

// ─── CONFETTI ───
function spawnConfetti() {
  const container = document.getElementById('game-container');
  const colors = ['#ffd700','#ff6b6b','#4ade80','#60a5fa','#c084fc','#fbbf24'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = '-10px';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = (1 + Math.random()) + 's';
    piece.style.width = (6 + Math.random() * 6) + 'px';
    piece.style.height = (6 + Math.random() * 6) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 2000);
  }
}

// ─── INIT ───
createDeck();
shuffleDeck();