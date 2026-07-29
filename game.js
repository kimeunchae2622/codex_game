"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startScreen = document.querySelector("#startScreen");
const pauseScreen = document.querySelector("#pauseScreen");
const shopScreen = document.querySelector("#shopScreen");
const shopCoinsEl = document.querySelector("#shopCoins");
const shopMessageEl = document.querySelector("#shopMessage");
const toastEl = document.querySelector("#toast");
const W = canvas.width;
const H = canvas.height;
const WORLD_W = 6200;
const FLOOR = 475;

const keys = new Set();
const taps = new Set();
let running = false;
let paused = false;
let shopOpen = false;
let last = 0;
let time = 0;
let shake = 0;
let toastTimer = 0;
let soundOn = false;
let audio;
let platformHintShown = false;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);

const saveDefault = {
  checkpoint: 90, dash: false, echoes: [], memories: [], defeated: [],
  coins: 0, shopItems: [], opened: false
};
let save = loadSave();

function loadSave() {
  try { return { ...saveDefault, ...JSON.parse(localStorage.getItem("forgottenGarden") || "{}") }; }
  catch { return { ...saveDefault }; }
}
function storeSave() { localStorage.setItem("forgottenGarden", JSON.stringify(save)); }

const player = {
  x: save.checkpoint, y: 380, w: 28, h: 43, vx: 0, vy: 0, dir: 1,
  grounded: false, coyote: 0, jumpBuffer: 0, airJumps: 0,
  hp: 5 + save.memories.length + (save.shopItems.includes("armor") ? 2 : 0),
  maxHp: 5 + save.memories.length + (save.shopItems.includes("armor") ? 2 : 0),
  inv: 0, attack: 0, attackId: 0, dash: 0, dashCool: 0,
  look: 0, respawning: 0
};

const camera = { x: 0, y: 0 };
const particles = [];
const coinDrops = [];
const merchant = { x: 1810, y: FLOOR - 47, w: 34, h: 47 };
const shopCatalog = {
  weapon: { cost: 8, name: "새벽의 칼날" },
  armor: { cost: 10, name: "이끼 갑옷" },
  doubleJump: { cost: 12, name: "나방의 날개" },
  bellKey: { cost: 6, name: "종루의 열쇠" }
};
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
  { x: 5200, y: FLOOR, w: 1000, h: 100 },
  { x: 310, y: 405, w: 170, h: 18 },
  { x: 820, y: 420, w: 180, h: 18 },
  { x: 1100, y: 360, w: 175, h: 18 },
  { x: 1360, y: 415, w: 100, h: 18 },
  { x: 1580, y: 395, w: 180, h: 18 },
  { x: 1870, y: 350, w: 145, h: 18 },
  { x: 2110, y: 420, w: 135, h: 18 },
  { x: 2430, y: 410, w: 150, h: 18 },
  { x: 2680, y: 350, w: 160, h: 18 },
  { x: 3050, y: 420, w: 190, h: 18 },
  { x: 3310, y: 360, w: 180, h: 18 },
  { x: 3570, y: 420, w: 170, h: 18 },
  { x: 3840, y: 380, w: 150, h: 18 },
  { x: 4170, y: 405, w: 185, h: 18 },
  { x: 4430, y: 350, w: 150, h: 18 },
  { x: 4710, y: 410, w: 155, h: 18 },
  { x: 4950, y: 365, w: 150, h: 18 },
  { x: 5280, y: 410, w: 150, h: 18 },
  { x: 5480, y: 355, w: 160, h: 18 },
  { x: 5820, y: 405, w: 170, h: 18 }
];

const movingPlatforms = [
  { x: 615, y: 388, w: 92, h: 16, baseX: 615, baseY: 388, axis: "y", range: 40, speed: 1.25, phase: 0, dx: 0, dy: 0, moving: true },
  { x: 2247, y: 375, w: 96, h: 16, baseX: 2247, baseY: 375, axis: "x", range: 55, speed: 1.05, phase: 1.8, dx: 0, dy: 0, moving: true },
  { x: 2910, y: 382, w: 90, h: 16, baseX: 2910, baseY: 382, axis: "y", range: 45, speed: 1.4, phase: 3.1, dx: 0, dy: 0, moving: true },
  { x: 3992, y: 365, w: 100, h: 16, baseX: 3992, baseY: 365, axis: "x", range: 70, speed: 1.15, phase: 4.4, dx: 0, dy: 0, moving: true },
  { x: 5095, y: 395, w: 105, h: 16, baseX: 5095, baseY: 395, axis: "y", range: 38, speed: 1.3, phase: 2.2, dx: 0, dy: 0, moving: true }
];

const crumblePlatforms = [
  { x: 520, y: 360, w: 82, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 1450, y: 380, w: 76, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 2290, y: 330, w: 84, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 2860, y: 417, w: 72, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 4025, y: 320, w: 88, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 5660, y: 410, w: 90, h: 15, timer: 0, gone: 0, crumble: true }
];

const spikes = [
  { x: 620, y: 455, w: 80, h: 20 }, { x: 1460, y: 455, w: 65, h: 20 },
  { x: 2245, y: 455, w: 95, h: 20 }, { x: 2910, y: 455, w: 90, h: 20 },
  { x: 3990, y: 455, w: 100, h: 20 }, { x: 5100, y: 455, w: 100, h: 20 }
];

const checkpointData = [
  { x: 115, y: 421 }, { x: 1690, y: 341 }, { x: 3150, y: 431 }, { x: 5350, y: 421 }
];

const echoes = [
  { id: "뿌리", x: 1185, y: 323 },
  { id: "비", x: 2760, y: 313 },
  { id: "별", x: 3395, y: 323 }
];

const memoryBlooms = [
  { id: "새벽", x: 429, y: 372 },
  { id: "물결", x: 918, y: 387 },
  { id: "심연", x: 2505, y: 377 }
];

const enemySeeds = [
  [520, 432, "crawler"], [880, 349, "crawler"], [1260, 432, "crawler"],
  [1640, 311, "crawler"], [2020, 420, "flyer"], [2480, 331, "crawler"],
  [2690, 210, "flyer"], [3140, 342, "crawler"], [3540, 410, "flyer"],
  [3700, 342, "crawler"], [4200, 322, "crawler"], [4740, 330, "crawler"],
  [4970, 270, "flyer"], [5380, 330, "crawler"], [5580, 250, "flyer"]
];
let enemies = [];
let boss = null;

function supportTopAt(x) {
  const supports = platforms.filter(p => x >= p.x && x <= p.x + p.w).map(p => p.y);
  return supports.length ? Math.min(...supports) : FLOOR;
}

function getMaxHp() {
  return 5 + save.memories.length + (save.shopItems.includes("armor") ? 2 : 0);
}

function resetEntities() {
  enemies = enemySeeds.map((e, i) => ({
    id: i, x: e[0], y: e[2] === "crawler" ? supportTopAt(e[0]) - 32 : e[1], baseY: e[1], w: e[2] === "flyer" ? 34 : 38,
    h: e[2] === "flyer" ? 28 : 32, type: e[2], hp: e[2] === "flyer" ? 2 : 3,
    dir: i % 2 ? -1 : 1, hit: 0, dead: false, phase: i * 1.7, lastAttack: -1
  }));
  boss = {
    x: 5700, y: 367, w: 82, h: 108, hp: 22, maxHp: 22, dir: -1,
    active: false, dead: false, hit: 0, attack: 0, jump: 0, vx: 0, vy: 0, lastAttack: -1
  };
  coinDrops.length = 0;
  crumblePlatforms.forEach(p => {
    p.timer = 0;
    p.gone = 0;
  });
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

function updateShopUI(message = "몬스터가 떨어뜨린 코인으로 장비를 준비하세요.") {
  shopCoinsEl.textContent = save.coins;
  shopMessageEl.textContent = message;
  document.querySelectorAll("[data-shop-item]").forEach(button => {
    const id = button.dataset.shopItem;
    const owned = save.shopItems.includes(id);
    button.disabled = owned;
    button.classList.toggle("owned", owned);
    button.querySelector("b").textContent = owned ? "구매 완료" : `${shopCatalog[id].cost} ◈`;
  });
}

function openShop() {
  shopOpen = true;
  keys.clear();
  taps.clear();
  updateShopUI();
  shopScreen.classList.remove("hidden");
}

function closeShop() {
  shopOpen = false;
  shopScreen.classList.add("hidden");
  last = performance.now();
}

function buyShopItem(id) {
  const item = shopCatalog[id];
  if (!item || save.shopItems.includes(id)) return;
  if (id === "bellKey") {
    const gearReady = ["weapon", "armor", "doubleJump"].every(itemId => save.shopItems.includes(itemId));
    if (!gearReady || save.echoes.length < 3 || save.memories.length < 3) {
      updateShopUI("열쇠는 모든 메아리·뿌리 기억과 세 가지 장비를 갖춘 뒤 살 수 있습니다.");
      return;
    }
  }
  if (save.coins < item.cost) {
    updateShopUI(`${item.name} 구매에 코인이 ${item.cost - save.coins}개 더 필요합니다.`);
    return;
  }
  save.coins -= item.cost;
  save.shopItems.push(id);
  player.maxHp = getMaxHp();
  player.hp = player.maxHp;
  storeSave();
  updateShopUI(`${item.name}을(를) 구매했습니다.`);
  puff(merchant.x, merchant.y, id === "bellKey" ? "#ffe19a" : "#a8f0dd", 20, 150);
  beep(id === "bellKey" ? 880 : 650, .45, "sine", .055);
}

addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "Escape"].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) taps.add(e.code);
  keys.add(e.code);
  if (e.code === "Escape" && shopOpen) closeShop();
  else if (e.code === "Escape" && running) togglePause();
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
document.querySelector("#closeShopButton").addEventListener("click", closeShop);
document.querySelectorAll("[data-shop-item]").forEach(button => {
  button.addEventListener("click", () => buyShopItem(button.dataset.shopItem));
});
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
  const solids = [
    ...platforms,
    ...movingPlatforms,
    ...crumblePlatforms.filter(p => p.gone <= 0)
  ];
  if (!save.opened) solids.push({ x: 3978, y: 150, w: 34, h: 325, gate: "echo" });
  if (!save.shopItems.includes("bellKey")) solids.push({ x: 5155, y: 130, w: 38, h: 345, gate: "boss" });
  for (const p of solids) {
    if (!overlap(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
    if (p.gate === "echo" && save.echoes.length < 3) toast(`침묵의 문 · 메아리 ${save.echoes.length}/3`);
    if (p.gate === "boss") toast("종루의 최종 관문 · 상점에서 종루의 열쇠를 준비하세요");
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
      player.airJumps = save.shopItems.includes("doubleJump") ? 1 : 0;
      if (p.moving) player.x += p.dx;
      if (p.crumble && p.timer === 0) p.timer = .001;
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
  const improved = save.shopItems.includes("weapon");
  const reach = improved ? 66 : 56;
  return { x: player.dir > 0 ? player.x + 20 : player.x - (improved ? 58 : 48), y: player.y + 5, w: reach, h: 36 };
}

function updatePlatforms(dt) {
  movingPlatforms.forEach(p => {
    const oldX = p.x;
    const oldY = p.y;
    const offset = Math.sin(time * p.speed + p.phase) * p.range;
    p.x = p.baseX + (p.axis === "x" ? offset : 0);
    p.y = p.baseY + (p.axis === "y" ? offset : 0);
    p.dx = p.x - oldX;
    p.dy = p.y - oldY;
  });

  crumblePlatforms.forEach(p => {
    if (p.gone > 0) {
      p.gone -= dt;
      if (p.gone <= 0) {
        p.gone = 0;
        p.timer = 0;
        puff(p.x + p.w / 2, p.y, "#718ca3", 6, 70);
      }
    } else if (p.timer > 0) {
      p.timer += dt;
      if (p.timer > .62) {
        p.gone = 2.2;
        p.timer = 0;
        puff(p.x + p.w / 2, p.y + 7, "#63788b", 13, 110);
        beep(135, .1, "triangle", .025);
      }
    }
  });
}

function updatePlayer(dt) {
  player.inv -= dt; player.attack -= dt; player.dash -= dt; player.dashCool -= dt;
  player.coyote -= dt; player.jumpBuffer -= dt;

  if (tap("KeyZ")) player.jumpBuffer = .13;
  if (player.jumpBuffer > 0 && player.dash <= 0 && (player.coyote > 0 || player.airJumps > 0)) {
    const airJump = player.coyote <= 0;
    if (airJump) player.airJumps--;
    player.vy = airJump ? -485 : -520;
    player.grounded = false; player.coyote = 0; player.jumpBuffer = 0;
    puff(player.x + 14, player.y + player.h, airJump ? "#d8c8ff" : "#9fb8ce", airJump ? 13 : 7, airJump ? 140 : 90);
    beep(airJump ? 440 : 280, .08, "triangle", .04);
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

  if (Math.abs(player.x + player.w / 2 - (merchant.x + merchant.w / 2)) < 58 && player.y > 385 && tap("ArrowDown")) {
    openShop();
    return;
  }

  if (!platformHintShown && player.x > 430) {
    platformHintShown = true;
    toast("빛나는 발판은 움직이고, 갈라진 발판은 곧 무너집니다", 3200);
  }

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
    toast("능력 해방 · C 그림자 대시 · 지나쳐 온 기억 봉인을 깨세요", 4200);
    puff(1918, 315, "#aa9cff", 35, 230); beep(720, .7, "sine", .06);
  }

  memoryBlooms.forEach(memory => {
    if (save.memories.includes(memory.id)) return;
    const seal = { x: memory.x - 18, y: memory.y - 22, w: 36, h: 44 };
    if (player.dash > 0 && overlap(player, seal)) {
      save.memories.push(memory.id);
      player.maxHp = getMaxHp();
      player.hp = player.maxHp;
      storeSave();
      shake = 15;
      toast(`뿌리 기억 「${memory.id}」 해방 · 최대 체력 ${player.maxHp}`, 3300);
      puff(memory.x, memory.y, "#ffcae6", 34, 240);
      beep(760 + save.memories.length * 70, .65, "sine", .065);
    } else if (!save.dash && overlap(player, seal) && tap("KeyC")) {
      toast("보랏빛 봉인입니다 · 새로운 이동 능력이 필요합니다");
    }
  });

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
      const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
      e.lastAttack = player.attackId; e.hp -= attackPower; e.hit = .18; e.x += player.dir * 24;
      shake = 4; puff(e.x + e.w / 2, e.y + e.h / 2, "#baf0ff", 8, 130);
      beep(220, .07, "square", .035);
      if (e.hp <= 0) {
        e.dead = true;
        spawnCoins(e.x + e.w / 2, e.y + e.h / 2, e.type === "flyer" ? 4 : 3);
        puff(e.x, e.y, "#7186a8", 18, 180);
      }
    }
    if (overlap(player, e)) hurt(1, e.x + e.w / 2);
  });
}

function spawnCoins(x, y, count) {
  for (let i = 0; i < count; i++) {
    coinDrops.push({
      x, y, vx: rnd(-115, 115), vy: rnd(-320, -190),
      value: 1, life: 18, phase: rnd(0, Math.PI * 2)
    });
  }
  beep(520, .12, "triangle", .035);
}

function updateCoins(dt) {
  for (let i = coinDrops.length - 1; i >= 0; i--) {
    const coin = coinDrops[i];
    coin.life -= dt;
    coin.vy += 920 * dt;
    const dx = player.x + player.w / 2 - coin.x;
    const dy = player.y + player.h / 2 - coin.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 155) {
      const pull = (1 - distance / 155) * 850;
      coin.vx += dx / Math.max(distance, 1) * pull * dt;
      coin.vy += dy / Math.max(distance, 1) * pull * dt;
    }
    coin.x += coin.vx * dt;
    coin.y += coin.vy * dt;
    coin.vx *= Math.pow(.35, dt);
    if (coin.y > FLOOR - 8) {
      coin.y = FLOOR - 8;
      coin.vy *= -.38;
    }
    if (distance < 25) {
      save.coins += coin.value;
      storeSave();
      coinDrops.splice(i, 1);
      beep(720 + (save.coins % 4) * 45, .055, "sine", .022);
    } else if (coin.life <= 0) {
      coinDrops.splice(i, 1);
    }
  }
}

function updateBoss(dt) {
  if (save.shopItems.includes("bellKey") && player.x > 5480 && !boss.dead) boss.active = true;
  if (!boss.active || boss.dead) return;
  boss.hit -= dt; boss.attack -= dt;
  boss.dir = player.x < boss.x ? -1 : 1;
  boss.vy += 1200 * dt;
  boss.x += boss.vx * dt; boss.y += boss.vy * dt;
  if (boss.y + boss.h > FLOOR) { boss.y = FLOOR - boss.h; boss.vy = 0; }
  boss.x = clamp(boss.x, 5350, 6080);

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
    const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
    boss.lastAttack = player.attackId; boss.hp -= attackPower; boss.hit = .15; boss.vx += player.dir * 90;
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
  updatePlatforms(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateCoins(dt);
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

  movingPlatforms.forEach(p => {
    ctx.save();
    ctx.shadowColor = "#78dff0";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#29475a";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#8be8ef";
    ctx.fillRect(p.x + 5, p.y, p.w - 10, 3);
    ctx.strokeStyle = "#456b79";
    ctx.beginPath();
    ctx.moveTo(p.x + 12, p.y + 8);
    ctx.lineTo(p.x + p.w - 12, p.y + 8);
    ctx.stroke();
    ctx.restore();
  });

  crumblePlatforms.forEach(p => {
    if (p.gone > 0) return;
    const jitter = p.timer > 0 ? Math.sin(time * 48) * 2 : 0;
    ctx.save();
    ctx.translate(jitter, 0);
    ctx.fillStyle = p.timer > 0 ? "#6d6571" : "#344353";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#8190a0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * .28, p.y);
    ctx.lineTo(p.x + p.w * .43, p.y + p.h);
    ctx.moveTo(p.x + p.w * .7, p.y);
    ctx.lineTo(p.x + p.w * .58, p.y + p.h);
    ctx.stroke();
    ctx.restore();
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
  ctx.fillStyle = "#2b294d"; ctx.fillRect(1890, 302, 58, 48);
  ctx.strokeStyle = save.dash ? "#8f82b7" : "#c7bfff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(1919, 307, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#b9afff"; ctx.font = "17px serif"; ctx.fillText("◇", 1911, 313);

  echoes.forEach((e, i) => {
    if (save.echoes.includes(e.id)) return;
    const float = Math.sin(time * 2 + i) * 7;
    ctx.save(); ctx.translate(e.x, e.y + float); ctx.rotate(time * .4);
    ctx.shadowColor = "#9beaff"; ctx.shadowBlur = 22; ctx.strokeStyle = "#e2faff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.lineTo(-10, 0); ctx.closePath(); ctx.stroke();
    ctx.restore(); ctx.shadowBlur = 0;
  });

  memoryBlooms.forEach((memory, i) => {
    const restored = save.memories.includes(memory.id);
    const float = Math.sin(time * 2.4 + i) * 3;
    ctx.save();
    ctx.translate(memory.x, memory.y + float);
    if (restored) {
      ctx.shadowColor = "#ffaad4";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#f4b5d2";
      ctx.lineWidth = 2;
      for (let petal = 0; petal < 5; petal++) {
        ctx.save();
        ctx.rotate(petal * Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.ellipse(0, -10, 4, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = "#fff0f7";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = "#8e78d5";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#22213a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8979c0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -15);
      ctx.lineTo(12, 15);
      ctx.moveTo(12, -15);
      ctx.lineTo(-12, 15);
      ctx.stroke();
      ctx.strokeRect(-18, -22, 36, 44);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  if (!save.opened) {
    ctx.fillStyle = "#101725"; ctx.fillRect(3978, 150, 34, 325);
    ctx.strokeStyle = "#68829d"; ctx.lineWidth = 2;
    for (let y = 170; y < 460; y += 45) { ctx.beginPath(); ctx.arc(3995, y, 10, 0, Math.PI * 2); ctx.stroke(); }
  }

  if (!save.shopItems.includes("bellKey")) {
    ctx.fillStyle = "#1b1821";
    ctx.fillRect(5155, 130, 38, 345);
    ctx.strokeStyle = "#b89757";
    ctx.lineWidth = 2;
    for (let y = 155; y < 455; y += 48) {
      ctx.beginPath();
      ctx.moveTo(5163, y);
      ctx.lineTo(5185, y + 22);
      ctx.moveTo(5185, y);
      ctx.lineTo(5163, y + 22);
      ctx.stroke();
    }
  }

  // merchant
  ctx.save();
  ctx.translate(merchant.x + merchant.w / 2, merchant.y + merchant.h / 2);
  ctx.fillStyle = "#42354b";
  ctx.beginPath();
  ctx.ellipse(0, 10, 18, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9c9b1";
  ctx.beginPath();
  ctx.ellipse(0, -10, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c6a66a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-13, -17);
  ctx.quadraticCurveTo(0, -33, 15, -16);
  ctx.stroke();
  ctx.fillStyle = "#ffe3a2";
  ctx.beginPath();
  ctx.arc(0, -9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (Math.abs(player.x + player.w / 2 - (merchant.x + merchant.w / 2)) < 70 && player.y > 375) {
    ctx.fillStyle = "rgba(7,10,18,.82)";
    ctx.fillRect(merchant.x - 52, merchant.y - 35, 138, 24);
    ctx.fillStyle = "#ffe1a3";
    ctx.font = "12px system-ui";
    ctx.fillText("↓ 상점 열기", merchant.x - 12, merchant.y - 19);
  }

  enemies.forEach(drawEnemy);
  coinDrops.forEach(coin => {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.rotate(time * 4 + coin.phase);
    ctx.shadowColor = "#ffcf65";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#f5bc4d";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff0ad";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  });
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
  ctx.fillStyle = save.shopItems.includes("armor") ? "#28505a" : "#172033";
  ctx.beginPath(); ctx.ellipse(0, 9, save.shopItems.includes("armor") ? 15 : 13, 18, 0, 0, Math.PI * 2); ctx.fill();
  if (save.shopItems.includes("armor")) {
    ctx.strokeStyle = "#83b8b7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 1); ctx.lineTo(-18, 8);
    ctx.moveTo(13, 1); ctx.lineTo(18, 8);
    ctx.stroke();
  }
  ctx.fillStyle = "#e9f3f8"; ctx.beginPath(); ctx.ellipse(0, -11, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e9f3f8"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-5, -20); ctx.quadraticCurveTo(-10, -33, -15, -27); ctx.moveTo(5, -20); ctx.quadraticCurveTo(10, -33, 15, -27); ctx.stroke();
  ctx.fillStyle = "#182234"; ctx.beginPath(); ctx.arc(-4, -11, 1.6, 0, Math.PI * 2); ctx.arc(4, -11, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#9dc2d7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-22, 16, -16, 28); ctx.stroke();
  if (player.attack > 0) {
    const t = 1 - player.attack / .22;
    const improved = save.shopItems.includes("weapon");
    ctx.strokeStyle = improved ? "#ffe2a0" : "#dff9ff";
    ctx.shadowColor = improved ? "#ffbd55" : "#8cecff";
    ctx.shadowBlur = 12; ctx.lineWidth = improved ? 6 : 5;
    ctx.beginPath(); ctx.arc(9, 1, improved ? 40 : 34, -1.4 + t * .7, .8 + t * .7); ctx.stroke(); ctx.shadowBlur = 0;
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

  ctx.fillStyle = "rgba(5,9,18,.65)";
  ctx.fillRect(W - 164, 56, 140, 27);
  ctx.fillStyle = "#cfb7d5";
  ctx.font = "11px system-ui";
  ctx.fillText(`뿌리 기억  ${save.memories.length} / 3`, W - 145, 74);

  const room = player.x < 1500 ? "이끼 낀 회랑" : player.x < 3000 ? "빗물의 뿌리" : player.x < 4050 ? "별 없는 온실" : player.x < 5200 ? "침묵의 전당" : "가장 깊은 종루";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(213,232,248,.65)"; ctx.font = "12px Georgia, serif"; ctx.fillText(room, W / 2, 31);
  const explored = save.echoes.length + save.memories.length + save.shopItems.length + (save.dash ? 1 : 0);
  ctx.font = "10px system-ui";
  ctx.fillStyle = "rgba(159,183,204,.55)";
  ctx.fillText(`정원 탐색도 ${Math.round(explored / 11 * 100)}%`, W / 2, 47);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(5,9,18,.7)";
  ctx.fillRect(27, 66, 92, 27);
  ctx.fillStyle = "#ffd477";
  ctx.font = "bold 12px system-ui";
  ctx.fillText(`◈  ${save.coins}`, 40, 84);

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
  const completeGarden = save.memories.length === memoryBlooms.length && save.shopItems.length === 4;
  const endingTitle = completeGarden ? "모든 뿌리가 깨어났습니다" : "정원이 깨어났습니다";
  const endingText = completeGarden
    ? "되찾은 기억이 정원 전체에 번져<br>잊힌 종이 완전한 음색으로 울립니다."
    : "당신이 모은 작은 소리들이<br>오래된 종을 다시 울렸습니다.";
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="title-mark">✦</div><p class="kicker">${completeGarden ? "탐색도 100% · 완전한 결말" : "메아리는 사라지지 않습니다"}</p><h2>${endingTitle}</h2><p>${endingText}</p><button type="button">처음부터 다시 걷기</button>`;
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
  if (!shopOpen) update(dt);
  else taps.clear();
  render();
  requestAnimationFrame(loop);
}

render();
