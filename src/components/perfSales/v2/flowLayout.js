// Placement du schéma « Fiches reçues » (dev 15/10/2026 : « tout se marche dessus au niveau des titres », puis « on ne
// comprend pas trop ce qui est lié »). Colonnes en pixels réels, chaque texte dans son propre espace : les blocs portent
// leur chiffre et leur libellé, la dernière colonne a ses étiquettes à droite, chacune centrée sur sa barre. L'écart
// entre deux barres voisines (GAP) dépasse la hauteur d'une étiquette : elles ne peuvent pas se chevaucher. Les rubans
// gardent l'échelle des fiches ; un bloc trop petit pour son texte est agrandi autour de son ruban, sans fausser
// l'épaisseur. Un bloc se place à hauteur de ce qu'il alimente ; les liens qui sautent une colonne (autres canaux)
// passent sous ses blocs.

export const FLOW = { HEAD: 30, GAP: 22, GROUP_GAP: 30, CHANNEL_GAP: 8, BLOCK_GAP: 10, BAR_W: 8, BAR_MIN: 3, BLOCK_MIN: 28, TWO_LINES: 46,
  LABEL_H: 20, WIDE: 1100 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

// graph : { total, nodes: [{id, col, value, group}] rangés dans l'ordre d'affichage, links: [{source, target, value}] }
// (flowGraph) ; width : largeur réelle du schéma en pixels.
export function flowLayout(graph, width) {
  const { HEAD, GAP, GROUP_GAP, CHANNEL_GAP, BLOCK_GAP, BAR_W, BAR_MIN, BLOCK_MIN, TWO_LINES, WIDE } = FLOW;
  const wide = width >= WIDE;
  const last = Math.max(...graph.nodes.map((n) => n.col));
  const blockW = wide ? [124, 136, 176] : [96, 112, 148];
  const nodes = graph.nodes.map((n) => ({ ...n }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cols = Array.from({ length: last + 1 }, (_, c) => nodes.filter((n) => n.col === c));
  const leaves = cols[last];

  // Écarts de la dernière colonne : un groupe (canal) à part, les ADS séparés des autres canaux.
  const gapBefore = leaves.map((l, i) => {
    if (!i) return 0;
    const prev = leaves[i - 1];
    if ((prev.group === 'ads') !== (l.group === 'ads')) return GROUP_GAP;
    return prev.group === l.group ? GAP : GAP + CHANNEL_GAP;
  });
  const body = clamp(240 + leaves.length * 22, 320, 600);
  const k = Math.max(0.05, (body - sum(gapBefore, (g) => g)) / Math.max(1, graph.total));

  let y = HEAD;
  leaves.forEach((l, i) => {
    y += gapBefore[i];
    l.ph = l.value * k;
    l.h = Math.max(BAR_MIN, l.ph);
    l.y = y;
    l.cy = y + l.h / 2;
    y += l.h;
  });
  let height = y;

  // Colonnes amont, de droite à gauche : chaque bloc centré sur ce qu'il alimente, sans recouvrement.
  const out = (n) => graph.links.filter((l) => l.source === n.id);
  for (let c = last - 1; c >= 0; c -= 1) {
    const col = cols[c];
    col.forEach((n) => {
      n.ph = n.value * k;
      n.h = Math.max(BLOCK_MIN, n.ph);
      n.twoLines = n.h >= TWO_LINES;
      const links = out(n);
      const w = sum(links, (l) => l.value) || 1;
      n.want = sum(links, (l) => { const t = byId.get(l.target); return (t.y + t.h / 2) * l.value; }) / w;
    });
    height = Math.max(height, HEAD + sum(col, (n) => n.h) + (col.length - 1) * BLOCK_GAP);
    col.forEach((n, i) => {
      const prev = col[i - 1];
      n.y = Math.max(n.want - n.h / 2, prev ? prev.y + prev.h + BLOCK_GAP : HEAD);
    });
    for (let i = col.length - 1; i >= 0; i -= 1) {
      const next = col[i + 1];
      col[i].y = Math.min(col[i].y, next ? next.y - BLOCK_GAP - col[i].h : height - col[i].h);
    }
    col.forEach((n, i) => {
      const prev = col[i - 1];
      n.y = Math.max(n.y, prev ? prev.y + prev.h + BLOCK_GAP : HEAD);
    });
  }

  // Abscisses : trois blocs puis la barre ; la colonne d'étiquettes à droite.
  const lane = wide ? clamp(Math.round(width * 0.3), 280, 400) : clamp(Math.round(width * 0.36), 270, 360);
  const xLeaf = width - lane - BAR_W - 14;
  const span = Math.max(40, (xLeaf - sum(blockW.slice(0, last), (w) => w)) / last);
  const xs = [0];
  for (let c = 1; c <= last; c += 1) xs.push(Math.round(xs[c - 1] + blockW[c - 1] + span));
  const x = { cols: xs, leaf: xs[last], label: xs[last] + BAR_W + 12, lane: width - (xs[last] + BAR_W + 12) };

  // Ports : l'épaisseur du nœud, centrée dans son bloc ; sorties rangées par hauteur de cible, entrées par hauteur de source.
  const center = (n) => n.y + n.h / 2;
  const ribbons = [];
  const outOff = new Map(nodes.map((n) => [n.id, n.y + (n.h - n.ph) / 2]));
  const inOff = new Map(nodes.map((n) => [n.id, n.y + (n.h - n.ph) / 2]));
  const ordered = [...graph.links].sort((a, b) => center(byId.get(a.source)) - center(byId.get(b.source)) || center(byId.get(a.target)) - center(byId.get(b.target)));
  const fromY = new Map();
  for (const n of nodes) {
    graph.links.filter((l) => l.source === n.id).sort((a, b) => center(byId.get(a.target)) - center(byId.get(b.target))).forEach((l) => {
      fromY.set(l, outOff.get(n.id));
      outOff.set(n.id, outOff.get(n.id) + l.value * k);
    });
  }
  const band = (x0, x1, a0, a1, b0, b1) => {
    const c = (x0 + x1) / 2;
    return `M${x0},${a0} C${c},${a0} ${c},${b0} ${x1},${b0} L${x1},${b1} C${c},${b1} ${c},${a1} ${x0},${a1} Z`;
  };
  for (const l of ordered) {
    const s = byId.get(l.source), t = byId.get(l.target);
    const size = l.value * k;
    const from = fromY.get(l);
    const to = inOff.get(t.id);
    inOff.set(t.id, to + size);
    const x0 = xs[s.col] + blockW[s.col], x1 = xs[t.col];
    ribbons.push({ key: `${l.source}>${l.target}`, source: l.source, target: l.target, value: l.value, size, from, to, x0, x1,
      d: band(x0, x1, from, from + size, to, to + size) });
  }
  return { k, x, height, nodes, cols, leaves, ribbons, wide, blockW, widths: { bar: BAR_W } };
}

// Hauteur d'un ruban à l'abscisse x (courbe de Bézier des rubans : contrôles au milieu) : [haut, bas].
export function ribbonAt(r, xq) {
  const c = (r.x0 + r.x1) / 2;
  const at = (a, b) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i += 1) {
      const t = (lo + hi) / 2;
      const xt = (1 - t) ** 3 * r.x0 + 3 * (1 - t) ** 2 * t * c + 3 * (1 - t) * t ** 2 * c + t ** 3 * r.x1;
      if (xt < xq) lo = t; else hi = t;
    }
    const t = (lo + hi) / 2;
    return (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3 * b;
  };
  return [at(r.from, r.to), at(r.from + r.size, r.to + r.size)];
}
