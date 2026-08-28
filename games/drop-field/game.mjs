import { Game, SHAPES, COLS, ROWS } from './engine.mjs';
import { pieceCells, boardCells, drawSquirrels } from './squirrel-renderer.mjs';
const $ = id => document.getElementById(id);
const game = new Game();
const board = $('board'), ctx = board.getContext('2d');
const nextCanvas = $('next'), nextCtx = nextCanvas.getContext('2d');
let sprites = null;
let loadingSprites = false;
const names = {I:'棒型',O:'正方形',T:'T型',S:'S型',Z:'Z型',J:'J型',L:'L型'};
let previousStatus = '', previousLines = 0, previousQueue = '', previousScore = -1;
let held = null, last = 0, feedbackUntil = 0;
const buttons = [...document.querySelectorAll('[data-action]')];
function drawGhost(piece) {
  ctx.strokeStyle = '#b8c6b2'; ctx.lineWidth = 2;
  for (const {x,y} of pieceCells(piece)) {
    if (y >= 0) ctx.strokeRect(x*60+5,y*60+5,50,50);
  }
}
function draw() {
  ctx.fillStyle = '#242c27'; ctx.fillRect(0,0,600,1200);
  ctx.strokeStyle = '#354037'; ctx.lineWidth = 1;
  for(let x=1;x<COLS;x++){ctx.beginPath();ctx.moveTo(x*60,0);ctx.lineTo(x*60,1200);ctx.stroke();}
  for(let y=1;y<ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*60);ctx.lineTo(600,y*60);ctx.stroke();}
  const cells = boardCells(game.board);
  if (game.status === 'playing') {drawGhost(game.ghost());cells.push(...pieceCells(game.active));}
  drawSquirrels(ctx, cells, 60, sprites);
}
function drawNext() {
  nextCtx.clearRect(0,0,240,420);
  game.queue.slice(0,3).forEach((kind, index) => {
    const points=[];
    SHAPES[kind].forEach((row,y)=>row.forEach((v,x)=>{if(v)points.push([x,y]);}));
    const minX=Math.min(...points.map(p=>p[0])), maxX=Math.max(...points.map(p=>p[0]));
    const minY=Math.min(...points.map(p=>p[1])), maxY=Math.max(...points.map(p=>p[1]));
    const size=42, offsetX=(240-(maxX-minX+1)*size)/2, offsetY=index*140+(140-(maxY-minY+1)*size)/2;
    nextCtx.save();nextCtx.translate(offsetX,offsetY);
    drawSquirrels(nextCtx, points.map(([x,y])=>({x:x-minX,y:y-minY})), size, sprites);nextCtx.restore();
  });
  nextCanvas.setAttribute('aria-label',game.queue.length ? '次のブロック：'+game.queue.slice(0,3).map(k=>names[k]).join('、') : '開始後に次のブロックを表示');
}
function announce(message){$('announcement').textContent=message;}
function sync() {
  if(previousScore!==game.score){$('score').textContent=game.score.toLocaleString('ja-JP');previousScore=game.score;}
  $('level').textContent=String(game.level).padStart(2,'0');$('lines').textContent=game.lines;
  const queue=game.queue.slice(0,3).join('');
  if(queue!==previousQueue){drawNext();previousQueue=queue;}
  if(game.lines>previousLines){
    $('feedback').textContent=`${game.lastClear} LINE${game.lastClear>1?'S':''} CLEAR!`;
    announce(`${game.lastClear}列消去。得点${game.score}点、レベル${game.level}。`);
    feedbackUntil=performance.now()+2200;
  }
  previousLines=game.lines;
  if(previousStatus!==game.status){
    held=null;
    const status=game.status;
    $('overlay').hidden=status==='playing';
    $('state').textContent={ready:'準備OK',playing:'プレイ中',paused:'一時停止',over:'ゲーム終了'}[status];
    buttons.forEach(b=>b.disabled=status!=='playing');
    $('pause').disabled=!['playing','paused'].includes(status);
    $('pause').innerHTML=status==='paused'?'再開する <kbd>P</kbd>':'一時停止 <kbd>P</kbd>';
    if(status==='paused'){
      $('overlay-title').textContent='ちょっと、ひと休み。';
      $('overlay-copy').textContent='準備ができたら、続きをどうぞ。';
      $('primary').textContent='つづける ↗';$('overlay-note').textContent='Pキーでも再開できます。';
      announce('一時停止しました。');
    }else if(status==='over'){
      $('overlay-title').textContent='また、ひと積み。';
      $('overlay-copy').textContent=`${game.score.toLocaleString('ja-JP')}点 / ${game.lines}列消去`;
      $('primary').textContent='もう一度あそぶ ↗';$('overlay-note').textContent='次は、もう少し高く。';
      announce(`ゲーム終了。得点${game.score}点、${game.lines}列消去。`);
      $('primary').focus({preventScroll:true});
    }else if(status==='playing'){announce('ゲームを開始・再開しました。');}
    previousStatus=status;
  }
}
function action(name){
  if(game.status!=='playing')return;
  if(name==='left')game.move(-1);
  else if(name==='right')game.move(1);
  else if(name==='down')game.down(true);
  else if(name==='rotate')game.rotate(1);
  else if(name==='counter')game.rotate(-1);
  else if(name==='drop'){held=null;game.drop();}
  sync();draw();
}
function togglePause(){game.pause();held=null;sync();draw();}
$('primary').addEventListener('click',()=>{
  if (!sprites) {loadSprites();return;}
  if(game.status==='paused')game.pause();
  else {game.start();previousLines=0;$('feedback').textContent='MAKE SOME SPACE.';feedbackUntil=0;}
  sync();draw();board.focus({preventScroll:true});
});
$('pause').addEventListener('click',()=>{togglePause();if(game.status==='playing')board.focus({preventScroll:true});});
board.addEventListener('pointerdown',()=>board.focus({preventScroll:true}));
const mappings={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'counter',Space:'drop'};
// Only claim keys while focus is in the game, preserving page navigation elsewhere.
const gameSection=document.querySelector('.game');
gameSection.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(['KeyP','Escape'].includes(event.code)&&['playing','paused'].includes(game.status)){
    event.preventDefault();if(!event.repeat)togglePause();return;
  }
  if(event.code==='Space'&&event.target.closest('button'))return;
  const name=mappings[event.code];if(!name||game.status!=='playing')return;
  event.preventDefault();if(event.repeat)return;
  action(name);
  if(['left','right','down'].includes(name)&&game.status==='playing')held={name,source:event.code,next:performance.now()+170};
});
window.addEventListener('keyup',e=>{if(held?.source===e.code)held=null;});
buttons.forEach(button=>{
  const name=button.dataset.action;
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0||game.status!=='playing')return;
    event.preventDefault();button.setPointerCapture(event.pointerId);action(name);
    if(['left','right','down'].includes(name))held={name,source:event.pointerId,next:performance.now()+170};
  });
  const release=event=>{if(held?.source===event.pointerId)held=null;};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  // Native keyboard and assistive-technology activation (pointer clicks already ran above).
  button.addEventListener('click',event=>{if(event.detail===0)action(name);});
  button.addEventListener('contextmenu',event=>event.preventDefault());
});
function autoPause(){held=null;if(game.status==='playing')togglePause();}
window.addEventListener('blur',autoPause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
gameSection.addEventListener('focusout',event=>{if(!gameSection.contains(event.relatedTarget))autoPause();});
function frame(time){
  const dt=last?time-last:0;last=time;
  if(game.status==='playing'){
    if(held&&time>=held.next){action(held.name);if(held)held.next=time+(held.name==='down'?40:80);}
    game.tick(dt);sync();draw();
  }
  if(feedbackUntil&&time>feedbackUntil){$('feedback').textContent='MAKE SOME SPACE.';feedbackUntil=0;}
  requestAnimationFrame(frame);
}
function imageAsset(path) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.onload = ()=>resolve(image);
    image.onerror = ()=>reject(new Error('Image could not load'));
    image.src = new URL(path, import.meta.url).href;
  });
}
async function loadSprites() {
  if (loadingSprites) return;
  loadingSprites = true;
  $('primary').disabled = true;
  $('primary').textContent = 'リスの準備中…';
  try {
    const [face,hands] = await Promise.all([
      imageAsset('./assets/squirrel-face.png'),
      imageAsset('./assets/squirrel-hands.png')
    ]);
    sprites = {face,hands};
    $('primary').textContent = 'ゲームをはじめる ↗';
    $('overlay-copy').innerHTML = 'リスと手をつないで<br>横一列をそろえよう。';
    draw();drawNext();
  } catch {
    $('primary').textContent = '画像を読み込み直す';
    $('overlay-copy').textContent = 'リスの画像を読み込めませんでした。通信を確認して、もう一度お試しください。';
    announce('ゲーム画像を読み込めませんでした。読み込み直すボタンで再試行できます。');
  } finally {
    loadingSprites = false;
    $('primary').disabled = false;
  }
}
sync();draw();drawNext();loadSprites();requestAnimationFrame(frame);
