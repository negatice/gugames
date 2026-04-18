/* ============================================================
   AUDIO & HAPTIC
   ============================================================ */
const Audio = (() => {
  let ctx, master;
  const init = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.25; master.connect(ctx.destination);
  };
  const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  const playHit = (lane, q) => {
    if (!ctx) return; const t = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.frequency.value = [261.6,329.6,392.0,493.9][lane] * (q==='perfect'?2:1);
    osc.type = lane<2?'sine':'triangle';
    g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
    osc.connect(g).connect(master); osc.start(t); osc.stop(t+0.12);
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.frequency.value=2000;o2.type='square';g2.gain.setValueAtTime(0.04,t);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.03);
    o2.connect(g2).connect(master);o2.start(t);o2.stop(t+0.03);
  };
  const playMiss = () => {
    if (!ctx) return; const t=ctx.currentTime;
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=100;o.type='sawtooth';g.gain.setValueAtTime(0.1,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
    o.connect(g).connect(master);o.start(t);o.stop(t+0.15);
  };
  const haptic = ms => { if (navigator.vibrate) navigator.vibrate(ms||10); };
  return {init,resume,playHit,playMiss,haptic};
})();

/* ============================================================
   HEALTH SYSTEM
   ============================================================ */
let health = 60;
const updateHealth = (type) => {
  const delta = type==='perfect'?6:type==='great'?3:type==='good'?1:-10;
  health = Math.min(100, Math.max(0, health + delta));
  document.getElementById('healthFill').style.width = health + '%';
  document.getElementById('healthFill').style.backgroundPosition = (100-health) + '% 0';
  document.getElementById('healthLabel').textContent = Math.round(health) + '%';
  if (health <= 0) endGame(false);
};

/* ============================================================
   SONG DATA (LEVELS)
   ============================================================ */
const Songs = (() => {
  const build = (bpm, patterns, startBeat) => {
    const beatDur = 60 / bpm;
    const notes = []; let t = startBeat * beatDur;
    for (const [beats, lanes] of patterns) {
      for (const l of lanes) notes.push({time:t, lane:l, hit:false, missed:false});
      t += beats * beatDur;
    }
    return {notes, duration: (notes[notes.length-1].time / beatDur + 4) * beatDur};
  };
  const s1 = build(105, (()=>{
    const p=[]; for(let i=0;i<8;i++)p.push([1,[i%4]]);
    p.push([1,[0]],[1,[2]],[1,[1]],[1,[3]],[1,[0,2]],[1,[1,3]],[1,[0,2]],[1,[1,3]]);
    for(let i=0;i<8;i++)p.push([0.5,[i%4]]);
    p.push([1,[0]],[0.5,[1]],[0.5,[2]],[1,[3]],[1,[0]],[0.5,[0,3]],[0.5,[1,2]],[0.5,[0,3]],[0.5,[1,2]]);
    for(let i=0;i<6;i++)p.push([1,[(i*3)%4]]);
    return p;
  })(), 4);
  const s2 = build(135, (()=>{
    const p=[]; for(let i=0;i<6;i++)p.push([1,[i%4]]);
    p.push([0.5,[0]],[0.5,[1]],[0.5,[2]],[0.5,[3]]);
    for(let i=0;i<12;i++)p.push([0.5,[i%4]]);
    for(let i=0;i<8;i++)p.push([0.5,[i%2===0?0:2],[i%2===0?3:1]]);
    for(let i=0;i<16;i++)p.push([0.25,[i%4]]);
    p.push([1,[0,1,2,3]],[0.5,[0]],[0.5,[1]],[0.5,[2]],[0.5,[3]]);
    p.push([0.5,[0,3]],[0.5,[1,2]],[0.5,[0,3]],[0.5,[1,2]]);
    for(let i=0;i<6;i++)p.push([0.5,[i%4]]); p.push([1,[0,1,2,3]]);
    return p;
  })(), 4);
  const s3 = build(150, (()=>{
    const p=[]; for(let i=0;i<4;i++)p.push([1,[i%4]]);
    p.push([0.5,[0]],[0.5,[1]],[0.5,[2]],[0.5,[3]]);
    p.push([0.5,[0,2]],[0.5,[1,3]],[0.5,[0,2]],[0.5,[1,3]]);
    for(let i=0;i<16;i++)p.push([0.25,[i%4]]);
    for(let i=0;i<8;i++)p.push([0.25,[i%4,(i+2)%4]]);
    p.push([0.25,[0]],[0.25,[1]],[0.25,[2]],[0.25,[3]]);
    p.push([0.25,[0,3]],[0.25,[1,2]],[0.25,[0,1]],[0.25,[2,3]]);
    for(let i=0;i<8;i++)p.push([0.25,[i%4]]);
    for(let i=0;i<12;i++)p.push([0.25,[i%4]]);
    p.push([0.5,[0,1,2,3]],[0.5,[0,2]],[0.5,[1,3]],[0.5,[0,1,2,3]]);
    for(let i=0;i<8;i++)p.push([0.5,[i%4]]); p.push([1,[0,1,2,3]]);
    return p;
  })(), 4);
  return [s1,s2,s3];
})();

/* ============================================================
   PARTICLE & GAME STATE
   ============================================================ */
class Particle {
  constructor(x,y,c){this.x=x;this.y=y;this.c=c;this.vx=(Math.random()-0.5)*10;this.vy=(Math.random()-0.5)*10-4;this.life=1;this.decay=0.025+Math.random()*0.025;this.sz=3+Math.random()*5;}
  update(){this.x+=this.vx;this.y+=this.vy;this.vy+=0.12;this.life-=this.decay;}
}

const canvas=document.getElementById('gameCanvas');
const cx=canvas.getContext('2d');
let W,H,dpr,laneW,totalW,startX,hitY,noteR,lanes=[];
const COLORS=['#ff3250','#32ff50','#3296ff','#ffc832'];
const GLOWS=['rgba(255,50,80,','rgba(50,255,80,','rgba(50,150,255,','rgba(255,200,50,'];
const THRESH={perfect:22,great:48,good:80};

let mode='menu', currentLevel=0;
let notes=[], particles=[], score=0, combo=0, maxCombo=0;
let stats={perfect:0,great:0,good:0,miss:0};
let startTime=0, duration=0, noteSpeed=420;
let laneFlash=[0,0,0,0], fbText='', fbTimer=0, fbColor='#fff';
let lastTs=0, running=false;
let freeNextSpawn=0, freeBpm=110, freeBeat=0;

function resize(){
  dpr=window.devicePixelRatio||1; W=window.innerWidth; H=window.innerHeight;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  cx.setTransform(dpr,0,0,dpr,0,0);
  hitY=H-148-60; laneW=Math.floor((W-24)/4); totalW=laneW*4;
  startX=(W-totalW)/2; noteR=laneW*0.3;
  lanes=[]; for(let i=0;i<4;i++) lanes.push({x:startX+i*laneW+laneW/2,w:laneW});
}
window.addEventListener('resize',resize); resize();

function noteY(dt,elapsed){ return hitY-(dt-elapsed)*noteSpeed; }

/* ============================================================
   MENU FLOW
   ============================================================ */
const showMainMenu=()=>{
  document.getElementById('startScreen').style.display='flex';
  document.getElementById('levelScreen').style.display='none';
  document.getElementById('resultScreen').style.display='none';
};
const showLevelSelect=()=>{
  document.getElementById('startScreen').style.display='none';
  document.getElementById('levelScreen').style.display='flex';
};

const startLevelGame=(idx)=>{
  Audio.init(); Audio.resume();
  mode='level'; currentLevel=idx;
  const song=Songs[idx];
  noteSpeed=idx===0?350:idx===1?420:500;
  notes=song.notes.map(n=>({...n,displayTime:n.time+(hitY+100)/noteSpeed,hit:false,missed:false}));
  duration=song.duration;
  resetState();
};

const startFreeMode=()=>{
  Audio.init(); Audio.resume();
  mode='free'; notes=[]; duration=Infinity;
  noteSpeed=420; freeNextSpawn=0; freeBpm=110; freeBeat=0;
  resetState();
};

const resetState=()=>{
  score=0; combo=0; maxCombo=0; stats={perfect:0,great:0,good:0,miss:0};
  particles=[]; laneFlash=[0,0,0,0]; fbText=''; fbTimer=0;
  health=60; updateHealth('reset');
  state='playing'; startTime=performance.now(); lastTs=startTime; running=true;
  document.getElementById('startScreen').style.display='none';
  document.getElementById('levelScreen').style.display='none';
  document.getElementById('resultScreen').style.display='none';
  document.getElementById('hud').style.display='block';
  document.getElementById('scoreVal').textContent='0';
  document.getElementById('comboBox').classList.remove('visible');
  document.getElementById('touchButtons').style.display='block';
  document.getElementById('progressFill').style.width='0%';
  requestAnimationFrame(loop);
};

/* ============================================================
   ENDLESS GENERATOR (FREE MODE)
   ============================================================ */
const spawnFreeNotes=(elapsed)=>{
  const spawnAhead=2.5;
  while(freeNextSpawn < elapsed + spawnAhead){
    freeBeat++;
    const patterns=[[[0]],[[2]],[[1]],[[3]],[[0,2]],[[1,3]],[[0,3]],[[1,2]]];
    const pat=patterns[Math.floor(Math.random()*patterns.length)];
    const beatDur=60/freeBpm;
    const t=freeNextSpawn;
    for(const l of pat[0]) notes.push({time:t,lane:l,displayTime:t+(hitY+100)/noteSpeed,hit:false,missed:false});
    freeNextSpawn+=beatDur*(freeBeat%16===0?0.5:1);
    if(freeBeat%32===0 && freeBpm<155) freeBpm+=3;
  }
};

/* ============================================================
   GAME LOOP
   ============================================================ */
function loop(ts){
  if(!running) return;
  const dt=Math.min((ts-lastTs)/1000,0.05); lastTs=ts;
  const elapsed=(ts-startTime)/1000;
  if(mode==='free') spawnFreeNotes(elapsed);
  update(elapsed,dt); draw(elapsed);
  requestAnimationFrame(loop);
}

function update(elapsed,dt){
  particles=particles.filter(p=>{p.update();return p.life>0;});
  for(let i=0;i<4;i++) if(laneFlash[i]>0) laneFlash[i]=Math.max(0,laneFlash[i]-dt*5);
  if(fbTimer>0){fbTimer-=dt;if(fbTimer<=0)fbText='';}
  
  // Cleanup old notes
  notes=notes.filter(n=>{
    if(n.hit||n.missed) return false;
    return noteY(n.displayTime,elapsed) < H+80;
  });

  for(const n of notes){
    if(!n.hit&&!n.missed){
      const y=noteY(n.displayTime,elapsed);
      if(y>hitY+80){n.missed=true; onMiss();}
    }
  }

  const prog=mode==='free'?0:Math.min(elapsed/duration,1);
  document.getElementById('progressFill').style.width=(prog*100)+'%';
  if(mode==='level' && elapsed>duration+1) endGame(true);
}

function onHit(lane){
  if(mode!=='playing') return; // state alias
  laneFlash[lane]=1;
  const elapsed=(performance.now()-startTime)/1000;
  let best=null,bd=Infinity;
  for(const n of notes){
    if(n.lane!==lane||n.hit||n.missed) continue;
    const d=Math.abs(noteY(n.displayTime,elapsed)-hitY);
    if(d<bd){bd=d;best=n;}
  }
  if(!best) return;
  let q,pts,c;
  if(bd<THRESH.perfect){q='perfect';pts=300;c='#ffcc00';stats.perfect++;}
  else if(bd<THRESH.great){q='great';pts=200;c='#00ff88';stats.great++;}
  else if(bd<THRESH.good){q='good';pts=100;c='#00ccff';stats.good++;}
  else return;
  best.hit=true; combo++; if(combo>maxCombo)maxCombo=combo;
  score+=Math.round(pts*(1+Math.floor(combo/10)*0.5));
  fbText=q.toUpperCase(); fbTimer=0.6; fbColor=c;
  for(let i=0;i<12;i++) particles.push(new Particle(lanes[lane].x,hitY,COLORS[lane]));
  Audio.playHit(lane,q); Audio.haptic(q==='perfect'?20:10);
  updateHealth(q); updateUI();
}

function onMiss(){
  combo=0; stats.miss++;
  fbText='MISS'; fbTimer=0.5; fbColor='#ff3250';
  Audio.playMiss(); Audio.haptic(30);
  updateHealth('miss'); updateUI();
}

function updateUI(){
  document.getElementById('scoreVal').textContent=score.toLocaleString();
  const cb=document.getElementById('comboBox');
  if(combo>=2){document.getElementById('comboVal').textContent=combo;cb.classList.add('visible');}
  else cb.classList.remove('visible');
  const fb=document.getElementById('feedback');
  if(fbText){fb.textContent=fbText;fb.style.color=fbColor;fb.style.opacity='1';fb.style.transform='translate(-50%,-50%) scale(1.2)';setTimeout(()=>{fb.style.transform='translate(-50%,-50%) scale(1)';fb.style.opacity='0.8';},60);}
}

function draw(elapsed){
  cx.clearRect(0,0,W,H); cx.fillStyle='#0a0a1a'; cx.fillRect(0,0,W,H);
  for(let i=0;i<4;i++){
    const g=cx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'transparent');g.addColorStop(0.6,GLOWS[i]+'0.03)');g.addColorStop(1,GLOWS[i]+'0.06)');
    cx.fillStyle=g; cx.fillRect(startX+i*laneW,0,laneW,H);
    cx.strokeStyle='rgba(255,255,255,0.06)';cx.lineWidth=1;
    cx.beginPath();cx.moveTo(startX+i*laneW,0);cx.lineTo(startX+i*laneW,H);cx.stroke();
  }
  cx.beginPath();cx.moveTo(startX+totalW,0);cx.lineTo(startX+totalW,H);cx.stroke();
  cx.strokeStyle='rgba(255,255,255,0.5)';cx.lineWidth=2;
  cx.beginPath();cx.moveTo(startX,hitY);cx.lineTo(startX+totalW,hitY);cx.stroke();

  for(let i=0;i<4;i++){
    const x=lanes[i].x,f=laneFlash[i];
    cx.beginPath();cx.arc(x,hitY,noteR,0,Math.PI*2);cx.strokeStyle=COLORS[i];cx.lineWidth=3;cx.stroke();
    if(f>0){
      cx.beginPath();cx.arc(x,hitY,noteR+8,0,Math.PI*2);cx.fillStyle=GLOWS[i]+(f*0.4)+')';cx.fill();
      cx.beginPath();cx.arc(x,hitY,noteR*0.8,0,Math.PI*2);cx.fillStyle=COLORS[i]+Math.floor(f*120).toString(16).padStart(2,'0');cx.fill();
    }
  }
  for(const n of notes){
    if(n.hit||n.missed) continue;
    const y=noteY(n.displayTime,elapsed);
    if(y<-noteR-20||y>H+noteR+20) continue;
    const x=lanes[n.lane].x,c=COLORS[n.lane];
    cx.beginPath();cx.arc(x,y,noteR+6,0,Math.PI*2);cx.fillStyle=GLOWS[n.lane]+'0.15)';cx.fill();
    const ng=cx.createRadialGradient(x,y-noteR*0.3,0,x,y,noteR);
    ng.addColorStop(0,'#fff');ng.addColorStop(0.35,c);ng.addColorStop(1,c+'66');
    cx.beginPath();cx.arc(x,y,noteR,0,Math.PI*2);cx.fillStyle=ng;cx.fill();
    cx.strokeStyle=c;cx.lineWidth=2;cx.stroke();
  }
  for(const p of particles){cx.globalAlpha=p.life;cx.fillStyle=p.c;cx.beginPath();cx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2);cx.fill();}
  cx.globalAlpha=1;
  if(fbText&&fbTimer>0){cx.save();cx.globalAlpha=Math.min(1,fbTimer*2);cx.font='bold 28px Arial';cx.textAlign='center';cx.fillStyle=fbColor;cx.shadowColor=fbColor;cx.shadowBlur=15;cx.fillText(fbText,W/2,hitY-70);cx.restore();}
  if(combo>=5){cx.save();cx.globalAlpha=0.6;const sz=Math.min(44,28+combo*0.5);cx.font=`bold ${sz}px Arial`;cx.textAlign='center';cx.fillStyle='#ffcc00';cx.shadowColor='#ffcc00';cx.shadowBlur=20;cx.fillText(combo,W/2,hitY-105);cx.font='bold 12px Arial';cx.fillText('COMBO',W/2,hitY-88);cx.restore();}
}

function endGame(clear){
  running=false;
  const total=stats.perfect+stats.great+stats.good+stats.miss;
  const hits=stats.perfect+stats.great+stats.good;
  const acc=total>0?(hits/total*100):0;
  let grade,cls;
  if(acc>=95){grade='S';cls='g-S';}else if(acc>=85){grade='A';cls='g-A';}
  else if(acc>=70){grade='B';cls='g-B';}else if(acc>=50){grade='C';cls='g-C';}
  else{grade='D';cls='g-D';}

  document.getElementById('resultTitle').textContent = clear ? 'LEVEL SELESAI!' : 'GAME OVER';
  document.getElementById('resultTitle').className = clear ? 'result-title win' : 'result-title lose';
  const ge=document.getElementById('gradeEl'); ge.textContent=grade; ge.className='grade '+cls;
  document.getElementById('rScore').textContent=score.toLocaleString();
  document.getElementById('rCombo').textContent=maxCombo;
  document.getElementById('rAcc').textContent=acc.toFixed(1)+'%';
  document.getElementById('rP').textContent=stats.perfect;
  document.getElementById('rG').textContent=stats.great;
  document.getElementById('rGo').textContent=stats.good;
  document.getElementById('rM').textContent=stats.miss;
  
  document.getElementById('hud').style.display='none';
  document.getElementById('touchButtons').style.display='none';
  document.getElementById('resultScreen').style.display='flex';
}

/* ============================================================
   TOUCH INPUT
   ============================================================ */
document.querySelectorAll('.touch-btn').forEach(btn=>{
  const lane=parseInt(btn.dataset.lane);
  const act=e=>{e.preventDefault();btn.classList.add('active');onHit(lane);};
  const deact=e=>{e.preventDefault();btn.classList.remove('active');};
  btn.addEventListener('touchstart',act,{passive:false});
  btn.addEventListener('touchend',deact,{passive:false});
  btn.addEventListener('touchcancel',deact,{passive:false});
});
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault());

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