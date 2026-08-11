/* Static checks on every GLSL template literal in index.html.
   These exist because two shader bugs shipped in one build and neither was
   catchable by the JS smoke harness — a shader that fails to compile is not a
   JS error, it is a silently missing object. Symptom both times: the water was
   not drawn at all, which reads as perfect clarity, and every water setting
   appeared dead because there was nothing being shaded.

   1. DUPLICATE DECLARATION. `float fr` was declared twice in one scope. GLSL
      rejects it; the program never links.
   2. BACKTICK INSIDE A SHADER COMMENT. A shader lives in a JS template
      literal, so a backtick in a GLSL comment ends the string early and
      truncates the shader mid-function. Prose backticks are a natural thing to
      type and completely invisible when reading the diff.

   Run: node glslcheck.mjs
*/
import fs from 'fs';

const src = fs.readFileSync('index.html', 'utf8');
let fail = 0;

/* ---- pull every template literal that looks like GLSL ---- */
const shaders = [];
const keyRe = /(vertexShader|fragmentShader|const GLSL_[A-Z_]+)\s*[:=]\s*`/g;
let m;
while ((m = keyRe.exec(src))) {
  const name = m[1];
  const startLine = src.slice(0, m.index).split('\n').length;
  let k = m.index + m[0].length, out = '', truncated = false;
  while (k < src.length) {
    if (src[k] === '\\') { out += src[k] + src[k + 1]; k += 2; continue; }
    if (src[k] === '$' && src[k + 1] === '{') {          /* JS interpolation */
      let d = 1, n = k + 2;
      while (n < src.length && d > 0) { if (src[n] === '{') d++; if (src[n] === '}') d--; n++; }
      out += '0.0'; k = n; continue;
    }
    if (src[k] === '`') break;
    out += src[k]; k++;
  }
  if (k >= src.length) truncated = true;
  /* a block that pulled in shared chunks cannot be checked for unused uniforms:
     the chunk that reads them was replaced by a placeholder */
  const hadIncludes = /\$\{GLSL_/.test(src.slice(m.index, k));
  shaders.push({ name, startLine, body: out, truncated, hadIncludes });
}
console.log(`found ${shaders.length} GLSL blocks`);

for (const sh of shaders) {
  const where = `${sh.name} (line ${sh.startLine})`;

  if (sh.truncated) { console.log(`  FAIL ${where}: unterminated template literal`); fail++; }

  /* --- 2. backtick inside a comment ---
     Scanned, not regexed: comment prose routinely contains comment delimiters
     and a regex count gives false alarms. What actually matters is whether the
     block ENDS while still inside a comment, which is precisely what a stray
     backtick causes. */
  let code = '', inBlock = false, inLine = false;
  for (let i = 0; i < sh.body.length; i++) {
    const c = sh.body[i], d = sh.body[i + 1];
    if (inBlock) { if (c === '*' && d === '/') { inBlock = false; i++; } continue; }
    if (inLine) { if (c === '\n') { inLine = false; code += c; } continue; }
    if (c === '/' && d === '*') { inBlock = true; i++; continue; }
    if (c === '/' && d === '/') { inLine = true; i++; continue; }
    code += c;
  }
  if (inBlock) {
    console.log(`  FAIL ${where}: block ends inside a comment — a backtick in GLSL prose truncates the shader`);
    fail++;
  }

  /* --- brace balance --- */
  const ob = (code.match(/{/g) || []).length, cb = (code.match(/}/g) || []).length;
  if (ob !== cb) { console.log(`  FAIL ${where}: braces ${ob} vs ${cb}`); fail++; }

  /* --- 1. duplicate declarations IN THE SAME SCOPE ---
     Scope-aware: a name may legitimately repeat in a sibling function or a
     nested block, and flagging those buries the one that matters. */
  let seen = [{}];
  code.split('\n').forEach((l, i) => {
    for (const ch of l) {
      if (ch === '{') seen.push({});
      else if (ch === '}' && seen.length > 1) seen.pop();
    }
    const d = l.match(/^\s*(?:const\s+)?(float|vec2|vec3|vec4|int|bool|mat2|mat3|mat4)\s+([^;=]+(?:=[^;]*)?);/);
    if (!d) return;
    let depth = 0, cur = '', parts = [];
    for (const ch of d[2]) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    for (const p of parts) {
      const n = p.trim().split('=')[0].trim();
      if (!n || /[()\[\]]/.test(n)) continue;
      const scope = seen[seen.length - 1];
      if (scope[n] !== undefined) {
        console.log(`  FAIL ${where}: duplicate declaration of '${n}' in one scope (shader lines ${scope[n] + 1}, ${i + 1})`);
        fail++;
      } else scope[n] = i;
    }
  });

  /* --- uniforms declared but never used, and vice versa --- */
  const declaredU = new Set();
  (code.match(/^\s*uniform\s+\w+\s+([^;]+);/gm) || []).forEach(u => {
    u.replace(/^\s*uniform\s+\w+\s+/, '').replace(/;/, '')
      .split(',').forEach(n => declaredU.add(n.trim()));
  });
  const bodyOnly = code.replace(/^\s*uniform[^;]+;/gm, '');
  for (const u of (sh.hadIncludes ? [] : declaredU)) {
    if (!new RegExp(`\\b${u.replace(/\[.*\]/,'')}\\b`).test(bodyOnly))
      console.log(`  warn ${where}: uniform '${u}' declared but never read`);
  }
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall GLSL blocks pass');
process.exit(fail ? 1 : 0);
