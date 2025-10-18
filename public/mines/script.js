// Mines script.js - Updated (Cash Out & Back Home fixes)

const BOARD_WIDTH = 5;
const BOARD_HEIGHT = 5;
const TOTAL_TILES = BOARD_WIDTH * BOARD_HEIGHT;
const BOARD = document.getElementById('board');

let activeRound = false;

// Gems
let gems = parseFloat(localStorage.getItem('gems') || 0);
const balanceDisplay = document.getElementById('balanceDisplay');
function updateBalanceDisplay() {
  gems = parseFloat(localStorage.getItem('gems') || 0);
  balanceDisplay.textContent = `Gems: ${gems.toFixed(2)}`;
}
window.addEventListener('load', updateBalanceDisplay);
window.addEventListener('focus', updateBalanceDisplay);

// DOM refs
const minesInput = document.getElementById('minesCount');
const wagerInput = document.getElementById('wagerInput');
const newGameBtn = document.getElementById('newGame');
const cashOutBtn = document.getElementById('cashOut');
const roundDisplay = document.getElementById('roundBalance');
const ladderDiv = document.getElementById('multiplierLadder');
const payoutPreview = document.getElementById('payoutPreview');
const seedDisplay = document.getElementById('seedDisplay');
const revealPopup = document.getElementById('revealPopup');
const revealText = document.getElementById('revealText');

const sfxClick = document.getElementById('sfxClick');
const sfxBomb = document.getElementById('sfxBomb');
const sfxCash = document.getElementById('sfxCash');

let state = {
  mines: parseInt(minesInput.value) || 3,
  wager: parseFloat(wagerInput.value) || 1,
  revealed: [],
  bombs: new Set(),
  roundBalance: 0,
  ladder: [],
  safeClicks: 0,
  seed: null,
  forcedSeed: null,
  bombsRevealed: false
};

// --- Seeded RNG ---
function seedToUint(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr) {
  let seed = seedToUint(seedStr) || 1;
  return function () {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed = seed >>> 0;
    return (seed >>> 0) / 4294967296;
  };
}
function genRandomSeed() { return Math.random().toString(36).slice(2, 10); }

// --- Fair multiplier ---
function fairMultiplierForHits(k, totalTiles, bombs) {
  const G = totalTiles - bombs;
  if (k <= 0) return 1;
  let prob = 1;
  for (let i = 0; i < k; i++) {
    prob *= (G - i) / (totalTiles - i);
    if (prob <= 0) { prob = 0; break; }
  }
  if (prob === 0) return 1000;
  return 1 / prob;
}

// Generate ladder
function generateLadder(mines, forcedPayout = 1000) {
  const total = TOTAL_TILES;
  const safeTiles = total - mines;
  let ladder = [];
  for (let i = 1; i <= safeTiles; i++) {
    ladder.push(fairMultiplierForHits(i, total, mines));
  }
  const HOUSE_FACTOR = 0.985;
  ladder = ladder.map(v => v * HOUSE_FACTOR);

  // Clamp max payout
  ladder = ladder.map(v => Math.min(v, forcedPayout));

  // Remove duplicates of forced payout
  let filtered = [];
  let hitForced = false;
  for (let val of ladder) {
    if (val === forcedPayout) {
      if (!hitForced) { filtered.push(val); hitForced = true; }
    } else filtered.push(val);
  }

  ladder = filtered.map(v => Math.round(v * 100) / 100);
  return ladder;
}

// Render ladder
function renderLadder() {
  ladderDiv.innerHTML = '';
  state.ladder.forEach((mult, i) => {
    const step = document.createElement('div');
    step.className = 'ladder-step' + (i === state.safeClicks ? ' current' : '');
    step.textContent = mult.toFixed(2) + 'x';
    step.dataset.step = i + 1;

    step.addEventListener('mouseenter', () => updatePayoutPreview(i));
    step.addEventListener('mouseleave', () => updatePayoutPreview(state.safeClicks - 1));
    step.addEventListener('click', () => {
      const idx = parseInt(step.dataset.step, 10);
      updatePayoutPreview(idx - 1, true);
    });

    ladderDiv.appendChild(step);
  });
  updatePayoutPreview(state.safeClicks - 1);
}

// Payout preview
function updatePayoutPreview(stepIndex, showAlert = false) {
  if (stepIndex < 0) {
    payoutPreview.textContent = `Payout if you cashout at this level: -`;
    return;
  }
  const mult = state.ladder[stepIndex] || 1;
  const wager = parseFloat(wagerInput.value) || 0;
  const payout = wager * mult;
  payoutPreview.textContent = `Payout if you cashout at this level: ${payout.toFixed(2)} gems (${mult.toFixed(2)}x)`;
  if (showAlert) alert(`If you cash out at level ${stepIndex + 1} you'd get ${payout.toFixed(2)} gems (${mult.toFixed(2)}x).`);
}

// --- Board rendering ---
function renderBoard() {
  BOARD.innerHTML = '';
  BOARD.style.gridTemplateColumns = `repeat(${BOARD_WIDTH}, 50px)`;
  for (let i = 0; i < TOTAL_TILES; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => { if (activeRound) clickTile(cell, i); });
    BOARD.appendChild(cell);
  }
  if (state.bombsRevealed) revealAll();
}

// --- Seed display ---
function setSeedDisplay() { seedDisplay.textContent = `Seed: ${state.seed || '-'}`; }

// --- Bomb placement ---
function placeBombsRandomly() {
  const seedToUse = state.forcedSeed || state.seed || genRandomSeed();
  state.seed = seedToUse;
  const rng = makeRng(seedToUse);
  state.bombs = new Set();
  while (state.bombs.size < state.mines) {
    state.bombs.add(Math.floor(rng() * TOTAL_TILES));
  }
}

// --- Custom popup ---
let popupTimer = null;
function showRevealPopup(text) {
  revealText.textContent = text;
  revealPopup.style.display = 'block';
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => { revealPopup.style.display = 'none'; }, 1400);
}

// --- Start game ---
function startGame() {
  state.revealed = [];
  state.bombs = new Set();
  state.safeClicks = 0;
  state.roundBalance = 0;
  state.ladder = generateLadder(state.mines);
  renderBoard();
  renderLadder();
  roundDisplay.textContent = `Round: ${state.roundBalance.toFixed(2)}`;
  if (!state.forcedSeed) state.seed = genRandomSeed();
  setSeedDisplay();
  newGameBtn.disabled = true;
  newGameBtn.textContent = 'In Play';
}

// --- Tile click ---
function clickTile(cell, index) {
  if (state.revealed.includes(index)) return;
  if (state.bombs.size === 0) placeBombsRandomly();
  cell.classList.add('revealed');

  if (state.bombs.has(index)) {
    cell.classList.add('mine');
    cell.textContent = '💣';
    state.roundBalance = 0;
    activeRound = false;
    sfxBomb.currentTime = 0; sfxBomb.play().catch(() => {});
    showRevealPopup('💥 Mine hit! Round lost.');
    revealAll();
    newGameBtn.disabled = false;
    newGameBtn.textContent = 'Place Bet';
    return;
  }

  cell.textContent = '💎';
  state.revealed.push(index);
  state.safeClicks = state.revealed.length;

  const multiplier = state.ladder[state.safeClicks - 1];
  state.roundBalance = state.wager * multiplier;
  roundDisplay.textContent = `Round: ${state.roundBalance.toFixed(2)}`;
  renderLadder();
  sfxClick.currentTime = 0; sfxClick.play().catch(() => {});

  showRevealPopup(`Revealed ${state.safeClicks} • ${multiplier.toFixed(2)}x`);

  // Forced payout
  if (multiplier >= 1000) {
    gems += state.roundBalance;
    localStorage.setItem('gems', gems);
    updateBalanceDisplay();
    sfxCash.currentTime = 0; sfxCash.play().catch(() => {});
    showRevealPopup(`🎉 Forced payout: ${state.roundBalance.toFixed(2)} gems`);
    activeRound = false;
    revealAll();
    newGameBtn.disabled = false;
    newGameBtn.textContent = 'Place Bet';
  }

  // Win condition
  if (state.safeClicks === TOTAL_TILES - state.mines) {
    activeRound = false;
    gems += state.roundBalance;
    localStorage.setItem('gems', gems);
    updateBalanceDisplay();
    sfxCash.currentTime = 0; sfxCash.play().catch(() => {});
    showRevealPopup(`🎉 You won ${state.roundBalance.toFixed(2)} gems`);
    revealAll();
    newGameBtn.disabled = false;
    newGameBtn.textContent = 'Place Bet';
  }
}

// Reveal all
function revealAll() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    if (!cell.classList.contains('revealed')) {
      cell.classList.add('revealed');
      cell.textContent = state.bombs.has(i) ? '💣' : '💎';
      if (state.bombs.has(i)) cell.classList.add('mine');
    }
  });
}

// --- Place Bet ---
newGameBtn.addEventListener('click', () => {
  const wager = parseFloat(wagerInput.value);
  let mines = parseInt(minesInput.value, 10);
  if (isNaN(wager) || wager < 0) { alert('Invalid wager!'); return; }
  if (wager > gems) { alert('Not enough gems!'); return; }
  mines = Math.max(1, Math.min(24, mines));
  state.wager = wager;
  state.mines = mines;
  if (wager > 0) gems -= wager;
  localStorage.setItem('gems', gems);
  updateBalanceDisplay();
  activeRound = true;
  if (!state.forcedSeed) state.seed = genRandomSeed();
  startGame();
});

// --- Cash Out ---
cashOutBtn.addEventListener('click', () => {
  if (!activeRound) return;
  if (state.roundBalance > 0 && state.wager > 0) {
    gems += state.roundBalance;
    localStorage.setItem('gems', gems);
    updateBalanceDisplay();
    sfxCash.currentTime = 0; sfxCash.play().catch(() => {});
    showRevealPopup(`Cashed out ${state.roundBalance.toFixed(2)} gems!`);
  } else if (state.wager === 0) {
    showRevealPopup(`Dummy bet completed. No gems lost or won.`);
  }
  activeRound = false;
  newGameBtn.disabled = false;
  newGameBtn.textContent = 'Place Bet';
  // **Removed startGame() here** to prevent reset bug
});

// --- Show Seed ---
document.getElementById('showSeed').addEventListener('click', () => {
  alert(`Seed: ${state.seed || '(not generated yet)'}`);
});

// --- Ladder live update ---
minesInput.addEventListener('change', () => {
  const mines = Math.max(1, Math.min(24, parseInt(minesInput.value, 10) || 1));
  state.mines = mines;
  state.ladder = generateLadder(state.mines);
  state.safeClicks = 0;
  renderLadder();
});
wagerInput.addEventListener('input', () => renderLadder());

// --- Back Home ---
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = '../index.html';
});

// --- Admin Modal & "incel" trigger ---
const adminModal = document.getElementById('adminModal');
const adminGems = document.getElementById('adminGems');
const adminSetGems = document.getElementById('adminSetGems');
const adminSeedInput = document.getElementById('adminSeed');
const adminSetSeed = document.getElementById('adminSetSeed');
const adminRevealBombs = document.getElementById('adminRevealBombs');
const adminHideBombs = document.getElementById('adminHideBombs');
const adminClose = document.getElementById('adminClose');

// Admin buttons
adminSetGems.addEventListener('click', () => {
  const val = parseFloat(adminGems.value) || 0;
  gems = val;
  localStorage.setItem('gems', gems);
  updateBalanceDisplay();
  alert('Gems set.');
});

adminSetSeed.addEventListener('click', () => {
  const s = adminSeedInput.value.trim();
  if (!s) { state.forcedSeed = null; alert('Seed cleared (will randomize).'); }
  else { state.forcedSeed = s; state.seed = s; alert('Forced seed applied: ' + s); }
  setSeedDisplay();
});

adminRevealBombs.addEventListener('click', () => {
  if (state.bombs.size === 0) placeBombsRandomly();
  state.bombsRevealed = true;
  revealAll();
});

adminHideBombs.addEventListener('click', () => {
  state.bombsRevealed = false;
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => { cell.classList.remove('revealed', 'mine'); cell.textContent = ''; });
});

adminClose.addEventListener('click', () => { adminModal.style.display = 'none'; });

// Typing "incel" opens admin modal
let typed = '';
document.addEventListener('keydown', (e) => {
  typed += e.key.toLowerCase();
  if (!typed.endsWith('incel')) typed = typed.slice(-5);
  if (typed === 'incel') {
    adminModal.style.display = 'flex';
    adminGems.value = gems.toFixed(2);
    adminSeedInput.value = state.forcedSeed || '';
    typed = '';
  }
});

// --- Initial render ---
window.addEventListener('load', () => {
  minesInput.value = state.mines;
  wagerInput.value = state.wager.toFixed(2);
  state.ladder = generateLadder(state.mines);
  renderBoard();
  renderLadder();
  setSeedDisplay();
});
