import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { combine } from './combine-stats.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const realStats = readFileSync(resolve(repoRoot, 'images/profile-stats.svg'), 'utf8');
const realLangs = readFileSync(resolve(repoRoot, 'images/top-languages.svg'), 'utf8');

/** Collect <svg ...> opening tags that are direct children of the root (depth === 1). */
function topLevelSvgs(out) {
  const tags = [];
  let depth = 0;
  for (const m of out.matchAll(/<\/svg>|<svg [^>]*>/g)) {
    if (m[0] === '</svg>') depth--;
    else {
      if (depth === 1) tags.push(m[0]);
      depth++;
    }
  }
  return tags;
}

/** Extract root <svg ...> tag and the two top-level wrapper svgs from combined output. */
function parts(out) {
  const rootTag = out.match(/^<svg[^>]*>/)[0];
  const rootAttrs = Object.fromEntries(
    [...rootTag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
  );
  const nested = topLevelSvgs(out).map((t) =>
    Object.fromEntries([...t.matchAll(/(\w+)="([^"]*)"/g)].map((p) => [p[1], p[2]])),
  );
  return { rootAttrs, nested };
}

test('reads real input dimensions instead of hardcoded 447x480', () => {
  // realStats is 447x459, realLangs is 410x291
  const out = combine(realStats, realLangs);
  const { nested } = parts(out);
  assert.equal(nested[0].viewBox, '0 0 447 459');
  assert.equal(nested[1].viewBox, '0 0 410 291');
});

test('aligns both card bottoms (same y and target height)', () => {
  const out = combine(realStats, realLangs);
  const { nested } = parts(out);
  for (const n of nested) {
    assert.equal(n.y, '0');
    assert.equal(n.height, '400');
  }
});

test('output root size is computed from real input dims', () => {
  const out = combine(realStats, realLangs);
  const { rootAttrs } = parts(out);
  const statsW = Math.round((447 * 400) / 459); // 390
  const langsW = Math.round((410 * 400) / 291); // 564
  assert.equal(rootAttrs.width, String(statsW + 20 + langsW));
  assert.equal(rootAttrs.height, '400');
});

test('keeps card contents intact and strips only the outer svg tag', () => {
  const out = combine(realStats, realLangs);
  // a rect unique to each input survives
  assert.match(out, /fill="#22272e"/);
  const inputInnerSvgs =
    (realStats.match(/<svg /g) || []).length + (realLangs.match(/<svg /g) || []).length - 2;
  const outInnerSvgs = (out.match(/<svg /g) || []).length - 3; // root + 2 wrappers
  assert.equal(outInnerSvgs, inputInnerSvgs);
});

test('falls back to viewBox when width/height attrs are missing', () => {
  const a = '<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="200"/></svg>';
  const b = '<svg viewBox="0 0 50 100" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="100"/></svg>';
  const out = combine(a, b);
  const { rootAttrs, nested } = parts(out);
  assert.equal(nested[0].viewBox, '0 0 100 200');
  assert.equal(nested[1].viewBox, '0 0 50 100');
  assert.equal(rootAttrs.height, '400');
});
