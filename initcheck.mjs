/* Execute the module's top level with everything stubbed, and report anything
   that throws. Two builds in a row have shipped a module-init crash that
   `node --check` waves through and that bricks the whole page — not just the
   broken feature, because a throw during init stops every listener registered
   after it from ever being attached. That is what turned a settings-panel bug
   into "Enter VR does nothing".

   This does not simulate frames. It proves the module can be loaded, which is
   the failure that takes the app down completely. */
import fs from 'fs';
import vm from 'vm';

const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(file, 'utf8');
const body = html.match(/<script type="module">([\s\S]*)<\/script>/)[1]
  .replace(/^\s*import .*?;\s*$/m, '');

/* A stub that answers every question: any property is another stub, any call
   returns a stub, and it coerces to 0 so arithmetic and loop bounds behave.
   Far shorter than hand-writing sixty Three classes, and just as effective at
   letting the real logic run until it hits a genuine mistake. */
function makeStub(label) {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'valueOf') return () => 0;
      if (k === 'toString') return () => label;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length' || k === 'count' || k === 'size') return 0;
      if (k === 'then' || k === 'catch' || k === 'finally') return () => proxy;
      if (k === 'data') return new Uint8ClampedArray(0);
      return proxy;
    },
    set() { return true; },
    has() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
    deleteProperty() { return true; },
  });
  return proxy;
}

const THREE = makeStub('THREE');
const doc = makeStub('document');
const win = makeStub('window');

const sandbox = {
  THREE, document: doc, window: win, navigator: makeStub('navigator'),
  console: { log() {}, warn() {}, error() {}, info() {} },
  Math, JSON, Date, Object, Array, String, Number, Boolean, Symbol,
  Float32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array,
  ArrayBuffer, Map, Set, WeakMap, Promise, Error, TypeError, RangeError,
  isNaN, isFinite, parseFloat, parseInt, encodeURIComponent, decodeURIComponent,
  setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {},
  requestAnimationFrame() {}, cancelAnimationFrame() {},
  performance: { now: () => 0 },
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  localStorage: makeStub('localStorage'), location: makeStub('location'),
  AudioContext: function () { return makeStub('ctx'); },
  fetch: () => Promise.resolve(makeStub('res')),
  Image: function () { return makeStub('img'); },
  structuredClone: v => v,
  /* bare globals the page uses without a `window.` prefix */
  addEventListener() {}, removeEventListener() {}, alert() {},
  matchMedia: () => makeStub('mq'), atob: s => s, btoa: s => s,
  URL: makeStub('URL'), Blob: function () { return makeStub('blob'); },
  XMLHttpRequest: function () { return makeStub('xhr'); },
  CustomEvent: function () { return makeStub('ev'); },
  getComputedStyle: () => makeStub('style'),
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

let ok = true;
try {
  vm.createContext(sandbox);
  new vm.Script(body, { filename: 'flycast-module.js' }).runInContext(sandbox, { timeout: 20000 });
  console.log('PASS  module top level executed without throwing');
} catch (e) {
  ok = false;
  console.log('FAIL  module init threw — the page will be dead, buttons included\n');
  console.log('  ' + (e && e.message ? e.message : e));
  const line = (e && e.stack || '').match(/flycast-module\.js:(\d+)/);
  if (line) {
    const n = Number(line[1]);
    const src = body.split('\n');
    console.log('\n  module line ' + n + ':');
    for (let i = Math.max(0, n - 3); i < Math.min(src.length, n + 2); i++)
      console.log('   ' + (i === n - 1 ? '>' : ' ') + ' ' + String(i + 1).padStart(5) + '  ' + src[i].slice(0, 96));
  }
}
process.exitCode = ok ? 0 : 1;
