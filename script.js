const SIZE = 4;
const TILE_COUNT = SIZE * SIZE;
const EMPTY = 0;

const GAMES = {
  puzzle: {
    eyebrow: "Sliding Puzzle",
    title: "4x4 숫자 퍼즐",
    moveLabel: "이동",
    bestMoveLabel: "최소 이동",
    storageKey: "slidingPuzzle4x4Records",
    boardLabel: "4 곱하기 4 슬라이딩 퍼즐 보드. 빈칸과 맞닿은 타일을 클릭하거나 방향키로 이동하세요.",
    info: `
      <p>숫자 타일을 움직여 1부터 15까지 순서대로 맞추는 퍼즐입니다.</p>
      <ul>
        <li>빈칸과 맞닿은 타일만 이동할 수 있습니다.</li>
        <li>타일을 클릭하거나 키보드 방향키로 움직일 수 있습니다.</li>
        <li>연한 초록색은 올바른 위치, 연한 노란색은 아직 맞춰야 할 타일입니다.</li>
      </ul>
    `,
  },
  memory: {
    eyebrow: "Memory Cards",
    title: "카드 기억 게임",
    moveLabel: "시도",
    bestMoveLabel: "최소 시도",
    storageKey: "memoryCard4x4Records",
    boardLabel: "4 곱하기 4 카드 기억 게임 보드. 카드를 두 장씩 열어 같은 숫자를 찾으세요.",
    info: `
      <p>카드를 두 장씩 열어 같은 숫자 쌍을 모두 찾는 기억력 게임입니다.</p>
      <ul>
        <li>한 번에 카드 두 장을 선택할 수 있습니다.</li>
        <li>같은 숫자면 열린 상태로 남고, 다르면 다시 닫힙니다.</li>
        <li>모든 쌍을 찾으면 클리어됩니다.</li>
      </ul>
    `,
  },
};

const board = document.getElementById("board");
const gameEyebrowElement = document.getElementById("game-eyebrow");
const gameTitleElement = document.getElementById("game-title");
const moveLabelElement = document.getElementById("move-label");
const moveCountElement = document.getElementById("move-count");
const elapsedTimeElement = document.getElementById("elapsed-time");
const bestMoveLabelElement = document.getElementById("best-move-label");
const bestMovesElement = document.getElementById("best-moves");
const bestTimeElement = document.getElementById("best-time");
const bestTimeUnitElement = document.getElementById("best-time-unit");
const messageElement = document.getElementById("message");
const newGameButton = document.getElementById("new-game-button");
const resetRecordButton = document.getElementById("reset-record-button");
const infoButton = document.getElementById("info-button");
const infoDialog = document.getElementById("info-dialog");
const infoContent = document.getElementById("info-content");
const closeInfoButton = document.getElementById("close-info-button");
const gameTabs = document.querySelectorAll(".game-tab");

let activeGame = "puzzle";
let tiles = [];
let cards = [];
let flippedCardIndexes = [];
let matchedPairs = 0;
let boardLocked = false;
let moves = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameStarted = false;
let gameCleared = false;

// 현재 게임에 맞는 localStorage 키에서 최고 기록을 읽는다.
function getRecords() {
  const fallback = { bestMoves: null, bestTime: null };

  try {
    const saved = JSON.parse(localStorage.getItem(GAMES[activeGame].storageKey));
    return saved && typeof saved === "object" ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

// 최고 기록을 저장한 뒤 화면에 반영한다.
function saveRecords(records) {
  localStorage.setItem(GAMES[activeGame].storageKey, JSON.stringify(records));
  renderRecords();
}

// 저장된 최고 기록을 현재 게임 기준으로 표시한다.
function renderRecords() {
  const { bestMoves, bestTime } = getRecords();

  bestMovesElement.textContent = bestMoves === null ? "-" : bestMoves;
  bestTimeElement.textContent = bestTime === null ? "-" : bestTime;
  bestTimeUnitElement.textContent = bestTime === null ? "" : "초";
}

// 게임 제목, 기록 라벨, 설명 문구를 현재 게임에 맞춘다.
function renderGameChrome() {
  const game = GAMES[activeGame];

  gameEyebrowElement.textContent = game.eyebrow;
  gameTitleElement.textContent = game.title;
  moveLabelElement.textContent = game.moveLabel;
  bestMoveLabelElement.textContent = game.bestMoveLabel;
  board.setAttribute("aria-label", game.boardLabel);
  infoContent.innerHTML = game.info;

  gameTabs.forEach((tab) => {
    const isActive = tab.dataset.game === activeGame;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });
}

// 1차원 배열의 현재 인덱스를 행과 열 좌표로 변환한다.
function getPosition(index) {
  return {
    row: Math.floor(index / SIZE),
    col: index % SIZE,
  };
}

// 두 칸이 상하좌우로 맞닿아 있는지 확인한다.
function isAdjacent(firstIndex, secondIndex) {
  const first = getPosition(firstIndex);
  const second = getPosition(secondIndex);
  return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1;
}

// 셔플 결과가 4x4 슬라이딩 퍼즐에서 풀 수 있는 상태인지 판정한다.
function isSolvable(puzzle) {
  const numbers = puzzle.filter((value) => value !== EMPTY);
  let inversions = 0;

  for (let i = 0; i < numbers.length - 1; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      if (numbers[i] > numbers[j]) {
        inversions += 1;
      }
    }
  }

  const emptyIndex = puzzle.indexOf(EMPTY);
  const emptyRowFromBottom = SIZE - Math.floor(emptyIndex / SIZE);
  return emptyRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0;
}

// 현재 슬라이딩 퍼즐이 완성 상태인지 확인한다.
function isSolved(puzzle) {
  return puzzle.every((value, index) => index === TILE_COUNT - 1 ? value === EMPTY : value === index + 1);
}

// Fisher-Yates 알고리즘으로 무작위 배열을 만든다.
function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

// 풀 수 있고 완성 상태가 아닌 새 슬라이딩 퍼즐을 생성한다.
function createSolvablePuzzle() {
  const solved = Array.from({ length: TILE_COUNT - 1 }, (_, index) => index + 1).concat(EMPTY);
  let candidate = shuffleArray(solved);

  while (!isSolvable(candidate) || isSolved(candidate)) {
    candidate = shuffleArray(solved);
  }

  return candidate;
}

// 카드 기억 게임의 8쌍 카드를 섞어서 만든다.
function createMemoryCards() {
  return shuffleArray(Array.from({ length: 8 }, (_, index) => index + 1).flatMap((value) => [value, value]))
    .map((value, index) => ({ id: index, value, flipped: false, matched: false }));
}

// 타이머를 시작한다. 첫 행동 시점부터 시간이 흐른다.
function startTimer() {
  if (timerId !== null) {
    return;
  }

  timerId = setInterval(() => {
    elapsedSeconds += 1;
    elapsedTimeElement.textContent = elapsedSeconds;
  }, 1000);
}

// 타이머를 멈춘다.
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// 이동/시도 횟수와 시간을 초기 상태로 돌린다.
function resetStats() {
  moves = 0;
  elapsedSeconds = 0;
  gameStarted = false;
  gameCleared = false;
  boardLocked = false;
  flippedCardIndexes = [];
  matchedPairs = 0;
  moveCountElement.textContent = "0";
  elapsedTimeElement.textContent = "0";
  messageElement.textContent = "";
  stopTimer();
}

// 현재 게임 보드를 다시 그린다.
function renderBoard(movedTile = null) {
  board.innerHTML = "";
  board.className = activeGame === "memory" ? "board memory-board" : "board";

  if (activeGame === "memory") {
    renderMemoryBoard();
    return;
  }

  renderPuzzleBoard(movedTile);
}

// 슬라이딩 퍼즐 타일과 빈칸을 그린다.
function renderPuzzleBoard(movedTile = null) {
  const emptyIndex = tiles.indexOf(EMPTY);

  tiles.forEach((value, index) => {
    const cell = document.createElement(value === EMPTY ? "div" : "button");
    const isCorrect = value === index + 1;
    const canMove = value !== EMPTY && isAdjacent(index, emptyIndex);

    cell.className = value === EMPTY ? "empty" : "tile";
    cell.setAttribute("role", "gridcell");

    if (value === EMPTY) {
      cell.setAttribute("aria-label", "빈칸");
      board.appendChild(cell);
      return;
    }

    cell.type = "button";
    cell.textContent = value;
    cell.setAttribute("aria-label", `${value}번 타일${canMove ? ", 이동 가능" : ""}`);

    if (isCorrect) {
      cell.classList.add("correct");
    }

    if (canMove && !gameCleared) {
      cell.classList.add("movable");
    }

    if (value === movedTile) {
      cell.classList.add("moved");
      cell.addEventListener("animationend", () => cell.classList.remove("moved"), { once: true });
    }

    cell.addEventListener("click", () => moveTile(index));
    board.appendChild(cell);
  });
}

// 카드 기억 게임의 카드를 그린다.
function renderMemoryBoard() {
  cards.forEach((card, index) => {
    const cell = document.createElement("button");
    const isVisible = card.flipped || card.matched;

    cell.type = "button";
    cell.className = "memory-card";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", isVisible ? `${card.value}번 카드` : "뒤집힌 카드");
    cell.textContent = isVisible ? card.value : "";

    if (!isVisible) {
      cell.classList.add("hidden-card");
    }

    if (card.flipped) {
      cell.classList.add("flipped");
    }

    if (card.matched) {
      cell.classList.add("matched");
      cell.disabled = true;
    }

    cell.addEventListener("click", () => flipCard(index));
    board.appendChild(cell);
  });
}

// 사용자가 클릭하거나 방향키로 지정한 타일을 빈칸으로 이동한다.
function moveTile(tileIndex) {
  if (activeGame !== "puzzle" || gameCleared) {
    return;
  }

  const emptyIndex = tiles.indexOf(EMPTY);

  if (!isAdjacent(tileIndex, emptyIndex)) {
    return;
  }

  startGameIfNeeded();

  const movedTile = tiles[tileIndex];
  [tiles[tileIndex], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[tileIndex]];
  moves += 1;
  moveCountElement.textContent = moves;
  renderBoard(movedTile);
  checkPuzzleClear();
}

// 카드 한 장을 뒤집고 두 장이 열리면 짝 여부를 판정한다.
function flipCard(cardIndex) {
  if (activeGame !== "memory" || gameCleared || boardLocked) {
    return;
  }

  const card = cards[cardIndex];

  if (card.flipped || card.matched) {
    return;
  }

  startGameIfNeeded();
  card.flipped = true;
  flippedCardIndexes.push(cardIndex);
  renderBoard();

  if (flippedCardIndexes.length === 2) {
    moves += 1;
    moveCountElement.textContent = moves;
    checkMemoryPair();
  }
}

// 열린 두 카드가 같은지 확인한다.
function checkMemoryPair() {
  const [firstIndex, secondIndex] = flippedCardIndexes;
  const first = cards[firstIndex];
  const second = cards[secondIndex];

  if (first.value === second.value) {
    first.matched = true;
    second.matched = true;
    flippedCardIndexes = [];
    matchedPairs += 1;
    renderBoard();
    checkMemoryClear();
    return;
  }

  boardLocked = true;
  setTimeout(() => {
    first.flipped = false;
    second.flipped = false;
    flippedCardIndexes = [];
    boardLocked = false;
    renderBoard();
  }, 650);
}

// 첫 행동 시 게임 타이머를 시작한다.
function startGameIfNeeded() {
  if (!gameStarted) {
    gameStarted = true;
    startTimer();
  }
}

// 슬라이딩 퍼즐 완성 시 타이머를 멈추고 기록을 갱신한다.
function checkPuzzleClear() {
  if (!isSolved(tiles)) {
    return;
  }

  completeGame(`클리어! ${elapsedSeconds}초, ${moves}번 만에 완성했습니다.`);
}

// 카드 기억 게임 완료 시 타이머를 멈추고 기록을 갱신한다.
function checkMemoryClear() {
  if (matchedPairs !== 8) {
    return;
  }

  completeGame(`클리어! ${elapsedSeconds}초, ${moves}번 시도했습니다.`);
}

// 게임 완료 공통 처리와 기록 갱신을 수행한다.
function completeGame(message) {
  gameCleared = true;
  stopTimer();
  updateBestRecords();
  messageElement.textContent = message;
  renderBoard();
}

// 최소 이동/시도 횟수와 최단 시간을 각각 비교해 최고 기록을 갱신한다.
function updateBestRecords() {
  const records = getRecords();

  if (records.bestMoves === null || moves < records.bestMoves) {
    records.bestMoves = moves;
  }

  if (records.bestTime === null || elapsedSeconds < records.bestTime) {
    records.bestTime = elapsedSeconds;
  }

  saveRecords(records);
}

// 현재 선택된 게임 상태를 만들고 보드를 다시 그린다.
function startNewGame() {
  resetStats();
  renderGameChrome();

  if (activeGame === "memory") {
    cards = createMemoryCards();
  } else {
    tiles = createSolvablePuzzle();
  }

  renderRecords();
  renderBoard();
  board.focus();
}

// 게임 탭 선택 시 현재 게임을 전환하고 새 판을 시작한다.
function switchGame(gameName) {
  if (!GAMES[gameName] || activeGame === gameName) {
    return;
  }

  activeGame = gameName;
  startNewGame();
}

// 설명 창을 열고 닫을 때 키보드 포커스를 자연스럽게 되돌린다.
function openInfoDialog() {
  infoContent.innerHTML = GAMES[activeGame].info;
  infoDialog.hidden = false;
  closeInfoButton.focus();
}

function closeInfoDialog() {
  infoDialog.hidden = true;
  infoButton.focus();
}

// 방향키 입력을 빈칸과 맞닿은 타일 이동으로 변환한다.
function handleKeydown(event) {
  if (activeGame !== "puzzle") {
    return;
  }

  const emptyIndex = tiles.indexOf(EMPTY);
  const { row, col } = getPosition(emptyIndex);
  const keyMoves = {
    ArrowUp: row < SIZE - 1 ? emptyIndex + SIZE : null,
    ArrowDown: row > 0 ? emptyIndex - SIZE : null,
    ArrowLeft: col < SIZE - 1 ? emptyIndex + 1 : null,
    ArrowRight: col > 0 ? emptyIndex - 1 : null,
  };

  if (!(event.key in keyMoves)) {
    return;
  }

  event.preventDefault();

  if (keyMoves[event.key] !== null) {
    moveTile(keyMoves[event.key]);
  }
}

newGameButton.addEventListener("click", startNewGame);
resetRecordButton.addEventListener("click", () => {
  localStorage.removeItem(GAMES[activeGame].storageKey);
  renderRecords();
});
infoButton.addEventListener("click", openInfoDialog);
closeInfoButton.addEventListener("click", closeInfoDialog);
infoDialog.addEventListener("click", (event) => {
  if (event.target === infoDialog) {
    closeInfoDialog();
  }
});
board.addEventListener("keydown", handleKeydown);
gameTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchGame(tab.dataset.game));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !infoDialog.hidden) {
    closeInfoDialog();
  }
});

startNewGame();
