/* Onglet « Plaques (Roark) » : flèches, contraintes et réactions de plaques rectangulaires d'épaisseur
   constante appuyées sur 2, 3 ou 4 côtés, d'après Roark's Formulas for Stress and Strain (Young & Budynas),
   tableau 11.4 (§ 11.10) et grandes flèches (§ 11.11).
   Formules : σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b ; coefficients interpolés linéairement en a/b.
   Unités : mm, N/mm² (MPa) ; q saisi en kPa, W en kN, R affiché en kN/m. */
(function (S) {
  'use strict';
  const el = S.el, sv = S.svg;
  S.pages = S.pages || {};

  const INF = Infinity;
  // bords : ss = appui simple, fx = encastré, fr = libre ; bas (z = 0), haut (z = b), gauche, droite
  const E4 = (bottom, top, left, right) => ({ bottom, top, left, right });
  /* Chaque cas : bords, définition de a et b, charges disponibles. Chaque charge : r (valeurs de a/b),
     coefficients, sorties { label, kind: s|y|R|sW, coef, sign, pos: [x/a − 0,5 … 0,5, z/b 0 … 1] }. */
  const CASES = [
    // ------------------------------------------------ 4 côtés
    { id: 'c1', group: '4 côtés appuyés', label: '4 appuis simples', roark: '1', edges: E4('ss', 'ss', 'ss', 'ss'), ab: 'a ≥ b (a : grand côté)', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '1a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, INF],
          c: { b: [.2874, .3762, .4530, .5172, .5688, .6102, .7134, .7410, .7476, .7500], a: [.0444, .0616, .0770, .0906, .1017, .1110, .1335, .1400, .1417, .1421], g: [.420, .455, .478, .491, .499, .503, .505, .502, .501, .500] },
          out: [{ label: 'Contrainte maximale σb (au centre)', kind: 's', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche maximale (au centre)', kind: 'y', coef: 'a', pos: [0, 0.5] },
            { label: 'Réaction maximale (milieu des grands côtés)', kind: 'R', coef: 'g', pos: [0, 0] }] },
        conc: { label: 'Charge concentrée au centre', roark: '1b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b: [.435, .650, .789, .875, .927, .958, 1.000], a: [.1267, .1478, .1621, .1715, .1770, .1805, .1851] },
          out: [{ label: 'Contrainte maximale (au centre)', kind: 'sW', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche maximale (au centre)', kind: 'yW', coef: 'a', pos: [0, 0.5] }] },
        lin: { label: 'Pression croissant le long du grand côté', roark: '1d', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .34, .38, .43, .47, .49], a: [.022, .043, .060, .070, .078, .086, .091] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin2: { label: 'Pression croissant le long du petit côté', roark: '1e', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .32, .35, .37, .38, .38], a: [.022, .042, .056, .063, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c3', group: '4 côtés appuyés', label: '3 appuis simples, un petit côté encastré', roark: '3', edges: E4('ss', 'ss', 'ss', 'fx'), ab: 'a ≥ b (b : côté encastré)', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '3a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .67, .73, .74, .75, .75, .75], a: [.030, .071, .101, .122, .132, .137, .139] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c4', group: '4 côtés appuyés', label: '3 appuis simples, un grand côté encastré', roark: '4', edges: E4('fx', 'ss', 'ss', 'ss'), ab: 'a ≥ b (a : côté encastré)', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '4a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .66, .73, .74, .74, .75, .75], a: [.030, .046, .054, .056, .057, .058, .058] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c5', group: '4 côtés appuyés', label: 'Grands côtés appuyés, petits côtés encastrés', roark: '5', edges: E4('ss', 'ss', 'fx', 'fx'), ab: 'a ≥ b (a : grands côtés)', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '5a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF], infNote: 'α pour a/b → ∞ : limite de la bande simplement appuyée (non donnée par Roark)',
        c: { b: [.4182, .5208, .5988, .6540, .6912, .7146, .750], a: [.0210, .0349, .0502, .0658, .0800, .0922, .1421] },
        out: [{ label: 'Contrainte au milieu des petits côtés', kind: 's', coef: 'b', sign: -1, pos: [-0.5, 0.5] }, { label: 'Flèche maximale (au centre)', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c6', group: '4 côtés appuyés', label: 'Grands côtés encastrés, petits côtés appuyés', roark: '6', edges: E4('fx', 'fx', 'ss', 'ss'), ab: 'a ≥ b (a : grands côtés)', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '6a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
        c: { b: [.4182, .4626, .4860, .4968, .4971, .4973, .500], a: [.0210, .0243, .0262, .0273, .0280, .0283, .0285] },
        out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Flèche maximale (au centre)', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c9', group: '4 côtés appuyés', label: '3 côtés encastrés, un côté appuyé', roark: '9', edges: E4('fx', 'ss', 'fx', 'fx'), ab: 'a : côté appuyé (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '9a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .307, .539, .657, .718], b2: [.004, .018, .062, .134, .284, .370, .422], b3: [.016, .061, .118, .158, .164, .135, .097], b4: [.031, .121, .242, .343, .417, .398, .318],
            g1: [.115, .230, .343, .453, .584, .622, .625], g2: [.123, .181, .253, .319, .387, .397, .386], g3: [.125, .256, .382, .471, .547, .549, .530] },
          out: [{ label: 'σb au milieu du côté encastré opposé (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σb en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b2', pos: [0, 0.6] },
            { label: 'σa en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b3', pos: [0, 0.6] }, { label: 'σa sur les côtés encastrés latéraux (z = 0,6 b)', kind: 's', coef: 'b4', sign: -1, pos: [-0.5, 0.6] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction au milieu du côté appuyé (z = b)', kind: 'R', coef: 'g2', pos: [0, 1] },
            { label: 'Réaction sur les côtés latéraux (z = 0,6 b)', kind: 'R', coef: 'g3', pos: [0.5, 0.6] }] },
        tri: { label: 'Pression décroissante de l\'encastrement (z = 0) à l\'appui', roark: '9d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.018, .064, .120, .192, .303, .356, .382], b2: [.019, .068, .124, .161, .181, .168, .132], g1: [.106, .195, .265, .323, .383, .399, .400], g2: [.075, .152, .212, .245, .262, .258, .250] },
          out: [{ label: 'σb au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σa sur les côtés latéraux (z = 0,4 b)', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 0.4] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux (z = 0,4 b)', kind: 'R', coef: 'g2', pos: [0.5, 0.4] }] } } },
    { id: 'c8', group: '4 côtés appuyés', label: '4 côtés encastrés', roark: '8', edges: E4('fx', 'fx', 'fx', 'fx'), ab: 'a ≥ b (a : grand côté)', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '8a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [.3078, .3834, .4356, .4680, .4872, .4974, .5000], b2: [.1386, .1794, .2094, .2286, .2406, .2472, .2500], a: [.0138, .0188, .0226, .0251, .0267, .0277, .0284] },
          out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au centre', kind: 's', coef: 'b2', pos: [0, 0.5] },
            { label: 'Flèche maximale (au centre)', kind: 'y', coef: 'a', pos: [0, 0.5] }] },
        conc: { label: 'Charge concentrée au centre', roark: '8b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [-.238, -.078, .011, .053, .068, .067, .067], b2: [.7542, .8940, .9624, .9906, 1.0000, 1.004, 1.008], a: [.0611, .0706, .0754, .0777, .0786, .0788, .0791] },
          out: [{ label: 'Contrainte au centre', kind: 'sW', coef: 'b1', pos: [0, 0.5] }, { label: 'Contrainte au milieu des grands côtés', kind: 'sWe', coef: 'b2', sign: -1, pos: [0, 0] },
            { label: 'Flèche maximale (au centre)', kind: 'yW', coef: 'a', pos: [0, 0.5] }] } } },
    // ------------------------------------------------ 3 côtés
    { id: 'c2', group: '3 côtés appuyés', label: '3 appuis simples, un côté libre', roark: '2', edges: E4('ss', 'ss', 'ss', 'fr'), ab: 'b : côté libre ; a : côtés appuyés perpendiculaires', min: 0.5,
      loads: {
        uni: { label: 'Pression uniforme', roark: '2a', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 4],
          c: { b: [.36, .45, .67, .77, .79, .80], a: [.080, .106, .140, .160, .165, .167] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin: { label: 'Pression croissant le long du côté a', roark: '2d', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.11, .16, .20, .28, .32, .35, .36, .37, .37], a: [.026, .033, .040, .050, .058, .064, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c7', group: '3 côtés appuyés', label: 'Un côté encastré, le côté opposé libre, deux appuis simples', roark: '7', edges: E4('fx', 'fr', 'ss', 'ss'), ab: 'a : côté encastré (z = 0) ; b : distance au bord libre', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '7a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.044, .176, .380, .665, 1.282, 1.804, 2.450], b2: [.048, .190, .386, .565, .730, .688, .434], g1: [.183, .368, .541, .701, .919, 1.018, 1.055], g2: [.131, .295, .526, .832, 1.491, 1.979, 2.401] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '7d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b: [.037, .120, .212, .321, .523, .677, .866], g: [.159, .275, .354, .413, .482, .509, .517] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g', pos: [0, 0] }] } } },
    { id: 'c10', group: '3 côtés appuyés', label: '3 côtés encastrés, un côté libre', roark: '10', edges: E4('fx', 'fr', 'fx', 'fx'), ab: 'a : bord libre (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '10a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .321, .727, 1.226, 2.105], b2: [.016, .066, .148, .259, .484, .605, .519], b3: [.031, .126, .286, .511, 1.073, 1.568, 1.982], g1: [.114, .230, .341, .457, .673, .845, 1.012], g2: [.125, .248, .371, .510, .859, 1.212, 1.627] },
          out: [{ label: 'σb au milieu du côté encastré opposé au bord libre', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σa au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'σa aux extrémités du bord libre', kind: 's', coef: 'b3', sign: -1, pos: [-0.5, 1] }, { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] },
            { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '10d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3], note: 'γ₂ à a/b = 1,5 : 0,106, valeur telle que publiée (vraisemblablement une coquille)',
          c: { b1: [.018, .064, .120, .195, .351, .507, .758], b2: [.019, .068, .125, .166, .244, .387, .514], g1: [.106, .195, .265, .324, .406, .458, .505], g2: [.075, .151, .211, .242, .106, .199, .313] },
          out: [{ label: 'σb au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σa sur les côtés latéraux', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 0.7] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux', kind: 'R', coef: 'g2', pos: [0.5, 0.7] }] } } },
    // ------------------------------------------------ 2 côtés
    { id: 'c11', group: '2 côtés appuyés', label: 'Deux côtés adjacents encastrés, deux bords libres', roark: '11', edges: E4('fx', 'fr', 'fx', 'fr'), ab: 'a : côté encastré bas (z = 0) ; b : côté encastré gauche (x = 0)', min: 0.125, swap: true,
      loads: { uni: { label: 'Pression uniforme', roark: '11a', nu: 0.2, r: [.125, .25, .375, .5, .75, 1],
        c: { b1: [.050, .182, .353, .631, 1.246, 1.769], b2: [.047, .188, .398, .632, 1.186, 1.769], g1: [.312, .572, .671, .874, 1.129, 1.183], g2: [.127, .264, .413, .557, .829, 1.183] },
        out: [{ label: 'σb à l\'extrémité libre du côté encastré bas (x = a, z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0.5, 0] }, { label: 'σa à l\'extrémité libre du côté encastré gauche', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 1] },
          { label: 'Réaction au même point (côté bas)', kind: 'R', coef: 'g1', pos: [0.5, 0] }, { label: 'Réaction au même point (côté gauche)', kind: 'R', coef: 'g2', pos: [-0.5, 1] }] } } },
    { id: 'b-ss', group: '2 côtés appuyés', label: 'Deux côtés opposés appuyés, deux bords libres', roark: 'bande', strip: true, edges: E4('ss', 'ss', 'fr', 'fr'), ab: 'b : portée entre les appuis ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: nu => ({ b: 0.75, a: 5 * 12 * (1 - nu * nu) / 384, g: 0.5 }),
        out: [{ label: 'Contrainte au milieu de la portée', kind: 's', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche maximale', kind: 'y', coef: 'a', pos: [0, 0.5] }, { label: 'Réaction sur chaque appui', kind: 'R', coef: 'g', pos: [0, 0] }] } } },
    { id: 'b-ff', group: '2 côtés appuyés', label: 'Deux côtés opposés encastrés, deux bords libres', roark: 'bande', strip: true, edges: E4('fx', 'fx', 'fr', 'fr'), ab: 'b : portée entre les encastrements ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: nu => ({ b1: 0.5, b2: 0.25, a: 12 * (1 - nu * nu) / 384, g: 0.5 }),
        out: [{ label: 'Contrainte sur les encastrements', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au milieu de la portée', kind: 's', coef: 'b2', pos: [0, 0.5] },
          { label: 'Flèche maximale', kind: 'y', coef: 'a', pos: [0, 0.5] }, { label: 'Réaction sur chaque encastrement', kind: 'R', coef: 'g', pos: [0, 1] }] } } },
    { id: 'b-fs', group: '2 côtés appuyés', label: 'Un côté encastré, le côté opposé appuyé, deux bords libres', roark: 'bande', strip: true, edges: E4('fx', 'ss', 'fr', 'fr'), ab: 'b : portée ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: nu => ({ b1: 0.75, b2: 6 * 9 / 128, a: 12 * (1 - nu * nu) / 185, g1: 5 / 8, g2: 3 / 8 }),
        out: [{ label: 'Contrainte sur l\'encastrement', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte maximale en travée (z = 0,625 b)', kind: 's', coef: 'b2', pos: [0, 0.625] },
          { label: 'Flèche maximale (z ≈ 0,58 b)', kind: 'y', coef: 'a', pos: [0, 0.58] }, { label: 'Réaction sur l\'encastrement', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur l\'appui', kind: 'R', coef: 'g2', pos: [0, 1] }] } } }
  ];
  const CASE = Object.fromEntries(CASES.map(c => [c.id, c]));

  // grandes flèches (§ 11.11, ν = 0,316) : Q = q·b⁴/(E·t⁴) → y/t, σd·b²/(E·t²), σ·b²/(E·t²)
  const LD_Q = [0, 12.5, 25, 50, 75, 100, 125, 150, 175, 200, 250];
  const LARGE = {
    ss: [
      { r: 1, y: [0, .430, .650, .930, 1.13, 1.26, 1.37, 1.47, 1.56, 1.63, 1.77], s: [0, 3.80, 5.80, 8.70, 10.90, 12.80, 14.30, 15.60, 17.00, 18.20, 20.50], where: 'au centre' },
      { r: 1.5, y: [0, .625, .879, 1.18, 1.37, 1.53, 1.68, 1.77, 1.88, 1.96, 2.12], s: [0, 4.48, 6.81, 9.92, 12.25, 14.22, 16.0, 17.50, 18.90, 20.30, 22.80], where: 'au centre' },
      { r: 2, y: [0, .696, .946, 1.24, 1.44, 1.60, 1.72, 1.84, 1.94, 2.03, 2.20], s: [0, 4.87, 7.16, 10.30, 12.60, 14.60, 16.40, 18.00, 19.40, 20.90, 23.60], where: 'au centre', label: '2 à ∞' }],
    fx: [
      { r: 1, y: [0, .165, .32, .59, .80, .95, 1.08, 1.19, 1.28, 1.38, 1.54], s: [0, 3.80, 6.90, 14.70, 21.0, 26.50, 31.50, 36.20, 40.70, 45.00, 53.50], where: 'au milieu des grands côtés' },
      { r: 1.5, y: [0, .28, .51, .825, 1.07, 1.24, 1.40, 1.50, 1.63, 1.72, 1.86], s: [0, 5.75, 11.12, 20.30, 27.8, 35.0, 41.0, 47.0, 52.50, 57.60, 67.00], where: 'au milieu des grands côtés', label: '1,5 à ∞' }]
  };

  // interpolation linéaire en a/b ; au-delà de la dernière valeur finie vers ∞ : linéaire en b/a
  function coef(r, vals, x) {
    const n = r.length;
    if (x <= r[0]) return { v: vals[0], clamp: x < r[0] - 1e-9 };
    for (let i = 0; i < n - 1; i++) {
      const r0 = r[i], r1 = r[i + 1];
      if (x <= r1) {
        if (r1 === INF) { const t = 1 - r0 / x; return { v: vals[i] + (vals[i + 1] - vals[i]) * t }; }
        const t = (x - r0) / (r1 - r0);
        return { v: vals[i] + (vals[i + 1] - vals[i]) * t };
      }
    }
    return { v: vals[n - 1], clamp: r[n - 1] !== INF };
  }
  const lerp1 = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[ys.length - 1];
  };

  const STEELS = { S235: 235, S275: 275, S355: 355 };

  // ------------------------------------------------------------------ calcul
  function compute(c, p) {
    const L = c.loads[p.load] || c.loads.uni;
    let a = p.a, b = p.b, swapped = false;
    if (c.swap && a > b) { [a, b] = [b, a]; swapped = true; }
    const ratio = a / b, E = p.E, t = p.t, q = p.q / 1000, W = p.W * 1000, nu = p.nu;
    let cs, clamp = false;
    if (c.strip) cs = Object.fromEntries(Object.entries(L.strip(nu)).map(([k, v]) => [k, { v }]));
    else {
      cs = {};
      Object.entries(L.c).forEach(([k, vals]) => { const r = coef(L.r, vals, ratio); cs[k] = r; clamp = clamp || r.clamp; });
    }
    // rayon équivalent de la charge concentrée
    const ro = p.ro, rop = ro < 0.5 * t ? Math.sqrt(1.6 * ro * ro + t * t) - 0.675 * t : ro;
    const res = L.out.map(o => {
      const k = cs[o.coef].v, sg = o.sign || 1;
      let v, unit, formula;
      if (o.kind === 's') { v = sg * k * q * b * b / (t * t); unit = 'MPa'; formula = `${sg < 0 ? '−' : ''}${o.coef.replace('b', 'β').replace('g', 'γ')}·q·b²/t²`; }
      else if (o.kind === 'y') { v = k * q * b ** 4 / (E * t ** 3); unit = 'mm'; formula = 'α·q·b⁴/(E·t³)'; }
      else if (o.kind === 'R') { v = k * q * b; unit = 'kN/m'; formula = `${o.coef.replace('g', 'γ')}·q·b`; }
      else if (o.kind === 'sW') { v = 3 * W / (2 * Math.PI * t * t) * ((1 + nu) * Math.log(2 * b / (Math.PI * rop)) + k); unit = 'MPa'; formula = '3W/(2πt²)·[(1+ν)·ln(2b/πr′o) + β]'; }
      else if (o.kind === 'sWe') { v = sg * k * W / (t * t); unit = 'MPa'; formula = '−β₂·W/t²'; }
      else if (o.kind === 'yW') { v = k * W * b * b / (E * t ** 3); unit = 'mm'; formula = 'α·W·b²/(E·t³)'; }
      return Object.assign({}, o, { k, v, unit, formula });
    });
    const sMax = Math.max(0, ...res.filter(r => r.unit === 'MPa').map(r => Math.abs(r.v)));
    const yRes = res.find(r => r.unit === 'mm');
    const ymax = yRes ? Math.abs(yRes.v) : null;
    // grandes flèches : 4 appuis simples ou 4 encastrements sous pression uniforme
    let large = null;
    if ((c.id === 'c1' || c.id === 'c8') && p.load === 'uni') {
      const Q = q * b ** 4 / (E * t ** 4), tabs = LARGE[c.id === 'c1' ? 'ss' : 'fx'];
      const pick = ratio >= tabs[tabs.length - 1].r ? tabs[tabs.length - 1] : tabs.reduce((m, x) => (Math.abs(x.r - ratio) < Math.abs(m.r - ratio) ? x : m));
      /* Relation charge–flèche de la forme α·Q = w + k·w³ (w = y/t) : tangente à l'origine = théorie
         linéaire (α du tableau 11.4), k ajusté sur les points du tableau du § 11.11 (médiane). La contrainte
         est interpolée en fonction de w sur les couples (w, σb²/Et²) du tableau. */
      const al = cs.a ? cs.a.v : null;
      let yt;
      if (al) {
        const ks = pick.y.map((w, i) => (i ? (al * LD_Q[i] - w) / w ** 3 : null)).filter(v => v != null && v > 0).sort((x, y) => x - y);
        const kk = ks.length ? ks[Math.floor(ks.length / 2)] : 0, target = al * Q;
        let w = target;
        for (let it = 0; it < 40; it++) { const f = w + kk * w ** 3 - target, d = 1 + 3 * kk * w * w; w -= f / d; }
        yt = Math.max(0, w);
      } else yt = lerp1(LD_Q, pick.y, Q);
      // contrainte : s(w) = (β/α)·w + c·w², tangente à l'origine = théorie linéaire, c ajusté sur le tableau
      const be = Object.keys(cs).filter(k => k[0] === 'b').map(k => cs[k].v).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      let sn;
      if (al && be) {
        const sl = be / al, cc = pick.y.map((w, i) => (i ? (pick.s[i] - sl * w) / (w * w) : null)).filter(v => v != null).sort((x, y) => x - y);
        sn = sl * yt + (cc.length ? cc[Math.floor(cc.length / 2)] : 0) * yt * yt;
      } else sn = lerp1(pick.y, pick.s, yt);
      large = { Q, yt, y: yt * t, s: sn * E * t * t / (b * b), where: pick.where, table: pick.label || S.fmt(pick.r, 1), out: Q > LD_Q[LD_Q.length - 1] };
    }
    return { a, b, ratio, swapped, clamp, cs, res, sMax, ymax, L, large, rop, nuTab: L.nu, loadKey: p.load };
  }

  // ------------------------------------------------------------------ dessins
  function edgePath(x1, y1, x2, y2, kind, nx, ny) {
    // nx, ny : normale vers l'extérieur de la plaque
    const g = sv('g');
    if (kind === 'fx') {
      g.append(sv('line', { x1, y1, x2, y2, class: 'pl-fx' }));
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(L / 12));
      for (let i = 0; i <= n; i++) {
        const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n;
        g.append(sv('line', { x1: x, y1: y, x2: x + nx * 8 + (y2 - y1) / L * 5, y2: y + ny * 8 - (x2 - x1) / L * 5, class: 'pl-hatch' }));
      }
    } else if (kind === 'ss') {
      g.append(sv('line', { x1, y1, x2, y2, class: 'pl-ss' }));
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(L / 40));
      for (let i = 0; i <= n; i++) {
        const x = x1 + (x2 - x1) * (i + 0.5) / (n + 1), y = y1 + (y2 - y1) * (i + 0.5) / (n + 1);
        g.append(sv('path', { d: `M${x} ${y} l${nx * 9 - ny * 5} ${ny * 9 + nx * 5} l${ny * 10} ${-nx * 10} z`, class: 'pl-tri' }));
      }
    } else g.append(sv('line', { x1, y1, x2, y2, class: 'pl-fr' }));
    return g;
  }
  function plan(c, r) {
    const W = 420, H = 300, m = 46, k = Math.min((W - 2 * m) / r.a, (H - 2 * m) / r.b);
    const w = r.a * k, h = r.b * k, x0 = (W - w) / 2, y0 = (H - h) / 2;
    const g = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diag pl-plan' });
    g.append(sv('rect', { x: x0, y: y0, width: w, height: h, class: 'pl-body' }));
    const e = c.edges;
    // z = 0 en bas, z = b en haut
    g.append(edgePath(x0, y0 + h, x0 + w, y0 + h, e.bottom, 0, 1), edgePath(x0, y0, x0 + w, y0, e.top, 0, -1),
      edgePath(x0, y0, x0, y0 + h, e.left, -1, 0), edgePath(x0 + w, y0, x0 + w, y0 + h, e.right, 1, 0));
    // cotes
    g.append(sv('text', { x: x0 + w / 2, y: y0 + h + 34, class: 'pl-dim', 'text-anchor': 'middle' }, `a = ${S.fmt(r.a, 0)} mm`));
    g.append(sv('text', { x: x0 - 30, y: y0 + h / 2, class: 'pl-dim', 'text-anchor': 'middle', transform: `rotate(-90 ${x0 - 30} ${y0 + h / 2})` }, `b = ${S.fmt(r.b, 0)} mm`));
    if (/lin|tri/.test(r.loadKey)) g.append(sv('text', { x: W / 2, y: 14, class: 'pl-dim', 'text-anchor': 'middle' }, 'pression variable (voir le cas)'));
    // points de résultat
    r.res.forEach((o, i) => {
      if (!o.pos) return;
      const x = x0 + (o.pos[0] + 0.5) * w, y = y0 + h - o.pos[1] * h;
      g.append(sv('circle', { cx: x, cy: y, r: 5.5, class: 'pl-pt ' + (o.unit === 'mm' ? 'y' : o.unit === 'MPa' ? 's' : 'R') }));
      g.append(sv('text', { x: x + 7, y: y - 6, class: 'pl-ptl' }, String(i + 1)));
    });
    return g;
  }
  const edgeIcon = e => {
    const seg = (x1, y1, x2, y2, kind) => kind === 'fx' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="3.2"/>` : kind === 'ss' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="1.4"/>` : `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="1" stroke-dasharray="2 2" stroke="#9a9994"/>`;
    return `<rect x="10" y="4" width="32" height="22" fill="#eceae4" stroke="none"/>${seg(10, 26, 42, 26, e.bottom)}${seg(10, 4, 42, 4, e.top)}${seg(10, 4, 10, 26, e.left)}${seg(42, 4, 42, 26, e.right)}`;
  };

  // ------------------------------------------------------------------ vérifications contre des valeurs connues
  function checks() {
    const r = (id, load, ab, key) => coef(CASE[id].loads[load].r, CASE[id].loads[load].c[key], ab).v;
    const D = nu => 12 * (1 - nu * nu);
    return [
      { label: 'Plaque carrée sur 4 appuis, flèche : α = 0,00406·12(1−ν²) (Timoshenko)', mine: r('c1', 'uni', 1, 'a'), ref: 0.00406 * D(0.3) },
      { label: 'Plaque carrée sur 4 appuis, moment au centre : β = 6 × 0,0479 (Timoshenko)', mine: r('c1', 'uni', 1, 'b'), ref: 6 * 0.0479 },
      { label: 'Plaque carrée encastrée, flèche : α = 0,00126·12(1−ν²) (Timoshenko)', mine: r('c8', 'uni', 1, 'a'), ref: 0.00126 * D(0.3) },
      { label: 'Plaque carrée encastrée, moment au milieu des côtés : β = 6 × 0,0513 (Timoshenko)', mine: r('c8', 'uni', 1, 'b1'), ref: 6 * 0.0513 },
      { label: '4 appuis, a/b → ∞ : bande simplement appuyée α = 5·12(1−ν²)/384', mine: r('c1', 'uni', 1e6, 'a'), ref: 5 * D(0.3) / 384 },
      { label: '4 encastrements, a/b → ∞ : bande bi-encastrée α = 12(1−ν²)/384', mine: r('c8', 'uni', 1e6, 'a'), ref: D(0.3) / 384 },
      { label: '7a, a/b grand : console de portée b, β₁ → 3 (σ = 6·qb²/2/t²)', mine: r('c7', 'uni', 3, 'b1'), ref: 3, tol: 0.25, note: 'à a/b = 3, la plaque tend vers la console' }
    ].map(c => Object.assign(c, { ok: Math.abs(c.mine / c.ref - 1) < (c.tol || 0.02) }));
  }

  // ------------------------------------------------------------------ page
  S.pages.plaques = function (root) {
    const st = Object.assign({ cas: 'c1', load: 'uni', a: 1500, b: 1000, t: 10, q: 5, W: 10, ro: 50, E: 210000, nu: 0.3, steel: 'S235', lim: 150 }, S.store.get('plaques', {}));
    const persist = () => S.store.set('plaques', st);
    const dom = { side: el('div'), out: el('div') };

    const num = (k, label, unit, step, min) => {
      const inp = el('input', { type: 'number', value: st[k], step, min, onchange: e => { st[k] = +e.target.value; persist(); render(); } });
      return el('label', { class: 'pl-field' }, el('span', {}, label), inp, el('small', {}, unit));
    };

    function renderSide() {
      const c = CASE[st.cas];
      if (!c.loads[st.load]) st.load = 'uni';
      dom.side.innerHTML = '';
      dom.side.append(
        el('div', { class: 'pl-ab' }, c.ab),
        num('a', 'Côté a', 'mm', 10, 10), num('b', 'Côté b', 'mm', 10, 10), num('t', 'Épaisseur t', 'mm', 0.5, 1),
        el('label', { class: 'pl-field' }, el('span', {}, 'Charge'), el('select', { onchange: e => { st.load = e.target.value; persist(); renderSide(); render(); } },
          Object.entries(c.loads).map(([k, l]) => el('option', { value: k, selected: k === st.load }, `${l.label} (${l.roark})`)))),
        /W|conc/.test(st.load) ? el('div', {}, num('W', 'Charge W', 'kN', 0.5, 0), num('ro', 'Rayon de la zone chargée ro', 'mm', 5, 1))
          : num('q', /lin|tri/.test(st.load) ? 'Pression maximale q' : 'Pression q', 'kPa', 0.5, 0),
        el('h5', {}, 'Acier'),
        el('label', { class: 'pl-field' }, el('span', {}, 'Nuance'), el('select', { onchange: e => { st.steel = e.target.value; persist(); render(); } },
          Object.keys(STEELS).map(s => el('option', { value: s, selected: s === st.steel }, `${s} (fy = ${STEELS[s]} MPa)`)))),
        num('E', 'Module E', 'MPa', 1000, 1000), num('nu', 'Coefficient de Poisson ν', '', 0.01, 0),
        num('lim', 'Flèche limite : b /', '', 10, 10));
    }

    function render() {
      const c = CASE[st.cas];
      const r = compute(c, st), fy = STEELS[st.steel], util = r.sMax / fy;
      const flim = r.b / st.lim;
      const big = r.ymax != null && r.ymax > 0.5 * st.t;
      dom.out.innerHTML = '';
      const kpi = (b, v, s, cls) => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, el('b', {}, b), el('span', {}, v), el('small', {}, s));
      dom.out.append(el('div', { class: 'kpis pl-kpis' },
        kpi('Contrainte maximale', `${S.fmt(r.sMax, 1)} MPa`, `σ/fy = ${S.fmt(util * 100, 0)} % (${st.steel}, première plastification)`, util > 1 ? 'ko' : ''),
        kpi('Flèche maximale', r.ymax != null ? `${S.fmt(r.ymax, 2)} mm` : '—', r.ymax != null ? `b/${S.fmt(r.b / r.ymax, 0)} ; limite b/${st.lim} = ${S.fmt(flim, 1)} mm` : 'non donnée par Roark pour ce cas', r.ymax != null && r.ymax > flim ? 'ko' : ''),
        kpi('Flèche / épaisseur', r.ymax != null ? S.fmt(r.ymax / st.t, 2) : '—', r.ymax == null ? 'flèche non disponible pour ce cas' : big ? 'au-delà de t/2 : grandes flèches, théorie linéaire dépassée' : 'petites flèches : théorie linéaire valable', big ? 'ko' : ''),
        kpi('Rapport a/b', S.fmt(r.ratio, 2), `${r.L.roark} — ν du tableau : ${r.nuTab != null ? S.fmt(r.nuTab, 1) : S.fmt(st.nu, 2)}`)));
      const warns = [];
      if (r.clamp) warns.push(`a/b = ${S.fmt(r.ratio, 2)} sort du tableau (${S.fmt(r.L.r[0], 3)} à ${r.L.r[r.L.r.length - 1] === INF ? '∞' : S.fmt(r.L.r[r.L.r.length - 1], 1)}) : coefficient pris à la borne.`);
      if (r.swapped) warns.push('a > b : les côtés ont été permutés pour rester dans le tableau (le cas est symétrique).');
      if (c.min >= 1 && st.a < st.b) warns.push('Pour ce cas, a désigne le grand côté : saisir a ≥ b.');
      if (r.L.infNote) warns.push(r.L.infNote + '.');
      if (r.L.note) warns.push(r.L.note + '.');
      if (r.nuTab != null && Math.abs(r.nuTab - st.nu) > 0.02) warns.push(`Les coefficients du tableau sont établis pour ν = ${r.nuTab} ; l'acier a ν ≈ 0,3 (écart attendu : quelques % sur la flèche, jusqu'à 15 % sur les contraintes selon Roark).`);
      if (big && !r.large) warns.push('Flèche supérieure à la moitié de l\'épaisseur : l\'effet membrane devient important, la théorie linéaire surestime flèche et contraintes (§ 11.11).');
      dom.out.append(
        el('div', { class: 'pl-grid' },
          el('div', { class: 'pl-plan-wrap' }, plan(c, r), el('div', { class: 'pl-legend' },
            el('span', { class: 'k fx' }, 'encastré'), el('span', { class: 'k ss' }, 'appui simple'), el('span', { class: 'k fr' }, 'bord libre'))),
          el('div', {}, el('table', { class: 'tbl pl-res' },
            el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Grandeur'), el('th', {}, 'Formule'), el('th', { class: 'num' }, 'Coef.'), el('th', { class: 'num' }, 'Valeur'))),
            el('tbody', {}, r.res.map((o, i) => el('tr', {},
              el('td', {}, el('span', { class: 'pl-badge ' + (o.unit === 'mm' ? 'y' : o.unit === 'MPa' ? 's' : 'R') }, i + 1)),
              el('td', {}, o.label), el('td', { class: 'pl-f' }, o.formula), el('td', { class: 'num' }, S.fmt(o.k, 4)),
              el('td', { class: 'num' }, el('b', {}, `${S.fmt(o.v, o.unit === 'mm' ? 2 : 1)} ${o.unit}`)))))),
            warns.length ? el('ul', { class: 'pl-warn' }, warns.map(w => el('li', {}, w))) : null)));
      // grandes flèches
      if (r.large) {
        const L = r.large;
        dom.out.append(el('div', { class: 'pl-large' },
          el('h3', {}, 'Grandes flèches (§ 11.11) : effet membrane'),
          el('p', { class: 'muted' }, `Bords maintenus dans leur plan (« held »), ν = 0,316, tableau a/b = ${L.table}. Q = q·b⁴/(E·t⁴) = ${S.fmt(L.Q, 1)}${L.out ? ' : au-delà du tableau (250), valeur prise à la borne' : ''}.`),
          el('table', { class: 'tbl pl-res' }, el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', { class: 'num' }, 'Linéaire (tableau 11.4)'), el('th', { class: 'num' }, 'Grandes flèches'))),
            el('tbody', {},
              el('tr', {}, el('td', {}, 'Flèche au centre'), el('td', { class: 'num' }, `${S.fmt(r.ymax, 2)} mm`), el('td', { class: 'num' }, el('b', {}, `${S.fmt(L.y, 2)} mm`))),
              el('tr', {}, el('td', {}, `Contrainte totale (flexion + membrane) ${L.where}`), el('td', { class: 'num' }, `${S.fmt(r.sMax, 1)} MPa`), el('td', { class: 'num' }, el('b', {}, `${S.fmt(L.s, 1)} MPa`))))),
          el('p', { class: 'note' }, L.y < r.ymax * 0.95 ? `La rigidité de membrane réduit la flèche de ${S.fmt((1 - L.y / r.ymax) * 100, 0)} % : à retenir si les bords sont effectivement retenus dans leur plan.` : 'Petites flèches : le calcul linéaire suffit.')));
      }
      // tableau de Roark du cas
      if (!c.strip) {
        const L = r.L, keys = Object.keys(L.c);
        const name = k => ({ a: 'α', b: 'β', g: 'γ' }[k[0]] + (k.length > 1 ? '₁₂₃₄'[+k[1] - 1] : ''));
        dom.out.append(el('details', { class: 'pl-tab' }, el('summary', {}, `Coefficients de Roark, cas ${L.roark} (interpolés en a/b)`),
          el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' },
            el('thead', {}, el('tr', {}, el('th', {}, 'a/b'), ...L.r.map(x => el('th', { class: 'num' }, x === INF ? '∞' : S.fmt(x, 3))), el('th', { class: 'num hl' }, S.fmt(r.ratio, 2)))),
            el('tbody', {}, keys.map(k => el('tr', {}, el('td', {}, name(k)), ...L.c[k].map(v => el('td', { class: 'num' }, S.fmt(v, 4))), el('td', { class: 'num hl' }, el('b', {}, S.fmt(r.cs[k].v, 4))))))))));
      }
    }

    // vérifications (indépendantes des saisies)
    const ch = checks();
    const checkTable = el('table', { class: 'tbl lc-checks' }, el('tbody', {}, ch.map(c => el('tr', {},
      el('td', {}, c.label, c.note ? el('small', { class: 'muted' }, ` (${c.note})`) : null), el('td', { class: 'num' }, `${S.fmt(c.mine, 4)} / ${S.fmt(c.ref, 4)}`),
      el('td', { class: c.ok ? 'ok' : 'ko' }, c.ok ? '✓' : '⚠')))));

    const picker = S.picker(CASES.map(c => ({ id: c.id, label: c.label, group: c.group, svg: edgeIcon(c.edges) })), st.cas,
      id => { st.cas = id; persist(); renderSide(); render(); }, { label: 'Conditions d\'appui' });
    const step = (n, t) => el('h4', {}, el('span', { class: 'step' }, n), t);
    root.append(el('div', { class: 'page' },
      S.blockHead('08', 'Plaques', 'Flèches, contraintes et réactions de plaques rectangulaires en acier d\'épaisseur constante, appuyées sur deux, trois ou quatre côtés, d\'après les formules et tableaux de Roark (tableau 11.4) ; effet de membrane en grandes flèches (§ 11.11).'),
      el('p', { class: 'note lc-warn' }, 'Plaques minces, matériau élastique linéaire, charge normale au plan. σ est une contrainte de flexion, positive quand la face inférieure est tendue (charge vers le bas). Coins des plaques supposés maintenus. Outil de pré-dimensionnement : vérifier ensuite selon l\'Eurocode 3 (EN 1993-1-7 pour les plaques).'),
      el('div', { class: 'solver pl' },
        el('aside', { class: 'side' },
          el('div', { class: 'side-sec' }, step(1, 'Conditions d\'appui'), picker.el),
          el('div', { class: 'side-sec' }, step(2, 'Plaque et charge'), dom.side)),
        el('div', {}, dom.out)),
      el('section', { class: 'og-sec' },
        el('div', { class: 'sub-head' }, S.blockHead('8.1', 'Méthode, vérifications et limites', null, 'h2')),
        el('div', { class: 'grid2 co2-method' },
          el('div', {}, el('h3', {}, 'Méthode'), el('ul', { class: 'list' },
            el('li', {}, 'σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b, coefficients α, β, γ du tableau 11.4 de Roark, interpolés linéairement en a/b (en b/a vers a/b = ∞).'),
            el('li', {}, 'Charge concentrée sur un petit cercle de rayon ro : rayon équivalent r′o = √(1,6·ro² + t²) − 0,675·t si ro < 0,5·t.'),
            el('li', {}, 'Deux côtés opposés seulement : flexion cylindrique d\'une bande de rigidité D = E·t³/12(1 − ν²).'),
            el('li', {}, 'Grandes flèches (4 appuis simples ou 4 encastrements, pression uniforme) : tableau du § 11.11, bords retenus dans leur plan.'),
            el('li', {}, 'Selon Roark, l\'erreur due au choix de ν (entre 0,15 et 0,30) reste sous 7 à 8 % pour les flèches et 15 % pour les contraintes. Si les coins peuvent se soulever, la contrainte au centre d\'une plaque carrée simplement appuyée augmente d\'environ 35 %.'))),
          el('div', {}, el('h3', {}, 'Vérifications du tableau intégré'), el('p', { class: 'muted', style: 'font-size:13px' }, 'Coefficients comparés aux valeurs classiques (Timoshenko, Theory of Plates and Shells) et aux limites de la flexion cylindrique.'), checkTable))),
      el('p', { class: 'muted', style: 'font-size:12px;margin-top:14px' }, 'Source : W. C. Young, R. G. Budynas, Roark\'s Formulas for Stress and Strain, chapitre 11, tableau 11.4 et § 11.11.')));
    renderSide(); render();
  };
})(window.S);
