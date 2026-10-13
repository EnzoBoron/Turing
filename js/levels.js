// Chapitres et niveaux du jeu.
(function (global) {
  'use strict';

  // Générateur pseudo-aléatoire déterministe (les tests restent stables).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

  // Table de vérité complète d'une fonction combinatoire.
  function truthTable(nIn, fn) {
    const tests = [];
    for (let n = 0; n < 1 << nIn; n++) {
      const ins = [];
      for (let k = 0; k < nIn; k++) ins.push((n >> k) & 1);
      tests.push({ steps: [{ in: ins, out: fn(ins) }] });
    }
    return tests;
  }

  // Test séquentiel à partir d'un modèle : model(état, entrées) -> [sorties, nouvel état].
  function sequence(model, init, inputs) {
    let state = init;
    const steps = inputs.map((ins) => {
      const [out, next] = model(state, ins);
      state = next;
      return { in: ins, out };
    });
    return { steps };
  }

  function randomBits(seed, count, width) {
    const r = rng(seed);
    return Array.from({ length: count }, () => Array.from({ length: width }, () => (r() < 0.5 ? 1 : 0)));
  }

  const CHAPTERS = [
    {
      id: 'gates', title: 'Portes logiques',
      blurb: 'Les portes logiques sont les briques fondamentales du calcul. Avec une seule porte NAND, construis toutes les autres.',
    },
    {
      id: 'components', title: 'Composants',
      blurb: 'En combinant les portes et en introduisant la mémoire, des constructions plus complexes deviennent possibles.',
    },
    {
      id: 'architecture', title: 'Architecture',
      blurb: 'Assemble tes composants pour former un vrai ordinateur, capable de calculer tout ce que calcule une machine de Turing.',
    },
    {
      id: 'assembly', title: 'Assemblage',
      blurb: 'Les ordinateurs se programment en binaire. Crée un langage d\'assemblage pour te simplifier la vie et résous des énigmes de programmation sur ton propre matériel.',
    },
  ];

  const LEVELS = [];
  const add = (lvl) => LEVELS.push(Object.assign({ type: 'circuit', inputs: [], outputs: [] }, lvl));

  // ===================================================== Chapitre 1 : portes

  const num = (bits) => bits.reduce((acc, v, k) => acc + (v << k), 0);

  add({
    id: 'nand', chapter: 'gates', title: 'La porte NAND',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>Tout ordinateur peut être construit à partir d'une seule porte : <b>NAND</b> (« NON-ET »).
      Sa sortie vaut 0 uniquement quand ses deux entrées valent 1.</p>
      <p><b>Commandes :</b> clique sur une porte de la palette pour l'ajouter, glisse ses pastilles
      pour tirer des fils, clique sur une entrée pour changer sa valeur. <kbd>Suppr</kbd> ou clic
      droit pour effacer.</p>
      <p>Relie A et B à une porte NAND, puis sa sortie à Q, et clique sur <b>Vérifier</b>.</p>`,
    tests: truthTable(2, ([a, c]) => [a && c ? 0 : 1]),
  });
  add({
    id: 'not', chapter: 'gates', title: 'NOT', unlock: 'NOT',
    inputs: ['A'], outputs: ['Q'],
    desc: `<p>La porte <b>NOT</b> inverse son entrée : 0 devient 1 et 1 devient 0.</p>
      <p>Indice : que fait une porte NAND quand ses deux entrées sont identiques ?</p>
      <p><b>Astuce :</b> une même sortie peut alimenter <i>plusieurs</i> entrées. Tire simplement
      un deuxième fil depuis la même pastille.</p>`,
    tests: truthTable(1, ([a]) => [1 - a]),
  });
  add({
    id: 'constants', chapter: 'gates', title: 'Constantes',
    inputs: ['A'], outputs: ['Un', 'Zéro'],
    desc: `<p>Quelle que soit la valeur de A, la sortie <b>Un</b> doit toujours valoir 1
      et la sortie <b>Zéro</b> toujours 0.</p>
      <p>Indice : « A » et « NOT A » ne peuvent jamais valoir 1 en même temps.</p>`,
    tests: truthTable(1, () => [1, 0]),
  });
  add({
    id: 'and', chapter: 'gates', title: 'AND', unlock: 'AND',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La porte <b>AND</b> (« ET ») vaut 1 seulement si A <i>et</i> B valent 1.</p>
      <p>NAND signifie « NOT AND »… il suffit donc de défaire le NOT.</p>`,
    tests: truthTable(2, ([a, c]) => [a & c]),
  });
  add({
    id: 'and3', chapter: 'gates', title: 'AND à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Q vaut 1 seulement si <b>les trois</b> entrées valent 1.</p>
      <p>Les portes se chaînent : le résultat d'une porte peut devenir l'entrée de la suivante.</p>`,
    tests: truthTable(3, ([a, c, d]) => [a & c & d]),
  });
  add({
    id: 'a_not_b', chapter: 'gates', title: 'A sans B',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>Q vaut 1 quand A vaut 1 <b>et</b> que B vaut 0. B agit comme un « veto ».</p>`,
    tests: truthTable(2, ([a, c]) => [a & (1 - c)]),
  });
  add({
    id: 'or', chapter: 'gates', title: 'OR', unlock: 'OR',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La porte <b>OR</b> (« OU ») vaut 1 si A <i>ou</i> B (ou les deux) valent 1.</p>
      <p>Loi de De Morgan : « A ou B » est faux uniquement si « non A » et « non B » sont tous deux vrais.</p>`,
    tests: truthTable(2, ([a, c]) => [a | c]),
  });
  add({
    id: 'or3', chapter: 'gates', title: 'OR à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Q vaut 1 si <b>au moins une</b> des trois entrées vaut 1.</p>`,
    tests: truthTable(3, ([a, c, d]) => [a | c | d]),
  });
  add({
    id: 'implies', chapter: 'gates', title: 'Implication',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La règle « <b>si A alors B</b> » n'est enfreinte que dans un cas : A est vrai mais B est faux.
      Q doit valoir 0 dans ce cas, et 1 dans tous les autres.</p>`,
    tests: truthTable(2, ([a, c]) => [(1 - a) | c]),
  });
  add({
    id: 'alarm', chapter: 'gates', title: 'Alarme',
    inputs: ['Armée', 'Porte', 'Code'], outputs: ['Sirène'],
    desc: `<p>La sirène doit sonner si l'alarme est <b>armée</b>, que la <b>porte</b> est ouverte,
      et que le bon <b>code</b> n'a <i>pas</i> été saisi.</p>`,
    tests: truthTable(3, ([arm, door, code]) => [arm & door & (1 - code)]),
  });
  add({
    id: 'nor', chapter: 'gates', title: 'NOR', unlock: 'NOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La porte <b>NOR</b> vaut 1 seulement si aucune entrée ne vaut 1. C'est l'inverse de OR.</p>`,
    tests: truthTable(2, ([a, c]) => [1 - (a | c)]),
  });
  add({
    id: 'none3', chapter: 'gates', title: 'Silence total',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Q vaut 1 seulement si <b>aucune</b> des trois entrées ne vaut 1.</p>`,
    tests: truthTable(3, ([a, c, d]) => [1 - (a | c | d)]),
  });
  add({
    id: 'xor', chapter: 'gates', title: 'XOR', unlock: 'XOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La porte <b>XOR</b> (« OU exclusif ») vaut 1 si les entrées sont <i>différentes</i>.</p>
      <p>Défi : il est possible de la construire avec seulement 4 portes NAND.</p>`,
    tests: truthTable(2, ([a, c]) => [a ^ c]),
  });
  add({
    id: 'parity3', chapter: 'gates', title: 'Parité',
    inputs: ['A', 'B', 'C'], outputs: ['Impair'],
    desc: `<p><b>Impair</b> vaut 1 si le nombre d'entrées à 1 est impair (1 ou 3).</p>
      <p>Ce circuit sert à détecter des erreurs de transmission : un bit inversé change la parité.</p>`,
    tests: truthTable(3, ([a, c, d]) => [a ^ c ^ d]),
  });
  add({
    id: 'exactly_one', chapter: 'gates', title: 'Exactement un',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Q vaut 1 si <b>exactement une</b> entrée vaut 1 : ni zéro, ni deux, ni trois.</p>`,
    tests: truthTable(3, ([a, c, d]) => [a + c + d === 1 ? 1 : 0]),
  });
  add({
    id: 'xnor', chapter: 'gates', title: 'XNOR', unlock: 'XNOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    desc: `<p>La porte <b>XNOR</b> vaut 1 si les entrées sont <i>identiques</i>.</p>`,
    tests: truthTable(2, ([a, c]) => [1 - (a ^ c)]),
  });
  add({
    id: 'all_equal', chapter: 'gates', title: 'Unanimité',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Q vaut 1 si les trois entrées ont <b>la même valeur</b> (toutes à 0 ou toutes à 1).</p>`,
    tests: truthTable(3, ([a, c, d]) => [a === c && c === d ? 1 : 0]),
  });
  add({
    id: 'eq2', chapter: 'gates', title: 'Égalité 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Égal'],
    desc: `<p>Deux nombres de 2 bits : A = A0 + 2·A1 et B = B0 + 2·B1 (de 0 à 3).
      <b>Égal</b> vaut 1 si A = B.</p>
      <p>Deux nombres sont égaux quand chacun de leurs bits est égal.</p>`,
    tests: truthTable(4, ([a0, a1, b0, b1]) => [a0 === b0 && a1 === b1 ? 1 : 0]),
  });
  add({
    id: 'cmp1', chapter: 'gates', title: 'Comparateur 1 bit',
    inputs: ['A', 'B'], outputs: ['Sup', 'Égal', 'Inf'],
    desc: `<p>Compare A et B : <b>Sup</b> vaut 1 si A &gt; B, <b>Égal</b> si A = B, <b>Inf</b> si A &lt; B.
      Une seule sortie est allumée à la fois.</p>`,
    tests: truthTable(2, ([a, c]) => [a > c ? 1 : 0, a === c ? 1 : 0, a < c ? 1 : 0]),
  });
  add({
    id: 'gt2', chapter: 'gates', title: 'Plus grand 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Sup'],
    desc: `<p>A = A0 + 2·A1 et B = B0 + 2·B1. <b>Sup</b> vaut 1 si A &gt; B.</p>
      <p>Indice : compare d'abord les bits de poids fort. S'ils sont égaux, ce sont les bits de poids faible qui décident.</p>`,
    tests: truthTable(4, ([a0, a1, b0, b1]) => [a0 + 2 * a1 > b0 + 2 * b1 ? 1 : 0]),
  });
  add({
    id: 'ge5', chapter: 'gates', title: 'Au moins 5',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    desc: `<p>Les entrées forment un nombre N = N0 + 2·N1 + 4·N2 (de 0 à 7). Q vaut 1 si <b>N ≥ 5</b>.</p>`,
    tests: truthTable(3, (bits) => [num(bits) >= 5 ? 1 : 0]),
  });
  add({
    id: 'prime', chapter: 'gates', title: 'Nombre premier',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Premier'],
    desc: `<p>N = N0 + 2·N1 + 4·N2. <b>Premier</b> vaut 1 si N est un nombre premier : 2, 3, 5 ou 7.</p>
      <p>Indice : écris les quatre nombres en binaire et cherche ce qu'ils ont en commun.</p>`,
    tests: truthTable(3, (bits) => [[2, 3, 5, 7].includes(num(bits)) ? 1 : 0]),
  });
  add({
    id: 'mult3', chapter: 'gates', title: 'Multiple de 3',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    desc: `<p>N = N0 + 2·N1 + 4·N2. Q vaut 1 si N est un <b>multiple de 3</b> : 0, 3 ou 6.</p>`,
    tests: truthTable(3, (bits) => [num(bits) % 3 === 0 ? 1 : 0]),
  });
  add({
    id: 'maj', chapter: 'gates', title: 'Majorité',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    desc: `<p>Trois entrées votent. La sortie vaut 1 si <b>au moins deux</b> entrées valent 1.</p>
      <p>Ce circuit reviendra bientôt sous un autre nom…</p>`,
    tests: truthTable(3, ([a, c, d]) => [a + c + d >= 2 ? 1 : 0]),
  });

  // ================================================ Chapitre 2 : composants

  add({
    id: 'half_add', chapter: 'components', title: 'Demi-additionneur', unlock: 'HALF_ADD',
    inputs: ['A', 'B'], outputs: ['S', 'C'],
    desc: `<p>Additionne deux bits. En binaire, 1 + 1 = 10 : la somme <b>S</b> est le chiffre des unités
      et la retenue <b>C</b> celui des deuxaines.</p>`,
    tests: truthTable(2, ([a, c]) => [a ^ c, a & c]),
  });
  add({
    id: 'full_add', chapter: 'components', title: 'Additionneur complet', unlock: 'FULL_ADD',
    inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'],
    desc: `<p>Additionne trois bits : A, B et la retenue entrante <b>Ci</b>. Le résultat (de 0 à 3) s'écrit
      sur deux bits : <b>S</b> et la retenue sortante <b>Co</b>.</p>
      <p>En chaînant ces additionneurs, on additionne des nombres de n'importe quelle taille.</p>`,
    tests: truthTable(3, ([a, c, d]) => [(a + c + d) & 1, (a + c + d) >> 1]),
  });
  add({
    id: 'mux', chapter: 'components', title: 'Multiplexeur', unlock: 'MUX',
    inputs: ['A', 'B', 'S'], outputs: ['Q'],
    desc: `<p>Un <b>multiplexeur</b> est un aiguillage : si S = 0, la sortie recopie A ; si S = 1, elle recopie B.</p>`,
    tests: truthTable(3, ([a, c, s]) => [s ? c : a]),
  });
  add({
    id: 'dec2', chapter: 'components', title: 'Décodeur 2 bits', unlock: 'DEC2',
    inputs: ['A0', 'A1'], outputs: ['O0', 'O1', 'O2', 'O3'],
    desc: `<p>Les entrées forment un nombre n = A0 + 2·A1 (de 0 à 3). Allume <b>uniquement</b> la sortie On.</p>
      <p>Les décodeurs servent à choisir quel registre ou quelle opération activer.</p>`,
    tests: truthTable(2, ([a0, a1]) => [0, 1, 2, 3].map((i) => (i === a0 + 2 * a1 ? 1 : 0))),
  });
  add({
    id: 'osc', chapter: 'components', title: 'Oscillateur', unlock: 'DELAY', give: ['DELAY'],
    inputs: [], outputs: ['Q'], sequential: true,
    desc: `<p>Voici un nouveau composant : le <b>DÉLAI</b>. Sa sortie est la valeur qu'avait son entrée
      au <i>tick</i> d'horloge précédent (0 au départ).</p>
      <p>Grâce à lui, un circuit peut enfin <b>se souvenir</b>. Il permet aussi des boucles, interdites sinon.</p>
      <p>Fais en sorte que Q alterne à chaque tick : 0, 1, 0, 1… (ou 1, 0, 1, 0…). Utilise le bouton
      <b>Tick</b> pour faire avancer l'horloge.</p>`,
    tests: [{
      alts: [0, 1].map((first) => Array.from({ length: 8 }, (_, t) => ({ in: [], out: [(t + first) & 1] }))),
    }],
  });
  add({
    id: 'mem', chapter: 'components', title: 'Bit de mémoire', unlock: 'MEM',
    inputs: ['Sauv', 'Val'], outputs: ['Q'], sequential: true,
    desc: `<p>Construis une cellule mémoire d'un bit. Q affiche la valeur mémorisée.</p>
      <p>Quand <b>Sauv</b> = 1, la valeur <b>Val</b> est enregistrée et apparaît sur Q au tick suivant.
      Sinon, la valeur mémorisée est conservée indéfiniment.</p>`,
    tests: [1, 2].map((seed) =>
      sequence((st, [save, v]) => [[st], save ? v : st], 0, randomBits(seed * 7, 12, 2))),
  });
  add({
    id: 'counter', chapter: 'components', title: 'Compteur 2 bits',
    inputs: ['Inc'], outputs: ['B0', 'B1'], sequential: true,
    desc: `<p>Compte le nombre de ticks où <b>Inc</b> valait 1, modulo 4. La valeur s'affiche en binaire :
      n = B0 + 2·B1. Comme pour la mémoire, le compteur affiche sa valeur <i>avant</i> l'incrément du tick courant.</p>`,
    tests: [3, 4].map((seed) =>
      sequence((st, [inc]) => [[st & 1, st >> 1], (st + inc) & 3], 0, randomBits(seed * 11, 14, 1))),
  });

  // ============================================== Chapitre 3 : architecture

  const ALU1_NAMES = ['AND', 'OR', 'XOR', 'ADD'];
  add({
    id: 'alu1', chapter: 'architecture', title: 'ALU 1 bit',
    inputs: ['Op0', 'Op1', 'A', 'B', 'Ci'], outputs: ['R', 'Co'],
    desc: `<p>L'<b>unité arithmétique et logique</b> est le cœur calculatoire du processeur.
      Le code d'opération op = Op0 + 2·Op1 choisit le calcul :</p>
      <table class="mini"><tr><th>op</th><th>R</th><th>Co</th></tr>
      <tr><td>0</td><td>A AND B</td><td>0</td></tr>
      <tr><td>1</td><td>A OR B</td><td>0</td></tr>
      <tr><td>2</td><td>A XOR B</td><td>0</td></tr>
      <tr><td>3</td><td>somme de A + B + Ci</td><td>retenue</td></tr></table>
      <p>Huit de ces tranches côte à côte forment l'ALU 8 bits de l'ordinateur.</p>`,
    tests: truthTable(5, ([o0, o1, a, c, ci]) => {
      const op = o0 + 2 * o1;
      if (op === 0) return [a & c, 0];
      if (op === 1) return [a | c, 0];
      if (op === 2) return [a ^ c, 0];
      return [(a + c + ci) & 1, (a + c + ci) >> 1];
    }),
    opNames: ALU1_NAMES,
  });
  add({
    id: 'cond', chapter: 'architecture', title: 'Unité de condition',
    inputs: ['C0', 'C1', 'C2', 'Z', 'N'], outputs: ['Saut'],
    desc: `<p>Pour décider d'un saut, le processeur regarde le registre R3 à travers deux signaux :
      <b>Z</b> (R3 = 0) et <b>N</b> (R3 &lt; 0). Le code c = C0 + 2·C1 + 4·C2 donne la condition :</p>
      <table class="mini"><tr><th>c</th><th>saut si</th><th>c</th><th>saut si</th></tr>
      <tr><td>0</td><td>jamais</td><td>4</td><td>toujours</td></tr>
      <tr><td>1</td><td>= 0</td><td>5</td><td>≠ 0</td></tr>
      <tr><td>2</td><td>&lt; 0</td><td>6</td><td>≥ 0</td></tr>
      <tr><td>3</td><td>≤ 0</td><td>7</td><td>&gt; 0</td></tr></table>
      <p>Remarque : C2 inverse simplement le résultat des conditions 0 à 3.</p>`,
    tests: truthTable(5, ([c0, c1, c2, z, n]) => {
      const base = [0, z, n, z | n][c0 + 2 * c1];
      return [c2 ? 1 - base : base];
    }).filter((t) => !(t.steps[0].in[3] && t.steps[0].in[4])), // Z et N ne sont jamais vrais ensemble
  });
  add({
    id: 'dec3', chapter: 'architecture', title: 'Décodeur 3 bits', unlock: 'DEC3',
    inputs: ['A0', 'A1', 'A2'], outputs: ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
    desc: `<p>Même principe que le décodeur 2 bits, mais pour 8 sorties. Il sélectionnera
      les registres source et destination des instructions de copie.</p>`,
    tests: truthTable(3, ([a0, a1, a2]) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === a0 + 2 * a1 + 4 * a2 ? 1 : 0))),
  });
  add({
    id: 'reg', chapter: 'architecture', title: 'Registre',
    inputs: ['Charger', 'Lire', 'Val'], outputs: ['Q'], sequential: true,
    desc: `<p>Un <b>registre</b> est une mémoire branchée sur un bus partagé par tous les autres registres.</p>
      <p>Quand <b>Charger</b> = 1, Val est mémorisée (visible au tick suivant). Q ne montre la valeur
      mémorisée que lorsque <b>Lire</b> = 1 ; sinon Q vaut 0 pour ne pas brouiller le bus.</p>`,
    tests: [5, 6].map((seed) =>
      sequence((st, [load, read, v]) => [[read ? st : 0], load ? v : st], 0, randomBits(seed * 13, 14, 3))),
  });
  add({
    id: 'pc', chapter: 'architecture', title: 'Compteur de programme',
    inputs: ['Écrire', 'V0', 'V1'], outputs: ['P0', 'P1'], sequential: true,
    desc: `<p>Le <b>compteur de programme</b> (PC) indique l'adresse de l'instruction à exécuter.
      À chaque tick il passe à l'instruction suivante (+1, modulo 4 ici)… sauf lors d'un saut.</p>
      <p>Si <b>Écrire</b> = 1, la prochaine valeur est V = V0 + 2·V1 au lieu de P + 1.
      P = P0 + 2·P1 affiche la valeur courante.</p>`,
    tests: [7, 8].map((seed) => {
      const r = rng(seed);
      const ins = Array.from({ length: 14 }, () => [r() < 0.3 ? 1 : 0, r() < 0.5 ? 1 : 0, r() < 0.5 ? 1 : 0]);
      return sequence((st, [w, v0, v1]) => [[st & 1, st >> 1], w ? v0 + 2 * v1 : (st + 1) & 3], 0, ins);
    }),
  });
  add({
    id: 'computer', chapter: 'architecture', title: 'L\'ordinateur NANDO-8', type: 'lesson',
  });

  // =============================================== Chapitre 4 : assemblage

  const addAsm = (lvl) => add(Object.assign({ type: 'asm' }, lvl));
  const asmTests = (count, gen) => Array.from({ length: count }, (_, k) => gen(rng(1000 + k * 97)));

  addAsm({
    id: 'machine_code', chapter: 'assembly', title: 'Code machine', raw: true,
    desc: `<p>Le processeur ne comprend que des octets. Écris un programme <b>en nombres</b> (un octet par ligne,
      en décimal, en binaire <code>0b…</code> ou en hexadécimal <code>0x…</code>) qui envoie <b>5</b> puis <b>21</b> sur la sortie.</p>
      <p>Rappel : <code>00vvvvvv</code> met v dans R0, et <code>10sssddd</code> copie le registre s vers d
      (6 = entrée/sortie). Par exemple <code>0b10000110</code> copie R0 vers la sortie.</p>
      <p>Astuce : <code>const NOM valeur</code> permet de nommer un nombre, et les termes s'additionnent : <code>copie + 6</code>.</p>`,
    starter: '# Un octet par ligne\n',
    tests: [{ inputs: [], outputs: [5, 21] }],
  });
  addAsm({
    id: 'echo', chapter: 'assembly', title: 'Écho',
    desc: `<p>L'assembleur connaît maintenant des <b>mnémoniques</b> (voir la référence).
      <code>mov in r1</code> est bien plus lisible que <code>0b10110001</code> !</p>
      <p>Recopie chaque entrée sur la sortie, indéfiniment. Utilise une <b>étiquette</b>
      (<code>debut:</code>) et un saut inconditionnel (<code>jmp debut</code>).</p>`,
    starter: 'debut:\n  \n',
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs };
    }),
  });
  addAsm({
    id: 'plus5', chapter: 'assembly', title: 'Plus cinq',
    desc: `<p>Pour chaque entrée x, écris x + 5 sur la sortie.</p>
      <p>Les calculs se font toujours entre <b>R1</b> et <b>R2</b>, et le résultat arrive dans <b>R3</b>.</p>`,
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 200));
      return { inputs: xs, outputs: xs.map((x) => x + 5) };
    }),
  });
  addAsm({
    id: 'double', chapter: 'assembly', title: 'Le double',
    desc: `<p>Pour chaque entrée x, écris 2·x sur la sortie (les valeurs sont prises modulo 256).</p>`,
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs.map((x) => (2 * x) & 255) };
    }),
  });
  addAsm({
    id: 'parity', chapter: 'assembly', title: 'Pair ou impair',
    desc: `<p>Pour chaque entrée, écris <b>1</b> si elle est impaire, <b>0</b> si elle est paire.</p>`,
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 8 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs.map((x) => x & 1) };
    }),
  });
  addAsm({
    id: 'countdown', chapter: 'assembly', title: 'Compte à rebours',
    desc: `<p>Lis un nombre n (entre 1 et 10), puis écris n, n−1, …, 1, 0. Recommence avec l'entrée suivante.</p>
      <p>Les sauts conditionnels testent la valeur de <b>R3</b> : <code>jz</code> saute si R3 = 0,
      <code>jgt</code> si R3 &gt; 0, etc.</p>`,
    tests: asmTests(3, (r) => {
      const ns = [randInt(r, 1, 10), randInt(r, 1, 10)];
      const outs = [];
      ns.forEach((n) => { for (let k = n; k >= 0; k--) outs.push(k); });
      return { inputs: ns, outputs: outs };
    }),
  });
  addAsm({
    id: 'max', chapter: 'assembly', title: 'Le plus grand',
    desc: `<p>Les entrées arrivent par paires (a, b) avec des valeurs entre 0 et 100.
      Pour chaque paire, écris la plus grande des deux.</p>
      <p>Indice : le signe de a − b te dit laquelle est la plus grande. Les registres R4 et R5 sont libres.</p>`,
    tests: asmTests(3, (r) => {
      const ins = [];
      const outs = [];
      for (let k = 0; k < 4; k++) {
        const a = randInt(r, 0, 100);
        const c = randInt(r, 0, 100);
        ins.push(a, c);
        outs.push(Math.max(a, c));
      }
      return { inputs: ins, outputs: outs };
    }),
  });
  addAsm({
    id: 'mul', chapter: 'assembly', title: 'Multiplication',
    desc: `<p>Le processeur ne sait pas multiplier… mais il sait additionner et boucler.</p>
      <p>Les entrées arrivent par paires (a, b), entre 0 et 12. Écris a × b.</p>`,
    tests: asmTests(3, (r) => {
      const ins = [];
      const outs = [];
      for (let k = 0; k < 3; k++) {
        const a = randInt(r, 0, 12);
        const c = randInt(r, 0, 12);
        ins.push(a, c);
        outs.push(a * c);
      }
      ins.push(7, 0);
      outs.push(0);
      return { inputs: ins, outputs: outs };
    }),
    maxSteps: 20000,
  });
  addAsm({
    id: 'sum', chapter: 'assembly', title: 'Somme jusqu\'à zéro',
    desc: `<p>Lis des nombres et additionne-les jusqu'à recevoir un <b>0</b>. Écris alors la somme,
      puis recommence une nouvelle somme.</p>`,
    tests: asmTests(3, (r) => {
      const ins = [];
      const outs = [];
      for (let g = 0; g < 3; g++) {
        let s = 0;
        const n = randInt(r, 1, 5);
        for (let k = 0; k < n; k++) {
          const x = randInt(r, 1, 30);
          ins.push(x);
          s += x;
        }
        ins.push(0);
        outs.push(s & 255);
      }
      return { inputs: ins, outputs: outs };
    }),
  });

  const api = { CHAPTERS, LEVELS, truthTable, sequence, rng };
  global.Levels = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
