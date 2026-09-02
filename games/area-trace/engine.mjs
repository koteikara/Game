export const COLS = 40;
export const ROWS = 52;
export const TARGET = 75;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

export const nodeKey = ({x,y}) => `${x},${y}`;
export function edgeKey(a,b) {
  const ak=nodeKey(a), bk=nodeKey(b);
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}
export const emptyBoard = () => Array.from({length:ROWS},()=>Array(COLS).fill(null));
export const insideNode = p => p.x>=0&&p.x<=COLS&&p.y>=0&&p.y<=ROWS;
export const filled = (board,x,y) => x>=0&&x<COLS&&y>=0&&y<ROWS ? Boolean(board[y][x]) : false;

export function isSafeEdge(board,a,b) {
  if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
  if(a.y===b.y){
    const y=a.y,x=Math.min(a.x,b.x);
    if(y===0||y===ROWS)return true;
    return filled(board,x,y-1)!==filled(board,x,y);
  }
  const x=a.x,y=Math.min(a.y,b.y);
  if(x===0||x===COLS)return true;
  return filled(board,x-1,y)!==filled(board,x,y);
}
export function edgeHasUnfilled(board,a,b) {
  if(a.y===b.y){
    const y=a.y,x=Math.min(a.x,b.x);
    return (y>0&&!filled(board,x,y-1))||(y<ROWS&&!filled(board,x,y));
  }
  const x=a.x,y=Math.min(a.y,b.y);
  return (x>0&&!filled(board,x-1,y))||(x<COLS&&!filled(board,x,y));
}
export function safeNeighbors(board,node) {
  return DIRS.map(([dx,dy])=>({x:node.x+dx,y:node.y+dy})).filter(p=>insideNode(p)&&isSafeEdge(board,node,p));
}
export function isSafeVertex(board,node) {return safeNeighbors(board,node).length>0;}

function separatingEdge(x,y,nx,ny) {
  if(nx===x+1)return edgeKey({x:x+1,y},{x:x+1,y:y+1});
  if(nx===x-1)return edgeKey({x,y},{x,y:y+1});
  if(ny===y+1)return edgeKey({x,y:y+1},{x:x+1,y:y+1});
  return edgeKey({x,y},{x:x+1,y});
}
export function partition(board,barriers,qixes) {
  const seen=new Set(), components=[];
  for(let sy=0;sy<ROWS;sy++)for(let sx=0;sx<COLS;sx++){
    const start=`${sx},${sy}`;
    if(filled(board,sx,sy)||seen.has(start))continue;
    const cells=[],queue=[[sx,sy]];seen.add(start);
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];cells.push([x,y]);
      for(const [dx,dy] of DIRS){
        const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;
        if(nx<0||nx>=COLS||ny<0||ny>=ROWS||seen.has(k)||filled(board,nx,ny))continue;
        if(barriers.has(separatingEdge(x,y,nx,ny)))continue;
        seen.add(k);queue.push([nx,ny]);
      }
    }
    const occupants=[];
    qixes.forEach((q,index)=>{
      const qx=Math.max(0,Math.min(COLS-1,Math.floor(q.x)));
      const qy=Math.max(0,Math.min(ROWS-1,Math.floor(q.y)));
      if(cells.some(([x,y])=>x===qx&&y===qy))occupants.push(index);
    });
    components.push({cells,occupants});
  }
  return components;
}
export function capture(board,barriers,qixes,mode) {
  const components=partition(board,barriers,qixes);
  let claimed=0;
  for(const component of components){
    if(component.occupants.length)continue;
    for(const [x,y] of component.cells){board[y][x]=mode;claimed++;}
  }
  return {claimed,separated:components.filter(c=>c.occupants.length).length>1,components};
}

export function pointSegmentDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(!l2)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function orient(a,b,c){return Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));}
export function segmentsIntersect(a,b,c,d) {
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  return o1!==o2&&o3!==o4;
}

export class AreaGame {
  constructor(random=Math.random){this.random=random;this.status='ready';this.score=0;this.stage=1;this.lives=3;this.multiplier=1;this.resetStage();this.status='ready';}
  resetStage(){
    this.board=emptyBoard();this.marker={x:Math.floor(COLS/2),y:ROWS};this.direction=null;
    this.drawMode=null;this.drawing=false;this.pathNodes=[];this.pathEdges=new Set();this.moveAcc=0;this.idleDraw=0;this.fuse=0;
    const count=this.stage>=3?2:1;
    this.qixes=Array.from({length:count},(_,i)=>({x:COLS*(count===1?.5:(i?.7:.3)),y:ROWS*(i?.62:.36),vx:(i?-1:1)*(3.1+this.stage*.16),vy:(i?1:-1)*(2.5+this.stage*.12),phase:i*2.1}));
    this.sparx=[{x:0,y:0,prev:null,acc:0},{x:COLS,y:ROWS,prev:null,acc:0}];
    this.timeLine=Math.max(28,52-this.stage*3);this.superSparx=false;this.lastCapture=null;this.stageReason='';
  }
  start(){this.score=0;this.stage=1;this.lives=3;this.multiplier=1;this.resetStage();this.status='playing';}
  nextStage(){if(this.status!=='stageclear')return;this.stage++;this.resetStage();this.status='playing';}
  percentage(){return this.board.flat().filter(Boolean).length/(COLS*ROWS)*100;}
  setDirection(dx,dy){this.direction=dx===0&&dy===0?null:{x:dx,y:dy};if(this.direction&&this.drawing){this.idleDraw=0;this.fuse=0;}}
  setDrawMode(mode){this.drawMode=mode==='slow'?'slow':mode==='fast'?'fast':null;}
  pause(){if(this.status==='playing')this.status='paused';else if(this.status==='paused')this.status='playing';}
  canExtend(a,b){
    if(!insideNode(b)||!edgeHasUnfilled(this.board,a,b))return false;
    const bk=nodeKey(b);
    if(this.pathNodes.some((p,i)=>nodeKey(p)===bk&&i!==0))return false;
    return !this.pathEdges.has(edgeKey(a,b));
  }
  stepMarker(){
    if(!this.direction)return false;
    const a={...this.marker},b={x:a.x+this.direction.x,y:a.y+this.direction.y};
    if(!insideNode(b))return false;
    if(!this.drawing){
      if(isSafeEdge(this.board,a,b)){this.marker=b;return true;}
      if(!this.drawMode||!this.canExtend(a,b))return false;
      this.drawing=true;this.pathNodes=[a,b];this.pathEdges=new Set([edgeKey(a,b)]);this.marker=b;return true;
    }
    if(!this.canExtend(a,b))return false;
    this.pathEdges.add(edgeKey(a,b));this.pathNodes.push(b);this.marker=b;
    if(isSafeVertex(this.board,b)){this.finishLine();}
    return true;
  }
  finishLine(){
    const before=this.percentage();
    const result=capture(this.board,this.pathEdges,this.qixes,this.drawMode||'fast');
    const gained=this.percentage()-before,rate=this.drawMode==='slow'?500:250;
    const points=Math.round(gained*rate*this.multiplier);this.score+=points;
    this.lastCapture={gained,points,mode:this.drawMode||'fast'};
    this.drawing=false;this.pathNodes=[];this.pathEdges.clear();this.drawMode=null;this.idleDraw=0;this.fuse=0;
    const percent=this.percentage();
    if(result.separated&&this.qixes.length>1){this.multiplier=Math.min(9,this.multiplier+1);this.stageReason='split';this.status='stageclear';}
    else if(percent>=TARGET){this.score+=Math.max(0,Math.floor(percent-TARGET))*1000;this.stageReason='area';this.status='stageclear';}
  }
  loseLife(reason){
    if(this.status!=='playing')return;
    this.lives--;this.lastDeath=reason;this.direction=null;this.drawing=false;this.pathNodes=[];this.pathEdges.clear();this.drawMode=null;this.idleDraw=0;this.fuse=0;
    this.marker={x:Math.floor(COLS/2),y:ROWS};
    if(this.lives<=0)this.status='over';
  }
  qixPoints(q){
    const pts=[];
    for(let i=0;i<6;i++){const angle=q.phase+i*1.73+Math.sin(q.phase*1.7+i)*.8,r=1.1+(i%3)*.75;pts.push({x:q.x+Math.cos(angle)*r,y:q.y+Math.sin(angle)*r});}
    return pts;
  }
  qixHitsTrail(){
    if(!this.drawing)return false;
    for(const q of this.qixes){
      const points=this.qixPoints(q);
      for(let i=1;i<points.length;i++)for(let j=1;j<this.pathNodes.length;j++)if(segmentsIntersect(points[i-1],points[i],this.pathNodes[j-1],this.pathNodes[j]))return true;
      for(const p of points)for(let j=1;j<this.pathNodes.length;j++)if(pointSegmentDistance(p,this.pathNodes[j-1],this.pathNodes[j])<.22)return true;
    }
    return false;
  }
  updateQixes(dt){
    for(const q of this.qixes){
      q.phase+=dt*(2.4+this.stage*.08);
      q.vx+=((this.random()-.5)*1.8)*dt;q.vy+=((this.random()-.5)*1.8)*dt;
      const speed=Math.hypot(q.vx,q.vy),max=4.8+this.stage*.18;if(speed>max){q.vx*=max/speed;q.vy*=max/speed;}
      let nx=q.x+q.vx*dt,ny=q.y+q.vy*dt;
      if(nx<1||nx>COLS-1||filled(this.board,Math.floor(nx),Math.floor(q.y))){q.vx*=-1;nx=q.x+q.vx*dt;}
      if(ny<1||ny>ROWS-1||filled(this.board,Math.floor(q.x),Math.floor(ny))){q.vy*=-1;ny=q.y+q.vy*dt;}
      if(!filled(this.board,Math.floor(nx),Math.floor(ny))){q.x=Math.max(1,Math.min(COLS-1,nx));q.y=Math.max(1,Math.min(ROWS-1,ny));}
    }
  }
  sparxNeighbors(s){
    const node={x:s.x,y:s.y},neighbors=safeNeighbors(this.board,node);
    if(this.superSparx&&this.drawing){
      for(let i=1;i<this.pathNodes.length;i++){
        const a=this.pathNodes[i-1],b=this.pathNodes[i];
        if(nodeKey(a)===nodeKey(node))neighbors.push(b);
        if(nodeKey(b)===nodeKey(node))neighbors.push(a);
      }
    }
    return neighbors;
  }
  stepSparx(s){
    let choices=this.sparxNeighbors(s);
    if(s.prev&&choices.length>1)choices=choices.filter(p=>nodeKey(p)!==nodeKey(s.prev));
    if(!choices.length){if(s.prev){const back=s.prev;s.prev={x:s.x,y:s.y};s.x=back.x;s.y=back.y;}return;}
    const next=choices[Math.floor(this.random()*choices.length)];s.prev={x:s.x,y:s.y};s.x=next.x;s.y=next.y;
  }
  updateSparx(dt){
    for(const s of this.sparx){s.acc+=dt*(this.superSparx?10:6.2);while(s.acc>=1){this.stepSparx(s);s.acc--;}}
    if(this.sparx.some(s=>Math.hypot(s.x-this.marker.x,s.y-this.marker.y)<.35))this.loseLife('sparx');
  }
  tick(seconds){
    if(this.status!=='playing')return;
    const dt=Math.max(0,Math.min(.05,seconds));
    this.timeLine-=dt;
    if(this.timeLine<=0&&!this.superSparx){this.superSparx=true;this.sparx.push({x:COLS,y:0,prev:null,acc:0},{x:0,y:ROWS,prev:null,acc:0});}
    this.updateQixes(dt);this.updateSparx(dt);
    if(this.status!=='playing')return;
    if(this.qixHitsTrail()){this.loseLife('qix');return;}
    if(this.direction){
      const speed=this.drawing?(this.drawMode==='slow'?4.2:8.4):12;
      this.moveAcc+=dt*speed;
      while(this.moveAcc>=1&&this.status==='playing'){const moved=this.stepMarker();this.moveAcc--;if(!moved){this.moveAcc=0;break;}}
      if(this.drawing){this.idleDraw=0;this.fuse=0;}
    }else if(this.drawing){
      this.idleDraw+=dt;
      if(this.idleDraw>.8)this.fuse+=dt*10;
      if(this.fuse>=this.pathNodes.length-1){this.loseLife('fuse');return;}
    }
  }
  fusePosition(){
    if(!this.drawing||this.fuse<=0||this.pathNodes.length<2)return null;
    const i=Math.min(this.pathNodes.length-2,Math.floor(this.fuse)),t=Math.min(1,this.fuse-i),a=this.pathNodes[i],b=this.pathNodes[i+1];
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
}
