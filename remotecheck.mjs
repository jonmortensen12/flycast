/* Drive remote.html the way a phone does, headlessly.

   The phone page has no simulation to fall over, so nothing about it shows up
   in smoke.mjs — and it is the one page that has to work first time, in front
   of somebody who is standing there holding a fly rod. So this executes its
   script blocks against a small real DOM, feeds it the ACTUAL menu out of
   index.html, and then checks the things that would ruin a demo:

     · every script block parses (they are separate on purpose — if one dies
       the others must still run, which is only true if this is checked)
     · no global is named after a window property (`top`, `name`, `length`…),
       the Safari failure that silently kills a whole script block
     · the tags balance, so no control ends up outside the box it lives in
     · a schema arriving in numbered pieces reassembles and draws every row
     · dragging a slider sends the value, and the echo of that value does not
       land back under the thumb
     · a release that arrives anywhere at all lets the row go again
     · an action row sends the action and nothing else
     · search reaches rows in tabs that are not open

   Run it before shipping, next to `node smoke.mjs`. */
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('remote.html', 'utf8');
const game = fs.readFileSync('index.html', 'utf8');
let fails = 0;
const ok = (cond, label, extra) => {
  if (!cond) { fails++; console.log('  *** FAIL:', label, extra === undefined ? '' : extra); }
  else console.log('  ok  ', label, extra === undefined ? '' : extra);
};

/* ── 1. structure ───────────────────────────────────────────────────────── */
{
  const stack = [], VOID = new Set(['meta','link','br','hr','img','input','source','area','base','col']);
  let bad = 0, depthMax = 0;
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
                   .replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(body))) {
    const close = m[1] === '/', tag = m[2].toLowerCase(), selfClose = /\/\s*$/.test(m[3]);
    if (VOID.has(tag) || selfClose || tag === '!doctype') continue;
    if (close) { if (stack.pop() !== tag) bad++; }
    else { stack.push(tag); depthMax = Math.max(depthMax, stack.length); }
  }
  ok(bad === 0 && stack.length === 0, 'tags balance', {bad, left: stack, depthMax});
}

/* ── 2. script blocks, and what they declare ────────────────────────────── */
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok(blocks.length >= 3, 'separate script blocks so one failure is not all of them', blocks.length);
{
  /* `const top = …` is a SyntaxError in Safari and takes the entire block with
     it, invisibly. Family Beatdown lost eight rounds to this one. */
  const FORBIDDEN = ['top','name','length','parent','self','location','status','history',
                     'screen','event','closed','origin','frames','window','document','navigator'];
  const hits = [];
  blocks.forEach((b, i) => {
    for (const w of FORBIDDEN) {
      if (new RegExp('^\\s*(?:let|const|var|function)\\s+' + w + '\\b', 'm').test(b))
        hits.push('block ' + i + ': ' + w);
    }
  });
  ok(hits.length === 0, 'no global shadows a window property', hits);
}

/* ── 3. a DOM, small but real ───────────────────────────────────────────── */
class El {
  constructor(tag){ this.tagName=(tag||'div').toUpperCase(); this.children=[]; this.parent=null;
    this.style={}; this.dataset={}; this._text=''; this._ev={}; this.id='';
    this.value=''; this.type=''; this.disabled=false; this._cls=new Set();
    this.classList={
      add:(...c)=>c.forEach(x=>this._cls.add(x)),
      remove:(...c)=>c.forEach(x=>this._cls.delete(x)),
      contains:c=>this._cls.has(c),
      toggle:(c,f)=>{ const on=f===undefined?!this._cls.has(c):!!f;
        if(on)this._cls.add(c); else this._cls.delete(c); return on; }};
  }
  get className(){ return [...this._cls].join(' '); }
  set className(v){ this._cls=new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(c){ c.parent=this; this.children.push(c); return c; }
  removeChild(c){ this.children=this.children.filter(x=>x!==c); return c; }
  remove(){ if(this.parent) this.parent.removeChild(this); }
  get textContent(){ return this.children.length ? this.children.map(c=>c.textContent).join('') : this._text; }
  set textContent(v){ this.children=[]; this._text=String(v); }
  set innerHTML(v){ this.children=[]; this._text=String(v); }
  get innerHTML(){ return this._text; }
  setAttribute(k,v){ this[k]=v; }
  addEventListener(t,f){ (this._ev[t]=this._ev[t]||[]).push(f); }
  removeEventListener(t,f){ this._ev[t]=(this._ev[t]||[]).filter(x=>x!==f); }
  fire(t,ev){ for(const f of (this._ev[t]||[])) f(Object.assign({target:this,preventDefault(){},stopPropagation(){}}, ev)); }
  /* everything under here, flattened — the test walks trees, not selectors */
  all(out){ out=out||[]; for(const c of this.children){ out.push(c); c.all(out); } return out; }
}
class TextNode { constructor(t){ this._text=String(t); this.children=[]; }
  get textContent(){ return this._text; } all(out){ return out||[]; } }

const byId = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
  const tag = /<(\w+)[^>]*\sid="/.exec(html.slice(Math.max(0, m.index - 200), m.index + 10));
  const e = new El(tag ? tag[1] : 'div');
  e.id = m[1];
  byId.set(m[1], e);
}
const head = new El('head'), docBody = new El('body');
const document = {
  head, body: docBody, documentElement: new El('html'),
  visibilityState: 'visible',
  createElement: t => new El(t),
  createTextNode: t => new TextNode(t),
  getElementById: id => byId.get(id) || null,
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener(t,f){ (this._ev=this._ev||{})[t]=(this._ev[t]||[]).concat(f); },
  removeEventListener(){},
};

/* ── 4. a Peer that goes nowhere ────────────────────────────────────────── */
const wire = { sent: [], peers: [], conns: [] };
class FakeConn {
  constructor(){ this.open=false; this._ev={}; this.dataChannel={bufferedAmount:0}; wire.conns.push(this); }
  on(t,f){ (this._ev[t]=this._ev[t]||[]).push(f); }
  fire(t,a){ for(const f of (this._ev[t]||[])) f(a); }
  send(m){ wire.sent.push(m); }
  close(){ this.open=false; this.fire('close'); }
}
class FakePeer {
  constructor(){ this._ev={}; wire.peers.push(this); }
  on(t,f){ (this._ev[t]=this._ev[t]||[]).push(f); }
  fire(t,a){ for(const f of (this._ev[t]||[])) f(a); }
  connect(){ this.conn=new FakeConn(); return this.conn; }
  destroy(){}
}

/* Real enough to matter: the join timeout is CLEARED when the channel opens,
   and a stub that ignores clearTimeout fires it anyway — which tears the
   connection down under the test and makes every later send vanish. That is
   not a fake failure, it is the fake clock lying. */
const timers = new Map();
let timerId = 0;
const runTimers = () => { const due = [...timers]; timers.clear();
                          for (const [, f] of due) f(); };
const sandbox = {
  document, Peer: FakePeer, console,
  Math, JSON, Date, Object, Array, Number, String, Boolean, Set, Map, RegExp, Symbol,
  isNaN, isFinite, parseFloat, parseInt, Error, Promise,
  setTimeout: f => { timers.set(++timerId, f); return timerId; },
  clearTimeout: id => { timers.delete(id); },
  setInterval: () => 0, clearInterval: () => {},
  scrollTo: () => {}, alert: () => {},
  location: { hash: '#WXYZ', search: '', href: 'https://x/flycast/remote.html#WXYZ' },
  navigator: { wakeLock: { request: () => Promise.resolve({}) } },
  innerWidth: 390, innerHeight: 844,
  addEventListener(){}, removeEventListener(){},
  onerror: null,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let parsed = 0;
blocks.forEach((b, i) => {
  try { vm.runInContext(b, sandbox, {filename: 'remote.html#' + i}); parsed++; }
  catch (e) { console.log('  *** BLOCK', i, 'THREW:', e.message); fails++; }
});
ok(parsed === blocks.length, 'every script block ran', parsed + '/' + blocks.length);

/* ── 5. the real menu, out of the real game ─────────────────────────────── */
const lit = game.slice(game.indexOf('const MENU=[') + 'const MENU='.length,
                       game.indexOf('\n];', game.indexOf('const MENU=[')) + 2);
const MENU = eval(lit);
const plit = game.slice(game.indexOf('const P = {') + 'const P ='.length,
                        game.indexOf('\n};', game.indexOf('const P = {')) + 2);
const P = eval('(' + plit + ')');
const TABS = [];
{ let cur = null;
  for (let i = 0; i < MENU.length; i++) {
    if (MENU[i][1] === null) { cur = {name: MENU[i][0].replace(/[—-]/g,'').trim(), rows: []}; TABS.push(cur); }
    else if (cur) cur.rows.push(i);
  }
}

/* ── 6. join, then hand it the schema in pieces ─────────────────────────── */
const $ = id => byId.get(id);
ok(typeof sandbox.joinTap === 'function', 'Connect is wired before anything else runs');
ok($('code').value === 'WXYZ', 'the code rides in on the link', $('code').value);

sandbox.joinTap();
const peer = wire.peers[wire.peers.length - 1];
peer.fire('open');
const conn = peer.conn;
conn.open = true;
conn.fire('open');
ok(wire.sent.some(m => m.t === 'hello'), 'said hello');
ok($('panel').classList.contains('on') && !$('join').classList.contains('on'),
   'the panel is showing');

const schema = {t:'schema', venue:'cedar', venueName:'Cedar Run', menu:MENU,
                tabs:TABS.map(t => ({name:t.name, rows:t.rows})), vals:P};
{
  const s = JSON.stringify(schema), CH = 7000, n = Math.ceil(s.length / CH);
  for (let i = 0; i < n; i++) conn.fire('data', {t:'part', id:1, i, n, s:s.substr(i*CH, CH)});
  ok(n > 1, 'the schema needed more than one piece', n + ' pieces, ' + s.length + ' bytes');
}

/* ── 7. did it draw? ────────────────────────────────────────────────────── */
const rowsEl = $('rows');
const nodes = rowsEl.all();
const sliders = nodes.filter(e => e.tagName === 'INPUT' && e.type === 'range');
const actions = nodes.filter(e => e._cls.has('act'));
const groups = rowsEl.children.filter(e => e._cls.has('group'));
const tabBtns = $('tabs').children;
const settingRows = MENU.filter(r => r[1] && r[1].charAt(0) !== '!' && typeof P[r[1]] === 'number').length;
const actionRows  = MENU.filter(r => r[1] && r[1].charAt(0) === '!').length;
ok(sliders.length === settingRows, 'a slider for every setting', sliders.length + '/' + settingRows);
ok(actions.length === actionRows, 'a button for every action', actions.length + '/' + actionRows);
ok(groups.length === TABS.length && tabBtns.length === TABS.length, 'a tab per section', groups.length);
ok(groups.filter(g => g._cls.has('on')).length === 1, 'exactly one section on screen');
ok($('venue').textContent === 'Cedar Run', 'venue named', $('venue').textContent);

/* ── 8. a drag, and the echo that must not answer it ────────────────────── */
wire.sent.length = 0;
const s0 = sliders[0];
s0.fire('pointerdown');
s0.value = String(+s0.min + (+s0.max - +s0.min) * 0.5);
s0.fire('input');
runTimers();                                     /* let the coalescing timer run */
const setMsg = wire.sent.filter(m => m.t === 'set');
ok(setMsg.length === 1, 'one set per flush, however fast the thumb moves', setMsg.length);
const key = setMsg[0] && setMsg[0].k;
const mine = setMsg[0] && setMsg[0].v;

/* the headset echoes it back while the thumb is still down */
conn.fire('data', {t:'vals', v:{[key]: 0.001}});
ok(+s0.value === +mine, 'the echo did not move the slider under the thumb', s0.value);

/* let go, wait out the hold, and it answers the headset again */
s0.fire('pointerup');
conn.fire('data', {t:'vals', v:{[key]: 0.001}});
ok(+s0.value === +mine, 'still deaf inside the hold window', s0.value);

/* …and hearing again once it expires. A row that stays deaf is the worse
   failure of the two: it stops showing what the game actually holds. */
vm.runInContext('holdUntil[' + JSON.stringify(key) + '] = 0;', sandbox);
conn.fire('data', {t:'vals', v:{[key]: 0.001}});
ok(+s0.value === 0.001, 'and answering the headset once the hold expires', s0.value);

/* ── 9. a release that never reached the slider ─────────────────────────── */
{
  const s1 = sliders[1];
  s1.fire('pointerdown');
  s1.value = String(+s1.min + (+s1.max - +s1.min) * 0.25);
  s1.fire('input');
  /* the phone locked, or a system gesture ate the touch: the slider itself
     hears nothing at all */
  document._ev.visibilitychange.forEach(f => { document.visibilityState = 'hidden'; f({}); });
  document.visibilityState = 'visible';
  const held = vm.runInContext('dragKey', sandbox);
  ok(held === null, 'a lost touch still lets the row go', held);
}

/* ── 10. actions ────────────────────────────────────────────────────────── */
wire.sent.length = 0;
actions[0].fire('click');
runTimers();
const acts = wire.sent.filter(m => m.t === 'act');
ok(acts.length === 1 && acts[0].k.charAt(0) === '!', 'an action row sends its action', acts[0]);
ok(MENU.some(r => r[1] === acts[0].k), 'and it is a row the game knows', acts[0].k);

/* ── 11. search reaches into shut tabs ──────────────────────────────────── */
{
  /* a setting that is definitely not in the tab currently open */
  const target = MENU.find(r => r[1] === 'riseAggro');
  $('search').value = 'rise';
  $('search').fire('input', {target: $('search')});
  const shown = rowsEl.all().filter(e => e._cls.has('row') && !e._cls.has('hide'));
  const visible = shown.filter(r => { let p = r.parent; return p && p._cls.has('on'); });
  const labels = visible.map(r => r.all().find(x => x._cls.has('lab') || x._cls.has('act')))
                        .filter(Boolean).map(x => x.textContent);
  ok(labels.includes(target[0]), 'search found a row in a tab that is shut', labels);
  $('search').value = '';
  $('search').fire('input', {target: $('search')});
  ok(rowsEl.children.filter(g => g._cls.has('on')).length === 1, 'clearing search restores one tab');
}

/* ── 12. the stats strip ────────────────────────────────────────────────── */
conn.fire('data', {t:'hud', fps:71, nodes:116, venue:'Beaver Pond', lineOut:9.4, slack:0.3,
  offSpool:12.1, total:34, tension:14.2, tippet:21, drift:null, hand:'pinched / cork',
  feeding:3, fish:6, hooked:{pct:64, beh:'running', len:38}, note:'test fish on'});
{
  const cells = $('stats').children.map(c => c.textContent);
  ok(cells.length >= 6, 'stats drawn', cells.length);
  ok(cells.join(' ').includes('running') && cells.join(' ').includes('38'),
     'the fish on the end shows up on the phone');
  ok($('note').textContent === 'test fish on', 'and so does the note in the headset');
  ok($('venue').textContent === 'Beaver Pond', 'a venue swap renames the header');
}

/* ── 13. losing the game ────────────────────────────────────────────────── */
conn.fire('close');
ok($('lost').classList.contains('on'), 'a dropped channel says so');
ok($('panel').classList.contains('on'), 'and leaves the last values on screen');
ok($('dot').classList.contains('off'), 'the light goes red');

console.log(fails ? '\n*** ' + fails + ' FAILED ***' : '\nOK');
process.exit(fails ? 1 : 0);
