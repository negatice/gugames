/* ============================================================
   TANK BATTLE: DESERT STORM — Full Game Code
   ============================================================ */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Audio ---
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function snd(type) {
    if (!audioCtx) return;
    try {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        g.gain.value = 0.08;
        const t = audioCtx.currentTime;
        switch(type) {
            case 'shoot':
                o.type = 'square'; o.frequency.value = 450 + Math.random()*80;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
                o.start(t); o.stop(t + 0.07);
                break;
            case 'hit':
                o.type = 'sawtooth'; o.frequency.value = 110;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
                o.start(t); o.stop(t + 0.18);
                break;
            case 'boom':
                o.type = 'sawtooth'; o.frequency.value = 55; g.gain.value = 0.12;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                o.start(t); o.stop(t + 0.35);
                break;
            case 'pop':
                o.type = 'sine'; o.frequency.value = 650;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                o.start(t); o.stop(t + 0.1);
                break;
            case 'slow':
                o.type = 'sawtooth'; o.frequency.value = 180;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                o.start(t); o.stop(t + 0.25);
                break;
            case 'heal':
                o.type = 'sine'; o.frequency.value = 800;
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                o.start(t); o.stop(t + 0.15);
                break;
        }
    } catch(e){}
}

// --- Game State ---
let gameRunning = false, animId, lastTime = 0, gameTime = 0;
let W, H;

const G = {
    p1: null, p2: null,
    bullets: [], particles: [], powerups: [], missiles: [],
    shake: { x:0, y:0, i:0 },
    flash: { a:0, c:'#fff' },
    scores: { p1:0, p2:0 },
    midY: 0,
    spawnTimer: 0,
    spawnCount: 0,
    // Noise texture
    noiseCanvas: null
};

// --- Input ---
const I = { p1X:0, p1T:false, p2X:0, p2T:false };

function resize() {
    canvas.width = W = window.innerWidth;
    canvas.height = H = window.innerHeight;
    G.midY = H / 2;
    if (G.p1) { G.p1.y = H - 55; G.p1.x = Math.min(G.p1.x, W - 25); }
    if (G.p2) { G.p2.y = 55; G.p2.x = Math.min(G.p2.x, W - 25); }
    // Generate noise texture
    generateNoise();
}
window.addEventListener('resize', resize);

// --- Noise Texture ---
function generateNoise() {
    const nc = document.createElement('canvas');
    nc.width = 128; nc.height = 128;
    const nctx = nc.getContext('2d');
    const imgData = nctx.createImageData(128, 128);
    for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.random() * 255;
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
        imgData.data[i+3] = 12;
    }
    nctx.putImageData(imgData, 0, 0);
    G.noiseCanvas = nc;
}

// --- Tank Factory ---
function mkTank(side) {
    const s = Math.min(W, H);
    const w = Math.min(50, s * 0.12), h = 38;
    return {
        x: W/2, y: side==='p1' ? H-55 : 55,
        w, h, side,
        hp: 100, maxHp: 100,
        speed: 4.5, baseSpeed: 4.5,
        fireRate: 420, baseFireRate: 420,
        lastFire: 0, recoil: 0, inv: 0,
        shield: false, doubleShot: false, doubleShotT: 0,
        rapidFire: false, rapidFireT: 0,
        slowed: false, slowTimer: 0,
        color: side==='p1' ? '#ff7b54' : '#4ecdc4',
        color2: side==='p1' ? '#c45a38' : '#339990',
        color3: side==='p1' ? '#8a3d28' : '#226660',
        accent: side==='p1' ? '#ffb07a' : '#66ffdd',
        tracks: []
    };
}

// --- Touch / Mouse Input ---
function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const list = e.touches || [{clientX:e.clientX, clientY:e.clientY}];
    return Array.from(list).map(t => ({x: t.clientX - r.left, y: t.clientY - r.top}));
}

function handleTouch(e) {
    e.preventDefault();
    const pts = getPos(e);
    let a1=false, a2=false;
    for (let p of pts) {
        if (p.y > G.midY) { I.p1X = p.x; a1 = true; }
        else { I.p2X = p.x; a2 = true; }
    }
    I.p1T = a1; I.p2T = a2;
    if (e.type === 'touchstart') {
        initAudio();
        for (let p of pts) shoot(p.y > G.midY ? G.p1 : G.p2);
    }
}
function handleTouchEnd(e) {
    e.preventDefault();
    const pts = getPos(e);
    I.p1T = pts.some(p => p.y > G.midY);
    I.p2T = pts.some(p => p.y < G.midY);
}

canvas.addEventListener('touchstart', handleTouch, {passive:false});
canvas.addEventListener('touchmove', handleTouch, {passive:false});
canvas.addEventListener('touchend', handleTouchEnd, {passive:false});
canvas.addEventListener('mousedown', e => {
    initAudio();
    const r = canvas.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    if (y > G.midY) { I.p1X=x; I.p1T=true; shoot(G.p1); }
    else { I.p2X=x; I.p2T=true; shoot(G.p2); }
});
canvas.addEventListener('mousemove', e => {
    if (!e.buttons) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    if (y > G.midY) I.p1X=x; else I.p2X=x;
});
canvas.addEventListener('mouseup', () => { I.p1T=false; I.p2T=false; });

// --- Shooting ---
function shoot(tank) {
    if (!gameRunning) return;
    const now = performance.now();
    let cd = tank.baseFireRate;
    if (tank.slowed) cd *= 1.6;
    if (tank.rapidFire) cd *= 0.45;
    if (now - tank.lastFire < cd) return;
    tank.lastFire = now;
    tank.recoil = 4;

    const dir = tank.side==='p1' ? -1 : 1;
    const bx = tank.x;
    const by = tank.y + (dir * -tank.h/2);
    const spd = 5.5;

    const count = tank.doubleShot ? 2 : 1;
    const spread = tank.doubleShot ? 0.35 : 0;

    for (let i = 0; i < count; i++) {
        const angle = count > 1 ? (i - (count-1)/2) * spread : 0;
        G.bullets.push({
            x: bx, y: by,
            vx: Math.sin(angle) * spd * 0.5,
            vy: dir * spd,
            r: 3.5, c: tank.color, owner: tank, life: 1
        });
    }
    snd('shoot');
    spawnParticles(bx, by, tank.accent, 4, 'flash');
}

// --- Particles ---
function spawnParticles(x, y, c, n, type='spark') {
    for (let i = 0; i < n; i++) {
        const a = Math.random()*Math.PI*2;
        const s = type==='smoke' ? 0.5+Math.random()*1.5 : 1+Math.random()*2.5;
        G.particles.push({
            x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
            life: 1, decay: type==='smoke'? 0.01 : 0.025+Math.random()*0.02,
            c, size: type==='smoke' ? 4+Math.random()*5 : 1.5+Math.random()*2, type
        });
    }
}

// --- Power-Up System ---
// Staged spawn: early game simpler, late game more variety
function getPowerUpPool() {
    const gameTimeSec = gameTime / 1000;

    if (gameTimeSec < 15) {
        // Early: mostly shield, speed, heal; very rare nuke; no slow/debuffs
        return [
            {type:'shield', weight:30},
            {type:'speed', weight:25},
            {type:'heal', weight:25},
            {type:'doubleShot', weight:15},
            {type:'rapidFire', weight:5},
            {type:'slow', weight:0},
            {type:'nuke', weight:0}
        ];
    } else if (gameTimeSec < 30) {
        // Mid: add rapid fire, slow appears, nuke still rare
        return [
            {type:'shield', weight:22},
            {type:'speed', weight:18},
            {type:'heal', weight:20},
            {type:'doubleShot', weight:15},
            {type:'rapidFire', weight:12},
            {type:'slow', weight:10},
            {type:'nuke', weight:3}
        ];
    } else {
        // Late: full variety including slow and rare nuke
        return [
            {type:'shield', weight:18},
            {type:'speed', weight:14},
            {type:'heal', weight:16},
            {type:'doubleShot', weight:14},
            {type:'rapidFire', weight:14},
            {type:'slow', weight:18},
            {type:'nuke', weight:6}
        ];
    }
}

function weightedRandom(pool) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (const p of pool) {
        r -= p.weight;
        if (r <= 0) return p.type;
    }
    return pool[0].type;
}

function createPowerUp() {
    const pool = getPowerUpPool();
    const type = weightedRandom(pool);

    const side = Math.random() > 0.5 ? 'p1' : 'p2';
    const y = side==='p1' ? G.midY + 50 : G.midY - 50;
    const dir = side==='p1' ? 1 : -1;

    G.powerups.push({
        x: 30 + Math.random() * (W - 60),
        y: y,
        vx: (Math.random()-0.5) * 0.5,
        vy: dir * 0.4,
        type, r: 15,
        bob: Math.random()*Math.PI*2,
        life: 1, collected: false
    });
    G.spawnCount++;
}

function applyPowerUp(pu, tank) {
    pu.collected = true;
    const enemy = tank===G.p1 ? G.p2 : G.p1;
    snd('pop');
    spawnParticles(pu.x, pu.y, '#ffd700', 8, 'spark');

    switch(pu.type) {
        case 'nuke':
            G.missiles.push({
                x: tank.x, y: tank.y,
                target: enemy, speed: 6,
                owner: tank,
                damage: Math.floor(enemy.maxHp / 3),
                trail: []
            });
            break;
        case 'shield':
            tank.shield = true;
            break;
        case 'speed':
            tank.speed = tank.baseSpeed * 1.6;
            tank.slowed = false; tank.slowTimer = 0;
            setTimeout(() => { if (tank.speed > tank.baseSpeed) tank.speed = tank.baseSpeed; }, 4500);
            break;
        case 'doubleShot':
            tank.doubleShot = true;
            setTimeout(() => { tank.doubleShot = false; }, 5000);
            break;
        case 'rapidFire':
            tank.rapidFire = true;
            setTimeout(() => { tank.rapidFire = false; }, 5000);
            break;
        case 'heal':
            tank.hp = Math.min(tank.maxHp, tank.hp + 25);
            snd('heal');
            spawnParticles(tank.x, tank.y, '#4caf50', 10, 'spark');
            break;
        case 'slow':
            tank.slowed = true;
            tank.speed = tank.baseSpeed * 0.45;
            tank.slowTimer = 4000;
            snd('slow');
            spawnParticles(tank.x, tank.y, '#ff5555', 6, 'smoke');
            break;
    }
    setTimeout(() => pu.life = 0, 80);
}

// --- UPDATE ---
function update(dt) {
    if (!gameRunning) return;
    gameTime += dt;

    const lerp = (a,b,t) => a + (b-a)*t;
    const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

    // --- Movement ---
    const lerpFactor = 0.1;
    if (I.p1T) G.p1.x = lerp(G.p1.x, clamp(I.p1X, 22, W-22), lerpFactor);
    if (I.p2T) G.p2.x = lerp(G.p2.x, clamp(I.p2X, 22, W-22), lerpFactor);

    // --- Recoil & Invincibility ---
    G.p1.recoil *= 0.82; G.p2.recoil *= 0.82;
    G.p1.inv = Math.max(0, G.p1.inv - dt);
    G.p2.inv = Math.max(0, G.p2.inv - dt);

    // --- Slow Timer ---
    if (G.p1.slowed) {
        G.p1.slowTimer -= dt;
        if (G.p1.slowTimer <= 0) { G.p1.slowed = false; G.p1.speed = G.p1.baseSpeed; }
    }
    if (G.p2.slowed) {
        G.p2.slowTimer -= dt;
        if (G.p2.slowTimer <= 0) { G.p2.slowed = false; G.p2.speed = G.p2.baseSpeed; }
    }

    // --- Double Shot / Rapid Fire Timers ---
    // Handled via setTimeout above

    // --- Tracks ---
    G.p1.tracks.push({x: G.p1.x, y: G.p1.y, life: 1});
    G.p2.tracks.push({x: G.p2.x, y: G.p2.y, life: 1});
    G.p1.tracks = G.p1.tracks.filter(t => (t.life -= 0.02) > 0);
    G.p2.tracks = G.p2.tracks.filter(t => (t.life -= 0.02) > 0);

    // --- Bullets ---
    for (let i = G.bullets.length-1; i >= 0; i--) {
        const b = G.bullets[i];
        b.x += b.vx; b.y += b.vy; b.life -= 0.006;

        // Trail particle
        G.particles.push({
            x: b.x + (Math.random()-0.5)*2, y: b.y + (Math.random()-0.5)*2,
            vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.2,
            life: 0.5, decay: 0.08, c: b.c, size: b.r*0.4, type:'trail'
        });

        const target = b.owner===G.p1 ? G.p2 : G.p1;
        if (target.inv <= 0) {
            const dx = b.x - target.x, dy = b.y - target.y;
            if (Math.abs(dx) < target.w/2 + b.r && Math.abs(dy) < target.h/2 + b.r) {
                if (target.shield) {
                    target.shield = false;
                    spawnParticles(b.x, b.y, '#88aaff', 8, 'flash');
                } else {
                    target.hp -= 8;
                    target.inv = 300;
                    spawnParticles(b.x, b.y, '#ff4444', 8, 'spark');
                    snd('hit');
                    G.shake.i = 3;
                }
                G.bullets.splice(i, 1);
                continue;
            }
        }
        if (b.y < -20 || b.y > H+20 || b.life <= 0) G.bullets.splice(i, 1);
    }

    // --- Power-Up Spawning ---
    G.spawnTimer += dt;
    const spawnInterval = gameTime > 30000 ? 4500 : gameTime > 15000 ? 5500 : 7000;
    if (G.spawnTimer > spawnInterval) {
        G.spawnTimer = 0;
        if (G.powerups.length < 4) createPowerUp();
    }

    for (let i = G.powerups.length-1; i >= 0; i--) {
        const p = G.powerups[i];
        p.x += p.vx; p.y += p.vy; p.bob += 0.035;
        if (p.x < 22 || p.x > W-22) p.vx *= -1;

        [G.p1, G.p2].forEach(tank => {
            if (!p.collected && Math.hypot(p.x - tank.x, p.y - tank.y) < p.r + tank.w/2) {
                applyPowerUp(p, tank);
            }
        });
        if (p.life <= 0 || p.y < -30 || p.y > H+30) G.powerups.splice(i, 1);
    }

    // --- Missiles (Nuke) ---
    for (let i = G.missiles.length-1; i >= 0; i--) {
        const m = G.missiles[i];
        const dx = m.target.x - m.x, dy = m.target.y - m.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 12) {
            // Hit
            m.target.hp -= m.damage;
            m.target.inv = 800;
            snd('boom');
            G.flash.a = 0.85; G.flash.c = '#fff';
            setTimeout(() => { G.flash.a = 0.4; G.flash.c = '#ffaa00'; }, 60);
            setTimeout(() => { G.flash.a = 0; }, 280);
            G.shake.i = 10;
            spawnParticles(m.x, m.y, '#ffaa00', 22, 'spark');
            spawnParticles(m.x, m.y, '#777', 12, 'smoke');
            G.missiles.splice(i, 1);
            continue;
        }
        const angle = Math.atan2(dy, dx);
        m.x += Math.cos(angle) * m.speed;
        m.y += Math.sin(angle) * m.speed;
        m.trail.push({x: m.x, y: m.y, life: 1});
        m.trail = m.trail.filter(t => (t.life -= 0.07) > 0);
    }

    // --- Particles ---
    for (let i = G.particles.length-1; i >= 0; i--) {
        const p = G.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= p.decay;
        p.vx *= 0.94; p.vy *= 0.94;
        if (p.type==='smoke') p.size *= 1.012;
        if (p.life <= 0) G.particles.splice(i, 1);
    }

    // --- Screen Shake ---
    if (G.shake.i > 0) {
        G.shake.x = (Math.random()-0.5)*G.shake.i;
        G.shake.y = (Math.random()-0.5)*G.shake.i;
        G.shake.i *= 0.86;
        if (G.shake.i < 0.4) { G.shake.i=0; G.shake.x=0; G.shake.y=0; }
    }

    // --- Flash decay ---
    if (G.flash.a > 0) G.flash.a *= 0.92;

    // --- Win Check ---
    if (G.p1.hp <= 0 || G.p2.hp <= 0) {
        const winner = G.p1.hp > 0 ? 'p1' : 'p2';
        G.scores[winner]++;
        setTimeout(() => endGame(winner), 300);
        gameRunning = false;
    }
}

// --- DRAW ---
function draw() {
    ctx.save();
    ctx.translate(G.shake.x, G.shake.y);

    // 1. Desert Background
    drawDesertBg();

    // 2. Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,220,160,0.04)'; ctx.lineWidth = 1;
    for (let x=0; x<W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // 3. Mid line
    ctx.strokeStyle = 'rgba(255,220,160,0.15)'; ctx.lineWidth = 2;
    ctx.setLineDash([8,8]);
    ctx.beginPath(); ctx.moveTo(0, G.midY); ctx.lineTo(W, G.midY); ctx.stroke();
    ctx.setLineDash([]);

    // 4. Dune silhouettes
    drawDunes();

    // 5. Tracks
    [G.p1, G.p2].forEach(t => t.tracks.forEach(tr => {
        ctx.globalAlpha = tr.life * 0.15;
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(tr.x - t.w/2 - 2, tr.y - t.h/2, t.w + 4, t.h);
    }));
    ctx.globalAlpha = 1;

    // 6. HEALTH BARS (DRAWN BEFORE TANKS — fixes layering for both players)
    drawHealthBar(G.p1.x, G.p1.y + G.p1.h/2 + 10, G.p1.hp, G.p1.maxHp, G.p1.color, G.p1.side);
    drawHealthBar(G.p2.x, G.p2.y + G.p2.h/2 + 10, G.p2.hp, G.p2.maxHp, G.p2.color, G.p2.side);

    // 7. Powerups
    G.powerups.forEach(p => {
        const by = Math.sin(p.bob) * 2;
        const px = p.x, py = p.y + by;

        // Outer glow
        const glowC = p.type==='slow' ? '#ff5555' : p.type==='nuke' ? '#ff8800' : p.type==='heal' ? '#4caf50' : '#ffd700';
        ctx.shadowBlur = 10; ctx.shadowColor = glowC;
        ctx.fillStyle = glowC.replace(')', ',0.12)').replace('rgb','rgba');
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(px, py, p.r+4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

        // Bubble
        const grad = ctx.createRadialGradient(px-2, py-2, 1, px, py, p.r);
        grad.addColorStop(0, 'rgba(255,255,255,0.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI*2); ctx.fill();

        // Border
        const borderC = p.type==='slow' ? 'rgba(255,80,80,0.6)' : 'rgba(255,255,255,0.5)';
        ctx.strokeStyle = borderC; ctx.lineWidth = 1.5; ctx.stroke();

        // Icon
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const icons = {
            nuke:'☢️', shield:'🛡️', speed:'⚡',
            doubleShot:'🔫', rapidFire:'💨', heal:'❤️', slow:'🐌'
        };
        ctx.fillText(icons[p.type]||'?', px, py);
    });

    // 8. Missiles
    G.missiles.forEach(m => {
        // Trail
        m.trail.forEach(t => {
            ctx.globalAlpha = t.life * 0.4;
            ctx.fillStyle = '#ff8800';
            ctx.beginPath(); ctx.arc(t.x, t.y, 2.5*t.life, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Rocket body
        const angle = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(angle + Math.PI/2);
        // Flame
        ctx.fillStyle = '#ff5500';
        ctx.beginPath(); ctx.moveTo(-3, 5); ctx.lineTo(0, 10+Math.random()*4); ctx.lineTo(3, 5); ctx.fill();
        // Body
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(-3.5, 3); ctx.lineTo(3.5, 3); ctx.closePath(); ctx.fill();
        // Tip
        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(0, -7, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    });

    // 9. Bullets
    G.bullets.forEach(b => {
        ctx.shadowBlur = 7; ctx.shadowColor = b.c;
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r*0.4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 10. Tanks (drawn AFTER healthbars — healthbars appear behind)
    drawTank(G.p1);
    drawTank(G.p2);

    // 11. Particles
    G.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        if (p.type==='smoke') {
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = p.c;
            ctx.shadowBlur = 3; ctx.shadowColor = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
    ctx.globalAlpha = 1;

    // 12. Screen Flash
    if (G.flash.a > 0.01) {
        ctx.fillStyle = G.flash.c;
        ctx.globalAlpha = G.flash.a;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// --- Desert Background ---
function drawDesertBg() {
    // Gradient sky to sand
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1008');
    g.addColorStop(0.15, '#2a1a0c');
    g.addColorStop(0.5, '#3a2510');
    g.addColorStop(1, '#1a1008');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Noise overlay
    if (G.noiseCanvas) {
        const pat = ctx.createPattern(G.noiseCanvas, 'repeat');
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W, H);
    }

    // Warm vignette
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
}

// --- Dune Silhouettes ---
function drawDunes() {
    ctx.fillStyle = 'rgba(60,35,15,0.15)';
    // Top dunes
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 10) {
        ctx.lineTo(x, 15 + Math.sin(x*0.02)*8 + Math.sin(x*0.05)*4);
    }
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();

    // Bottom dunes
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
        ctx.lineTo(x, H - 15 - Math.sin(x*0.02)*8 - Math.sin(x*0.05)*4);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    // Side accents
    ctx.fillStyle = 'rgba(80,50,20,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= H; y += 10) {
        ctx.lineTo(12 + Math.sin(y*0.03)*5, y);
    }
    ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(W, 0);
    for (let y = 0; y <= H; y += 10) {
        ctx.lineTo(W - 12 - Math.sin(y*0.03)*5, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

// --- Health Bar ---
function drawHealthBar(x, y, hp, max, color, side) {
    const w = 42, h = 4;
    // Dark background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(x - w/2 - 1, y - 1, w + 2, h + 2, 2); ctx.fill();

    // Empty bar
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x - w/2, y, w, h);

    // Fill
    const pct = Math.max(0, hp / max);
    const grad = ctx.createLinearGradient(x - w/2, y, x + w/2, y);
    if (pct > 0.5) { grad.addColorStop(0, color); grad.addColorStop(1, '#4caf50'); }
    else if (pct > 0.25) { grad.addColorStop(0, '#ff9800'); grad.addColorStop(1, '#ffc107'); }
    else { grad.addColorStop(0, '#f44336'); grad.addColorStop(1, '#ff5722'); }
    ctx.fillStyle = grad;
    ctx.fillRect(x - w/2, y, w * pct, h);
}

// --- Draw Tank ---
function drawTank(t) {
    ctx.save();
    const cx = t.x, cy = t.y;

    // Invincibility blink
    if (t.inv > 0 && Math.floor(t.inv / 28) % 2 === 0) ctx.globalAlpha = 0.45;

    // Slow visual indicator
    if (t.slowed) {
        ctx.strokeStyle = 'rgba(255,60,60,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, t.w/2 + 6, 0, Math.PI*2); ctx.stroke();
        // Red tint overlay
        ctx.fillStyle = 'rgba(255,50,50,0.12)';
        roundRect(cx - t.w/2 - 2, cy - t.h/2 - 2, t.w + 4, t.h + 4, 6); ctx.fill();
    }

    // Shield ring
    if (t.shield) {
        ctx.strokeStyle = 'rgba(100,160,255,0.55)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, t.w/2 + 7, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba(100,160,255,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, t.w/2 + 10, 0, Math.PI*2); ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + t.h/2 + 3, t.w/2 + 2, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // --- Body ---
    ctx.fillStyle = t.color2;
    roundRect(cx - t.w/2, cy - t.h/2, t.w, t.h, 4); ctx.fill();

    // --- Tracks (Left & Right sides) ---
    ctx.fillStyle = t.color3;
    ctx.fillRect(cx - t.w/2 - 4, cy - t.h/2 + 3, 4, t.h - 6);
    ctx.fillRect(cx + t.w/2, cy - t.h/2 + 3, 4, t.h - 6);

    // Track segments
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let yy = cy - t.h/2 + 4; yy < cy + t.h/2 - 4; yy += 4) {
        ctx.fillRect(cx - t.w/2 - 3, yy, 2, 2);
        ctx.fillRect(cx + t.w/2 + 1, yy, 2, 2);
    }

    // --- Body highlight ---
    ctx.fillStyle = t.color;
    roundRect(cx - t.w/2 + 2, cy - t.h/2 + 2, t.w - 4, t.h - 4, 3); ctx.fill();

    // --- Turret ---
    ctx.fillStyle = t.color2;
    ctx.beginPath(); ctx.arc(cx, cy, t.w * 0.24, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(cx, cy, t.w * 0.18, 0, Math.PI*2); ctx.fill();

    // Turret highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(cx - 2, cy - 2, t.w * 0.07, 0, Math.PI*2); ctx.fill();

    // --- Barrel ---
    const dir = t.side === 'p1' ? -1 : 1;
    const bLen = t.w * 0.5, bW = 3.5;
    ctx.fillStyle = t.color3;
    ctx.fillRect(cx - bW/2, cy + dir*(t.h*0.12 - t.recoil), bW, bLen * dir);
    ctx.fillStyle = t.accent;
    ctx.fillRect(cx - (bW+2)/2, cy + dir*(t.h*0.12 + bLen*dir - 4) - t.recoil*dir, bW+2, 4);

    // --- Label ---
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(8, t.w*0.2)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.side==='p1'?'P1':'P2', cx, cy);

    // --- Status indicators above tank ---
    if (t.doubleShot) {
        ctx.fillStyle = '#ffd700'; ctx.font = '8px Arial';
        ctx.fillText('🔫×2', cx, cy - t.h/2 - 8);
    }
    if (t.rapidFire) {
        ctx.fillStyle = '#66ffdd'; ctx.font = '8px Arial';
        ctx.fillText('💨', cx + (t.doubleShot ? -12 : 0), cy - t.h/2 - (t.doubleShot ? 8 : 8));
    }
    if (t.shield) {
        ctx.fillStyle = '#88aaff'; ctx.font = '8px Arial';
        ctx.fillText('🛡', cx + (t.doubleShot ? 12 : t.rapidFire ? 12 : 0), cy - t.h/2 - 8);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}

// --- Utility ---
function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
}

// --- Game Loop ---
function gameLoop(ts) {
    const dt = Math.min(ts - lastTime, 33); // Cap delta for stability
    lastTime = ts;
    update(dt);
    draw();
    animId = requestAnimationFrame(gameLoop);
}

// --- Start / End ---
function startGame() {
    initAudio(); resize();
    G.p1 = mkTank('p1'); G.p2 = mkTank('p2');
    G.bullets = []; G.particles = []; G.powerups = []; G.missiles = [];
    G.spawnTimer = 0; G.spawnCount = 0; gameTime = 0;
    G.scores.p1 = 0; G.scores.p2 = 0;
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    gameRunning = true; lastTime = performance.now(); gameLoop(lastTime);
}

function endGame(w) {
    const txt = w==='p1' ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!';
    const col = w==='p1' ? G.p1.color : G.p2.color;
    document.getElementById('winText').textContent = txt;
    document.getElementById('winText').style.color = col;
    document.getElementById('fScore1').textContent = G.scores.p1;
    document.getElementById('fScore2').textContent = G.scores.p2;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function resetGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
}

function showMenu() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
    gameRunning = false; cancelAnimationFrame(animId);
}

// --- Preview Tanks ---
function drawPreview(cvs, c1, c2, c3, acc, dir) {
    const c = cvs.getContext('2d'), w=cvs.width, h=cvs.height;
    const cx=w/2, cy=h/2, tw=42, th=32;
    // Body
    c.fillStyle = c2; roundRect.call(c, cx-tw/2, cy-th/2, tw, th, 3); c.fill();
    c.fillStyle = c1; roundRect.call(c, cx-tw/2+2, cy-th/2+2, tw-4, th-4, 2); c.fill();
    // Tracks
    c.fillStyle = c3;
    c.fillRect(cx-tw/2-3, cy-th/2+2, 3, th-4);
    c.fillRect(cx+tw/2, cy-th/2+2, 3, th-4);
    // Turret
    c.fillStyle = c2; c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI*2); c.fill();
    c.fillStyle = c1; c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI*2); c.fill();
    // Barrel
    c.fillStyle = acc; c.fillRect(cx-1.5, cy + (dir===1?6:-14), 3, 10);
    // Label
    c.fillStyle='#fff'; c.font='bold 8px Arial'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(dir===1?'P1':'P2', cx, cy);
}

function initPreviews() {
    drawPreview(document.getElementById('prevP1'), '#ff7b54','#c45a38','#8a3d28','#ffb07a', 1);
    drawPreview(document.getElementById('prevP2'), '#4ecdc4','#339990','#226660','#66ffdd', -1);
}

window.addEventListener('resize', () => { resize(); initPreviews(); });
resize(); initPreviews();
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
document.addEventListener('gesturestart', e => e.preventDefault());

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