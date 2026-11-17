# Structura — atelier en ligne de conception des structures

Application web statique (HTML/CSS/JavaScript, sans dépendance ni étape de build) en huit modules :

| Module | Contenu |
|---|---|
| **Typologies** | Modes de fonctionnement (compression, flexion, traction), fiches par famille (poutres, treillis, sous-tendues, portiques, dalles et planchers, arcs, structures tendues, plissées, coques et gridshells), schémas statiques, portées et élancements par matériau, efficacité structurelle. |
| **Formulaire** | Cas de charge en planches annotées de formules (V, M, déformée), flambement d'un arc, sections, formules essentielles. |
| **Solveur RDM 2D** | Méthode des déplacements (poutres d'Euler-Bernoulli, rotules par condensation statique), modèles paramétriques par familles, flambement des arcs (méthode D. Bitar, CTICM), diagrammes N, V, M et déformée en direct, fiche PDF. |
| **Ordres de grandeur** | Portées et élancements dessinés à l'échelle, matériaux, charges permanentes et d'exploitation. |
| **Comprendre le contreventement** | Phénomènes animés (mécanismes en élévation et en toiture, remèdes), trajet des efforts, typologies de contreventement. |
| **Comparateur carbone** | Plancher, poutre, poteau : sections modifiables, fiches INIES au choix, ACV statique A1–A3 et stockage biogénique en ACV dynamique RE2020. |
| **Lignes de contraintes** | Trajectoires des contraintes principales dans des poutres, un arc et un voile ou mur percé (élastique ou maçonnerie sans traction). |
| **Plaques** | Plaques rectangulaires en acier appuyées sur 2, 3 ou 4 côtés (appuis simples, encastrements, bords libres) : contraintes, flèches et réactions d'après Roark (tableau 11.4), effet de membrane en grandes flèches (§ 11.11). |

## Lancer en local

Les scripts sont classiques (pas de modules ES) : on peut ouvrir `index.html` directement par double-clic.
Pour un serveur local sous Windows (sans Node ni Python) :

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Le script ouvre le navigateur tout seul. Si le port 8080 est déjà pris, il essaie automatiquement 8081, 8082… et affiche l'adresse utilisée.

## Déployer

N'importe quel hébergement statique convient : publier le dossier tel quel (le fichier `serve.ps1` est inutile en ligne).

- **Netlify** : glisser-déposer le dossier sur https://app.netlify.com/drop.
- **Vercel** : `vercel deploy` dans le dossier (aucune configuration).
- **GitHub Pages** : pousser le dossier dans un dépôt, puis *Settings → Pages → Deploy from branch*.

La navigation utilise des ancres (`#/solveur`), donc aucune règle de réécriture n'est nécessaire.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `js/util.js` | Création DOM/SVG, formatage, stockage local, info-bulle |
| `js/sections.js` | Matériaux et bibliothèque de sections (IPE, HEA, HEB, tubes, bois, BA) |
| `js/fem.js` | Moteur de calcul (assemblage, résolution, efforts internes, déformée, flambement des arcs) |
| `js/geom.js` | Géométries de treillis et poutres sous-tendues, dessins axonométriques |
| `js/contreventement.js` | Onglet Comprendre le contreventement |
| `js/carbone.js` | Comparateur carbone (fiches INIES, ACV statique et dynamique) |
| `js/lignes.js` | Lignes de contraintes : champ de contraintes, trajectoires, éléments finis Q4 du voile |
| `js/plaques.js` | Plaques : coefficients de Roark (tableau 11.4), interpolation, grandes flèches |
| `js/presets.js` | Modèles paramétriques du solveur |
| `js/draw.js` | Rendu SVG du modèle, des charges, réactions et diagrammes |
| `js/solver-ui.js` | Interface du solveur |
| `js/formulaire.js` | Formulaire interactif |
| `js/typologies-data.js`, `js/typologies.js` | Données et page Typologies |
| `js/ordres-data.js`, `js/ordres.js` | Données et page Ordres de grandeur |
| `js/app.js` | Routeur, thème, page d'accueil |

## Conventions de calcul

Unités : m, kN, kN·m ; E en MPa, A en cm², I en cm⁴, h en mm.
Charges verticales positives vers le bas ; N > 0 en traction ; M > 0 fibre inférieure tendue (diagramme tracé côté fibre tendue) ; V = dM/dx.

Le solveur a été recoupé avec les formules analytiques (qL²/8, qL²/12, réactions de poutres continues, poussée d'un arc et d'un portique à 3 articulations, portiques de Kleinlogel).

## Lignes de contraintes

Trajectoires des contraintes principales : compression en bleu, traction en rouge (couleur selon le signe de la contrainte principale le long de la ligne). Outil pédagogique et de compréhension, pas un calcul de justification.

| Cas | Méthode | Vérification intégrée |
|---|---|---|
| Poutre sur deux appuis, console, poutre continue sur 3 appuis | Efforts N, V, M du solveur `fem.js` ; section rectangulaire b × h : σx = N/A − M·y/I, τxy = −1,5·V/A·(1 − 4y²/h²) (y vers le haut, signe de τ tiré de l'équilibre avec V = dM/dx) | Directions principales à 45° sur l'axe neutre ; trajectoires horizontales et verticales à la fibre extrême au moment maximal |
| Arc parabolique ou circulaire, 2 ou 3 articulations ou encastré, charge funiculaire ou sur une moitié, charge au quart | Efforts du solveur projetés sur la tangente exacte de la courbe ; σs = N/A − M·n/I et τsn dans le repère local (s, n), rotation vers le repère global | Sous charge funiculaire, trajectoires de compression parallèles à l'axe (écart mesuré 0,04°) ; excentricité de la ligne des pressions comparée au noyau central h/6 |
| Voile ou mur avec une ou deux ouvertures | Éléments finis Q4 en contraintes planes sur une grille régulière (~2 000 éléments), pied encastré, charges en tête et poids propre, Cholesky en bande, contraintes au centre des éléments moyennées aux nœuds | Équilibre des réactions ; sans ouverture, σy = −q/t à mi-hauteur (écart 0,7 %) ; facteur de concentration aux angles |
| Mur maçonné | Élastique avec zones σ1 > ft surlignées et arc de décharge forfaitaire à 60° ; option « sans traction » par la méthode des contraintes initiales (Zienkiewicz, 1968) : la traction en excès de ft est retirée et réappliquée en forces nodales jusqu'à convergence | Excès de traction résiduel sous 2 % de la compression moyenne ; nombre d'éléments fissurés |

Tracé : intégration de Runge-Kutta 4 dans le champ de directions (signe du vecteur propre aligné sur le pas précédent), espacement régulier des lignes selon Jobard et Lefer, arrêt aux points singuliers (σ1 ≈ σ2). Les zones de perturbation (une hauteur h autour des appuis et des charges concentrées), où la théorie des poutres ne s'applique pas, sont hachurées.

## Plaques (Roark)

Formules de W. C. Young et R. G. Budynas, *Roark's Formulas for Stress and Strain*, chapitre 11 : σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b, coefficients du tableau 11.4 interpolés linéairement en a/b (linéairement en b/a vers a/b = ∞).

| Appuis | Cas de Roark | Charges |
|---|---|---|
| 4 côtés | 1 (4 appuis simples), 3 et 4 (un côté encastré), 5 et 6 (deux côtés opposés encastrés), 8 (4 encastrés), 9 (3 encastrés, 1 appuyé) | uniforme ; charge concentrée au centre (1b, 8b) ; pressions variables (1d, 1e, 9d) |
| 3 côtés | 2 (3 appuis simples, 1 bord libre), 7 (encastré, opposé libre, 2 appuis), 10 (3 encastrés, 1 bord libre) | uniforme ; pressions variables (2d, 7d, 10d) |
| 2 côtés | 11 (2 côtés adjacents encastrés) ; deux côtés opposés (appuyés, encastrés, ou un de chaque) en flexion cylindrique | uniforme |

Grandes flèches (cas 1 et 8 sous pression uniforme, bords retenus dans leur plan) : relation α·Q = w + k·w³ (w = y/t, Q = q·b⁴/E·t⁴), tangente à l'origine égale à la théorie linéaire et k ajusté sur le tableau du § 11.11 ; contrainte totale s(w) ajustée de la même façon.

Vérifications intégrées : coefficients des plaques carrées simplement appuyées et encastrées comparés à Timoshenko (flèche et moments, écart < 0,3 %), limites a/b → ∞ égales à la flexion cylindrique, cas 7 tendant vers la console.

## Avertissement

Outil pédagogique et de pré-conception. Les valeurs sont indicatives et ne remplacent pas un dimensionnement réglementaire (Eurocodes) : pas de vérification de déversement, voilement, fissuration, feu, séisme, ni de coefficients partiels complets.
