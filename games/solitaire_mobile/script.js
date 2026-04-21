const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_COLORS = { '♠':'black','♣':'black','♥':'red','♦':'red' };

let state = {
  tableau: [],
  freeCells: [],
  foundation: [],
  moves: 0,
  startTime: null,
  timerInterval: null,
  history: [],
  won: false
};

let dragState = null;
let selectedCard = null;

// ─── AUDIO ───
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }
function playTone(freq, dur, vol=0.12, type='sine') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sndMove() { playTone(600, 0.08); }
function sndError() { playTone(200, 0.12, 0.1, 'square'); }
function sndFoundation() { playTone(800, 0.1); setTimeout(()=>playTone(1000, 0.08), 80); }
function sndWin() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.25,0.15),i*120)); }

// ─── DECK & INIT ───
function createDeck() {
  const deck = [];
  for (const s of SUITS)
    for (let v = 1; v <= 13; v++)
      deck.push({ suit:s, value:v, color:SUIT_COLORS[s], rank:RANKS[v-1] });
  return deck;
}
function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function newGame() {
  const deck = shuffle(createDeck());
  state.tableau = Array.from({length:8}, ()=>[]);
  state.freeCells = Array(4).fill(null);
  state.foundation = Array.from({length:4}, ()=>[]);
  state.moves = 0;
  state.history = [];
  state.won = false;
  selectedCard = null;

  let idx = 0;
  for (let col=0; col<8; col++) {
    const count = col < 4 ? 7 : 6;
    for (let i=0; i<count; i++) state.tableau[col].push(deck[idx++]);
  }

  state.startTime = Date.now();
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimer, 1000);

  saveGame();
  render();
  updateUI();
  document.getElementById('win-overlay').classList.remove('show');
}

function updateTimer() {
  const e = Math.floor((Date.now() - state.startTime)/1000);
  document.getElementById('timer').textContent =
    `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`;
}
function getElapsed() { return Math.floor((Date.now() - state.startTime)/1000); }
function calcScore() {
  const fCount = state.foundation.reduce((a,f)=>a+f.length,0);
  return Math.max(0, (fCount*100) + Math.max(0,5000-getElapsed()*2) - (state.moves*5));
}
function updateUI() {
  document.getElementById('moves').textContent = state.moves;
  document.getElementById('score').textContent = calcScore();
}

function saveGame() {
  try {
    localStorage.setItem('freecell_save', JSON.stringify({
      tableau:state.tableau, freeCells:state.freeCells,
      foundation:state.foundation, moves:state.moves,
      startTime:state.startTime, won:state.won
    }));
  } catch(e){}
}
function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem('freecell_save'));
    if (!d?.tableau) return false;
    Object.assign(state, {
      tableau:d.tableau, freeCells:d.freeCells, foundation:d.foundation,
      moves:d.moves, startTime:d.startTime, won:d.won||false, history:[]
    });
    if (!state.won) {
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = setInterval(updateTimer, 1000);
    }
    return true;
  } catch(e) { return false; }
}

// ─── RENDER ───
function cardHTML(card, topOffset=0) {
  return `<div class="card ${card.color}" data-suit="${card.suit}" data-value="${card.value}" style="top:${topOffset}px;">
    <div class="corner corner-tl"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span></div>
    <div class="center-suit">${card.suit}</div>
    <div class="corner corner-br"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span></div>
  </div>`;
}

function calcOverlap(col) {
  const count = state.tableau[col].length;
  if (count <= 1) return 0;
  const gameH = document.getElementById('game').clientHeight;
  const upperH = document.querySelector('.upper-row').offsetHeight;
  const avail = gameH - upperH - 40;
  const cardH = document.querySelector('.slot')?.offsetHeight || 70;
  const targetGap = cardH * 0.35;
  const maxFit = (avail - cardH) / (count - 1);
  return Math.max(20, Math.min(targetGap, maxFit));
}

function render() {
  // Free cells
  const fc = document.getElementById('free-cells');
  fc.innerHTML = '';
  for(let i=0; i<4; i++) {
    const s = document.createElement('div');
    s.className = 'slot'; s.dataset.type='free'; s.dataset.idx=i;
    if(state.freeCells[i]) {
      s.innerHTML = cardHTML(state.freeCells[i]);
      const c = s.querySelector('.card');
      c.dataset.from='free'; c.dataset.fromIdx=i;
    } else {
      s.innerHTML = '<span class="label">F</span>';
    }
    fc.appendChild(s);
  }

  // Foundation
  const fo = document.getElementById('foundations');
  fo.innerHTML = '';
  for(let i=0; i<4; i++) {
    const s = document.createElement('div');
    s.className = 'slot'; s.dataset.type='foundation'; s.dataset.idx=i;
    const pile = state.foundation[i];
    if(pile.length) {
      const top = pile[pile.length-1];
      s.innerHTML = cardHTML(top);
      const c = s.querySelector('.card');
      c.dataset.from='foundation'; c.dataset.fromIdx=i; c.dataset.top='1';
    } else {
      s.innerHTML = `<span class="label">${SUITS[i]}</span>`;
    }
    fo.appendChild(s);
  }

  // Tableau
  const ta = document.getElementById('tableau');
  ta.innerHTML = '';
  for(let col=0; col<8; col++) {
    const cDiv = document.createElement('div');
    cDiv.className = 'col'; cDiv.dataset.type='tableau'; cDiv.dataset.idx=col;
    if(state.tableau[col].length === 0) {
      cDiv.innerHTML = '<div class="slot"><span class="empty-label">▾</span></div>';
    } else {
      const overlap = calcOverlap(col);
      state.tableau[col].forEach((card, i) => {
        cDiv.insertAdjacentHTML('beforeend', cardHTML(card, i*overlap));
        const el = cDiv.lastElementChild;
        // FIX: store both col index AND card index correctly
        el.dataset.from='tableau';
        el.dataset.fromIdx=col;
        el.dataset.cardIdx=i;
      });
    }
    ta.appendChild(cDiv);
  }

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('.card').forEach(el =>
    el.addEventListener('pointerdown', onCardPointerDown)
  );
  document.querySelectorAll('.slot, .col').forEach(el =>
    el.addEventListener('pointerdown', onSlotPointerDown)
  );
}

// ─── DRAG & TAP SYSTEM ───
function onCardPointerDown(e) {
  initAudio();
  e.preventDefault();
  e.stopPropagation();
  if(e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);

  const cardEl = e.target.closest('.card');
  if(!cardEl || cardEl.dataset.from === 'foundation') { sndError(); return; }

  const from = cardEl.dataset.from;
  const fromIdx = parseInt(cardEl.dataset.fromIdx);
  let cards, source;

  if(from === 'free') {
    if(!state.freeCells[fromIdx]) return;
    cards = [state.freeCells[fromIdx]];
    source = { type:'free', idx:fromIdx };
  } else {
    // from === 'tableau'
    const colIdx = parseInt(cardEl.dataset.fromIdx);
    const cardIdx = parseInt(cardEl.dataset.cardIdx);
    const col = state.tableau[colIdx];
    if(isNaN(cardIdx) || cardIdx < 0 || cardIdx >= col.length) return;
    cards = col.slice(cardIdx);
    source = { type:'tableau', idx:colIdx, cardIdx:cardIdx };
  }

  if(!cards || !cards.length) return;

  // FIX: validate stack is a proper sequence before allowing drag
  if(!isValidStack(cards)) {
    sndError();
    showToast('Cards not in sequence');
    return;
  }

  const rect = cardEl.getBoundingClientRect();
  dragState = {
    cards, source,
    startX:e.clientX, startY:e.clientY,
    cardEl,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    moved: false,
    clone: null
  };

  const clone = createDragClone(cardEl, cards);
  clone.style.left = rect.left+'px';
  clone.style.top = rect.top+'px';
  document.body.appendChild(clone);
  dragState.clone = clone;
  cardEl.style.opacity = '0.2';

  document.addEventListener('pointermove', onPointerMove, {passive:false});
  document.addEventListener('pointerup', onPointerUp);
}

// FIX: validate that a stack of cards is alternating colors and descending values
function isValidStack(cards) {
  if(cards.length <= 1) return true;
  for(let i=0; i<cards.length-1; i++) {
    if(cards[i].color === cards[i+1].color) return false;
    if(cards[i].value !== cards[i+1].value + 1) return false;
  }
  return true;
}

function createDragClone(originalCard, cards) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;pointer-events:none;z-index:10000;';
  const overlap = 30;
  const w = originalCard.offsetWidth, h = originalCard.offsetHeight;
  for(let i=0; i<cards.length; i++) {
    const tmp = document.createElement('div');
    tmp.innerHTML = cardHTML(cards[i], 0);
    const c = tmp.firstElementChild;
    c.style.cssText = `position:absolute;left:0;top:${i*overlap}px;width:${w}px;height:${h}px;margin:0;box-shadow:0 8px 20px rgba(0,0,0,0.5);`;
    wrap.appendChild(c);
  }
  wrap.style.width = w+'px';
  wrap.style.height = h + (cards.length-1)*overlap + 'px';
  return wrap;
}

function onPointerMove(e) {
  if(!dragState) return;
  e.preventDefault();
  const dx = Math.abs(e.clientX - dragState.startX);
  const dy = Math.abs(e.clientY - dragState.startY);
  if(!dragState.moved && dx < 8 && dy < 8) return;

  dragState.moved = true;
  const x = e.clientX - dragState.offsetX;
  const y = e.clientY - dragState.offsetY;
  dragState.clone.style.left = x+'px';
  dragState.clone.style.top = y+'px';
  highlightValidTargets(e.clientX, e.clientY);
}

function onPointerUp(e) {
  if(!dragState) return;
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);

  try {
    if(dragState.clone) dragState.clone.remove();

    if(dragState.moved) {
      const target = findDropTarget(e.clientX, e.clientY);
      if(target) {
        tryMove(dragState.cards, dragState.source, target);
      } else {
        if(dragState.cardEl) dragState.cardEl.style.opacity = '1';
      }
    } else {
      // Tap: restore opacity then handle
      if(dragState.cardEl) dragState.cardEl.style.opacity = '1';
      handleTapMove(dragState.cards, dragState.source);
    }
  } catch(err) {
    console.error(err);
    if(dragState.cardEl) dragState.cardEl.style.opacity = '1';
    sndError();
  }

  clearHighlights();
  dragState = null;
}

function handleTapMove(cards, source) {
  // Clear previous selection
  selectedCard = null;
  clearHighlights();

  // Try auto-move to foundation first (single card)
  if(cards.length === 1) {
    const fIdx = findFoundationIndex(cards[0]);
    if(fIdx !== -1) {
      pushHistory();
      executeMove(cards, source, {type:'foundation', idx:fIdx});
      state.moves++;
      sndFoundation();
      autoMoveToFoundation();
      render(); updateUI(); saveGame(); checkWin();
      return;
    }
  }

  // Try to find any valid move automatically
  const targets = getValidTargets(cards, source);
  if(!targets.length) {
    sndError();
    showToast('No valid move');
    return;
  }

  // If only one target, auto-move
  if(targets.length === 1) {
    pushHistory();
    executeMove(cards, source, targets[0]);
    state.moves++;
    sndMove();
    if(targets[0].type === 'foundation') sndFoundation();
    autoMoveToFoundation();
    render(); updateUI(); saveGame(); checkWin();
    return;
  }

  // Multiple targets: highlight them and wait for tap on slot
  selectedCard = { cards, source };
  render(); // re-render to clear stale state
  targets.forEach(t => {
    const el = getSlotElement(t);
    if(el) el.classList.add('highlight');
  });
  showToast('Tap highlighted slot to move');
}

function onSlotPointerDown(e) {
  if(!selectedCard) return;
  e.stopPropagation();

  const slot = e.target.closest('.slot, .col');
  if(!slot) return;

  // Determine target from clicked element
  let targetType, idx;
  if(slot.classList.contains('col')) {
    targetType = 'tableau';
    idx = parseInt(slot.dataset.idx);
  } else {
    targetType = slot.dataset.type;
    idx = parseInt(slot.dataset.idx);
  }

  if(!targetType || isNaN(idx)) return;

  const target = { type:targetType, idx };
  if(validateMove(selectedCard.cards, selectedCard.source, target)) {
    pushHistory();
    executeMove(selectedCard.cards, selectedCard.source, target);
    state.moves++;
    sndMove();
    if(target.type === 'foundation') sndFoundation();
    selectedCard = null;
    autoMoveToFoundation();
    render(); updateUI(); saveGame(); checkWin();
  } else {
    sndError();
    selectedCard = null;
    clearHighlights();
  }
}

// ─── CORE MOVE LOGIC ───

// FIX: countEmptyFreeCells and countEmptyCols properly
function countEmptyFreeCells() {
  return state.freeCells.filter(f => f === null).length;
}

function countEmptyTableauCols(excludeColIdx) {
  return state.tableau.filter((col, i) => i !== excludeColIdx && col.length === 0).length;
}

// FIX: max movable stack size formula
// Moving to non-empty: (emptyFreeCells+1) * 2^(emptyCols)
// Moving to empty col: (emptyFreeCells+1) * 2^(emptyCols-1)  [the dest col counts as non-empty after]
function maxMovableCards(destColIdx) {
  const ef = countEmptyFreeCells();
  const ec = countEmptyTableauCols(destColIdx); // exclude dest col
  return (ef + 1) * Math.pow(2, ec);
}

function getValidTargets(cards, source) {
  const targets = [];
  const topCard = cards[0]; // topmost card being moved (lowest value in stack)

  // Free cell: only single card
  if(cards.length === 1) {
    for(let i=0; i<4; i++) {
      if(!state.freeCells[i]) targets.push({type:'free', idx:i});
    }
  }

  // Foundation: only single card
  if(cards.length === 1) {
    for(let i=0; i<4; i++) {
      const pile = state.foundation[i];
      if(pile.length === 0 && topCard.value === 1) {
        targets.push({type:'foundation', idx:i});
      } else if(pile.length > 0 &&
                pile[pile.length-1].suit === topCard.suit &&
                pile[pile.length-1].value === topCard.value - 1) {
        targets.push({type:'foundation', idx:i});
      }
    }
  }

  // Tableau columns
  for(let i=0; i<8; i++) {
    // Skip source column
    if(source.type === 'tableau' && source.idx === i) continue;

    const destCol = state.tableau[i];
    const maxCards = maxMovableCards(i);

    if(cards.length > maxCards) continue;

    if(destCol.length === 0) {
      // Can move to empty column (any card/stack)
      targets.push({type:'tableau', idx:i});
    } else {
      const destTop = destCol[destCol.length-1];
      // topCard must be opposite color and one less than dest top
      if(topCard.color !== destTop.color && topCard.value === destTop.value - 1) {
        targets.push({type:'tableau', idx:i});
      }
    }
  }

  return targets;
}

function validateMove(cards, source, target) {
  if(!cards || !cards.length) return false;
  const topCard = cards[0];

  if(target.type === 'free') {
    return cards.length === 1 && !state.freeCells[target.idx];
  }

  if(target.type === 'foundation') {
    if(cards.length !== 1) return false;
    const pile = state.foundation[target.idx];
    if(pile.length === 0) return topCard.value === 1;
    return pile[pile.length-1].suit === topCard.suit &&
           pile[pile.length-1].value === topCard.value - 1;
  }

  if(target.type === 'tableau') {
    // Skip same-source check
    if(source.type === 'tableau' && source.idx === target.idx) return false;

    const maxCards = maxMovableCards(target.idx);
    if(cards.length > maxCards) return false;

    const destCol = state.tableau[target.idx];
    if(destCol.length === 0) return true;

    const destTop = destCol[destCol.length-1];
    return topCard.color !== destTop.color && topCard.value === destTop.value - 1;
  }

  return false;
}

function pushHistory() {
  state.history.push({
    tableau: state.tableau.map(c => c.map(card => ({...card}))),
    freeCells: state.freeCells.map(c => c ? {...c} : null),
    foundation: state.foundation.map(f => f.map(card => ({...card}))),
    moves: state.moves
  });
  if(state.history.length > 50) state.history.shift();
}

function executeMove(cards, source, target) {
  // Remove from source
  if(source.type === 'free') {
    state.freeCells[source.idx] = null;
  } else if(source.type === 'tableau') {
    // FIX: splice from cardIdx, removing cards.length cards
    state.tableau[source.idx].splice(source.cardIdx, cards.length);
  }

  // Add to destination
  if(target.type === 'free') {
    state.freeCells[target.idx] = cards[0];
  } else if(target.type === 'foundation') {
    state.foundation[target.idx].push(cards[0]);
  } else if(target.type === 'tableau') {
    state.tableau[target.idx].push(...cards);
  }
}

function tryMove(cards, source, target) {
  if(!validateMove(cards, source, target)) {
    sndError();
    if(dragState?.cardEl) dragState.cardEl.style.opacity = '1';
    return;
  }

  pushHistory();
  executeMove(cards, source, target);
  state.moves++;
  sndMove();
  if(target.type === 'foundation') sndFoundation();

  autoMoveToFoundation();
  render(); updateUI(); saveGame(); checkWin();
}

function highlightValidTargets(x, y) {
  clearHighlights();
  if(!dragState) return;
  getValidTargets(dragState.cards, dragState.source).forEach(t => {
    const el = getSlotElement(t);
    if(el) el.classList.add('highlight');
  });
}

function clearHighlights() {
  document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
}

function findDropTarget(x, y) {
  const targets = getValidTargets(dragState.cards, dragState.source);
  for(const t of targets) {
    const el = getSlotElement(t);
    if(el) {
      const r = el.getBoundingClientRect();
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
    }
  }
  return null;
}

function getSlotElement(t) {
  if(t.type === 'free') {
    return document.querySelector(`#free-cells .slot[data-idx="${t.idx}"]`);
  }
  if(t.type === 'foundation') {
    return document.querySelector(`#foundations .slot[data-idx="${t.idx}"]`);
  }
  if(t.type === 'tableau') {
    // Target the col div (which acts as drop target for tableau)
    return document.querySelector(`#tableau .col[data-idx="${t.idx}"]`);
  }
  return null;
}

// ─── AUTO-MOVE TO FOUNDATION ───
function findFoundationIndex(card) {
  const idx = SUITS.indexOf(card.suit);
  const pile = state.foundation[idx];
  if(pile.length === 0) return card.value === 1 ? idx : -1;
  return (pile[pile.length-1].suit === card.suit &&
          pile[pile.length-1].value === card.value - 1) ? idx : -1;
}

function canSafelyAutoMove(card) {
  // Only auto-move if all cards of lower value (opposite color) are already on foundation
  // Prevents moving cards that might be needed for other moves
  const oppColor = card.color === 'red' ? 'black' : 'red';
  for(const suit of SUITS) {
    if(SUIT_COLORS[suit] === oppColor) {
      const pile = state.foundation[SUITS.indexOf(suit)];
      if(pile.length < card.value - 1) return false;
    }
  }
  return true;
}

function autoMoveToFoundation() {
  let moved = true;
  while(moved) {
    moved = false;
    // Check free cells
    for(let i=0; i<4; i++) {
      const card = state.freeCells[i];
      if(card && canSafelyAutoMove(card)) {
        const f = findFoundationIndex(card);
        if(f !== -1) {
          state.foundation[f].push(card);
          state.freeCells[i] = null;
          moved = true;
        }
      }
    }
    // Check tableau tops
    for(let c=0; c<8; c++) {
      const col = state.tableau[c];
      if(col.length === 0) continue;
      const card = col[col.length-1];
      if(canSafelyAutoMove(card)) {
        const f = findFoundationIndex(card);
        if(f !== -1) {
          state.foundation[f].push(card);
          col.pop();
          moved = true;
        }
      }
    }
  }
}

// ─── UNDO ───
function undo() {
  if(!state.history.length) return showToast('Nothing to undo');
  const p = state.history.pop();
  state.tableau = p.tableau;
  state.freeCells = p.freeCells;
  state.foundation = p.foundation;
  state.moves = p.moves;
  selectedCard = null;
  render(); updateUI(); saveGame();
  playTone(400, 0.08);
}

// ─── HINT ───
function showHint() {
  const m = findHintMove();
  if(m) {
    const srcEl = getHintSourceElement(m.source);
    if(srcEl) {
      const c = srcEl.classList.contains('card') ? srcEl : srcEl.querySelector('.card:last-child');
      if(c) { c.classList.add('hint-glow'); setTimeout(()=>c.classList.remove('hint-glow'), 3000); }
    }
    showToast('Try moving the glowing card');
  } else {
    showToast('No moves available');
  }
}

function getHintSourceElement(source) {
  if(source.type === 'free') {
    return document.querySelector(`#free-cells .slot[data-idx="${source.idx}"] .card`);
  }
  if(source.type === 'tableau') {
    const cards = document.querySelectorAll(`#tableau .col[data-idx="${source.idx}"] .card`);
    return cards[source.cardIdx] || null;
  }
  return null;
}

function findHintMove() {
  // Check free cells -> foundation
  for(let fc=0; fc<4; fc++) {
    const card = state.freeCells[fc];
    if(card) {
      const f = findFoundationIndex(card);
      if(f !== -1) return {cards:[card], source:{type:'free',idx:fc}, target:{type:'foundation',idx:f}};
    }
  }
  // Check tableau top -> foundation
  for(let c=0; c<8; c++) {
    const col = state.tableau[c];
    if(!col.length) continue;
    const card = col[col.length-1];
    const f = findFoundationIndex(card);
    if(f !== -1) return {cards:[card], source:{type:'tableau',idx:c,cardIdx:col.length-1}, target:{type:'foundation',idx:f}};
  }
  // Check tableau stacks
  for(let c=0; c<8; c++) {
    const col = state.tableau[c];
    for(let i=col.length-1; i>=0; i--) {
      const stack = col.slice(i);
      if(!isValidStack(stack)) continue;
      const source = {type:'tableau', idx:c, cardIdx:i};
      const targets = getValidTargets(stack, source);
      if(targets.length) return {cards:stack, source, target:targets[0]};
    }
  }
  // Check free cells -> tableau
  for(let fc=0; fc<4; fc++) {
    const card = state.freeCells[fc];
    if(card) {
      const source = {type:'free', idx:fc};
      const targets = getValidTargets([card], source);
      if(targets.length) return {cards:[card], source, target:targets[0]};
    }
  }
  return null;
}

// ─── WIN ───
function checkWin() {
  if(state.foundation.reduce((a,f)=>a+f.length,0) === 52) {
    state.won = true;
    clearInterval(state.timerInterval);
    saveGame();
    setTimeout(()=>{
      sndWin(); showConfetti();
      const e = getElapsed();
      document.getElementById('win-stats').textContent =
        `Time: ${Math.floor(e/60)}m ${e%60}s | Moves: ${state.moves} | Score: ${calcScore()}`;
      document.getElementById('win-overlay').classList.add('show');
    }, 300);
  }
}

function showConfetti() {
  const c = document.getElementById('confetti-container');
  const cols = ['#f0c040','#d42020','#40a0f0','#40d080','#f060a0'];
  for(let i=0; i<60; i++) {
    const p = document.createElement('div'); p.className='confetti';
    p.style.cssText = `left:${Math.random()*100}%;background:${cols[i%cols.length]};animation-duration:${2+Math.random()*2}s;animation-delay:${Math.random()*1.5}s;border-radius:${Math.random()>0.5?'50%':'2px'};width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;`;
    c.appendChild(p);
  }
  setTimeout(()=>c.innerHTML='', 5000);
}

// ─── UTILS ───
function showToast(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2000);
}

function showConfirm(title, msg) {
  return new Promise(res=>{
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').textContent = msg;
    document.getElementById('confirm-modal').classList.add('show');
    document.getElementById('modal-yes').onclick = ()=>{
      document.getElementById('confirm-modal').classList.remove('show'); res(true);
    };
    document.getElementById('modal-no').onclick = ()=>{
      document.getElementById('confirm-modal').classList.remove('show'); res(false);
    };
  });
}

// ─── BUTTONS ───
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-restart').addEventListener('click', async ()=>{
  if(await showConfirm('Restart?','Current progress will be lost.')) newGame();
});
document.getElementById('btn-hint').addEventListener('click', showHint);
document.getElementById('btn-play-again').addEventListener('click', ()=>{
  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('confetti-container').innerHTML='';
  newGame();
});

// ─── INIT ───
function init() {
  if(!loadGame() || state.won) newGame();
  else {
    render(); updateUI();
    if(!state.won) state.timerInterval = setInterval(updateTimer, 1000);
  }
}

document.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
init();