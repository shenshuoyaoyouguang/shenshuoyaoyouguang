// Combine two GitHub profile stat cards into one side-by-side SVG.
// Reads each card's real width/height from its root <svg> tag
// (falling back to viewBox), so card height drift upstream can't misalign them.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export function readDims(svg) {
  const tag = svg.match(/<svg[^>]*>/)?.[0];
  if (!tag) throw new Error('no <svg> root tag found');
  const attr = (name) => {
    const m = tag.match(new RegExp(`(?:\\s|^)${name}="([^"]+)"`));
    return m ? parseFloat(m[1]) : null;
  };
  let w = attr('width');
  let h = attr('height');
  if (w == null || h == null) {
    const vb = tag.match(/viewBox="([^"]+)"/);
    if (vb) {
      const p = vb[1].split(/[\s,]+/).map(Number);
      w = w ?? p[2];
      h = h ?? p[3];
    }
  }
  if (w == null || h == null) throw new Error(`cannot determine svg size from: ${tag}`);
  return { w, h };
}

const stripOuter = (svg) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('<'));

export function combine(svgA, svgB, { height = 400, gap = 20 } = {}) {
  const a = readDims(svgA);
  const b = readDims(svgB);
  const wA = Math.round((a.w * height) / a.h);
  const wB = Math.round((b.w * height) / b.h);
  const totalW = wA + gap + wB;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" viewBox="0 0 ${totalW} ${height}">` +
    `<svg x="0" y="0" width="${wA}" height="${height}" viewBox="0 0 ${a.w} ${a.h}">${stripOuter(svgA)}</svg>` +
    `<svg x="${wA + gap}" y="0" width="${wB}" height="${height}" viewBox="0 0 ${b.w} ${b.h}">${stripOuter(svgB)}</svg>` +
    `</svg>`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inA, inB, out] = process.argv.slice(2);
  if (!inA || !inB || !out) {
    console.error('usage: node combine-stats.mjs <stats.svg> <languages.svg> <out.svg>');
    process.exit(1);
  }
  writeFileSync(out, combine(readFileSync(inA, 'utf8'), readFileSync(inB, 'utf8')));
}
