import test from 'node:test';
import assert from 'node:assert/strict';
import {fullscreenLayout,fullscreenSession} from '../fullscreen.mjs';

function harness({supported=true,reject=false,pending=false}={}) {
  let native=false,resolve;
  const events=[];
  const host={enter:()=>events.push('enter'),leave:()=>events.push('leave'),
    fallback:()=>events.push('fallback'),exitFailed:()=>events.push('exitFailed'),
    isNative:()=>native,exitNative:async()=>{native=false;events.push('exitNative');}};
  if(supported)host.request=()=>{events.push('request');if(reject)return Promise.reject(new Error('denied'));if(pending)return new Promise(r=>{resolve=()=>{native=true;r();};});native=true;return Promise.resolve();};
  const session=fullscreenSession(host);
  return {session,events,host,resolve:()=>resolve(),nativeOff:()=>{native=false;}};
}
test('portrait and landscape layouts fit representative mobile screens including safe areas',()=>{
  for(const [w,h] of [[320,568],[375,667],[390,844],[430,932],[568,320],[667,375],[844,390],[932,430]]){
    const padding={top:28,bottom:28,left:8,right:8};
    const l=fullscreenLayout(w,h,padding),width=w-16,height=h-56;
    assert.ok(l.board+l.side+10<=width);
    const available=height-44-(l.landscape?10:114+20);
    assert.ok(l.board*2<=available);
    assert.equal(l.landscape,width>height);
    assert.equal(l.controls,l.landscape?102:114);
  }
});
test('unsupported browsers enter page fullscreen and can exit',async()=>{
  const h=harness({supported:false});await h.session.enter();assert.ok(h.session.active);
  assert.deepEqual(h.events,['enter','fallback']);await h.session.exit();assert.equal(h.session.active,false);assert.equal(h.events.at(-1),'leave');
});
test('rejected native request keeps usable page fullscreen',async()=>{
  const h=harness({reject:true});await h.session.enter();assert.ok(h.session.active);assert.equal(h.events.at(-1),'fallback');await h.session.exit();assert.equal(h.session.active,false);
});
test('native fullscreen entry and button exit restore page state once',async()=>{
  const h=harness();await h.session.enter();h.session.nativeChanged();await h.session.exit();h.session.nativeChanged();assert.equal(h.session.active,false);assert.equal(h.events.filter(e=>e==='leave').length,1);assert.ok(h.events.includes('exitNative'));
});
test('browser fullscreen exit also leaves the expanded page layout',async()=>{
  const h=harness();await h.session.enter();h.session.nativeChanged();h.nativeOff();h.session.nativeChanged();assert.equal(h.session.active,false);assert.equal(h.events.at(-1),'leave');
});
test('exiting while native request is pending does not reopen fullscreen',async()=>{
  const h=harness({pending:true});const entering=h.session.enter();assert.ok(h.session.active);await h.session.exit();h.resolve();await entering;assert.equal(h.session.active,false);assert.equal(h.events.filter(e=>e==='leave').length,1);assert.equal(h.host.isNative(),false);
});
test('repeated enter requests do not request native fullscreen twice',async()=>{
  const h=harness({pending:true});const entering=h.session.enter();await h.session.enter();h.resolve();await entering;assert.equal(h.events.filter(e=>e==='request').length,1);
});
test('failed native exit retains an accessible exit control and reports failure',async()=>{
  const h=harness();await h.session.enter();h.host.exitNative=async()=>{throw new Error('denied');};await h.session.exit();assert.ok(h.session.active);assert.equal(h.events.at(-1),'exitFailed');assert.ok(!h.events.includes('leave'));
});

test('a late native result does not close a newer active session',async()=>{
  let native=false;const resolvers=[];let exits=0;
  const s=fullscreenSession({enter(){},leave(){},fallback(){},exitFailed(){},
    request:()=>new Promise(resolve=>resolvers.push(()=>{native=true;resolve();})),
    isNative:()=>native,exitNative:async()=>{native=false;exits++;}});
  const first=s.enter();await s.exit();const second=s.enter();resolvers[0]();await first;
  assert.ok(s.active);assert.equal(exits,0);resolvers[1]();await second;assert.ok(s.active);
});
