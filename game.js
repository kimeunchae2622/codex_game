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
const WORLD_TOP = -1120;
const WORLD_BOTTOM = 1450;
const FLOOR = 475;

const keys = new Set();
const taps = new Set();
let running = false;
let paused = false;
let shopOpen = false;
let shopSelection = 0;
let last = 0;
let time = 0;
let shake = 0;
let toastTimer = 0;
let soundOn = false;
let audio;
let platformHintShown = false;
let animationFrameId = 0;
let pausedSupport = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);

const saveDefault = {
  checkpoint: 90, dash: false, echoes: [], defeated: [],
  checkpointY: 380, coins: 0, lostCoins: null, shopItems: [], opened: false,
  midBossDefeated: false, areaBosses: [], relics: []
};
let save = loadSave();

function loadSave() {
  try {
    const loaded = { ...saveDefault, ...JSON.parse(localStorage.getItem("forgottenGarden") || "{}") };
    delete loaded.memories;
    return loaded;
  }
  catch { return { ...saveDefault }; }
}
function storeSave() { localStorage.setItem("forgottenGarden", JSON.stringify(save)); }

const player = {
  x: save.checkpoint, y: save.checkpointY, w: 28, h: 43, vx: 0, vy: 0, dir: 1,
  grounded: false, coyote: 0, jumpBuffer: 0, airJumps: 0,
  hp: 4 + (save.shopItems.includes("armor") ? 1 : 0),
  maxHp: 4 + (save.shopItems.includes("armor") ? 1 : 0),
  inv: 0, attack: 0, attackId: 0, attackDir: "side", dash: 0, dashCool: 0,
  look: 0, respawning: 0
};

const camera = { x: 0, y: 0 };
const particles = [];
const coinDrops = [];
const bossProjectiles = [];
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
  { x: 5820, y: 405, w: 170, h: 18 },

  // upper garden: canopy ascent
  { x: 3500, y: 285, w: 110, h: 16 },
  { x: 3310, y: 210, w: 120, h: 16 },
  { x: 3490, y: 135, w: 112, h: 16 },
  { x: 3300, y: 60, w: 120, h: 16 },
  { x: 3480, y: -15, w: 115, h: 16 },
  { x: 3290, y: -90, w: 124, h: 16 },
  { x: 3470, y: -165, w: 120, h: 16 },
  { x: 3280, y: -240, w: 125, h: 16 },
  { x: 3460, y: -315, w: 120, h: 16 },
  { x: 3270, y: -390, w: 128, h: 16 },
  { x: 3450, y: -465, w: 125, h: 16 },
  { x: 3240, y: -545, w: 190, h: 18 },

  // lower garden: sunken roots
  { x: 2500, y: 680, w: 350, h: 20 },
  { x: 3020, y: 680, w: 380, h: 20 },
  { x: 2640, y: 755, w: 220, h: 18 },
  { x: 3180, y: 755, w: 230, h: 18 },
  { x: 2470, y: 825, w: 230, h: 18 },
  { x: 3320, y: 825, w: 230, h: 18 },
  { x: 2340, y: 890, w: 190, h: 18 },
  { x: 3480, y: 890, w: 170, h: 18 },
  { x: 2780, y: 820, w: 105, h: 18 },
  { x: 3015, y: 820, w: 105, h: 18 },
  { x: 2300, y: 960, w: 600, h: 160 },
  { x: 3000, y: 960, w: 650, h: 160 },

  // beyond the canopy: moonlit clocktower
  { x: 3430, y: -620, w: 125, h: 16 },
  { x: 3585, y: -695, w: 125, h: 16 },
  { x: 3740, y: -770, w: 160, h: 16 },
  { x: 3900, y: -835, w: 1260, h: 170 },
  { x: 4050, y: -930, w: 150, h: 18 },
  { x: 4320, y: -995, w: 135, h: 18 },
  { x: 4590, y: -940, w: 145, h: 18 },
  { x: 4870, y: -1010, w: 150, h: 18 },

  // beyond the roots: flooded archive
  { x: 3650, y: 1035, w: 135, h: 18 },
  { x: 3815, y: 1110, w: 135, h: 18 },
  { x: 3980, y: 1190, w: 1210, h: 190 },
  { x: 4140, y: 1090, w: 155, h: 18 },
  { x: 4410, y: 1030, w: 145, h: 18 },
  { x: 4680, y: 1085, w: 150, h: 18 },
  { x: 4950, y: 1015, w: 155, h: 18 }
];

const movingPlatforms = [
  { x: 615, y: 388, w: 92, h: 16, baseX: 615, baseY: 388, axis: "y", range: 40, speed: 1.25, phase: 0, dx: 0, dy: 0, moving: true },
  { x: 2247, y: 375, w: 96, h: 16, baseX: 2247, baseY: 375, axis: "x", range: 55, speed: 1.05, phase: 1.8, dx: 0, dy: 0, moving: true },
  { x: 2910, y: 382, w: 90, h: 16, baseX: 2910, baseY: 382, axis: "y", range: 45, speed: 1.4, phase: 3.1, dx: 0, dy: 0, moving: true },
  { x: 3992, y: 365, w: 100, h: 16, baseX: 3992, baseY: 365, axis: "x", range: 70, speed: 1.15, phase: 4.4, dx: 0, dy: 0, moving: true },
  { x: 5095, y: 395, w: 105, h: 16, baseX: 5095, baseY: 395, axis: "y", range: 38, speed: 1.3, phase: 2.2, dx: 0, dy: 0, moving: true },
  { x: 2913, y: 565, w: 84, h: 16, baseX: 2913, baseY: 565, axis: "y", range: 100, speed: .72, phase: 1.4, dx: 0, dy: 0, moving: true }
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
  { x: 2245, y: 455, w: 95, h: 20 },
  { x: 3990, y: 455, w: 100, h: 20 }, { x: 5100, y: 455, w: 100, h: 20 },
  { x: 2900, y: 940, w: 100, h: 20 },
  { x: 4310, y: -855, w: 85, h: 20 },
  { x: 4320, y: 1170, w: 80, h: 20 }
];

const checkpointData = [
  { x: 115, y: 421 }, { x: 1690, y: 341 }, { x: 3150, y: 431 }, { x: 5350, y: 421 },
  { x: 4010, y: -835 }, { x: 4080, y: 1190 }
];

const echoes = [
  { id: "뿌리", x: 1185, y: 323 },
  { id: "비", x: 2760, y: 313 },
  { id: "별", x: 3395, y: 323 }
];

const enemySeeds = [
  [520, 432, "crawler"], [880, 349, "crawler"], [1260, 432, "crawler"],
  [1640, 311, "crawler"], [2020, 420, "flyer"], [2480, 331, "crawler"],
  [2690, 210, "flyer"], [3140, 342, "crawler"], [3540, 410, "flyer"],
  [3700, 342, "crawler"], [4200, 322, "crawler"], [4740, 330, "crawler"],
  [4970, 270, "flyer"], [5380, 330, "crawler"], [5580, 250, "flyer"],
  [3345, 178, "crawler", true], [3515, -115, "flyer", true],
  [3315, -272, "crawler", true], [3490, -390, "flyer", true],
  [2600, 648, "crawler", true], [3080, 648, "crawler", true],
  [2820, 745, "flyer", true], [3390, 793, "crawler", true],
  [4250, -915, "clockwork", true], [4500, -895, "clockwork", true],
  [4240, 1110, "inkling", true], [4570, 1070, "inkling", true]
];
let enemies = [];
let midBoss = null;
let boss = null;
let areaBosses = [];

function supportTopAt(x, preferredY = FLOOR) {
  const supports = platforms.filter(p => x >= p.x && x <= p.x + p.w).map(p => p.y);
  return supports.length
    ? supports.reduce((best, y) => Math.abs(y - preferredY) < Math.abs(best - preferredY) ? y : best)
    : FLOOR;
}

function getMaxHp() {
  return 4 + (save.shopItems.includes("armor") ? 1 : 0);
}

function resetEntities() {
  enemies = enemySeeds.map((e, i) => {
    const flying = e[2] === "flyer" || e[2] === "clockwork" || e[2] === "inkling";
    const width = e[2] === "clockwork" ? 42 : e[2] === "inkling" ? 40 : flying ? 34 : 38;
    const height = e[2] === "clockwork" ? 36 : e[2] === "inkling" ? 38 : flying ? 28 : 32;
    const hp = e[2] === "clockwork" ? 4 : e[2] === "inkling" ? 5 : flying ? 2 : 3;
    const y = flying ? e[1] : (e[3] ? e[1] : supportTopAt(e[0], e[1] + height) - height);
    return {
      id: i, x: e[0], y, baseY: e[1], w: width, h: height, type: e[2], hp,
      dir: i % 2 ? -1 : 1, hit: 0, dead: save.defeated.includes(i), phase: i * 1.7,
      patrolRange: e[3] ? 54 : 90, lastAttack: -1, cooldown: .7 + i % 4 * .28,
      vx: 0, vy: 0, action: "idle", timer: 0
    };
  });
  midBoss = {
    x: 4380, y: FLOOR - 78, w: 62, h: 78, hp: 12, maxHp: 12, dir: -1,
    active: false, dead: save.midBossDefeated, hit: 0, cooldown: .8,
    action: "idle", timer: 0, cycle: 0, vx: 0, vy: 0, lastAttack: -1
  };
  boss = {
    x: 5700, y: 367, w: 82, h: 108, hp: 30, maxHp: 30, dir: -1,
    active: false, dead: false, hit: 0, cooldown: 1, action: "idle",
    timer: 0, cycle: 0, vx: 0, vy: 0, lastAttack: -1
  };
  areaBosses = [
    {
      id: "moonKeeper", kind: "moon", name: "월륜의 파수꾼",
      x: 4770, y: -915, baseY: -915, w: 70, h: 80, hp: 16, maxHp: 16,
      active: false, dead: save.areaBosses.includes("moonKeeper"), hit: 0,
      cooldown: .8, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    },
    {
      id: "archiveKeeper", kind: "archive", name: "먹빛 사서",
      x: 4780, y: 1100, baseY: 1100, w: 76, h: 90, hp: 18, maxHp: 18,
      active: false, dead: save.areaBosses.includes("archiveKeeper"), hit: 0,
      cooldown: .9, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    }
  ];
  coinDrops.length = 0;
  bossProjectiles.length = 0;
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
const shopButtons = [...document.querySelectorAll("[data-shop-item]")];

function updateShopUI(message = "몬스터가 떨어뜨린 코인으로 장비를 준비하세요.") {
  shopCoinsEl.textContent = save.coins;
  shopMessageEl.textContent = message;
  shopButtons.forEach((button, index) => {
    const id = button.dataset.shopItem;
    const owned = save.shopItems.includes(id);
    button.disabled = owned;
    button.classList.toggle("owned", owned);
    button.classList.toggle("selected", index === shopSelection);
    button.querySelector("b").textContent = owned ? "구매 완료" : `${shopCatalog[id].cost} ◈`;
  });
}

function openShop() {
  shopOpen = true;
  const firstAvailable = shopButtons.findIndex(button => !save.shopItems.includes(button.dataset.shopItem));
  shopSelection = firstAvailable >= 0 ? firstAvailable : 0;
  keys.clear();
  taps.clear();
  updateShopUI("방향키로 품목 선택 · Z 구매 · A 나가기");
  shopScreen.classList.remove("hidden");
}

function closeShop() {
  shopOpen = false;
  shopScreen.classList.add("hidden");
  keys.delete("KeyA");
  taps.delete("KeyA");
  last = performance.now();
}

function buyShopItem(id) {
  const item = shopCatalog[id];
  if (!item || save.shopItems.includes(id)) return;
  if (id === "bellKey") {
    const gearReady = ["weapon", "armor", "doubleJump"].every(itemId => save.shopItems.includes(itemId));
    if (!gearReady || save.echoes.length < 3 || !save.midBossDefeated) {
      updateShopUI("열쇠는 모든 메아리·장비와 중간 보스 처치가 필요합니다.");
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

function moveShopSelection(code) {
  const columns = 2;
  const rows = Math.ceil(shopButtons.length / columns);
  const row = Math.floor(shopSelection / columns);
  const column = shopSelection % columns;
  if (code === "ArrowLeft") shopSelection = row * columns + (column + columns - 1) % columns;
  if (code === "ArrowRight") shopSelection = row * columns + (column + 1) % columns;
  if (code === "ArrowUp") shopSelection = ((row + rows - 1) % rows) * columns + column;
  if (code === "ArrowDown") shopSelection = ((row + 1) % rows) * columns + column;
  shopSelection = clamp(shopSelection, 0, shopButtons.length - 1);
  updateShopUI("방향키로 품목 선택 · Z 구매 · A 나가기");
  beep(420 + shopSelection * 35, .04, "sine", .018);
}

addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "KeyA", "Escape"].includes(e.code)) e.preventDefault();
  if (shopOpen) {
    if (e.code === "KeyA") closeShop();
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) moveShopSelection(e.code);
    else if (e.code === "KeyZ") buyShopItem(shopButtons[shopSelection].dataset.shopItem);
    return;
  }
  const firstPress = !keys.has(e.code);
  if (firstPress) taps.add(e.code);
  keys.add(e.code);
  if (e.code === "Escape" && running && firstPress && !e.repeat) togglePause();
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  taps.clear();
});

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
  toast("방향키로 움직이고 Z로 점프하세요");
  startGameLoop();
});
document.querySelector("#resumeButton").addEventListener("click", togglePause);
document.querySelectorAll("[data-reset-game]").forEach(button => {
  button.addEventListener("click", () => {
    const confirmed = confirm("체크포인트, 코인, 능력, 수집품과 상점 구매를 모두 지우고 처음부터 시작할까요?");
    if (!confirmed) return;
    localStorage.removeItem("forgottenGarden");
    location.reload();
  });
});
shopButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    shopSelection = index;
    updateShopUI("선택한 품목은 키보드 Z로 구매하세요.");
  });
});
document.querySelector("#soundButton").addEventListener("click", e => {
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? "소리 끄기" : "소리 켜기";
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  beep(520, .1, "sine", .06);
});

function findSupportingPlatform(tolerance = 7) {
  const playerFeet = player.y + player.h;
  const supports = [
    ...platforms,
    ...movingPlatforms,
    ...crumblePlatforms.filter(platform => platform.gone <= 0)
  ];
  return supports.find(platform => {
    const horizontallySupported = player.x + player.w > platform.x + 2
      && player.x < platform.x + platform.w - 2;
    return horizontallySupported && Math.abs(playerFeet - platform.y) <= tolerance;
  }) || null;
}

function startGameLoop() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  last = performance.now();
  animationFrameId = requestAnimationFrame(loop);
}

function togglePause() {
  paused = !paused;
  pauseScreen.classList.toggle("hidden", !paused);
  if (paused) {
    pausedSupport = findSupportingPlatform();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  } else {
    if (pausedSupport) {
      player.y = pausedSupport.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.coyote = .1;
    }
    pausedSupport = null;
    keys.clear();
    taps.clear();
    startGameLoop();
  }
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
  if (!save.midBossDefeated) solids.push({ x: 4620, y: 130, w: 38, h: 345, gate: "midboss" });
  if (!save.shopItems.includes("bellKey")) solids.push({ x: 5155, y: 130, w: 38, h: 345, gate: "boss" });
  for (const p of solids) {
    if (!overlap(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
    if (p.gate === "echo" && save.echoes.length < 3) toast(`침묵의 문 · 메아리 ${save.echoes.length}/3`);
    if (p.gate === "midboss") toast("수문장이 길을 막고 있습니다 · 중간 보스를 처치하세요");
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

function safeCoinDropPosition(x, y) {
  const groundPlatforms = platforms.filter(p => p.h > 50);
  let best = groundPlatforms[0];
  let bestDistance = Infinity;
  let safeX = x;
  groundPlatforms.forEach(platform => {
    const candidateX = clamp(x, platform.x + 24, platform.x + platform.w - 24);
    const distance = Math.hypot(candidateX - x, platform.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = platform;
      safeX = candidateX;
    }
  });
  return { x: safeX, y: best.y - 11 };
}

function dropCoinsOnDeath() {
  const amount = save.coins;
  if (amount > 0) {
    const position = safeCoinDropPosition(player.x + player.w / 2, player.y + player.h);
    save.lostCoins = { amount, x: position.x, y: position.y };
    puff(position.x, position.y, "#ffd36b", 22, 190);
  } else {
    save.lostCoins = null;
  }
  save.coins = 0;
  storeSave();
  return amount;
}

function respawn() {
  if (player.respawning > 0) return;
  const droppedCoins = dropCoinsOnDeath();
  player.respawning = .8;
  setTimeout(() => {
    player.x = save.checkpoint;
    player.y = save.checkpointY;
    player.vx = player.vy = 0;
    player.hp = player.maxHp;
    player.inv = 1.5;
    player.respawning = 0;
    resetEntities();
    toast(droppedCoins > 0
      ? `코인 ${droppedCoins}개를 떨어뜨렸습니다 · 표시된 더미에서 회수하세요`
      : "마지막 등불에서 눈을 떴습니다", 3200);
  }, 700);
}

function attackRect() {
  const improved = save.shopItems.includes("weapon");
  const reach = improved ? 66 : 56;
  if (player.attackDir === "up") {
    return { x: player.x - 14, y: player.y - (improved ? 58 : 50), w: 56, h: improved ? 66 : 58 };
  }
  if (player.attackDir === "down") {
    return { x: player.x - 14, y: player.y + player.h - 8, w: 56, h: improved ? 66 : 58 };
  }
  return { x: player.dir > 0 ? player.x + 20 : player.x - (improved ? 58 : 48), y: player.y + 5, w: reach, h: 36 };
}

function bounceFromDownwardHit(target) {
  const playerFeet = player.y + player.h;
  const struckFromAbove = playerFeet <= target.y + target.h * .7;
  if (player.attackDir !== "down" || !struckFromAbove) return;
  player.vy = -335;
  player.grounded = false;
  player.coyote = 0;
  puff(player.x + player.w / 2, player.y + player.h, "#c9f4ff", 9, 115);
}

function updatePlatforms(dt) {
  const ridingPlatform = movingPlatforms.find(p => {
    const playerFeet = player.y + player.h;
    const horizontallySupported = player.x + player.w > p.x + 2
      && player.x < p.x + p.w - 2;
    return player.vy >= 0
      && horizontallySupported
      && Math.abs(playerFeet - p.y) <= 4;
  });

  movingPlatforms.forEach(p => {
    const oldX = p.x;
    const oldY = p.y;
    const offset = Math.sin(time * p.speed + p.phase) * p.range;
    p.x = p.baseX + (p.axis === "x" ? offset : 0);
    p.y = p.baseY + (p.axis === "y" ? offset : 0);
    p.dx = p.x - oldX;
    p.dy = p.y - oldY;
  });

  if (ridingPlatform) {
    player.x += ridingPlatform.dx;
    player.y += ridingPlatform.dy;
  }

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
    player.attackDir = down("ArrowUp") ? "up" : down("ArrowDown") ? "down" : "side";
    player.attack = .22; player.attackId++;
    beep(480, .07, "sawtooth", .035);
  }
  if (tap("KeyC") && player.dashCool <= 0) {
    if (!save.dash) toast("대시의 기억이 아직 잠들어 있습니다");
    else {
      player.dash = .16;
      player.dashCool = save.relics.includes("moonGear") ? .36 : .55;
      player.inv = Math.max(player.inv, .18);
      puff(player.x + 14, player.y + 22, "#a59bff", 12, 180);
      beep(170, .13, "square", .04);
    }
  }

  player.look = lerp(player.look, down("ArrowUp") ? -1 : down("ArrowDown") ? 1 : 0, 1 - Math.pow(.005, dt));
  moveAndCollide(dt);

  if (save.lostCoins) {
    const distance = Math.hypot(
      player.x + player.w / 2 - save.lostCoins.x,
      player.y + player.h / 2 - save.lostCoins.y
    );
    if (distance < 36) {
      const recovered = save.lostCoins.amount;
      save.coins += recovered;
      save.lostCoins = null;
      storeSave();
      toast(`떨어뜨린 코인 ${recovered}개를 되찾았습니다`, 2800);
      puff(player.x + player.w / 2, player.y + player.h / 2, "#ffe28a", 28, 210);
      beep(880, .55, "sine", .06);
    }
  }

  if (Math.abs(player.x + player.w / 2 - (merchant.x + merchant.w / 2)) < 58 && player.y > 385 && tap("ArrowDown")) {
    openShop();
    return;
  }

  if (!platformHintShown && player.x > 430) {
    platformHintShown = true;
    toast("빛나는 발판은 움직이고, 갈라진 발판은 곧 무너집니다", 3200);
  }

  for (const s of spikes) if (overlap(player, s)) hurt(1, s.x + s.w / 2);
  if (player.y > WORLD_BOTTOM + 80 || player.y < WORLD_TOP - 120) respawn();

  checkpointData.forEach(cp => {
    if (Math.abs(player.x - cp.x) < 38 && Math.abs(player.y + player.h - cp.y) < 65 && save.checkpoint !== cp.x) {
      save.checkpoint = cp.x;
      save.checkpointY = cp.y - player.h;
      player.hp = player.maxHp;
      storeSave();
      toast("등불이 기억을 품었습니다 · 체력 회복");
      puff(cp.x, cp.y, "#8ee8ff", 25, 130); beep(620, .5, "sine", .04);
    }
  });

  if (!save.dash && Math.abs(player.x - 1918) < 55 && player.y < 390) {
    save.dash = true; storeSave();
    toast("능력 해방 · C 그림자 대시", 3200);
    puff(1918, 315, "#aa9cff", 35, 230); beep(720, .7, "sine", .06);
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
    e.cooldown -= dt;
    if (e.type === "crawler") {
      e.x += e.dir * 55 * dt;
      const home = enemySeeds[e.id][0];
      if (Math.abs(e.x - home) > e.patrolRange) e.dir *= -1;
    } else if (e.type === "flyer") {
      e.phase += dt * 2;
      e.y = e.baseY + Math.sin(e.phase) * 28;
      if (Math.abs(player.x - e.x) < 260) e.x += Math.sign(player.x - e.x) * 34 * dt;
    } else if (e.type === "clockwork") {
      e.phase += dt * 3.2;
      e.y = e.baseY + Math.sin(e.phase) * 18;
      e.x += e.dir * 42 * dt;
      const home = enemySeeds[e.id][0];
      if (Math.abs(e.x - home) > e.patrolRange) e.dir *= -1;
      if (e.cooldown <= 0 && Math.hypot(player.x - e.x, player.y - e.y) < 390) {
        fireAimedVolley(e, 2, .24, 210, "#f4d47b");
        e.cooldown = 1.65;
        beep(390, .09, "square", .025);
      }
    } else if (e.type === "inkling") {
      e.phase += dt * 2.5;
      if (e.action === "lunge") {
        e.timer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= Math.pow(.22, dt);
        e.vy *= Math.pow(.22, dt);
        if (e.timer <= 0) {
          e.action = "idle";
          e.baseY = e.y;
        }
      } else {
        e.y = e.baseY + Math.sin(e.phase) * 20;
        if (e.cooldown <= 0 && Math.hypot(player.x - e.x, player.y - e.y) < 320) {
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.vx = Math.cos(angle) * 270;
          e.vy = Math.sin(angle) * 270;
          e.action = "lunge";
          e.timer = .62;
          e.cooldown = 1.8;
          puff(e.x, e.y, "#63d5ca", 10, 100);
        }
      }
      e.x = clamp(e.x, 4020, 4690);
      e.y = clamp(e.y, 1020, 1145);
    }
    if (hitbox && overlap(hitbox, e) && e.lastAttack !== player.attackId) {
      const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
      e.lastAttack = player.attackId; e.hp -= attackPower; e.hit = .18; e.x += player.dir * 24;
      bounceFromDownwardHit(e);
      shake = 4; puff(e.x + e.w / 2, e.y + e.h / 2, "#baf0ff", 8, 130);
      beep(220, .07, "square", .035);
      if (e.hp <= 0) {
        e.dead = true;
        if (!save.defeated.includes(e.id)) save.defeated.push(e.id);
        storeSave();
        const regionalEnemy = e.type === "clockwork" || e.type === "inkling";
        spawnCoins(e.x + e.w / 2, e.y + e.h / 2, regionalEnemy ? 6 : e.type === "flyer" ? 4 : 3);
        puff(e.x, e.y, e.type === "clockwork" ? "#e8c66c" : e.type === "inkling" ? "#67d9c8" : "#7186a8", 18, 180);
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
    const previousY = coin.y;
    coin.life -= dt;
    coin.vy += 920 * dt;
    const dx = player.x + player.w / 2 - coin.x;
    const dy = player.y + player.h / 2 - coin.y;
    const distance = Math.hypot(dx, dy);
    const magnetRange = save.relics.includes("tideSigil") ? 260 : 155;
    if (distance < magnetRange) {
      const pull = (1 - distance / magnetRange) * 850;
      coin.vx += dx / Math.max(distance, 1) * pull * dt;
      coin.vy += dy / Math.max(distance, 1) * pull * dt;
    }
    coin.x += coin.vx * dt;
    coin.y += coin.vy * dt;
    coin.vx *= Math.pow(.35, dt);

    if (coin.vy > 0) {
      const coinRadius = 7;
      const coinSurfaces = [
        ...platforms,
        ...movingPlatforms,
        ...crumblePlatforms.filter(platform => platform.gone <= 0)
      ];
      let landingY = Infinity;

      coinSurfaces.forEach(platform => {
        const overPlatform = coin.x >= platform.x - coinRadius
          && coin.x <= platform.x + platform.w + coinRadius;
        const crossedTop = previousY + coinRadius <= platform.y
          && coin.y + coinRadius >= platform.y;
        if (overPlatform && crossedTop) landingY = Math.min(landingY, platform.y);
      });

      if (landingY < Infinity) {
        coin.y = landingY - coinRadius;
        coin.vy *= -.38;
      }
    }

    if (distance < 25) {
      save.coins += coin.value;
      storeSave();
      coinDrops.splice(i, 1);
      beep(720 + (save.coins % 4) * 45, .055, "sine", .022);
    } else if (coin.life <= 0 || coin.y > WORLD_BOTTOM + 40) {
      coinDrops.splice(i, 1);
    }
  }
}

function fireBossProjectile(x, y, angle, speed, color = "#b89cff", radius = 8, gravity = 0) {
  bossProjectiles.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    color, r: radius, gravity, life: 5
  });
}

function fireAimedVolley(source, count, spread, speed, color) {
  const originX = source.x + source.w / 2;
  const originY = source.y + source.h * .35;
  const targetAngle = Math.atan2(
    player.y + player.h / 2 - originY,
    player.x + player.w / 2 - originX
  );
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i / (count - 1) - .5) * spread;
    fireBossProjectile(originX, originY, targetAngle + offset, speed, color, 7);
  }
}

function spawnShockwaves(x, enraged = false) {
  const speeds = enraged ? [250, 390] : [260];
  speeds.forEach(speed => {
    fireBossProjectile(x, FLOOR - 12, 0, speed, "#d4a8ff", 11);
    fireBossProjectile(x, FLOOR - 12, Math.PI, speed, "#d4a8ff", 11);
  });
  shake = enraged ? 18 : 12;
  puff(x, FLOOR - 10, "#c69cff", enraged ? 32 : 20, 230);
  beep(82, .35, "sawtooth", .065);
}

function updateBossProjectiles(dt) {
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const projectile = bossProjectiles[i];
    projectile.life -= dt;
    projectile.vy += projectile.gravity * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (Math.random() < .28) {
      particles.push({
        x: projectile.x, y: projectile.y, vx: rnd(-20, 20), vy: rnd(-20, 20),
        life: .18, max: .18, color: projectile.color, r: rnd(1, 3)
      });
    }
    const hazard = {
      x: projectile.x - projectile.r, y: projectile.y - projectile.r,
      w: projectile.r * 2, h: projectile.r * 2
    };
    if (overlap(player, hazard)) {
      hurt(1, projectile.x);
      bossProjectiles.splice(i, 1);
      continue;
    }
    if (projectile.life <= 0 || projectile.x < -100 || projectile.x > WORLD_W + 100
      || projectile.y < WORLD_TOP - 100 || projectile.y > WORLD_BOTTOM + 100) {
      bossProjectiles.splice(i, 1);
    }
  }
}

function updateMidBoss(dt) {
  if (save.opened && player.x > 4140 && !midBoss.dead) midBoss.active = true;
  if (!midBoss.active || midBoss.dead) return;
  midBoss.hit -= dt;
  midBoss.cooldown -= dt;
  midBoss.timer -= dt;
  midBoss.dir = player.x < midBoss.x ? -1 : 1;
  midBoss.vy += 1250 * dt;
  midBoss.x += midBoss.vx * dt;
  midBoss.y += midBoss.vy * dt;
  let landed = false;
  if (midBoss.y + midBoss.h >= FLOOR) {
    landed = midBoss.vy > 100;
    midBoss.y = FLOOR - midBoss.h;
    midBoss.vy = 0;
  }
  midBoss.x = clamp(midBoss.x, 4070, 4550);

  if (midBoss.action === "dash") {
    midBoss.vx = midBoss.dir * 280;
    if (midBoss.timer <= 0) { midBoss.action = "idle"; midBoss.cooldown = .65; }
  } else if (midBoss.action === "jump") {
    midBoss.vx = midBoss.dir * 95;
    if (landed && midBoss.timer < 1.1) {
      spawnShockwaves(midBoss.x + midBoss.w / 2, false);
      midBoss.action = "idle"; midBoss.cooldown = .85;
    }
  } else if (midBoss.action === "cast") {
    midBoss.vx *= Math.pow(.04, dt);
    if (midBoss.timer <= 0) { midBoss.action = "idle"; midBoss.cooldown = .75; }
  } else {
    midBoss.vx *= Math.pow(.02, dt);
    if (midBoss.cooldown <= 0) {
      midBoss.cycle++;
      if (midBoss.cycle % 3 === 1) {
        midBoss.action = "dash"; midBoss.timer = .55;
      } else if (midBoss.cycle % 3 === 2) {
        midBoss.action = "jump"; midBoss.timer = 1.5; midBoss.vy = -470;
      } else {
        midBoss.action = "cast"; midBoss.timer = .65;
        fireAimedVolley(midBoss, 3, .5, 235, "#84d8dd");
        beep(210, .22, "triangle", .045);
      }
    }
  }

  const hitbox = player.attack > .07 ? attackRect() : null;
  if (hitbox && overlap(hitbox, midBoss) && midBoss.lastAttack !== player.attackId) {
    const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
    midBoss.lastAttack = player.attackId;
    midBoss.hp -= attackPower;
    midBoss.hit = .16;
    midBoss.vx += player.dir * 75;
    bounceFromDownwardHit(midBoss);
    shake = 6;
    puff(midBoss.x + midBoss.w / 2, midBoss.y + 30, "#8ce4df", 11, 160);
    if (midBoss.hp <= 0) {
      midBoss.dead = true;
      midBoss.active = false;
      save.midBossDefeated = true;
      storeSave();
      bossProjectiles.length = 0;
      spawnCoins(midBoss.x + midBoss.w / 2, midBoss.y + midBoss.h / 2, 12);
      shake = 20;
      puff(midBoss.x + 30, midBoss.y + 35, "#b9fff1", 55, 290);
      toast("수문장을 쓰러뜨렸습니다 · 종루로 향하는 길이 열렸습니다", 3500);
    }
  }
  if (overlap(player, midBoss)) hurt(1, midBoss.x + midBoss.w / 2);
}

function spawnGroundWavesAt(x, y, color) {
  fireBossProjectile(x, y - 11, 0, 285, color, 10);
  fireBossProjectile(x, y - 11, Math.PI, 285, color, 10);
  shake = 11;
  puff(x, y - 8, color, 20, 190);
}

function defeatAreaBoss(areaBoss) {
  areaBoss.dead = true;
  areaBoss.active = false;
  if (!save.areaBosses.includes(areaBoss.id)) save.areaBosses.push(areaBoss.id);
  const relic = areaBoss.kind === "moon" ? "moonGear" : "tideSigil";
  if (!save.relics.includes(relic)) save.relics.push(relic);
  storeSave();
  spawnCoins(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2, 16);
  bossProjectiles.length = 0;
  shake = 24;
  const color = areaBoss.kind === "moon" ? "#f5d77a" : "#68dfd0";
  puff(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2, color, 65, 310);
  toast(areaBoss.kind === "moon"
    ? "월륜의 파수꾼 격파 · 월륜 톱니 획득 · 대시 재사용 시간 감소"
    : "먹빛 사서 격파 · 회수의 인장 획득 · 코인 흡수 범위 증가", 4400);
  beep(areaBoss.kind === "moon" ? 760 : 560, .8, "sine", .065);
}

function updateAreaBosses(dt) {
  const hitbox = player.attack > .07 ? attackRect() : null;
  areaBosses.forEach(areaBoss => {
    if (areaBoss.dead) return;
    const insideRegion = areaBoss.kind === "moon"
      ? player.y < -700 && player.x > 4400
      : player.y > 1000 && player.x > 4400;
    if (insideRegion) areaBoss.active = true;
    if (!areaBoss.active) return;

    areaBoss.hit -= dt;
    areaBoss.cooldown -= dt;
    areaBoss.timer -= dt;
    areaBoss.dir = player.x < areaBoss.x ? -1 : 1;

    if (areaBoss.kind === "moon") {
      if (areaBoss.action === "dash") {
        areaBoss.x += areaBoss.vx * dt;
        if (areaBoss.timer <= 0) {
          areaBoss.action = "idle";
          areaBoss.cooldown = .55;
        }
      } else {
        areaBoss.y = areaBoss.baseY + Math.sin(time * 2.2) * 26;
        areaBoss.x = clamp(areaBoss.x, 4460, 5050);
        if (areaBoss.cooldown <= 0) {
          areaBoss.cycle++;
          if (areaBoss.cycle % 2) {
            areaBoss.action = "dash";
            areaBoss.timer = .58;
            areaBoss.vx = areaBoss.dir * 430;
            beep(180, .15, "sawtooth", .04);
          } else {
            fireAimedVolley(areaBoss, 5, 1.05, 255, "#f1cf68");
            areaBoss.cooldown = .82;
            puff(areaBoss.x + areaBoss.w / 2, areaBoss.y + 22, "#f5d77a", 18, 150);
          }
        }
      }
    } else {
      areaBoss.vy += 1280 * dt;
      areaBoss.x += areaBoss.vx * dt;
      areaBoss.y += areaBoss.vy * dt;
      const landed = areaBoss.y + areaBoss.h >= 1190 && areaBoss.vy > 80;
      if (areaBoss.y + areaBoss.h >= 1190) {
        areaBoss.y = 1190 - areaBoss.h;
        areaBoss.vy = 0;
      }
      areaBoss.x = clamp(areaBoss.x, 4420, 5080);

      if (areaBoss.action === "charge") {
        areaBoss.vx = areaBoss.dir * 310;
        if (areaBoss.timer <= 0) {
          areaBoss.action = "idle";
          areaBoss.cooldown = .65;
        }
      } else if (areaBoss.action === "leap") {
        areaBoss.vx = areaBoss.dir * 105;
        if (landed && areaBoss.timer < 1.15) {
          spawnGroundWavesAt(areaBoss.x + areaBoss.w / 2, 1190, "#69d8ca");
          areaBoss.action = "idle";
          areaBoss.cooldown = .8;
        }
      } else {
        areaBoss.vx *= Math.pow(.03, dt);
        if (areaBoss.cooldown <= 0) {
          areaBoss.cycle++;
          if (areaBoss.cycle % 3 === 1) {
            areaBoss.action = "charge";
            areaBoss.timer = .62;
          } else if (areaBoss.cycle % 3 === 2) {
            areaBoss.action = "leap";
            areaBoss.timer = 1.55;
            areaBoss.vy = -520;
          } else {
            fireAimedVolley(areaBoss, 4, .75, 230, "#5ad3c5");
            areaBoss.cooldown = .9;
          }
        }
      }
    }

    if (hitbox && overlap(hitbox, areaBoss) && areaBoss.lastAttack !== player.attackId) {
      const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
      areaBoss.lastAttack = player.attackId;
      areaBoss.hp -= attackPower;
      areaBoss.hit = .17;
      areaBoss.x += player.dir * 34;
      bounceFromDownwardHit(areaBoss);
      shake = 6;
      puff(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2,
        areaBoss.kind === "moon" ? "#f4d477" : "#67dbcf", 12, 170);
      if (areaBoss.hp <= 0) defeatAreaBoss(areaBoss);
    }
    if (overlap(player, areaBoss)) hurt(1, areaBoss.x + areaBoss.w / 2);
  });
}

function updateBoss(dt) {
  if (save.shopItems.includes("bellKey") && player.x > 5480 && !boss.dead) boss.active = true;
  if (!boss.active || boss.dead) return;
  const enraged = boss.hp <= boss.maxHp / 2;
  boss.hit -= dt;
  boss.cooldown -= dt;
  boss.timer -= dt;
  boss.dir = player.x < boss.x ? -1 : 1;
  boss.vy += 1350 * dt;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  let landed = false;
  if (boss.y + boss.h >= FLOOR) {
    landed = boss.vy > 130;
    boss.y = FLOOR - boss.h;
    boss.vy = 0;
  }
  boss.x = clamp(boss.x, 5350, 6080);

  if (boss.action === "dash") {
    boss.vx = boss.dir * (enraged ? 465 : 365);
    if (Math.random() < .35) puff(boss.x + boss.w / 2, boss.y + 55, "#9b76db", 2, 55);
    if (boss.timer <= 0) { boss.action = "idle"; boss.cooldown = enraged ? .35 : .62; }
  } else if (boss.action === "slam") {
    boss.vx = boss.dir * (enraged ? 135 : 95);
    if (landed && boss.timer < 1.25) {
      spawnShockwaves(boss.x + boss.w / 2, enraged);
      boss.action = "idle"; boss.cooldown = enraged ? .4 : .72;
    }
  } else if (boss.action === "volley") {
    boss.vx *= Math.pow(.03, dt);
    if (boss.timer <= 0) { boss.action = "idle"; boss.cooldown = enraged ? .35 : .7; }
  } else {
    boss.vx *= Math.pow(.02, dt);
    if (boss.cooldown <= 0) {
      boss.cycle++;
      const skill = boss.cycle % 3;
      if (skill === 1) {
        boss.action = "dash"; boss.timer = enraged ? .7 : .56;
        beep(105, .22, "sawtooth", .055);
      } else if (skill === 2) {
        boss.action = "slam"; boss.timer = 1.7; boss.vy = enraged ? -610 : -540;
        beep(145, .2, "square", .045);
      } else {
        boss.action = "volley"; boss.timer = enraged ? .95 : .75;
        fireAimedVolley(boss, enraged ? 7 : 5, enraged ? 1.35 : .9, enraged ? 315 : 265, "#c89bff");
        puff(boss.x + boss.w / 2, boss.y + 32, "#d5a6ff", enraged ? 25 : 16, 170);
        beep(260, .34, "sine", .055);
      }
    }
  }

  const hitbox = player.attack > .07 ? attackRect() : null;
  if (hitbox && overlap(hitbox, boss) && boss.lastAttack !== player.attackId) {
    const attackPower = save.shopItems.includes("weapon") ? 2 : 1;
    boss.lastAttack = player.attackId; boss.hp -= attackPower; boss.hit = .15; boss.vx += player.dir * 90;
    bounceFromDownwardHit(boss);
    shake = 8; puff(boss.x + boss.w / 2, boss.y + 40, "#d9c7ff", 13, 180);
    if (boss.hp <= 0) {
      boss.dead = true; boss.active = false; boss.vx = 0;
      bossProjectiles.length = 0;
      shake = 28; puff(boss.x + 40, boss.y + 50, "#e7fbff", 95, 330);
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
  updateMidBoss(dt);
  updateAreaBosses(dt);
  updateBoss(dt);
  updateBossProjectiles(dt);
  particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; p.vx *= Math.pow(.08, dt); });
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  const targetX = clamp(player.x - W * .44, 0, WORLD_W - W);
  const targetY = clamp(player.y - H * .66 + player.look * 52, WORLD_TOP, WORLD_BOTTOM - H);
  camera.x = lerp(camera.x, targetX, 1 - Math.pow(.00005, dt));
  camera.y = lerp(camera.y, targetY, 1 - Math.pow(.005, dt));
  shake *= Math.pow(.01, dt);
  taps.clear();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function drawBackground() {
  const clocktower = player.y < -600;
  const archive = player.y > 1000;
  const palette = clocktower
    ? ["#11152c", "#0c1023", "#070918"]
    : archive
      ? ["#071d25", "#07171e", "#040d13"]
      : ["#11182c", "#0b1321", "#070b12"];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, palette[0]); grad.addColorStop(.65, palette[1]); grad.addColorStop(1, palette[2]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  for (let layer = 0; layer < 3; layer++) {
    const depth = .08 + layer * .09;
    ctx.fillStyle = clocktower
      ? [`#1b203c`, `#141a34`, `#0d1228`][layer]
      : archive
        ? [`#0d3036`, `#0a272e`, `#071c24`][layer]
        : [`#141d31`, `#101a2c`, `#0c1524`][layer];
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
    ctx.fillStyle = clocktower
      ? (m.depth > .5 ? "#ffe59a" : "#998cc7")
      : archive
        ? (m.depth > .5 ? "#79ead9" : "#498f9b")
        : (m.depth > .5 ? "#a7e9ff" : "#6e87b3");
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

  // vertical garden landmarks
  ctx.save();
  ctx.strokeStyle = "rgba(104,151,126,.28)";
  ctx.lineWidth = 7;
  for (let x = 3160; x <= 3650; x += 95) {
    ctx.beginPath();
    ctx.moveTo(x, 430);
    ctx.bezierCurveTo(x - 45, 180, x + 50, -170, x - 20, -650);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(91,74,109,.3)";
  ctx.lineWidth = 10;
  for (let x = 2380; x <= 3600; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 570);
    ctx.bezierCurveTo(x + 70, 700, x - 60, 820, x + 25, 1040);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(194,232,211,.7)";
  ctx.font = "bold 16px system-ui";
  ctx.fillText("↑  빛의 수관", 3415, 330);
  ctx.fillStyle = "rgba(202,174,224,.72)";
  ctx.fillText("↓  가라앉은 뿌리", 2815, 446);
  ctx.fillStyle = "rgba(246,218,132,.75)";
  ctx.fillText("↑  수관 끝 · 달빛 시계탑", 3260, -575);
  ctx.fillStyle = "rgba(105,220,207,.75)";
  ctx.fillText("→  뿌리 끝 · 침수된 기록고", 3460, 930);
  ctx.restore();

  // moonlit clocktower
  ctx.save();
  ctx.strokeStyle = "rgba(232,205,114,.22)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(4550, -1035, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(4550 + Math.cos(angle) * 126, -1035 + Math.sin(angle) * 126);
    ctx.lineTo(4550 + Math.cos(angle) * 145, -1035 + Math.sin(angle) * 145);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(4550, -1035);
  ctx.lineTo(4550 + Math.cos(time * .18) * 92, -1035 + Math.sin(time * .18) * 92);
  ctx.moveTo(4550, -1035);
  ctx.lineTo(4550 + Math.cos(-time * .35) * 64, -1035 + Math.sin(-time * .35) * 64);
  ctx.stroke();
  for (let x = 3980; x <= 5100; x += 220) {
    ctx.beginPath();
    ctx.moveTo(x, -1120);
    ctx.lineTo(x, -835);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,229,150,.78)";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("달빛 시계탑", 3995, -875);
  ctx.fillStyle = "rgba(255,236,178,.62)";
  ctx.font = "15px system-ui";
  ctx.fillText("수관 너머, 멈춘 달의 시간이 흐르는 곳", 3995, -856);
  ctx.restore();

  // flooded archive
  ctx.save();
  ctx.fillStyle = "rgba(47,161,157,.1)";
  ctx.fillRect(3920, 1140, 1330, 310);
  ctx.strokeStyle = "rgba(91,219,207,.22)";
  ctx.lineWidth = 2;
  for (let y = 1218; y < 1430; y += 42) {
    ctx.beginPath();
    for (let x = 3920; x <= 5250; x += 35) {
      ctx.lineTo(x, y + Math.sin(x * .025 + time * 1.4) * 5);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(79,150,154,.25)";
  ctx.lineWidth = 9;
  for (let x = 4100; x <= 5050; x += 240) {
    ctx.strokeRect(x, 930, 110, 250);
    for (let y = 970; y < 1160; y += 42) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 102, y);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(122,235,220,.82)";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("침수된 기록고", 4020, 1160);
  ctx.fillStyle = "rgba(160,224,220,.62)";
  ctx.font = "15px system-ui";
  ctx.fillText("뿌리 아래, 잊힌 문장이 물속을 떠도는 곳", 4020, 1178);
  ctx.restore();

  platforms.forEach(p => {
    const clockPlatform = p.y < -600;
    const archivePlatform = p.y > 1000;
    ctx.fillStyle = clockPlatform
      ? (p.h > 50 ? "#1c2138" : "#34364c")
      : archivePlatform
        ? (p.h > 50 ? "#102b31" : "#21454a")
        : (p.h > 50 ? "#172333" : "#213046");
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = clockPlatform ? "#c6a95d" : archivePlatform ? "#4ca89f" : "#344a5e";
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.strokeStyle = clockPlatform ? "#58506d" : archivePlatform ? "#183c43" : "#213448";
    ctx.lineWidth = 2;
    for (let x = p.x + 18; x < p.x + p.w; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 7);
      ctx.lineTo(x - 8, p.y + Math.min(38, p.h));
      ctx.stroke();
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

  if (!save.opened) {
    ctx.fillStyle = "#101725"; ctx.fillRect(3978, 150, 34, 325);
    ctx.strokeStyle = "#68829d"; ctx.lineWidth = 2;
    for (let y = 170; y < 460; y += 45) { ctx.beginPath(); ctx.arc(3995, y, 10, 0, Math.PI * 2); ctx.stroke(); }
  }

  if (!save.midBossDefeated) {
    ctx.fillStyle = "#142528";
    ctx.fillRect(4620, 130, 38, 345);
    ctx.strokeStyle = "#66c6c4";
    ctx.lineWidth = 2;
    for (let y = 150; y < 455; y += 42) {
      ctx.beginPath();
      ctx.arc(4639, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
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
    ctx.fillRect(merchant.x - 60, merchant.y - 40, 160, 30);
    ctx.fillStyle = "#ffe1a3";
    ctx.font = "bold 15px system-ui";
    ctx.fillText("↓ 상점 열기", merchant.x - 16, merchant.y - 20);
  }

  enemies.forEach(drawEnemy);
  if (midBoss && !midBoss.dead) drawMidBoss();
  areaBosses.forEach(drawAreaBoss);
  if (save.lostCoins) {
    const lost = save.lostCoins;
    ctx.save();
    ctx.translate(lost.x, lost.y + Math.sin(time * 3) * 2);
    ctx.shadowColor = "#ffb943";
    ctx.shadowBlur = 18;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 + time * .35;
      ctx.fillStyle = i % 2 ? "#d9912f" : "#ffd56d";
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 5 - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff0b0";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${lost.amount} ◈`, 0, -19);
    ctx.restore();
  }
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
  bossProjectiles.forEach(projectile => {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = .45;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.r + 4 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
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
  ctx.fillStyle = e.type === "clockwork" ? "#6d5c3c"
    : e.type === "inkling" ? "#174b50"
      : e.type === "flyer" ? "#6f6b91" : "#45586a";
  ctx.beginPath(); ctx.ellipse(0, 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  if (e.type === "flyer") {
    ctx.fillStyle = "#363b59";
    ctx.beginPath(); ctx.ellipse(-18, -2, 15, 7, -.4, 0, Math.PI * 2); ctx.ellipse(18, -2, 15, 7, .4, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === "clockwork") {
    ctx.strokeStyle = "#e7c969";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + time;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 17, Math.sin(angle) * 15);
      ctx.lineTo(Math.cos(angle) * 24, Math.sin(angle) * 21);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 2, 11, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === "inkling") {
    ctx.fillStyle = "rgba(91,218,205,.5)";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 11, 17 + Math.sin(time * 5 + i) * 4, 6, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#67d8cd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -1, 14, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = e.type === "clockwork" ? "#fff0a9" : e.type === "inkling" ? "#9ffff1" : "#aeeaff";
  ctx.shadowColor = e.type === "clockwork" ? "#e4bc45" : e.type === "inkling" ? "#57d9ce" : "#86dfff";
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(e.dir * 7, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.shadowBlur = 0;
}

function drawAreaBoss(areaBoss) {
  if (areaBoss.dead) return;
  ctx.save();
  ctx.translate(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2);
  ctx.scale(areaBoss.dir, 1);
  if (areaBoss.hit > 0) ctx.globalAlpha = .52;

  if (areaBoss.kind === "moon") {
    ctx.rotate(Math.sin(time * 1.8) * .08);
    ctx.shadowColor = "#f1cf68";
    ctx.shadowBlur = areaBoss.action === "dash" ? 28 : 17;
    ctx.strokeStyle = "#e3c465";
    ctx.lineWidth = 6;
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 31, Math.sin(angle) * 31);
      ctx.lineTo(Math.cos(angle) * 42, Math.sin(angle) * 42);
      ctx.stroke();
    }
    ctx.fillStyle = "#363249";
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f6dfa0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff0a7";
    ctx.beginPath();
    ctx.arc(8, -4, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = "#54d5c8";
    ctx.shadowBlur = areaBoss.action === "leap" ? 25 : 14;
    ctx.fillStyle = "#173f45";
    ctx.beginPath();
    ctx.ellipse(0, 12, 34, 43, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bfded8";
    ctx.beginPath();
    ctx.ellipse(0, -25, 26, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5bd5c9";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 11, 37);
      ctx.quadraticCurveTo(i * 14 + Math.sin(time * 4 + i) * 8, 58, i * 10, 67);
    }
    ctx.stroke();
    ctx.fillStyle = "#143138";
    ctx.beginPath();
    ctx.arc(-8, -25, 4, 0, Math.PI * 2);
    ctx.arc(8, -25, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawMidBoss() {
  ctx.save();
  ctx.translate(midBoss.x + midBoss.w / 2, midBoss.y + midBoss.h / 2);
  ctx.scale(midBoss.dir, 1);
  if (midBoss.hit > 0) ctx.globalAlpha = .5;
  ctx.shadowColor = "#68d8d1";
  ctx.shadowBlur = midBoss.action === "cast" ? 26 : 12;
  ctx.fillStyle = "#243f43";
  ctx.beginPath();
  ctx.ellipse(0, 10, 29, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b9ded9";
  ctx.beginPath();
  ctx.ellipse(0, -20, 22, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8acfc8";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-11, -37); ctx.quadraticCurveTo(-26, -61, -35, -43);
  ctx.moveTo(11, -37); ctx.quadraticCurveTo(26, -61, 35, -43);
  ctx.stroke();
  ctx.fillStyle = "#173035";
  ctx.beginPath();
  ctx.arc(-7, -21, 3, 0, Math.PI * 2);
  ctx.arc(7, -21, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#76e0d7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-25, 0); ctx.lineTo(-42, 18);
  ctx.moveTo(25, 0); ctx.lineTo(42, 18);
  ctx.stroke();
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawBoss() {
  const enraged = boss.hp <= boss.maxHp / 2;
  ctx.save(); ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
  ctx.save();
  ctx.globalAlpha = enraged ? .5 : .28;
  ctx.strokeStyle = enraged ? "#f080ff" : "#a77de0";
  ctx.lineWidth = enraged ? 5 : 3;
  ctx.shadowColor = "#d07aff";
  ctx.shadowBlur = 22;
  for (let i = 0; i < (enraged ? 3 : 2); i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 52 + i * 13 + Math.sin(time * 3 + i) * 5, time * (i % 2 ? -1 : 1), time * (i % 2 ? -1 : 1) + Math.PI * 1.35);
    ctx.stroke();
  }
  ctx.restore();
  ctx.scale(boss.dir, 1);
  if (boss.hit > 0) ctx.globalAlpha = .55;
  ctx.shadowColor = enraged ? "#e56cff" : "#8d70c4";
  ctx.shadowBlur = enraged ? 24 : 12;
  ctx.fillStyle = enraged ? "#3d1f49" : "#26243b"; ctx.beginPath(); ctx.ellipse(0, 12, 39, 53, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d7e3ee"; ctx.beginPath(); ctx.ellipse(0, -35, 29, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = enraged ? "#f0c8ff" : "#d7e3ee"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-15, -57); ctx.quadraticCurveTo(-38, -93, -50, -63); ctx.moveTo(15, -57); ctx.quadraticCurveTo(38, -93, 50, -63); ctx.stroke();
  ctx.fillStyle = enraged ? "#c537e8" : "#111624";
  ctx.beginPath(); ctx.arc(-9, -35, enraged ? 5 : 4, 0, Math.PI * 2); ctx.arc(9, -35, enraged ? 5 : 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
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
    ctx.beginPath();
    if (player.attackDir === "up") {
      ctx.arc(0, -8, improved ? 42 : 36, Math.PI * (1.08 + t * .18), Math.PI * (1.92 + t * .18));
    } else if (player.attackDir === "down") {
      ctx.arc(0, 10, improved ? 42 : 36, Math.PI * (.08 + t * .18), Math.PI * (.92 + t * .18));
    } else {
      ctx.arc(9, 1, improved ? 40 : 34, -1.4 + t * .7, .8 + t * .7);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
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
  ctx.fillStyle = "rgba(5,9,18,.65)"; ctx.fillRect(W - 194, 16, 170, 40);
  ctx.fillStyle = "#bcd2e5"; ctx.font = "bold 15px system-ui"; ctx.fillText(`메아리  ${save.echoes.length} / 3`, W - 177, 42);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i < save.echoes.length ? "#b6f0ff" : "#536076";
    ctx.strokeRect(W - 67 + i * 14, 29, 7, 7);
  }

  const room = player.y < -600 ? "달빛 시계탑"
    : player.y < 100 ? "빛의 수관"
      : player.y > 1000 ? "침수된 기록고"
        : player.y > 600 ? "가라앉은 뿌리"
      : player.x < 1500 ? "이끼 낀 회랑"
        : player.x < 3000 ? "빗물의 뿌리"
          : player.x < 4050 ? "별 없는 온실"
            : player.x < 5200 ? "침묵의 전당" : "가장 깊은 종루";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(225,239,250,.82)"; ctx.font = "bold 16px Georgia, serif"; ctx.fillText(room, W / 2, 32);
  const explored = save.echoes.length + save.shopItems.length
    + save.areaBosses.length + (save.dash ? 1 : 0) + (save.midBossDefeated ? 1 : 0);
  ctx.font = "13px system-ui";
  ctx.fillStyle = "rgba(177,200,219,.72)";
  ctx.fillText(`세계 탐색도 ${Math.round(explored / 11 * 100)}%`, W / 2, 51);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(5,9,18,.7)";
  ctx.fillRect(27, 66, 104, 32);
  ctx.fillStyle = "#ffd477";
  ctx.font = "bold 15px system-ui";
  ctx.fillText(`◈  ${save.coins}`, 40, 88);

  if (save.dash) {
    ctx.textAlign = "left"; ctx.fillStyle = player.dashCool <= 0 ? "#a99cff" : "#39405b";
    ctx.fillRect(28, 52, 28, 3);
  }

  const activeAreaBoss = areaBosses.find(areaBoss => areaBoss.active && !areaBoss.dead);
  const activeBoss = boss?.active && !boss.dead
    ? boss
    : midBoss?.active && !midBoss.dead
      ? midBoss
      : activeAreaBoss || null;
  if (activeBoss) {
    const bw = 360, x = (W - bw) / 2, y = H - 32;
    ctx.fillStyle = "#141827"; ctx.fillRect(x, y, bw, 7);
    ctx.fillStyle = activeBoss === boss
      ? "#c58dea"
      : activeBoss.kind === "moon"
        ? "#e6c75f"
        : "#70d5cd";
    ctx.fillRect(x, y, bw * activeBoss.hp / activeBoss.maxHp, 7);
    ctx.fillStyle = "#d9d4ea"; ctx.font = "bold 14px system-ui";
    ctx.fillText(activeBoss === boss ? "심연의 종지기"
      : activeBoss === midBoss ? "청록 수문장" : activeBoss.name, W / 2, y - 7);
  }

  if (save.relics.length) {
    ctx.textAlign = "right";
    ctx.font = "14px system-ui";
    ctx.fillStyle = "rgba(225,236,242,.72)";
    const relicNames = [
      save.relics.includes("moonGear") ? "⚙ 월륜 톱니" : "",
      save.relics.includes("tideSigil") ? "◉ 회수의 인장" : ""
    ].filter(Boolean).join("  ");
    ctx.fillText(relicNames, W - 25, 102);
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
  const completeGarden = save.echoes.length === echoes.length
    && save.shopItems.length === 4
    && save.midBossDefeated
    && save.areaBosses.length === areaBosses.length;
  const endingTitle = completeGarden ? "정원이 온전히 깨어났습니다" : "정원이 깨어났습니다";
  const endingText = completeGarden
    ? "되찾은 메아리가 정원 전체에 번져<br>잊힌 종이 완전한 음색으로 울립니다."
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
  animationFrameId = 0;
  if (!running || paused) return;
  const dt = Math.min((now - last) / 1000, .033);
  last = now;
  if (!shopOpen) update(dt);
  else taps.clear();
  render();
  animationFrameId = requestAnimationFrame(loop);
}

render();
