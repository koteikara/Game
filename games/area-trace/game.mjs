import { AreaGame, COLS, ROWS, edgeKey, isSafeEdge } from "./engine.mjs";

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const CELL = canvas.width / COLS;
const game = new AreaGame();

const ui = Object.fromEntries([
  "score", "stage", "lives", "filled", "timeline", "multiplier", "mode-status",
  "overlay", "overlay-title", "overlay-copy", "primary", "announcement", "fast", "slow", "pause",
].map((id) => [id, document.getElementById(id)]));

let previousStatus = game.status;
let previousCapture = null;
let previousDeath = null;
let lastTime = performance.now();
const keys = new Set();

function announce(message) {
  ui.announcement.textContent = "";
  requestAnimationFrame(() => { ui.announcement.textContent = message; });
}

function setDirection(dx, dy) {
  if (game.status !== "playing") return;
  game.setDirection(dx, dy);
  canvas.focus({ preventScroll: true });
}

function stopDirection() {
  game.setDirection(0, 0);
}

function selectMode(mode) {
  if (game.status !== "playing" || game.drawing) return;
  game.setDrawMode(game.drawMode === mode ? null : mode);
  syncUi();
}

function pathColor() {
  return game.drawMode === "slow" ? "#ff4fa3" : "#ffdc5e";
}

function drawBoard() {
  ctx.fillStyle = "#02040c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = game.board[y][x];
      if (!cell) continue;
      ctx.fillStyle = cell === "slow" ? "#71315f" : "#15506a";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  ctx.strokeStyle = "#41f5d0";
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "#41f5d0";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let y = 0; y <= ROWS; y++) {
    for (let x = 0; x <= COLS; x++) {
      const a = { x, y };
      if (x < COLS) {
        const b = { x: x + 1, y };
        if (isSafeEdge(game.board, a, b)) {
          ctx.moveTo(x * CELL, y * CELL);
          ctx.lineTo((x + 1) * CELL, y * CELL);
        }
      }
      if (y < ROWS) {
        const b = { x, y: y + 1 };
        if (isSafeEdge(game.board, a, b)) {
          ctx.moveTo(x * CELL, y * CELL);
          ctx.lineTo(x * CELL, (y + 1) * CELL);
        }
      }
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (game.pathNodes.length > 1) {
    ctx.strokeStyle = pathColor();
    ctx.lineWidth = 4;
    ctx.shadowColor = pathColor();
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(game.pathNodes[0].x * CELL, game.pathNodes[0].y * CELL);
    for (const p of game.pathNodes.slice(1)) ctx.lineTo(p.x * CELL, p.y * CELL);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (let qIndex = 0; qIndex < game.qixes.length; qIndex++) {
    const points = game.qixPoints(game.qixes[qIndex]);
    ctx.strokeStyle = qIndex % 2 ? "#41f5d0" : "#ff4fa3";
    ctx.lineWidth = 2.4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    points.forEach((p, index) => index ? ctx.lineTo(p.x * CELL, p.y * CELL) : ctx.moveTo(p.x * CELL, p.y * CELL));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const sparx of game.sparx) {
    ctx.save();
    ctx.translate(sparx.x * CELL, sparx.y * CELL);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = game.superSparx ? "#ff5470" : "#ffdc5e";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(-5.5, -5.5, 11, 11);
    ctx.restore();
  }

  const fuse = game.fusePosition();
  if (fuse) {
    ctx.beginPath();
    ctx.fillStyle = "#ff5470";
    ctx.shadowColor = "#ff5470";
    ctx.shadowBlur = 12;
    ctx.arc(fuse.x * CELL, fuse.y * CELL, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.save();
  ctx.translate(game.marker.x * CELL, game.marker.y * CELL);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 10;
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
}

function overlayForStatus() {
  if (game.status === "playing") {
    ui.overlay.hidden = true;
    return;
  }
  ui.overlay.hidden = false;
  if (game.status === "ready") {
    ui["overlay-title"].textContent = "75%を切り取れ";
    ui["overlay-copy"].textContent = "外周から線を引き、動く敵を囲わない側を陣地にします。";
    ui.primary.textContent = "ゲームを始める";
  } else if (game.status === "paused") {
    ui["overlay-title"].textContent = "PAUSE";
    ui["overlay-copy"].textContent = "動きは停止しています。準備ができたら再開してください。";
    ui.primary.textContent = "再開する";
  } else if (game.status === "stageclear") {
    ui["overlay-title"].textContent = "STAGE CLEAR";
    ui["overlay-copy"].textContent = game.stageReason === "split"
      ? `2体を分断しました。倍率は ×${game.multiplier} です。`
      : `${game.percentage().toFixed(1)}% の領域を獲得しました。`;
    ui.primary.textContent = "次のステージへ";
  } else {
    ui["overlay-title"].textContent = "GAME OVER";
    ui["overlay-copy"].textContent = `最終スコア ${game.score.toLocaleString("ja-JP")}。もう一度挑戦できます。`;
    ui.primary.textContent = "もう一度遊ぶ";
  }
}

function syncUi() {
  ui.score.textContent = game.score.toLocaleString("ja-JP");
  ui.stage.textContent = game.stage;
  ui.lives.textContent = game.lives > 0 ? Array(game.lives).fill("◆").join(" ") : "—";
  ui.filled.textContent = `${game.percentage().toFixed(1)}%`;
  ui.timeline.textContent = game.superSparx ? "DANGER" : Math.max(0, Math.ceil(game.timeLine));
  ui.multiplier.textContent = `×${game.multiplier}`;
  ui.fast.setAttribute("aria-pressed", String(game.drawMode === "fast"));
  ui.slow.setAttribute("aria-pressed", String(game.drawMode === "slow"));
  const enabled = game.status === "playing";
  ui.fast.disabled = !enabled || game.drawing;
  ui.slow.disabled = !enabled || game.drawing;
  ui.pause.disabled = !enabled;
  ui["mode-status"].textContent = game.drawing
    ? `${game.drawMode === "slow" ? "SLOW" : "FAST"} DRAW 描画中`
    : game.drawMode ? `${game.drawMode.toUpperCase()} DRAW 待機中` : "外周を移動中";
  overlayForStatus();

  if (game.lastCapture && game.lastCapture !== previousCapture) {
    previousCapture = game.lastCapture;
    announce(`${game.lastCapture.gained.toFixed(1)}パーセント獲得、${game.lastCapture.points}点。`);
  }
  if (game.lastDeath && game.lastDeath !== previousDeath) {
    previousDeath = game.lastDeath;
    const labels = { qix: "QIXが線に接触", sparx: "SPARXに接触", fuse: "FUSEが到達" };
    announce(`${labels[game.lastDeath]}。残り${game.lives}機。`);
  }
  if (game.status !== previousStatus) {
    if (game.status === "stageclear") announce(`ステージ${game.stage}クリア。`);
    if (game.status === "over") announce(`ゲームオーバー。スコア${game.score}点。`);
    previousStatus = game.status;
  }
}

function activeArrow() {
  if (keys.has("ArrowUp")) return [0, -1];
  if (keys.has("ArrowDown")) return [0, 1];
  if (keys.has("ArrowLeft")) return [-1, 0];
  if (keys.has("ArrowRight")) return [1, 0];
  return [0, 0];
}

window.addEventListener("keydown", (event) => {
  const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyZ", "KeyX", "KeyP", "Escape"].includes(event.code);
  if (handled) event.preventDefault();
  if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
    game.pause(); syncUi(); return;
  }
  if (event.code === "KeyZ" && !game.drawing) game.setDrawMode("fast");
  if (event.code === "KeyX" && !game.drawing) game.setDrawMode("slow");
  keys.add(event.code);
  const [dx, dy] = activeArrow();
  game.setDirection(dx, dy);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  const [dx, dy] = activeArrow();
  game.setDirection(dx, dy);
  if (!game.drawing && (event.code === "KeyZ" || event.code === "KeyX")) game.setDrawMode(null);
});

for (const button of document.querySelectorAll("[data-dir]")) {
  const [dx, dy] = button.dataset.dir.split(",").map(Number);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setDirection(dx, dy);
  });
  button.addEventListener("pointerup", stopDirection);
  button.addEventListener("pointercancel", stopDirection);
  button.addEventListener("lostpointercapture", stopDirection);
}

ui.fast.addEventListener("click", () => selectMode("fast"));
ui.slow.addEventListener("click", () => selectMode("slow"));
ui.pause.addEventListener("click", () => { game.pause(); syncUi(); });
ui.primary.addEventListener("click", () => {
  if (game.status === "ready" || game.status === "over") game.start();
  else if (game.status === "paused") game.pause();
  else if (game.status === "stageclear") game.nextStage();
  previousCapture = null;
  previousDeath = null;
  lastTime = performance.now();
  canvas.focus({ preventScroll: true });
  syncUi();
});

window.addEventListener("blur", () => { if (game.status === "playing") { game.pause(); syncUi(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && game.status === "playing") { game.pause(); syncUi(); } });

function frame(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  game.tick(dt);
  drawBoard();
  syncUi();
  requestAnimationFrame(frame);
}

drawBoard();
syncUi();
requestAnimationFrame(frame);
