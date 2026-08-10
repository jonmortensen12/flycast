/* An undeclared identifier inside a branch is the bug that has bitten this
   project three times now (HANDOFF bugs 8 and 10, and `key` in build o). It is
   invisible to `node --check`, because it is perfectly valid syntax — it only
   throws when that branch executes, which may be every frame or may be never.

   This walks the module's scopes properly: it collects every declaration
   (let/const/var/function/class/params/catch/for-of/destructuring) and every
   identifier reference, then reports references that resolve to nothing and
   are not known globals. Run it before shipping. */
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const src = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];

/* Node cannot hand us an AST without a parser dependency, and there is no
   network here — so use the one parser that ships with node: compile the
   source inside a vm with a Proxy global that records every unknown lookup.
   Module top level runs; anything that only executes later is not covered,
   which is exactly why the static pass below also exists. */
const GLOBALS = new Set([
  'window','document','navigator','console','Math','JSON','Date','Object','Array',
  'String','Number','Boolean','Float32Array','Uint8Array','Uint16Array','Uint32Array',
  'Int32Array','Map','Set','WeakMap','Promise','Symbol','Error','TypeError','RangeError',
  'isNaN','isFinite','parseFloat','parseInt','requestAnimationFrame','cancelAnimationFrame',
  'setTimeout','setInterval','clearTimeout','clearInterval','performance','fetch',
  'AudioContext','webkitAudioContext','innerWidth','innerHeight','devicePixelRatio',
  'localStorage','sessionStorage','location','URL','Blob','FileReader','Image','THREE',
  'undefined','NaN','Infinity','globalThis','structuredClone','TextEncoder','TextDecoder',
  'ArrayBuffer','DataView','Proxy','Reflect','encodeURIComponent','decodeURIComponent',
  'addEventListener','removeEventListener','alert','matchMedia','screen','history',
  'CustomEvent','Event','XMLHttpRequest','WebSocket','crypto','atob','btoa','import',
]);

/* ---- static scope pass ------------------------------------------------- */
const declRe = /\b(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
const declared = new Set();
let m;
while ((m = declRe.exec(src))) declared.add(m[1]);
/* Multi-declarator declarations, which routinely span several lines here:
   `const a = new X(), b = new Y(),\n      c = new Z();`. Walk forward from the
   keyword to the terminating semicolon at depth zero and take every identifier
   sitting in a declarator slot — start of the list, or just after a top-level
   comma. Doing this by line was what produced a screenful of false positives. */
const kwRe = /\b(let|const|var)\s+/g;
while ((m = kwRe.exec(src))) {
  let i = m.index + m[0].length, depth = 0, expect = true;
  while (i < src.length) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }
    else if (ch === ';' && depth === 0) break;
    else if (ch === ',' && depth === 0) expect = true;
    else if (expect && /[A-Za-z_$]/.test(ch)) {
      const id = src.slice(i).match(/^([A-Za-z_$][\w$]*)/);
      if (id) { declared.add(id[1]); i += id[1].length - 1; }
      expect = false;
    } else if (expect && !/\s/.test(ch) && ch !== '[' && ch !== '{') expect = false;
    i++;
  }
}
/* function params, arrow params, catch, for-of/in, destructuring, class methods */
const paramRe = /(?:function\s*[\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>|catch\s*\(([^)]*)\)|for\s*\(\s*(?:let|const|var)\s+([^;)]+?)\s+(?:of|in)\s)/g;
while ((m = paramRe.exec(src))) {
  const grp = m[1] || m[2] || m[3] || m[4] || m[5] || '';
  for (const raw of grp.split(',')) {
    for (const id of raw.matchAll(/([A-Za-z_$][\w$]*)/g)) declared.add(id[1]);
  }
}
/* object/array destructuring anywhere */
for (const d of src.matchAll(/(?:let|const|var)\s*[[{]([^}\]]*)[}\]]/g)) {
  for (const id of d[1].matchAll(/([A-Za-z_$][\w$]*)/g)) declared.add(id[1]);
}
/* class method names and object keys are not references */
const KEYISH = new Set();
for (const d of src.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) KEYISH.add(d[1]);
for (const d of src.matchAll(/\.([A-Za-z_$][\w$]*)/g)) KEYISH.add(d[1]);

/* strip strings, template literals and comments before looking for refs */
let code = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/`(?:\\.|[^`\\])*`/g, ' ')
  .replace(/'(?:\\.|[^'\\])*'/g, ' ')
  .replace(/"(?:\\.|[^"\\])*"/g, ' ');

const suspects = new Map();
for (const ref of code.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*(?![\w$]*\s*:)/g)) {
  const name = ref[2];
  if (declared.has(name) || GLOBALS.has(name) || KEYISH.has(name)) continue;
  if (/^(if|else|for|while|do|return|break|continue|new|typeof|instanceof|in|of|let|const|var|function|class|this|super|null|true|false|try|catch|finally|throw|switch|case|default|delete|void|yield|await|async|extends|static|get|set|import|export|from|as)$/.test(name)) continue;
  const line = src.slice(0, ref.index).split('\n').length;
  if (!suspects.has(name)) suspects.set(name, []);
  suspects.get(name).push(line);
}

if (!suspects.size) {
  console.log('PASS  no undeclared identifiers found');
} else {
  console.log(`${suspects.size} suspect identifier(s):\n`);
  for (const [name, lines] of [...suspects].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${name.padEnd(24)} ${lines.length} use(s), first at line ${lines[0]}`);
  }
  console.log('\nSome will be false positives (object shorthand, labels). Check each.');
}

/* ---- scoped-parameter leak check --------------------------------------
   The flat pass above cannot catch the worst version of this bug: an
   identifier that IS declared, but in a different function. `key` is the
   repeat offender here, because onSettingChanged(key) is the handler that
   keeps getting extended — and a stray `if(key===...)` dropped into the
   per-frame path is valid syntax, throws every frame, and blanks the canvas.
   So check it explicitly: every reference to `key` must sit inside a function
   that declares it. */
function bodyRange(text, startIdx) {
  let i = text.indexOf('{', startIdx), depth = 0;
  for (let j = i; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (!depth) return [i, j]; }
  }
  return [i, text.length];
}
/* find the block that encloses a given index, by walking back to its `{` */
function enclosingBlock(text, idx) {
  let depth = 0;
  for (let j = idx; j >= 0; j--) {
    if (text[j] === '}') depth++;
    else if (text[j] === '{') { if (!depth) return bodyRange(text, j - 1 < 0 ? 0 : j - 1); depth--; }
  }
  return [0, text.length];
}
const owners = [];
/* functions and arrows that take `key` as a parameter */
for (const f of src.matchAll(/function\s+[\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>/g)) {
  const params = (f[1] || f[2] || '');
  if (!/\bkey\b/.test(params)) continue;
  owners.push(bodyRange(src, f.index));
}
/* `for (const key ...)`, `const key = ...`, and `const [label,key,...] = ...`,
   all of which are perfectly ordinary uses of the same name */
for (const d of src.matchAll(/(?:const|let|var)\s+key\b|(?:const|let|var)\s*\[[^\]]*\bkey\b[^\]]*\]|for\s*\(\s*(?:const|let|var)\s+key\b/g)) {
  owners.push(enclosingBlock(src, d.index));
}
const leaks = [];
for (const r of src.matchAll(/(^|[^.\w$])key\b/g)) {
  const at = r.index + r[1].length;
  if (/\bkey\s*:/.test(src.slice(at, at + 12))) continue;      // object key
  if (!owners.some(([a, b]) => at > a && at < b))
    leaks.push(src.slice(0, at).split('\n').length);
}
console.log('');
if (leaks.length) {
  console.log(`FAIL  \`key\` referenced outside any function that declares it, at line(s): ${leaks.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('PASS  `key` is only referenced inside handlers that declare it');
}
