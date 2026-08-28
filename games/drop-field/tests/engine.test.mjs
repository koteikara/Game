import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, SHAPES, COLS, ROWS, emptyBoard, rotateMatrix, clearRows } from '../engine.mjs';
const started=()=>{const game=new Game(()=>0.5);game.start();return game;};
function setPiece(game,kind,x,y,matrix=SHAPES[kind]){game.active={kind,x,y,matrix:matrix.map(r=>[...r])};}
test('empty board rows do not share storage',()=>{const b=emptyBoard();b[0][0]='T';assert.equal(b[1][0],null);});
test('start resets score, board, level and active piece',()=>{const g=started();g.score=900;g.lines=30;g.level=4;g.board[19][0]='I';g.start();assert.equal(g.status,'playing');assert.equal(g.score,0);assert.equal(g.lines,0);assert.equal(g.level,1);assert.ok(g.board.flat().every(v=>v===null));assert.ok(g.active);});
test('each seven-piece bag contains all shapes',()=>{const g=new Game(()=>0.5);g.fillQueue();assert.deepEqual([...g.queue].sort(),Object.keys(SHAPES).sort());});
test('all shapes return to original after four rotations',()=>{for(const original of Object.values(SHAPES)){let m=original;for(let i=0;i<4;i++)m=rotateMatrix(m);assert.deepEqual(m,original);assert.deepEqual(rotateMatrix(rotateMatrix(original),-1),original);}});
test('walls, floor and existing cells block movement',()=>{const g=started();setPiece(g,'O',0,18);assert.equal(g.move(-1),false);assert.equal(g.down(),false);g.board[18][2]='T';assert.equal(g.move(1),false);setPiece(g,'O',8,18);assert.equal(g.move(1),false);});
test('rotation adjusts at a wall without moving outside board',()=>{const g=started();setPiece(g,'I',-2,5,rotateMatrix(SHAPES.I));assert.ok(g.fits(g.active));assert.equal(g.rotate(),true);assert.ok(g.fits(g.active));});
test('blocked rotation preserves piece',()=>{const g=started();setPiece(g,'T',3,5);g.board=Array.from({length:ROWS},()=>Array(COLS).fill('O'));g.active.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)g.board[y+5][x+3]=null;}));const old=structuredClone(g.active);assert.equal(g.rotate(),false);assert.deepEqual(g.active,old);});
test('ghost finds the floor without mutating active piece',()=>{const g=started();setPiece(g,'O',4,0);assert.equal(g.ghost().y,18);assert.equal(g.active.y,0);});
test('hard drop locks four cells and scores two per descended row',()=>{const g=started();setPiece(g,'O',4,0);g.drop();assert.equal(g.score,36);assert.equal(g.board.flat().filter(Boolean).length,4);assert.equal(g.board[19][4],'O');assert.equal(g.active.y,0);});
test('soft drop scores one point; automatic gravity scores none',()=>{const g=started();g.down(true);assert.equal(g.score,1);g.down();assert.equal(g.score,1);});
test('one through four complete rows clear together',()=>{for(let count=1;count<=4;count++){const board=emptyBoard();for(let y=ROWS-count;y<ROWS;y++)board[y].fill('O');board[ROWS-count-1][0]='T';const result=clearRows(board);assert.equal(result.count,count);assert.equal(result.board.length,ROWS);assert.equal(result.board[19][0],'T');assert.ok(result.board.slice(0,count).flat().every(v=>v===null));}});
test('line scoring uses old level before level-up',()=>{const g=started();g.lines=9;for(let x=0;x<COLS;x++)g.board[19][x]='J';g.board[19][4]=g.board[19][5]=null;setPiece(g,'O',4,18);g.lock();assert.equal(g.score,100);assert.equal(g.lines,10);assert.equal(g.level,2);});
test('four-line clear scores 800 points',()=>{const g=started();for(let y=16;y<20;y++){g.board[y].fill('O');g.board[y][5]=null;}setPiece(g,'I',3,16,rotateMatrix(SHAPES.I));g.lock();assert.equal(g.score,800);assert.equal(g.lines,4);assert.ok(g.board.flat().every(v=>!v));});
test('pause freezes time, score and input; resume restores play',()=>{const g=started();g.pause();const before=JSON.stringify(g);g.tick(100);g.move(1);g.rotate();g.down(true);g.drop();assert.equal(JSON.stringify(g),before);g.pause();assert.equal(g.status,'playing');});
test('landing waits for lock delay and reset is capped',()=>{const g=started();setPiece(g,'O',4,18);g.tick(100);assert.equal(g.board.flat().filter(Boolean).length,0);for(let i=0;i<30;i++)g.move(i%2?1:-1);assert.equal(g.lockResets,12);for(let i=0;i<5;i++)g.tick(100);assert.equal(g.board.flat().filter(Boolean).length,4);});
test('blocked spawn ends game',()=>{const g=started();g.board[0].fill('T');g.board[1].fill('T');g.spawn();assert.equal(g.status,'over');});
test('locking above board ends game without invalid array writes',()=>{const g=started();setPiece(g,'O',3,-1);g.lock();assert.equal(g.status,'over');assert.equal(g.board[-1],undefined);});
test('deterministic mixed-input simulation preserves board invariants',()=>{let seed=154;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};const g=new Game(random);let ended=0;g.start();for(let i=0;i<6000;i++){const action=Math.floor(random()*6);if(action===0)g.move(-1);if(action===1)g.move(1);if(action===2)g.rotate();if(action===3)g.down(true);if(action===4)g.drop();g.tick(100);assert.equal(g.board.length,ROWS);assert.ok(g.board.every(r=>r.length===COLS));assert.ok(g.board.flat().every(v=>v===null||SHAPES[v]));assert.ok(Number.isFinite(g.score));if(g.status==='over'){ended++;g.start();}else assert.ok(g.fits(g.active));}assert.ok(ended>0);});

// Squirrel appearance is independent of the game rules.
import {pieceCells, boardCells, connections, drawSquirrels} from '../squirrel-renderer.mjs';
test('isolated and diagonal squirrels do not join hands',()=>{
  assert.deepEqual(connections([{x:0,y:0}]),[]);
  assert.deepEqual(connections([{x:0,y:0},{x:1,y:1}]),[]);
});
test('all four orthogonal neighbors join the central squirrel once',()=>{
  const cells=[{x:2,y:2},{x:1,y:2},{x:3,y:2},{x:2,y:1},{x:2,y:3}];
  const links=connections(cells);
  assert.equal(links.length,4);
  assert.equal(links.filter(l=>l.direction==='right').length,2);
  assert.equal(links.filter(l=>l.direction==='down').length,2);
});
test('a filled square has four shared edges, without duplicate connectors',()=>{
  const cells=pieceCells({matrix:SHAPES.O,x:0,y:0});
  assert.equal(connections(cells).length,4);
  assert.equal(connections([...cells,...cells]).length,4);
});
test('different piece kinds and touching active cells also join hands',()=>{
  const b=emptyBoard();b[19][0]='I';b[19][1]='T';
  assert.equal(connections(boardCells(b)).length,1);
  const active=pieceCells({matrix:[[1]],x:1,y:18});
  assert.equal(connections([...boardCells(b),...active]).length,2);
  assert.equal(connections(boardCells(b)).length,1);
});
test('row clearing recomputes connectivity and leaves no stale links',()=>{
  const b=emptyBoard();b[19].fill('I');b[18][4]='T';b[18][5]='O';
  const result=clearRows(b);
  assert.deepEqual(connections(boardCells(result.board)),[{x:4,y:19,direction:'right'}]);
});
test('offscreen cells never produce visible hand connections',()=>{
  assert.deepEqual(connections([{x:2,y:-1},{x:2,y:0}]),[]);
});
test('renderer draws upright faces then horizontal and vertical connectors',()=>{
  const calls=[];
  const context=Object.fromEntries(['drawImage','save','restore','translate','rotate'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  const sprites={face:{name:'face'},hands:{name:'hands'}};
  drawSquirrels(context,[{x:0,y:0},{x:1,y:0},{x:0,y:1}],60,sprites);
  const draws=calls.filter(c=>c[0]==='drawImage');
  assert.deepEqual(draws.map(c=>c[1].name),['face','face','face','hands','hands']);
  assert.deepEqual(calls.filter(c=>c[0]==='rotate'),[['rotate',Math.PI/2]]);
  assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
});
