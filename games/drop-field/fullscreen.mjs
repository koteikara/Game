// Native fullscreen is optional: the same layout works as a page-only mode.
export function fullscreenLayout(width, height, padding = {}) {
  const usableWidth = Math.max(0, width - (padding.left || 0) - (padding.right || 0));
  const usableHeight = Math.max(0, height - (padding.top || 0) - (padding.bottom || 0));
  const landscape = usableWidth > usableHeight;
  const gap = 10, toolbar = 44, controls = landscape ? 102 : 114;
  const side = landscape ? Math.min(300, Math.max(160, usableWidth * .44)) : 92;
  const boardHeight = usableHeight - toolbar - (landscape ? gap : controls + gap * 2);
  const board = Math.max(40, Math.floor(Math.min((usableWidth - side - gap), boardHeight / 2)));
  return {landscape, board, side, controls};
}

// Kept independent from the DOM so unsupported/denied/racing API calls are testable.
export function fullscreenSession(host) {
  let active = false, hadNative = false, requestId = 0;
  const leave = () => {
    if (!active) return;
    active = false; hadNative = false; requestId++;
    host.leave();
  };
  async function enter() {
    if (active) return;
    active = true;
    const id = ++requestId;
    host.enter();
    if (!host.request) {host.fallback();return;}
    try {
      await host.request();
      if (!active || id !== requestId) {
        if (!active && host.isNative()) await host.exitNative();
        else if (active && host.isNative()) hadNative = true;
        return;
      }
      hadNative = host.isNative();
      if (!hadNative) host.fallback();
    } catch {if (active && id === requestId) host.fallback();}
  }
  async function exit() {
    if (!active) return;
    if (host.isNative()) {
      try {await host.exitNative();}
      catch {host.exitFailed();return;}
    }
    leave();
  }
  function nativeChanged() {
    if (host.isNative()) {
      if (active) hadNative = true;
      else Promise.resolve(host.exitNative()).catch(()=>{});
    } else if (active && hadNative) leave();
  }
  return {enter,exit,nativeChanged,get active(){return active;}};
}

export function installFullscreen({root,button,onPause,onLayout,announce}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const body = doc.body;
  let savedScroll = 0, savedStyles = null;
  const inertStates = new Map();
  function resize() {
    if (!session.active) return;
    const viewport = win.visualViewport;
    // Do not resize the game underneath a user who is pinch-zooming.
    const visual = viewport && viewport.scale === 1;
    const width = visual ? viewport.width : win.innerWidth;
    const height = visual ? viewport.height : win.innerHeight;
    root.style.setProperty('--screen-height',`${height}px`);
    const style = win.getComputedStyle(root);
    const layout = fullscreenLayout(width,height,{
      left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight),
      top:parseFloat(style.paddingTop),bottom:parseFloat(style.paddingBottom)
    });
    root.classList.toggle('is-landscape',layout.landscape);
    root.style.setProperty('--board-width',`${layout.board}px`);
    root.style.setProperty('--side-width',`${layout.side}px`);
    onLayout();
  }
  function enterPage() {
    onPause();
    savedScroll = win.scrollY;
    savedStyles = Object.fromEntries(['position','top','width','overflow'].map(k=>[k,body.style[k]]));
    body.style.position='fixed';body.style.top=`-${savedScroll}px`;body.style.width='100%';body.style.overflow='hidden';
    // Hide only siblings outside the game, preserving any pre-existing inert state.
    for(let node=root;node&&node!==body;node=node.parentElement){
      for(const sibling of node.parentElement.children){
        if(sibling===node)continue;
        inertStates.set(sibling,sibling.inert);sibling.inert=true;
      }
    }
    root.classList.add('is-fullscreen');
    button.textContent='全画面を終了';button.setAttribute('aria-pressed','true');
    resize();button.focus({preventScroll:true});
    announce('全画面モードにしました。終了ボタンで元の画面に戻れます。');
  }
  function leavePage() {
    onPause();
    root.classList.remove('is-fullscreen','is-landscape');
    for(const key of ['--screen-height','--board-width','--side-width'])root.style.removeProperty(key);
    for(const [element,value] of inertStates)element.inert=value;
    inertStates.clear();
    if(savedStyles)Object.assign(body.style,savedStyles);
    button.textContent='全画面で遊ぶ';button.setAttribute('aria-pressed','false');
    onLayout();win.scrollTo(0,savedScroll);button.focus({preventScroll:true});
    announce('全画面モードを終了しました。ゲームの進行状況はそのままです。');
  }
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  const session = fullscreenSession({
    enter:enterPage,leave:leavePage,
    request:request&&exit ? ()=>request.call(root) : null,
    isNative:()=>(doc.fullscreenElement||doc.webkitFullscreenElement)===root,
    exitNative:()=>exit.call(doc),
    fallback:()=>{resize();announce('ページ内の全画面モードです。ブラウザーのバーは残る場合があります。');},
    exitFailed:()=>announce('全画面を終了できませんでした。ブラウザーの全画面解除操作をお試しください。')
  });
  button.addEventListener('click',()=>session.active?session.exit():session.enter());
  doc.addEventListener('fullscreenchange',()=>{session.nativeChanged();resize();});
  doc.addEventListener('webkitfullscreenchange',()=>{session.nativeChanged();resize();});
  win.addEventListener('resize',resize);win.visualViewport?.addEventListener('resize',resize);
  root.addEventListener('keydown',event=>{
    if(!session.active)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();session.exit();return;
    }
    if(event.key!=='Tab')return;
    const focusable=[...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
  },true);
  return session;
}
