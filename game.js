"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startScreen = document.querySelector("#startScreen");
const pauseScreen = document.querySelector("#pauseScreen");
const toastEl = document.querySelector("#toast");
const W = canvas.width;
const H = canvas.height;
const WORLD_W = 5100;
const FLOOR = 475;

const keys = new Set();
const taps = new Set();
let running = false;
let paused = false;
let last = 0;
let time = 0;
let shake = 0;
let toastTimer = 0;
let soundOn = false;
let audio;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);

const saveDefault = { checkpoint: 90, dash: false, echoes: [], defeated: [], opened: false };
let save = loadSave();

function loadSave() {
  try { return { ...saveDefault, ...JSON.parse(localStorage.getItem("forgottenGarden") || "{}") }; }
  catch { return { ...saveDefault }; }
}
function storeSave() { localStorage.setItem("forgottenGarden", JSON.stringify(save)); }

const player = {
  x: save.checkpoint, y: 380, w: 28, h: 43, vx: 0, vy: 0, dir: 1,
  grounded: false, coyote: 0, jumpBuffer: 0, hp: 5, maxHp: 5,
  inv: 0, attack: 0, attackId: 0, dash: 0, dashCool: 0,
  look: 0, respawning: 0
};

const camera = { x: 0, y: 0 };
const particles = [];
const motes = Array.from({ length: 90 }, (_, i) => ({
  x: (i * 137.3) % WORLD_W, y: 50 + (i * 83.1) % 390, r: rnd(.5, 2), phase: rnd(0, 6.28), depth: rnd(.15, .75)
}));

const platforms = [
  { x: 0, y: FLOOR, w: 620, h: 100 },
  { x: 700, y: FLOOR, w: 760, h: 100 },
  { x: 1525, y: FLOOR, w: 720, h: 100 },
  { x: 2340, y: FLOOR, w: 570, h: 100 },
  { x: 3000, y: FLOOR, w: 990, h: 100 },
  { x: 4090, y: FLOOR, w: 1010, h: 100 },
  { x: 310, y: 375, w: 170, h: 18 },
  { x: 820, y: 392, w: 180, h: 18 },
  { x: 1100, y: 312, w: 175, h: 18 },
  { x: 1360, y: 385, w: 100, h: 18 },
  { x: 1580, y: 354, w: 180, h: 18 },
  { x: 1870, y: 290, w: 145, h: 18 },
  { x: 2110, y: 385, w: 135, h: 18 },
  { x: 2430, y: 374, w: 150, h: 18 },
  { x: 2680, y: 292, w: 160, h: 18 },
  { x: 3050, y: 385, w: 190, h: 18 },
  { x: 3310, y: 305, w: 180, h: 18 },
  { x: 3570, y: 385, w: 170, h: 18 },
  { x: 3840, y: 330, w: 150, h: 18 },
  { x: 4170, y: 365, w: 185, h: 18 },
  { x: 4430, y: 290, w: 150, h: 18 },
  { x: 4710, y: 370, w: 155, h: 18 }
];

const spikes = [
  { x: 620, y: 455, w: 80, h: 20 }, { x: 1460, y: 455, w: 65, h: 20 },
  { x: 2245, y: 455, w: 95, h: 20 }, { x: 2910, y: 455, w: 90, h: 20 },
  { x: 3990, y: 455, w: 100, h: 20 }
];

const checkpointData = [
  { x: 115, y: 421 }, { x: 1690, y: 300 }, { x: 3150, y: 431 }
];

const echoes = [
  { id: "뿌리", x: 1185, y: 275 },
  { id: "비", x: 2760, y: 250 },
  { id: "별", x: 3395, y: 263 }
];

const enemySeeds = [
  [520, 432, "crawler"], [880, 349, "crawler"], [1260, 432, "crawler"],
  [1640, 311, "crawler"], [2020, 420, "flyer"], [2480, 331, "crawler"],
  [2690, 210, "flyer"], [3140, 342, "crawler"], [3540, 410, "flyer"],
  [3700, 342, "crawler"], [4200, 322, "crawler"]
];
let enemies = [];
let boss = null;

function resetEntities() {
  enemies = enemySeeds.map((e, i) => ({
    id: i, x: e[0], y: e[1], baseY: e[1], w: e[2] === "flyer" ? 34 : 38,
    h: e[2] === "flyer" ? 28 : 32, type: e[2], hp: e[2] === "flyer" ? 2 : 3,
    dir: i % 2 ? -1 : 1, hit: 0, dead: save.defeated.includes(i), phase: i * 1.7, lastAttack: -1
  }));
  boss = {
    x: 4590, y: 367, w: 82, h: 108, hp: 16, maxHp: 16, dir: -1,
    active: false, dead: false, hit: 0, attack: 0, jump: 0, vx: 0, vy: 0, lastAttack: -1
  };
}
resetEntities();

function beep(freq = 300, duration = .08, type = "sine", volume = .05) {
  if (!soundOn) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
  g.gain.setValueAtTime(volume, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
}

function toast(text, duration = 2200) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function puff(x, y, color = "#b9eeff", count = 8, speed = 150) {
  for (let i = 0; i < count; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(speed * .25, speed);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.2, .6), max: .6, color, r: rnd(1, 4) });
  }
}

function down(code) { return keys.has(code); }
function tap(code) { return taps.has(code); }

addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "Escape"].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) taps.add(e.code);
  keys.add(e.code);
  if (e.code === "Escape" && running) togglePause();
});
addEventListener("keyup", e => keys.delete(e.code));

document.querySelectorAll("[data-key]").forEach(button => {
  const code = button.dataset.key;
  const press = e => { e.preventDefault(); if (!keys.has(code)) taps.add(code); keys.add(code); button.classList.add("active"); };
  const release = e => { e.preventDefault(); keys.delete(code); button.classList.remove("active"); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

document.querySelector("#startButton").addEventListener("click", () => {
  startScreen.classList.add("hidden");
  running = true;
  last = performance.now();
  toast("방향키로 움직이고 Z로 점프하세요");
  requestAnimationFrame(loop);
});
document.querySelector("#resumeButton").addEventListener("click", togglePause);
document.querySelector("#soundButton").addEventListener("click", e => {
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? "소리 끄기" : "소리 켜기";
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  beep(520, .1, "sine", .06);
});

function togglePause() {
  paused = !paused;
  pauseScreen.classList.toggle("hidden", !paused);
  if (!paused) { last = performance.now(); requestAnimationFrame(loop); }
}

function moveAndCollide(dt) {
  if (player.dash > 0) {
    player.vx = player.dir * 760;
    player.vy = 0;
  } else {
    const move = (down("ArrowRight") ? 1 : 0) - (down("ArrowLeft") ? 1 : 0);
    const target = move * 235;
    player.vx = lerp(player.vx, target, 1 - Math.pow(.0004, dt));
    if (!move) player.vx *= Math.pow(.002, dt);
    if (move) player.dir = move;
    player.vy += 1500 * dt;
  }

  player.x += player.vx * dt;
  const solids = [...platforms];
  if (!save.opened) solids.push({ x: 3978, y: 150, w: 34, h: 325, gate: true });
  for (const p of solids) {
    if (!overlap(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
    if (p.gate && save.echoes.length < 3) toast(`침묵의 문 · 메아리 ${save.echoes.length}/3`);
  }

  player.grounded = false;
  player.y += player.vy * dt;
  for (const p of solids) {
    if (!overlap(player, p)) continue;
    if (player.vy > 0) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.coyote = .1;
    } else if (player.vy < 0) {
      player.y = p.y + p.h;
      player.vy = 40;
    }
  }
  player.x = clamp(player.x, 0, WORLD_W - player.w);
}

function hurt(amount, sourceX) {
  if (player.inv > 0 || player.respawning > 0 || boss?.dead) return;
  player.hp -= amount;
  player.inv = 1.15;
  player.vx = player.x < sourceX ? -310 : 310;
  player.vy = -330;
  shake = 12;
  puff(player.x + 14, player.y + 20, "#ff8aa7", 14, 220);
  beep(110, .18, "sawtooth", .08);
  if (player.hp <= 0) respawn();
}

function respawn() {
  player.respawning = .8;
  setTimeout(() => {
    player.x = save.checkpoint;
    player.y = 350;
    player.vx = player.vy = 0;
    player.hp = player.maxHp;
    player.inv = 1.5;
    player.respawning = 0;
    resetEntities();
    toast("마지막 등불에서 눈을 떴습니다");
  }, 700);
}

function attackRect() {
  return { x: player.dir > 0 ? player.x + 20 : player.x - 48, y: player.y + 5, w: 56, h: 36 };
}

function updatePlayer(dt) {
  player.inv -= dt; player.attack -= dt; player.dash -= dt; player.dashCool -= dt;
  player.coyote -= dt; player.jumpBuffer -= dt;

  if (tap("KeyZ")) player.jumpBuffer = .13;
  if (player.jumpBuffer > 0 && player.coyote > 0 && player.dash <= 0) {
    player.vy = -520;
    player.grounded = false; player.coyote = 0; player.jumpBuffer = 0;
    puff(player.x + 14, player.y + player.h, "#9fb8ce", 7, 90);
    beep(280, .08, "triangle", .04);
  }
  if (!down("KeyZ") && player.vy < -170) player.vy += 1200 * dt;

  if (tap("KeyX") && player.attack <= 0) {
    player.attack = .22; player.attackId++;
    beep(480, .07, "sawtooth", .035);
  }
  if (tap("KeyC") && player.dashCool <= 0) {
    if (!save.dash) toast("대시의 기억이 아직 잠들어 있습니다");
    else {
      player.dash = .16; player.dashCool = .55; player.inv = Math.max(player.inv, .18);
      puff(player.x + 14, player.y + 22, "#a59bff", 12, 180);
      beep(170, .13, "square", .04);
    }
  }

  player.look = lerp(player.look, down("ArrowUp") ? -1 : down("ArrowDown") ? 1 : 0, 1 - Math.pow(.005, dt));
  moveAndCollide(dt);

  for (const s of spikes) if (overlap(player, s)) hurt(1, s.x + s.w / 2);
  if (player.y > H + 120) respawn();

  checkpointData.forEach(cp => {
    if (Math.abs(player.x - cp.x) < 38 && Math.abs(player.y + player.h - cp.y) < 65 && save.checkpoint !== cp.x) {
      save.checkpoint = cp.x; player.hp = player.maxHp; storeSave();
      toast("등불이 기억을 품었습니다 · 체력 회복");
      puff(cp.x, cp.y, "#8ee8ff", 25, 130); beep(620, .5, "sine", .04);
    }
  });

  if (!save.dash && Math.abs(player.x - 1918) < 55 && player.y < 390) {
    save.dash = true; storeSave();
    toast("능력 해방 · C를 눌러 그림자 대시", 3500);
    puff(1918, 255, "#aa9cff", 35, 230); beep(720, .7, "sine", .06);
  }

  echoes.forEach(e => {
    if (!save.echoes.includes(e.id) && Math.hypot(player.x + 14 - e.x, player.y + 20 - e.y) < 42) {
      save.echoes.push(e.id); storeSave();
      toast(`메아리 조각 「${e.id}」 · ${save.echoes.length}/3`, 2800);
      puff(e.x, e.y, "#e6fbff", 30, 210); beep(820, .5, "sine", .06);
      if (save.echoes.length === 3) setTimeout(() => toast("침묵의 문이 당신을 부릅니다"), 1200);
    }
  });

  if (!save.opened && save.echoes.length === 3 && player.x > 3860) {
    save.opened = true; storeSave(); shake = 18;
    toast("세 메아리가 모여 침묵의 문을 열었습니다", 3000);
    puff(3995, 300, "#a6eaff", 45, 250);
  }
}

function updateEnemies(dt) {
  const hitbox = player.attack > .07 ? attackRect() : null;
  enemies.forEach(e => {
    if (e.dead) return;
    e.hit -= dt;
    if (e.type === "crawler") {
      e.x += e.dir * 55 * dt;
      const home = enemySeeds[e.id][0];
      if (Math.abs(e.x - home) > 90) e.dir *= -1;
    } else {
      e.phase += dt * 2;
      e.y = e.baseY + Math.sin(e.phase) * 28;
      if (Math.abs(player.x - e.x) < 260) e.x += Math.sign(player.x - e.x) * 34 * dt;
    }
    if (hitbox && overlap(hitbox, e) && e.lastAttack !== player.attackId) {
      e.lastAttack = player.attackId; e.hp--; e.hit = .18; e.x += player.dir * 24;
      shake = 4; puff(e.x + e.w / 2, e.y + e.h / 2, "#baf0ff", 8, 130);
      beep(220, .07, "square", .035);
      if (e.hp <= 0) {
        e.dead = true;
        if (!save.defeated.includes(e.id)) save.defeated.push(e.id);
        storeSave(); puff(e.x, e.y, "#7186a8", 18, 180);
      }
    }
    if (overlap(player, e)) hurt(1, e.x + e.w / 2);
  });
}

function updateBoss(dt) {
  if (save.opened && player.x > 4300 && !boss.dead) boss.active = true;
  if (!boss.active || boss.dead) return;
  boss.hit -= dt; boss.attack -= dt;
  boss.dir = player.x < boss.x ? -1 : 1;
  boss.vy += 1200 * dt;
  boss.x += boss.vx * dt; boss.y += boss.vy * dt;
  if (boss.y + boss.h > FLOOR) { boss.y = FLOOR - boss.h; boss.vy = 0; }
  boss.x = clamp(boss.x, 4220, 4920);

  if (boss.attack <= 0) {
    if (Math.abs(player.x - boss.x) > 170) {
      boss.vx = boss.dir * 155;
      boss.attack = .75;
    } else {
      boss.vx = boss.dir * 310; boss.vy = -410; boss.attack = 1.2;
      beep(95, .25, "sawtooth", .05);
    }
  } else boss.vx *= Math.pow(.12, dt);

  const hitbox = player.attack > .07 ? attackRect() : null;
  if (hitbox && overlap(hitbox, boss) && boss.lastAttack !== player.attackId) {
    boss.lastAttack = player.attackId; boss.hp--; boss.hit = .15; boss.vx += player.dir * 90;
    shake = 7; puff(boss.x + boss.w / 2, boss.y + 40, "#d9c7ff", 10, 170);
    if (boss.hp <= 0) {
      boss.dead = true; boss.active = false; boss.vx = 0;
      shake = 25; puff(boss.x + 40, boss.y + 50, "#e7fbff", 80, 300);
      setTimeout(win, 900);
    }
  }
  if (overlap(player, boss)) hurt(1, boss.x + boss.w / 2);
}

function update(dt) {
  time += dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updateBoss(dt);
  particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; p.vx *= Math.pow(.08, dt); });
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  const targetX = clamp(player.x - W * .44, 0, WORLD_W - W);
  const targetY = player.look * 52;
  camera.x = lerp(camera.x, targetX, 1 - Math.pow(.00005, dt));
  camera.y = lerp(camera.y, targetY, 1 - Math.pow(.005, dt));
  shake *= Math.pow(.01, dt);
  taps.clear();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#11182c"); grad.addColorStop(.65, "#0b1321"); grad.addColorStop(1, "#070b12");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  for (let layer = 0; layer < 3; layer++) {
    const depth = .08 + layer * .09;
    ctx.fillStyle = [`#141d31`, `#101a2c`, `#0c1524`][layer];
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = -80; x <= W + 80; x += 80) {
      const wx = x + camera.x * depth;
      const y = 325 + layer * 55 + Math.sin(wx * .006 + layer) * 35 + Math.sin(wx * .014) * 15;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.fill();
  }

  ctx.globalAlpha = .55;
  motes.forEach(m => {
    const sx = m.x - camera.x * m.depth;
    if (sx < -5 || sx > W + 5) return;
    ctx.fillStyle = m.depth > .5 ? "#a7e9ff" : "#6e87b3";
    ctx.beginPath(); ctx.arc(sx, m.y + Math.sin(time + m.phase) * 8 - camera.y * m.depth, m.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#22324d"; ctx.lineWidth = 3;
  for (let x = -(camera.x * .35 % 260); x < W + 260; x += 260) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 15, 140, x - 30, 270, x + 15, 410); ctx.stroke();
  }
}

function drawWorld() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // distant bells and plants
  for (let x = 180; x < WORLD_W; x += 430) {
    ctx.strokeStyle = "#223553"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 115 + (x % 90)); ctx.stroke();
    ctx.fillStyle = "#182941"; ctx.beginPath(); ctx.ellipse(x, 130 + (x % 90), 25, 33, 0, 0, Math.PI * 2); ctx.fill();
  }

  platforms.forEach(p => {
    ctx.fillStyle = p.h > 50 ? "#172333" : "#213046";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#344a5e"; ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.strokeStyle = "#213448"; ctx.lineWidth = 2;
    for (let x = p.x + 18; x < p.x + p.w; x += 42) {
      ctx.beginPath(); ctx.moveTo(x, p.y + 7); ctx.lineTo(x - 8, Math.min(H, p.y + 38)); ctx.stroke();
    }
  });

  spikes.forEach(s => {
    ctx.fillStyle = "#6f7d91"; ctx.beginPath();
    const n = Math.ceil(s.w / 16);
    for (let i = 0; i < n; i++) { const x = s.x + i * s.w / n; ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + s.w / n / 2, s.y); ctx.lineTo(x + s.w / n, s.y + s.h); }
    ctx.fill();
  });

  checkpointData.forEach(cp => {
    const active = save.checkpoint === cp.x;
    ctx.strokeStyle = active ? "#a7ecff" : "#53677e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(cp.x, cp.y - 48); ctx.stroke();
    ctx.fillStyle = active ? "#d6f8ff" : "#7890a4";
    ctx.shadowColor = active ? "#7bdfff" : "transparent"; ctx.shadowBlur = active ? 25 : 0;
    ctx.beginPath(); ctx.arc(cp.x, cp.y - 55, 8 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  });

  // dash shrine
  ctx.fillStyle = "#2b294d"; ctx.fillRect(1890, 242, 58, 48);
  ctx.strokeStyle = save.dash ? "#8f82b7" : "#c7bfff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(1919, 247, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#b9afff"; ctx.font = "17px serif"; ctx.fillText("◇", 1911, 253);

  echoes.forEach((e, i) => {
    if (save.echoes.includes(e.id)) return;
    const float = Math.sin(time * 2 + i) * 7;
    ctx.save(); ctx.translate(e.x, e.y + float); ctx.rotate(time * .4);
    ctx.shadowColor = "#9beaff"; ctx.shadowBlur = 22; ctx.strokeStyle = "#e2faff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.lineTo(-10, 0); ctx.closePath(); ctx.stroke();
    ctx.restore(); ctx.shadowBlur = 0;
  });

  if (!save.opened) {
    ctx.fillStyle = "#101725"; ctx.fillRect(3978, 150, 34, 325);
    ctx.strokeStyle = "#68829d"; ctx.lineWidth = 2;
    for (let y = 170; y < 460; y += 45) { ctx.beginPath(); ctx.arc(3995, y, 10, 0, Math.PI * 2); ctx.stroke(); }
  }

  enemies.forEach(drawEnemy);
  if (boss && !boss.dead) drawBoss();
  drawPlayer();

  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemy(e) {
  if (e.dead) return;
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.hit > 0) ctx.globalAlpha = .55;
  ctx.fillStyle = e.type === "flyer" ? "#6f6b91" : "#45586a";
  ctx.beginPath(); ctx.ellipse(0, 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  if (e.type === "flyer") {
    ctx.fillStyle = "#363b59";
    ctx.beginPath(); ctx.ellipse(-18, -2, 15, 7, -.4, 0, Math.PI * 2); ctx.ellipse(18, -2, 15, 7, .4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#aeeaff"; ctx.shadowColor = "#86dfff"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(e.dir * 7, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.shadowBlur = 0;
}

function drawBoss() {
  ctx.save(); ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2); ctx.scale(boss.dir, 1);
  if (boss.hit > 0) ctx.globalAlpha = .55;
  ctx.fillStyle = "#26243b"; ctx.beginPath(); ctx.ellipse(0, 12, 39, 53, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d7e3ee"; ctx.beginPath(); ctx.ellipse(0, -35, 29, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d7e3ee"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-15, -57); ctx.quadraticCurveTo(-34, -88, -45, -64); ctx.moveTo(15, -57); ctx.quadraticCurveTo(34, -88, 45, -64); ctx.stroke();
  ctx.fillStyle = "#111624"; ctx.beginPath(); ctx.arc(-9, -35, 4, 0, Math.PI * 2); ctx.arc(9, -35, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  if (player.respawning > 0) return;
  ctx.save(); ctx.translate(player.x + player.w / 2, player.y + player.h / 2); ctx.scale(player.dir, 1);
  if (player.inv > 0 && Math.floor(player.inv * 12) % 2) ctx.globalAlpha = .35;
  if (player.dash > 0) {
    ctx.globalAlpha = .18; ctx.fillStyle = "#9b8cff";
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-i * 17, 2, 12, 19, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#172033"; ctx.beginPath(); ctx.ellipse(0, 9, 13, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e9f3f8"; ctx.beginPath(); ctx.ellipse(0, -11, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e9f3f8"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-5, -20); ctx.quadraticCurveTo(-10, -33, -15, -27); ctx.moveTo(5, -20); ctx.quadraticCurveTo(10, -33, 15, -27); ctx.stroke();
  ctx.fillStyle = "#182234"; ctx.beginPath(); ctx.arc(-4, -11, 1.6, 0, Math.PI * 2); ctx.arc(4, -11, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#9dc2d7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-22, 16, -16, 28); ctx.stroke();
  if (player.attack > 0) {
    const t = 1 - player.attack / .22;
    ctx.strokeStyle = "#dff9ff"; ctx.shadowColor = "#8cecff"; ctx.shadowBlur = 12; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(9, 1, 34, -1.4 + t * .7, .8 + t * .7); ctx.stroke(); ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawHUD() {
  ctx.save();
  for (let i = 0; i < player.maxHp; i++) {
    ctx.fillStyle = i < player.hp ? "#e7f7ff" : "#28364b";
    ctx.shadowColor = i < player.hp ? "#88dfff" : "transparent"; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.moveTo(28 + i * 25, 24); ctx.quadraticCurveTo(38 + i * 25, 12, 48 + i * 25, 24); ctx.quadraticCurveTo(38 + i * 25, 39, 28 + i * 25, 24); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(5,9,18,.65)"; ctx.fillRect(W - 164, 18, 140, 34);
  ctx.fillStyle = "#bcd2e5"; ctx.font = "12px system-ui"; ctx.fillText(`메아리  ${save.echoes.length} / 3`, W - 145, 39);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i < save.echoes.length ? "#b6f0ff" : "#536076";
    ctx.strokeRect(W - 67 + i * 14, 29, 7, 7);
  }

  const room = player.x < 1500 ? "이끼 낀 회랑" : player.x < 3000 ? "빗물의 뿌리" : player.x < 4050 ? "별 없는 온실" : "침묵의 종루";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(213,232,248,.65)"; ctx.font = "12px Georgia, serif"; ctx.fillText(room, W / 2, 31);

  if (save.dash) {
    ctx.textAlign = "left"; ctx.fillStyle = player.dashCool <= 0 ? "#a99cff" : "#39405b";
    ctx.fillRect(28, 52, 28, 3);
  }

  if (boss?.active && !boss.dead) {
    const bw = 360, x = (W - bw) / 2, y = H - 32;
    ctx.fillStyle = "#141827"; ctx.fillRect(x, y, bw, 7);
    ctx.fillStyle = "#bca6e5"; ctx.fillRect(x, y, bw * boss.hp / boss.maxHp, 7);
    ctx.fillStyle = "#d9d4ea"; ctx.font = "11px system-ui"; ctx.fillText("종지기", W / 2, y - 7);
  }
  ctx.restore();
}

function render() {
  ctx.save();
  if (shake > .2) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBackground(); drawWorld(); drawHUD();
  if (player.respawning > 0) {
    ctx.fillStyle = `rgba(2,4,9,${clamp(player.respawning, 0, .75)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function win() {
  running = false;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="title-mark">✦</div><p class="kicker">메아리는 사라지지 않습니다</p><h2>정원이 깨어났습니다</h2><p>당신이 모은 작은 소리들이<br>오래된 종을 다시 울렸습니다.</p><button type="button">처음부터 다시 걷기</button>`;
  document.querySelector(".frame").append(overlay);
  overlay.querySelector("button").addEventListener("click", () => {
    localStorage.removeItem("forgottenGarden"); location.reload();
  });
  beep(920, 1.2, "sine", .07);
}

function loop(now) {
  if (!running || paused) return;
  const dt = Math.min((now - last) / 1000, .033);
  last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}

render();
