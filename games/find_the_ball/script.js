// ============================================================
//  FIND THE BALL — Mobile Optimized & Enhanced UI/UX
// ============================================================

const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

let W, H, DPR;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => { resize(); if(state===STATE.SHOW||state===STATE.SHUFFLE||state===STATE.SELECT) initCupPositions(); });
resize();

// ============================================================
//  AUDIO
// ============================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(f, d, t='sine', v=0.1) {
  ensureAudio();
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.value = f;
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + d);
}
const sfx = {
  shuffle: () => tone(280, 0.08, 'square', 0.04),
  swap:    () => tone(240, 0.05, 'triangle', 0.06),
  correct: () => { tone(523,0.1,'sine',0.1); setTimeout(()=>tone(659,0.1,'sine',0.1),90); setTimeout(()=>tone(784,0.15,'sine',0.1),180); },
  wrong:   () => { tone(180,0.25,'sawtooth',0.08); setTimeout(()=>tone(140,0.3,'sawtooth',0.06),100); },
  pop:     () => tone(900, 0.07, 'sine', 0.07),
  drop:    () => tone(400, 0.05, 'sine', 0.06),
  levelup: () => { tone(440,0.08,'sine',0.08); setTimeout(()=>tone(554,0.08,'sine',0.08),70); setTimeout(()=>tone(659,0.08,'sine',0.08),140); setTimeout(()=>tone(880,0.15,'sine',0.08),210); },
  tick:    () => tone(800, 0.03, 'sine', 0.05)
};
function vib(ms) { if(navigator.vibrate) navigator.vibrate(ms); }

// ============================================================
//  EASING
// ============================================================
function easeInOutCubic(t) { return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function easeOutBack(t) { const c=2.2; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }
function easeOutBounce(t) {
  const n=7.5625,d=2.75;
  if(t<1/d) return n*t*t;
  if(t<2/d) return n*(t-=1.5/d)*t+0.75;
  if(t<2.5/d) return n*(t-=2.25/d)*t+0.9375;
  return n*(t-=2.625/d)*t+0.984375;
}

// ============================================================
//  DYNAMIC CUP SIZING (Responsive)
// ============================================================
let CUP_W = 70, CUP_H = 85, CUP_TOP_W = 58, CUP_BOT_W, BALL_R = 12, CUP_GAP = 20;

function calcCupSize() {
  const count = getCupCount();
  const margin = 20; // side margin
  const avail = W - margin * 2;
  // Calculate ideal cup width
  let idealW = Math.floor((avail - (count - 1) * 15) / count);
  idealW = Math.max(42, Math.min(78, idealW)); // clamp between 42-78px
  CUP_W = idealW;
  CUP_H = Math.floor(idealW * 1.2);
  CUP_TOP_W = Math.floor(idealW * 0.82);
  CUP_BOT_W = Math.floor(idealW * 0.88);
  BALL_R = Math.max(9, Math.floor(idealW * 0.18));
  CUP_GAP = Math.max(12, Math.floor((avail - count * CUP_W) / (count - 1)));
  if (CUP_GAP > 30) CUP_GAP = 30;
}

// ============================================================
//  GAME STATE
// ============================================================
const STATE = { MENU:0, SHOW:1, SHUFFLE:2, SELECT:3, RESULT:4, GAMEOVER:5 };
let state = STATE.MENU;
let level = 1, lives = 3, score = 0, combo = 0, maxCombo = 0;
let cups = [], ballCupIndex = 0, selectedCupIndex = -1;
let animStart = 0, animDuration = 0, animFrom = [], animTo = [];
let shuffleSwaps = [], currentSwap = 0;
let resultStartTime = 0, selectTimer = 0, timeoutHandled = false;
let particles = [], bgStars = [];
let tableY = 0;

// Init background stars
for(let i=0;i<40;i++) bgStars.push({
  x: Math.random(), y: Math.random()*0.5,
  s: 0.5+Math.random()*1.5, sp: 0.5+Math.random()*2, ph: Math.random()*Math.PI*2
});

// ============================================================
//  DIFFICULTY
// ============================================================
function getCupCount() { return level<=5 ? 3 : level<=10 ? 4 : 5; }
function getSwapCount() { return Math.min(3+Math.floor(level*0.8), 8); }
function getSwapDur() { return Math.max(400, 900 - level*40); }
function getSelectTime() { return Math.max(4000, 10000 - (level-1)*400); }

// ============================================================
//  INIT
// ============================================================
function initCupPositions() {
  calcCupSize();
  tableY = H * 0.62;
  const count = getCupCount();
  const totalW = count * CUP_W + (count - 1) * CUP_GAP;
  const startX = (W - totalW) / 2 + CUP_W / 2;
  cups = [];
  for(let i=0;i<count;i++) cups.push({
    x: startX + i*(CUP_W+CUP_GAP), y: tableY,
    lift: 0, shakeX: 0, shakeT: 0, pulse: 0
  });
  ballCupIndex = Math.floor(Math.random()*count);
  selectedCupIndex = -1;
}

function startRound() {
  timeoutHandled = false;
  initCupPositions();
  state = STATE.SHOW;
  animStart = performance.now();
  animDuration = 1400;
}

function startShuffle() {
  state = STATE.SHUFFLE;
  shuffleSwaps = []; currentSwap = 0;
  const count = getCupCount(), n = getSwapCount();
  for(let i=0;i<n;i++){
    let a=Math.floor(Math.random()*count), b=a;
    while(b===a) b=Math.floor(Math.random()*count);
    shuffleSwaps.push([a,b]);
  }
  const [a,b]=shuffleSwaps[0];
  animFrom=cups.map(c=>c.x);
  animTo=cups.map((c,i)=> i===a?cups[b].x : i===b?cups[a].x : c.x);
  animStart=performance.now(); animDuration=getSwapDur();
}

function advanceSwap() {
  const [a,b]=shuffleSwaps[currentSwap];
  const tx=cups[a].x; cups[a].x=cups[b].x; cups[b].x=tx;
  if(ballCupIndex===a) ballCupIndex=b;
  else if(ballCupIndex===b) ballCupIndex=a;
  currentSwap++;
  if(currentSwap>=shuffleSwaps.length){
    state=STATE.SELECT; selectTimer=getSelectTime(); return;
  }
  const [na,nb]=shuffleSwaps[currentSwap];
  animFrom=cups.map(c=>c.x);
  animTo=cups.map((c,i)=> i===na?cups[nb].x : i===nb?cups[na].x : c.x);
  animStart=performance.now(); animDuration=getSwapDur();
  sfx.swap();
}

// ============================================================
//  PARTICLES
// ============================================================
function spawnP(x,y,color,n){
  for(let i=0;i<n;i++){
    const ang=Math.random()*Math.PI*2, spd=1.5+Math.random()*4;
    particles.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:1,decay:0.01+Math.random()*0.018,sz:2+Math.random()*4,color});
  }
}
function updateP(){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.life-=p.decay;
    if(p.life<=0) particles.splice(i,1);
  }
}

// ============================================================
//  DRAWING HELPERS
// ============================================================
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function drawBg(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0d0b1a'); g.addColorStop(0.5,'#141228'); g.addColorStop(1,'#1a1a35');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  const t=performance.now()/1000;
  ctx.fillStyle='rgba(255,255,255,0.08)';
  bgStars.forEach(s=>{
    const a=0.3+0.7*(0.5+0.5*Math.sin(t*s.sp+s.ph));
    ctx.globalAlpha=a*0.15;
    ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.s, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;
}

function drawTable(){
  const ty=tableY-8, th=H-ty+20;
  const g=ctx.createLinearGradient(0,ty,0,ty+th);
  g.addColorStop(0,'#257520'); g.addColorStop(0.3,'#1a6618'); g.addColorStop(1,'#0d4010');
  ctx.fillStyle=g; ctx.fillRect(0,ty,W,th);

  ctx.fillStyle='#3a9a35'; ctx.fillRect(0,ty-3,W,7);
  // Subtle line
  ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
  for(let y=ty+30;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
}

function drawCup(cup, highlight=false){
  const cx=cup.x, cy=cup.y-cup.lift, sh=cup.shakeX;
  ctx.save(); ctx.translate(cx+sh, cy);

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,6,CUP_W/2+6,10,0,0,Math.PI*2); ctx.fill();

  // Glow if highlighted
  if(highlight){
    ctx.save(); ctx.globalAlpha=0.25;
    ctx.fillStyle='#fff'; ctx.beginPath();
    ctx.ellipse(0,8,CUP_W/2+12,14,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Cup body gradient
  const g=ctx.createLinearGradient(-CUP_W/2,0,CUP_W/2,0);
  g.addColorStop(0,'#3d4f5f'); g.addColorStop(0.3,'#5a6d7d');
  g.addColorStop(0.5,'#6b7d8d'); g.addColorStop(0.7,'#5a6d7d'); g.addColorStop(1,'#3d4f5f');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(-CUP_TOP_W/2,-CUP_H); ctx.lineTo(CUP_TOP_W/2,-CUP_H);
  ctx.lineTo(CUP_BOT_W/2,0); ctx.lineTo(-CUP_BOT_W/2,0);
  ctx.closePath(); ctx.fill();

  // Rim
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-CUP_TOP_W/2+2,-CUP_H+2); ctx.lineTo(CUP_TOP_W/2-2,-CUP_H+2); ctx.stroke();

  // Bottom ellipse
  ctx.fillStyle='#2c3e4d';
  ctx.beginPath(); ctx.ellipse(0,0,CUP_BOT_W/2,4.5,0,0,Math.PI*2); ctx.fill();

  // Highlight stripe
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(-CUP_TOP_W/2+6,-CUP_H+8); ctx.lineTo(CUP_TOP_W/2-6,-CUP_H+8);
  ctx.lineTo(CUP_TOP_W/2-12,-CUP_H*0.4); ctx.lineTo(-CUP_TOP_W/2+12,-CUP_H*0.4);
  ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawBall(x,y){
  const g=ctx.createRadialGradient(x-3,y-3,1,x,y,BALL_R);
  g.addColorStop(0,'#ffffff'); g.addColorStop(0.3,'#fdeaa8'); g.addColorStop(0.7,'#f0b429'); g.addColorStop(1,'#d4920a');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,BALL_R,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x-3,y-4,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x+2,y+3,2,0,Math.PI*2); ctx.fill();
}

function drawFallingBall(progress){
  const t=easeOutBounce(Math.min(progress,1));
  const sx=W/2, sy=H*0.12;
  const ex=cups[ballCupIndex].x, ey=cups[ballCupIndex].y-14;
  drawBall(sx+(ex-sx)*t, sy+(ey-sy)*t);
}

function drawHUD(){
  const hh=42, py=8, px=10, pw=W-20;
  ctx.fillStyle='rgba(0,0,0,0.4)';
  roundRect(px,py,pw,hh,12); ctx.fill();

  // Level
  ctx.fillStyle='#8e99a4'; ctx.font='bold 12px -apple-system,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('LEVEL', 22, py+hh/2-7);
  ctx.fillStyle='#fff'; ctx.font='bold 16px -apple-system,sans-serif';
  ctx.fillText(level, 22, py+hh/2+8);

  // Score
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 15px -apple-system,sans-serif';
  ctx.fillText(score, W/2, py+hh/2-6);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='10px -apple-system,sans-serif';
  ctx.fillText('SCORE', W/2, py+hh/2+8);

  // Lives
  ctx.textAlign='right';
  let h=''; for(let i=0;i<lives;i++) h+='❤️ ';
  ctx.font='16px -apple-system,sans-serif';
  ctx.fillText(h.trim(), W-22, py+hh/2);

  // Combo
  if(combo>1){
    ctx.textAlign='center'; ctx.fillStyle='#f39c12';
    ctx.font='bold 11px -apple-system,sans-serif';
    ctx.fillText('🔥 x'+combo, W/2, py+hh+14);
  }

  // Timer bar
  if(state===STATE.SELECT){
    const bw=pw-4, bh=5, by=tableY+CUP_H+22;
    const pct=Math.max(0,selectTimer/getSelectTime());
    ctx.fillStyle='rgba(0,0,0,0.2)'; roundRect(2,by,bw,bh,3); ctx.fill();
    const col=pct>0.5?'#2ecc71':pct>0.25?'#f39c12':'#e74c3c';
    ctx.fillStyle=col; roundRect(2,by,bw*pct,bh,3); ctx.fill();
  }
}

function drawMenu(){
  // Title
  ctx.fillStyle='#fff'; ctx.font='bold 38px -apple-system,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🔍 FIND', W/2, H*0.16);
  ctx.fillText('THE BALL', W/2, H*0.16+44);

  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='14px -apple-system,sans-serif';
  ctx.fillText('Ikuti bola saat ember diacak!', W/2, H*0.16+85);

  // Demo cups
  tableY = H * 0.60;
  calcCupSize();
  const count=3;
  const totalW=count*CUP_W+(count-1)*15;
  const startX=(W-totalW)/2+CUP_W/2;
  for(let i=0;i<3;i++){
    cups[i]={x:startX+i*(CUP_W+15),y:tableY,lift:0,shakeX:0,shakeT:0,pulse:0};
  }
  ballCupIndex=1;

  cups.forEach(c=>drawCup(c));

  // Animate reveal
  const t=(performance.now()%3000)/3000;
  const lift=t<0.4?0:t<0.5?easeOutBounce((t-0.4)*10)*75:t<0.85?75:easeOutBounce((1-t)/0.15)*75;
  cups[1].lift=lift;
  if(lift>8) drawBall(cups[1].x, cups[1].y-14);

  // Button
  const by=H*0.78, bw=180, bh=52, bx=W/2-bw/2;
  const g=ctx.createLinearGradient(bx,by,bx,by+bh);
  g.addColorStop(0,'#3498db'); g.addColorStop(1,'#2471a3');
  ctx.fillStyle=g; roundRect(bx,by,bw,bh,14); ctx.fill();

  // Button shine
  ctx.fillStyle='rgba(255,255,255,0.15)';
  roundRect(bx+2,by+2,bw-4,bh/2-2,12); ctx.fill();

  ctx.fillStyle='#fff'; ctx.font='bold 20px -apple-system,sans-serif';
  ctx.fillText('▶  START', W/2, by+bh/2);

  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='12px -apple-system,sans-serif';
  ctx.fillText('Tap ember yang berisi bola', W/2, H*0.92);
}

function drawGameOver(){
  ctx.fillStyle='rgba(5,5,15,0.8)'; ctx.fillRect(0,0,W,H);

  ctx.fillStyle='#e74c3c'; ctx.font='bold 34px -apple-system,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('GAME OVER', W/2, H*0.2);

  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='16px -apple-system,sans-serif';
  ctx.fillText('Score  •  '+score, W/2, H*0.3);
  ctx.fillText('Level  •  '+level, W/2, H*0.3+28);
  ctx.fillText('Max Combo  •  '+maxCombo, W/2, H*0.3+56);

  const by=H*0.58, bw=200, bh=50, bx=W/2-bw/2;
  const g=ctx.createLinearGradient(bx,by,bx,by+bh);
  g.addColorStop(0,'#27ae60'); g.addColorStop(1,'#1e8449');
  ctx.fillStyle=g; roundRect(bx,by,bw,bh,13); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.12)';
  roundRect(bx+2,by+2,bw-4,bh/2-2,11); ctx.fill();

  ctx.fillStyle='#fff'; ctx.font='bold 18px -apple-system,sans-serif';
  ctx.fillText('🔄  MAIN LAGI', W/2, by+bh/2);
}

function drawResultBanner(){
  const correct=selectedCupIndex===ballCupIndex;
  const bg=ctx.createLinearGradient(0,H*0.12,0,H*0.12+55);
  bg.addColorStop(0, correct?'rgba(46,204,113,0.85)':'rgba(231,76,60,0.85)');
  bg.addColorStop(1, correct?'rgba(39,174,96,0.85)':'rgba(192,57,43,0.85)');
  ctx.fillStyle=bg;
  roundRect(10,H*0.12,W-20,50,12); ctx.fill();

  ctx.fillStyle='#fff'; ctx.font='bold 22px -apple-system,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(correct ? '✅  CORRECT!' : '❌  WRONG!', W/2, H*0.12+25);

  if(selectedCupIndex===-2){
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='11px -apple-system,sans-serif';
    ctx.fillText('⏱️  Waktu habis!', W/2, H*0.12+45);
  }
}

// ============================================================
//  INPUT
// ============================================================
function tap(px,py){
  ensureAudio();
  if(state===STATE.MENU){
    const by=H*0.78,bw=180,bh=52,bx=W/2-bw/2;
    if(px>=bx&&px<=bx+bw&&py>=by&&py<=by+bh){
      level=1;lives=3;score=0;combo=0;maxCombo=0;startRound();
    }
    return;
  }
  if(state===STATE.GAMEOVER){
    const by=H*0.58,bw=200,bh=50,bx=W/2-bw/2;
    if(px>=bx&&px<=bx+bw&&py>=by&&py<=by+bh){
      level=1;lives=3;score=0;combo=0;maxCombo=0;startRound();
    }
    return;
  }
  if(state===STATE.SELECT){
    for(let i=0;i<cups.length;i++){
      const dx=px-cups[i].x, dy=py-(cups[i].y-CUP_H/2);
      if(Math.abs(dx)<CUP_W/2+18&&Math.abs(dy)<CUP_H/2+30){
        selectedCupIndex=i; revealCup(); return;
      }
    }
  }
  if(state===STATE.RESULT){
    if(selectedCupIndex===ballCupIndex){
      level++;combo++;if(combo>maxCombo)maxCombo=combo;
      sfx.levelup();startRound();
    } else {
      lives--;combo=0;
      state=lives<=0?STATE.GAMEOVER:STATE.SHOW;
      if(state!==STATE.GAMEOVER) setTimeout(()=>startRound(),200);
    }
  }
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();tap(e.clientX,e.clientY);});
document.body.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

// ============================================================
//  GAME LOGIC
// ============================================================
function revealCup(){
  const ok=selectedCupIndex===ballCupIndex;
  if(ok){
    sfx.correct();
    const tb=Math.floor(selectTimer/100)*level;
    const cb=(combo>1?(combo-1)*40:0)*level;
    score+=100*level+tb+cb;
    spawnP(cups[ballCupIndex].x,cups[ballCupIndex].y-CUP_H/2,'#2ecc71',18);
    spawnP(cups[ballCupIndex].x,cups[ballCupIndex].y-CUP_H/2,'#f1c40f',10);
  } else {
    sfx.wrong(); vib(150);
    spawnP(cups[selectedCupIndex].x,cups[selectedCupIndex].y-CUP_H/2,'#e74c3c',12);
    cups[selectedCupIndex].shakeX=8; cups[selectedCupIndex].shakeT=12;
  }
  sfx.pop(); state=STATE.RESULT; resultStartTime=performance.now();
}

// ============================================================
//  MAIN LOOP
// ============================================================
let lastTs=0;
function loop(ts){
  const dt=ts-lastTs; lastTs=ts;
  ctx.clearRect(0,0,W,H);
  drawBg(); drawTable(); updateP();

  // Draw particles
  particles.forEach(p=>{
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;

  switch(state){
  case STATE.MENU: drawMenu(); break;

  case STATE.SHOW:{
    const el=ts-animStart, p=Math.min(el/animDuration,1);
    if(p<0.55){
      cups.forEach(c=>drawCup(c));
      drawFallingBall(p/0.55);
    } else if(p<0.8){
      const lt=(p-0.55)/0.25, l=easeOutBounce(lt)*85;
      cups.forEach((c,i)=>{
        if(i===ballCupIndex){c.lift=l;drawCup(c);}
        else{c.lift=0;drawCup(c);}
      });
      drawBall(cups[ballCupIndex].x, cups[ballCupIndex].y-14);
    } else {
      const lt=(p-0.8)/0.2, l=(1-easeOutBounce(lt))*85;
      cups.forEach((c,i)=>{c.lift=i===ballCupIndex?l:0;drawCup(c);});
      if(l>10) drawBall(cups[ballCupIndex].x, cups[ballCupIndex].y-14);
    }
    drawHUD();
    if(p>=1){
      sfx.drop(); cups[ballCupIndex].lift=0;
      setTimeout(()=>startShuffle(),400);
    }
    break;
  }

  case STATE.SHUFFLE:{
    const el=ts-animStart, p=Math.min(el/animDuration,1);
    const ep=easeInOutCubic(p);
    cups.forEach((c,i)=>{c.x=animFrom[i]+(animTo[i]-animFrom[i])*ep;});
    cups.forEach(c=>drawCup(c));
    drawHUD();

    // Shuffle indicator
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.font='bold 15px -apple-system,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🔀  Mengacak...', W/2, H*0.18);
    if(p>=1) advanceSwap();
    break;
  }

  case STATE.SELECT:{
    if(!timeoutHandled){
      selectTimer-=dt;
      if(selectTimer<=0){
        selectTimer=0; timeoutHandled=true;
        selectedCupIndex=-2;
        sfx.wrong(); vib(200); lives--; combo=0;
        state=STATE.RESULT; resultStartTime=performance.now();
        setTimeout(()=>{
          if(state===STATE.RESULT){
            if(lives<=0) state=STATE.GAMEOVER;
            else startRound();
          }
        },1800);
      }
    }
    // Pulse glow
    const pulse=Math.sin(ts/300)*0.08+0.08;
    cups.forEach(c=>{
      drawCup(c);
      ctx.save(); ctx.globalAlpha=pulse; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.ellipse(c.x,c.y+6,CUP_W/2+10,12,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
    drawHUD();

    ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.font='bold 14px -apple-system,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('👆  Tap ember yang berisi bola!', W/2, H*0.18);
    break;
  }

  case STATE.RESULT:{
    const el=ts-resultStartTime, p=Math.min(el/600,1);
    const lift=easeOutBounce(p)*90;

    // Shake
    cups.forEach(c=>{
      if(c.shakeT>0){c.shakeT--;c.shakeX=Math.sin(c.shakeT*2.5)*c.shakeT*0.7;}
      else c.shakeX=0;
    });

    cups.forEach((c,i)=>{
      let l=0, show=false;
      if(i===ballCupIndex){l=lift;show=true;}
      if(i===selectedCupIndex&&i!==ballCupIndex) l=lift*0.7;
      c.lift=l; drawCup(c);
      if(show) drawBall(c.x, c.y-14);
    });
    drawHUD();
    drawResultBanner();
    if(p >= 0.85){
      const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ts / 350)); // efek pulse
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = '13px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tap di mana saja untuk melanjutkan', W/2, H*0.22);
    }
    break;
  }

  case STATE.GAMEOVER:
    cups.forEach(c=>{c.lift=0;c.shakeX=0;drawCup(c);});
    drawHUD();
    drawGameOver();
    break;
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);