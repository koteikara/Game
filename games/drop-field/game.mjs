import { Game, SHAPES, COLS, ROWS } from './engine.mjs';
const $ = id => document.getElementById(id);
const game = new Game();
const board = $('board'), ctx = board.getContext('2d');
const nextCanvas = $('next'), nextCtx = nextCanvas.getContext('2d');
const colors = {I:'#91cbd0',O:'#ead576',T:'#b39bdb',S:'#b1cd7f',Z:'#e69b87',J:'#86a9d4',L:'#dfa66c'};
const names = {I:'棒型',O:'正方形',T:'T型',S:'S型',Z:'Z型',J:'J型',L:'L型'};
let previousStatus = '', previousLines = 0, previousQueue = '', previousScore = -1;
let held = null, last = 0, feedbackUntil = 0;
const buttons = [...document.querySelectorAll('[data-action]')];
function cell(context, x, y, size, kind, ghost = false) {
  if (y < 0) return;
  const px = x * size, py = y * size;
  if (ghost) {
    context.strokeStyle = '#b8c6b2'; context.lineWidth = 2;
    context.strokeRect(px+5,py+5,size-10,size-10);
    return;
  }
  context.fillStyle = colors[kind]; context.fillRect(px+2,py+2,size-4,size-4);
  context.strokeStyle = '#ffffff55'; context.lineWidth = 2;
  context.strokeRect(px+5,py+5,size-10,size-10);
  context.fillStyle = '#22292033'; context.fillRect(px+size/2-3,py+size/2-3,6,6);
}
function piece(p, ghost = false) {
  if (!p) return;
  p.matrix.forEach((row,y) => row.forEach((value,x) => {
    if (value) cell(ctx, x+p.x, y+p.y, 60, p.kind, ghost);
  }));
}
function draw() {
  ctx.fillStyle = '#242c27'; ctx.fillRect(0,0,600,1200);
  ctx.strokeStyle = '#354037'; ctx.lineWidth = 1;
  for(let x=1;x<COLS;x++){ctx.beginPath();ctx.moveTo(x*60,0);ctx.lineTo(x*60,1200);ctx.stroke();}
  for(let y=1;y<ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*60);ctx.lineTo(600,y*60);ctx.stroke();}
  game.board.forEach((row,y) => row.forEach((kind,x) => { if(kind) cell(ctx,x,y,60,kind); }));
  if(game.status==='playing'){piece(game.ghost(),true);piece(game.active);}
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
    points.forEach(([x,y])=>cell(nextCtx,x-minX,y-minY,size,kind));nextCtx.restore();
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
sync();draw();drawNext();requestAnimationFrame(frame);
