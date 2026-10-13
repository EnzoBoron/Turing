# TURING — du NAND à l'assembleur

Un jeu de puzzle pédagogique : à partir d'une seule porte **NAND**, construis toutes les portes logiques,
puis des composants avec mémoire, un processeur complet, et enfin programme-le en assembleur.

## Jouer

Ouvre simplement `index.html` dans un navigateur : aucune installation, aucune dépendance.
La progression, les circuits et les programmes sont sauvegardés dans le navigateur (`localStorage`).

## Ce que tu apprends

| Chapitre | Contenu |
| --- | --- |
| **1. Portes logiques** | NAND, NOT, AND, OR, NOR, XOR, XNOR, Majorité. Chaque porte construite est débloquée comme composant. |
| **2. Composants** | Demi-additionneur, additionneur complet, multiplexeur, décodeur, puis la mémoire : le composant DÉLAI, l'oscillateur, le bit de mémoire et le compteur. |
| **3. Architecture** | ALU 1 bit, unité de condition, décodeur 3 bits, registre, compteur de programme, puis l'assemblage du processeur **NANDO-8**, un ordinateur Turing-complet. |
| **4. Assemblage** | Programmation du NANDO-8 : d'abord en code machine brut, puis avec des mnémoniques, des étiquettes et des constantes. Énigmes : écho, addition, parité, compte à rebours, maximum, multiplication, somme… |

## Commandes de l'éditeur de circuits

- Clique sur un composant de la palette pour l'ajouter.
- Glisse depuis une pastille (entrée ou sortie) vers une autre pour tirer un fil.
- Clique sur une entrée (A, B…) pour basculer sa valeur : les fils allumés sont orange.
- <kbd>Suppr</kbd> ou clic droit supprime la sélection. Molette : zoom ; glisser le fond : déplacer la vue.
- **Tick** fait avancer l'horloge dans les niveaux avec mémoire.

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

## Structure du code

```
index.html          page unique
css/style.css       styles (thèmes clair et sombre)
js/components.js    composants et simulateur de circuits
js/cpu.js           assembleur et émulateur NANDO-8
js/levels.js        chapitres et niveaux
js/editor.js        éditeur de circuits (canvas)
js/app.js           menu, progression, écrans
tests/run.js        vérifie que chaque niveau est résoluble
```

## Tests

```sh
node tests/run.js
```

Le script résout chaque niveau avec une solution de référence (qui n'utilise que les composants
débloqués à ce stade) et teste l'assembleur et l'émulateur.

## Ajouter un niveau

Ajoute une entrée dans `js/levels.js` :

- **circuit** : `inputs`, `outputs`, `tests` (via `truthTable` ou `sequence`), et optionnellement
  `unlock` (composant débloqué, à définir dans `js/components.js`) ;
- **asm** : `tests` sous forme de `{ inputs: [...], outputs: [...] }`.

Pense à ajouter une solution de référence dans `tests/run.js`.
