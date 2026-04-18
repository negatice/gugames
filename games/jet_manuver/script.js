// ============================================================
// JET MANEUVER - Mobile + Difficulty + Powerups
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// --- Audio ---
const AudioSys = (() => {
  let actx = null;
  function init() { if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); if (actx.state==='suspended') actx.resume(); }
  function play(type) {
    if (!actx) return;
    const now = actx.currentTime;
    if (type==='explode') {
      const buf=actx.createBuffer(1,actx.sampleRate*0.3,actx.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
      const s=actx.createBufferSource(); s.buffer=buf;
      const g=actx.createGain(); g.gain.setValueAtTime(0.2,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(1000,now); f.frequency.exponentialRampToValueAtTime(80,now+0.3);
      s.connect(f).connect(g).connect(actx.destination); s.start(now);
    } else if (type==='launch') {
      const o=actx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(400,now); o.frequency.exponentialRampToValueAtTime(60,now+0.25);
      const g=actx.createGain(); g.gain.setValueAtTime(0.05,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      o.connect(g).connect(actx.destination); o.start(now); o.stop(now+0.25);
    } else if (type==='turbo') {
      const o=actx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(250,now); o.frequency.linearRampToValueAtTime(700,now+0.12);
      const g=actx.createGain(); g.gain.setValueAtTime(0.05,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.connect(g).connect(actx.destination); o.start(now); o.stop(now+0.15);
    } else if (type==='powerup') {
      [500,650,800].forEach((fr,i)=>{
        const o=actx.createOscillator(); o.type='sine'; o.frequency.value=fr;
        const g=actx.createGain(); g.gain.setValueAtTime(0.08,now+i*0.08); g.gain.exponentialRampToValueAtTime(0.001,now+i*0.08+0.15);
        o.connect(g).connect(actx.destination); o.start(now+i*0.08); o.stop(now+i*0.08+0.15);
      });
    }
  }
  return { init, play };
})();

// --- Resize ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio||1;
  canvas.width = window.innerWidth*dpr; canvas.height = window.innerHeight*dpr;
  ctx.scale(dpr,dpr);
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();
const W=()=>window.innerWidth, H=()=>window.innerHeight;
const dist=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
const angleTo=(x1,y1,x2,y2)=>Math.atan2(y2-y1,x2-x1);
const angleDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,mi,ma)=>Math.max(mi,Math.min(ma,v));
const rand=(mi,ma)=>mi+Math.random()*(ma-mi);

// --- Input ---
const Input = (() => {
  let j = {active:false,dx:0,dy:0,tid:null,sx:0,sy:0};
  let turbo = false;
  canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.clientX<W()/2 && !j.active){ j.active=true; j.tid=t.identifier; j.sx=t.clientX; j.sy=t.clientY; j.dx=j.dy=0; }
    }
  },{passive:false});
  canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier===j.tid && j.active){
        const dx=t.clientX-j.sx, dy=t.clientY-j.sy, d=Math.hypot(dx,dy), m=45;
        j.dx=clamp(dx,-m,m)/m; j.dy=clamp(dy,-m,m)/m;
      }
    }
  },{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(t.identifier===j.tid){j.active=false;j.tid=null;j.dx=j.dy=0;}}};
  canvas.addEventListener('touchend',end,{passive:false});
  canvas.addEventListener('touchcancel',end,{passive:false});

  const btn=document.getElementById('turbo-btn');
  btn.addEventListener('touchstart',e=>{e.preventDefault();turbo=true;},{passive:false});
  btn.addEventListener('touchend',e=>{e.preventDefault();turbo=false;},{passive:false});
  btn.addEventListener('touchcancel',()=>{turbo=false;});
  return {getInput:()=>({dx:j.dx,dy:j.dy,turbo}), j};
})();

// --- Difficulty Config ---
const DIFFICULTIES = {
  easy: {
    label:'MUDAH',
    missileBaseSpeed: 2.2, missileMaxSpeed: 4.0, turnRate: 0.022,
    spawnIntervalStart: 200, spawnIntervalMin: 90,
    maxMissiles: 10, missileSpeedScale: 0.00006,
    powerupInterval: [400, 600], // frames range
  },
  medium: {
    label:'SEDANG',
    missileBaseSpeed: 2.8, missileMaxSpeed: 5.5, turnRate: 0.032,
    spawnIntervalStart: 150, spawnIntervalMin: 55,
    maxMissiles: 15, missileSpeedScale: 0.0001,
    powerupInterval: [500, 900],
  },
  hard: {
    label:'SULIT',
    missileBaseSpeed: 3.3, missileMaxSpeed: 6.5, turnRate: 0.045,
    spawnIntervalStart: 100, spawnIntervalMin: 35,
    maxMissiles: 20, missileSpeedScale: 0.00015,
    powerupInterval: [800, 1400],
  }
};

let difficulty = 'medium';
let diff = DIFFICULTIES.medium;

// --- Background ---
const Background = (() => {
  let stars=[];
  function init(){ stars=Array.from({length:100},()=>({x:Math.random()*W(),y:Math.random()*H(),s:Math.random()*1.1+0.3,spd:Math.random()*0.15+0.03,br:Math.random()})); }
  function update(){ for(const s of stars){s.y+=s.spd;s.br+=((Math.random()-0.5)*0.02);s.br=clamp(s.br,0.15,0.9);if(s.y>H()){s.y=0;s.x=Math.random()*W();}} }
  function render(){
    const g=ctx.createLinearGradient(0,0,0,H());
    g.addColorStop(0,'#050510'); g.addColorStop(0.5,'#0a0a2e'); g.addColorStop(1,'#0f0520');
    ctx.fillStyle=g; ctx.fillRect(0,0,W(),H());
    for(const s of stars){ctx.globalAlpha=s.br;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
  return {init,update,render};
})();

// --- Particles ---
const Particles = (() => {
  let list=[];
  function createExplosion(x,y,count,color,speed){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=Math.random()*speed+speed*0.15;list.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.015+Math.random()*0.025,sz:2+Math.random()*3,color});}}
  function createTrail(x,y,color){list.push({x,y,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,life:1,decay:0.03+Math.random()*0.02,sz:1.5+Math.random()*1.2,color});}
  function update(){for(let i=list.length-1;i>=0;i--){const p=list[i];p.x+=p.vx;p.y+=p.vy;p.vx*=0.96;p.vy*=0.96;p.life-=p.decay;if(p.life<=0)list.splice(i,1);}}
  function render(){for(const p of list){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  function clear(){list=[];}
  return {createExplosion,createTrail,update,render,clear};
})();

// --- Screen Shake ---
const ScreenShake = (() => {
  let intensity=0,ox=0,oy=0;
  function trigger(n){intensity=n;}
  function update(){if(intensity>0){ox=(Math.random()-0.5)*intensity;oy=(Math.random()-0.5)*intensity;intensity*=0.85;if(intensity<0.2){intensity=0;ox=oy=0;}}}
  return {trigger,update,getOffset:()=>({x:ox,y:oy})};
})();

// --- Jet ---
const Jet = (() => {
  let x,y,vx,vy,angle;
  const maxSpeed=4.5,turboSpeed=9,friction=0.955;
  let fuel=100,fuelMax=100,isTurbo=false,turboCooldown=0;
  // Shield visual
  let shieldActive=false,shieldTimer=0;

  function reset(){
    x=W()/2;y=H()/2;vx=vy=0;angle=-Math.PI/2;
    fuel=100;turboCooldown=0;isTurbo=false;
    shieldActive=false;shieldTimer=0;
  }

  function update(input){
    // Shield timer
    if(shieldActive){shieldTimer--;if(shieldTimer<=0)shieldActive=false;}

    const curMax=(input.turbo&&fuel>0&&turboCooldown<=0)?turboSpeed:maxSpeed;
    isTurbo=curMax===turboSpeed;
    if(isTurbo){fuel=Math.max(0,fuel-1.2);if(fuel<=0)turboCooldown=100;}
    else{fuel=Math.min(fuelMax,fuel+0.18);if(turboCooldown>0)turboCooldown--;}

    if(input.dx||input.dy){
      const ta=Math.atan2(input.dy,input.dx);
      angle=lerp(angle,ta,0.12);
      vx=lerp(vx,input.dx*curMax,0.1);
      vy=lerp(vy,input.dy*curMax,0.1);
    }
    vx*=friction;vy*=friction;x+=vx;y+=vy;
    const m=20;if(x<-m)x=W()+m;if(x>W()+m)x=-m;if(y<-m)y=H()+m;if(y>H()+m)y=-m;

    const speed=Math.hypot(vx,vy);
    if(speed>0.8&&Math.random()>0.4){
      const col=isTurbo?'#ff6600':'#00aaff';
      Particles.createTrail(x-vx*2+(Math.random()-0.5)*4,y-vy*2+(Math.random()-0.5)*4,col);
      if(isTurbo)Particles.createTrail(x-vx*2,y-vy*2,'#ffaa00');
    }
    return {fuel:fuel/fuelMax,isTurbo,cooldown:turboCooldown/100};
  }

  function render(){
    // Shield aura
    if(shieldActive){
      const shieldProgress = shieldTimer / 120; // 2 seconds = 120 frames
      ctx.save();ctx.translate(x,y);
      // Pulsing ring
      const pulse = Math.sin(Date.now()*0.008)*3;
      ctx.globalAlpha=0.15+Math.sin(Date.now()*0.005)*0.08;
      const sg=ctx.createRadialGradient(0,0,10,0,0,28+pulse);
      sg.addColorStop(0,'rgba(0,150,255,0)'); sg.addColorStop(0.7,'rgba(0,150,255,0.3)'); sg.addColorStop(1,'rgba(0,100,255,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,28+pulse,0,Math.PI*2); ctx.fill();
      // Shield ring
      ctx.globalAlpha=0.5+Math.sin(Date.now()*0.01)*0.2;
      ctx.strokeStyle='#44aaff'; ctx.lineWidth=3;
      ctx.setLineDash([8,4]); ctx.lineDashOffset = -Date.now()*0.03;
      ctx.beginPath(); ctx.arc(0,0,22+pulse*0.5,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // Sparkles
      ctx.globalAlpha=0.8; ctx.fillStyle='#88ddff';
      for(let i=0;i<4;i++){
        const a=Date.now()*0.003+i*Math.PI/2;
        const r=18+Math.sin(Date.now()*0.005+i)*3;
        ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha=1;
    }

    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const glow=ctx.createRadialGradient(0,0,4,0,0,25);
    glow.addColorStop(0,isTurbo?'rgba(255,100,0,0.4)':'rgba(0,170,255,0.3)'); glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();

    ctx.fillStyle=isTurbo?'#ff8844':'#4488cc';
    ctx.strokeStyle=isTurbo?'#ffaa66':'#66aaff';ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-7,-9); ctx.lineTo(-3,-3.5); ctx.lineTo(-11,-2.5); ctx.lineTo(-11,2.5); ctx.lineTo(-3,3.5); ctx.lineTo(-7,9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle=isTurbo?'#ffcc88':'#88ccff';
    ctx.beginPath();ctx.ellipse(3,0,4.5,2.5,0,0,Math.PI*2);ctx.fill();
    const fl=isTurbo?8+Math.random()*6:3+Math.random()*3;
    ctx.fillStyle=isTurbo?'#ff4400':'#4488ff';ctx.beginPath();ctx.moveTo(-11,-1.5);ctx.lineTo(-11-fl,0);ctx.lineTo(-11,1.5);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function getBounds(){return {x,y,r:10};}
  return {
    reset,update,render,getBounds,
    activateShield(){shieldActive=true;shieldTimer=120;},
    isShieldActive:()=>shieldActive,
    getShieldProgress:()=>shieldActive?shieldTimer/120:0
  };
})();

// --- Rockets ---
const Rockets = (() => {
  let list=[];
  let timer=0,interval=150,gameTime=0;

  function reset(){list=[];timer=0;gameTime=0;interval=diff.spawnIntervalStart;}

  function spawn(jx,jy){
    if(list.length>=diff.maxMissiles) return;
    let rx,ry,side=Math.floor(Math.random()*4),margin=40;
    switch(side){
      case 0:rx=-margin;ry=Math.random()*H();break;case 1:rx=W()+margin;ry=Math.random()*H();break;
      case 2:rx=Math.random()*W();ry=-margin;break;case 3:rx=Math.random()*W();ry=H()+margin;break;
    }
    const a=angleTo(rx,ry,jx,jy);
    const spd=clamp(diff.missileBaseSpeed+gameTime*diff.missileSpeedScale+Math.random()*0.4,0,diff.missileMaxSpeed);
    list.push({x:rx,y:ry,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,angle:a,spd,turn:diff.turnRate+(gameTime>500?0.008:0),trail:[],alive:true});
    AudioSys.play('launch');
  }

  function update(jx,jy,decoy){
    gameTime++;
    interval=clamp(diff.spawnIntervalMin, diff.spawnIntervalStart-gameTime*0.04, diff.spawnIntervalStart);
    timer++;
    if(timer>=interval){timer=0;spawn(jx,jy);}

    for(let i=list.length-1;i>=0;i--){
      const r=list[i];if(!r.alive)continue;
      
      let targetX=jx, targetY=jy;
      // Jammer: rocket goes random
      if(Powerups.isJammerActive()){
        const randomTarget = Powerups.getJammerTarget(r.x, r.y);
        targetX = randomTarget.x;
        targetY = randomTarget.y;
      }
      // Decoy: rockets chase decoy
      if(Powerups.isDecoyActive()){
        const decoyPos = Powerups.getDecoyPosition();
        if(decoyPos){
          targetX = decoyPos.x;
          targetY = decoyPos.y;
        }
      }
      
      const ta=angleTo(r.x,r.y,targetX,targetY);
      r.angle+=clamp(angleDiff(r.angle,ta),-r.turn,r.turn);
      r.vx=Math.cos(r.angle)*r.spd;r.vy=Math.sin(r.angle)*r.spd;
      r.x+=r.vx;r.y+=r.vy;

      r.trail.push({x:r.x,y:r.y,life:1});
      if(r.trail.length>12)r.trail.shift();
      for(const t of r.trail)t.life-=0.08;
      r.trail=r.trail.filter(t=>t.life>0);

      if(r.x<-250||r.x>W()+250||r.y<-250||r.y>H()+250)list.splice(i,1);
    }
  }

  function checkCollisions(jetBounds){
    for(let i=0;i<list.length;i++){for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(!a.alive||!b.alive)continue;
      if(dist(a.x,a.y,b.x,b.y)<14){
        a.alive=b.alive=false;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        Particles.createExplosion(mx,my,25,'#ff8800',4);
        Particles.createExplosion(mx,my,10,'#ffff00',2);
        AudioSys.play('explode');ScreenShake.trigger(5);
        list.splice(j,1);list.splice(i,1);break;
      }
    }}
    // Jet collision - shield protects
    for(const r of list){
      if(r.alive && dist(r.x,r.y,jetBounds.x,jetBounds.y)<jetBounds.r+6){
        if(Jet.isShieldActive()) return false; // Shield protects
        return true;
      }
    }
    return false;
  }

  function render(){
    for(const r of list){
      if(!r.alive)continue;
      for(const t of r.trail){ctx.globalAlpha=t.life*0.5;ctx.fillStyle='#ff4400';ctx.beginPath();ctx.arc(t.x,t.y,2*t.life,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
      ctx.globalAlpha=0.25;
      const g=ctx.createRadialGradient(r.x,r.y,2,r.x,r.y,14);
      g.addColorStop(0,'rgba(255,60,0,0.6)');g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(r.x,r.y,14,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;

      ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.angle);
      ctx.fillStyle='#ff2200';ctx.strokeStyle='#ff8844';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-3.5);ctx.lineTo(-7,-2.5);ctx.lineTo(-7,2.5);ctx.lineTo(-5,3.5);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.moveTo(-7,-1.5);ctx.lineTo(-7-3-Math.random()*4,0);ctx.lineTo(-7,1.5);ctx.closePath();ctx.fill();
      ctx.restore();
    }
  }

  return {reset,update,render,checkCollisions};
})();

// --- Decoy ---
const DecoySystem = (() => {
  let active=false, x=0, y=0, vx=0, vy=0, timer=0;
  const MAX_TIME = 240; // 4 seconds at 60fps

  function activate(jx, jy){
    active=true; timer=MAX_TIME;
    x=jx; y=jy;
    // Move decoy in a direction
    const angle = Math.random()*Math.PI*2;
    const speed = 2.5;
    vx = Math.cos(angle)*speed;
    vy = Math.sin(angle)*speed;
  }

  function update(){
    if(!active) return;
    timer--;
    x += vx; y += vy;
    // Bounce off edges
    if(x<50||x>W()-50)vx*=-1;
    if(y<50||y>H()-50)vy*=-1;
    // Add slight wobble
    vx += (Math.random()-0.5)*0.3;
    vy += (Math.random()-0.5)*0.3;
    // Clamp speed
    const spd=Math.hypot(vx,vy);
    if(spd>3){vx=vx/spd*3;vy=vy/spd*3;}
    
    // Trail
    if(Math.random()>0.5){
      Particles.createTrail(x+(Math.random()-0.5)*8,y+(Math.random()-0.5)*8,'#ffaa44');
      Particles.createTrail(x+(Math.random()-0.5)*10,y+(Math.random()-0.5)*10,'#ff6600');
    }
    if(timer<=0)active=false;
  }

  function render(){
    if(!active)return;
    const t=timer/MAX_TIME;
    const pulse = Math.sin(Date.now()*0.01)*5;
    
    ctx.save();ctx.translate(x,y);
    // Outer glow
    ctx.globalAlpha=0.25;
    const og=ctx.createRadialGradient(0,0,5,0,0,30+pulse);
    og.addColorStop(0,'rgba(255,160,0,0.6)');og.addColorStop(1,'transparent');
    ctx.fillStyle=og;ctx.beginPath();ctx.arc(0,0,30+pulse,0,Math.PI*2);ctx.fill();
    
    // Core
    ctx.globalAlpha=0.9;
    const coreGrad = ctx.createRadialGradient(0,0,2,0,0,8);
    coreGrad.addColorStop(0,'#fff'); coreGrad.addColorStop(0.5,'#ff8844'); coreGrad.addColorStop(1,'transparent');
    ctx.fillStyle=coreGrad; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    
    // Spinning ring
    ctx.globalAlpha=0.6; ctx.strokeStyle='#ff6600'; ctx.lineWidth=2;
    ctx.setLineDash([4,6]); ctx.lineDashOffset=-Date.now()*0.04;
    ctx.beginPath(); ctx.arc(0,0,15+pulse*0.5,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore(); ctx.globalAlpha=1;
  }

  function isActive(){return active;}
  function getPosition(){return active?{x,y}:null;}
  function getProgress(){return active?timer/MAX_TIME:0;}

  return {activate,update,render,isActive,getPosition,getProgress};
})();

// --- Powerup Bubbles ---
const Powerups = (() => {
  let list = [];
  let timer = 0, nextInterval = 500;
  let jammerActive = false, jammerTimer = 0;
  let jammerTarget = {x:0,y:0};
  let decoyActive = false;

  function getNextInterval(){
    const min = diff.powerupInterval[0], max = diff.powerupInterval[1];
    return min + Math.random()*(max-min);
  }

  function reset(){ list=[]; timer=getNextInterval(); jammerActive=false; jammerTimer=0; decoyActive=false; }

  function update(){
    // Spawn timer
    timer--;
    if(timer<=0 && list.length<2){
      spawn();
      timer = getNextInterval();
    }

    // Update existing bubbles
    for(let i=list.length-1;i>=0;i--){
      const b=list[i];
      b.life--;
      b.wobble = Math.sin(Date.now()*0.003 + i)*8;
      if(b.life<=0) list.splice(i,1);
    }

    // Jammer timer
    if(jammerActive){
      jammerTimer--;
      // Update jammer random target
      if(jammerTimer%30===0){
        jammerTarget = {x: Math.random()*W(), y: Math.random()*H()};
      }
      if(jammerTimer<=0) jammerActive=false;
    }

    // Decoy update
    DecoySystem.update();
  }

  function spawn(){
    const types = ['shield','jammer','decoy'];
    const type = types[Math.floor(Math.random()*types.length)];
    const margin = 60;
    list.push({
      x: margin + Math.random()*(W()-margin*2),
      y: margin + Math.random()*(H()-margin*2),
      type, life: 600, wobble: 0, // 10 seconds lifetime
      scale: 0, // spawn animation
    });
  }

  function collect(x, y){
    for(let i=list.length-1;i>=0;i--){
      const b=list[i];
      if(dist(x,y,b.x,b.y)<28){
        // Collect effect
        AudioSys.play('powerup');
        Particles.createExplosion(b.x,b.y,20,b.type==='shield'?'#44aaff':b.type==='jammer'?'#cc66ff':'#ffaa44',3);
        ScreenShake.trigger(3);
        
        // Activate effect
        if(b.type==='shield'){ Jet.activateShield(); }
        else if(b.type==='jammer'){
          jammerActive=true; jammerTimer=300; // 5 seconds
          jammerTarget={x:Math.random()*W(),y:Math.random()*H()};
        }
        else if(b.type==='decoy'){
          DecoySystem.activate(x,y);
        }
        
        list.splice(i,1);
        return true;
      }
    }
    return false;
  }

  function render(){
    // Draw bubbles
    for(const b of list){
      b.scale = Math.min(1, b.scale + 0.03);
      const s = b.scale;
      const yOff = b.wobble;
      const pulse = Math.sin(Date.now()*0.004)*2;

      // Fade out near end
      const fade = b.life < 60 ? b.life/60 : 1;

      ctx.save();
      ctx.translate(b.x, b.y + yOff);
      ctx.globalAlpha = fade * s;

      // Glow
      const color = b.type==='shield'?'#44aaff':b.type==='jammer'?'#cc66ff':'#ff8844';
      const glow = ctx.createRadialGradient(0,0,5,0,0,28+pulse);
      glow.addColorStop(0, `${color}44`);
      glow.addColorStop(0.5, `${color}22`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle=glow;
      ctx.beginPath();ctx.arc(0,0,28+pulse,0,Math.PI*2);ctx.fill();

      // Bubble
      ctx.fillStyle=`${color}88`;
      ctx.strokeStyle=color;
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();

      // Icon
      ctx.fillStyle='#fff';
      ctx.font='16px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      const icon = b.type==='shield'?'🛡️':b.type==='jammer'?'📡':'🎯';
      ctx.fillText(icon,0,1);

      // Rotating ring
      ctx.globalAlpha = fade * s * 0.4;
      ctx.strokeStyle=color;ctx.lineWidth=1;
      ctx.setLineDash([3,5]);ctx.lineDashOffset=Date.now()*0.02;
      ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
      ctx.globalAlpha=1;
    }
  }

  function isJammerActive(){return jammerActive;}
  function getJammerTarget(cx,cy){
    return jammerTarget || {x:cx+rand(-100,100), y:cy+rand(-100,100)};
  }
  function isDecoyActive(){return DecoySystem.isActive();}
  function getDecoyPosition(){return DecoySystem.getPosition();}

  return {reset,update,render,collect,isJammerActive,getJammerTarget,isDecoyActive,getDecoyPosition};
})();

// --- Game State ---
let state='menu', score=0, scoreTimer=0, gameOver=false;
const uiScore=document.getElementById('score-display');
const uiFuel=document.getElementById('fuel-bar');
const uiCooldown=document.getElementById('cooldown-indicator');
const screenStart=document.getElementById('start-screen');
const screenEnd=document.getElementById('game-over-screen');
const uiFinalScore=document.getElementById('final-score');
const pills = {
  shield: document.getElementById('pill-shield'),
  jammer: document.getElementById('pill-jammer'),
  decoy: document.getElementById('pill-decoy'),
};

function startGame(diffName){
  AudioSys.init();
  difficulty=diffName;
  diff=DIFFICULTIES[diffName];
  state='playing';score=0;scoreTimer=0;gameOver=false;
  Jet.reset();Rockets.reset();Particles.clear();Background.init();Powerups.reset();
  screenStart.classList.add('hide');screenEnd.classList.add('hide');
  pills.shield.classList.remove('active');
  pills.jammer.classList.remove('active');
  pills.decoy.classList.remove('active');
}

function endGame(){
  if(gameOver)return;
  gameOver=true;state='gameover';
  uiFinalScore.textContent=`SCORE: ${Math.floor(score)} [${diff.label}]`;
  const b=Jet.getBounds();
  Particles.createExplosion(b.x,b.y,50,'#ff4400',5);
  Particles.createExplosion(b.x,b.y,25,'#ffff00',3);
  ScreenShake.trigger(12);AudioSys.play('explode');
  setTimeout(()=>screenEnd.classList.remove('hide'),700);
}

// Difficulty selection
document.querySelectorAll('.diff-btn').forEach(btn=>{
  btn.addEventListener('touchstart',e=>{
    e.preventDefault();
    btn.style.transform='scale(0.95)';
    setTimeout(()=>{btn.style.transform='';},150);
    startGame(btn.dataset.diff);
  },{passive:false});
});

document.getElementById('restart-btn').addEventListener('touchstart',e=>{
  e.preventDefault();
  screenEnd.classList.add('hide');
  screenStart.classList.remove('hide');
},{passive:false});

// --- Main Loop ---
function loop(){
  ScreenShake.update();
  const sh=ScreenShake.getOffset();

  if(state==='playing'){
    const input=Input.getInput();
    const jStat=Jet.update(input);
    const jb=Jet.getBounds();
    
    Rockets.update(jb.x,jb.y,Powerups.getDecoyPosition());
    Rockets.checkCollisions(jb);
    Powerups.collect(jb.x,jb.y);
    Powerups.update();
    
    if(Rockets.checkCollisions(jb)) endGame();

    scoreTimer++;score+=0.08+(scoreTimer*0.0001);
    uiScore.textContent=`SCORE: ${Math.floor(score)}`;
    uiFuel.style.width=`${jStat.fuel*100}%`;
    uiFuel.style.background=jStat.fuel<0.2?'linear-gradient(90deg,#ff0000,#ff4400)':'linear-gradient(90deg,#ff6600,#ffcc00,#00ff88)';

    if(jStat.cooldown>0){uiCooldown.classList.add('active');uiCooldown.textContent=`⚡ COOLDOWN ${Math.ceil(jStat.cooldown*100)}%`;}
    else{uiCooldown.classList.remove('active');}

    // Pill updates
    if(Jet.isShieldActive()){pills.shield.classList.add('active');pills.shield.textContent=`🛡️ ${Math.ceil(Jet.getShieldProgress()*2)}s`;}
    else{pills.shield.classList.remove('active');pills.shield.textContent='🛡️ SHIELD';}

    if(Powerups.isJammerActive()){pills.jammer.classList.add('active');pills.jammer.textContent=`📡 ${Math.ceil(Powerups.getJammerTarget().x)}s`;}
    else{pills.jammer.classList.remove('active');pills.jammer.textContent='📡 JAMMER';}
    // Fix jammer pill display
    if(Powerups.isJammerActive()){
      const jamTimeLeft = Powerups.getJammerTarget()?3:0; // approximate
      pills.jammer.classList.add('active');
    }

    if(Powerups.isDecoyActive()){pills.decoy.classList.add('active');}
    else{pills.decoy.classList.remove('active');}

    Particles.update();Background.update();
  } else if(state==='gameover'){
    Particles.update();Powerups.update();Background.update();
  } else {
    Background.update();
  }

  // Render
  ctx.save();ctx.translate(sh.x,sh.y);
  Background.render();
  if(state!=='menu'){
    Powerups.render();
    Particles.render();
    Rockets.render();
    DecoySystem.render();
    if(state==='playing') Jet.render();
    
    // Joystick visual
    const j=Input.j;
    if(j.active){
      ctx.globalAlpha=0.15;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(j.sx,j.sy,40,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=0.35;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(j.sx,j.sy,40,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=0.55;ctx.fillStyle='#00ccff';
      ctx.beginPath();ctx.arc(j.sx+j.dx*40,j.sy+j.dy*40,16,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  ctx.restore();

  requestAnimationFrame(loop);
}

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

loop();