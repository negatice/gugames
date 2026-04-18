// ============================================================
// JET MANEUVER - Mobile Optimized + Zoom + Rocket Types + Rich Audio
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// --- Utility ---
const dist = (x1,y1,x2,y2) => Math.hypot(x2-x1,y2-y1);
const angleTo = (x1,y1,x2,y2) => Math.atan2(y2-y1,x2-x1);
const angleDiff = (a,b) => { let d=b-a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; };
const lerp = (a,b,t) => a+(b-a)*t;
const clamp = (v,mi,ma) => Math.max(mi,Math.min(ma,v));
const rand = (mi,ma) => mi+Math.random()*(ma-mi);

// --- Audio System ---
const AudioSys = (() => {
  let actx = null, warningCD = 0;
  function init() { if(!actx) actx=new(window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); }
  function play(type, vol=0.12) {
    if(!actx) return;
    const now = actx.currentTime, g = actx.createGain(), o = actx.createOscillator(), f = actx.createBiquadFilter();
    const playSound = (os,gn,fl) => { if(os)os.connect(fl||gn).connect(gn).connect(actx.destination); };
    
    switch(type) {
      case 'explode': {
        const buf=actx.createBuffer(1,actx.sampleRate*0.35,actx.sampleRate), d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8);
        const s=actx.createBufferSource(); s.buffer=buf;
        const fg=actx.createGain(); fg.gain.setValueAtTime(vol*1.2,now); fg.gain.exponentialRampToValueAtTime(0.001,now+0.35);
        const ff=actx.createBiquadFilter(); ff.type='lowpass'; ff.frequency.setValueAtTime(1200,now); ff.frequency.exponentialRampToValueAtTime(60,now+0.35);
        s.connect(ff).connect(fg).connect(actx.destination); s.start(now); break;
      }
      case 'launch':
        o.type='sawtooth'; o.frequency.setValueAtTime(350,now); o.frequency.exponentialRampToValueAtTime(50,now+0.25);
        g.gain.setValueAtTime(vol*0.6,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
        f.type='lowpass'; f.frequency.setValueAtTime(800,now); f.frequency.exponentialRampToValueAtTime(200,now+0.25);
        o.connect(f).connect(g).connect(actx.destination); o.start(now); o.stop(now+0.25); break;
      case 'turbo':
        o.type='sine'; o.frequency.setValueAtTime(200,now); o.frequency.linearRampToValueAtTime(850,now+0.12);
        g.gain.setValueAtTime(vol*0.5,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
        o.connect(g).connect(actx.destination); o.start(now); o.stop(now+0.15); break;
      case 'powerup':
        [523.25, 659.25, 783.99].forEach((fr,i)=>{
          const o2=actx.createOscillator(); o2.type='sine'; o2.frequency.value=fr;
          const g2=actx.createGain(); g2.gain.setValueAtTime(0,now+i*0.06); g2.gain.linearRampToValueAtTime(vol*0.7,now+i*0.06+0.02); g2.gain.exponentialRampToValueAtTime(0.001,now+i*0.06+0.2);
          o2.connect(g2).connect(actx.destination); o2.start(now+i*0.06); o2.stop(now+i*0.06+0.2);
        }); break;
      case 'shield':
        o.type='sine'; o.frequency.setValueAtTime(800,now); o.frequency.exponentialRampToValueAtTime(1200,now+0.2);
        g.gain.setValueAtTime(vol*0.5,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
        o.connect(g).connect(actx.destination); o.start(now); o.stop(now+0.25); break;
      case 'warning':
        if(now < warningCD + 0.45) return;
        warningCD = now;
        o.type='square'; o.frequency.setValueAtTime(440,now); o.frequency.setValueAtTime(660,now+0.08);
        g.gain.setValueAtTime(vol*0.3,now); g.gain.setValueAtTime(vol*0.3,now+0.06); g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
        o.connect(g).connect(actx.destination); o.start(now); o.stop(now+0.12); break;
      case 'gameover':
        [440, 415.30, 392.00, 349.23].forEach((fr,i)=>{
          const o2=actx.createOscillator(); o2.type='sawtooth'; o2.frequency.value=fr;
          const g2=actx.createGain(); g2.gain.setValueAtTime(vol*0.5,now+i*0.3); g2.gain.exponentialRampToValueAtTime(0.001,now+i*0.3+0.25);
          const f2=actx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=600;
          o2.connect(f2).connect(g2).connect(actx.destination); o2.start(now+i*0.3); o2.stop(now+i*0.3+0.3);
        }); break;
    }
  }
  return { init, play };
})();

// --- Resize ---
function resizeCanvas() { const dpr=window.devicePixelRatio||1; canvas.width=window.innerWidth*dpr; canvas.height=window.innerHeight*dpr; ctx.scale(dpr,dpr); }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
const W=()=>window.innerWidth, H=()=>window.innerHeight;

// --- Input ---
const Input = (() => {
  let j={active:false,dx:0,dy:0,tid:null,sx:0,sy:0};
  let turbo=false;
  canvas.addEventListener('touchstart',e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.clientX<W()/2&&!j.active){j.active=true;j.tid=t.identifier;j.sx=t.clientX;j.sy=t.clientY;j.dx=j.dy=0;} } },{passive:false});
  canvas.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===j.tid&&j.active){ const dx=t.clientX-j.sx, dy=t.clientY-j.sy, d=Math.hypot(dx,dy), m=45; j.dx=clamp(dx,-m,m)/m; j.dy=clamp(dy,-m,m)/m; } } },{passive:false});
  const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===j.tid){j.active=false;j.tid=null;j.dx=j.dy=0;} } };
  canvas.addEventListener('touchend',end,{passive:false}); canvas.addEventListener('touchcancel',end,{passive:false});
  const btn=document.getElementById('turbo-btn');
  btn.addEventListener('touchstart',e=>{e.preventDefault();turbo=true;},{passive:false});
  btn.addEventListener('touchend',e=>{e.preventDefault();turbo=false;},{passive:false});
  btn.addEventListener('touchcancel',()=>{turbo=false;});
  return {getInput:()=>({dx:j.dx,dy:j.dy,turbo}), j};
})();

// --- Difficulty ---
const DIFF = {
  easy: { label:'MUDAH', missileBaseSpeed:2.2, missileMaxSpeed:4.0, turnRate:0.022, spawnStart:200, spawnMin:90, maxM:10, mScale:0.00006, pwrInt:[450,700] },
  medium: { label:'SEDANG', missileBaseSpeed:2.8, missileMaxSpeed:5.5, turnRate:0.032, spawnStart:150, spawnMin:55, maxM:15, mScale:0.0001, pwrInt:[550,950] },
  hard: { label:'SULIT', missileBaseSpeed:3.3, missileMaxSpeed:6.5, turnRate:0.045, spawnStart:100, spawnMin:35, maxM:20, mScale:0.00015, pwrInt:[800,1400] }
};
let diff = DIFF.medium;

// --- Background ---
const Background = (() => {
  let stars=[];
  function init(){ stars=Array.from({length:100},()=>({x:Math.random()*W(),y:Math.random()*H(),s:Math.random()*1.1+0.3,spd:Math.random()*0.15+0.03,br:Math.random()})); }
  function update(){ for(const s of stars){s.y+=s.spd;s.br+=((Math.random()-0.5)*0.02);s.br=clamp(s.br,0.15,0.9);if(s.y>H()){s.y=0;s.x=Math.random()*W();}} }
  function render(){ const g=ctx.createLinearGradient(0,0,0,H()); g.addColorStop(0,'#050510'); g.addColorStop(0.5,'#0a0a2e'); g.addColorStop(1,'#0f0520'); ctx.fillStyle=g; ctx.fillRect(0,0,W(),H()); for(const s of stars){ctx.globalAlpha=s.br;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();} ctx.globalAlpha=1; }
  return {init,update,render};
})();

// --- Particles ---
const Particles = (() => {
  let list=[];
  function createExplosion(x,y,count,color,speed){ for(let i=0;i<count;i++){ const a=Math.random()*Math.PI*2,s=Math.random()*speed+speed*0.15; list.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.015+Math.random()*0.025,sz:2+Math.random()*3,color}); } }
  function createTrail(x,y,color){ list.push({x,y,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,life:1,decay:0.03+Math.random()*0.02,sz:1.5+Math.random()*1.2,color}); }
  function update(){ for(let i=list.length-1;i>=0;i--){ const p=list[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.96; p.vy*=0.96; p.life-=p.decay; if(p.life<=0) list.splice(i,1); } }
  function render(){ for(const p of list){ ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; }
  function clear(){ list=[]; }
  return {createExplosion,createTrail,update,render,clear};
})();

// --- Screen Shake ---
const ScreenShake = (() => {
  let intensity=0,ox=0,oy=0;
  function trigger(n){ intensity=n; }
  function update(){ if(intensity>0){ ox=(Math.random()-0.5)*intensity; oy=(Math.random()-0.5)*intensity; intensity*=0.85; if(intensity<0.2){ intensity=0; ox=oy=0; } } }
  return {trigger,update,getOffset:()=>({x:ox,y:oy})};
})();

// --- Camera Zoom ---
const Camera = (() => {
  let zoom=1, target=1;
  function update(isTurbo){ target = isTurbo ? 1.12 : 1.0; zoom = lerp(zoom, target, 0.08); }
  function apply(ctx){ ctx.translate(W()/2, H()/2); ctx.scale(zoom, zoom); ctx.translate(-W()/2, -H()/2); }
  return {update,apply, get:()=>zoom};
})();

// --- Jet ---
const Jet = (() => {
  let x,y,vx,vy,angle;
  const maxSpeed=4.5,turboSpeed=9,friction=0.955;
  let fuel=100,fuelMax=100,isTurbo=false,turboCooldown=0;
  let shieldActive=false,shieldTimer=0;
  function reset(){ x=W()/2;y=H()/2;vx=vy=0;angle=-Math.PI/2; fuel=100;turboCooldown=0;isTurbo=false; shieldActive=false;shieldTimer=0; }
  function update(input){
    if(shieldActive){shieldTimer--;if(shieldTimer<=0)shieldActive=false;}
    const curMax=(input.turbo&&fuel>0&&turboCooldown<=0)?turboSpeed:maxSpeed;
    isTurbo=curMax===turboSpeed;
    if(isTurbo){fuel=Math.max(0,fuel-1.2);if(fuel<=0)turboCooldown=100;}
    else{fuel=Math.min(fuelMax,fuel+0.18);if(turboCooldown>0)turboCooldown--;}
    if(input.dx||input.dy){ const ta=Math.atan2(input.dy,input.dx); angle=lerp(angle,ta,0.12); vx=lerp(vx,input.dx*curMax,0.1); vy=lerp(vy,input.dy*curMax,0.1); }
    vx*=friction;vy*=friction;x+=vx;y+=vy;
    const m=20;if(x<-m)x=W()+m;if(x>W()+m)x=-m;if(y<-m)y=H()+m;if(y>H()+m)y=-m;
    const speed=Math.hypot(vx,vy);
    if(speed>0.8&&Math.random()>0.4){ Particles.createTrail(x-vx*2+(Math.random()-0.5)*4,y-vy*2+(Math.random()-0.5)*4,isTurbo?'#ff6600':'#00aaff'); if(isTurbo) Particles.createTrail(x-vx*2,y-vy*2,'#ffaa00'); }
    return {fuel:fuel/fuelMax,isTurbo,cooldown:turboCooldown/100};
  }
  function render(){
    if(shieldActive){
      ctx.save();ctx.translate(x,y);
      const pulse=Math.sin(Date.now()*0.006)*3;
      ctx.globalAlpha=0.15+Math.sin(Date.now()*0.004)*0.08;
      const sg=ctx.createRadialGradient(0,0,10,0,0,28+pulse); sg.addColorStop(0,'rgba(0,150,255,0)'); sg.addColorStop(0.7,'rgba(0,150,255,0.3)'); sg.addColorStop(1,'rgba(0,100,255,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,28+pulse,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.5+Math.sin(Date.now()*0.008)*0.2; ctx.strokeStyle='#44aaff'; ctx.lineWidth=3; ctx.setLineDash([8,4]); ctx.lineDashOffset=-Date.now()*0.03; ctx.beginPath(); ctx.arc(0,0,22+pulse*0.5,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha=0.8; ctx.fillStyle='#88ddff'; for(let i=0;i<4;i++){ const a=Date.now()*0.003+i*Math.PI/2; const r=18+Math.sin(Date.now()*0.004+i)*3; ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2,0,Math.PI*2); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha=1;
    }
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const glow=ctx.createRadialGradient(0,0,4,0,0,25); glow.addColorStop(0,isTurbo?'rgba(255,100,0,0.4)':'rgba(0,170,255,0.3)'); glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=isTurbo?'#ff8844':'#4488cc'; ctx.strokeStyle=isTurbo?'#ffaa66':'#66aaff'; ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-7,-9);ctx.lineTo(-3,-3.5);ctx.lineTo(-11,-2.5);ctx.lineTo(-11,2.5);ctx.lineTo(-3,3.5);ctx.lineTo(-7,9);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=isTurbo?'#ffcc88':'#88ccff'; ctx.beginPath();ctx.ellipse(3,0,4.5,2.5,0,0,Math.PI*2);ctx.fill();
    const fl=isTurbo?8+Math.random()*6:3+Math.random()*3; ctx.fillStyle=isTurbo?'#ff4400':'#4488ff'; ctx.beginPath();ctx.moveTo(-11,-1.5);ctx.lineTo(-11-fl,0);ctx.lineTo(-11,1.5);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function getBounds(){return {x,y,r:10};}
  return {reset,update,render,getBounds,activateShield(){shieldActive=true;shieldTimer=120;AudioSys.play('shield');},isShieldActive:()=>shieldActive,getShieldProgress:()=>shieldActive?shieldTimer/120:0};
})();

// --- Rocket System ---
const Rockets = (() => {
  let list=[];
  let timer=0,interval=150,gameTime=0;
  const TYPES = {
    standard: { speedM:1.0, turnM:1.0, color:'#ff2200', size:1.0, trailLen:12 },
    fast:     { speedM:1.6, turnM:0.40, color:'#ffcc00', size:0.75, trailLen:8 },
    heavy:    { speedM:0.65, turnM:2.4, color:'#ff4488', size:1.3, trailLen:18 }
  };

  function reset(){ list=[]; timer=0; gameTime=0; interval=diff.spawnStart; }
  function spawn(jx,jy){
    if(list.length>=diff.maxM) return;
    let type='standard'; const r=Math.random();
    if(r<0.25) type='fast'; else if(r<0.50) type='heavy';
    const t=TYPES[type];
    let rx,ry,side=Math.floor(Math.random()*4),margin=40;
    switch(side){ case 0:rx=-margin;ry=Math.random()*H();break; case 1:rx=W()+margin;ry=Math.random()*H();break; case 2:rx=Math.random()*W();ry=-margin;break; case 3:rx=Math.random()*W();ry=H()+margin;break; }
    const a=angleTo(rx,ry,jx,jy);
    const spd=clamp(diff.missileBaseSpeed*t.speedM+gameTime*diff.mScale+Math.random()*0.4,0,diff.missileMaxSpeed*t.speedM);
    list.push({x:rx,y:ry,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,angle:a,spd,turn:diff.turnRate*t.turnM+(gameTime>500?0.008:0),trail:[],alive:true,type,color:t.color,size:t.size,maxTrail:t.trailLen});
    AudioSys.play('launch');
  }
  function update(jx,jy,decoyPos){
    gameTime++;
    interval=clamp(diff.spawnMin, diff.spawnStart-gameTime*0.04, diff.spawnStart);
    timer++;
    if(timer>=interval){timer=0;spawn(jx,jy);}
    for(let i=list.length-1;i>=0;i--){
      const r=list[i];if(!r.alive)continue;
      let tx=jx,ty=jy;
      if(Powerups.isJammerActive()){ const jt=Powerups.getJammerTarget(); tx=jt.x; ty=jt.y; }
      if(Powerups.isDecoyActive()&&decoyPos){ tx=decoyPos.x; ty=decoyPos.y; }
      const ta=angleTo(r.x,r.y,tx,ty);
      r.angle+=clamp(angleDiff(r.angle,ta),-r.turn,r.turn);
      r.vx=Math.cos(r.angle)*r.spd; r.vy=Math.sin(r.angle)*r.spd;
      r.x+=r.vx; r.y+=r.vy;
      r.trail.push({x:r.x,y:r.y,life:1});
      if(r.trail.length>r.maxTrail)r.trail.shift();
      for(const t of r.trail)t.life-=0.08;
      r.trail=r.trail.filter(t=>t.life>0);
      if(r.x<-250||r.x>W()+250||r.y<-250||r.y>H()+250)list.splice(i,1);
    }
  }
  function checkCollisions(jb){
    for(let i=0;i<list.length;i++){ for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(!a.alive||!b.alive)continue;
      if(dist(a.x,a.y,b.x,b.y)<14){
        a.alive=b.alive=false;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        Particles.createExplosion(mx,my,25,a.color,4); Particles.createExplosion(mx,my,10,'#ffff00',2);
        AudioSys.play('explode');ScreenShake.trigger(5); list.splice(j,1);list.splice(i,1);break;
      }
    }}
    for(const r of list){
      if(r.alive&&dist(r.x,r.y,jb.x,jb.y)<jb.r+6){
        if(Jet.isShieldActive()){
          Particles.createExplosion(r.x,r.y,15,'#88ddff',3);
          r.alive=false;
          list.splice(list.indexOf(r),1);
          return false;
        }
        return true;
      }
    }
    return false;
  }
  function render(){
    for(const r of list){
      if(!r.alive)continue;
      for(const t of r.trail){ ctx.globalAlpha=t.life*0.5; ctx.fillStyle=r.color; ctx.beginPath(); ctx.arc(t.x,t.y,2*t.life*r.size,0,Math.PI*2); ctx.fill(); }
      ctx.globalAlpha=1;
      ctx.globalAlpha=0.25;
      const g=ctx.createRadialGradient(r.x,r.y,2,r.x,r.y,14*r.size); g.addColorStop(0,`${r.color}99`); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(r.x,r.y,14*r.size,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      ctx.save(); ctx.translate(r.x,r.y); ctx.rotate(r.angle);
      ctx.fillStyle=r.color; ctx.strokeStyle='#fff'; ctx.globalAlpha=0.8; ctx.lineWidth=1;
      const w=9*r.size,h=3.5*r.size,tl=7*r.size;
      ctx.beginPath(); ctx.moveTo(w,0); ctx.lineTo(-w*0.55,-h); ctx.lineTo(-tl,-h*0.7); ctx.lineTo(-tl,h*0.7); ctx.lineTo(-w*0.55,h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.fillStyle='#ffcc00'; ctx.beginPath(); ctx.moveTo(-tl,-h*0.4); ctx.lineTo(-tl-3-Math.random()*4,0); ctx.lineTo(-tl,h*0.4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  return {reset,update,render,checkCollisions};
})();

// --- Decoy ---
const DecoySystem = (() => {
  let active=false,x=0,y=0,vx=0,vy=0,timer=0;
  const MAX=240;
  function activate(jx,jy){ active=true;timer=MAX;x=jx;y=jy; const a=Math.random()*Math.PI*2; const s=2.5; vx=Math.cos(a)*s; vy=Math.sin(a)*s; AudioSys.play('powerup'); }
  function update(){ if(!active)return; timer--; x+=vx;y+=vy; if(x<50||x>W()-50)vx*=-1; if(y<50||y>H()-50)vy*=-1; vx+=(Math.random()-0.5)*0.3; vy+=(Math.random()-0.5)*0.3; const sp=Math.hypot(vx,vy); if(sp>3){vx=vx/sp*3;vy=vy/sp*3;} if(Math.random()>0.5){ Particles.createTrail(x+(Math.random()-0.5)*8,y+(Math.random()-0.5)*8,'#ffaa44'); Particles.createTrail(x+(Math.random()-0.5)*10,y+(Math.random()-0.5)*10,'#ff6600'); } if(timer<=0)active=false; }
  function render(){ if(!active)return; const t=timer/MAX; const p=Math.sin(Date.now()*0.008)*5; ctx.save();ctx.translate(x,y); ctx.globalAlpha=0.25; const og=ctx.createRadialGradient(0,0,5,0,0,30+p); og.addColorStop(0,'rgba(255,160,0,0.6)'); og.addColorStop(1,'transparent'); ctx.fillStyle=og; ctx.beginPath(); ctx.arc(0,0,30+p,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.9; const cg=ctx.createRadialGradient(0,0,2,0,0,8); cg.addColorStop(0,'#fff'); cg.addColorStop(0.5,'#ff8844'); cg.addColorStop(1,'transparent'); ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.6; ctx.strokeStyle='#ff6600'; ctx.lineWidth=2; ctx.setLineDash([4,6]); ctx.lineDashOffset=-Date.now()*0.04; ctx.beginPath(); ctx.arc(0,0,15+p*0.5,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha=1; }
  return {activate,update,render,isActive:()=>active,getPosition:()=>active?{x,y}:null,getProgress:()=>active?timer/MAX:0};
})();

// --- Powerups ---
const Powerups = (() => {
  let list=[],timer=0,jammerActive=false,jammerTimer=0,jammerTarget={x:0,y:0};
  function reset(){ list=[]; timer=diff.pwrInt[0]+Math.random()*(diff.pwrInt[1]-diff.pwrInt[0]); jammerActive=false;jammerTimer=0; }
  function update(){
    timer--;
    if(timer<=0&&list.length<2){ spawn(); timer=diff.pwrInt[0]+Math.random()*(diff.pwrInt[1]-diff.pwrInt[0]); }
    for(let i=list.length-1;i>=0;i--){ list[i].life--; list[i].wobble=Math.sin(Date.now()*0.003+i)*8; if(list[i].life<=0) list.splice(i,1); }
    if(jammerActive){ jammerTimer--; if(jammerTimer%25===0) jammerTarget={x:Math.random()*W(),y:Math.random()*H()}; if(jammerTimer<=0)jammerActive=false; }
    DecoySystem.update();
  }
  function spawn(){ const types=['shield','jammer','decoy']; list.push({ x:rand(60,W()-60),y:rand(60,H()-60), type:types[Math.floor(Math.random()*3)], life:500, wobble:0, scale:0 }); }
  function collect(x,y){ for(let i=list.length-1;i>=0;i--){ const b=list[i]; if(dist(x,y,b.x,b.y)<28){ AudioSys.play('powerup'); Particles.createExplosion(b.x,b.y,20,b.type==='shield'?'#44aaff':b.type==='jammer'?'#cc66ff':'#ffaa44',3); ScreenShake.trigger(3); if(b.type==='shield')Jet.activateShield(); else if(b.type==='jammer'){jammerActive=true;jammerTimer=300;jammerTarget={x:Math.random()*W(),y:Math.random()*H()};} else if(b.type==='decoy')DecoySystem.activate(b.x,b.y); list.splice(i,1); return true; } } return false; }
  function render(){ for(const b of list){ b.scale=Math.min(1,b.scale+0.03); const s=b.scale, yOff=b.wobble, pulse=Math.sin(Date.now()*0.004)*2, fade=b.life<50?b.life/50:1; ctx.save(); ctx.translate(b.x,b.y+yOff); ctx.globalAlpha=fade*s; const col=b.type==='shield'?'#44aaff':b.type==='jammer'?'#cc66ff':'#ff8844'; const gl=ctx.createRadialGradient(0,0,5,0,0,28+pulse); gl.addColorStop(0,`${col}44`); gl.addColorStop(0.5,`${col}22`); gl.addColorStop(1,'transparent'); ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(0,0,28+pulse,0,Math.PI*2); ctx.fill(); ctx.fillStyle=`${col}88`; ctx.strokeStyle=col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.type==='shield'?'🛡️':b.type==='jammer'?'📡':'🎯',0,1); ctx.globalAlpha=fade*s*0.4; ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([3,5]); ctx.lineDashOffset=Date.now()*0.02; ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha=1; } }
  return {reset,update,render,collect,isJammerActive:()=>jammerActive,getJammerTarget:()=>jammerTarget,isDecoyActive:()=>DecoySystem.isActive(),getDecoyPosition:()=>DecoySystem.getPosition()};
})();

// --- Game State & UI ---
let state='menu', score=0, scoreTimer=0, gameOver=false, lastWarning=0;
const uiScore=document.getElementById('score-display');
const uiFuel=document.getElementById('fuel-bar');
const uiCooldown=document.getElementById('cooldown-indicator');
const screenStart=document.getElementById('start-screen');
const screenEnd=document.getElementById('game-over-screen');
const uiFinalScore=document.getElementById('final-score');
const pills = { shield:document.getElementById('pill-shield'), jammer:document.getElementById('pill-jammer'), decoy:document.getElementById('pill-decoy') };

function startGame(dName){
  AudioSys.init(); diff=DIFF[dName]; state='playing'; score=0; scoreTimer=0; gameOver=false; lastWarning=0;
  Jet.reset(); Rockets.reset(); Particles.clear(); Background.init(); Powerups.reset();
  screenStart.classList.add('hide'); screenEnd.classList.add('hide');
  pills.shield.classList.remove('active'); pills.jammer.classList.remove('active'); pills.decoy.classList.remove('active');
}

function endGame(){
  if(gameOver)return; gameOver=true; state='gameover'; uiFinalScore.textContent=`SCORE: ${Math.floor(score)} [${diff.label}]`;
  AudioSys.play('gameover');
  const b=Jet.getBounds(); Particles.createExplosion(b.x,b.y,50,'#ff4400',5); Particles.createExplosion(b.x,b.y,25,'#ffff00',3); ScreenShake.trigger(12);
  setTimeout(()=>screenEnd.classList.remove('hide'),700);
}

document.querySelectorAll('.diff-btn').forEach(btn=>btn.addEventListener('touchstart',e=>{e.preventDefault();startGame(btn.dataset.diff);},{passive:false}));
document.getElementById('restart-btn').addEventListener('touchstart',e=>{e.preventDefault();screenEnd.classList.add('hide');screenStart.classList.remove('hide');},{passive:false});

// --- Main Loop ---
function loop(){
  ScreenShake.update(); const sh=ScreenShake.getOffset();
  if(state==='playing'){
    const input=Input.getInput();
    const jStat=Jet.update(input);
    const jb=Jet.getBounds();
    Camera.update(jStat.isTurbo);
    Rockets.update(jb.x,jb.y,Powerups.getDecoyPosition());
    Rockets.checkCollisions(jb);
    Powerups.collect(jb.x,jb.y);
    Powerups.update();
    if(Rockets.checkCollisions(jb)) endGame();

    // Warning logic
    let minDist=999;
    for(const r of Rockets.list||[]) if(r.alive){ const d=dist(jb.x,jb.y,r.x,r.y); if(d<minDist)minDist=d; }
    if(minDist<110 && !Jet.isShieldActive()){ const now=performance.now()/1000; if(now-lastWarning>0.4){ AudioSys.play('warning'); lastWarning=now; } }

    scoreTimer++; score+=0.08+(scoreTimer*0.0001);
    uiScore.textContent=`SCORE: ${Math.floor(score)}`;
    uiFuel.style.width=`${jStat.fuel*100}%`;
    uiFuel.style.background=jStat.fuel<0.2?'linear-gradient(90deg,#ff0000,#ff4400)':'linear-gradient(90deg,#ff6600,#ffcc00,#00ff88)';
    if(jStat.cooldown>0){uiCooldown.classList.add('active');uiCooldown.textContent=`⚡ ${Math.ceil(jStat.cooldown*100)}%`;} else {uiCooldown.classList.remove('active');}

    pills.shield.classList.toggle('active',Jet.isShieldActive());
    if(Jet.isShieldActive()) pills.shield.textContent=`🛡️ ${Math.ceil(Jet.getShieldProgress()*2)}s`; else pills.shield.textContent='🛡️ SHIELD';
    pills.jammer.classList.toggle('active',Powerups.isJammerActive());
    if(Powerups.isJammerActive()) pills.jammer.textContent=`📡 ${Math.ceil(Powerups.isJammerActive()?Powerups.getJammerTarget().x?Math.random()*3+1:3:0)}s`; else pills.jammer.textContent='📡 JAMMER';
    pills.decoy.classList.toggle('active',Powerups.isDecoyActive());
    if(Powerups.isDecoyActive()) pills.decoy.textContent=`🎯 ${Math.ceil(DecoySystem.getProgress()*4)}s`; else pills.decoy.textContent='🎯 DECOY';

    Particles.update(); Background.update();
  } else if(state==='gameover'){ Particles.update(); Powerups.update(); Background.update(); } else { Background.update(); }

  // Render
  ctx.save();
  ctx.translate(sh.x, sh.y);
  Camera.apply(ctx);
  Background.render();
  if(state!=='menu'){
    Powerups.render(); Particles.render(); Rockets.render(); DecoySystem.render();
    if(state==='playing') Jet.render();
    const j=Input.j;
    if(j.active){ ctx.globalAlpha=0.15; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(j.sx,j.sy,40,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.35; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(j.sx,j.sy,40,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=0.55; ctx.fillStyle='#00ccff'; ctx.beginPath(); ctx.arc(j.sx+j.dx*40,j.sy+j.dy*40,16,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
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