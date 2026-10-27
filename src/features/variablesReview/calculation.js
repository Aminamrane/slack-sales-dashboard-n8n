/** Exact rational arithmetic. Money is rounded only for display, never between operations. */
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
export class Rational {
  constructor(n, d = 1n) {
    if (!d) throw new Error("Division par zéro");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  static from(value) {
    const m = String(value)
      .trim()
      .match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if (!m) throw new Error("Nombre invalide");
    const exponent = Number(m[4] || 0) - (m[3]?.length || 0);
    if (Math.abs(exponent) > 100) throw new Error("Nombre hors limites");
    const n = BigInt(m[2] + (m[3] || "")) * (m[1] === "-" ? -1n : 1n);
    return exponent >= 0
      ? new Rational(n * 10n ** BigInt(exponent))
      : new Rational(n, 10n ** BigInt(-exponent));
  }
  add(b) {
    return new Rational(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(b) {
    return new Rational(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(b) {
    return new Rational(this.n * b.n, this.d * b.d);
  }
  div(b) {
    return new Rational(this.n * b.d, this.d * b.n);
  }
  negate() {
    return new Rational(-this.n, this.d);
  }
  toFixed(digits = 2) {
    const sign = this.n < 0n ? "-" : "";
    const n = this.n < 0n ? -this.n : this.n;
    const scaled = n * 10n ** BigInt(digits);
    let q = scaled / this.d;
    if ((scaled % this.d) * 2n >= this.d) q += 1n;
    const s = q.toString().padStart(digits + 1, "0");
    return (
      (q ? sign : "") +
      (digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s)
    );
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  } // Reconciliation only, not calculations.
}
export const ZERO = new Rational(0n);
const columnNumber = (s) =>
  [...s].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0);
const columnName = (n) => {
  let s = "";
  while (n) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
};
function expandRange(a, b) {
  const x = a.match(/^([A-Z]+)(\d+)$/),
    y = b.match(/^([A-Z]+)(\d+)$/);
  const r1 = Number(x[2]),
    r2 = Number(y[2]),
    c1 = columnNumber(x[1]),
    c2 = columnNumber(y[1]);
  if (r2 < r1 || c2 < c1 || (r2 - r1 + 1) * (c2 - c1 + 1) > 10000)
    throw new Error("Plage invalide ou trop grande");
  const result = [];
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) result.push(`${columnName(c)}${r}`);
  return result;
}
export function parseFormula(input) {
  const text = input.slice(1).replace(/\$/g, "").toUpperCase();
  if (text.length > 4000) throw new Error("Formule trop longue");
  let pos = 0,
    tokens = [];
  const re = /\s*(\d+(?:\.\d*)?(?:E[+-]?\d+)?|[A-Z]+\d+|[A-Z]+|[()+\-*/%,;:])/y;
  while (pos < text.length) {
    if (!text.slice(pos).trim()) break;
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m)
      throw new Error(`Syntaxe non prise en charge à la position ${pos + 1}`);
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  if (tokens.length > 1000) throw new Error("Formule trop complexe");
  let i = 0,
    depth = 0;
  const take = () => tokens[i++];
  const expect = (t) => {
    if (take() !== t) throw new Error(`« ${t} » attendu`);
  };
  function atom() {
    if (++depth > 80) throw new Error("Formule trop imbriquée");
    let node;
    const t = take();
    if (t === "+" || t === "-") node = { type: "unary", op: t, node: atom() };
    else if (t === "(") {
      node = expr();
      expect(")");
    } else if (/^\d/.test(t || "")) node = { type: "number", value: t };
    else if (/^[A-Z]+\d+$/.test(t || "")) node = { type: "ref", ref: t };
    else if (t === "SUM" || t === "SOMME") {
      expect("(");
      const args = [];
      do {
        let a = expr();
        if (tokens[i] === ":") {
          take();
          const end = take();
          if (a.type !== "ref" || !/^[A-Z]+\d+$/.test(end || ""))
            throw new Error("Plage invalide");
          a = { type: "range", refs: expandRange(a.ref, end) };
        }
        args.push(a);
        if (tokens[i] !== "," && tokens[i] !== ";") break;
        take();
      } while (i < tokens.length);
      expect(")");
      node = { type: "sum", args };
    } else throw new Error(`Élément non pris en charge : ${t || "vide"}`);
    while (tokens[i] === "%") {
      take();
      node = { type: "percent", node };
    }
    depth--;
    return node;
  }
  function product() {
    let node = atom();
    while (["*", "/"].includes(tokens[i])) {
      const op = take();
      node = { type: "binary", op, left: node, right: atom() };
    }
    return node;
  }
  function expr() {
    let node = product();
    while (["+", "-"].includes(tokens[i])) {
      const op = take();
      node = { type: "binary", op, left: node, right: product() };
    }
    return node;
  }
  const ast = expr();
  if (i !== tokens.length) throw new Error("Fin de formule invalide");
  return ast;
}
function collect(ast, refs) {
  if (ast.type === "ref") refs.add(ast.ref);
  if (ast.type === "range") ast.refs.forEach((x) => refs.add(x));
  if (ast.node) collect(ast.node, refs);
  if (ast.left) {
    collect(ast.left, refs);
    collect(ast.right, refs);
  }
  if (ast.args) ast.args.forEach((a) => collect(a, refs));
}
export function createCalculator(cells, changes = {}) {
  const cache = new Map(),
    trees = new Map(),
    visiting = new Set();
  const raw = (ref) =>
    Object.hasOwn(changes, ref) ? changes[ref] : (cells[ref]?.input ?? "");
  function ast(ref) {
    if (!trees.has(ref)) trees.set(ref, parseFormula(String(raw(ref))));
    return trees.get(ref);
  }
  function evaluateNode(node, sumArgument = false) {
    switch (node.type) {
      case "number":
        return Rational.from(node.value);
      case "ref":
        return value(node.ref, sumArgument);
      case "unary": {
        const x = evaluateNode(node.node);
        return node.op === "-" ? x.negate() : x;
      }
      case "percent":
        return evaluateNode(node.node).div(Rational.from("100"));
      case "binary": {
        const a = evaluateNode(node.left),
          b = evaluateNode(node.right);
        return {
          "+": () => a.add(b),
          "-": () => a.sub(b),
          "*": () => a.mul(b),
          "/": () => a.div(b),
        }[node.op]();
      }
      case "range":
        return node.refs.reduce((n, r) => n.add(value(r, true)), ZERO);
      case "sum":
        return node.args.reduce((n, a) => n.add(evaluateNode(a, true)), ZERO);
      default:
        throw new Error("Opération non prise en charge");
    }
  }
  function value(ref, allowText = false) {
    if (cache.has(ref)) return cache.get(ref);
    const input = raw(ref);
    if (input === "" || input == null) return ZERO;
    if (typeof input !== "string" || !input.startsWith("=")) {
      try {
        return Rational.from(input);
      } catch {
        if (allowText) return ZERO;
        throw new Error(`La cellule ${ref} contient du texte`);
      }
    }
    if (visiting.has(ref)) throw new Error(`Référence circulaire : ${ref}`);
    if (visiting.size >= 100)
      throw new Error("Chaîne de références trop longue");
    visiting.add(ref);
    try {
      const result = evaluateNode(ast(ref));
      cache.set(ref, result);
      return result;
    } finally {
      visiting.delete(ref);
    }
  }
  function dependencies(ref, { recursive = false, stopAt = null } = {}) {
    const all = new Set(),
      seen = new Set();
    function walk(key) {
      if (seen.has(key)) return;
      seen.add(key);
      if (!String(raw(key)).startsWith("=")) return;
      const direct = new Set();
      collect(ast(key), direct);
      direct.forEach((r) => {
        all.add(r);
        if (recursive && !(stopAt && stopAt(r))) walk(r);
      });
    }
    walk(ref);
    return [...all];
  }
  return {
    raw,
    value,
    dependencies,
    evaluate: (formula) => evaluateNode(parseFormula(formula)),
  };
}
export function money(value) {
  if (value == null) return "—";
  const fixed = value.toFixed(2),
    [whole, cents] = fixed.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")},${cents}\u00a0€`;
}
export function normalizeInput(value) {
  const s = String(value).trim();
  if (s.startsWith("=")) return s;
  const clean = s.replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  Rational.from(clean);
  return clean;
}
export function reconcile(cells) {
  const calculator = createCalculator(cells);
  const results = [];
  for (const [ref, cell] of Object.entries(cells)) {
    if (cell.kind !== "formula") continue;
    try {
      const result = calculator.value(ref),
        cached = cell.cached;
      const difference =
        typeof cached === "number"
          ? Math.abs(result.toNumber() - cached)
          : null;
      results.push({
        ref,
        match: difference !== null && difference < 0.0001,
        calculated: result.toFixed(8),
        cached,
        difference,
      });
    } catch (e) {
      results.push({
        ref,
        match: false,
        error: e.message,
        cached: cell.cached,
      });
    }
  }
  return results;
}
