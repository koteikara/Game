export const COLS = 10, ROWS = 20;
export const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]], T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]],
};
export const emptyBoard = () => Array.from({length: ROWS}, () => Array(COLS).fill(null));
export const rotateMatrix = (m, direction = 1) => m.map((row, y) => row.map((_, x) =>
  direction === 1 ? m[m.length - 1 - x][y] : m[x][m.length - 1 - y]));
export function clearRows(board) {
  const kept = board.filter(row => row.some(cell => !cell));
  const count = ROWS - kept.length;
  return {count, board: [...Array.from({length: count}, () => Array(COLS).fill(null)), ...kept]};
}
export class Game {
  constructor(random = Math.random) {
    this.random = random; this.board = emptyBoard(); this.status = 'ready';
    this.queue = []; this.active = null; this.score = 0; this.lines = 0;
    this.level = 1; this.lastClear = 0;
  }
  fillQueue() {
    while (this.queue.length < 7) {
      const bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }
  start() {
    this.board = emptyBoard(); this.queue = [];
    this.score = this.lines = this.lastClear = 0; this.level = 1;
    this.status = 'playing'; this.spawn();
  }
  spawn() {
    this.fillQueue();
    const kind = this.queue.shift(), matrix = SHAPES[kind].map(row => [...row]);
    this.active = {kind, matrix, x: Math.floor((COLS - matrix.length) / 2), y: 0};
    this.fallTime = this.lockTime = this.lockResets = 0;
    if (!this.fits(this.active)) this.status = 'over';
  }
  fits(piece) {
    return piece.matrix.every((row, y) => row.every((cell, x) => {
      if (!cell) return true;
      const px = piece.x + x, py = piece.y + y;
      return px >= 0 && px < COLS && py < ROWS && (py < 0 || !this.board[py][px]);
    }));
  }
  grounded() { return !this.fits({...this.active, y: this.active.y + 1}); }
  resetLock(wasGrounded) {
    if (wasGrounded && this.lockResets < 12) { this.lockTime = 0; this.lockResets++; }
  }
  move(dx) {
    if (this.status !== 'playing') return false;
    const next = {...this.active, x: this.active.x + dx};
    if (!this.fits(next)) return false;
    const wasGrounded = this.grounded(); this.active = next; this.resetLock(wasGrounded);
    return true;
  }
  rotate(direction = 1) {
    if (this.status !== 'playing') return false;
    const matrix = rotateMatrix(this.active.matrix, direction);
    // Simple wall/floor adjustments, not official SRS.
    for (const [dx, dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]]) {
      const next = {...this.active, matrix, x: this.active.x + dx, y: this.active.y + dy};
      if (!this.fits(next)) continue;
      const wasGrounded = this.grounded(); this.active = next; this.resetLock(wasGrounded);
      return true;
    }
    return false;
  }
  down(manual = false) {
    if (this.status !== 'playing') return false;
    const next = {...this.active, y: this.active.y + 1};
    if (!this.fits(next)) return false;
    this.active = next; this.lockTime = 0;
    if (manual) this.score++;
    return true;
  }
  ghost() {
    if (!this.active) return null;
    const ghost = {...this.active};
    while (this.fits({...ghost, y: ghost.y + 1})) ghost.y++;
    return ghost;
  }
  drop() {
    if (this.status !== 'playing') return;
    const ghost = this.ghost();
    this.score += (ghost.y - this.active.y) * 2; this.active = ghost; this.lock();
  }
  lock() {
    let overflow = false;
    this.active.matrix.forEach((row,y) => row.forEach((cell,x) => {
      if (!cell) return;
      const py = this.active.y + y;
      if (py < 0) overflow = true;
      else this.board[py][this.active.x + x] = this.active.kind;
    }));
    if (overflow) { this.status = 'over'; return; }
    const cleared = clearRows(this.board);
    this.board = cleared.board; this.lastClear = cleared.count;
    this.score += [0,100,300,500,800][cleared.count] * this.level;
    this.lines += cleared.count; this.level = Math.floor(this.lines / 10) + 1;
    this.spawn();
  }
  tick(ms) {
    if (this.status !== 'playing') return;
    const elapsed = Math.max(0, Math.min(ms, 100));
    this.fallTime += elapsed;
    const interval = Math.max(90, 850 * Math.pow(0.82, this.level - 1));
    if (this.fallTime >= interval) { this.down(); this.fallTime = 0; }
    if (this.grounded()) {
      this.lockTime += elapsed;
      if (this.lockTime >= 450) this.lock();
    } else this.lockTime = 0;
  }
  pause() {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'playing';
  }
}
