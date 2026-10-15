// Placement du schéma « Fiches reçues » (dev 15/10/2026 : « l'idée est très bonne… mais tout se marche dessus au niveau
// des titres, je voudrais un meilleur agencement »). Trois colonnes en pixels réels, chaque texte dans son propre espace :
// le total et les deux groupes écrits DANS leurs blocs, les destinations dans une colonne d'étiquettes à droite, chacune
// centrée sur sa barre. L'écart entre deux barres voisines (GAP) dépasse la hauteur d'une étiquette : elles ne peuvent
// pas se chevaucher, sans trait de rappel. Les rubans gardent l'échelle des fiches ; un bloc trop petit pour son texte
// est agrandi autour de son ruban, sans fausser l'épaisseur.

export const FLOW = { HEAD: 30, GAP: 22, GROUP_GAP: 34, BAR_W: 8, BAR_MIN: 3, SRC_MIN: 72, MID_MIN: 48, LABEL_H: 20, WIDE: 1100 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// data : { total, given: [{key, value}], notGiven: [...] } (flowNodes) ; width : largeur réelle du schéma en pixels.
export function flowLayout(data, width) {
  const { HEAD, GAP, GROUP_GAP, BAR_W, BAR_MIN, SRC_MIN, MID_MIN, WIDE } = FLOW;
  // Carte moyenne : blocs plus étroits, la place va aux étiquettes.
  const wide = width >= WIDE;
  const SRC_W = wide ? 132 : 108, MID_W = wide ? 184 : 156;
  const groups = [
    { key: 'given', value: data.givenTotal, leaves: data.given },
    { key: 'not', value: data.notGivenTotal, leaves: data.notGiven },
  ].filter((g) => g.leaves.length);
  const count = groups.reduce((a, g) => a + g.leaves.length, 0);
  const body = clamp(250 + count * 20, 300, 440);
  const gaps = groups.reduce((a, g) => a + (g.leaves.length - 1) * GAP, 0) + (groups.length - 1) * GROUP_GAP;
  const k = Math.max(0.05, (body - gaps) / Math.max(1, data.total));

  // Colonne des destinations : barres à l'échelle, empilées par groupe.
  let y = HEAD;
  const leaves = [];
  groups.forEach((g, gi) => {
    if (gi) y += GROUP_GAP - GAP;
    g.leaves.forEach((n, i) => {
      if (i || gi) y += GAP;
      const ph = n.value * k;
      const h = Math.max(BAR_MIN, ph);
      leaves.push({ ...n, group: g.key, y, h, ph, cy: y + h / 2 });
      y += h;
    });
  });
  const height = y;

  // Blocs du milieu, centrés sur l'étendue de leurs destinations, jamais l'un sur l'autre.
  const mids = groups.map((g) => {
    const own = leaves.filter((l) => l.group === g.key);
    const ph = g.value * k;
    const h = Math.max(MID_MIN, ph);
    const center = (own[0].y + own[own.length - 1].y + own[own.length - 1].h) / 2;
    return { key: g.key, value: g.value, ph, h, y: center - h / 2 };
  });
  mids.forEach((m, i) => {
    m.y = clamp(m.y, i ? mids[i - 1].y + mids[i - 1].h + 14 : HEAD, height - m.h);
  });
  const midSpan = [mids[0].y, mids[mids.length - 1].y + mids[mids.length - 1].h];
  const srcPh = data.total * k;
  const srcH = Math.max(SRC_MIN, srcPh);
  const src = { y: clamp((midSpan[0] + midSpan[1]) / 2 - srcH / 2, HEAD, Math.max(HEAD, height - srcH)), h: srcH, ph: srcPh };

  // Colonnes : bloc source à gauche, colonne d'étiquettes à droite, le bloc du milieu entre les deux.
  const lane = wide ? clamp(Math.round(width * 0.34), 250, 420) : clamp(Math.round(width * 0.4), 270, 400);
  const xLeaf = Math.max(SRC_W + MID_W + 120, width - lane - BAR_W - 14);
  const xMid = Math.round(SRC_W + (xLeaf - SRC_W - MID_W) * 0.44);
  const x = { src: 0, mid: xMid, leaf: xLeaf, label: xLeaf + BAR_W + 12, lane: width - (xLeaf + BAR_W + 12) };

  // Rubans : source → groupe, puis groupe → destination ; épaisseur = fiches × k aux deux bouts, centrée dans son bloc.
  const band = (x0, x1, a0, a1, b0, b1) => {
    const c = (x0 + x1) / 2;
    return `M${x0},${a0} C${c},${a0} ${c},${b0} ${x1},${b0} L${x1},${b1} C${c},${b1} ${c},${a1} ${x0},${a1} Z`;
  };
  const ribbons = [];
  let s = src.y + (src.h - src.ph) / 2;
  mids.forEach((m) => {
    const t = m.y + (m.h - m.ph) / 2;
    ribbons.push({ key: `g-${m.key}`, group: m.key, from: s, to: t, size: m.ph, d: band(SRC_W, xMid, s, s + m.ph, t, t + m.ph) });
    let o = t;
    leaves.filter((l) => l.group === m.key).forEach((l) => {
      const lt = l.y + (l.h - l.ph) / 2;
      ribbons.push({ key: `l-${l.key}`, group: m.key, leaf: l.key, from: o, to: lt, size: l.ph, d: band(xMid + MID_W, xLeaf, o, o + l.ph, lt, lt + l.ph) });
      o += l.ph;
    });
    s += m.ph;
  });
  return { k, x, height, src, mids, leaves, ribbons, wide, widths: { src: SRC_W, mid: MID_W, bar: BAR_W } };
}
