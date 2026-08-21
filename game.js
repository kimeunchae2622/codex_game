"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const startScreen = document.querySelector("#startScreen");
const pauseScreen = document.querySelector("#pauseScreen");
const shopScreen = document.querySelector("#shopScreen");
const shopCoinsEl = document.querySelector("#shopCoins");
const shopMessageEl = document.querySelector("#shopMessage");
const shopGridEl = document.querySelector("#shopGrid");
const shopKickerEl = document.querySelector("#shopKicker");
const shopTitleEl = document.querySelector("#shopTitle");
const inventoryScreen = document.querySelector("#inventoryScreen");
const equipmentListEl = document.querySelector("#equipmentList");
const sigilGridEl = document.querySelector("#sigilGrid");
const sigilSlotCountEl = document.querySelector("#sigilSlotCount");
const sigilSlotPipsEl = document.querySelector("#sigilSlotPips");
const sigilOwnedCountEl = document.querySelector("#sigilOwnedCount");
const inventoryMessageEl = document.querySelector("#inventoryMessage");
const toastEl = document.querySelector("#toast");
const W = canvas.width;
const H = canvas.height;
const WORLD_W = 12400;
const WORLD_TOP = -1900;
const WORLD_BOTTOM = 2350;
const FLOOR = 475;

const keys = new Set();
const taps = new Set();
let running = false;
let paused = false;
let shopOpen = false;
let inventoryOpen = false;
let shopSelection = 0;
let inventorySelection = 0;
let activeVendor = null;
let shopButtons = [];
let inventoryButtons = [];
let last = 0;
let time = 0;
let shake = 0;
let toastTimer = 0;
let soundOn = true;
let audio;
let musicMaster;
let currentMusicTrack = "";
let musicStep = 0;
let musicNextNote = 0;
let platformHintShown = false;
let animationFrameId = 0;
let loopGeneration = 0;
let pauseSnapshot = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);

const saveDefault = {
  checkpoint: 90, dash: false, echoes: [], defeated: [],
  checkpointY: 380, coins: 0, lostCoins: null, shopItems: [], opened: false,
  midBossDefeated: false, areaBosses: [], relics: [],
  ownedSigils: [], equippedSigils: [], sigilSlots: 3,
  slotUpgrades: [], slotRewards: [],
  bellBossDefeated: false, resonance: false, forgeHeart: false, endingSeen: false,
  eliteDefeated: [], discoveries: []
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

const sigilCatalog = {
  tideSigil: { name: "회수의 인장", slots: 1, color: "#65e5d2", glyph: "◉", description: "떨어진 모든 코인이 즉시 주인을 찾아옵니다.", effects: { globalMagnet: 1 } },
  thornMark: { name: "가시꽃 인장", slots: 1, color: "#ef7f9b", glyph: "✣", description: "공격력이 1 증가합니다.", effects: { attack: 1 } },
  mossHeart: { name: "이끼심장", slots: 2, color: "#79cf8d", glyph: "♥", description: "최대 체력이 1 증가합니다.", effects: { maxHp: 1 } },
  swiftRoot: { name: "빠른뿌리", slots: 1, color: "#9bd88a", glyph: "⌁", description: "이동 속도가 12% 증가합니다.", effects: { move: .12 } },
  sharpPetal: { name: "날선 꽃잎", slots: 2, color: "#ff9eab", glyph: "◆", description: "공격력이 1, 공격 범위가 증가합니다.", effects: { attack: 1, reach: 8 } },
  coinBloom: { name: "금빛꽃", slots: 1, color: "#ffd36d", glyph: "✤", description: "적이 코인을 1개 더 떨어뜨립니다.", effects: { coinBonus: 1 } },
  quietStep: { name: "고요한 걸음", slots: 1, color: "#a9c7da", glyph: "⋰", description: "피격 후 무적 시간이 길어집니다.", effects: { invulnerability: .2 } },
  longNeedle: { name: "긴 바늘", slots: 2, color: "#d8e9ef", glyph: "†", description: "모든 방향의 공격 범위가 크게 늘어납니다.", effects: { reach: 16 } },
  secondWind: { name: "되살이숨", slots: 3, color: "#b8f5c8", glyph: "♧", description: "최대 체력 1, 점프력이 8% 증가합니다.", effects: { maxHp: 1, jump: .08 } },

  brassWing: { name: "황동 날개", slots: 2, color: "#e4bd67", glyph: "⌁", description: "점프력이 14% 증가합니다.", effects: { jump: .14 } },
  cometDash: { name: "혜성 돌진", slots: 2, color: "#f6dd8b", glyph: "➤", description: "대시 속도와 거리가 증가합니다.", effects: { dashSpeed: .16, dashDuration: .12 } },
  hourglass: { name: "모래시계", slots: 1, color: "#d4bb80", glyph: "⌛", description: "대시 재사용 시간이 16% 감소합니다.", effects: { dashCooldown: .16 } },
  orbitBlade: { name: "궤도 칼날", slots: 3, color: "#ffe69d", glyph: "◌", description: "공격력 2, 공격 범위가 증가합니다.", effects: { attack: 2, reach: 6 } },
  starNeedle: { name: "별바늘", slots: 2, color: "#fff0a8", glyph: "✦", description: "공격력 1, 공격 범위가 증가합니다.", effects: { attack: 1, reach: 10 } },
  clockShield: { name: "시계 방패", slots: 2, color: "#aab5d8", glyph: "⬡", description: "최대 체력과 무적 시간이 증가합니다.", effects: { maxHp: 1, invulnerability: .12 } },
  lunarStep: { name: "달그림자", slots: 1, color: "#bdaeff", glyph: "☾", description: "이동 속도가 10% 증가합니다.", effects: { move: .1 } },
  echoDash: { name: "잔향 돌진", slots: 2, color: "#b69cff", glyph: "»", description: "대시 거리와 재사용 속도가 좋아집니다.", effects: { dashDuration: .18, dashCooldown: .1 } },
  gearHeart: { name: "태엽심장", slots: 3, color: "#dd9f5f", glyph: "⚙", description: "최대 체력이 2 증가합니다.", effects: { maxHp: 2 } },

  archiveEye: { name: "기록자의 눈", slots: 1, color: "#72dfd1", glyph: "◈", description: "주변 코인 흡수 범위가 늘어납니다.", effects: { magnet: 190 } },
  inkHeart: { name: "먹빛심장", slots: 2, color: "#4ba8b4", glyph: "♥", description: "최대 체력이 1 증가합니다.", effects: { maxHp: 1 } },
  deepCurrent: { name: "깊은 물결", slots: 1, color: "#65c9d9", glyph: "≈", description: "이동과 점프가 조금 빨라집니다.", effects: { move: .07, jump: .06 } },
  collector: { name: "수집가", slots: 2, color: "#efc45e", glyph: "◇", description: "적이 코인을 2개 더 떨어뜨립니다.", effects: { coinBonus: 2 } },
  floodedWing: { name: "잠긴 날개", slots: 2, color: "#77d6c9", glyph: "ϟ", description: "공중 점프를 1회 추가합니다.", effects: { airJumps: 1 } },
  memoryEdge: { name: "기억의 날", slots: 3, color: "#9ee9df", glyph: "⋈", description: "공격력 2, 공격 범위가 증가합니다.", effects: { attack: 2, reach: 10 } },
  bubbleGuard: { name: "거품 방패", slots: 2, color: "#87dff4", glyph: "○", description: "최대 체력 1, 무적 시간이 증가합니다.", effects: { maxHp: 1, invulnerability: .16 } },
  drownedLuck: { name: "침수된 행운", slots: 1, color: "#e0bf63", glyph: "✧", description: "코인 추가 획득 확률이 높아집니다.", effects: { coinBonus: 1 } },
  abyssStep: { name: "심연 걸음", slots: 2, color: "#7699d8", glyph: "≋", description: "이동과 대시 속도가 증가합니다.", effects: { move: .1, dashSpeed: .1 } },

  moonGear: { name: "월륜 톱니", slots: 2, color: "#f4d567", glyph: "☼", description: "대시 재사용 시간이 28% 감소합니다.", effects: { dashCooldown: .28 }, boss: true },
  archiveCrown: { name: "기록고의 왕관", slots: 2, color: "#62e3d2", glyph: "♛", description: "코인 흡수 범위와 최대 체력이 증가합니다.", effects: { magnet: 260, maxHp: 1 }, boss: true },
  wardenPulse: { name: "수문장의 맥동", slots: 3, color: "#86eadc", glyph: "✺", description: "공격력과 최대 체력이 1 증가합니다.", effects: { attack: 1, maxHp: 1 }, boss: true }
};

const equipmentCatalog = {
  weapon: { cost: 8, name: "새벽의 칼날", description: "기본 공격력 +1", type: "equipment" },
  armor: { cost: 10, name: "이끼 갑옷", description: "기본 최대 체력 +1", type: "equipment" },
  doubleJump: { cost: 12, name: "나방의 날개", description: "공중 점프 +1", type: "equipment" },
  bellKey: { cost: 6, name: "종루의 열쇠", description: "심연의 종지기 관문을 여는 열쇠", type: "equipment" }
};

const gardenSigils = ["tideSigil", "thornMark", "mossHeart", "swiftRoot", "sharpPetal", "coinBloom", "quietStep", "longNeedle", "secondWind"];
const clockSigils = ["brassWing", "cometDash", "hourglass", "orbitBlade", "starNeedle", "clockShield", "lunarStep", "echoDash", "gearHeart"];
const archiveSigils = ["archiveEye", "inkHeart", "deepCurrent", "collector", "floodedWing", "memoryEdge", "bubbleGuard", "drownedLuck", "abyssStep"];
const sigilCosts = {
  tideSigil: 6, thornMark: 7, mossHeart: 9, swiftRoot: 6, sharpPetal: 11, coinBloom: 5, quietStep: 6, longNeedle: 10, secondWind: 13,
  brassWing: 9, cometDash: 10, hourglass: 7, orbitBlade: 15, starNeedle: 11, clockShield: 12, lunarStep: 8, echoDash: 11, gearHeart: 16,
  archiveEye: 7, inkHeart: 10, deepCurrent: 8, collector: 11, floodedWing: 12, memoryEdge: 16, bubbleGuard: 12, drownedLuck: 7, abyssStep: 11
};

function normalizeSave() {
  ["echoes", "defeated", "shopItems", "areaBosses", "relics", "ownedSigils", "equippedSigils", "slotUpgrades", "slotRewards", "eliteDefeated", "discoveries"]
    .forEach(key => { if (!Array.isArray(save[key])) save[key] = []; });
  if (!Number.isFinite(save.sigilSlots)) save.sigilSlots = 3;
  save.relics.forEach(id => {
    if (sigilCatalog[id] && !save.ownedSigils.includes(id)) save.ownedSigils.push(id);
  });
  const legacyRewards = [
    [save.midBossDefeated, "wardenPulse"],
    [save.areaBosses.includes("moonKeeper"), "moonGear"],
    [save.areaBosses.includes("archiveKeeper"), "archiveCrown"]
  ];
  legacyRewards.forEach(([earned, sigilId]) => {
    if (earned && !save.ownedSigils.includes(sigilId)) save.ownedSigils.push(sigilId);
  });
  const balancedRewards = [];
  if (save.areaBosses.includes("moonKeeper")) balancedRewards.push("moonKeeper");
  if (save.bellBossDefeated) balancedRewards.push("bellWarden");
  if (save.bellBossDefeated) save.resonance = true;
  save.slotRewards = balancedRewards;
  save.sigilSlots = 3 + save.slotUpgrades.length + balancedRewards.length;
  save.equippedSigils = save.equippedSigils.filter(id => save.ownedSigils.includes(id) && sigilCatalog[id]);
  let used = 0;
  save.equippedSigils = save.equippedSigils.filter(id => {
    const cost = sigilCatalog[id].slots;
    if (used + cost > save.sigilSlots) return false;
    used += cost;
    return true;
  });
  save.relics.forEach(id => {
    const sigil = sigilCatalog[id];
    if (sigil && !save.equippedSigils.includes(id) && used + sigil.slots <= save.sigilSlots) {
      save.equippedSigils.push(id);
      used += sigil.slots;
    }
  });
  storeSave();
}
normalizeSave();

function sigilStats() {
  const stats = {
    attack: 0, maxHp: 0, move: 0, jump: 0, dashSpeed: 0, dashDuration: 0,
    dashCooldown: 0, reach: 0, coinBonus: 0, magnet: 0,
    invulnerability: 0, airJumps: 0, globalMagnet: 0
  };
  save.equippedSigils.forEach(id => {
    const effects = sigilCatalog[id]?.effects || {};
    Object.entries(effects).forEach(([key, value]) => { stats[key] += value; });
  });
  return stats;
}

function usedSigilSlots() {
  return save.equippedSigils.reduce((total, id) => total + (sigilCatalog[id]?.slots || 0), 0);
}

function hasSigil(id) { return save.equippedSigils.includes(id); }

const player = {
  x: save.checkpoint, y: save.checkpointY, w: 28, h: 43, vx: 0, vy: 0, dir: 1,
  grounded: false, coyote: 0, jumpBuffer: 0, airJumps: 0,
  hp: 4 + (save.shopItems.includes("armor") ? 1 : 0) + sigilStats().maxHp,
  maxHp: 4 + (save.shopItems.includes("armor") ? 1 : 0) + sigilStats().maxHp,
  inv: 0, attack: 0, attackId: 0, attackDir: "side", dash: 0, dashCool: 0,
  look: 0, respawning: 0
};

const camera = { x: 0, y: 0 };
const particles = [];
const coinDrops = [];
const bossProjectiles = [];
const vendors = [
  {
    id: "garden", x: 1810, y: FLOOR - 47, w: 34, h: 47,
    name: "방랑자의 상점", kicker: "뿌리 상인의 작업대", color: "#ffe3a2",
    products: ["weapon", "armor", "doubleJump", "bellKey", ...gardenSigils, "gardenSlot"]
  },
  {
    id: "clock", x: 4485, y: -1107, w: 34, h: 47,
    name: "황동 천문 상점", kicker: "달빛 시계공의 진열대", color: "#f4d477",
    products: [...clockSigils, "clockSlot"]
  },
  {
    id: "archive", x: 4190, y: 1143, w: 34, h: 47,
    name: "잠긴 기록 상점", kicker: "침수된 서기관의 장서", color: "#6be0d2",
    products: [...archiveSigils, "archiveSlot"]
  }
];
const slotProducts = {
  gardenSlot: { type: "slot", name: "새 인장 홈", description: "인장 슬롯 +1", cost: 12 },
  clockSlot: { type: "slot", name: "황동 인장 홈", description: "인장 슬롯 +1", cost: 18 },
  archiveSlot: { type: "slot", name: "기록 인장 홈", description: "인장 슬롯 +1", cost: 22 }
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
  { x: 3900, y: -845, w: 125, h: 16 },
  { x: 4055, y: -920, w: 125, h: 16 },
  { x: 4210, y: -995, w: 150, h: 16 },
  { x: 4360, y: -1060, w: 800, h: 170 },
  { x: 4440, y: -1155, w: 125, h: 18 },
  { x: 4640, y: -1220, w: 135, h: 18 },
  { x: 4830, y: -1160, w: 145, h: 18 },
  { x: 5000, y: -1230, w: 150, h: 18 },

  // beyond the roots: flooded archive
  { x: 3650, y: 1035, w: 135, h: 18 },
  { x: 3815, y: 1110, w: 135, h: 18 },
  { x: 3980, y: 1190, w: 1210, h: 190 },
  { x: 4140, y: 1090, w: 155, h: 18 },
  { x: 4410, y: 1030, w: 145, h: 18 },
  { x: 4680, y: 1085, w: 150, h: 18 },
  { x: 4950, y: 1015, w: 155, h: 18 },

  // beyond the bell tower: ashen forge
  { x: 6200, y: FLOOR, w: 420, h: 130 },
  { x: 6710, y: FLOOR, w: 410, h: 130 },
  { x: 7210, y: FLOOR, w: 620, h: 130 },
  { x: 6300, y: 402, w: 135, h: 18 },
  { x: 6500, y: 338, w: 145, h: 18 },
  { x: 6740, y: 395, w: 130, h: 18 },
  { x: 6950, y: 325, w: 145, h: 18 },
  { x: 7180, y: 388, w: 140, h: 18 },
  { x: 7440, y: 330, w: 155, h: 18 },

  // forge descent into the sleeping coast
  { x: 7660, y: 545, w: 150, h: 18 },
  { x: 7460, y: 645, w: 140, h: 18 },
  { x: 7640, y: 745, w: 145, h: 18 },
  { x: 7440, y: 845, w: 145, h: 18 },
  { x: 7610, y: 945, w: 155, h: 18 },
  { x: 7410, y: 1045, w: 150, h: 18 },

  // sleeping coast and its loop back to the flooded archive
  { x: 5290, y: 1190, w: 590, h: 190 },
  { x: 5980, y: 1190, w: 520, h: 190 },
  { x: 6600, y: 1190, w: 420, h: 190 },
  { x: 7120, y: 1190, w: 500, h: 190 },
  { x: 7720, y: 1190, w: 880, h: 190 },
  { x: 5480, y: 1090, w: 150, h: 18 },
  { x: 5750, y: 1030, w: 145, h: 18 },
  { x: 6100, y: 1090, w: 150, h: 18 },
  { x: 6380, y: 1020, w: 155, h: 18 },
  { x: 6780, y: 1080, w: 145, h: 18 },
  { x: 7060, y: 1015, w: 150, h: 18 },
  { x: 7930, y: 1080, w: 145, h: 18 },
  { x: 8230, y: 1020, w: 155, h: 18 },

  // expanded light canopy: the dusk-vein conservatory
  { x: 3050, y: -620, w: 130, h: 16 },
  { x: 2850, y: -690, w: 135, h: 16 },
  { x: 2630, y: -755, w: 145, h: 16 },
  { x: 1780, y: -840, w: 760, h: 100 },
  { x: 2640, y: -840, w: 880, h: 100 },
  { x: 1910, y: -945, w: 130, h: 16 },
  { x: 2160, y: -900, w: 150, h: 16 },
  { x: 2460, y: -970, w: 140, h: 16 },
  { x: 2760, y: -915, w: 155, h: 16 },
  { x: 3040, y: -970, w: 145, h: 16 },
  { x: 3590, y: -835, w: 120, h: 16 },
  { x: 3750, y: -845, w: 115, h: 16 },

  // expanded moonlit clocktower: orrery galleries
  { x: 5260, y: -1060, w: 930, h: 170 },
  { x: 6290, y: -1060, w: 1010, h: 170 },
  { x: 5300, y: -1160, w: 145, h: 18 },
  { x: 5540, y: -1235, w: 155, h: 18 },
  { x: 5800, y: -1165, w: 140, h: 18 },
  { x: 6060, y: -1260, w: 150, h: 18 },
  { x: 6350, y: -1175, w: 145, h: 18 },
  { x: 6620, y: -1250, w: 155, h: 18 },
  { x: 6900, y: -1165, w: 150, h: 18 },

  // expanded bell tower: vertical resonance nave
  { x: 5290, y: 370, w: 125, h: 17 },
  { x: 5480, y: 285, w: 135, h: 17 },
  { x: 5700, y: 200, w: 130, h: 17 },
  { x: 5920, y: 115, w: 145, h: 17 },
  { x: 5680, y: 30, w: 135, h: 17 },
  { x: 5460, y: -55, w: 140, h: 17 },
  { x: 5260, y: -140, w: 135, h: 17 },
  { x: 5200, y: -300, w: 1020, h: 90 },
  { x: 5480, y: -400, w: 150, h: 17 },
  { x: 5790, y: -455, w: 155, h: 17 },

  // expanded sunken roots: hollow undergrowth
  { x: 500, y: 960, w: 720, h: 160 },
  { x: 1320, y: 960, w: 880, h: 160 },
  { x: 620, y: 860, w: 145, h: 18 },
  { x: 900, y: 790, w: 155, h: 18 },
  { x: 1190, y: 850, w: 140, h: 18 },
  { x: 1510, y: 775, w: 150, h: 18 },
  { x: 1800, y: 840, w: 145, h: 18 },
  { x: 2070, y: 780, w: 145, h: 18 },

  // expanded flooded archive: drowned stacks
  { x: 5160, y: 1300, w: 135, h: 18 },
  { x: 5360, y: 1400, w: 145, h: 18 },
  { x: 5550, y: 1510, w: 145, h: 18 },
  { x: 5330, y: 1620, w: 150, h: 18 },
  { x: 5100, y: 1730, w: 150, h: 18 },
  { x: 4860, y: 1840, w: 145, h: 18 },
  { x: 3000, y: 2050, w: 800, h: 220 },
  { x: 3900, y: 2050, w: 780, h: 220 },
  { x: 4780, y: 2050, w: 820, h: 220 },
  { x: 5700, y: 2050, w: 690, h: 220 },
  { x: 6490, y: 2050, w: 510, h: 220 },
  { x: 3220, y: 1940, w: 150, h: 18 },
  { x: 3500, y: 1860, w: 145, h: 18 },
  { x: 3810, y: 1940, w: 155, h: 18 },
  { x: 4200, y: 1840, w: 145, h: 18 },
  { x: 4500, y: 1930, w: 150, h: 18 },
  { x: 5900, y: 1920, w: 150, h: 18 },
  { x: 6200, y: 1840, w: 155, h: 18 },

  // expanded ashen forge: grand foundry
  { x: 7900, y: FLOOR, w: 680, h: 130 },
  { x: 8680, y: FLOOR, w: 720, h: 130 },
  { x: 9500, y: FLOOR, w: 660, h: 130 },
  { x: 10260, y: FLOOR, w: 740, h: 130 },
  { x: 8060, y: 385, w: 145, h: 18 },
  { x: 8320, y: 315, w: 150, h: 18 },
  { x: 8660, y: 390, w: 140, h: 18 },
  { x: 8940, y: 305, w: 155, h: 18 },
  { x: 9250, y: 380, w: 145, h: 18 },
  { x: 9600, y: 300, w: 150, h: 18 },
  { x: 9920, y: 385, w: 145, h: 18 },
  { x: 10250, y: 320, w: 155, h: 18 },
  { x: 10600, y: 390, w: 145, h: 18 },

  // expanded sleeping coast: astral breakwater
  { x: 8700, y: 1190, w: 650, h: 190 },
  { x: 9450, y: 1190, w: 620, h: 190 },
  { x: 10170, y: 1190, w: 680, h: 190 },
  { x: 10950, y: 1190, w: 650, h: 190 },
  { x: 11700, y: 1190, w: 700, h: 190 },
  { x: 8840, y: 1080, w: 145, h: 18 },
  { x: 9120, y: 1000, w: 150, h: 18 },
  { x: 9500, y: 1070, w: 145, h: 18 },
  { x: 9820, y: 990, w: 155, h: 18 },
  { x: 10200, y: 1075, w: 145, h: 18 },
  { x: 10520, y: 995, w: 150, h: 18 },
  { x: 10950, y: 1070, w: 145, h: 18 },
  { x: 11300, y: 990, w: 155, h: 18 },
  { x: 11720, y: 1070, w: 150, h: 18 }
];

const movingPlatforms = [
  { x: 615, y: 388, w: 92, h: 16, baseX: 615, baseY: 388, axis: "y", range: 40, speed: 1.25, phase: 0, dx: 0, dy: 0, moving: true },
  { x: 2247, y: 375, w: 96, h: 16, baseX: 2247, baseY: 375, axis: "x", range: 55, speed: 1.05, phase: 1.8, dx: 0, dy: 0, moving: true },
  { x: 2910, y: 382, w: 90, h: 16, baseX: 2910, baseY: 382, axis: "y", range: 45, speed: 1.4, phase: 3.1, dx: 0, dy: 0, moving: true },
  { x: 3992, y: 365, w: 100, h: 16, baseX: 3992, baseY: 365, axis: "x", range: 70, speed: 1.15, phase: 4.4, dx: 0, dy: 0, moving: true },
  { x: 5095, y: 395, w: 105, h: 16, baseX: 5095, baseY: 395, axis: "y", range: 38, speed: 1.3, phase: 2.2, dx: 0, dy: 0, moving: true },
  { x: 2913, y: 565, w: 84, h: 16, baseX: 2913, baseY: 565, axis: "y", range: 100, speed: .72, phase: 1.4, dx: 0, dy: 0, moving: true },
  { x: 6615, y: 380, w: 92, h: 16, baseX: 6615, baseY: 380, axis: "y", range: 58, speed: 1.35, phase: .5, dx: 0, dy: 0, moving: true },
  { x: 6505, y: 1080, w: 92, h: 16, baseX: 6505, baseY: 1080, axis: "x", range: 70, speed: .82, phase: 2.4, dx: 0, dy: 0, moving: true }
  ,{ x: 2535, y: -815, w: 96, h: 16, baseX: 2535, baseY: -815, axis: "x", range: 82, speed: .86, phase: 1.1, dx: 0, dy: 0, moving: true }
  ,{ x: 6150, y: -1190, w: 96, h: 16, baseX: 6150, baseY: -1190, axis: "y", range: 70, speed: 1.05, phase: 2.7, dx: 0, dy: 0, moving: true }
  ,{ x: 2230, y: 850, w: 92, h: 16, baseX: 2230, baseY: 850, axis: "x", range: 78, speed: .9, phase: .4, dx: 0, dy: 0, moving: true }
  ,{ x: 4700, y: 1910, w: 98, h: 16, baseX: 4700, baseY: 1910, axis: "y", range: 72, speed: .75, phase: 3.2, dx: 0, dy: 0, moving: true }
  ,{ x: 5000, y: 1890, w: 105, h: 16, baseX: 5000, baseY: 1890, axis: "y", range: 150, speed: .58, phase: 1.57, dx: 0, dy: 0, moving: true }
  ,{ x: 9420, y: 350, w: 98, h: 16, baseX: 9420, baseY: 350, axis: "y", range: 62, speed: 1.2, phase: 1.8, dx: 0, dy: 0, moving: true }
  ,{ x: 10780, y: 1030, w: 98, h: 16, baseX: 10780, baseY: 1030, axis: "x", range: 85, speed: .8, phase: 2.1, dx: 0, dy: 0, moving: true }
];

const crumblePlatforms = [
  { x: 520, y: 360, w: 82, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 1450, y: 380, w: 76, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 2290, y: 330, w: 84, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 2860, y: 417, w: 72, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 4025, y: 320, w: 88, h: 15, timer: 0, gone: 0, crumble: true },
  { x: 5660, y: 410, w: 90, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 3470, y: -820, w: 82, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 2200, y: 925, w: 82, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 5600, y: 1885, w: 86, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 8580, y: 410, w: 88, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 9350, y: 1120, w: 88, h: 15, timer: 0, gone: 0, crumble: true }
  ,{ x: 10850, y: 1120, w: 90, h: 15, timer: 0, gone: 0, crumble: true }
];

const spikes = [
  { x: 620, y: 455, w: 80, h: 20 }, { x: 1460, y: 455, w: 65, h: 20 },
  { x: 2245, y: 455, w: 95, h: 20 },
  { x: 3990, y: 455, w: 100, h: 20 }, { x: 5100, y: 455, w: 100, h: 20 },
  { x: 2900, y: 940, w: 100, h: 20 },
  { x: 4570, y: -1080, w: 85, h: 20 },
  { x: 4320, y: 1170, w: 80, h: 20 },
  { x: 6620, y: 455, w: 90, h: 20 },
  { x: 7120, y: 455, w: 90, h: 20 },
  { x: 6500, y: 1170, w: 100, h: 20 },
  { x: 7620, y: 1170, w: 100, h: 20 }
  ,{ x: 2540, y: -860, w: 100, h: 20 }
  ,{ x: 1220, y: 940, w: 100, h: 20 }
  ,{ x: 3800, y: 2030, w: 100, h: 20 }
  ,{ x: 5600, y: 2030, w: 100, h: 20 }
  ,{ x: 8580, y: 455, w: 100, h: 20 }
  ,{ x: 9400, y: 455, w: 100, h: 20 }
  ,{ x: 9350, y: 1170, w: 100, h: 20 }
  ,{ x: 10850, y: 1170, w: 100, h: 20 }
];

const checkpointData = [
  { x: 115, y: 421 }, { x: 1690, y: 341 }, { x: 3150, y: 431 }, { x: 5350, y: 421 },
  { x: 4010, y: -845 }, { x: 4410, y: -1060 }, { x: 4080, y: 1190 },
  { x: 6360, y: 475 }, { x: 7480, y: 475 }, { x: 7810, y: 1190 }, { x: 5580, y: 1190 }
  ,{ x: 2050, y: -840 }, { x: 6100, y: -1060 }, { x: 5550, y: -300 }
  ,{ x: 760, y: 960 }, { x: 4200, y: 2050 }, { x: 6400, y: 2050 }
  ,{ x: 8900, y: 475 }, { x: 10400, y: 475 }, { x: 9200, y: 1190 }, { x: 11100, y: 1190 }
];

const echoes = [
  { id: "뿌리", x: 1185, y: 323 },
  { id: "비", x: 2760, y: 313 },
  { id: "별", x: 3395, y: 323 }
];

const landmarks = [
  { id: "garden_seed", region: "정원", name: "첫 정원사의 비석", text: "종이 울리기 전, 모든 길은 한 송이 꽃에서 시작되었다.", x: 760, y: 420 },
  { id: "garden_bell", region: "정원", name: "금이 간 작은 종", text: "누군가 거대한 종의 울림을 이 작은 종들에 나누어 숨겼다.", x: 3500, y: 355 },
  { id: "canopy_leaf", region: "빛의 수관", name: "황혼 잎맥", text: "가장 높은 잎은 달의 시간을 먹고 은빛으로 자란다.", x: 2240, y: -840 },
  { id: "canopy_nest", region: "빛의 수관", name: "빈 나방 둥지", text: "수관의 나방들은 멈춘 시계 쪽으로 모두 날아갔다.", x: 3020, y: -840 },
  { id: "clock_orrery", region: "달빛 시계탑", name: "고장 난 천구의", text: "별의 궤도는 멈췄지만 톱니는 아직 다음 밤을 계산한다.", x: 5520, y: -1060 },
  { id: "clock_hour", region: "달빛 시계탑", name: "열세 번째 시각", text: "존재하지 않는 시각에만 종루로 향하는 문이 열린다.", x: 6460, y: -1060 },
  { id: "bell_choir", region: "종루", name: "공명의 성가대", text: "목소리를 잃은 순례자들이 종 대신 벽을 울렸다.", x: 5400, y: -300 },
  { id: "bell_clapper", region: "종루", name: "검은 추", text: "심연의 종지기는 마지막 울림을 자신의 심장에 묶었다.", x: 6010, y: -300 },
  { id: "forge_mold", region: "잿빛 제련소", name: "왕관의 거푸집", text: "이곳에서는 왕의 왕관보다 문의 열쇠를 더 많이 만들었다.", x: 8420, y: 475 },
  { id: "forge_furnace", region: "잿빛 제련소", name: "꺼지지 않는 용광로", text: "재 속의 불씨는 주인이 돌아오기를 천 년째 기다린다.", x: 9800, y: 475 },
  { id: "coast_beacon", region: "별잠 해안", name: "별빛 봉화", text: "바다는 매일 밤 하늘에서 떨어진 별을 이곳으로 밀어낸다.", x: 9050, y: 1190 },
  { id: "coast_wreck", region: "별잠 해안", name: "잠든 순례선", text: "배는 기록고를 향했지만 선원들은 별의 꿈에서 깨어나지 못했다.", x: 10800, y: 1190 },
  { id: "archive_index", region: "침수된 기록고", name: "무한 색인", text: "물에 지워진 이름도 색인에는 빈 줄로 남아 있다.", x: 4300, y: 2050 },
  { id: "archive_vault", region: "침수된 기록고", name: "봉인 장서", text: "정원의 진짜 이름은 가장 깊은 서고에 거꾸로 기록되었다.", x: 6100, y: 2050 },
  { id: "roots_heart", region: "가라앉은 뿌리", name: "뿌리의 심장", text: "정원이 잊은 모든 기억은 아래로 흘러 뿌리의 먹이가 된다.", x: 850, y: 960 },
  { id: "roots_well", region: "가라앉은 뿌리", name: "메아리 우물", text: "우물에 이름을 말하면 오래전의 목소리가 대신 대답한다.", x: 1800, y: 960 }
];

const eliteDefs = [
  { id: "canopyHunter", region: "canopy", name: "녹광 사냥꾼", x: 2050, groundY: -840, bounds: [1810, 2500], color: "#b6f59d", hp: 12 },
  { id: "rootMaw", region: "roots", name: "공허뿌리 아귀", x: 900, groundY: 960, bounds: [540, 1180], color: "#b984d8", hp: 13 },
  { id: "clockKnight", region: "clock", name: "황동 초침기사", x: 5900, groundY: -1060, bounds: [5300, 6180], color: "#f1d16f", hp: 14 },
  { id: "bellCantor", region: "bell", name: "무언의 종지휘자", x: 5700, groundY: -300, bounds: [5230, 6160], color: "#c4a2ff", hp: 15 },
  { id: "archiveBinder", region: "archive", name: "심층 제본사", x: 5250, groundY: 2050, bounds: [4800, 5570], color: "#68ded0", hp: 15 },
  { id: "forgeGolem", region: "forge", name: "쇳물 골렘", x: 9000, groundY: 475, bounds: [8700, 9380], color: "#ff8652", hp: 16 },
  { id: "coastSiren", region: "coast", name: "푸른별 세이렌", x: 10280, groundY: 1190, bounds: [10190, 10820], color: "#82d9ff", hp: 16 }
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
  [4590, -1115, "clockwork", true], [4770, -1125, "clockwork", true],
  [4240, 1110, "inkling", true], [4570, 1070, "inkling", true],
  [6330, 370, "emberling", true], [6770, 360, "emberling", true],
  [7040, 292, "emberling", true], [7460, 298, "emberling", true],
  [5550, 1050, "starling", true], [6150, 1050, "starling", true],
  [6860, 1035, "starling", true], [8000, 1040, "starling", true],
  [2180, -925, "flyer", true], [2780, -930, "flyer", true], [3200, -875, "crawler", true],
  [5480, -1140, "clockwork", true], [6030, -1210, "clockwork", true], [6500, -1140, "clockwork", true],
  [5450, -350, "clockwork", true], [5950, -365, "crawler", true],
  [700, 900, "crawler", true], [1450, 900, "flyer", true], [2050, 900, "crawler", true],
  [3400, 1900, "inkling", true], [4100, 1870, "inkling", true], [4850, 1900, "inkling", true], [6100, 1870, "inkling", true],
  [8150, 410, "emberling", true], [8750, 410, "emberling", true], [9300, 410, "emberling", true],
  [9900, 410, "emberling", true], [10500, 410, "emberling", true],
  [8900, 1050, "starling", true], [9500, 1040, "starling", true], [10400, 1040, "starling", true],
  [11100, 1035, "starling", true], [11700, 1040, "starling", true]
];
let enemies = [];
let midBoss = null;
let boss = null;
let areaBosses = [];
let elites = [];

function supportTopAt(x, preferredY = FLOOR) {
  const supports = platforms.filter(p => x >= p.x && x <= p.x + p.w).map(p => p.y);
  return supports.length
    ? supports.reduce((best, y) => Math.abs(y - preferredY) < Math.abs(best - preferredY) ? y : best)
    : FLOOR;
}

function getMaxHp() {
  return 4 + (save.shopItems.includes("armor") ? 1 : 0) + sigilStats().maxHp;
}

function resetEntities() {
  enemies = enemySeeds.map((e, i) => {
    const flying = ["flyer", "clockwork", "inkling", "starling"].includes(e[2]);
    const width = e[2] === "clockwork" ? 42 : e[2] === "inkling" ? 40 : e[2] === "emberling" ? 44 : e[2] === "starling" ? 38 : flying ? 34 : 38;
    const height = e[2] === "clockwork" ? 36 : e[2] === "inkling" ? 38 : e[2] === "emberling" ? 35 : e[2] === "starling" ? 32 : flying ? 28 : 32;
    const hp = e[2] === "emberling" ? 6 : e[2] === "starling" ? 5 : e[2] === "clockwork" ? 4 : e[2] === "inkling" ? 5 : flying ? 2 : 3;
    const y = flying ? e[1] : (e[3] ? e[1] : supportTopAt(e[0], e[1] + height) - height);
    return {
      id: i, x: e[0], y, baseY: e[1], w: width, h: height, type: e[2], hp,
      dir: i % 2 ? -1 : 1, hit: 0, dead: save.defeated.includes(i), phase: i * 1.7,
      patrolRange: e[3] ? 54 : 90, lastAttack: -1, cooldown: .7 + i % 4 * .28,
      vx: 0, vy: 0, knockback: 0, action: "idle", timer: 0, attackFired: false
    };
  });
  midBoss = {
    x: 4380, y: FLOOR - 78, w: 62, h: 78, hp: 12, maxHp: 12, dir: -1,
    active: false, dead: save.midBossDefeated, hit: 0, cooldown: .8,
    action: "idle", timer: 0, cycle: 0, vx: 0, vy: 0, lastAttack: -1
  };
  boss = {
    x: 5700, y: 367, w: 82, h: 108, hp: 30, maxHp: 30, dir: -1,
    active: false, dead: save.bellBossDefeated, hit: 0, cooldown: 1, action: "idle",
    timer: 0, cycle: 0, vx: 0, vy: 0, lastAttack: -1
  };
  areaBosses = [
    {
      id: "moonKeeper", kind: "moon", name: "월륜의 파수꾼",
      x: 6900, y: -1170, baseY: -1170, w: 70, h: 80, hp: 18, maxHp: 18,
      active: false, dead: save.areaBosses.includes("moonKeeper"), hit: 0,
      cooldown: .8, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    },
    {
      id: "archiveKeeper", kind: "archive", name: "먹빛 사서",
      x: 6600, y: 1960, baseY: 1960, groundY: 2050, bounds: [6300, 6940], w: 76, h: 90, hp: 22, maxHp: 22,
      active: false, dead: save.areaBosses.includes("archiveKeeper"), hit: 0,
      cooldown: .9, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    },
    {
      id: "forgeCore", kind: "forge", name: "잿불 제련심장",
      x: 10500, y: 383, baseY: 383, groundY: FLOOR, bounds: [10180, 10920], w: 84, h: 92, hp: 28, maxHp: 28,
      active: false, dead: save.areaBosses.includes("forgeCore"), hit: 0,
      cooldown: .75, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    },
    {
      id: "starDevourer", kind: "coast", name: "별잠 포식자",
      x: 11920, y: 1092, baseY: 1092, groundY: 1190, bounds: [11680, 12320], w: 86, h: 98, hp: 32, maxHp: 32,
      active: false, dead: save.areaBosses.includes("starDevourer"), hit: 0,
      cooldown: .72, timer: 0, cycle: 0, dir: -1, vx: 0, vy: 0, lastAttack: -1
    }
  ];
  elites = eliteDefs.map((definition, index) => ({
    ...definition, y: definition.groundY - 68, w: 58, h: 68,
    maxHp: definition.hp, active: false, dead: save.eliteDefeated.includes(definition.id),
    hit: 0, cooldown: .65 + index * .04, timer: 0, cycle: 0,
    dir: -1, vx: 0, vy: 0, action: "idle", lastAttack: -1
  }));
  coinDrops.length = 0;
  bossProjectiles.length = 0;
  crumblePlatforms.forEach(p => {
    p.timer = 0;
    p.gone = 0;
  });
}
resetEntities();

const musicTracks = {
  garden: {
    bpm: 78, wave: "triangle", bassWave: "sine", root: 38,
    melody: [62, null, 65, 67, null, 65, 62, null, 60, null, 62, 65, 57, null, 60, null],
    bass: [38, null, null, 45, 38, null, 41, null, 36, null, null, 43, 36, null, 38, null]
  },
  canopy: {
    bpm: 94, wave: "sine", bassWave: "triangle", root: 45,
    melody: [69, 72, null, 76, 74, null, 72, 69, 76, null, 79, 76, 74, 72, null, 69],
    bass: [45, null, 52, null, 48, null, 55, null, 45, null, 52, null, 50, null, 52, null]
  },
  roots: {
    bpm: 62, wave: "triangle", bassWave: "sine", root: 33,
    melody: [57, null, null, 60, 55, null, 53, null, 57, null, 60, null, 52, null, 55, null],
    bass: [33, null, null, 40, 31, null, null, 38, 29, null, null, 36, 31, null, 33, null]
  },
  clock: {
    bpm: 108, wave: "square", bassWave: "triangle", root: 42,
    melody: [66, 69, 73, null, 71, 69, 66, null, 78, 76, 73, 71, 69, null, 66, null],
    bass: [42, null, 49, null, 45, null, 52, null, 42, null, 49, null, 40, null, 47, null], tick: true
  },
  bell: {
    bpm: 82, wave: "sine", bassWave: "square", root: 31,
    melody: [55, null, 62, null, 58, 60, null, 55, 67, null, 62, 60, 58, null, 55, null],
    bass: [31, null, null, 38, 34, null, null, 41, 31, null, null, 36, 29, null, 31, null], tick: true
  },
  archive: {
    bpm: 70, wave: "sine", bassWave: "triangle", root: 35,
    melody: [59, null, 62, null, 66, 64, null, 62, 57, null, 59, 62, 55, null, 57, null],
    bass: [35, null, null, 42, 38, null, null, 45, 33, null, null, 40, 35, null, 38, null]
  },
  forge: {
    bpm: 122, wave: "sawtooth", bassWave: "square", root: 34,
    melody: [58, null, 58, 61, 63, null, 61, 58, 65, null, 63, 61, 58, 61, 56, null],
    bass: [34, null, 34, null, 41, null, 39, null, 34, null, 46, null, 41, null, 39, null], drum: true
  },
  coast: {
    bpm: 68, wave: "sine", bassWave: "triangle", root: 37,
    melody: [61, 64, null, 68, 66, null, 64, null, 73, null, 68, 66, 64, null, 61, null],
    bass: [37, null, 44, null, 40, null, 47, null, 37, null, 44, null, 42, null, 40, null]
  },
  boss_mid: {
    bpm: 132, wave: "square", bassWave: "sawtooth", root: 36,
    melody: [60, 63, 67, 63, 65, 68, 72, 68, 58, 62, 65, 62, 63, 67, 70, 67],
    bass: [36, null, 36, 43, 39, null, 39, 46, 34, null, 34, 41, 36, null, 43, null], drum: true
  },
  boss_bell: {
    bpm: 146, wave: "sawtooth", bassWave: "square", root: 31,
    melody: [55, 58, 62, 67, 66, 62, 58, 55, 70, 67, 66, 62, 58, 62, 55, null],
    bass: [31, 31, 38, null, 30, 30, 37, null, 29, 29, 36, null, 31, 38, 34, null], drum: true
  },
  boss_moon: {
    bpm: 138, wave: "square", bassWave: "triangle", root: 42,
    melody: [78, 73, 69, 73, 81, 78, 76, 73, 85, 81, 78, 76, 73, 76, 69, null],
    bass: [42, null, 49, 54, 45, null, 52, 57, 47, null, 54, 59, 45, null, 52, null], drum: true, tick: true
  },
  boss_archive: {
    bpm: 126, wave: "triangle", bassWave: "sawtooth", root: 35,
    melody: [59, 62, 66, 71, 69, 66, 64, 62, 57, 61, 64, 69, 67, 64, 61, null],
    bass: [35, null, 42, 35, 38, null, 45, 38, 33, null, 40, 33, 35, null, 42, null], drum: true
  },
  boss_forge: {
    bpm: 154, wave: "sawtooth", bassWave: "square", root: 29,
    melody: [53, 56, 60, 56, 61, 60, 56, 53, 65, 61, 60, 56, 53, 56, 51, null],
    bass: [29, 29, 36, 29, 32, 32, 39, 32, 27, 27, 34, 27, 29, 36, 32, null], drum: true
  },
  boss_coast: {
    bpm: 142, wave: "sine", bassWave: "sawtooth", root: 37,
    melody: [73, 76, 80, 85, 83, 80, 76, 73, 71, 75, 78, 83, 80, 78, 75, null],
    bass: [37, null, 44, 49, 40, null, 47, 52, 35, null, 42, 47, 37, null, 44, null], drum: true
  }
};

function ensureAudio() {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (!musicMaster) {
    musicMaster = audio.createGain();
    musicMaster.gain.value = .0001;
    musicMaster.connect(audio.destination);
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function synthMusicNote(note, start, duration, type, volume, cutoff = 1800) {
  if (note == null || !musicMaster) return;
  const oscillator = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(midiFrequency(note), start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(filter).connect(gain).connect(musicMaster);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function synthMusicDrum(start, strong = false) {
  if (!musicMaster) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = strong ? "sine" : "square";
  oscillator.frequency.setValueAtTime(strong ? 115 : 1500, start);
  oscillator.frequency.exponentialRampToValueAtTime(strong ? 48 : 500, start + .06);
  gain.gain.setValueAtTime(strong ? .04 : .009, start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + (strong ? .12 : .035));
  oscillator.connect(gain).connect(musicMaster);
  oscillator.start(start);
  oscillator.stop(start + .14);
}

function getRegionAt(x, y) {
  if (y < -900) return "clock";
  if (y >= 1450) return "archive";
  if (x >= 5200 && y >= 800) return "coast";
  if (x >= 6250 && y < 800) return "forge";
  if (x >= 5200 && y < 800) return "bell";
  if (y < 100) return "canopy";
  if (y > 1000) return "archive";
  if (y > 600) return "roots";
  return "garden";
}

function getRegionMusic() {
  return getRegionAt(player.x + player.w / 2, player.y + player.h / 2);
}

function getMusicTrack() {
  if (boss?.active && !boss.dead) return "boss_bell";
  if (midBoss?.active && !midBoss.dead) return "boss_mid";
  const areaBoss = areaBosses.find(candidate => candidate.active && !candidate.dead);
  if (areaBoss) return `boss_${areaBoss.kind}`;
  const elite = elites.find(candidate => candidate.active && !candidate.dead);
  if (elite) {
    return elite.region === "clock" ? "boss_moon"
      : elite.region === "bell" ? "boss_bell"
        : elite.region === "archive" || elite.region === "roots" ? "boss_archive"
          : elite.region === "forge" ? "boss_forge"
            : elite.region === "coast" ? "boss_coast" : "boss_mid";
  }
  return getRegionMusic();
}

function switchMusicTrack(trackId) {
  if (trackId === currentMusicTrack) return;
  currentMusicTrack = trackId;
  musicStep = 0;
  if (!audio || !musicMaster) return;
  const now = audio.currentTime;
  musicMaster.gain.cancelScheduledValues(now);
  musicMaster.gain.setValueAtTime(Math.max(.0001, musicMaster.gain.value), now);
  musicMaster.gain.exponentialRampToValueAtTime(trackId ? .55 : .0001, now + .16);
  musicNextNote = now + .18;
}

function updateMusic(forceRestart = false) {
  if (!soundOn || !running || paused) {
    switchMusicTrack("");
    return;
  }
  ensureAudio();
  const wantedTrack = getMusicTrack();
  if (forceRestart && wantedTrack === currentMusicTrack) currentMusicTrack = "";
  switchMusicTrack(wantedTrack);
  const track = musicTracks[currentMusicTrack];
  if (!track) return;
  const now = audio.currentTime;
  if (musicNextNote < now - .25) musicNextNote = now + .04;
  const stepDuration = 60 / track.bpm / 2;
  while (musicNextNote < now + .14) {
    const index = musicStep % track.melody.length;
    synthMusicNote(track.melody[index], musicNextNote, stepDuration * .78,
      track.wave, track.wave === "sawtooth" ? .016 : .022, track.wave === "square" ? 1350 : 2100);
    synthMusicNote(track.bass[index], musicNextNote, stepDuration * 1.55,
      track.bassWave, .018, 720);
    if (index % 4 === 0) {
      synthMusicNote(track.root + (index >= 8 ? 5 : 0), musicNextNote,
        stepDuration * 3.6, "sine", .009, 950);
    }
    if (track.drum && index % 2 === 0) synthMusicDrum(musicNextNote, index % 4 === 0);
    if (track.tick && index % 2 === 1) synthMusicDrum(musicNextNote, false);
    musicNextNote += stepDuration;
    musicStep++;
  }
}

function beep(freq = 300, duration = .08, type = "sine", volume = .05) {
  if (!soundOn) return;
  ensureAudio();
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
  shopButtons.forEach((button, index) => {
    const id = button.dataset.productId;
    const product = getProduct(id);
    const owned = isProductOwned(id);
    button.disabled = owned;
    button.classList.toggle("owned", owned);
    button.classList.toggle("selected", index === shopSelection);
    button.querySelector("b").textContent = owned ? "구매 완료" : `${product.cost} ◈`;
    if (index === shopSelection) button.scrollIntoView({ block: "nearest" });
  });
}

function getProduct(id) {
  if (equipmentCatalog[id]) return equipmentCatalog[id];
  if (slotProducts[id]) return slotProducts[id];
  if (sigilCatalog[id]) return {
    ...sigilCatalog[id], type: "sigil", cost: sigilCosts[id] ?? 0,
    description: `${sigilCatalog[id].description} · ${sigilCatalog[id].slots}칸`
  };
  return null;
}

function isProductOwned(id) {
  if (equipmentCatalog[id]) return save.shopItems.includes(id);
  if (slotProducts[id]) return save.slotUpgrades.includes(id);
  return save.ownedSigils.includes(id);
}

function renderShopProducts() {
  shopGridEl.replaceChildren();
  activeVendor.products.forEach(id => {
    const product = getProduct(id);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.productId = id;
    button.innerHTML = `<span>${product.name}</span><small>${product.description}</small><b>${product.cost} ◈</b>`;
    button.addEventListener("click", () => buyShopItem(id));
    shopGridEl.append(button);
  });
  shopButtons = [...shopGridEl.querySelectorAll("button")];
}

function openShop(vendor) {
  activeVendor = vendor;
  shopOpen = true;
  shopKickerEl.textContent = vendor.kicker;
  shopTitleEl.textContent = vendor.name;
  renderShopProducts();
  const firstAvailable = shopButtons.findIndex(button => !isProductOwned(button.dataset.productId));
  shopSelection = firstAvailable >= 0 ? firstAvailable : 0;
  keys.clear();
  taps.clear();
  updateShopUI("방향키로 품목 선택 · Z 구매 · A 나가기");
  shopScreen.classList.remove("hidden");
}

function closeShop() {
  shopOpen = false;
  activeVendor = null;
  shopScreen.classList.add("hidden");
  keys.delete("KeyA");
  taps.delete("KeyA");
  last = performance.now();
}

function buyShopItem(id) {
  const item = getProduct(id);
  if (!item || isProductOwned(id)) return;
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
  if (item.type === "equipment") {
    save.shopItems.push(id);
  } else if (item.type === "slot") {
    save.slotUpgrades.push(id);
    save.sigilSlots++;
  } else {
    save.ownedSigils.push(id);
    if (usedSigilSlots() + item.slots <= save.sigilSlots) save.equippedSigils.push(id);
  }
  player.maxHp = getMaxHp();
  player.hp = player.maxHp;
  storeSave();
  const equipNote = item.type === "sigil" && hasSigil(id) ? " · 빈 슬롯에 자동 장착" : "";
  updateShopUI(`${item.name}을(를) 구매했습니다${equipNote}.`);
  puff(activeVendor.x, activeVendor.y, id === "bellKey" ? "#ffe19a" : activeVendor.color, 20, 150);
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

function equipmentRows() {
  return [
    ["weapon", "새벽의 칼날", "공격력 +1"],
    ["armor", "이끼 갑옷", "최대 체력 +1"],
    ["doubleJump", "나방의 날개", "공중 점프 +1"],
    ["bellKey", "종루의 열쇠", "최종 관문 개방"],
    ["dash", "그림자 대시", "C로 빠르게 돌진"],
    ["resonance", "종의 공명", "정원 밖 공명문 개방"],
    ["forgeHeart", "용광로 내성", "타오르는 봉인 통과"]
  ];
}

function renderInventory(message = "방향키로 선택 · Z 장착/해제 · I 또는 A 닫기") {
  const used = usedSigilSlots();
  sigilSlotCountEl.textContent = `${used} / ${save.sigilSlots}`;
  sigilOwnedCountEl.textContent = `${save.ownedSigils.length} / ${Object.keys(sigilCatalog).length}`;
  sigilSlotPipsEl.innerHTML = Array.from({ length: save.sigilSlots }, (_, i) =>
    `<i class="${i < used ? "used" : ""}"></i>`).join("");
  equipmentListEl.innerHTML = equipmentRows().map(([id, name, description]) => {
    const owned = id === "dash" ? save.dash
      : id === "resonance" ? save.resonance
        : id === "forgeHeart" ? save.forgeHeart : save.shopItems.includes(id);
    return `<div class="${owned ? "owned" : ""}"><b>${owned ? "◆" : "◇"} ${name}</b><br><small>${owned ? description : "아직 발견하지 못함"}</small></div>`;
  }).join("");

  sigilGridEl.replaceChildren();
  save.ownedSigils.forEach(id => {
    const sigil = sigilCatalog[id];
    if (!sigil) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sigil-card";
    button.style.setProperty("--sigil-color", sigil.color);
    button.dataset.sigilId = id;
    button.innerHTML = `<i class="sigil-glyph">${sigil.glyph}</i><span>${sigil.name}</span><b>${sigil.slots}칸</b><small>${sigil.description}</small>`;
    button.addEventListener("click", () => toggleSigil(id));
    sigilGridEl.append(button);
  });
  if (!save.ownedSigils.length) {
    const empty = document.createElement("p");
    empty.className = "empty-sigils";
    empty.textContent = "아직 가진 인장이 없습니다. 지역 상인과 수호자를 찾아보세요.";
    sigilGridEl.append(empty);
  }
  inventoryButtons = [...sigilGridEl.querySelectorAll(".sigil-card")];
  inventorySelection = clamp(inventorySelection, 0, Math.max(0, inventoryButtons.length - 1));
  inventoryButtons.forEach((button, index) => {
    button.classList.toggle("equipped", hasSigil(button.dataset.sigilId));
    button.classList.toggle("selected", index === inventorySelection);
    if (index === inventorySelection) button.scrollIntoView({ block: "nearest" });
  });
  inventoryMessageEl.textContent = message;
}

function openInventory() {
  inventoryOpen = true;
  inventorySelection = 0;
  keys.clear();
  taps.clear();
  renderInventory();
  inventoryScreen.classList.remove("hidden");
}

function closeInventory() {
  inventoryOpen = false;
  inventoryScreen.classList.add("hidden");
  keys.delete("KeyI");
  keys.delete("KeyA");
  last = performance.now();
}

function toggleSigil(id) {
  const sigil = sigilCatalog[id];
  if (!sigil) return;
  const oldMax = player.maxHp;
  if (hasSigil(id)) {
    save.equippedSigils = save.equippedSigils.filter(equippedId => equippedId !== id);
    renderInventory(`${sigil.name}을(를) 해제했습니다.`);
  } else if (usedSigilSlots() + sigil.slots > save.sigilSlots) {
    renderInventory(`빈 슬롯이 ${usedSigilSlots() + sigil.slots - save.sigilSlots}칸 부족합니다.`);
    beep(120, .12, "square", .03);
    return;
  } else {
    save.equippedSigils.push(id);
    renderInventory(`${sigil.name}을(를) 장착했습니다.`);
  }
  player.maxHp = getMaxHp();
  player.hp = clamp(player.hp + Math.max(0, player.maxHp - oldMax), 1, player.maxHp);
  storeSave();
  puff(player.x + player.w / 2, player.y + player.h / 2, sigil.color, 16, 125);
  beep(hasSigil(id) ? 680 : 340, .12, "sine", .035);
}

function moveInventorySelection(code) {
  if (!inventoryButtons.length) return;
  const columns = innerWidth <= 700 ? 1 : 2;
  const rows = Math.ceil(inventoryButtons.length / columns);
  const row = Math.floor(inventorySelection / columns);
  const column = inventorySelection % columns;
  if (code === "ArrowLeft") inventorySelection = row * columns + (column + columns - 1) % columns;
  if (code === "ArrowRight") inventorySelection = row * columns + (column + 1) % columns;
  if (code === "ArrowUp") inventorySelection = ((row + rows - 1) % rows) * columns + column;
  if (code === "ArrowDown") inventorySelection = ((row + 1) % rows) * columns + column;
  inventorySelection = clamp(inventorySelection, 0, inventoryButtons.length - 1);
  renderInventory();
  beep(380 + inventorySelection * 12, .035, "sine", .015);
}

addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX", "KeyC", "KeyA", "KeyI", "Escape"].includes(e.code)) e.preventDefault();
  if (shopOpen) {
    if (e.code === "KeyA") closeShop();
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) moveShopSelection(e.code);
    else if (e.code === "KeyZ") buyShopItem(shopButtons[shopSelection].dataset.productId);
    return;
  }
  if (inventoryOpen) {
    if (e.code === "KeyI" || e.code === "KeyA" || e.code === "Escape") closeInventory();
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) moveInventorySelection(e.code);
    else if (e.code === "KeyZ" && inventoryButtons.length) toggleSigil(inventoryButtons[inventorySelection].dataset.sigilId);
    return;
  }
  const firstPress = !keys.has(e.code);
  if (firstPress) taps.add(e.code);
  keys.add(e.code);
  if (e.code === "KeyI" && running && !paused && firstPress && !e.repeat) {
    openInventory();
    return;
  }
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
  ensureAudio();
  updateMusic(true);
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
document.querySelector("#soundButton").addEventListener("click", e => {
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? "음악·효과음 끄기" : "음악·효과음 켜기";
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  if (soundOn) {
    ensureAudio();
    beep(520, .1, "sine", .06);
    updateMusic(true);
  } else {
    switchMusicTrack("");
  }
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
  const generation = ++loopGeneration;
  last = performance.now();
  animationFrameId = requestAnimationFrame(now => loop(now, generation));
}

function togglePause() {
  paused = !paused;
  pauseScreen.classList.toggle("hidden", !paused);
  if (paused) {
    pauseSnapshot = {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      support: player.grounded ? findSupportingPlatform() : null
    };
    loopGeneration++;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    updateMusic();
  } else {
    if (pauseSnapshot) {
      player.x = pauseSnapshot.x;
      player.y = pauseSnapshot.y;
      player.vx = pauseSnapshot.vx;
      player.vy = pauseSnapshot.vy;
      if (pauseSnapshot.support) {
        player.y = pauseSnapshot.support.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = .1;
      }
    }
    pauseSnapshot = null;
    keys.clear();
    taps.clear();
    updateMusic(true);
    startGameLoop();
  }
}

function moveAndCollide(dt) {
  const stats = sigilStats();
  if (player.dash > 0) {
    player.vx = player.dir * 760 * (1 + stats.dashSpeed);
    player.vy = 0;
  } else {
    const move = (down("ArrowRight") ? 1 : 0) - (down("ArrowLeft") ? 1 : 0);
    const target = move * 235 * (1 + stats.move);
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
  if (!save.resonance) solids.push({ x: 6190, y: 130, w: 40, h: 345, gate: "resonance" });
  if (!save.forgeHeart) {
    solids.push({ x: 7400, y: 500, w: 520, h: 690, gate: "forge" });
    solids.push({ x: 5880, y: 960, w: 40, h: 230, gate: "forgeShortcut" });
  }
  for (const p of solids) {
    if (!overlap(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    player.vx = 0;
    if (p.gate === "echo" && save.echoes.length < 3) toast(`침묵의 문 · 메아리 ${save.echoes.length}/3`);
    if (p.gate === "midboss") toast("수문장이 길을 막고 있습니다 · 중간 보스를 처치하세요");
    if (p.gate === "boss") toast("심연의 종지기 관문 · 상점에서 종루의 열쇠를 준비하세요");
    if (p.gate === "resonance") toast("잠든 공명문 · 심연의 종지기를 쓰러뜨려야 합니다");
    if (p.gate === "forge" || p.gate === "forgeShortcut") toast("타오르는 봉인 · 잿불 제련심장을 쓰러뜨리세요");
  }

  player.grounded = false;
  const previousY = player.y;
  player.y += player.vy * dt;
  const verticalSolids = [...solids].sort((a, b) => player.vy >= 0
    ? a.y - b.y
    : (b.y + b.h) - (a.y + a.h));
  for (const p of verticalSolids) {
    const horizontallyOverlapping = player.x < p.x + p.w && player.x + player.w > p.x;
    const crossedTop = player.vy > 0
      && previousY + player.h <= p.y
      && player.y + player.h >= p.y;
    const crossedBottom = player.vy < 0
      && previousY >= p.y + p.h
      && player.y <= p.y + p.h;
    if (!horizontallyOverlapping || (!overlap(player, p) && !crossedTop && !crossedBottom)) continue;
    if (player.vy > 0 && (crossedTop || overlap(player, p))) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.coyote = .1;
      player.airJumps = (save.shopItems.includes("doubleJump") ? 1 : 0) + stats.airJumps;
      if (p.moving) player.x += p.dx;
      if (p.crumble && p.timer === 0) p.timer = .001;
    } else if (player.vy < 0 && (crossedBottom || overlap(player, p))) {
      player.y = p.y + p.h;
      player.vy = 40;
    }
  }
  player.x = clamp(player.x, 0, WORLD_W - player.w);
}

function hurt(amount, sourceX) {
  if (player.inv > 0 || player.respawning > 0) return;
  player.hp -= amount;
  player.inv = 1.15 + sigilStats().invulnerability;
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
  const sigilReach = sigilStats().reach;
  const reach = (improved ? 66 : 56) + sigilReach;
  if (player.attackDir === "up") {
    return { x: player.x - 14 - sigilReach / 4, y: player.y - (improved ? 58 : 50) - sigilReach, w: 56 + sigilReach / 2, h: (improved ? 66 : 58) + sigilReach };
  }
  if (player.attackDir === "down") {
    return { x: player.x - 14 - sigilReach / 4, y: player.y + player.h - 8, w: 56 + sigilReach / 2, h: (improved ? 66 : 58) + sigilReach };
  }
  return { x: player.dir > 0 ? player.x + 20 : player.x - reach + 8, y: player.y + 5, w: reach, h: 36 };
}

function bounceFromDownwardHit(target) {
  const playerFeet = player.y + player.h;
  const struckFromAbove = playerFeet <= target.y + target.h * .7;
  if (player.attackDir !== "down" || !struckFromAbove) return;
  player.vy = -335 * (1 + sigilStats().jump * .35);
  player.grounded = false;
  player.coyote = 0;
  puff(player.x + player.w / 2, player.y + player.h, "#c9f4ff", 9, 115);
}

function getAttackPower() {
  return 1 + (save.shopItems.includes("weapon") ? 1 : 0) + sigilStats().attack;
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
  const stats = sigilStats();
  player.inv -= dt; player.attack -= dt; player.dash -= dt; player.dashCool -= dt;
  player.coyote -= dt; player.jumpBuffer -= dt;

  if (tap("KeyZ")) player.jumpBuffer = .13;
  if (player.jumpBuffer > 0 && player.dash <= 0 && (player.coyote > 0 || player.airJumps > 0)) {
    const airJump = player.coyote <= 0;
    if (airJump) player.airJumps--;
    player.vy = (airJump ? -485 : -520) * (1 + stats.jump);
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
      player.dash = .16 * (1 + stats.dashDuration);
      player.dashCool = .55 * (1 - clamp(stats.dashCooldown, 0, .65));
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
    if (distance < 36 || hasSigil("tideSigil")) {
      const recovered = save.lostCoins.amount;
      save.coins += recovered;
      save.lostCoins = null;
      storeSave();
      toast(`떨어뜨린 코인 ${recovered}개를 되찾았습니다`, 2800);
      puff(player.x + player.w / 2, player.y + player.h / 2, "#ffe28a", 28, 210);
      beep(880, .55, "sine", .06);
    }
  }

  const nearbyVendor = vendors.find(vendor =>
    Math.abs(player.x + player.w / 2 - (vendor.x + vendor.w / 2)) < 60
    && Math.abs(player.y + player.h / 2 - (vendor.y + vendor.h / 2)) < 72
  );
  if (nearbyVendor && tap("ArrowDown")) {
    openShop(nearbyVendor);
    return;
  }

  const nearbyLandmark = landmarks.find(landmark =>
    Math.abs(player.x + player.w / 2 - landmark.x) < 48
    && Math.abs(player.y + player.h - landmark.y) < 72
  );
  if (nearbyLandmark && tap("ArrowDown")) {
    if (!save.discoveries.includes(nearbyLandmark.id)) {
      save.discoveries.push(nearbyLandmark.id);
      save.coins += 3;
      storeSave();
      puff(nearbyLandmark.x, nearbyLandmark.y - 25, "#d8f4ff", 24, 145);
      beep(740, .42, "sine", .045);
    }
    toast(`${nearbyLandmark.region} · ${nearbyLandmark.name} — ${nearbyLandmark.text}`, 5200);
  }

  if (!platformHintShown && player.x > 430) {
    platformHintShown = true;
    toast("빛나는 발판은 움직이고, 갈라진 발판은 곧 무너집니다", 3200);
  }

  for (const s of spikes) if (overlap(player, s)) hurt(1, s.x + s.w / 2);
  if (player.y > WORLD_BOTTOM + 80 || player.y < WORLD_TOP - 120) respawn();

  checkpointData.forEach(cp => {
    const nearCheckpoint = Math.abs(player.x - cp.x) < 46
      && Math.abs(player.y + player.h - cp.y) < 65;
    const newlyReached = nearCheckpoint && save.checkpoint !== cp.x;
    const manualRest = nearCheckpoint && tap("ArrowDown");
    if (newlyReached || manualRest) {
      save.checkpoint = cp.x;
      save.checkpointY = cp.y - player.h;
      player.hp = player.maxHp;
      storeSave();
      toast(manualRest
        ? "체크포인트에서 휴식했습니다 · 체력 완전 회복"
        : "등불이 기억을 품었습니다 · 체력 회복");
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
    e.timer -= dt;
    e.x += e.knockback * dt;
    e.knockback *= Math.pow(.008, dt);
    const playerCenterX = player.x + player.w / 2;
    const playerCenterY = player.y + player.h / 2;
    const enemyCenterX = e.x + e.w / 2;
    const enemyCenterY = e.y + e.h / 2;
    const distanceToPlayer = Math.hypot(playerCenterX - enemyCenterX, playerCenterY - enemyCenterY);

    if (e.type === "crawler" || e.type === "emberling") {
      const home = enemySeeds[e.id][0];
      if (e.action === "bite") {
        if (e.timer > .22) {
          e.x -= e.dir * 28 * dt;
        } else {
          e.x += e.dir * 245 * dt;
        }
        if (e.timer <= 0) e.action = "idle";
      } else {
        e.x += e.dir * 55 * dt;
        if (Math.abs(e.x - home) > e.patrolRange) e.dir *= -1;
        if (e.cooldown <= 0 && Math.abs(playerCenterX - enemyCenterX) < 135
          && Math.abs(playerCenterY - enemyCenterY) < 70) {
          e.dir = playerCenterX < enemyCenterX ? -1 : 1;
          e.action = "bite";
          e.timer = .48;
          e.cooldown = 1.25;
          puff(enemyCenterX, enemyCenterY, e.type === "emberling" ? "#ff8b4a" : "#8faec1", 6, 65);
        }
      }
      e.x = clamp(e.x, home - e.patrolRange - 18, home + e.patrolRange + 18);
    } else if (e.type === "flyer" || e.type === "starling") {
      e.phase += dt * 2;
      if (e.action === "dive") {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= Math.pow(.45, dt);
        e.vy *= Math.pow(.45, dt);
        if (e.timer <= 0) {
          e.action = "idle";
          e.baseY = e.y;
        }
      } else {
        e.y = e.baseY + Math.sin(e.phase) * 28;
        if (Math.abs(player.x - e.x) < 260) e.x += Math.sign(player.x - e.x) * 34 * dt;
        if (e.cooldown <= 0 && distanceToPlayer < 210) {
          const angle = Math.atan2(playerCenterY - enemyCenterY, playerCenterX - enemyCenterX);
          e.dir = Math.cos(angle) < 0 ? -1 : 1;
          e.vx = Math.cos(angle) * 275;
          e.vy = Math.sin(angle) * 275;
          e.action = "dive";
          e.timer = .58;
          e.cooldown = 1.45;
          puff(enemyCenterX, enemyCenterY, e.type === "starling" ? "#8bdcff" : "#8985ad", 8, 80);
        }
      }
    } else if (e.type === "clockwork") {
      e.phase += dt * 3.2;
      e.y = e.baseY + Math.sin(e.phase) * 18;
      const home = enemySeeds[e.id][0];
      if (e.action === "cast") {
        if (e.timer <= .18 && !e.attackFired) {
          e.attackFired = true;
          fireAimedVolley(e, 2, .24, 210, "#f4d47b");
          beep(390, .09, "square", .025);
        }
        if (e.timer <= 0) {
          e.action = "idle";
          e.cooldown = 1.45;
        }
      } else {
        e.x += e.dir * 42 * dt;
        if (Math.abs(e.x - home) > e.patrolRange) e.dir *= -1;
        if (e.cooldown <= 0 && distanceToPlayer < 390) {
          e.dir = playerCenterX < enemyCenterX ? -1 : 1;
          e.action = "cast";
          e.timer = .42;
          e.attackFired = false;
          puff(enemyCenterX, enemyCenterY, "#f4d47b", 10, 90);
        }
      }
    } else if (e.type === "inkling") {
      e.phase += dt * 2.5;
      if (e.action === "lunge") {
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
        if (e.cooldown <= 0 && distanceToPlayer < 320) {
          const angle = Math.atan2(playerCenterY - enemyCenterY, playerCenterX - enemyCenterX);
          e.dir = Math.cos(angle) < 0 ? -1 : 1;
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
      const attackPower = getAttackPower();
      const knockDirection = Math.sign(
        e.x + e.w / 2 - (player.x + player.w / 2)
      ) || player.dir;
      e.lastAttack = player.attackId;
      e.hp -= attackPower;
      e.hit = .18;
      e.knockback = knockDirection * (["clockwork", "inkling", "emberling", "starling"].includes(e.type) ? 235 : 195);
      bounceFromDownwardHit(e);
      shake = 4;
      puff(e.x + e.w / 2 - knockDirection * 8, e.y + e.h / 2, "#baf0ff", 11, 165);
      beep(220, .07, "square", .035);
      if (e.hp <= 0) {
        e.dead = true;
        if (!save.defeated.includes(e.id)) save.defeated.push(e.id);
        storeSave();
        const regionalEnemy = ["clockwork", "inkling", "emberling", "starling"].includes(e.type);
        spawnCoins(e.x + e.w / 2, e.y + e.h / 2, regionalEnemy ? 6 : e.type === "flyer" ? 4 : 3);
        const deathColor = e.type === "clockwork" ? "#e8c66c"
          : e.type === "inkling" ? "#67d9c8"
            : e.type === "emberling" ? "#ff7d3f"
              : e.type === "starling" ? "#82dfff" : "#7186a8";
        puff(e.x, e.y, deathColor, 18, 180);
      }
    }
    if (overlap(player, e)) hurt(1, e.x + e.w / 2);
  });
}

function spawnCoins(x, y, count) {
  const total = count + sigilStats().coinBonus;
  for (let i = 0; i < total; i++) {
    coinDrops.push({
      x, y, vx: rnd(-115, 115), vy: rnd(-320, -190),
      value: 1, life: 18, phase: rnd(0, Math.PI * 2)
    });
  }
  beep(520, .12, "triangle", .035);
}

function updateCoins(dt) {
  const stats = sigilStats();
  for (let i = coinDrops.length - 1; i >= 0; i--) {
    const coin = coinDrops[i];
    const previousY = coin.y;
    coin.life -= dt;
    coin.vy += 920 * dt;
    const dx = player.x + player.w / 2 - coin.x;
    const dy = player.y + player.h / 2 - coin.y;
    const distance = Math.hypot(dx, dy);
    const coinSurfaces = [
      ...platforms,
      ...movingPlatforms,
      ...crumblePlatforms.filter(platform => platform.gone <= 0)
    ];
    const globalRecovery = stats.globalMagnet > 0;
    const magnetRange = 155 + stats.magnet;
    const platformRecoveryRange = 380 + stats.magnet;
    const trappedBelowPlatform = dy < 0
      && Math.abs(dx) < 135
      && distance < platformRecoveryRange
      && coinSurfaces.some(platform => {
        const playerOverPlatform = player.x + player.w / 2 >= platform.x
          && player.x + player.w / 2 <= platform.x + platform.w;
        const coinUnderPlatform = coin.x >= platform.x - 7
          && coin.x <= platform.x + platform.w + 7
          && player.y + player.h / 2 < platform.y
          && coin.y > platform.y + platform.h;
        return playerOverPlatform && coinUnderPlatform;
      });
    coin.recovering = trappedBelowPlatform || globalRecovery;
    if (globalRecovery || distance < magnetRange || trappedBelowPlatform) {
      const activeRange = globalRecovery ? Math.max(WORLD_W, WORLD_BOTTOM - WORLD_TOP) : trappedBelowPlatform ? platformRecoveryRange : magnetRange;
      const pull = globalRecovery
        ? 2250
        : trappedBelowPlatform
        ? 1500 + (1 - distance / activeRange) * 500
        : (1 - distance / activeRange) * 850;
      coin.vx += dx / Math.max(distance, 1) * pull * dt;
      coin.vy += dy / Math.max(distance, 1) * pull * dt;
    }
    coin.x += coin.vx * dt;
    coin.y += coin.vy * dt;
    coin.vx *= Math.pow(.35, dt);

    if (coin.vy > 0) {
      const coinRadius = 7;
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
  const playerOnMidBossFloor = player.y > 120 && player.y < 560;
  if (save.opened && player.x > 4140 && playerOnMidBossFloor && !midBoss.dead) midBoss.active = true;
  if (!playerOnMidBossFloor) midBoss.active = false;
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
    const attackPower = getAttackPower();
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
      grantBossSigil("midBoss", "wardenPulse");
      storeSave();
      bossProjectiles.length = 0;
      spawnCoins(midBoss.x + midBoss.w / 2, midBoss.y + midBoss.h / 2, 12);
      shake = 20;
      puff(midBoss.x + 30, midBoss.y + 35, "#b9fff1", 55, 290);
      toast("수문장 격파 · 전용 인장 「수문장의 맥동」 획득", 4200);
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
  if (areaBoss.kind === "moon") {
    grantBossSigil(areaBoss.id, "moonGear", true);
  } else if (areaBoss.kind === "archive") {
    grantBossSigil(areaBoss.id, "archiveCrown");
  } else if (areaBoss.kind === "forge") {
    save.forgeHeart = true;
  }
  storeSave();
  spawnCoins(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2,
    areaBoss.kind === "coast" ? 24 : areaBoss.kind === "forge" ? 20 : 16);
  bossProjectiles.length = 0;
  shake = 24;
  const color = areaBoss.kind === "moon" ? "#f5d77a"
    : areaBoss.kind === "archive" ? "#68dfd0"
      : areaBoss.kind === "forge" ? "#ff7548" : "#8edcff";
  puff(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2, color, 65, 310);
  const messages = {
    moon: "월륜의 파수꾼 격파 · 월륜 톱니와 인장 슬롯 +1 획득",
    archive: "먹빛 사서 격파 · 전용 인장 「기록고의 왕관」 획득",
    forge: "잿불 제련심장 격파 · 용광로 내성 획득 · 별잠 해안의 봉인 해제",
    coast: "별잠 포식자 격파 · 정원 밖의 모든 길이 하나로 이어졌습니다"
  };
  toast(messages[areaBoss.kind], 4600);
  beep(areaBoss.kind === "moon" ? 760 : areaBoss.kind === "forge" ? 310 : 560, .8, "sine", .065);
  if (areaBoss.kind === "coast") setTimeout(win, 1100);
}

function grantBossSigil(rewardId, sigilId, grantsSlot = false) {
  if (!save.ownedSigils.includes(sigilId)) save.ownedSigils.push(sigilId);
  if (grantsSlot && !save.slotRewards.includes(rewardId)) {
    save.slotRewards.push(rewardId);
    save.sigilSlots++;
  }
  const sigil = sigilCatalog[sigilId];
  if (!hasSigil(sigilId) && usedSigilSlots() + sigil.slots <= save.sigilSlots) {
    save.equippedSigils.push(sigilId);
  }
  player.maxHp = getMaxHp();
  player.hp = Math.min(player.maxHp, player.hp + 1);
}

function defeatElite(elite) {
  elite.dead = true;
  elite.active = false;
  if (!save.eliteDefeated.includes(elite.id)) save.eliteDefeated.push(elite.id);
  save.coins += 5;
  player.hp = Math.min(player.maxHp, player.hp + 2);
  storeSave();
  bossProjectiles.length = 0;
  spawnCoins(elite.x + elite.w / 2, elite.y + elite.h / 2, 8);
  shake = 18;
  puff(elite.x + elite.w / 2, elite.y + elite.h / 2, elite.color, 48, 270);
  toast(`${elite.name} 격파 · 수호자의 보물 13 ◈ · 체력 2 회복`, 4200);
  beep(690, .65, "triangle", .06);
}

function updateElites(dt) {
  const hitbox = player.attack > .07 ? attackRect() : null;
  elites.forEach(elite => {
    if (elite.dead) return;
    const distance = Math.hypot(
      player.x + player.w / 2 - (elite.x + elite.w / 2),
      player.y + player.h / 2 - (elite.y + elite.h / 2)
    );
    const sameRegion = getRegionAt(player.x + player.w / 2, player.y + player.h / 2) === elite.region;
    if (sameRegion && distance < 430) elite.active = true;
    if (!sameRegion || distance > 760) elite.active = false;
    if (!elite.active) return;

    elite.hit -= dt;
    elite.cooldown -= dt;
    elite.timer -= dt;
    elite.dir = player.x < elite.x ? -1 : 1;
    elite.vy += 1320 * dt;
    elite.x += elite.vx * dt;
    elite.y += elite.vy * dt;
    const landed = elite.y + elite.h >= elite.groundY && elite.vy > 90;
    if (elite.y + elite.h >= elite.groundY) {
      elite.y = elite.groundY - elite.h;
      elite.vy = 0;
    }
    elite.x = clamp(elite.x, elite.bounds[0], elite.bounds[1]);

    if (elite.action === "charge") {
      elite.vx = elite.dir * 325;
      if (elite.timer <= 0) {
        elite.action = "idle";
        elite.cooldown = .55;
      }
    } else if (elite.action === "leap") {
      elite.vx = elite.dir * 115;
      if (landed && elite.timer < 1.05) {
        spawnGroundWavesAt(elite.x + elite.w / 2, elite.groundY, elite.color);
        elite.action = "idle";
        elite.cooldown = .7;
      }
    } else if (elite.action === "cast") {
      elite.vx *= Math.pow(.03, dt);
      if (elite.timer <= 0) {
        elite.action = "idle";
        elite.cooldown = .65;
      }
    } else {
      elite.vx *= Math.pow(.02, dt);
      if (elite.cooldown <= 0) {
        elite.cycle++;
        if (elite.cycle % 3 === 1) {
          elite.action = "charge";
          elite.timer = .55;
          beep(150, .12, "sawtooth", .035);
        } else if (elite.cycle % 3 === 2) {
          elite.action = "leap";
          elite.timer = 1.45;
          elite.vy = -500;
        } else {
          elite.action = "cast";
          elite.timer = .72;
          fireAimedVolley(elite, elite.hp <= elite.maxHp / 2 ? 5 : 3,
            elite.hp <= elite.maxHp / 2 ? .95 : .55, 245, elite.color);
          puff(elite.x + elite.w / 2, elite.y + 22, elite.color, 12, 125);
        }
      }
    }

    if (hitbox && overlap(hitbox, elite) && elite.lastAttack !== player.attackId) {
      elite.lastAttack = player.attackId;
      elite.hp -= getAttackPower();
      elite.hit = .16;
      elite.vx += player.dir * 68;
      bounceFromDownwardHit(elite);
      shake = 6;
      puff(elite.x + elite.w / 2, elite.y + elite.h / 2, elite.color, 11, 165);
      if (elite.hp <= 0) defeatElite(elite);
    }
    if (overlap(player, elite)) hurt(1, elite.x + elite.w / 2);
  });
}

function updateAreaBosses(dt) {
  const hitbox = player.attack > .07 ? attackRect() : null;
  areaBosses.forEach(areaBoss => {
    if (areaBoss.dead) return;
    const insideRegion = areaBoss.kind === "moon"
      ? player.y < -920 && player.x > 6500
      : areaBoss.kind === "archive"
        ? player.y > 1800 && player.x > 6200 && player.x < 7050
        : areaBoss.kind === "forge"
          ? save.resonance && player.y < 600 && player.x > 10000
          : save.forgeHeart && player.y > 980 && player.x > 11500;
    if (insideRegion) areaBoss.active = true;
    else areaBoss.active = false;
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
        areaBoss.x = clamp(areaBoss.x, 6500, 7180);
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
      const groundY = areaBoss.groundY || (areaBoss.kind === "forge" ? FLOOR : 1190);
      const bounds = areaBoss.bounds || (areaBoss.kind === "archive"
        ? [4420, 5080]
        : areaBoss.kind === "forge"
          ? [7040, 7540]
          : [7820, 8480]);
      const attackColor = areaBoss.kind === "archive" ? "#69d8ca"
        : areaBoss.kind === "forge" ? "#ff7548" : "#86d7ff";
      areaBoss.vy += 1280 * dt;
      areaBoss.x += areaBoss.vx * dt;
      areaBoss.y += areaBoss.vy * dt;
      const landed = areaBoss.y + areaBoss.h >= groundY && areaBoss.vy > 80;
      if (areaBoss.y + areaBoss.h >= groundY) {
        areaBoss.y = groundY - areaBoss.h;
        areaBoss.vy = 0;
      }
      areaBoss.x = clamp(areaBoss.x, bounds[0], bounds[1]);

      if (areaBoss.action === "charge") {
        areaBoss.vx = areaBoss.dir * 310;
        if (areaBoss.timer <= 0) {
          areaBoss.action = "idle";
          areaBoss.cooldown = .65;
        }
      } else if (areaBoss.action === "leap") {
        areaBoss.vx = areaBoss.dir * 105;
        if (landed && areaBoss.timer < 1.15) {
          spawnGroundWavesAt(areaBoss.x + areaBoss.w / 2, groundY, attackColor);
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
            fireAimedVolley(areaBoss, areaBoss.kind === "coast" ? 6 : 4,
              areaBoss.kind === "coast" ? 1.05 : .75,
              areaBoss.kind === "forge" ? 270 : 230, attackColor);
            areaBoss.cooldown = .9;
          }
        }
      }
    }

    if (hitbox && overlap(hitbox, areaBoss) && areaBoss.lastAttack !== player.attackId) {
      const attackPower = getAttackPower();
      areaBoss.lastAttack = player.attackId;
      areaBoss.hp -= attackPower;
      areaBoss.hit = .17;
      areaBoss.x += player.dir * 34;
      bounceFromDownwardHit(areaBoss);
      shake = 6;
      puff(areaBoss.x + areaBoss.w / 2, areaBoss.y + areaBoss.h / 2,
        areaBoss.kind === "moon" ? "#f4d477"
          : areaBoss.kind === "archive" ? "#67dbcf"
            : areaBoss.kind === "forge" ? "#ff7548" : "#8bdcff", 12, 170);
      if (areaBoss.hp <= 0) defeatAreaBoss(areaBoss);
    }
    if (overlap(player, areaBoss)) hurt(1, areaBoss.x + areaBoss.w / 2);
  });
}

function updateBoss(dt) {
  const insideBellArena = save.shopItems.includes("bellKey")
    && player.x > 5480 && player.y > 100 && player.y < 560;
  if (!boss.dead) boss.active = insideBellArena;
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
    const attackPower = getAttackPower();
    boss.lastAttack = player.attackId; boss.hp -= attackPower; boss.hit = .15; boss.vx += player.dir * 90;
    bounceFromDownwardHit(boss);
    shake = 8; puff(boss.x + boss.w / 2, boss.y + 40, "#d9c7ff", 13, 180);
    if (boss.hp <= 0) {
      boss.dead = true; boss.active = false; boss.vx = 0;
      save.bellBossDefeated = true;
      save.resonance = true;
      if (!save.slotRewards.includes("bellWarden")) {
        save.slotRewards.push("bellWarden");
        save.sigilSlots++;
      }
      storeSave();
      bossProjectiles.length = 0;
      shake = 28; puff(boss.x + 40, boss.y + 50, "#e7fbff", 95, 330);
      toast("심연의 종지기 격파 · 종의 공명과 인장 슬롯 +1 획득 · 오른쪽 문이 열렸습니다", 5200);
      beep(920, .9, "sine", .07);
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
  updateElites(dt);
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
  const region = getRegionAt(player.x + player.w / 2, player.y + player.h / 2);
  const clocktower = region === "clock";
  const bell = region === "bell";
  const forge = region === "forge";
  const coast = region === "coast";
  const archive = region === "archive";
  const palette = clocktower
    ? ["#11152c", "#0c1023", "#070918"]
    : bell
      ? ["#211933", "#151124", "#090812"]
    : forge
      ? ["#351b20", "#1d1118", "#0d0a0f"]
      : coast
        ? ["#132843", "#0b1c33", "#07101f"]
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
      : bell
        ? [`#302345`, `#241a37`, `#171126`][layer]
      : forge
        ? [`#49252a`, `#2f1a21`, `#1b1017`][layer]
        : coast
          ? [`#1a3b59`, `#122d49`, `#0b2038`][layer]
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
      : bell
        ? (m.depth > .5 ? "#d9b8ff" : "#7c689c")
      : forge
        ? (m.depth > .5 ? "#ff9b55" : "#9e4f55")
        : coast
          ? (m.depth > .5 ? "#a7e8ff" : "#6e8fd0")
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

  ctx.save();
  if (clocktower) {
    const moonX = 748 - camera.x * .025;
    const moonY = 105 - camera.y * .02;
    ctx.shadowColor = "#ffe48b";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#e8d889";
    ctx.fillRect(Math.round(moonX - 25), Math.round(moonY - 25), 50, 50);
    ctx.fillStyle = "#11152c";
    ctx.fillRect(Math.round(moonX - 8), Math.round(moonY - 28), 35, 55);
    ctx.shadowBlur = 0;
    for (let x = -40 - (camera.x * .18 % 140); x < W + 80; x += 140) {
      const y = 190 + Math.sin(x * .03) * 30;
      ctx.strokeStyle = "rgba(231,202,104,.22)";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.stroke();
      for (let tooth = 0; tooth < 8; tooth++) {
        const angle = tooth * Math.PI / 4 + time * .08;
        ctx.fillStyle = "rgba(231,202,104,.18)";
        ctx.fillRect(Math.round(x + Math.cos(angle) * 39 - 3), Math.round(y + Math.sin(angle) * 39 - 3), 6, 6);
      }
    }
  } else if (bell) {
    for (let x = -40 - (camera.x * .15 % 180); x < W + 100; x += 180) {
      const length = 105 + Math.abs(Math.sin(x * .03)) * 145;
      ctx.strokeStyle = "rgba(190,157,229,.2)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, length); ctx.stroke();
      ctx.fillStyle = "rgba(137,105,174,.2)";
      ctx.beginPath(); ctx.ellipse(x, length + 22, 27, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(220,190,255,.16)";
      ctx.fillRect(x - 3, length + 42, 6, 14);
    }
  } else if (forge) {
    for (let x = -30 - (camera.x * .2 % 125); x < W + 80; x += 125) {
      const height = 100 + ((x * 7) % 150);
      ctx.fillStyle = "rgba(255,102,54,.08)";
      ctx.fillRect(x, H - height, 45, height);
      ctx.fillStyle = "rgba(255,155,74,.22)";
      ctx.fillRect(x + 8, H - height - 12, 8, 12);
      ctx.fillRect(x + 28, H - height - 20, 7, 20);
    }
    for (let i = 0; i < 25; i++) {
      const x = (i * 91 + time * (18 + i % 4)) % W;
      const y = H - ((i * 53 + time * 34) % H);
      ctx.fillStyle = i % 2 ? "rgba(255,121,63,.45)" : "rgba(255,213,109,.35)";
      ctx.fillRect(Math.round(x), Math.round(y), 3 + i % 3, 3 + i % 3);
    }
  } else if (coast) {
    ctx.fillStyle = "rgba(151,214,255,.13)";
    ctx.fillRect(0, H * .62, W, H * .38);
    ctx.strokeStyle = "rgba(132,210,255,.2)";
    for (let y = H * .65; y < H; y += 34) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * .018 + time + y) * 6);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const x = (i * 113 - camera.x * .04) % W;
      const y = 70 + (i * 67 % 260);
      ctx.fillStyle = `rgba(178,229,255,${.18 + i % 3 * .08})`;
      ctx.fillRect(Math.round(x), y, i % 5 === 0 ? 6 : 3, i % 5 === 0 ? 6 : 3);
    }
  } else if (archive) {
    for (let x = -60 - (camera.x * .12 % 190); x < W + 100; x += 190) {
      const beam = ctx.createLinearGradient(x, 0, x + 110, H);
      beam.addColorStop(0, "rgba(82,224,205,.13)");
      beam.addColorStop(1, "rgba(82,224,205,0)");
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 55, 0); ctx.lineTo(x + 180, H); ctx.lineTo(x + 90, H); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(104,220,207,.18)";
    ctx.lineWidth = 2;
    for (let y = 135; y < H; y += 78) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * .025 + time * 1.3 + y) * 7);
      ctx.stroke();
    }
  } else {
    for (let x = 35 - (camera.x * .16 % 120); x < W; x += 120) {
      const y = 110 + (x * 17 % 210);
      ctx.fillStyle = `rgba(145,223,255,${.08 + Math.sin(time * 2 + x) * .025})`;
      ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      ctx.fillRect(Math.round(x - 5), Math.round(y + 1), 3, 1);
      ctx.fillRect(Math.round(x + 5), Math.round(y + 1), 3, 1);
    }
  }
  ctx.restore();
}

function drawExpandedRegionDetails() {
  ctx.save();

  // 빛의 수관 · 황혼 잎맥 온실
  ctx.fillStyle = "rgba(73,132,102,.12)";
  ctx.fillRect(1720, -1030, 1900, 300);
  for (let x = 1800; x < 3550; x += 180) {
    ctx.strokeStyle = "rgba(137,215,169,.24)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, -740);
    ctx.quadraticCurveTo(x + 65, -1010, x + 140, -740);
    ctx.stroke();
    ctx.fillStyle = "rgba(162,239,184,.17)";
    ctx.beginPath();
    ctx.ellipse(x + 38, -920 + Math.sin(time + x) * 7, 46, 13, -.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(193,244,207,.82)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("황혼 잎맥 온실", 1830, -865);

  // 달빛 시계탑 · 천구의 회랑
  ctx.fillStyle = "rgba(207,181,92,.07)";
  ctx.fillRect(5200, -1370, 2160, 330);
  for (let x = 5360; x < 7240; x += 260) {
    const radius = 44 + (x % 3) * 8;
    ctx.save();
    ctx.translate(x, -1270 + (x % 2) * 70);
    ctx.rotate(time * (x % 520 ? .12 : -.1));
    ctx.strokeStyle = "rgba(241,211,112,.26)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      ctx.fillStyle = "rgba(241,211,112,.2)";
      ctx.fillRect(Math.cos(a) * (radius + 7) - 4, Math.sin(a) * (radius + 7) - 4, 8, 8);
    }
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,230,147,.82)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("천구의 회랑", 5350, -1090);

  // 종루 · 공명의 수직 회랑
  ctx.fillStyle = "rgba(126,88,165,.09)";
  ctx.fillRect(5150, -620, 1120, 1095);
  for (let x = 5260; x < 6200; x += 190) {
    ctx.strokeStyle = "rgba(194,151,230,.2)";
    ctx.lineWidth = 6;
    ctx.strokeRect(x, -570, 92, 1035);
    for (let y = -500; y < 430; y += 145) {
      ctx.beginPath(); ctx.arc(x + 46, y, 28, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(220,185,249,.78)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("공명의 수직 회랑", 5290, -325);

  // 가라앉은 뿌리 · 공허한 하층림
  ctx.fillStyle = "rgba(91,54,116,.11)";
  ctx.fillRect(430, 620, 1880, 500);
  for (let x = 520; x < 2260; x += 130) {
    ctx.strokeStyle = x % 260 ? "rgba(157,103,190,.23)" : "rgba(77,179,154,.22)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, 620);
    ctx.bezierCurveTo(x + 70, 760, x - 55, 880, x + 25, 1060);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(207,159,232,.78)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("공허한 하층림", 600, 925);

  // 침수된 기록고 · 심층 서고
  ctx.fillStyle = "rgba(35,157,153,.1)";
  ctx.fillRect(2920, 1740, 4140, 590);
  for (let x = 3100; x < 6950; x += 250) {
    ctx.strokeStyle = "rgba(96,211,203,.22)";
    ctx.lineWidth = 9;
    ctx.strokeRect(x, 1770, 135, 270);
    for (let y = 1810; y < 2020; y += 45) {
      ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 125, y); ctx.stroke();
    }
  }
  for (let y = 2100; y < 2300; y += 38) {
    ctx.strokeStyle = "rgba(103,224,213,.17)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 2950; x < 7040; x += 35) ctx.lineTo(x, y + Math.sin(x * .02 + time) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(130,235,225,.82)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("가장 깊은 서고", 3150, 2015);

  // 잿빛 제련소 · 대제련장
  ctx.fillStyle = "rgba(255,85,37,.085)";
  ctx.fillRect(7820, 80, 3260, 470);
  for (let x = 7950; x < 10950; x += 230) {
    ctx.strokeStyle = "rgba(246,111,62,.27)";
    ctx.lineWidth = 8;
    ctx.strokeRect(x, 120, 84, 355);
    ctx.beginPath(); ctx.arc(x + 42, 235, 32, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,174,78,${.12 + Math.sin(time * 4 + x) * .04})`;
    ctx.fillRect(x + 16, 300, 52, 175);
  }
  ctx.fillStyle = "rgba(255,158,98,.85)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("대제련장", 8000, 445);

  // 별잠 해안 · 별무덤 방파제
  ctx.fillStyle = "rgba(80,164,216,.1)";
  ctx.fillRect(8620, 900, 3780, 480);
  for (let x = 8760; x < 12250; x += 310) {
    ctx.strokeStyle = "rgba(129,207,246,.2)";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, 1190); ctx.lineTo(x + 45, 920); ctx.lineTo(x + 90, 1190); ctx.stroke();
    ctx.fillStyle = "rgba(202,239,255,.22)";
    ctx.fillRect(x + 40, 918, 10, 10);
  }
  for (let y = 1225; y < 1370; y += 34) {
    ctx.strokeStyle = "rgba(118,200,245,.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 8640; x < 12400; x += 30) ctx.lineTo(x, y + Math.sin(x * .018 + time * 1.1) * 7);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(177,227,255,.84)";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("별무덤 방파제", 8840, 1160);
  ctx.restore();
}

function drawWorld() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawExpandedRegionDetails();

  // distant bells and plants
  for (let x = 180; x < 6200; x += 430) {
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
  ctx.arc(4800, -1260, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(4800 + Math.cos(angle) * 126, -1260 + Math.sin(angle) * 126);
    ctx.lineTo(4800 + Math.cos(angle) * 145, -1260 + Math.sin(angle) * 145);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(4800, -1260);
  ctx.lineTo(4800 + Math.cos(time * .18) * 92, -1260 + Math.sin(time * .18) * 92);
  ctx.moveTo(4800, -1260);
  ctx.lineTo(4800 + Math.cos(-time * .35) * 64, -1260 + Math.sin(-time * .35) * 64);
  ctx.stroke();
  for (let x = 4400; x <= 5100; x += 175) {
    ctx.beginPath();
    ctx.moveTo(x, -1370);
    ctx.lineTo(x, -1060);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,229,150,.78)";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("달빛 시계탑", 4400, -1100);
  ctx.fillStyle = "rgba(255,236,178,.62)";
  ctx.font = "15px system-ui";
  ctx.fillText("수관 너머, 멈춘 달의 시간이 흐르는 곳", 4400, -1080);
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

  // ashen forge
  ctx.save();
  ctx.fillStyle = "rgba(255,93,45,.08)";
  ctx.fillRect(6180, 120, 1660, 430);
  ctx.strokeStyle = "rgba(255,119,65,.3)";
  ctx.lineWidth = 7;
  for (let x = 6280; x < 7780; x += 190) {
    ctx.strokeRect(x, 170, 72, 305);
    ctx.beginPath();
    ctx.moveTo(x + 36, 170);
    ctx.lineTo(x + 36, 115 + Math.sin(time * 2 + x) * 12);
    ctx.stroke();
  }
  for (let i = 0; i < 34; i++) {
    const emberX = 6200 + (i * 89) % 1580;
    const emberY = 440 - ((i * 37 + time * (28 + i % 5)) % 310);
    ctx.fillStyle = i % 3 ? "rgba(255,111,53,.55)" : "rgba(255,215,111,.65)";
    ctx.fillRect(emberX, emberY, 3 + i % 3, 3 + i % 3);
  }
  ctx.fillStyle = "rgba(255,154,91,.86)";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("잿빛 제련소", 6250, 455);
  ctx.fillStyle = "rgba(244,179,140,.68)";
  ctx.font = "15px system-ui";
  ctx.fillText("종의 금속을 녹이던 불씨가 아직 숨 쉬는 곳", 6250, 473);
  ctx.restore();

  // sleeping coast and the archive loop
  ctx.save();
  ctx.fillStyle = "rgba(90,169,226,.09)";
  ctx.fillRect(5200, 990, 3400, 460);
  ctx.strokeStyle = "rgba(135,211,255,.24)";
  ctx.lineWidth = 2;
  for (let y = 1225; y < 1430; y += 38) {
    ctx.beginPath();
    for (let x = 5200; x <= 8600; x += 34) ctx.lineTo(x, y + Math.sin(x * .018 + time * 1.1 + y) * 7);
    ctx.stroke();
  }
  for (let i = 0; i < 30; i++) {
    const starX = 5260 + (i * 127) % 3260;
    const starY = 1000 + (i * 61) % 170 + Math.sin(time * .7 + i) * 10;
    ctx.fillStyle = i % 4 ? "rgba(154,220,255,.38)" : "rgba(235,245,255,.7)";
    ctx.fillRect(starX, starY, 4, 4);
    if (i % 4 === 0) {
      ctx.fillRect(starX - 4, starY + 1, 3, 2);
      ctx.fillRect(starX + 5, starY + 1, 3, 2);
    }
  }
  ctx.fillStyle = "rgba(169,224,255,.88)";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("별잠 해안", 7750, 1160);
  ctx.fillStyle = "rgba(179,215,239,.7)";
  ctx.font = "15px system-ui";
  ctx.fillText("잠든 별이 밀려오고, 기록고로 되돌아가는 바닷길", 7750, 1179);
  ctx.fillStyle = "rgba(129,211,207,.72)";
  ctx.fillText("← 침수된 기록고로 이어지는 순환 통로", 5350, 1160);
  ctx.restore();

  // layered ornaments: luminous garden, canopy, roots, gears and drifting records
  ctx.save();
  for (let x = 140; x < 6100; x += 185) {
    const groundY = supportTopAt(x, FLOOR);
    if (groundY < 300 || groundY > 500) continue;
    const sway = Math.sin(time * 1.7 + x * .013) * 5;
    const hue = Math.floor(x / 185) % 3;
    ctx.strokeStyle = hue === 0 ? "#4c8b79" : hue === 1 ? "#596f94" : "#6c5f8d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.quadraticCurveTo(x + sway, groundY - 18, x + sway * .6, groundY - 34);
    ctx.stroke();
    ctx.fillStyle = hue === 0 ? "#91efca" : hue === 1 ? "#9cdcff" : "#d0a8ff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    for (let petal = 0; petal < 4; petal++) {
      const angle = petal * Math.PI / 2 + time * .08;
      ctx.beginPath();
      ctx.ellipse(x + sway * .6 + Math.cos(angle) * 6, groundY - 34 + Math.sin(angle) * 6, 4, 2.5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;

  for (let x = 3280; x <= 3650; x += 62) {
    const leafY = 250 - ((x - 3280) % 310);
    ctx.fillStyle = `rgba(118,210,164,${.22 + (x % 3) * .08})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(time + x) * 7, leafY, 18, 7, -.55, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let x = 2390; x <= 3600; x += 90) {
    for (let i = 0; i < 3; i++) {
      const rootY = 650 + ((x * .7 + i * 83) % 270);
      ctx.fillStyle = i % 2 ? "rgba(181,120,214,.28)" : "rgba(96,190,173,.25)";
      ctx.beginPath();
      ctx.arc(x + Math.sin(time * .8 + i) * 8, rootY + Math.sin(time * 1.3 + x) * 5, 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const decorativeGears = [
    [4470, -1280, 42], [4610, -1135, 30], [5000, -1295, 48], [5110, -1145, 27]
  ];
  decorativeGears.forEach(([gearX, gearY, radius], index) => {
    ctx.save();
    ctx.translate(gearX, gearY);
    ctx.rotate(time * (index % 2 ? -.18 : .14));
    ctx.strokeStyle = "rgba(242,211,116,.32)";
    ctx.lineWidth = 4;
    for (let tooth = 0; tooth < 10; tooth++) {
      const angle = tooth * Math.PI / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.arc(0, 0, radius * .38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  for (let i = 0; i < 16; i++) {
    const pageX = 4020 + (i * 83) % 1110;
    const pageY = 970 + (i * 47) % 180 + Math.sin(time * .7 + i) * 11;
    ctx.save();
    ctx.translate(pageX, pageY);
    ctx.rotate(Math.sin(time * .9 + i) * .35);
    ctx.fillStyle = i % 2 ? "rgba(167,229,218,.2)" : "rgba(198,211,188,.18)";
    ctx.fillRect(-8, -5, 16, 10);
    ctx.strokeStyle = "rgba(128,215,207,.28)";
    ctx.beginPath();
    ctx.moveTo(-5, -1); ctx.lineTo(5, -1);
    ctx.moveTo(-5, 2); ctx.lineTo(3, 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  platforms.forEach(p => {
    const platformRegion = getRegionAt(p.x + p.w / 2, p.y - 2);
    const colors = {
      garden: ["#172333", "#213046", "#344a5e", "#213448"],
      canopy: ["#173128", "#26483b", "#66b58a", "#244d3d"],
      roots: ["#251b31", "#3c2b4b", "#9b68b8", "#4c315b"],
      clock: ["#1c2138", "#34364c", "#c6a95d", "#58506d"],
      bell: ["#241a34", "#3d2b51", "#aa82cf", "#563c6d"],
      archive: ["#102b31", "#21454a", "#4ca89f", "#183c43"],
      forge: ["#2d1b1c", "#51302b", "#e76f3f", "#6b3027"],
      coast: ["#142d43", "#264b65", "#6fbde3", "#1a3c58"]
    }[platformRegion];
    ctx.fillStyle = p.h > 50 ? colors[0] : colors[1];
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = colors[2];
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.strokeStyle = colors[3];
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
    const nearCheckpoint = Math.abs(player.x - cp.x) < 64
      && Math.abs(player.y + player.h - cp.y) < 72;
    if (nearCheckpoint) {
      ctx.fillStyle = "rgba(5,9,18,.86)";
      ctx.fillRect(cp.x - 86, cp.y - 104, 172, 30);
      ctx.fillStyle = "#d9f7ff";
      ctx.font = "bold 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("↓ 휴식 · 체력 회복", cp.x, cp.y - 83);
      ctx.textAlign = "left";
    }
  });

  landmarks.forEach((landmark, index) => {
    const discovered = save.discoveries.includes(landmark.id);
    const near = Math.abs(player.x + player.w / 2 - landmark.x) < 58
      && Math.abs(player.y + player.h - landmark.y) < 78;
    ctx.save();
    ctx.translate(landmark.x, landmark.y);
    ctx.shadowColor = discovered ? "#5f8195" : "#bdefff";
    ctx.shadowBlur = discovered ? 6 : 17 + Math.sin(time * 2.4 + index) * 4;
    ctx.fillStyle = discovered ? "#253442" : "#36536a";
    ctx.fillRect(-13, -39, 26, 39);
    ctx.fillStyle = discovered ? "#658092" : "#c9f4ff";
    ctx.fillRect(-7, -31, 14, 3);
    ctx.fillRect(-7, -22, 10, 3);
    ctx.fillRect(-7, -13, 14, 3);
    ctx.restore();
    if (near) {
      ctx.fillStyle = "rgba(5,9,18,.9)";
      ctx.fillRect(landmark.x - 104, landmark.y - 88, 208, 32);
      ctx.fillStyle = discovered ? "#a8becd" : "#d9f8ff";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`↓ ${discovered ? "기록 다시 읽기" : "탐험 기록 발견 · 3 ◈"}`, landmark.x, landmark.y - 66);
      ctx.textAlign = "left";
    }
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

  if (!save.resonance) {
    ctx.fillStyle = "#17152a";
    ctx.fillRect(6190, 130, 40, 345);
    ctx.strokeStyle = "#a88cff";
    ctx.lineWidth = 3;
    for (let y = 160; y < 455; y += 52) {
      ctx.beginPath();
      ctx.arc(6210, y, 12 + Math.sin(time * 3 + y) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (!save.forgeHeart) {
    [[7400, 500, 520, 690], [5880, 960, 40, 230]].forEach(([x, y, w, h]) => {
      ctx.fillStyle = "#321b18";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#ff7548";
      ctx.lineWidth = 3;
      for (let fy = y + 18; fy < y + h - 8; fy += 38) {
        ctx.beginPath();
        ctx.moveTo(x + 7, fy + 16);
        ctx.quadraticCurveTo(x + w / 2, fy - 12 + Math.sin(time * 6 + fy) * 5, x + w - 7, fy + 16);
        ctx.stroke();
      }
    });
  }

  // regional sigil merchants
  vendors.forEach((vendor, index) => {
    ctx.save();
    ctx.translate(vendor.x + vendor.w / 2, vendor.y + vendor.h / 2);
    ctx.shadowColor = vendor.color;
    ctx.shadowBlur = 13 + Math.sin(time * 3 + index) * 3;
    ctx.fillStyle = index === 0 ? "#42354b" : index === 1 ? "#403825" : "#173d42";
    ctx.fillRect(-17, -4, 34, 29);
    ctx.fillStyle = index === 0 ? "#d9c9b1" : index === 1 ? "#d9c47f" : "#92d6ca";
    ctx.fillRect(-10, -21, 20, 18);
    ctx.fillStyle = vendor.color;
    ctx.fillRect(-3, -15, 3, 3);
    ctx.fillRect(4, -15, 3, 3);
    ctx.strokeStyle = vendor.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (index === 0) {
      ctx.moveTo(-14, -22); ctx.quadraticCurveTo(0, -36, 16, -21);
    } else if (index === 1) {
      ctx.arc(0, -18, 18, Math.PI, 0);
      for (let tooth = -12; tooth <= 12; tooth += 8) ctx.rect(tooth, -36, 4, 6);
    } else {
      ctx.moveTo(-17, -28); ctx.lineTo(0, -36); ctx.lineTo(17, -28);
      ctx.moveTo(-13, 18); ctx.quadraticCurveTo(0, 29, 13, 18);
    }
    ctx.stroke();
    ctx.restore();
    const nearVendor = Math.abs(player.x + player.w / 2 - (vendor.x + vendor.w / 2)) < 72
      && Math.abs(player.y + player.h / 2 - (vendor.y + vendor.h / 2)) < 82;
    if (nearVendor) {
      ctx.fillStyle = "rgba(7,10,18,.88)";
      ctx.fillRect(vendor.x - 66, vendor.y - 43, 170, 30);
      ctx.fillStyle = vendor.color;
      ctx.font = "bold 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("↓ 인장 상점 열기", vendor.x + 18, vendor.y - 22);
      ctx.textAlign = "left";
    }
  });

  enemies.forEach(drawEnemy);
  if (midBoss && !midBoss.dead) drawMidBoss();
  elites.forEach(drawElite);
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
    if (coin.recovering) {
      ctx.globalAlpha = .55;
      ctx.beginPath();
      ctx.arc(0, 0, 12 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
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
    ctx.fillStyle = p.color;
    const size = Math.max(2, Math.round(p.r * 1.6));
    ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemy(e) {
  if (e.dead) return;
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.action === "bite") {
    const lunging = e.timer <= .22;
    ctx.scale(lunging ? 1.28 : .86, lunging ? .8 : 1.18);
    ctx.rotate(e.dir * (lunging ? .12 : -.08));
  } else if (e.action === "dive") {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.scale(1.3, .76);
  } else if (e.action === "cast") {
    const pulse = 1 + Math.sin(time * 24) * .09;
    ctx.scale(pulse, pulse);
  } else if (e.action === "lunge") {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.scale(1.25, .78);
  }
  if (e.hit > 0) ctx.globalAlpha = .55;
  ctx.fillStyle = e.type === "clockwork" ? "#6d5c3c"
    : e.type === "inkling" ? "#174b50"
      : e.type === "emberling" ? "#6d2d25"
        : e.type === "starling" ? "#294b73"
          : e.type === "flyer" ? "#6f6b91" : "#45586a";
  ctx.beginPath(); ctx.ellipse(0, 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  if (e.type === "flyer" || e.type === "starling") {
    ctx.fillStyle = e.type === "starling" ? "#3e75a0" : "#363b59";
    const wingTilt = e.action === "dive" ? .12 : .4;
    ctx.beginPath();
    ctx.ellipse(-18, -2, 15, 7, -wingTilt, 0, Math.PI * 2);
    ctx.ellipse(18, -2, 15, 7, wingTilt, 0, Math.PI * 2);
    ctx.fill();
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
    if (e.action === "cast") {
      ctx.strokeStyle = "rgba(255,232,143,.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, 30 + Math.sin(time * 20) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  } else if (e.type === "emberling") {
    ctx.fillStyle = "#ff7548";
    ctx.shadowColor = "#ff5b35";
    ctx.shadowBlur = 13;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8 - 5, -10);
      ctx.lineTo(i * 8, -25 - Math.sin(time * 9 + i) * 5);
      ctx.lineTo(i * 8 + 6, -9);
      ctx.fill();
    }
    if (e.action === "bite") {
      ctx.fillStyle = "#2a1010";
      ctx.fillRect(e.dir * 12 - 5, -3, 16, 13);
    }
  } else if (e.action === "bite") {
    ctx.fillStyle = "#172535";
    ctx.beginPath();
    ctx.moveTo(e.dir * 11, 2);
    ctx.lineTo(e.dir * 22, -7);
    ctx.lineTo(e.dir * 22, 11);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = e.type === "clockwork" ? "#fff0a9"
    : e.type === "inkling" ? "#9ffff1"
      : e.type === "emberling" ? "#ffe09a"
        : e.type === "starling" ? "#f1fbff" : "#aeeaff";
  ctx.shadowColor = e.type === "clockwork" ? "#e4bc45"
    : e.type === "inkling" ? "#57d9ce"
      : e.type === "emberling" ? "#ff643c" : "#86dfff";
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(e.dir * 7, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.shadowBlur = 0;
}

function drawElite(elite) {
  if (elite.dead) return;
  ctx.save();
  ctx.translate(elite.x + elite.w / 2, elite.y + elite.h / 2);
  ctx.scale(elite.dir, 1);
  if (elite.hit > 0) ctx.globalAlpha = .5;
  if (elite.action === "charge") ctx.scale(1.2, .82);
  if (elite.action === "leap") ctx.rotate(elite.dir * .12);
  ctx.shadowColor = elite.color;
  ctx.shadowBlur = elite.active ? 24 : 10;
  ctx.fillStyle = "#172031";
  ctx.beginPath();
  ctx.ellipse(0, 6, 27, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = elite.color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = elite.color;
  ctx.fillRect(-18, -17, 36, 8);
  ctx.fillRect(-23, 13, 46, 6);
  ctx.fillStyle = "#edfaff";
  ctx.fillRect(elite.dir * 7 - 2, -8, 5, 5);
  ctx.strokeStyle = elite.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3 + time * .35;
    ctx.moveTo(Math.cos(angle) * 27, Math.sin(angle) * 31 + 5);
    ctx.lineTo(Math.cos(angle) * 38, Math.sin(angle) * 42 + 5);
  }
  ctx.stroke();
  if (elite.action === "cast") {
    ctx.globalAlpha = .65;
    ctx.beginPath();
    ctx.arc(0, 4, 43 + Math.sin(time * 18) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
  } else if (areaBoss.kind === "archive") {
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
  } else if (areaBoss.kind === "forge") {
    ctx.shadowColor = "#ff673c";
    ctx.shadowBlur = areaBoss.action === "leap" ? 32 : 19;
    ctx.fillStyle = "#4c211f";
    ctx.fillRect(-36, -30, 72, 70);
    ctx.strokeStyle = "#ff7548";
    ctx.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + time * .7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 29, Math.sin(angle) * 29);
      ctx.lineTo(Math.cos(angle) * 44, Math.sin(angle) * 44);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff9a55";
    ctx.beginPath();
    ctx.arc(0, 1, 22 + Math.sin(time * 8) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0ad";
    ctx.fillRect(-7, -5, 14, 12);
  } else {
    ctx.shadowColor = "#87dfff";
    ctx.shadowBlur = areaBoss.action === "charge" ? 30 : 18;
    ctx.fillStyle = "#1c3b61";
    ctx.beginPath();
    ctx.ellipse(0, 8, 40, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9ee5ff";
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + time * (i % 2 ? -.4 : .4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 27, Math.sin(angle) * 35);
      ctx.lineTo(Math.cos(angle) * 48, Math.sin(angle) * 56);
      ctx.stroke();
    }
    ctx.fillStyle = "#e8f8ff";
    ctx.beginPath();
    ctx.arc(-10, -9, 5, 0, Math.PI * 2);
    ctx.arc(10, -9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#79c8f2";
    ctx.fillRect(-18, 15, 36, 8);
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
  save.equippedSigils.slice(0, 8).forEach((id, index, equipped) => {
    const angle = time * (1.25 + index % 2 * .22) + index * Math.PI * 2 / equipped.length;
    const radius = 28 + (index % 2) * 7;
    const sigil = sigilCatalog[id];
    const sx = Math.round(Math.cos(angle) * radius);
    const sy = Math.round(Math.sin(angle) * 15);
    ctx.globalAlpha = .75;
    ctx.shadowColor = sigil.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = sigil.color;
    ctx.fillRect(sx - 2, sy - 2, 5, 5);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
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
    const sigilReach = sigilStats().reach;
    ctx.strokeStyle = improved ? "#ffe2a0" : "#dff9ff";
    ctx.shadowColor = improved ? "#ffbd55" : "#8cecff";
    ctx.shadowBlur = 12; ctx.lineWidth = improved ? 6 : 5;
    ctx.beginPath();
    if (player.attackDir === "up") {
      ctx.arc(0, -8, (improved ? 42 : 36) + sigilReach * .45, Math.PI * (1.08 + t * .18), Math.PI * (1.92 + t * .18));
    } else if (player.attackDir === "down") {
      ctx.arc(0, 10, (improved ? 42 : 36) + sigilReach * .45, Math.PI * (.08 + t * .18), Math.PI * (.92 + t * .18));
    } else {
      ctx.arc(9, 1, (improved ? 40 : 34) + sigilReach * .45, -1.4 + t * .7, .8 + t * .7);
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

  const regionNames = {
    garden: "정원", canopy: "빛의 수관", clock: "달빛 시계탑", bell: "종루",
    forge: "잿빛 제련소", coast: "별잠 해안", archive: "침수된 기록고", roots: "가라앉은 뿌리"
  };
  const room = regionNames[getRegionAt(player.x + player.w / 2, player.y + player.h / 2)];
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(225,239,250,.82)"; ctx.font = "bold 16px Georgia, serif"; ctx.fillText(room, W / 2, 32);
  const explored = save.echoes.length + save.shopItems.length
    + save.areaBosses.length + (save.dash ? 1 : 0) + (save.midBossDefeated ? 1 : 0)
    + (save.bellBossDefeated ? 1 : 0) + (save.forgeHeart ? 1 : 0)
    + save.eliteDefeated.length + save.discoveries.length;
  ctx.font = "13px system-ui";
  ctx.fillStyle = "rgba(177,200,219,.72)";
  ctx.fillText(`세계 탐색도 ${Math.min(100, Math.round(explored / 38 * 100))}%`, W / 2, 51);

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
  const activeElite = elites.find(elite => elite.active && !elite.dead);
  const activeBoss = boss?.active && !boss.dead
    ? boss
    : midBoss?.active && !midBoss.dead
      ? midBoss
      : activeAreaBoss || activeElite || null;
  if (activeBoss) {
    const bw = 360, x = (W - bw) / 2, y = H - 32;
    ctx.fillStyle = "#141827"; ctx.fillRect(x, y, bw, 7);
    ctx.fillStyle = activeBoss === boss
      ? "#c58dea"
      : activeBoss === activeElite
        ? activeElite.color
      : activeBoss.kind === "moon"
        ? "#e6c75f"
        : activeBoss.kind === "forge"
          ? "#ef7045"
          : activeBoss.kind === "coast"
            ? "#82d9ff" : "#70d5cd";
    ctx.fillRect(x, y, bw * activeBoss.hp / activeBoss.maxHp, 7);
    ctx.fillStyle = "#d9d4ea"; ctx.font = "bold 14px system-ui";
    ctx.fillText(activeBoss === boss ? "심연의 종지기"
      : activeBoss === midBoss ? "청록 수문장" : activeBoss.name, W / 2, y - 7);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(5,9,18,.72)";
  ctx.fillRect(W - 181, 66, 157, 32);
  ctx.font = "bold 14px system-ui";
  ctx.fillStyle = usedSigilSlots() ? "#ffdc91" : "#718096";
  ctx.fillText(`인장  ${usedSigilSlots()} / ${save.sigilSlots}  ·  I`, W - 36, 88);
  ctx.restore();
}

function drawScreenAtmosphere() {
  const region = getRegionAt(player.x + player.w / 2, player.y + player.h / 2);
  const clocktower = region === "clock";
  const forge = region === "forge";
  const coast = region === "coast";
  const archive = region === "archive";
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const seed = i * 73.17;
    if (clocktower) {
      const x = (seed * 7 + time * (12 + i % 4) - camera.x * .03) % (W + 30) - 15;
      const y = (seed * 3.1 + Math.sin(time + i) * 18) % H;
      ctx.globalAlpha = .18 + (i % 3) * .08;
      ctx.fillStyle = i % 3 ? "#f1d471" : "#a99be2";
      ctx.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 5 : 3, i % 5 === 0 ? 5 : 3);
    } else if (forge) {
      const x = (seed * 5.7 + time * (18 + i % 5)) % W;
      const y = H - ((seed * 2.6 + time * (35 + i % 7)) % H);
      ctx.globalAlpha = .16 + (i % 4) * .05;
      ctx.fillStyle = i % 3 ? "#ff7044" : "#ffd17a";
      ctx.fillRect(Math.round(x), Math.round(y), 3 + i % 3, 3 + i % 3);
    } else if (coast) {
      const x = (seed * 6.1 - camera.x * .025) % W;
      const y = 40 + (seed * 2.1 + Math.sin(time * .7 + i) * 22) % (H - 80);
      ctx.globalAlpha = .13 + (i % 5) * .04;
      ctx.fillStyle = i % 4 ? "#85ccf5" : "#edfaff";
      ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 3 : 6, i % 4 ? 3 : 6);
    } else if (archive) {
      const x = (seed * 5.3 + Math.sin(time * .8 + i) * 30) % W;
      const y = H - ((seed * 2.4 + time * (22 + i % 6)) % (H + 20));
      ctx.globalAlpha = .12 + (i % 4) * .05;
      ctx.strokeStyle = i % 2 ? "#7ce5d7" : "#69aace";
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(x), Math.round(y), 3 + i % 5, 3 + i % 5);
    } else {
      const x = (seed * 4.9 + Math.sin(time * .45 + i) * 24 - camera.x * .02) % W;
      const y = (seed * 2.8 + time * (7 + i % 3)) % H;
      ctx.globalAlpha = .1 + (i % 5) * .035;
      ctx.fillStyle = i % 3 ? "#8ed9c6" : "#93c8ff";
      ctx.fillRect(Math.round(x), Math.round(y), 4 + i % 3, 2 + i % 2);
      if (i % 4 === 0) ctx.fillRect(Math.round(x + 3), Math.round(y - 2), 2, 2);
    }
  }
  ctx.restore();
}

function drawPixelFinish() {
  ctx.save();
  ctx.globalAlpha = .055;
  ctx.fillStyle = "#a8d8ff";
  for (let y = 1; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = .16;
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, W * .64);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,12,.95)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = .18;
  const edgeColors = {
    garden: "#709bc7", canopy: "#68bd8d", roots: "#a36abe", clock: "#dbc76c",
    bell: "#b58bdb", forge: "#e26d42", coast: "#70bce5", archive: "#54c9bd"
  };
  ctx.strokeStyle = edgeColors[getRegionAt(player.x + player.w / 2, player.y + player.h / 2)];
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  [[10, 10], [W - 18, 10], [10, H - 18], [W - 18, H - 18]].forEach(([x, y]) => ctx.fillRect(x, y, 8, 8));
  ctx.restore();
}

function render() {
  ctx.save();
  if (shake > .2) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBackground(); drawWorld(); drawScreenAtmosphere(); drawHUD();
  if (player.respawning > 0) {
    ctx.fillStyle = `rgba(2,4,9,${clamp(player.respawning, 0, .75)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  drawPixelFinish();
}

function win() {
  running = false;
  switchMusicTrack("");
  save.endingSeen = true;
  storeSave();
  const completeGarden = save.echoes.length === echoes.length
    && save.shopItems.length === 4
    && save.midBossDefeated
    && save.areaBosses.length === areaBosses.length
    && save.eliteDefeated.length === eliteDefs.length
    && save.discoveries.length === landmarks.length;
  const endingTitle = completeGarden ? "모든 세계가 하나로 이어졌습니다" : "별잠 해안이 깨어났습니다";
  const endingText = completeGarden
    ? "정원과 시계탑, 기록고, 제련소와 해안이<br>하나의 거대한 순환로로 다시 숨을 쉽니다."
    : "정원 밖의 바닷길이 열렸습니다.<br>아직 만나지 못한 수호자와 지름길이 남아 있습니다.";
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="title-mark">✦</div><p class="kicker">${completeGarden ? "탐색도 100% · 순환의 결말" : "새로운 길은 닫히지 않습니다"}</p><h2>${endingTitle}</h2><p>${endingText}</p><button type="button">계속 탐험하기</button>`;
  document.querySelector(".frame").append(overlay);
  overlay.querySelector("button").addEventListener("click", () => {
    overlay.remove();
    running = true;
    last = performance.now();
    updateMusic(true);
    startGameLoop();
  });
  beep(920, 1.2, "sine", .07);
}

function loop(now, generation) {
  animationFrameId = 0;
  if (!running || paused || generation !== loopGeneration) return;
  const dt = Math.min((now - last) / 1000, .033);
  last = now;
  if (!shopOpen && !inventoryOpen) update(dt);
  else taps.clear();
  updateMusic();
  render();
  animationFrameId = requestAnimationFrame(nextNow => loop(nextNow, generation));
}

render();
