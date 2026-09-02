import test from "node:test";
import assert from "node:assert/strict";
import {
  AreaGame, COLS, ROWS, TARGET, capture, edgeKey, emptyBoard,
  isSafeEdge, partition, pointSegmentDistance, segmentsIntersect,
} from "../engine.mjs";

const fixedRandom = () => 0;
const verticalBarrier = (x) => {
  const edges = new Set();
  for (let y = 0; y < ROWS; y++) edges.add(edgeKey({ x, y }, { x, y: y + 1 }));
  return edges;
};

test("empty board starts with independent rows", () => {
  const board = emptyBoard();
  board[0][0] = "fast";
  assert.equal(board[1][0], null);
});

test("outer perimeter is safe while interior empty edges are not", () => {
  const board = emptyBoard();
  assert.equal(isSafeEdge(board, { x: 0, y: 0 }, { x: 1, y: 0 }), true);
  assert.equal(isSafeEdge(board, { x: 4, y: 4 }, { x: 5, y: 4 }), false);
});

test("filled/unfilled border becomes a safe edge", () => {
  const board = emptyBoard();
  board[4][4] = "slow";
  assert.equal(isSafeEdge(board, { x: 4, y: 4 }, { x: 5, y: 4 }), true);
});

test("a complete barrier partitions the field", () => {
  const parts = partition(emptyBoard(), verticalBarrier(20), [{ x: 5, y: 5 }]);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((part) => part.cells.length).sort((a, b) => a - b), [COLS * ROWS / 2, COLS * ROWS / 2]);
});

test("capture fills only the side without a Qix", () => {
  const board = emptyBoard();
  const result = capture(board, verticalBarrier(20), [{ x: 5, y: 5 }], "fast");
  assert.equal(result.claimed, COLS * ROWS / 2);
  assert.equal(board[10][30], "fast");
  assert.equal(board[10][5], null);
});

test("slow draw earns twice the territory score of fast draw", () => {
  const complete = (mode) => {
    const game = new AreaGame(fixedRandom);
    game.status = "playing";
    game.qixes = [{ x: 5, y: 5 }];
    game.pathEdges = verticalBarrier(20);
    game.drawMode = mode;
    game.drawing = true;
    game.finishLine();
    return game.score;
  };
  assert.equal(complete("slow"), complete("fast") * 2);
});

test("75 percent territory clears the stage", () => {
  const game = new AreaGame(fixedRandom);
  game.status = "playing";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS * TARGET / 100; x++) game.board[y][x] = "fast";
  game.qixes = [{ x: 35, y: 20 }];
  game.pathEdges = new Set();
  game.finishLine();
  assert.equal(game.percentage(), TARGET);
  assert.equal(game.status, "stageclear");
  assert.equal(game.stageReason, "area");
});

test("three mistakes lead to game over", () => {
  const game = new AreaGame(fixedRandom);
  game.status = "playing";
  game.loseLife("qix");
  game.loseLife("sparx");
  game.loseLife("fuse");
  assert.equal(game.lives, 0);
  assert.equal(game.status, "over");
});

test("Fuse catches a player who stops on an unfinished line", () => {
  const game = new AreaGame(fixedRandom);
  game.status = "playing";
  game.qixes = [];
  game.sparx = [];
  game.drawing = true;
  game.pathNodes = [{ x: 20, y: 52 }, { x: 20, y: 51 }, { x: 20, y: 50 }];
  game.marker = { x: 20, y: 50 };
  for (let i = 0; i < 70 && game.lives === 3; i++) game.tick(.05);
  assert.equal(game.lastDeath, "fuse");
  assert.equal(game.lives, 2);
});

test("Qix geometry detects contact with an unfinished line", () => {
  const game = new AreaGame(fixedRandom);
  game.drawing = true;
  game.pathNodes = [{ x: 8, y: 10 }, { x: 32, y: 10 }];
  game.qixes = [{ x: 20, y: 10, phase: 0 }];
  assert.equal(game.qixHitsTrail(), true);
});

test("Sparx follows safe perimeter edges", () => {
  const game = new AreaGame(fixedRandom);
  const sparx = { x: 0, y: 0, prev: null, acc: 0 };
  game.stepSparx(sparx);
  assert.equal(isSafeEdge(game.board, { x: 0, y: 0 }, { x: sparx.x, y: sparx.y }), true);
});

test("expired Time Line creates two Super Sparx", () => {
  const game = new AreaGame(fixedRandom);
  game.status = "playing";
  game.timeLine = .01;
  game.tick(.02);
  assert.equal(game.superSparx, true);
  assert.equal(game.sparx.length, 4);
});

test("stage three starts with two Qixes", () => {
  const game = new AreaGame(fixedRandom);
  game.stage = 3;
  game.resetStage();
  assert.equal(game.qixes.length, 2);
});

test("separating two Qixes clears the stage and raises multiplier", () => {
  const game = new AreaGame(fixedRandom);
  game.status = "playing";
  game.qixes = [{ x: 5, y: 5 }, { x: 30, y: 30 }];
  game.pathEdges = verticalBarrier(20);
  game.drawMode = "fast";
  game.drawing = true;
  game.finishLine();
  assert.equal(game.status, "stageclear");
  assert.equal(game.stageReason, "split");
  assert.equal(game.multiplier, 2);
});

test("unfinished line cannot immediately backtrack", () => {
  const game = new AreaGame(fixedRandom);
  game.drawing = true;
  game.pathNodes = [{ x: 20, y: 52 }, { x: 20, y: 51 }];
  game.pathEdges = new Set([edgeKey(game.pathNodes[0], game.pathNodes[1])]);
  assert.equal(game.canExtend({ x: 20, y: 51 }, { x: 20, y: 52 }), false);
});

test("geometry helpers detect a crossing and distance", () => {
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }), true);
  assert.equal(pointSegmentDistance({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }), 1);
});
