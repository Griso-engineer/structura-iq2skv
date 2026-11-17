/* Onglet « Lignes de contraintes » : trajectoires des contraintes principales (compression en bleu,
   traction en rouge) pour des poutres, un arc et un voile percé. Outil pédagogique, pas un calcul de
   justification.
   Conventions (README) : y vers le haut dans le plan du dessin, N > 0 traction, M > 0 fibre inférieure
   tendue, V = dM/dx. Contraintes en kPa (kN/m²). */
(function (S) {
  'use strict';
  const el = S.el, sv = S.svg;
  S.pages = S.pages || {};

  // ------------------------------------------------------------------ champ de contraintes sur grille
  /* Le champ est échantillonné aux nœuds d'une grille régulière (x0 + i·dx, y0 + j·dy) :
     sx, sy, txy (Float64Array, index j·(nx+1)+i) et cell[j·nx+i] = 1 si la maille est dans la matière. */
  function makeField(x0, y0, x1, y1, nx, ny) {
    const N = (nx + 1) * (ny + 1);
    return { x0, y0, x1, y1, nx, ny, dx: (x1 - x0) / nx, dy: (y1 - y0) / ny,
      sx: new Float64Array(N), sy: new Float64Array(N), txy: new Float64Array(N), cell: new Uint8Array(nx * ny) };
  }
  // tenseur interpolé (bilinéaire) en (x, y), null hors matière
  function tensorAt(F, x, y) {
    const u = (x - F.x0) / F.dx, v = (y - F.y0) / F.dy;
    if (u < 0 || v < 0 || u > F.nx || v > F.ny) return null;
    const i = Math.min(F.nx - 1, Math.floor(u)), j = Math.min(F.ny - 1, Math.floor(v));
    if (!F.cell[j * F.nx + i]) return null;
    const a = u - i, b = v - j, w = F.nx + 1, k = j * w + i;
    const L = A => (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + w] * (1 - a) + A[k + w + 1] * a) * b;
    return [L(F.sx), L(F.sy), L(F.txy)];
  }
  // contraintes principales : σ1 ≥ σ2, θ1 direction de σ1
  function principal(t) {
    const [sx, sy, txy] = t, c = (sx + sy) / 2, R = Math.hypot((sx - sy) / 2, txy);
    return { s1: c + R, s2: c - R, R, th: 0.5 * Math.atan2(2 * txy, sx - sy) };
  }

  // ------------------------------------------------------------------ trajectoires (RK4 + Jobard-Lefer)
  /* Famille 1 : direction de σ1 ; famille 2 : direction de σ2. Chaque ligne est intégrée dans les deux
     sens par Runge-Kutta 4 dans le champ de directions (le signe du vecteur propre est aligné sur le pas
     précédent), puis l'espacement est régularisé à la manière de Jobard et Lefer : une ligne s'arrête à
     moins de dtest d'une autre ligne de la même famille, et de nouvelles graines sont posées à dsep de
     part et d'autre des lignes existantes. Arrêt aux points singuliers (σ1 ≈ σ2). */
  function trajectories(F, fam, dsep, opts = {}) {
    const dtest = dsep * 0.5, h = dsep * 0.2, maxSteps = opts.maxSteps || 4000;
    let Rmax = 0;
    for (let k = 0; k < F.sx.length; k++) Rmax = Math.max(Rmax, Math.hypot((F.sx[k] - F.sy[k]) / 2, F.txy[k]));
    const Rmin = Rmax * (opts.singular || 0.004);
    const dir = (x, y, px, py) => {
      const t = tensorAt(F, x, y);
      if (!t) return null;
      const p = principal(t);
      if (p.R < Rmin) return null;
      const a = fam === 1 ? p.th : p.th + Math.PI / 2;
      let dx = Math.cos(a), dy = Math.sin(a);
      if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
      return [dx, dy, fam === 1 ? p.s1 : p.s2];
    };
    // grille d'accélération des points déjà tracés
    const cs = dsep, gx = Math.ceil((F.x1 - F.x0) / cs) + 1, gy = Math.ceil((F.y1 - F.y0) / cs) + 1;
    const bins = new Map();
    const key = (x, y) => Math.floor((y - F.y0) / cs) * gx + Math.floor((x - F.x0) / cs);
    const near = (x, y, d, own) => {
      const ci = Math.floor((x - F.x0) / cs), cj = Math.floor((y - F.y0) / cs);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const b = bins.get(j * gx + i);
        if (!b) continue;
        for (const p of b) if (p[2] !== own && (p[0] - x) ** 2 + (p[1] - y) ** 2 < d * d) return true;
      }
      return false;
    };
    const add = (pts, id) => pts.forEach(p => { const k = key(p[0], p[1]); if (!bins.has(k)) bins.set(k, []); bins.get(k).push([p[0], p[1], id]); });
    const half = (x, y, px, py, id) => {
      const out = [];
      let d0 = dir(x, y, px, py);
      if (!d0) return out;
      let vx = d0[0], vy = d0[1];
      for (let n = 0; n < maxSteps; n++) {
        const k1 = dir(x, y, vx, vy); if (!k1) break;
        const k2 = dir(x + h / 2 * k1[0], y + h / 2 * k1[1], k1[0], k1[1]); if (!k2) break;
        const k3 = dir(x + h / 2 * k2[0], y + h / 2 * k2[1], k2[0], k2[1]); if (!k3) break;
        const k4 = dir(x + h * k3[0], y + h * k3[1], k3[0], k3[1]); if (!k4) break;
        let mx = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, my = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
        const l = Math.hypot(mx, my); if (l < 1e-9) break;
        mx /= l; my /= l;
        const nx = x + h * mx, ny = y + h * my;
        if (!tensorAt(F, nx, ny) || near(nx, ny, dtest, id)) break;
        // boucle fermée : retour près du départ
        if (n > 20 && out.length && (nx - out[0][0]) ** 2 + (ny - out[0][1]) ** 2 < h * h) break;
        x = nx; y = ny; vx = mx; vy = my;
        out.push([x, y, k1[2]]);
      }
      return out;
    };
    const lines = [];
    let id = 0;
    const trace = (x, y) => {
      const t = tensorAt(F, x, y);
      if (!t || near(x, y, dsep * 0.9, -1)) return null;
      const d = dir(x, y, 1, 0.001);
      if (!d) return null;
      id++;
      const fw = half(x, y, d[0], d[1], id), bw = half(x, y, -d[0], -d[1], id);
      const pts = [...bw.reverse(), [x, y, d[2]], ...fw];
      if (pts.length < 4) return null;
      add(pts, id);
      const line = { pts, id };
      lines.push(line);
      return line;
    };
    const queue = [];
    const seedsFrom = line => {
      const p = line.pts, step = Math.max(1, Math.round(dsep / h / 2));
      for (let k = 1; k < p.length - 1; k += step) {
        const tx = p[k + 1][0] - p[k - 1][0], ty = p[k + 1][1] - p[k - 1][1], l = Math.hypot(tx, ty) || 1;
        for (const sgn of [1, -1]) {
          const nl = trace(p[k][0] - sgn * ty / l * dsep, p[k][1] + sgn * tx / l * dsep);
          if (nl) queue.push(nl);
        }
      }
    };
    // graines initiales : centre, puis grille grossière pour les zones isolées (autour des ouvertures)
    const seeds = opts.seeds || [];
    const sx = Math.max(3, Math.round((F.x1 - F.x0) / (dsep * 3))), sy = Math.max(2, Math.round((F.y1 - F.y0) / (dsep * 3)));
    for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) seeds.push([F.x0 + (F.x1 - F.x0) * (i + 0.5) / (sx + 1), F.y0 + (F.y1 - F.y0) * (j + 0.5) / (sy + 1)]);
    for (const [x, y] of seeds) {
      const l = trace(x, y);
      if (l) queue.push(l);
      while (queue.length) seedsFrom(queue.shift());
    }
    return lines;
  }

  // ------------------------------------------------------------------ modèles de poutre (solveur fem.js)
  const custom = (b, h, E) => ({ sec: 'custom', E, A: b * h * 1e4, I: b * h ** 3 / 12 * 1e8, h: h * 1000, rho: 25 });
  /* Efforts N, V, M le long d'une poutre droite horizontale : concaténation des échantillons des barres. */
  function beamForces(model) {
    const r = S.fem.solve(model);
    if (!r.ok) return null;
    const xs = [], N = [], V = [], M = [];
    r.elems.forEach(e => {
      const xa = model.nodes[model.elems[e.index - 1].n1 - 1].x;
      e.xs.forEach((x, k) => { xs.push(xa + x); N.push(e.N[k]); V.push(e.V[k]); M.push(e.M[k]); });
    });
    return { res: r, xs, N, V, M };
  }
  const interp = (xs, ys, x) => {
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[hi]) return ys[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    const t = (x - xs[lo]) / ((xs[hi] - xs[lo]) || 1);
    return ys[lo] + (ys[hi] - ys[lo]) * t;
  };
  /* Contraintes d'une section rectangulaire b × h (théorie des poutres), y mesuré depuis l'axe vers le haut :
     σx = N/A − M·y/I ; τxy = −1,5·V/A·(1 − 4y²/h²) (équilibre ∂σx/∂x + ∂τ/∂y = 0 avec V = dM/dx). */
  const sectionStress = (N, V, M, y, b, h) => {
    const A = b * h, I = b * h ** 3 / 12;
    return [N / A - M * y / I, 0, -1.5 * V / A * (1 - 4 * y * y / (h * h))];
  };

  // ------------------------------------------------------------------ cas d'étude
  const BEAM_P = (L, extra = []) => [
    ['L', 'Portée L', 2, 12, 0.5, L, 'm'], ['h', 'Hauteur h', 0.3, 3, 0.05, 1.2, 'm'], ['b', 'Largeur b', 0.1, 1, 0.05, 0.3, 'm'],
    ['q', 'Charge répartie q', 0, 100, 1, 20, 'kN/m'], ...extra];
  const CASES = {
    iso: {
      label: 'Poutre sur deux appuis', group: 'Poutres',
      svg: '<path d="M4 13 H48 V19 H4 Z" fill="#e7e6e1"/><path d="M6 19 l-3 5 h6 z M46 19 l-3 5 h6 z"/>',
      params: BEAM_P(6, [['P', 'Charge ponctuelle P', 0, 300, 5, 0, 'kN'], ['a', 'Position de P (a/L)', 0.1, 0.9, 0.05, 0.5, '']]),
      build: p => beamCase(p, [0, p.L], ['rotule', 'appui'], p.P ? [p.a * p.L] : [], [])
    },
    console: {
      label: 'Console', group: 'Poutres',
      svg: '<path d="M8 13 H48 V19 H8 Z" fill="#e7e6e1"/><path d="M8 8 V24 M8 10 l-4 3 M8 15 l-4 3 M8 20 l-4 3"/>',
      params: [['L', 'Portée L', 1, 8, 0.25, 3, 'm'], ['h', 'Hauteur h', 0.3, 2, 0.05, 0.8, 'm'], ['b', 'Largeur b', 0.1, 1, 0.05, 0.3, 'm'],
        ['q', 'Charge répartie q', 0, 100, 1, 20, 'kN/m'], ['P', 'Charge en bout P', 0, 300, 5, 0, 'kN']],
      build: p => beamCase(p, [0, p.L], ['encastrement', 'libre'], p.P ? [p.L] : [], [])
    },
    continue: {
      label: 'Poutre continue sur 3 appuis', group: 'Poutres',
      svg: '<path d="M2 13 H50 V19 H2 Z" fill="#e7e6e1"/><path d="M3 19 l-3 5 h6 z M26 19 l-3 5 h6 z M49 19 l-3 5 h6 z"/>',
      params: [['L1', 'Portée L1', 2, 10, 0.5, 5, 'm'], ['L2', 'Portée L2', 2, 10, 0.5, 5, 'm'], ['h', 'Hauteur h', 0.3, 3, 0.05, 1.0, 'm'],
        ['b', 'Largeur b', 0.1, 1, 0.05, 0.3, 'm'], ['q', 'Charge répartie q', 0, 100, 1, 20, 'kN/m']],
      build: p => beamCase(Object.assign({}, p, { L: p.L1 + p.L2 }), [0, p.L1, p.L1 + p.L2], ['rotule', 'appui', 'appui'], [], [])
    }
  };

  /* Poutre droite : nœuds aux appuis et aux charges ponctuelles ; champ σx, τxy sur la grille (x, y). */
  function beamCase(p, xsup, sups, xP, _) {
    const L = p.L, h = p.h, b = p.b, E = 30000;
    const xsN = [...new Set([...xsup, ...xP].map(x => +x.toFixed(6)))].sort((a, c) => a - c);
    const nodes = xsN.map(x => ({ x, y: 0, sup: sups[xsup.findIndex(s => Math.abs(s - x) < 1e-6)] || 'libre' }));
    const elems = xsN.slice(1).map((_, k) => Object.assign({ n1: k + 1, n2: k + 2 }, custom(b, h, E)));
    const eloads = elems.map((e, k) => ({ elem: k + 1, type: 'udl', dir: 'g', q: p.q, a: 0 }));
    const nloads = xP.map(x => ({ node: xsN.findIndex(v => Math.abs(v - x) < 1e-6) + 1, Fx: 0, Fy: p.P })); // Fy > 0 vers le bas
    const model = { nodes, elems, eloads, nloads };
    const f = beamForces(model);
    if (!f) return { error: 'Système instable.' };
    const nx = Math.max(120, Math.round(240 * Math.min(1, L / (L + h)) + 60)), ny = Math.max(24, Math.round(nx * h / L));
    const F = makeField(0, -h / 2, L, h / 2, nx, ny);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = F.x0 + i * F.dx, y = F.y0 + j * F.dy, k = j * (nx + 1) + i;
      const t = sectionStress(interp(f.xs, f.N, x), interp(f.xs, f.V, x), interp(f.xs, f.M, x), y, b, h);
      F.sx[k] = t[0]; F.sy[k] = t[1]; F.txy[k] = t[2];
    }
    F.cell.fill(1);
    // zones de perturbation (Saint-Venant) : une hauteur h de part et d'autre des appuis et des charges ponctuelles
    const zones = [...xsup.filter((x, k) => sups[k] !== 'libre'), ...xP].map(x => [Math.max(0, x - h), Math.min(L, x + h)]);
    return { F, zones, outline: [[[0, -h / 2], [L, -h / 2], [L, h / 2], [0, h / 2]]], supports: nodes.filter(n => n.sup !== 'libre'),
      loads: { q: p.q, top: h / 2, x0: 0, x1: L, P: xP.map(x => [x, p.P]) }, forces: f, h, L,
      checks: beamChecks(F, f, p, zones) };
  }

  // vérifications : 45° sur l'axe neutre là où M ≈ 0 et V ≠ 0 ; trajectoires horizontales aux fibres extrêmes
  function beamChecks(F, f, p, zones) {
    const out = [];
    const ang = t => Math.abs(principal(t).th * 180 / Math.PI);
    // abscisse où |V| est maximal hors des zones d'appui, sur l'axe neutre (σx = N/A ≈ 0 en flexion simple)
    let xV = null, best = 0;
    const free = x => !zones.some(([a, b]) => x >= a && x <= b);
    f.xs.forEach((x, k) => { if (free(x) && Math.abs(f.V[k]) > best && Math.abs(f.N[k]) < 1e-6) { best = Math.abs(f.V[k]); xV = x; } });
    if (xV != null) {
      const t = tensorAt(F, xV, 0), a = ang(t);
      out.push({ label: `Axe neutre en x = ${S.fmt(xV, 2)} m : directions principales à 45°`, val: `${S.fmt(a, 1)}° / ${S.fmt(90 - a, 1)}°`, ok: Math.abs(a - 45) < 1 });
    }
    // fibre extrême au moment maximal
    let xM = 0, Mm = 0;
    f.xs.forEach((x, k) => { if (Math.abs(f.M[k]) > Mm) { Mm = Math.abs(f.M[k]); xM = x; } });
    const yT = F.y1 - 1e-6, t = tensorAt(F, Math.min(F.x1 - 1e-6, xM), yT), a = Math.min(ang(t), 90 - ang(t));
    out.push({ label: `Fibre supérieure au moment maximal (x = ${S.fmt(xM, 2)} m) : trajectoires horizontale et verticale`, val: `écart ${S.fmt(a, 2)}°`, ok: a < 1 });
    return out;
  }

  // ------------------------------------------------------------------ rendu SVG
  function drawCase(c, opts) {
    const W = 920, pad = 34;
    const xs = c.outline.flat().map(p => p[0]), ys = c.outline.flat().map(p => p[1]);
    const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
    const k = (W - 2 * pad) / (X1 - X0), H = (Y1 - Y0) * k + 2 * pad + 40;
    const X = x => pad + (x - X0) * k, Y = y => pad + 30 + (Y1 - y) * k;
    const g = sv('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, class: 'diag lc-svg' });
    g.append(sv('defs', {}, sv('pattern', { id: 'lc-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      sv('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#9a9994', 'stroke-width': 1.2 }))));
    c.outline.forEach(poly => g.append(sv('path', { d: 'M' + poly.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L') + 'Z', class: 'lc-body' })));
    (c.holes || []).forEach(poly => g.append(sv('path', { d: 'M' + poly.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L') + 'Z', class: 'lc-hole' })));
    if (c.map) g.append(c.map(X, Y, k));
    // trajectoires : couleur selon le signe de la contrainte principale le long de la ligne
    const smax = opts.smax;
    [[1, opts.fam1], [2, opts.fam2]].forEach(([fam, on]) => {
      if (!on) return;
      c.lines[fam].forEach(l => {
        let seg = [], sgn = null;
        const flush = () => { if (seg.length > 1) g.append(sv('path', { class: 'lc-line ' + (sgn > 0 ? 't' : 'c'), d: 'M' + seg.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L') })); };
        l.pts.forEach(p => {
          const s = Math.abs(p[2]) < 1e-9 * smax ? sgn : Math.sign(p[2]);
          if (sgn != null && s !== sgn) { seg.push(p); flush(); seg = [p]; } else seg.push(p);
          sgn = s;
        });
        flush();
      });
    });
    (c.zones || []).forEach(([a, b]) => {
      g.append(sv('rect', { x: X(a), y: Y(c.h / 2), width: (b - a) * k, height: c.h * k, fill: 'url(#lc-hatch)', class: 'lc-zone' },
        sv('title', {}, 'Zone de perturbation : théorie des poutres non valable ici')));
    });
    if (c.extra) g.append(c.extra(X, Y, k));
    // appuis et charges
    (c.supports || []).forEach(n => {
      const x = X(n.x), y = Y(c.supY != null ? c.supY : -c.h / 2);
      if (n.sup === 'encastrement') g.append(sv('path', { class: 'lc-sup', d: `M${x} ${y - c.h * k / 2 - 10} V${y + 10} M${x} ${y - 4} l-7 7 M${x} ${y - c.h * k / 2 + 6} l-7 7 M${x} ${y - c.h * k / 4} l-7 7` }));
      else g.append(sv('path', { class: 'lc-sup', d: `M${x} ${y} l-8 13 h16 z M${x - 12} ${y + 17} h24` }));
    });
    const L = c.loads;
    if (L && L.q > 0) {
      const y = Y(L.top) - 4, n = Math.max(6, Math.round((L.x1 - L.x0) * k / 34));
      for (let i = 0; i <= n; i++) { const x = X(L.x0 + (L.x1 - L.x0) * i / n); g.append(sv('path', { class: 'lc-load', d: `M${x} ${y - 20} V${y} M${x - 3.5} ${y - 6} L${x} ${y} L${x + 3.5} ${y - 6}` })); }
      g.append(sv('path', { class: 'lc-load', d: `M${X(L.x0)} ${y - 20} H${X(L.x1)}` }));
    }
    (L && L.P || []).forEach(([x, P]) => { if (P > 0) { const xx = X(x), y = Y(L.top) - 4; g.append(sv('path', { class: 'lc-loadP', d: `M${xx} ${y - 34} V${y} M${xx - 5} ${y - 9} L${xx} ${y} L${xx + 5} ${y - 9}` })); } });
    return g;
  }

  // ------------------------------------------------------------------ page
  S.pages.lignes = function (root) {
    const st = Object.assign({ cas: 'iso', dens: 14, fam1: true, fam2: true }, S.store.get('lignes', {}));
    const params = {};
    Object.entries(CASES).forEach(([k, c]) => { params[k] = Object.fromEntries(c.params.map(p => [p[0], p[5]])); });
    Object.entries(st.params || {}).forEach(([k, v]) => Object.assign(params[k] || {}, v));
    const persist = () => S.store.set('lignes', { cas: st.cas, dens: st.dens, fam1: st.fam1, fam2: st.fam2, params });
    const dom = { params: el('div'), out: el('div'), checks: el('div'), info: el('small', { class: 'muted' }) };
    let timer = null;
    const later = () => { clearTimeout(timer); timer = setTimeout(render, 60); };

    function renderSide() {
      const c = CASES[st.cas], p = params[st.cas];
      dom.params.innerHTML = '';
      c.params.forEach(([k, label, min, max, step, , unit, opts]) => {
        if (opts) {
          const s = el('select', { onchange: e => { p[k] = e.target.value; persist(); renderSide(); later(); } }, opts.map(([v, l]) => el('option', { value: v, selected: p[k] === v }, l)));
          dom.params.append(el('label', { class: 'param' }, el('span', { class: 'lab' }, label), s));
          return;
        }
        const out = el('output', {}, `${S.fmt(p[k])} ${unit}`);
        dom.params.append(el('label', { class: 'param' }, el('span', { class: 'lab' }, label, out),
          el('input', { type: 'range', min, max, step, value: p[k], oninput: e => { p[k] = +e.target.value; out.textContent = `${S.fmt(p[k])} ${unit}`; persist(); later(); } })));
      });
      if (c.side) dom.params.append(c.side(p, () => { persist(); renderSide(); later(); }));
    }

    function render() {
      const t0 = performance.now();
      const c = CASES[st.cas].build(params[st.cas]);
      dom.out.innerHTML = '';
      if (c.error) { dom.out.append(el('p', { class: 'note' }, c.error)); return; }
      const F = c.F, span = Math.max(F.x1 - F.x0, F.y1 - F.y0), dsep = span / (st.dens * 2.2);
      let smax = 0;
      for (let k = 0; k < F.sx.length; k++) smax = Math.max(smax, Math.abs(F.sx[k]), Math.abs(F.sy[k]), Math.abs(F.txy[k]));
      c.lines = { 1: st.fam1 ? trajectories(F, 1, dsep, { seeds: c.seeds && c.seeds.slice() }) : [], 2: st.fam2 ? trajectories(F, 2, dsep, { seeds: c.seeds && c.seeds.slice() }) : [] };
      dom.out.append(drawCase(c, { fam1: st.fam1, fam2: st.fam2, smax }));
      dom.out.append(el('div', { class: 'lc-legend' },
        el('span', { class: 'k c' }, 'compression'), el('span', { class: 'k t' }, 'traction'),
        c.zones && c.zones.length ? el('span', { class: 'k z' }, 'théorie des poutres non valable ici (zone de perturbation, largeur ≈ h)') : null,
        ...(c.legend || [])));
      dom.checks.innerHTML = '';
      if (c.checks && c.checks.length) dom.checks.append(el('table', { class: 'tbl lc-checks' }, el('tbody', {}, c.checks.map(ch =>
        el('tr', {}, el('td', {}, ch.label), el('td', { class: 'num' }, ch.val), el('td', { class: ch.ok ? 'ok' : 'ko' }, ch.ok ? '✓' : '⚠'))))));
      dom.info.textContent = `${c.lines[1].length + c.lines[2].length} trajectoires — calcul et tracé en ${S.fmt(performance.now() - t0, 0)} ms${c.info ? ' — ' + c.info : ''}`;
    }

    const picker = S.picker(Object.entries(CASES).map(([id, c]) => ({ id, label: c.label, svg: c.svg, group: c.group })), st.cas,
      id => { st.cas = id; persist(); renderSide(); render(); }, { label: 'Cas étudié' });
    const step = (n, t) => el('h4', {}, el('span', { class: 'step' }, n), t);
    const toggle = (key, label) => el('label', { class: 'field-row', style: 'grid-template-columns:auto 1fr;margin-bottom:6px' },
      el('input', { type: 'checkbox', checked: st[key], onchange: e => { st[key] = e.target.checked; persist(); render(); } }), label);
    const densOut = el('output', {}, String(st.dens));

    root.append(el('div', { class: 'page' },
      S.blockHead('07', 'Lignes de contraintes', 'Les trajectoires des contraintes principales montrent comment les efforts cheminent dans la matière : en bleu les lignes de compression, en rouge les lignes de traction. Paramètres modifiables en direct.'),
      el('p', { class: 'note lc-warn' }, 'Outil pédagogique et de compréhension, pas un calcul de justification. Poutres et arc : théorie des poutres (section rectangulaire), non valable près des appuis et des charges concentrées. Voile : calcul élastique en contraintes planes sur un maillage simple.'),
      el('div', { class: 'solver lc' },
        el('aside', { class: 'side' },
          el('div', { class: 'side-sec' }, step(1, 'Cas étudié'), picker.el),
          el('div', { class: 'side-sec' }, step(2, 'Paramètres'), dom.params),
          el('div', { class: 'side-sec' }, step(3, 'Affichage'),
            toggle('fam2', 'Trajectoires de σ₂ (la plus comprimée)'), toggle('fam1', 'Trajectoires de σ₁ (la plus tendue)'),
            el('label', { class: 'param' }, el('span', { class: 'lab' }, 'Densité des lignes', densOut),
              el('input', { type: 'range', min: 6, max: 30, step: 1, value: st.dens, oninput: e => { st.dens = +e.target.value; densOut.textContent = st.dens; persist(); later(); } })))),
        el('div', {}, dom.out, dom.info, el('h3', { class: 'lc-h' }, 'Vérifications'), dom.checks))));
    renderSide(); render();
  };
  S.lignes = { trajectories, makeField, tensorAt, principal, CASES };
})(window.S);
