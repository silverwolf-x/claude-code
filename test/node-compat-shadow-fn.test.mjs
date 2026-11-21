import { test } from 'node:test';
import assert from 'node:assert/strict';
import { astPatch, findSites } from '../scripts/node-compat-patch.mjs';
import { mayContainPatchSite } from '../scripts/patch-sites.mjs';

// ──────────────────────────────────────────────
//  P8: the bfs/ugrep shadow wrapper runs the system binary under Node, not
//  `ARGV0=bfs node …` or a ~/.local/bin/claude that does not exist.
// ──────────────────────────────────────────────

const patch = (src) => astPatch(src, 'module');

// 2.1.328, as minified: the ARGV0 lines moved into a helper (jOt), and the
// wrapper quotes two candidates, K (multicall binary) and Q (execPath).
const SRC_328 = [
  'function jOt(e,o,r,g){if(g)return[`  ARGV0=${o} ${e} ${r}`];return[`    (exec -a ${o} ${e} ${r})`]}',
  'function GOt(e,o,r=[],g=[]){let h=r.length>0?`${r.join(" ")} \\${1+"$@"}`:\'${1+"$@"}\',',
  'k=!1,R=rSe(tce(),"claude"),H=R,K=Mo([H]),Q=Mo([process.execPath]);',
  'return[`function ${e} {`,...Me(AFs)?[`  if [[ -x ${Q} ]]; then`,...jOt(Q,o,h,k),`  elif [[ -x ${K} ]]; then`,...jOt(K,o,h,k),',
  '`  else command ${e} \\${1+"$@"}; fi`]:[`  local _cc_bin="\\${X:-}"`,`  [[ -x $_cc_bin ]] || _cc_bin=${K}`,',
  '...jOt(\'"$_cc_bin"\',o,h,k)],"}"].join(`\n`)}',
].join('');

test('P8: the 2.1.328 wrapper is found although ARGV0 sits in a helper', () => {
  assert.equal(mayContainPatchSite(SRC_328), true);
  assert.equal(findSites(SRC_328, 'module').p8, true);
});

test('P8: both quoted candidates are pointed at the resolved binary', () => {
  const { code, stats } = patch(SRC_328);
  assert.equal(stats.p8, true);
  assert.match(code, /\{K=Mo\(\[_w\]\);Q=Mo\(\[_w\]\)\}\}catch\{\}return\[/);
  // Resolves the target binary (the second parameter), first line only.
  assert.match(code, /execFileSync\(_wc,\[o\]/);
  assert.match(code, /\.split\(\/\\r\?\\n\/\)\[0\]/);
  // Still parses.
  assert.doesNotThrow(() => findSites(code, 'module'));
});

test('P8: the older unquoted shape keeps assigning M', () => {
  const src = 'function AF_(e,_,r){let M=j(),q="ARGV0";return[`local _cc_bin=${M}`,"command x"]}';
  const { code, stats } = patch(src);
  assert.equal(stats.p8, true);
  assert.match(code, /\{M=_w\}\}catch\{\}return\[/);
});

test('P8: a function without the _cc_bin local is left alone', () => {
  const src = 'function f(e,o){let K=Mo([e]);return[`ARGV0=${o} command ${K}`]}';
  const { code, stats } = patch(src);
  assert.equal(stats.p8, false);
  assert.equal(code, src);
});
