# TURING — du NAND à l'assembleur

Un jeu de puzzle pédagogique : à partir d'une seule porte **NAND**, construis toutes les portes logiques,
puis des composants avec mémoire, un processeur complet, et enfin programme-le en assembleur.

## Jouer

Lance un petit serveur local depuis le dossier du jeu, puis ouvre http://localhost:8000 :

```sh
python3 -m http.server 8000
```

(Ouvrir `index.html` directement fonctionne aussi, sauf avec les navigateurs installés en Flatpak ou Snap,
qui ne peuvent pas lire les dossiers `css/` et `js/`.)

## Sauvegarde

La progression, les circuits, les programmes, les brouillons (la zone de notes de chaque niveau)
les dessins au crayon et les constructions du bac à sable sont enregistrés automatiquement dans le navigateur.
Depuis le menu, **Exporter la sauvegarde** télécharge un fichier `turing-sauvegarde-AAAA-MM-JJ.json`,
et **Importer une sauvegarde** le recharge : pratique pour changer d'ordinateur ou de navigateur,
ou pour garder une copie de sécurité.

## Ce que tu apprends

| Chapitre | Contenu |
| --- | --- |
| **1. Portes logiques** | NAND, NOT, AND, OR, NOR, XOR, XNOR (chaque porte construite est débloquée comme composant), puis 17 énigmes qui les combinent : constantes, AND/OR à 3 entrées, implication, alarme, parité, unanimité, comparateurs, nombres premiers, multiples de 3, majorité… |
| **2. Composants** | Demi-additionneur, additionneur complet, multiplexeur, décodeur, puis la mémoire : le composant DÉLAI, l'oscillateur, le bit de mémoire et le compteur. |
| **3. Architecture** | ALU 1 bit, unité de condition, décodeur 3 bits, registre, compteur de programme, puis l'assemblage du processeur **NANDO-8**, un ordinateur Turing-complet. |
| **4. Assemblage** | Programmation du NANDO-8 : d'abord en code machine brut, puis avec des mnémoniques, des étiquettes et des constantes. Énigmes : écho, addition, parité, compte à rebours, maximum, multiplication, somme, division… Puis de nouvelles instructions se débloquent : décalages (`shl`, `shr`), mémoire (`load`, `store`) et fonctions (`call`, `ret`), avec des défis comme compter les bits, écrire en binaire, inverser une liste, trier ou calculer a² + b². |

## Commandes de l'éditeur de circuits

- Clique sur un composant de la palette pour l'ajouter.
- Glisse depuis une pastille (entrée ou sortie) vers une autre pour tirer un fil. Une même sortie
  peut alimenter plusieurs entrées : tire plusieurs fils depuis la même pastille.
- Clique sur une entrée (A, B…) pour basculer sa valeur : les fils allumés sont orange.
- <kbd>Suppr</kbd> ou clic droit supprime la sélection. Molette : zoom ; glisser le fond : déplacer la vue.
- **Tick** fait avancer l'horloge dans les niveaux avec mémoire.
- La **poignée** entre le panneau de l'énoncé et le circuit se glisse pour élargir ou rétrécir le panneau ;
  son bouton (ou un double-clic) le replie pour laisser toute la place au circuit.
- **🧪 Bac à sable** (sur le menu) : un circuit libre avec tous les composants, sans objectif. On y place
  ses propres **Entrées** et **Sorties** (double-clic pour les renommer) ; **Table de vérité** calcule le
  résultat pour toutes les combinaisons des entrées câblées, et la **batterie de tests** du panneau de
  gauche vérifie les sorties attendues qu'on a écrites soi-même. **Mes constructions** enregistre le circuit
  (et ses tests) sous un nom, pour le rouvrir, le renommer ou le supprimer plus tard. Chaque construction
  enregistrée apparaît aussi dans la palette, rubrique **Mes constructions** : elle se pose comme un
  composant, avec ses entrées et sorties, même si elle contient de la mémoire ou d'autres constructions.
- **⊳ Symboles** dessine les portes (AND, OR, NOT, XOR…) avec leur symbole officiel, comme dans les manuels.
- **📋 Copier le schéma** copie directement le circuit en texte, une ligne par porte (`MUX1 = MUX(A: AND1, B: OR1, S: Op0)`),
  pratique pour le partager ou demander de l'aide.
- **✎ Crayon** (en haut) : dessine par-dessus tout l'écran, avec plusieurs couleurs, une gomme et
  <kbd>Ctrl</kbd>+<kbd>Z</kbd> ; <kbd>Échap</kbd> range le crayon. Chaque écran garde son dessin, et chaque
  trait reste accroché à ce qu'il recouvre : il défile avec le menu ou un panneau, et suit le zoom du circuit.

## Le processeur NANDO-8

Six registres de 8 bits (R0 à R5), chaque instruction tient sur un octet :

| Mode | Octet | Effet |
| --- | --- | --- |
| Immédiat | `00vvvvvv` | R0 = v (0 à 63) |
| Calcul | `01000ooo` | R3 = R1 op R2 (or, nand, nor, and, add, sub, xor, xnor) |
| Copie | `10sssddd` | d = s (6 = entrée en source, sortie en destination) |
| Saut | `11000ccc` | si condition(R3) alors PC = R0 |

Mnémoniques : `imm v`, `mov s d`, `add`, `sub`…, `jmp`, `jz`, `jnz`, `jlt`, `jle`, `jgt`, `jge`, `nop`.
`jz etiquette` est un raccourci pour `imm etiquette` suivi de `jz`.

Instructions débloquées au fil du chapitre Assemblage (champ `introduces` des niveaux) :

| Mnémonique | Octet | Effet |
| --- | --- | --- |
| `shl` | `01001000` | R3 = R1 décalé d'un cran à gauche (× 2) |
| `shr` | `01001001` | R3 = R1 décalé d'un cran à droite (÷ 2) |
| `load` | `01010000` | R3 = RAM[R1] (mémoire de 256 cases, séparée du programme) |
| `store` | `01010001` | RAM[R1] = R2 |
| `call etiquette` | `11001000` | empile l'adresse suivante, puis PC = R0 (pile de 16 appels) |
| `ret` | `11001001` | PC = adresse dépilée |

## Structure du code

```
index.html          page unique
css/style.css       styles (thèmes clair et sombre)
js/components.js    composants et simulateur de circuits
js/cpu.js           assembleur et émulateur NANDO-8
js/levels.js        chapitres et niveaux
js/editor.js        éditeur de circuits (canvas)
js/draw.js          crayon pour dessiner par-dessus l'écran
js/app.js           menu, progression, écrans
tests/run.js        vérifie que chaque niveau est résoluble
tests/ui.js         tests de l'interface (Playwright)
```

## Tests

```sh
node tests/run.js
```

Le script résout chaque niveau avec une solution de référence (qui n'utilise que les composants
débloqués à ce stade) et teste l'assembleur et l'émulateur.

Tests de l'interface dans un vrai navigateur (câblage à la souris, suppression, fichier de sauvegarde) :

```sh
npm install
npx playwright install chromium
npm run test:ui
```

## Ajouter un niveau

Ajoute une entrée dans `js/levels.js` :

- **circuit** : `inputs`, `outputs`, `tests` (via `truthTable` ou `sequence`), `pins` (une phrase
  par entrée et par sortie, affichée sous l'énoncé ; `bitPins('A', 2)` décrit les bits d'un nombre),
  et optionnellement `unlock` (composant débloqué, à définir dans `js/components.js`) ;
- **asm** : `tests` sous forme de `{ inputs: [...], outputs: [...] }`, `introduces` pour présenter de
  nouvelles instructions (elles restent disponibles dans les niveaux suivants), et `group: 2` si les entrées
  se lisent par paires (l'exemple de l'énoncé les affiche alors groupées).

La table attendue (repliée) et l'exemple d'entrées et de sorties sont générés à partir des tests.

Pense à ajouter une solution de référence dans `tests/run.js`.
