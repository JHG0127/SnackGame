const SIZE = 4;
const TILE_COUNT = SIZE * SIZE;
const EMPTY = 0;
const STORAGE_KEY = "slidingPuzzle4x4Records";

const board = document.getElementById("board");
const moveCountElement = document.getElementById("move-count");
const elapsedTimeElement = document.getElementById("elapsed-time");
const bestMovesElement = document.getElementById("best-moves");
const bestTimeElement = document.getElementById("best-time");
const bestTimeUnitElement = document.getElementById("best-time-unit");
const messageElement = document.getElementById("message");
const newGameButton = document.getElementById("new-game-button");
const resetRecordButton = document.getElementById("reset-record-button");
const infoButton = document.getElementById("info-button");
const infoDialog = document.getElementById("info-dialog");
const closeInfoButton = document.getElementById("close-info-button");

let tiles = [];
let moves = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameStarted = false;
let gameCleared = false;

// localStorage에서 최고 기록을 읽고, 값이 없으면 기본 상태를 반환한다.
function getRecords() {
  const fallback = { bestMoves: null, bestTime: null };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

// 최고 기록을 저장한 뒤 화면에 반영한다.
function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderRecords();
}

// 저장된 최고 기록을 화면에 표시한다.
function renderRecords() {
  const { bestMoves, bestTime } = getRecords();

  bestMovesElement.textContent = bestMoves === null ? "-" : bestMoves;
  bestTimeElement.textContent = bestTime === null ? "-" : bestTime;
  bestTimeUnitElement.textContent = bestTime === null ? "" : "초";
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
  const rowDistance = Math.abs(first.row - second.row);
  const colDistance = Math.abs(first.col - second.col);

  return rowDistance + colDistance === 1;
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

// 현재 퍼즐이 완성 상태인지 확인한다.
function isSolved(puzzle) {
  return puzzle.every((value, index) => {
    if (index === TILE_COUNT - 1) {
      return value === EMPTY;
    }

    return value === index + 1;
  });
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

// 풀 수 있고 완성 상태가 아닌 새 퍼즐을 생성한다.
function createSolvablePuzzle() {
  const solved = Array.from({ length: TILE_COUNT - 1 }, (_, index) => index + 1).concat(EMPTY);
  let candidate = shuffleArray(solved);

  while (!isSolvable(candidate) || isSolved(candidate)) {
    candidate = shuffleArray(solved);
  }

  return candidate;
}

// 타이머를 시작한다. 첫 이동 시점부터 시간이 흐른다.
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

// 이동 횟수와 시간을 초기 상태로 돌린다.
function resetStats() {
  moves = 0;
  elapsedSeconds = 0;
  gameStarted = false;
  gameCleared = false;
  moveCountElement.textContent = "0";
  elapsedTimeElement.textContent = "0";
  messageElement.textContent = "";
  stopTimer();
}

// 타일과 빈칸을 현재 배열 상태에 맞게 다시 그린다.
function renderBoard(movedTile = null) {
  const emptyIndex = tiles.indexOf(EMPTY);
  board.innerHTML = "";

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

// 사용자가 클릭하거나 방향키로 지정한 타일을 빈칸으로 이동한다.
function moveTile(tileIndex) {
  if (gameCleared) {
    return;
  }

  const emptyIndex = tiles.indexOf(EMPTY);

  if (!isAdjacent(tileIndex, emptyIndex)) {
    return;
  }

  if (!gameStarted) {
    gameStarted = true;
    startTimer();
  }

  const movedTile = tiles[tileIndex];
  [tiles[tileIndex], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[tileIndex]];
  moves += 1;
  moveCountElement.textContent = moves;
  renderBoard(movedTile);
  checkClear();
}

// 퍼즐 완성 시 타이머를 멈추고 기록을 갱신한다.
function checkClear() {
  if (!isSolved(tiles)) {
    return;
  }

  gameCleared = true;
  stopTimer();
  updateBestRecords();
  messageElement.textContent = `클리어! ${elapsedSeconds}초, ${moves}번 만에 완성했습니다.`;
  renderBoard();
}

// 최소 이동 횟수와 최단 시간을 각각 비교해 최고 기록을 갱신한다.
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

// 새 게임 상태를 만들고 보드를 다시 그린다.
function startNewGame() {
  tiles = createSolvablePuzzle();
  resetStats();
  renderBoard();
  board.focus();
}

// 설명 창을 열고 닫을 때 키보드 포커스를 자연스럽게 되돌린다.
function openInfoDialog() {
  infoDialog.hidden = false;
  closeInfoButton.focus();
}

function closeInfoDialog() {
  infoDialog.hidden = true;
  infoButton.focus();
}

// 방향키 입력을 빈칸과 맞닿은 타일 이동으로 변환한다.
function handleKeydown(event) {
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
  localStorage.removeItem(STORAGE_KEY);
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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !infoDialog.hidden) {
    closeInfoDialog();
  }
});

renderRecords();
startNewGame();
