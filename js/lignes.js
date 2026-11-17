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
    },
    arc: {
      label: 'Arc', group: 'Arc',
      svg: '<path d="M4 25 Q26 -6 48 25" fill="none" stroke-width="4" stroke="#bdbcb7"/><path d="M4 25 Q26 -6 48 25" fill="none"/><path d="M4 25 l-3 4 h6 z M48 25 l-3 4 h6 z"/>',
      params: [['L', 'Portée L', 6, 40, 1, 14, 'm'], ['f', 'Montée f', 1, 15, 0.25, 4, 'm'], ['h', 'Épaisseur h', 0.2, 2.5, 0.05, 1.0, 'm'], ['b', 'Largeur b', 0.1, 1, 0.05, 0.4, 'm'],
        ['forme', 'Forme', 0, 0, 0, 'para', '', [['para', 'Parabolique'], ['circ', 'Circulaire']]],
        ['appuis', 'Liaisons', 0, 0, 0, 'arc', '', [['arc', 'Deux articulations'], ['arc-3art', 'Trois articulations'], ['arc-encastre', 'Encastré']]],
        ['charge', 'Charge répartie', 0, 0, 0, 'uni', '', [['uni', 'Sur toute la portée (funiculaire de la parabole)'], ['demi', 'Sur la moitié gauche (non funiculaire)']]],
        ['q', 'Charge q (projection horizontale)', 0, 100, 1, 20, 'kN/m'], ['P', 'Charge ponctuelle au quart', 0, 300, 5, 0, 'kN']],
      build: p => arcCase(p)
    },
    voile: {
      label: 'Voile ou mur percé', group: 'Voile',
      svg: '<path d="M8 4 H44 V27 H8 Z" fill="#e7e6e1"/><path d="M18 11 H28 V27 H18 Z M34 9 H40 V16 H34 Z" fill="#fff"/><path d="M4 27 H48"/>',
      params: [['W', 'Largeur', 2, 14, 0.25, 7, 'm'], ['H', 'Hauteur', 1.5, 10, 0.25, 4, 'm'], ['t', 'Épaisseur', 0.1, 0.6, 0.02, 0.2, 'm'],
        ['mat', 'Matériau', 0, 0, 0, 'beton', '', [['beton', 'Béton (élastique linéaire)'], ['maconnerie', 'Maçonnerie']]],
        ['nOuv', 'Ouvertures', 0, 0, 0, '1', '', [['0', 'Aucune'], ['1', 'Une ouverture'], ['2', 'Deux ouvertures']]],
        ['o1x', 'Ouverture 1 : position x', 0, 12, 0.1, 2.5, 'm'], ['o1y', 'Ouverture 1 : allège', 0, 8, 0.1, 0, 'm'], ['o1w', 'Ouverture 1 : largeur', 0.3, 6, 0.1, 1.2, 'm'], ['o1h', 'Ouverture 1 : hauteur', 0.3, 8, 0.1, 2.2, 'm'],
        ['o2x', 'Ouverture 2 : position x', 0, 12, 0.1, 5, 'm'], ['o2y', 'Ouverture 2 : allège', 0, 8, 0.1, 1, 'm'], ['o2w', 'Ouverture 2 : largeur', 0.3, 6, 0.1, 1, 'm'], ['o2h', 'Ouverture 2 : hauteur', 0.3, 8, 0.1, 1.2, 'm'],
        ['q', 'Charge répartie en tête', 0, 300, 5, 60, 'kN/m'], ['P', 'Charge ponctuelle en tête', 0, 1000, 10, 0, 'kN'], ['xP', 'Position de P', 0, 14, 0.1, 3.1, 'm'],
        ['pp', 'Poids propre', 0, 0, 0, 'oui', '', [['oui', 'Pris en compte'], ['non', 'Ignoré']]],
        ['carte', 'Carte de couleur', 0, 0, 0, 'aucune', '', [['aucune', 'Aucune'], ['s1', 'σ₁ (traction en rouge)'], ['s2', 'σ₂ (compression en bleu)']]],
        ['ne', 'Finesse du maillage (éléments)', 500, 4000, 100, 2000, '']],
      hide: p => [...(p.nOuv === '0' ? ['o1x', 'o1y', 'o1w', 'o1h'] : []), ...(p.nOuv !== '2' ? ['o2x', 'o2y', 'o2w', 'o2h'] : [])],
      build: p => voileCase(p)
    }
  };

  // ------------------------------------------------------------------ voile : éléments finis Q4 en contraintes planes
  const GP = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const NODE_XI = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const dElastic = (E, nu) => { const c = E / (1 - nu * nu); return [c, c * nu, 0, c * nu, c, 0, 0, 0, c * (1 - nu) / 2]; };
  // matrice B (3 × 8) d'un rectangle a × b au point (ξ, η)
  function bMat(a, b, xi, eta) {
    const B = new Float64Array(24);
    NODE_XI.forEach(([xi_i, eta_i], n) => {
      const dx = xi_i * (1 + eta * eta_i) / 4 * 2 / a, dy = eta_i * (1 + xi * xi_i) / 4 * 2 / b;
      B[2 * n] = dx; B[8 + 2 * n + 1] = dy; B[16 + 2 * n] = dy; B[16 + 2 * n + 1] = dx;
    });
    return B;
  }
  // raideur élémentaire (8 × 8), intégration 2 × 2
  function kElem(a, b, t, D) {
    const K = new Float64Array(64), w = a * b / 4 * t;
    for (const xi of GP) for (const eta of GP) {
      const B = bMat(a, b, xi, eta), DB = new Float64Array(24);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) DB[r * 8 + c] = D[r * 3] * B[c] + D[r * 3 + 1] * B[8 + c] + D[r * 3 + 2] * B[16 + c];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) K[i * 8 + j] += (B[i] * DB[j] + B[8 + i] * DB[8 + j] + B[16 + i] * DB[16 + j]) * w;
    }
    return K;
  }
  // Cholesky en bande : A[i][k] stocké en A[i·(bw+1) + k], k = j − i ∈ [0, bw]
  function bandSolve(A, n, bw, F) {
    const W = bw + 1;
    for (let i = 0; i < n; i++) {
      for (let k = Math.max(0, i - bw); k < i; k++) {
        const lki = A[k * W + (i - k)];
        if (lki === 0) continue;
        const f = lki / A[k * W];
        const jmax = Math.min(n - 1, k + bw);
        for (let j = i; j <= jmax; j++) A[i * W + (j - i)] -= f * A[k * W + (j - k)];
      }
    }
    const x = Float64Array.from(F);
    for (let i = 0; i < n; i++) { for (let k = Math.max(0, i - bw); k < i; k++) x[i] -= A[k * W + (i - k)] / A[k * W] * x[k]; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j <= Math.min(n - 1, i + bw); j++) s -= A[i * W + (j - i)] * x[j]; x[i] = s / A[i * W]; }
    return x;
  }

  /* Maillage régulier nx × ny ; une maille est retirée si son centre tombe dans une ouverture. Pied encastré
     (déplacements nuls), charges en tête et poids propre. Retourne les contraintes par élément. */
  function solveWall(geo, Dfor) {
    const { W, H, t, nx, ny, active, q, P, xP, gamma } = geo, a = W / nx, b = H / ny;
    // numérotation selon la plus petite dimension pour réduire la largeur de bande
    const colMajor = nx > ny;
    const nid = (i, j) => (colMajor ? i * (ny + 1) + j : j * (nx + 1) + i);
    const nn = (nx + 1) * (ny + 1), ndof = 2 * nn, bw = 2 * (colMajor ? ny + 2 : nx + 2) + 1, Wd = bw + 1;
    const K = new Float64Array(ndof * Wd), F = new Float64Array(ndof), used = new Uint8Array(nn);
    const conn = (i, j) => [nid(i, j), nid(i + 1, j), nid(i + 1, j + 1), nid(i, j + 1)];
    const kCache = new Map();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const e = j * nx + i;
      if (!active[e]) continue;
      const D = Dfor(e), key = D.join(',');
      let ke = kCache.get(key);
      if (!ke) { ke = kElem(a, b, t, D); if (kCache.size < 4000) kCache.set(key, ke); }
      const ns = conn(i, j), dofs = ns.flatMap(n => [2 * n, 2 * n + 1]);
      ns.forEach(n => (used[n] = 1));
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const I = dofs[r], J = dofs[c];
        if (J >= I) K[I * Wd + (J - I)] += ke[r * 8 + c];
      }
      if (gamma) ns.forEach(n => (F[2 * n + 1] -= gamma * t * a * b / 4));
    }
    // charges en tête : répartie (sur les mailles actives de la rangée supérieure) et ponctuelle
    for (let i = 0; i < nx; i++) if (active[(ny - 1) * nx + i]) { F[2 * nid(i, ny) + 1] -= q * a / 2; F[2 * nid(i + 1, ny) + 1] -= q * a / 2; }
    if (P) F[2 * nid(Math.max(0, Math.min(nx, Math.round(xP / a))), ny) + 1] -= P;
    // conditions aux limites : pied bloqué, nœuds sans matière neutralisés
    const fix = d => { for (let k = 1; k < Wd; k++) K[d * Wd + k] = 0; for (let r = Math.max(0, d - bw); r < d; r++) K[r * Wd + (d - r)] = 0; K[d * Wd] = 1; F[d] = 0; };
    for (let i = 0; i <= nx; i++) { fix(2 * nid(i, 0)); fix(2 * nid(i, 0) + 1); }
    for (let n = 0; n < nn; n++) if (!used[n]) { fix(2 * n); fix(2 * n + 1); }
    const Fext = Float64Array.from(F);
    const u = bandSolve(K, ndof, bw, F);
    // contraintes au centre de chaque élément
    const B0 = bMat(a, b, 0, 0), sig = new Float64Array(nx * ny * 3);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const e = j * nx + i;
      if (!active[e]) continue;
      const ue = conn(i, j).flatMap(n => [u[2 * n], u[2 * n + 1]]), D = Dfor(e);
      const ex = B0.slice(0, 8).reduce((s, v, k) => s + v * ue[k], 0), ey = B0.slice(8, 16).reduce((s, v, k) => s + v * ue[k], 0), gxy = B0.slice(16).reduce((s, v, k) => s + v * ue[k], 0);
      sig[3 * e] = D[0] * ex + D[1] * ey + D[2] * gxy; sig[3 * e + 1] = D[3] * ex + D[4] * ey + D[5] * gxy; sig[3 * e + 2] = D[6] * ex + D[7] * ey + D[8] * gxy;
    }
    let load = 0;
    for (let n = 0; n < nn; n++) if (used[n]) load -= Fext[2 * n + 1];
    return { sig, u, load, a, b };
  }

  function voileCase(p) {
    const W = p.W, H = p.H, t = p.t, beton = p.mat === 'beton';
    const ratio = Math.sqrt(p.ne * W / H), nx = Math.max(8, Math.round(ratio)), ny = Math.max(6, Math.round(p.ne / nx));
    const ops = [];
    if (+p.nOuv >= 1) ops.push([p.o1x, p.o1y, p.o1w, p.o1h]);
    if (+p.nOuv >= 2) ops.push([p.o2x, p.o2y, p.o2w, p.o2h]);
    const a = W / nx, b = H / ny, active = new Uint8Array(nx * ny).fill(1);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const cx = (i + 0.5) * a, cy = (j + 0.5) * b;
      if (ops.some(([ox, oy, ow, oh]) => cx > ox && cx < ox + ow && cy > oy && cy < oy + oh)) active[j * nx + i] = 0;
    }
    const E = beton ? 30e6 : 3e6, nu = 0.2, gamma = p.pp === 'oui' ? (beton ? 25 : 18) : 0;
    const D0 = dElastic(E, nu);
    const geo = { W, H, t, nx, ny, active, q: p.q, P: p.P, xP: Math.min(p.xP, W), gamma };
    const res = solveWall(geo, () => D0);
    return wallResult(p, geo, res, ops, { E, nu, beton });
  }

  // champ aux nœuds (moyenne des éléments voisins), carte de couleur, vérifications
  function wallResult(p, geo, res, ops, mat, extra = {}) {
    const { W, H, t, nx, ny, active } = geo, { sig } = res;
    const F = makeField(0, 0, W, H, nx, ny), cnt = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const e = j * nx + i;
      F.cell[e] = active[e];
      if (!active[e]) continue;
      [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].forEach(([ii, jj]) => {
        const k = jj * (nx + 1) + ii;
        F.sx[k] += sig[3 * e]; F.sy[k] += sig[3 * e + 1]; F.txy[k] += sig[3 * e + 2]; cnt[k]++;
      });
    }
    for (let k = 0; k < cnt.length; k++) if (cnt[k]) { F.sx[k] /= cnt[k]; F.sy[k] /= cnt[k]; F.txy[k] /= cnt[k]; }
    // principales par élément
    const s1 = new Float64Array(nx * ny), s2 = new Float64Array(nx * ny);
    for (let e = 0; e < nx * ny; e++) if (active[e]) { const pr = principal([sig[3 * e], sig[3 * e + 1], sig[3 * e + 2]]); s1[e] = pr.s1; s2[e] = pr.s2; }
    const holes = ops.map(([ox, oy, ow, oh]) => [[ox, oy], [ox + ow, oy], [ox + ow, oy + oh], [ox, oy + oh]]);
    // vérifications
    const checks = [];
    const applied = p.q * W + (p.P || 0) + (p.pp === 'oui' ? (mat.beton ? 25 : 18) * t * (W * H - ops.reduce((s, o) => s + o[2] * o[3], 0)) : 0);
    checks.push({ label: 'Équilibre : charges appliquées (q, P, poids propre) = somme des réactions en pied', val: `${S.fmt(res.load, 1)} kN / ${S.fmt(applied, 1)} kN`, ok: Math.abs(res.load - applied) / (applied || 1) < 0.03 });
    if (!ops.length && !(p.P > 0) && p.pp !== 'oui' && p.q > 0) {
      const k = Math.round(ny / 2) * (nx + 1) + Math.round(nx / 2), ref = -p.q / t;
      checks.push({ label: 'Sans ouverture, charge répartie seule : σy uniforme à mi-hauteur = −q/t', val: `${S.fmt(F.sy[k], 0)} / ${S.fmt(ref, 0)} kPa`, ok: Math.abs(F.sy[k] / ref - 1) < 0.02 });
    }
    if (ops.length && p.q > 0) {
      let smin = 0;
      for (let e = 0; e < nx * ny; e++) if (active[e]) smin = Math.min(smin, s2[e]);
      const nom = -(p.q * W) / (t * (W - ops.reduce((s, o) => s + o[2], 0)));
      checks.push({ label: 'Concentration aux angles des ouvertures : σ₂,min / contrainte moyenne dans les trumeaux (référence : ≈ 3 pour un trou circulaire, davantage aux angles vifs, valeur dépendant du maillage)', val: `${S.fmt(smin / nom, 1)}`, ok: true });
    }
    // carte de couleur par élément
    let map = null;
    if (p.carte !== 'aucune') {
      const arr = p.carte === 's1' ? s1 : s2;
      let m = 0; for (let e = 0; e < arr.length; e++) m = Math.max(m, Math.abs(arr[e]));
      map = (X, Y, k) => {
        const g = sv('g', { class: 'lc-map' });
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const e = j * nx + i;
          if (!active[e]) continue;
          const v = arr[e] / (m || 1), op = Math.min(1, Math.abs(v)) * 0.75;
          if (op < 0.03) continue;
          g.append(sv('rect', { x: X(i * res.a).toFixed(1), y: Y((j + 1) * res.b).toFixed(1), width: (res.a * k + 0.6).toFixed(1), height: (res.b * k + 0.6).toFixed(1), fill: v > 0 ? '#e2463f' : '#2f6fd6', 'fill-opacity': op.toFixed(2) }));
        }
        return g;
      };
    }
    const ground = (X, Y) => {
      const g = sv('g', { class: 'lc-ground' });
      g.append(sv('path', { d: `M${X(0) - 10} ${Y(0)} H${X(W) + 10}`, class: 'lc-sup' }));
      for (let x = 0; x <= W + 1e-9; x += W / Math.max(6, Math.round(W * 3))) g.append(sv('path', { d: `M${X(x)} ${Y(0)} l-7 9`, class: 'lc-sup' }));
      if (extra.overlay) g.append(extra.overlay(X, Y));
      return g;
    };
    const legend = [p.carte !== 'aucune' ? el('span', {}, `Carte : ${p.carte === 's1' ? 'σ₁' : 'σ₂'} par élément (intensité relative)`) : null, ...(extra.legend || [])];
    return Object.assign({ F, outline: [[[0, 0], [W, 0], [W, H], [0, H]]], holes, h: H, L: W, supports: [], map, extra: ground,
      loads: { q: p.q, top: H, x0: 0, x1: W, P: p.P > 0 ? [[Math.min(p.xP, W), p.P]] : [] }, checks: checks.concat(extra.checks || []), legend,
      info: `${nx} × ${ny} éléments Q4, ${2 * (nx + 1) * (ny + 1)} inconnues` + (extra.info ? ' — ' + extra.info : ''), s1, s2, geo }, extra.more || {});
  }

  /* Arc : efforts du solveur le long de l'axe (repère local s le long de l'axe, n vers l'extrados), puis
     σs = N/A − M·n/I, τsn = −1,5·V/A·(1 − 4n²/h²), σn = 0, et rotation dans le repère global :
     σx = c²σs − 2cs·τ, σy = s²σs + 2cs·τ, τxy = cs·σs + (c² − s²)·τ. */
  function arcCase(p) {
    const { L, h, b } = p, E = 30000;
    const pp = Object.assign(S.presetDefaults(p.appuis), { L, f: p.f, forme: p.forme, q: p.q, P: p.P });
    const model = S.PRESET[p.appuis].build(pp);
    if (p.forme === 'circ' && pp.f !== p.f) p.f = pp.f;            // montée limitée au demi-cercle
    model.elems.forEach(e => Object.assign(e, custom(b, h, E)));
    if (p.charge === 'demi') model.eloads = model.eloads.filter(l => l.type !== 'udl' || model.nodes[model.elems[l.elem - 1].n2 - 1].x <= L / 2 + 1e-6);
    const r = S.fem.solve(model);
    if (!r.ok) return { error: 'Système instable.' };
    /* Échantillons de l'axe : position, tangente exacte de la courbe (le modèle est une ligne brisée de
       16 barres, dont la tangente saute de quelques degrés à chaque nœud), efforts projetés sur cette
       tangente (N le long de l'axe, V selon la normale), abscisse curviligne. */
    const f = p.f, Rc = (L * L / 4 + f * f) / (2 * f), yc = f - Rc;
    const tangent = (x, y) => {
      if (p.forme === 'circ') { const tx = y - yc, ty = -(x - L / 2), l = Math.hypot(tx, ty); return [tx / l, ty / l]; }
      const d = 4 * f * (L - 2 * x) / (L * L), l = Math.hypot(1, d); return [1 / l, d / l];
    };
    const smp = [];
    let sCum = 0;
    r.elems.forEach(e => {
      const n1 = model.nodes[model.elems[e.index - 1].n1 - 1];
      e.xs.forEach((x, k) => {
        const px = n1.x + e.c * x, py = n1.y + e.s * x;
        if (smp.length) sCum += Math.hypot(px - smp[smp.length - 1].x, py - smp[smp.length - 1].y);
        const [tc, ts] = tangent(px, py);
        const gx = e.N[k] * e.c + e.V[k] * e.s, gy = e.N[k] * e.s - e.V[k] * e.c;   // effort résultant (repère global)
        smp.push({ x: px, y: py, c: tc, s: ts, N: gx * tc + gy * ts, V: gx * ts - gy * tc, M: e.M[k], sc: sCum });
      });
    });
    const S_ = sCum, ymax = Math.max(...smp.map(q => q.y));
    const nx = 260, ny = Math.max(40, Math.round(nx * (ymax + h) / (L + h)));
    const F = makeField(-h * 0.6, -h * 0.6, L + h * 0.6, ymax + h * 0.6, nx, ny);
    const A = b * h, I = b * h ** 3 / 12, valid = new Uint8Array((nx + 1) * (ny + 1));
    // point de l'axe le plus proche : recherche sur les segments voisins en x
    const nearest = (x, y) => {
      let best = null, bd = Infinity;
      for (let m = 0; m < smp.length - 1; m++) {
        const a = smp[m], c = smp[m + 1];
        if (Math.min(a.x, c.x) > x + h || Math.max(a.x, c.x) < x - h) continue;
        const ex = c.x - a.x, ey = c.y - a.y, l2 = ex * ex + ey * ey || 1e-12;
        const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / l2));
        const qx = a.x + t * ex, qy = a.y + t * ey, d = (x - qx) ** 2 + (y - qy) ** 2;
        if (d < bd) { bd = d; best = { a, c, t, qx, qy, m }; }
      }
      return best;
    };
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = F.x0 + i * F.dx, y = F.y0 + j * F.dy, k = j * (nx + 1) + i;
      const q = nearest(x, y);
      if (!q) continue;
      const { a, c, t } = q, lerp = key => a[key] + (c[key] - a[key]) * t;
      const tl = Math.hypot(lerp('c'), lerp('s')) || 1, cs = lerp('c') / tl, sn = lerp('s') / tl;
      // hors des extrémités de l'axe : pas de matière
      if ((q.m === 0 && t <= 0) || (q.m === smp.length - 2 && t >= 1)) continue;
      const n = (x - q.qx) * -sn + (y - q.qy) * cs;
      if (Math.abs(n) > h / 2 + 1e-9) continue;
      const N = lerp('N'), V = lerp('V'), M = lerp('M');
      const ss = N / A - M * n / I, tau = -1.5 * V / A * (1 - 4 * n * n / (h * h));
      F.sx[k] = cs * cs * ss - 2 * cs * sn * tau; F.sy[k] = sn * sn * ss + 2 * cs * sn * tau; F.txy[k] = cs * sn * ss + (cs * cs - sn * sn) * tau;
      valid[k] = 1;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i;
      F.cell[j * nx + i] = valid[k] && valid[k + 1] && valid[k + nx + 1] && valid[k + nx + 2] ? 1 : 0;
    }
    // contour : extrados et intrados ; zones de perturbation sur une longueur d'arc h
    const off = (q, d) => [q.x - q.s * d, q.y + q.c * d];
    const outline = [[...smp.map(q => off(q, h / 2)), ...smp.slice().reverse().map(q => off(q, -h / 2))]];
    const band = (s0, s1) => { const part = smp.filter(q => q.sc >= s0 && q.sc <= s1); return part.length > 1 ? [...part.map(q => off(q, h / 2)), ...part.slice().reverse().map(q => off(q, -h / 2))] : null; };
    const sAtX = x => { const q = smp.reduce((m, v) => (Math.abs(v.x - x) < Math.abs(m.x - x) ? v : m)); return q.sc; };
    const zones = [band(0, h), band(S_ - h, S_)];
    if (p.P > 0) { const s4 = sAtX(L / 4); zones.push(band(s4 - h, s4 + h)); }
    if (p.appuis === 'arc-3art') { const s2 = sAtX(L / 2); zones.push(band(s2 - h, s2 + h)); }
    const yAt = x => { const q = smp.reduce((m, v) => (Math.abs(v.x - x) < Math.abs(m.x - x) ? v : m)); return q.y + h / 2; };
    const sups = model.nodes.filter(n => n.sup !== 'libre').map(n => Object.assign({}, n, { sy: n.y - h / 2 }));
    // vérification : charge funiculaire → trajectoires de compression parallèles à l'axe
    const funi = p.forme === 'para' && p.charge === 'uni' && !(p.P > 0);
    const inZone = sc => sc < h || sc > S_ - h || (p.appuis === 'arc-3art' && Math.abs(sc - sAtX(L / 2)) < h);
    let dev = 0, eMax = 0;
    smp.forEach(q => {
      if (inZone(q.sc)) return;
      eMax = Math.max(eMax, Math.abs(q.M / (q.N || 1e-9)));
      const tt = tensorAt(F, q.x, q.y);
      if (!tt) return;
      const pr = principal(tt), a2 = pr.th + Math.PI / 2;
      const d = Math.abs(Math.atan2(Math.sin(a2) * q.c - Math.cos(a2) * q.s, Math.cos(a2) * q.c + Math.sin(a2) * q.s));
      dev = Math.max(dev, Math.min(d, Math.PI - d) * 180 / Math.PI);
    });
    const checks = [funi
      ? { label: 'Charge funiculaire : trajectoires de compression parallèles à l\'axe (écart maximal hors zones)', val: `${S.fmt(dev, 2)}°`, ok: dev < 1 }
      : { label: 'Charge non funiculaire : écart des trajectoires de compression à l\'axe (hors zones)', val: `${S.fmt(dev, 1)}°`, ok: true },
      { label: 'Excentricité maximale de la ligne des pressions e = M/N (noyau central : h/6)', val: `${S.fmt(eMax * 100, 1)} cm / ${S.fmt(h / 6 * 100, 1)} cm`, ok: eMax <= h / 6 + 1e-9 }];
    return { F, zones: zones.filter(Boolean), outline, supports: sups, h, L, dsep: d => Math.max(h / (d * 0.28), L / 300),
      hinges: p.appuis === 'arc-3art' ? [[L / 2, p.f]] : [],
      loads: { q: p.q, topFn: yAt, x0: 0, x1: p.charge === 'demi' ? L / 2 : L, P: p.P > 0 ? [[L / 4, p.P]] : [] }, checks,
      info: eMax > h / 6 ? 'la ligne des pressions sort du noyau central : une fibre est tendue' : 'ligne des pressions dans le noyau central : section entièrement comprimée' };
  }

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
    // zones de perturbation : rectangles [x0, x1] sur toute la hauteur (poutres) ou polygones (arc)
    const zonePoly = poly => 'M' + poly.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L') + 'Z';
    (c.zones || []).forEach(z => {
      const attrs = Array.isArray(z[0]) ? { d: zonePoly(z) } : { d: zonePoly([[z[0], -c.h / 2], [z[1], -c.h / 2], [z[1], c.h / 2], [z[0], c.h / 2]]) };
      g.append(sv('path', Object.assign(attrs, { fill: 'url(#lc-hatch)', class: 'lc-zone' }), sv('title', {}, 'Zone de perturbation : théorie des poutres non valable ici')));
    });
    if (c.extra) g.append(c.extra(X, Y, k));
    // appuis et charges
    (c.supports || []).forEach(n => {
      const x = X(n.x), y = Y(n.sy != null ? n.sy : c.supY != null ? c.supY : -c.h / 2);
      if (n.sup === 'encastrement') g.append(sv('path', { class: 'lc-sup', d: n.sy != null ? `M${x - 16} ${y} H${x + 16} M${x - 12} ${y} l-6 7 M${x - 2} ${y} l-6 7 M${x + 8} ${y} l-6 7` : `M${x} ${y - c.h * k / 2 - 10} V${y + 10} M${x} ${y - 4} l-7 7 M${x} ${y - c.h * k / 2 + 6} l-7 7 M${x} ${y - c.h * k / 4} l-7 7` }));
      else g.append(sv('path', { class: 'lc-sup', d: `M${x} ${y} l-8 13 h16 z M${x - 12} ${y + 17} h24` }));
    });
    (c.hinges || []).forEach(([x, y]) => g.append(sv('circle', { cx: X(x), cy: Y(y), r: 4.5, class: 'lc-hinge' })));
    const L = c.loads;
    const top = x => (L.topFn ? L.topFn(x) : L.top);
    if (L && L.q > 0) {
      const n = Math.max(6, Math.round((L.x1 - L.x0) * k / 34)), pts = [];
      for (let i = 0; i <= n; i++) {
        const xm = L.x0 + (L.x1 - L.x0) * i / n, x = X(xm), y = Y(top(xm)) - 4;
        pts.push(`${x} ${y - 20}`);
        g.append(sv('path', { class: 'lc-load', d: `M${x} ${y - 20} V${y} M${x - 3.5} ${y - 6} L${x} ${y} L${x + 3.5} ${y - 6}` }));
      }
      g.append(sv('path', { class: 'lc-load', d: 'M' + pts.join('L') }));
    }
    (L && L.P || []).forEach(([x, P]) => { if (P > 0) { const xx = X(x), y = Y(top(x)) - 4; g.append(sv('path', { class: 'lc-loadP', d: `M${xx} ${y - 34} V${y} M${xx - 5} ${y - 9} L${xx} ${y} L${xx + 5} ${y - 9}` })); } });
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
      const hidden = c.hide ? c.hide(p) : [];
      c.params.forEach(([k, label, min, max, step, , unit, opts]) => {
        if (hidden.includes(k)) return;
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
      const F = c.F, span = Math.max(F.x1 - F.x0, F.y1 - F.y0), dsep = c.dsep ? c.dsep(st.dens) : span / (st.dens * 2.2);
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
