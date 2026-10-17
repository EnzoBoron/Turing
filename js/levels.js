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

  // Légende des branchements : ce que représente chaque entrée et sortie.
  // bitPins('A', 2) décrit A0 et A1, les bits du nombre A.
  function bitPins(name, count, what = 'du nombre ' + name) {
    const pins = {};
    for (let k = 0; k < count; k++) pins[name + k] = `bit ${what} qui compte pour ${1 << k}`;
    return pins;
  }
  // Sorties d'un décodeur : O0 s'allume pour n = 0, O1 pour n = 1…
  function decoderPins(count) {
    const pins = {};
    for (let k = 0; k < count; k++) pins['O' + k] = `s'allume seulement quand n = ${k}`;
    return pins;
  }
  const AB = { A: 'première entrée', B: 'deuxième entrée' };
  const ABC = { A: 'première entrée', B: 'deuxième entrée', C: 'troisième entrée' };
  const NUM3 = 'Les trois entrées forment ensemble un nombre N de 0 à 7 : N0 compte pour 1, N1 pour 2 et N2 pour 4. '
    + 'On additionne ceux qui valent 1. Par exemple, N2 = 1, N1 = 0 et N0 = 1 donnent N = 4 + 1 = 5.';
  const TABLE3 = 'Les 8 valeurs, écrites N2 N1 N0 : <code>000</code> = 0, <code>001</code> = 1, <code>010</code> = 2, '
    + '<code>011</code> = 3, <code>100</code> = 4, <code>101</code> = 5, <code>110</code> = 6, <code>111</code> = 7.';
  const NUM2 = 'A0 et A1 forment ensemble un nombre A de 0 à 3 : A0 compte pour 1 et A1 compte pour 2. '
    + 'Par exemple, A1 = 1 et A0 = 0 donnent A = 2. Même chose pour B avec B0 et B1.';

  add({
    id: 'nand', chapter: 'gates', title: 'La porte NAND',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '0 seulement quand A et B valent 1 tous les deux, 1 sinon' },
    desc: `<p>Bienvenue ! Dans ce jeu, tu vas construire un ordinateur entier en partant d'une seule pièce : la porte <b>NAND</b>.</p>
      <p>Une <b>porte logique</b> reçoit des signaux qui valent <b>0</b> (éteint) ou <b>1</b> (allumé) et en produit un nouveau.
      La porte NAND (« NON-ET ») répond <b>0 seulement quand ses deux entrées valent 1</b>, et 1 dans tous les autres cas.</p>
      <p><b>Objectif :</b> relie A et B aux deux entrées d'une porte NAND, puis la sortie de la porte à Q.
      Clique ensuite sur <b>Vérifier</b> : le jeu essaie toutes les combinaisons de A et B.</p>
      <p><b>Commandes :</b> clique sur une porte de la palette pour l'ajouter. Tire un fil en glissant d'une pastille
      à une autre. Clique sur une entrée (A, B…) pour changer sa valeur et voir le courant passer.
      <kbd>Suppr</kbd> ou clic droit pour effacer.</p>`,
    tests: truthTable(2, ([a, c]) => [a && c ? 0 : 1]),
  });
  add({
    id: 'not', chapter: 'gates', title: 'NOT', unlock: 'NOT',
    inputs: ['A'], outputs: ['Q'],
    pins: { A: 'l\'entrée', Q: 'l\'inverse de A' },
    desc: `<p>La porte <b>NOT</b> (« NON ») est la plus simple : elle a une seule entrée et donne <b>l'inverse</b>.
      0 devient 1, et 1 devient 0.</p>
      <p><b>Objectif :</b> fabrique une porte NOT en n'utilisant que des portes NAND. Une fois réussie, elle rejoint
      ta palette et tu pourras la réutiliser dans les niveaux suivants.</p>
      <p>Exemple : si A = 1, Q doit valoir 0 ; si A = 0, Q doit valoir 1.</p>
      <p><b>À savoir :</b> une même sortie peut alimenter <i>plusieurs</i> entrées : tire simplement un deuxième fil
      depuis la même pastille. Par contre, une entrée ne reçoit qu'un seul fil.</p>`,
id: 'not', chapter: 'gates', title: 'NOT', unlock: 'NOT',
    inputs: ['A'], outputs: ['Q'],
    pins: { A: 'l\'entrée', Q: 'l\'inverse de A' },
    desc: `<p>La porte <b>NOT</b> (« NON ») est la plus simple : elle a une seule entrée et donne <b>l'inverse</b>.
      0 devient 1, et 1 devient 0.</p>
      <p><b>Objectif :</b> fabrique une porte NOT en n'utilisant que des portes NAND. Une fois réussie, elle rejoint
      ta palette et tu pourras la réutiliser dans les niveaux suivants.</p>
      <p>Exemple : si A = 1, Q doit valoir 0 ; si A = 0, Q doit valoir 1.</p>
      <p><b>À savoir :</b> une même sortie peut alimenter <i>plusieurs</i> entrées : tire simplement un deuxième fil
      depuis la même pastille. Par contre, une entrée ne reçoit qu'un seul fil.</p>`,
    hint: 'Que fait une porte NAND quand ses deux entrées reçoivent exactement le même signal ?',
    tests: truthTable(1, ([a]) => [1 - a]),
  });
  add({
    id: 'constants', chapter: 'gates', title: 'Constantes',
    inputs: ['A'], outputs: ['Un', 'Zéro'],
    pins: { A: 'une entrée quelconque : ton circuit doit marcher qu\'elle vaille 0 ou 1', Un: 'doit toujours valoir 1', Zéro: 'doit toujours valoir 0' },
    desc: `<p>Parfois, un circuit a besoin d'un signal qui ne change jamais : toujours 1, ou toujours 0.
      On appelle ça une <b>constante</b>.</p>
      <p><b>Objectif :</b> à partir de la seule entrée A, produis deux sorties : <b>Un</b>, qui vaut toujours 1,
      et <b>Zéro</b>, qui vaut toujours 0. Elles ne doivent pas bouger, que A vaille 0 ou 1.</p>
      <p>Pour tester, clique plusieurs fois sur A : tes deux sorties doivent rester figées.</p>`,
id: 'constants', chapter: 'gates', title: 'Constantes',
    inputs: ['A'], outputs: ['Un', 'Zéro'],
    pins: { A: 'une entrée quelconque : ton circuit doit marcher qu\'elle vaille 0 ou 1', Un: 'doit toujours valoir 1', Zéro: 'doit toujours valoir 0' },
    desc: `<p>Parfois, un circuit a besoin d'un signal qui ne change jamais : toujours 1, ou toujours 0.
      On appelle ça une <b>constante</b>.</p>
      <p><b>Objectif :</b> à partir de la seule entrée A, produis deux sorties : <b>Un</b>, qui vaut toujours 1,
      et <b>Zéro</b>, qui vaut toujours 0. Elles ne doivent pas bouger, que A vaille 0 ou 1.</p>
      <p>Pour tester, clique plusieurs fois sur A : tes deux sorties doivent rester figées.</p>`,
    hint: '« A » et « NOT A » ne peuvent jamais valoir 1 en même temps. Que répond une NAND qui reçoit les deux ?',
    tests: truthTable(1, () => [1, 0]),
  });
  add({
    id: 'and', chapter: 'gates', title: 'AND', unlock: 'AND',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 seulement si A et B valent 1' },
    desc: `<p>La porte <b>AND</b> (« ET ») vaut 1 seulement si A <b>et</b> B valent 1 tous les deux.
      C'est comme une porte à deux serrures : il faut les deux clés pour l'ouvrir.</p>
      <p><b>Objectif :</b> construis la porte AND. Elle rejoindra ta palette.</p>
      <p>Exemple : A = 1 et B = 1 donnent Q = 1. Dès qu'une entrée vaut 0, Q vaut 0.</p>`,
id: 'and', chapter: 'gates', title: 'AND', unlock: 'AND',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 seulement si A et B valent 1' },
    desc: `<p>La porte <b>AND</b> (« ET ») vaut 1 seulement si A <b>et</b> B valent 1 tous les deux.
      C'est comme une porte à deux serrures : il faut les deux clés pour l'ouvrir.</p>
      <p><b>Objectif :</b> construis la porte AND. Elle rejoindra ta palette.</p>
      <p>Exemple : A = 1 et B = 1 donnent Q = 1. Dès qu'une entrée vaut 0, Q vaut 0.</p>`,
    hint: 'NAND veut dire « NOT AND » : c\'est un AND suivi d\'un NOT. Comment annuler ce NOT ?',
    tests: truthTable(2, ([a, c]) => [a & c]),
  });
  add({
    id: 'and3', chapter: 'gates', title: 'AND à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 seulement si A, B et C valent tous 1' },
    desc: `<p>Les portes peuvent s'enchaîner : la sortie d'une porte peut devenir l'entrée de la suivante.
      C'est comme ça qu'on construit des circuits de plus en plus grands.</p>
      <p><b>Objectif :</b> Q doit valoir 1 seulement si <b>les trois</b> entrées A, B et C valent 1.
      Si une seule vaut 0, Q vaut 0.</p>
      <p>Exemple : A = 1, B = 1 et C = 0 donnent Q = 0.</p>`,
id: 'and3', chapter: 'gates', title: 'AND à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 seulement si A, B et C valent tous 1' },
    desc: `<p>Les portes peuvent s'enchaîner : la sortie d'une porte peut devenir l'entrée de la suivante.
      C'est comme ça qu'on construit des circuits de plus en plus grands.</p>
      <p><b>Objectif :</b> Q doit valoir 1 seulement si <b>les trois</b> entrées A, B et C valent 1.
      Si une seule vaut 0, Q vaut 0.</p>
      <p>Exemple : A = 1, B = 1 et C = 0 donnent Q = 0.</p>`,
    hint: 'Une porte AND ne prend que deux entrées. Que se passe-t-il si tu combines d\'abord deux entrées, puis le résultat avec la troisième ?',
    tests: truthTable(3, ([a, c, d]) => [a & c & d]),
  });
  add({
    id: 'a_not_b', chapter: 'gates', title: 'A sans B',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { A: 'le signal à laisser passer', B: 'le veto : quand il vaut 1, il bloque A', Q: '1 seulement si A = 1 et B = 0' },
    desc: `<p>Dans ce circuit, B joue le rôle d'un <b>veto</b> : il peut bloquer A.</p>
      <p><b>Objectif :</b> Q vaut 1 seulement quand A vaut 1 <b>et</b> que B vaut 0. Dès que B vaut 1, Q est bloqué
      à 0, quelle que soit la valeur de A.</p>
      <p>Exemples : A = 1 et B = 0 donnent Q = 1 ; A = 1 et B = 1 donnent Q = 0 (veto) ; si A = 0, Q vaut toujours 0.</p>`,
id: 'a_not_b', chapter: 'gates', title: 'A sans B',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { A: 'le signal à laisser passer', B: 'le veto : quand il vaut 1, il bloque A', Q: '1 seulement si A = 1 et B = 0' },
    desc: `<p>Dans ce circuit, B joue le rôle d'un <b>veto</b> : il peut bloquer A.</p>
      <p><b>Objectif :</b> Q vaut 1 seulement quand A vaut 1 <b>et</b> que B vaut 0. Dès que B vaut 1, Q est bloqué
      à 0, quelle que soit la valeur de A.</p>
      <p>Exemples : A = 1 et B = 0 donnent Q = 1 ; A = 1 et B = 1 donnent Q = 0 (veto) ; si A = 0, Q vaut toujours 0.</p>`,
    hint: 'Tu veux « A et (pas B) ». Tu as déjà construit les deux portes nécessaires.',
    tests: truthTable(2, ([a, c]) => [a & (1 - c)]),
  });
  add({
    id: 'or', chapter: 'gates', title: 'OR', unlock: 'OR',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 si au moins une des deux entrées vaut 1' },
    desc: `<p>La porte <b>OR</b> (« OU ») vaut 1 si <b>au moins une</b> de ses entrées vaut 1 : A, ou B, ou les deux.
      Elle ne vaut 0 que si les deux entrées valent 0.</p>
      <p>Exemple de la vraie vie : une lampe qui s'allume si on appuie sur l'interrupteur de l'entrée <i>ou</i>
      sur celui du salon.</p>
      <p><b>Objectif :</b> construis la porte OR. Elle rejoindra ta palette.</p>`,
id: 'or', chapter: 'gates', title: 'OR', unlock: 'OR',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 si au moins une des deux entrées vaut 1' },
    desc: `<p>La porte <b>OR</b> (« OU ») vaut 1 si <b>au moins une</b> de ses entrées vaut 1 : A, ou B, ou les deux.
      Elle ne vaut 0 que si les deux entrées valent 0.</p>
      <p>Exemple de la vraie vie : une lampe qui s'allume si on appuie sur l'interrupteur de l'entrée <i>ou</i>
      sur celui du salon.</p>
      <p><b>Objectif :</b> construis la porte OR. Elle rejoindra ta palette.</p>`,
    hint: 'Compare les tables : NAND donne 0 seulement pour (1, 1), et OR donne 0 seulement pour (0, 0). Que faudrait-il faire aux entrées avant de les envoyer dans une NAND ? (C\'est la loi de De Morgan.)',
    tests: truthTable(2, ([a, c]) => [a | c]),
  });
  add({
    id: 'or3', chapter: 'gates', title: 'OR à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si au moins une des trois entrées vaut 1' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si <b>au moins une</b> des trois entrées A, B, C vaut 1.
      Q ne vaut 0 que si les trois sont à 0.</p>
      <p>Exemple de la vraie vie : un détecteur de fumée dans trois pièces. L'alarme sonne si n'importe laquelle
      des pièces détecte de la fumée.</p>`,
id: 'or3', chapter: 'gates', title: 'OR à 3 entrées',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si au moins une des trois entrées vaut 1' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si <b>au moins une</b> des trois entrées A, B, C vaut 1.
      Q ne vaut 0 que si les trois sont à 0.</p>
      <p>Exemple de la vraie vie : un détecteur de fumée dans trois pièces. L'alarme sonne si n'importe laquelle
      des pièces détecte de la fumée.</p>`,
    hint: 'Même idée que pour le AND à 3 entrées.',
    tests: truthTable(3, ([a, c, d]) => [a | c | d]),
  });
  add({
    id: 'implies', chapter: 'gates', title: 'Implication',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { A: 'la condition : « si A… »', B: 'la conséquence : « … alors B »', Q: '0 seulement quand la règle est enfreinte (A = 1 et B = 0)' },
    desc: `<p>En logique, « <b>si A alors B</b> » est une promesse. Par exemple : « s'il pleut (A), alors je prends
      mon parapluie (B) ».</p>
      <p>La promesse n'est rompue que dans un seul cas : il pleut <b>et</b> je n'ai pas pris mon parapluie
      (A = 1, B = 0). S'il ne pleut pas, la promesse tient toujours, parapluie ou pas.</p>
      <p><b>Objectif :</b> Q vaut 0 quand la promesse est rompue (A = 1 et B = 0), et 1 dans les trois autres cas.</p>`,
id: 'implies', chapter: 'gates', title: 'Implication',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { A: 'la condition : « si A… »', B: 'la conséquence : « … alors B »', Q: '0 seulement quand la règle est enfreinte (A = 1 et B = 0)' },
    desc: `<p>En logique, « <b>si A alors B</b> » est une promesse. Par exemple : « s'il pleut (A), alors je prends
      mon parapluie (B) ».</p>
      <p>La promesse n'est rompue que dans un seul cas : il pleut <b>et</b> je n'ai pas pris mon parapluie
      (A = 1, B = 0). S'il ne pleut pas, la promesse tient toujours, parapluie ou pas.</p>
      <p><b>Objectif :</b> Q vaut 0 quand la promesse est rompue (A = 1 et B = 0), et 1 dans les trois autres cas.</p>`,
    hint: 'Q vaut 0 dans un seul cas, comme une NAND. Quelles valeurs faudrait-il envoyer à la NAND pour qu\'elle reçoive 1 et 1 exactement dans ce cas ?',
    tests: truthTable(2, ([a, c]) => [(1 - a) | c]),
  });
  add({
    id: 'alarm', chapter: 'gates', title: 'Alarme',
    inputs: ['Armée', 'Porte', 'Code'], outputs: ['Sirène'],
    pins: { Armée: '1 = l\'alarme est activée', Porte: '1 = la porte est ouverte', Code: '1 = le bon code a été tapé', Sirène: '1 = la sirène sonne' },
    desc: `<p>Un premier circuit « de la vraie vie » : l'alarme d'une maison.</p>
      <p><b>Objectif :</b> la <b>Sirène</b> doit sonner (1) seulement si les trois conditions sont réunies :</p>
      <ul><li>l'alarme est <b>armée</b> (Armée = 1) ;</li>
      <li>la <b>porte</b> est ouverte (Porte = 1) ;</li>
      <li>le bon <b>code</b> n'a <i>pas</i> été tapé (Code = 0).</li></ul>
      <p>Exemple : alarme armée et porte ouverte, mais le propriétaire a tapé le code (Code = 1) : la sirène reste muette.</p>`,
    tests: truthTable(3, ([arm, door, code]) => [arm & door & (1 - code)]),
  });
  add({
    id: 'nor', chapter: 'gates', title: 'NOR', unlock: 'NOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 seulement si A et B valent 0 tous les deux' },
    desc: `<p>La porte <b>NOR</b> (« NON-OU ») est l'inverse de OR : elle vaut 1 seulement si <b>aucune</b> entrée
      ne vaut 1, c'est-à-dire si A et B valent 0 tous les deux.</p>
      <p><b>Objectif :</b> construis la porte NOR. Elle rejoindra ta palette.</p>
      <p>Exemple : A = 0 et B = 0 donnent Q = 1 ; dans tous les autres cas, Q = 0.</p>`,
    tests: truthTable(2, ([a, c]) => [1 - (a | c)]),
  });
  add({
    id: 'none3', chapter: 'gates', title: 'Silence total',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 seulement si A, B et C valent tous 0' },
    desc: `<p><b>Objectif :</b> Q vaut 1 seulement si <b>aucune</b> des trois entrées ne vaut 1 (A = B = C = 0).
      Dès qu'une entrée vaut 1, Q vaut 0.</p>
      <p>Exemple de la vraie vie : une veilleuse qui ne s'allume que quand les trois pièces sont vides.</p>`,
    tests: truthTable(3, ([a, c, d]) => [1 - (a | c | d)]),
  });
  add({
    id: 'xor', chapter: 'gates', title: 'XOR', unlock: 'XOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 si A et B sont différents' },
    desc: `<p>La porte <b>XOR</b> (« OU exclusif ») vaut 1 quand ses entrées sont <b>différentes</b> : l'une à 0,
      l'autre à 1. Si elles sont pareilles (0 et 0, ou 1 et 1), elle vaut 0.</p>
      <p>C'est la différence avec OR : pour (1, 1), OR donne 1 mais XOR donne 0. Comme au restaurant :
      « fromage <i>ou</i> dessert », mais pas les deux !</p>
      <p><b>Objectif :</b> construis la porte XOR. Elle rejoindra ta palette et servira beaucoup pour les additions.</p>
      <p><b>Défi bonus :</b> c'est possible avec seulement 4 portes NAND.</p>`,
    tests: truthTable(2, ([a, c]) => [a ^ c]),
  });
  add({
    id: 'parity3', chapter: 'gates', title: 'Parité',
    inputs: ['A', 'B', 'C'], outputs: ['Impair'],
    pins: { ...ABC, Impair: '1 si le nombre d\'entrées à 1 est impair (une ou trois)' },
    desc: `<p>La <b>parité</b> dit si le nombre de 1 est pair ou impair. On s'en sert pour détecter les erreurs
      de transmission : si un bit est abîmé en chemin, la parité change, et on sait qu'il y a un problème.</p>
      <p><b>Objectif :</b> <b>Impair</b> vaut 1 si le nombre d'entrées à 1 est impair (une seule, ou les trois).
      Il vaut 0 s'il y en a zéro ou deux.</p>
      <p>Exemples : (1, 0, 0) donne 1 ; (1, 1, 0) donne 0 ; (1, 1, 1) donne 1.</p>`,
    tests: truthTable(3, ([a, c, d]) => [a ^ c ^ d]),
  });
  add({
    id: 'exactly_one', chapter: 'gates', title: 'Exactement un',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si une seule des trois entrées vaut 1' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si <b>exactement une</b> des trois entrées vaut 1 : ni zéro, ni deux, ni trois.</p>
      <p>Exemples : (0, 1, 0) donne 1 ; (0, 0, 0) donne 0 ; (1, 1, 0) donne 0 ; (1, 1, 1) donne 0.</p>
      <p>Exemple de la vraie vie : une question à choix unique dans un formulaire, où une seule case doit être cochée.</p>`,
id: 'exactly_one', chapter: 'gates', title: 'Exactement un',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si une seule des trois entrées vaut 1' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si <b>exactement une</b> des trois entrées vaut 1 : ni zéro, ni deux, ni trois.</p>
      <p>Exemples : (0, 1, 0) donne 1 ; (0, 0, 0) donne 0 ; (1, 1, 0) donne 0 ; (1, 1, 1) donne 0.</p>
      <p>Exemple de la vraie vie : une question à choix unique dans un formulaire, où une seule case doit être cochée.</p>`,
    hint: 'Compare avec le niveau Parité : sur quelle ligne les deux niveaux ne sont-ils pas d\'accord ?',
    tests: truthTable(3, ([a, c, d]) => [a + c + d === 1 ? 1 : 0]),
  });
  add({
    id: 'xnor', chapter: 'gates', title: 'XNOR', unlock: 'XNOR',
    inputs: ['A', 'B'], outputs: ['Q'],
    pins: { ...AB, Q: '1 si A et B sont identiques' },
    desc: `<p>La porte <b>XNOR</b> est l'inverse de XOR : elle vaut 1 quand ses entrées sont <b>identiques</b>
      (0 et 0, ou 1 et 1), et 0 quand elles sont différentes.</p>
      <p>C'est un <b>détecteur d'égalité</b> pour un bit : elle répond « oui, c'est pareil ».</p>
      <p><b>Objectif :</b> construis la porte XNOR. Elle rejoindra ta palette.</p>`,
    tests: truthTable(2, ([a, c]) => [1 - (a ^ c)]),
  });
  add({
    id: 'all_equal', chapter: 'gates', title: 'Unanimité',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si A, B et C ont tous la même valeur' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si les trois entrées ont <b>la même valeur</b> : toutes à 0, ou toutes à 1.
      Dès que l'une est différente des autres, Q vaut 0.</p>
      <p>Exemples : (0, 0, 0) et (1, 1, 1) donnent 1 ; (1, 1, 0) donne 0.</p>`,
id: 'all_equal', chapter: 'gates', title: 'Unanimité',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si A, B et C ont tous la même valeur' },
    desc: `<p><b>Objectif :</b> Q vaut 1 si les trois entrées ont <b>la même valeur</b> : toutes à 0, ou toutes à 1.
      Dès que l'une est différente des autres, Q vaut 0.</p>
      <p>Exemples : (0, 0, 0) et (1, 1, 1) donnent 1 ; (1, 1, 0) donne 0.</p>`,
    hint: 'Si A est égal à B, et que B est égal à C, que peux-tu dire de A et C ?',
    tests: truthTable(3, ([a, c, d]) => [a === c && c === d ? 1 : 0]),
  });
  add({
    id: 'eq2', chapter: 'gates', title: 'Égalité 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Égal'],
    pins: { ...bitPins('A', 2), ...bitPins('B', 2), Égal: '1 si le nombre A est égal au nombre B' },
    desc: `<p>Jusqu'ici, chaque fil valait juste 0 ou 1. En mettant plusieurs fils ensemble, on peut écrire
      de <b>vrais nombres</b> en binaire.</p>
      <p>${NUM2}</p>
      <p>Les 4 valeurs possibles, écrites A1 A0 : <code>00</code> = 0, <code>01</code> = 1, <code>10</code> = 2, <code>11</code> = 3.</p>
      <p><b>Objectif :</b> <b>Égal</b> vaut 1 si les deux nombres A et B sont égaux.</p>
      <p>Exemple : A = 2 (A1 = 1, A0 = 0) et B = 2 (B1 = 1, B0 = 0) donnent Égal = 1. A = 2 et B = 3 donnent Égal = 0.</p>`,
id: 'eq2', chapter: 'gates', title: 'Égalité 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Égal'],
    pins: { ...bitPins('A', 2), ...bitPins('B', 2), Égal: '1 si le nombre A est égal au nombre B' },
    desc: `<p>Jusqu'ici, chaque fil valait juste 0 ou 1. En mettant plusieurs fils ensemble, on peut écrire
      de <b>vrais nombres</b> en binaire.</p>
      <p>${NUM2}</p>
      <p>Les 4 valeurs possibles, écrites A1 A0 : <code>00</code> = 0, <code>01</code> = 1, <code>10</code> = 2, <code>11</code> = 3.</p>
      <p><b>Objectif :</b> <b>Égal</b> vaut 1 si les deux nombres A et B sont égaux.</p>
      <p>Exemple : A = 2 (A1 = 1, A0 = 0) et B = 2 (B1 = 1, B0 = 0) donnent Égal = 1. A = 2 et B = 3 donnent Égal = 0.</p>`,
    hint: 'Deux nombres sont égaux quand chacun de leurs bits est égal à celui qui est à la même place.',
    tests: truthTable(4, ([a0, a1, b0, b1]) => [a0 === b0 && a1 === b1 ? 1 : 0]),
  });
  add({
    id: 'cmp1', chapter: 'gates', title: 'Comparateur 1 bit',
    inputs: ['A', 'B'], outputs: ['Sup', 'Égal', 'Inf'],
    pins: { ...AB, Sup: 'Supérieur : 1 si A est plus grand que B', Égal: '1 si A et B sont égaux', Inf: 'Inférieur : 1 si A est plus petit que B' },
    desc: `<p>Un <b>comparateur</b> dit lequel de deux nombres est le plus grand. Ici, les nombres n'ont qu'un bit :
      ils valent 0 ou 1.</p>
      <p><b>Objectif :</b> allume <b>une seule</b> des trois sorties :</p>
      <ul><li><b>Sup</b> si A est plus grand que B ;</li>
      <li><b>Égal</b> si A et B sont égaux ;</li>
      <li><b>Inf</b> si A est plus petit que B.</li></ul>
      <p>Exemple : A = 1 et B = 0 : seule Sup s'allume.</p>`,
    tests: truthTable(2, ([a, c]) => [a > c ? 1 : 0, a === c ? 1 : 0, a < c ? 1 : 0]),
  });
  add({
    id: 'gt2', chapter: 'gates', title: 'Plus grand 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Sup'],
    pins: { ...bitPins('A', 2), ...bitPins('B', 2), Sup: 'Supérieur : 1 si le nombre A est plus grand que le nombre B' },
    desc: `<p>On reprend les nombres de 2 bits du niveau Égalité, mais on veut maintenant savoir lequel est le plus grand.</p>
      <p>${NUM2}</p>
      <p><b>Objectif :</b> <b>Sup</b> vaut 1 si A est <b>strictement plus grand</b> que B. Si A = B, ou si A est
      plus petit, Sup vaut 0.</p>
      <p>Exemples : A = 2 et B = 1 donnent Sup = 1 ; A = 1 et B = 3 donnent 0 ; A = 2 et B = 2 donnent 0.</p>`,
id: 'gt2', chapter: 'gates', title: 'Plus grand 2 bits',
    inputs: ['A0', 'A1', 'B0', 'B1'], outputs: ['Sup'],
    pins: { ...bitPins('A', 2), ...bitPins('B', 2), Sup: 'Supérieur : 1 si le nombre A est plus grand que le nombre B' },
    desc: `<p>On reprend les nombres de 2 bits du niveau Égalité, mais on veut maintenant savoir lequel est le plus grand.</p>
      <p>${NUM2}</p>
      <p><b>Objectif :</b> <b>Sup</b> vaut 1 si A est <b>strictement plus grand</b> que B. Si A = B, ou si A est
      plus petit, Sup vaut 0.</p>
      <p>Exemples : A = 2 et B = 1 donnent Sup = 1 ; A = 1 et B = 3 donnent 0 ; A = 2 et B = 2 donnent 0.</p>`,
    hint: 'C\'est comme comparer 47 et 52 : on regarde d\'abord les dizaines, et on ne regarde les unités que si les dizaines sont égales. Ici, les « dizaines » sont A1 et B1.',
    tests: truthTable(4, ([a0, a1, b0, b1]) => [a0 + 2 * a1 > b0 + 2 * b1 ? 1 : 0]),
  });
  add({
    id: 'ge5', chapter: 'gates', title: 'Au moins 5',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    pins: { ...bitPins('N', 3), Q: '1 si N vaut 5, 6 ou 7' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> Q vaut 1 si N est <b>au moins égal à 5</b>, c'est-à-dire si N vaut 5, 6 ou 7.</p>`,
id: 'ge5', chapter: 'gates', title: 'Au moins 5',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    pins: { ...bitPins('N', 3), Q: '1 si N vaut 5, 6 ou 7' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> Q vaut 1 si N est <b>au moins égal à 5</b>, c'est-à-dire si N vaut 5, 6 ou 7.</p>`,
    hint: 'Écris 5, 6 et 7 en binaire. Quel bit ont-ils tous en commun ? Et qu\'est-ce qui les distingue de 4 ?',
    tests: truthTable(3, (bits) => [num(bits) >= 5 ? 1 : 0]),
  });
  add({
    id: 'prime', chapter: 'gates', title: 'Nombre premier',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Premier'],
    pins: { ...bitPins('N', 3), Premier: '1 si N vaut 2, 3, 5 ou 7' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> <b>Premier</b> vaut 1 si N est un <b>nombre premier</b>, c'est-à-dire un nombre qui n'est divisible que par 1 et par lui-même. Entre 0 et 7, ce sont 2, 3, 5 et 7.</p>`,
id: 'prime', chapter: 'gates', title: 'Nombre premier',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Premier'],
    pins: { ...bitPins('N', 3), Premier: '1 si N vaut 2, 3, 5 ou 7' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> <b>Premier</b> vaut 1 si N est un <b>nombre premier</b>, c'est-à-dire un nombre qui n'est divisible que par 1 et par lui-même. Entre 0 et 7, ce sont 2, 3, 5 et 7.</p>`,
    hint: 'Écris les quatre nombres en binaire et cherche ce qu\'ils ont en commun.',
    tests: truthTable(3, (bits) => [[2, 3, 5, 7].includes(num(bits)) ? 1 : 0]),
  });
  add({
    id: 'mult3', chapter: 'gates', title: 'Multiple de 3',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    pins: { ...bitPins('N', 3), Q: '1 si N vaut 0, 3 ou 6' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> Q vaut 1 si N est un <b>multiple de 3</b> (un nombre de la table de 3), c'est-à-dire 0, 3 ou 6.</p>`,
id: 'mult3', chapter: 'gates', title: 'Multiple de 3',
    inputs: ['N0', 'N1', 'N2'], outputs: ['Q'],
    pins: { ...bitPins('N', 3), Q: '1 si N vaut 0, 3 ou 6' },
    desc: `<p>${NUM3}</p>
      <p>${TABLE3}</p>
      <p><b>Objectif :</b> Q vaut 1 si N est un <b>multiple de 3</b> (un nombre de la table de 3), c'est-à-dire 0, 3 ou 6.</p>`,
    hint: 'Traite le cas de 0 à part, puis compare 3 (011) et 6 (110).',
    tests: truthTable(3, (bits) => [num(bits) % 3 === 0 ? 1 : 0]),
  });
  add({
    id: 'maj', chapter: 'gates', title: 'Majorité',
    inputs: ['A', 'B', 'C'], outputs: ['Q'],
    pins: { ...ABC, Q: '1 si au moins deux des trois entrées valent 1' },
    desc: `<p>Trois personnes votent oui (1) ou non (0). La décision est prise à la <b>majorité</b>.</p>
      <p><b>Objectif :</b> Q vaut 1 si <b>au moins deux</b> entrées valent 1.</p>
      <p>Exemples : (1, 1, 0) donne 1 ; (1, 0, 0) donne 0 ; (1, 1, 1) donne 1.</p>
      <p>Garde ce circuit en tête : il reviendra bientôt sous un autre nom…</p>`,
    tests: truthTable(3, ([a, c, d]) => [a + c + d >= 2 ? 1 : 0]),
  });

  // ================================================ Chapitre 2 : composants

  add({
    id: 'half_add', chapter: 'components', title: 'Demi-additionneur', unlock: 'HALF_ADD',
    inputs: ['A', 'B'], outputs: ['S', 'C'],
    pins: { A: 'premier bit à additionner', B: 'deuxième bit à additionner', S: 'Somme : le chiffre de droite du résultat (celui qu\'on « pose »)', C: 'Carry (retenue) : 1 quand le résultat dépasse 1 (« je retiens 1 »)' },
    desc: `<p>Bienvenue dans les <b>composants</b> ! Tes portes vont maintenant faire des calculs, à commencer par l'addition.</p>
      <p>Souviens-toi de l'addition posée à l'école : 7 + 5 = 12, on pose 2 et on retient 1 pour la colonne suivante.
      En binaire, c'est pareil, mais il n'y a que 0 et 1 : dès qu'on atteint 2, on pose 0 et on retient 1.</p>
      <p><b>Objectif :</b> additionne les deux bits A et B. Le résultat va de 0 à 2, il faut donc deux sorties :
      <b>S</b> (somme), le chiffre qu'on pose, et <b>C</b> (retenue, <i>carry</i> en anglais), celui qu'on retient.</p>
      <p>Exemples : 0 + 1 = 1, donc S = 1 et C = 0. 1 + 1 = 2, qui s'écrit <code>10</code> en binaire, donc S = 0 et C = 1.</p>`,
    tests: truthTable(2, ([a, c]) => [a ^ c, a & c]),
  });
  add({
    id: 'full_add', chapter: 'components', title: 'Additionneur complet', unlock: 'FULL_ADD',
    inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'],
    pins: { A: 'premier bit à additionner', B: 'deuxième bit à additionner', Ci: 'Carry in : la retenue qui arrive de la colonne de droite', S: 'Somme : le chiffre de droite de A + B + Ci', Co: 'Carry out : la retenue à passer à la colonne de gauche' },
    desc: `<p>Le demi-additionneur sait additionner une colonne… mais seulement la première. Dans une addition posée,
      les colonnes suivantes doivent aussi ajouter <b>la retenue</b> qui arrive de la colonne de droite.</p>
      <p>Exemple en binaire, 3 + 1, c'est-à-dire <code>11</code> + <code>01</code> :</p>
      <pre class="addition">retenues   1 1
             1 1
           + 0 1
           -----
           1 0 0   (= 4)</pre>
      <p>Dans la colonne du milieu, on additionne <b>trois</b> bits : 1 + 0 + la retenue 1.</p>
      <p><b>Objectif :</b> additionne trois bits : A, B et la retenue qui arrive, <b>Ci</b> (<i>carry in</i>).
      Le résultat va de 0 à 3 ; écris-le avec <b>S</b>, le chiffre qu'on pose, et <b>Co</b> (<i>carry out</i>),
      la retenue à passer à la colonne de gauche.</p>
      <p>Exemple : 1 + 1 + 1 = 3, qui s'écrit <code>11</code>, donc S = 1 et Co = 1.</p>
      <p>En mettant 8 additionneurs complets à la suite, la retenue de l'un entrant dans le suivant, on additionne
      des nombres de 0 à 255 : c'est ce que fait l'instruction <code>add</code> de ton processeur.</p>`,
id: 'full_add', chapter: 'components', title: 'Additionneur complet', unlock: 'FULL_ADD',
    inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'],
    pins: { A: 'premier bit à additionner', B: 'deuxième bit à additionner', Ci: 'Carry in : la retenue qui arrive de la colonne de droite', S: 'Somme : le chiffre de droite de A + B + Ci', Co: 'Carry out : la retenue à passer à la colonne de gauche' },
    desc: `<p>Le demi-additionneur sait additionner une colonne… mais seulement la première. Dans une addition posée,
      les colonnes suivantes doivent aussi ajouter <b>la retenue</b> qui arrive de la colonne de droite.</p>
      <p>Exemple en binaire, 3 + 1, c'est-à-dire <code>11</code> + <code>01</code> :</p>
      <pre class="addition">retenues   1 1
             1 1
           + 0 1
           -----
           1 0 0   (= 4)</pre>
      <p>Dans la colonne du milieu, on additionne <b>trois</b> bits : 1 + 0 + la retenue 1.</p>
      <p><b>Objectif :</b> additionne trois bits : A, B et la retenue qui arrive, <b>Ci</b> (<i>carry in</i>).
      Le résultat va de 0 à 3 ; écris-le avec <b>S</b>, le chiffre qu'on pose, et <b>Co</b> (<i>carry out</i>),
      la retenue à passer à la colonne de gauche.</p>
      <p>Exemple : 1 + 1 + 1 = 3, qui s'écrit <code>11</code>, donc S = 1 et Co = 1.</p>
      <p>En mettant 8 additionneurs complets à la suite, la retenue de l'un entrant dans le suivant, on additionne
      des nombres de 0 à 255 : c'est ce que fait l'instruction <code>add</code> de ton processeur.</p>`,
    hint: 'Additionne d\'abord A et B, puis ajoute Ci au résultat. Tu as déjà le composant qui additionne deux bits. Reste à savoir quoi faire des deux retenues.',
    tests: truthTable(3, ([a, c, d]) => [(a + c + d) & 1, (a + c + d) >> 1]),
  });
  add({
    id: 'mux', chapter: 'components', title: 'Multiplexeur', unlock: 'MUX',
    inputs: ['A', 'B', 'S'], outputs: ['Q'],
    pins: { A: 'la valeur à recopier quand S = 0', B: 'la valeur à recopier quand S = 1', S: 'Sélecteur : la position de l\'aiguillage', Q: 'recopie A ou B selon S' },
    desc: `<p>Un <b>multiplexeur</b> (ou « mux ») est un <b>aiguillage</b>, comme sur une voie ferrée : il a deux entrées
      de données, A et B, et choisit laquelle laisser passer vers la sortie.</p>
      <p>Le choix est fait par l'entrée <b>S</b> (sélecteur) :</p>
      <ul><li>si S = 0, Q recopie A (et ignore B) ;</li>
      <li>si S = 1, Q recopie B (et ignore A).</li></ul>
      <p>Exemple : A = 1 et B = 0. Avec S = 0, Q = 1 ; avec S = 1, Q = 0.</p>
      <p>Dans un processeur, les multiplexeurs servent partout à choisir : quel résultat garder, quel registre lire…</p>`,
id: 'mux', chapter: 'components', title: 'Multiplexeur', unlock: 'MUX',
    inputs: ['A', 'B', 'S'], outputs: ['Q'],
    pins: { A: 'la valeur à recopier quand S = 0', B: 'la valeur à recopier quand S = 1', S: 'Sélecteur : la position de l\'aiguillage', Q: 'recopie A ou B selon S' },
    desc: `<p>Un <b>multiplexeur</b> (ou « mux ») est un <b>aiguillage</b>, comme sur une voie ferrée : il a deux entrées
      de données, A et B, et choisit laquelle laisser passer vers la sortie.</p>
      <p>Le choix est fait par l'entrée <b>S</b> (sélecteur) :</p>
      <ul><li>si S = 0, Q recopie A (et ignore B) ;</li>
      <li>si S = 1, Q recopie B (et ignore A).</li></ul>
      <p>Exemple : A = 1 et B = 0. Avec S = 0, Q = 1 ; avec S = 1, Q = 0.</p>
      <p>Dans un processeur, les multiplexeurs servent partout à choisir : quel résultat garder, quel registre lire…</p>`,
    hint: 'Pense au « gardien » AND : il laisse passer un signal seulement quand son autre entrée vaut 1.',
    tests: truthTable(3, ([a, c, s]) => [s ? c : a]),
  });
  add({
    id: 'dec2', chapter: 'components', title: 'Décodeur 2 bits', unlock: 'DEC2',
    inputs: ['A0', 'A1'], outputs: ['O0', 'O1', 'O2', 'O3'],
    pins: { ...bitPins('A', 2, 'du numéro n'), ...decoderPins(4) },
    desc: `<p>Un <b>décodeur</b> transforme un numéro écrit en binaire en « une seule lampe allumée parmi plusieurs ».
      C'est comme le panneau d'un ascenseur : on choisit un numéro d'étage, et un seul voyant s'allume.</p>
      <p>Les entrées forment un numéro n de 0 à 3 : A0 compte pour 1 et A1 compte pour 2.</p>
      <p><b>Objectif :</b> il y a une sortie par numéro, de O0 à O3. Allume <b>seulement</b> celle qui porte le
      numéro n, toutes les autres restent à 0.</p>
      <p>Exemple : A1 = 1 et A0 = 0 donnent n = 2, donc seule O2 s'allume.</p>
      <p>Ton processeur s'en servira pour choisir quel registre ou quelle opération activer.</p>`,
    tests: truthTable(2, ([a0, a1]) => [0, 1, 2, 3].map((i) => (i === a0 + 2 * a1 ? 1 : 0))),
  });
  add({
    id: 'osc', chapter: 'components', title: 'Oscillateur', unlock: 'DELAY', give: ['DELAY'],
    inputs: [], outputs: ['Q'], sequential: true,
    pins: { Q: 'doit changer de valeur à chaque tick : 0, 1, 0, 1…' },
    desc: `<p>Jusqu'ici, tes circuits répondaient instantanément et oubliaient tout. Pour construire une mémoire,
      il faut faire entrer le <b>temps</b>.</p>
      <p>Le temps avance par <b>ticks</b>, comme les battements d'une horloge. Voici un nouveau composant, le
      <b>DÉLAI</b> : à chaque tick, sa sortie prend la valeur qu'avait son entrée <i>au tick précédent</i>
      (0 au tout début). Il « retient » donc une valeur pendant un tick.</p>
      <p>Grâce à lui, tu peux aussi faire des <b>boucles</b> : renvoyer une sortie vers une entrée plus en amont.
      Sans DÉLAI, c'est interdit, car le circuit tournerait en rond instantanément.</p>
      <p><b>Objectif :</b> Q doit changer de valeur à chaque tick : 0, 1, 0, 1… (ou 1, 0, 1, 0…). Il n'y a pas
      d'entrée : le circuit doit battre tout seul. Utilise le bouton <b>Tick</b> pour faire avancer l'horloge.</p>`,
id: 'osc', chapter: 'components', title: 'Oscillateur', unlock: 'DELAY', give: ['DELAY'],
    inputs: [], outputs: ['Q'], sequential: true,
    pins: { Q: 'doit changer de valeur à chaque tick : 0, 1, 0, 1…' },
    desc: `<p>Jusqu'ici, tes circuits répondaient instantanément et oubliaient tout. Pour construire une mémoire,
      il faut faire entrer le <b>temps</b>.</p>
      <p>Le temps avance par <b>ticks</b>, comme les battements d'une horloge. Voici un nouveau composant, le
      <b>DÉLAI</b> : à chaque tick, sa sortie prend la valeur qu'avait son entrée <i>au tick précédent</i>
      (0 au tout début). Il « retient » donc une valeur pendant un tick.</p>
      <p>Grâce à lui, tu peux aussi faire des <b>boucles</b> : renvoyer une sortie vers une entrée plus en amont.
      Sans DÉLAI, c'est interdit, car le circuit tournerait en rond instantanément.</p>
      <p><b>Objectif :</b> Q doit changer de valeur à chaque tick : 0, 1, 0, 1… (ou 1, 0, 1, 0…). Il n'y a pas
      d'entrée : le circuit doit battre tout seul. Utilise le bouton <b>Tick</b> pour faire avancer l'horloge.</p>`,
    hint: 'Que se passe-t-il si un DÉLAI reçoit l\'inverse de sa propre sortie ?',
    tests: [{
      alts: [0, 1].map((first) => Array.from({ length: 8 }, (_, t) => ({ in: [], out: [(t + first) & 1] }))),
    }],
  });
  add({
    id: 'mem', chapter: 'components', title: 'Bit de mémoire', unlock: 'MEM',
    inputs: ['Sauv', 'Val'], outputs: ['Q'], sequential: true,
    pins: { Sauv: 'Sauvegarder : 1 = enregistrer Val à ce tick', Val: 'la valeur à enregistrer (0 ou 1)', Q: 'la valeur actuellement mémorisée' },
    desc: `<p>Voici le niveau le plus important du chapitre : une <b>mémoire</b> d'un bit. Toute la mémoire d'un
      ordinateur, des milliards de bits, est faite de cellules qui fonctionnent comme celle-ci.</p>
      <p><b>Objectif :</b> Q affiche la valeur mémorisée (0 au départ).</p>
      <ul><li>Quand <b>Sauv</b> = 1, la cellule enregistre la valeur de <b>Val</b>, qui apparaît sur Q au tick suivant.</li>
      <li>Quand <b>Sauv</b> = 0, la cellule ignore Val et garde sa valeur, aussi longtemps qu'il le faut.</li></ul>
      <p>Exemple : au tick 0, Sauv = 1 et Val = 1, on enregistre 1. Au tick 1, Q vaut 1. Ensuite, même si Val
      repasse à 0, Q reste à 1 tant que Sauv reste à 0.</p>`,
id: 'mem', chapter: 'components', title: 'Bit de mémoire', unlock: 'MEM',
    inputs: ['Sauv', 'Val'], outputs: ['Q'], sequential: true,
    pins: { Sauv: 'Sauvegarder : 1 = enregistrer Val à ce tick', Val: 'la valeur à enregistrer (0 ou 1)', Q: 'la valeur actuellement mémorisée' },
    desc: `<p>Voici le niveau le plus important du chapitre : une <b>mémoire</b> d'un bit. Toute la mémoire d'un
      ordinateur, des milliards de bits, est faite de cellules qui fonctionnent comme celle-ci.</p>
      <p><b>Objectif :</b> Q affiche la valeur mémorisée (0 au départ).</p>
      <ul><li>Quand <b>Sauv</b> = 1, la cellule enregistre la valeur de <b>Val</b>, qui apparaît sur Q au tick suivant.</li>
      <li>Quand <b>Sauv</b> = 0, la cellule ignore Val et garde sa valeur, aussi longtemps qu'il le faut.</li></ul>
      <p>Exemple : au tick 0, Sauv = 1 et Val = 1, on enregistre 1. Au tick 1, Q vaut 1. Ensuite, même si Val
      repasse à 0, Q reste à 1 tant que Sauv reste à 0.</p>`,
    hint: 'Le DÉLAI retient une valeur pendant un tick. Pour qu\'il la garde plus longtemps, il faut lui renvoyer sa propre sortie… sauf quand on veut enregistrer. Quel composant sait choisir entre deux signaux ?',
    tests: [1, 2].map((seed) =>
      sequence((st, [save, v]) => [[st], save ? v : st], 0, randomBits(seed * 7, 12, 2))),
  });
  add({
    id: 'counter', chapter: 'components', title: 'Compteur 2 bits',
    inputs: ['Inc'], outputs: ['B0', 'B1'], sequential: true,
    pins: { Inc: 'Incrémenter : 1 = ajouter 1 au compteur à ce tick', ...bitPins('B', 2, 'du compteur') },
    desc: `<p>Un <b>compteur</b> compte des événements : ici, combien de fois l'entrée <b>Inc</b> (incrémenter,
      c'est-à-dire ajouter 1) a valu 1.</p>
      <p>Le compteur part de 0. Sa valeur s'affiche en binaire sur deux sorties : <b>B0</b> compte pour 1 et
      <b>B1</b> pour 2. Il compte donc de 0 à 3, puis repart à 0 (0, 1, 2, 3, 0, 1…), comme un compteur
      kilométrique qui fait le tour.</p>
      <p><b>Objectif :</b> à chaque tick où Inc = 1, ajoute 1 ; quand Inc = 0, ne change rien. Comme pour la
      mémoire, le changement apparaît sur les sorties au tick <i>suivant</i>.</p>
      <p>Exemple : avec Inc = 1, 1, 0, 1 aux ticks 0 à 3, la valeur affichée est 0, 1, 2, 2, puis 3 au tick 4.</p>`,
id: 'counter', chapter: 'components', title: 'Compteur 2 bits',
    inputs: ['Inc'], outputs: ['B0', 'B1'], sequential: true,
    pins: { Inc: 'Incrémenter : 1 = ajouter 1 au compteur à ce tick', ...bitPins('B', 2, 'du compteur') },
    desc: `<p>Un <b>compteur</b> compte des événements : ici, combien de fois l'entrée <b>Inc</b> (incrémenter,
      c'est-à-dire ajouter 1) a valu 1.</p>
      <p>Le compteur part de 0. Sa valeur s'affiche en binaire sur deux sorties : <b>B0</b> compte pour 1 et
      <b>B1</b> pour 2. Il compte donc de 0 à 3, puis repart à 0 (0, 1, 2, 3, 0, 1…), comme un compteur
      kilométrique qui fait le tour.</p>
      <p><b>Objectif :</b> à chaque tick où Inc = 1, ajoute 1 ; quand Inc = 0, ne change rien. Comme pour la
      mémoire, le changement apparaît sur les sorties au tick <i>suivant</i>.</p>
      <p>Exemple : avec Inc = 1, 1, 0, 1 aux ticks 0 à 3, la valeur affichée est 0, 1, 2, 2, puis 3 au tick 4.</p>`,
    hint: 'Ajouter 1, c\'est une addition. Tu as construit un composant qui additionne des bits, et un autre qui se souvient.',
    tests: [3, 4].map((seed) =>
      sequence((st, [inc]) => [[st & 1, st >> 1], (st + inc) & 3], 0, randomBits(seed * 11, 14, 1))),
  });

  // ============================================== Chapitre 3 : architecture

  const ALU1_NAMES = ['AND', 'OR', 'XOR', 'ADD'];
  add({
    id: 'alu1', chapter: 'architecture', title: 'ALU 1 bit',
    inputs: ['Op0', 'Op1', 'A', 'B', 'Ci'], outputs: ['R', 'Co'],
    pins: { ...bitPins('Op', 2, 'du code d\'opération op'), A: 'premier bit à combiner', B: 'deuxième bit à combiner', Ci: 'Carry in : retenue entrante, utilisée seulement par l\'addition', R: 'Résultat de l\'opération choisie', Co: 'Carry out : retenue sortante de l\'addition (0 pour les autres opérations)' },
    desc: `<p>Bienvenue dans l'<b>architecture</b> : tu vas assembler les pièces du processeur NANDO-8, celui que tu
      programmes dans le chapitre Assemblage.</p>
      <p>L'<b>UAL</b> (unité arithmétique et logique, <i>ALU</i> en anglais) est la calculatrice du processeur :
      c'est elle qui exécute <code>and</code>, <code>or</code>, <code>add</code>… Elle reçoit deux nombres et un
      <b>code d'opération</b> qui lui dit quel calcul faire.</p>
      <p>Ici, on construit une tranche d'un bit. Op0 et Op1 forment le code op de 0 à 3 (Op0 compte pour 1,
      Op1 pour 2) :</p>
      <table class="mini"><tr><th>op</th><th>R</th><th>Co</th></tr>
      <tr><td>0</td><td>A AND B</td><td>0</td></tr>
      <tr><td>1</td><td>A OR B</td><td>0</td></tr>
      <tr><td>2</td><td>A XOR B</td><td>0</td></tr>
      <tr><td>3</td><td>somme de A + B + Ci</td><td>retenue</td></tr></table>
      <p>Exemple : Op1 = 1 et Op0 = 0 donnent op = 2, donc R = A XOR B et Co = 0.</p>
      <p>Huit de ces tranches côte à côte forment l'UAL 8 bits de l'ordinateur.</p>`,
id: 'alu1', chapter: 'architecture', title: 'ALU 1 bit',
    inputs: ['Op0', 'Op1', 'A', 'B', 'Ci'], outputs: ['R', 'Co'],
    pins: { ...bitPins('Op', 2, 'du code d\'opération op'), A: 'premier bit à combiner', B: 'deuxième bit à combiner', Ci: 'Carry in : retenue entrante, utilisée seulement par l\'addition', R: 'Résultat de l\'opération choisie', Co: 'Carry out : retenue sortante de l\'addition (0 pour les autres opérations)' },
    desc: `<p>Bienvenue dans l'<b>architecture</b> : tu vas assembler les pièces du processeur NANDO-8, celui que tu
      programmes dans le chapitre Assemblage.</p>
      <p>L'<b>UAL</b> (unité arithmétique et logique, <i>ALU</i> en anglais) est la calculatrice du processeur :
      c'est elle qui exécute <code>and</code>, <code>or</code>, <code>add</code>… Elle reçoit deux nombres et un
      <b>code d'opération</b> qui lui dit quel calcul faire.</p>
      <p>Ici, on construit une tranche d'un bit. Op0 et Op1 forment le code op de 0 à 3 (Op0 compte pour 1,
      Op1 pour 2) :</p>
      <table class="mini"><tr><th>op</th><th>R</th><th>Co</th></tr>
      <tr><td>0</td><td>A AND B</td><td>0</td></tr>
      <tr><td>1</td><td>A OR B</td><td>0</td></tr>
      <tr><td>2</td><td>A XOR B</td><td>0</td></tr>
      <tr><td>3</td><td>somme de A + B + Ci</td><td>retenue</td></tr></table>
      <p>Exemple : Op1 = 1 et Op0 = 0 donnent op = 2, donc R = A XOR B et Co = 0.</p>
      <p>Huit de ces tranches côte à côte forment l'UAL 8 bits de l'ordinateur.</p>`,
    hint: 'Calcule les quatre résultats en même temps, puis utilise des multiplexeurs pour ne garder que le bon.',
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
    pins: { ...bitPins('C', 3, 'du code de condition c'), Z: 'Zéro : vaut 1 quand R3 = 0', N: 'Négatif : vaut 1 quand R3 < 0', Saut: '1 = le processeur doit sauter' },
    desc: `<p>Quand ton programme fait <code>jz</code>, <code>jgt</code>… c'est cette unité qui décide si le processeur
      saute ou non.</p>
      <p>Elle regarde le registre R3 à travers deux signaux : <b>Z</b> (zéro) vaut 1 si R3 = 0, et <b>N</b>
      (négatif) vaut 1 si R3 est négatif. Ils ne valent jamais 1 en même temps.</p>
      <p>C0, C1 et C2 forment le code de condition c de 0 à 7 (C0 compte pour 1, C1 pour 2, C2 pour 4). Il vient
      de l'instruction de saut :</p>
      <table class="mini"><tr><th>c</th><th>instruction</th><th>saute si R3…</th></tr>
      <tr><td>0</td><td><code>nop</code></td><td>jamais</td></tr>
      <tr><td>1</td><td><code>jz</code></td><td>= 0</td></tr>
      <tr><td>2</td><td><code>jlt</code></td><td>&lt; 0</td></tr>
      <tr><td>3</td><td><code>jle</code></td><td>≤ 0</td></tr>
      <tr><td>4</td><td><code>jmp</code></td><td>toujours</td></tr>
      <tr><td>5</td><td><code>jnz</code></td><td>≠ 0</td></tr>
      <tr><td>6</td><td><code>jge</code></td><td>≥ 0</td></tr>
      <tr><td>7</td><td><code>jgt</code></td><td>&gt; 0</td></tr></table>
      <p><b>Objectif :</b> <b>Saut</b> vaut 1 si la condition demandée est vraie.</p>
      <p>Exemple : c = 1 (<code>jz</code>) et Z = 1 donnent Saut = 1 ; c = 1 et Z = 0 donnent Saut = 0.</p>`,
id: 'cond', chapter: 'architecture', title: 'Unité de condition',
    inputs: ['C0', 'C1', 'C2', 'Z', 'N'], outputs: ['Saut'],
    pins: { ...bitPins('C', 3, 'du code de condition c'), Z: 'Zéro : vaut 1 quand R3 = 0', N: 'Négatif : vaut 1 quand R3 < 0', Saut: '1 = le processeur doit sauter' },
    desc: `<p>Quand ton programme fait <code>jz</code>, <code>jgt</code>… c'est cette unité qui décide si le processeur
      saute ou non.</p>
      <p>Elle regarde le registre R3 à travers deux signaux : <b>Z</b> (zéro) vaut 1 si R3 = 0, et <b>N</b>
      (négatif) vaut 1 si R3 est négatif. Ils ne valent jamais 1 en même temps.</p>
      <p>C0, C1 et C2 forment le code de condition c de 0 à 7 (C0 compte pour 1, C1 pour 2, C2 pour 4). Il vient
      de l'instruction de saut :</p>
      <table class="mini"><tr><th>c</th><th>instruction</th><th>saute si R3…</th></tr>
      <tr><td>0</td><td><code>nop</code></td><td>jamais</td></tr>
      <tr><td>1</td><td><code>jz</code></td><td>= 0</td></tr>
      <tr><td>2</td><td><code>jlt</code></td><td>&lt; 0</td></tr>
      <tr><td>3</td><td><code>jle</code></td><td>≤ 0</td></tr>
      <tr><td>4</td><td><code>jmp</code></td><td>toujours</td></tr>
      <tr><td>5</td><td><code>jnz</code></td><td>≠ 0</td></tr>
      <tr><td>6</td><td><code>jge</code></td><td>≥ 0</td></tr>
      <tr><td>7</td><td><code>jgt</code></td><td>&gt; 0</td></tr></table>
      <p><b>Objectif :</b> <b>Saut</b> vaut 1 si la condition demandée est vraie.</p>
      <p>Exemple : c = 1 (<code>jz</code>) et Z = 1 donnent Saut = 1 ; c = 1 et Z = 0 donnent Saut = 0.</p>`,
    hint: 'Compare les lignes 0 à 3 avec les lignes 4 à 7 : chaque condition du bas est l\'inverse de celle du haut.',
    tests: truthTable(5, ([c0, c1, c2, z, n]) => {
      const base = [0, z, n, z | n][c0 + 2 * c1];
      return [c2 ? 1 - base : base];
    }).filter((t) => !(t.steps[0].in[3] && t.steps[0].in[4])), // Z et N ne sont jamais vrais ensemble
  });
  add({
    id: 'dec3', chapter: 'architecture', title: 'Décodeur 3 bits', unlock: 'DEC3',
    inputs: ['A0', 'A1', 'A2'], outputs: ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
    pins: { ...bitPins('A', 3, 'du numéro n'), ...decoderPins(8) },
    desc: `<p>Même principe que le décodeur 2 bits, en plus grand : un numéro n de 0 à 7, et 8 sorties.</p>
      <p>Les entrées forment n : A0 compte pour 1, A1 pour 2 et A2 pour 4.</p>
      <p><b>Objectif :</b> seule la sortie qui porte le numéro n s'allume (O0 pour 0, O1 pour 1… O7 pour 7).</p>
      <p>Exemple : A2 = 1, A1 = 0 et A0 = 1 donnent n = 4 + 1 = 5, donc seule O5 s'allume.</p>
      <p>Dans le processeur, il choisira quels registres une instruction <code>mov</code> lit et écrit.</p>`,
    tests: truthTable(3, ([a0, a1, a2]) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === a0 + 2 * a1 + 4 * a2 ? 1 : 0))),
  });
  add({
    id: 'reg', chapter: 'architecture', title: 'Registre',
    inputs: ['Charger', 'Lire', 'Val'], outputs: ['Q'], sequential: true,
    pins: { Charger: '1 = enregistrer Val à ce tick', Lire: '1 = montrer la valeur mémorisée sur Q', Val: 'la valeur à enregistrer (0 ou 1)', Q: 'la valeur mémorisée si Lire = 1, sinon 0' },
    desc: `<p>Les <b>registres</b> (R0 à R5) sont les cases de mémoire rapide du processeur, celles que tu manipules
      avec <code>mov</code>.</p>
      <p>Tous les registres sont branchés sur les mêmes fils, appelés le <b>bus</b>. Si plusieurs registres
      envoyaient leur valeur en même temps, ce serait la cacophonie : chacun ne doit « parler » que quand on le
      lui demande.</p>
      <p><b>Objectif :</b> c'est une mémoire d'un bit, avec deux commandes :</p>
      <ul><li><b>Charger</b> = 1 : enregistre Val, qui sera mémorisée au tick suivant (comme Sauv dans le bit de mémoire) ;</li>
      <li><b>Lire</b> = 1 : Q montre la valeur mémorisée. Si Lire = 0, Q vaut 0 pour ne pas brouiller le bus.</li></ul>
      <p>Exemple : on charge 1. Tant que Lire = 0, Q vaut 0 ; dès que Lire = 1, Q affiche 1.</p>`,
id: 'reg', chapter: 'architecture', title: 'Registre',
    inputs: ['Charger', 'Lire', 'Val'], outputs: ['Q'], sequential: true,
    pins: { Charger: '1 = enregistrer Val à ce tick', Lire: '1 = montrer la valeur mémorisée sur Q', Val: 'la valeur à enregistrer (0 ou 1)', Q: 'la valeur mémorisée si Lire = 1, sinon 0' },
    desc: `<p>Les <b>registres</b> (R0 à R5) sont les cases de mémoire rapide du processeur, celles que tu manipules
      avec <code>mov</code>.</p>
      <p>Tous les registres sont branchés sur les mêmes fils, appelés le <b>bus</b>. Si plusieurs registres
      envoyaient leur valeur en même temps, ce serait la cacophonie : chacun ne doit « parler » que quand on le
      lui demande.</p>
      <p><b>Objectif :</b> c'est une mémoire d'un bit, avec deux commandes :</p>
      <ul><li><b>Charger</b> = 1 : enregistre Val, qui sera mémorisée au tick suivant (comme Sauv dans le bit de mémoire) ;</li>
      <li><b>Lire</b> = 1 : Q montre la valeur mémorisée. Si Lire = 0, Q vaut 0 pour ne pas brouiller le bus.</li></ul>
      <p>Exemple : on charge 1. Tant que Lire = 0, Q vaut 0 ; dès que Lire = 1, Q affiche 1.</p>`,
    hint: 'Tu as déjà le composant qui mémorise. Pour « couper » la sortie, pense au gardien AND.',
    tests: [5, 6].map((seed) =>
      sequence((st, [load, read, v]) => [[read ? st : 0], load ? v : st], 0, randomBits(seed * 13, 14, 3))),
  });
  add({
    id: 'pc', chapter: 'architecture', title: 'Compteur de programme',
    inputs: ['Écrire', 'V0', 'V1'], outputs: ['P0', 'P1'], sequential: true,
    pins: { Écrire: '1 = sauter : la prochaine adresse sera V au lieu de P + 1', ...bitPins('V', 2, 'de l\'adresse de saut V'), ...bitPins('P', 2, 'de l\'adresse actuelle P') },
    desc: `<p>Le <b>compteur de programme</b> (PC) retient l'adresse, c'est-à-dire le numéro de ligne, de l'instruction
      en cours. C'est le « PC » que tu vois avancer quand tu fais <b>⏭ Pas</b> dans le chapitre Assemblage.</p>
      <p>Les sorties P0 et P1 affichent l'adresse actuelle P (P0 compte pour 1, P1 pour 2). Ici, le programme
      n'a que 4 lignes : P va de 0 à 3.</p>
      <p><b>Objectif :</b></p>
      <ul><li>normalement, à chaque tick, on passe à la ligne suivante : P devient P + 1 (et après 3, on revient à 0) ;</li>
      <li>mais si <b>Écrire</b> = 1, c'est un <b>saut</b> : au tick suivant, P prend la valeur V donnée par V0 et V1
      (V0 compte pour 1, V1 pour 2).</li></ul>
      <p>Exemples : P = 1 et Écrire = 0, donc au tick suivant P = 2. P = 1, Écrire = 1 et V = 3, donc au tick suivant P = 3.</p>`,
id: 'pc', chapter: 'architecture', title: 'Compteur de programme',
    inputs: ['Écrire', 'V0', 'V1'], outputs: ['P0', 'P1'], sequential: true,
    pins: { Écrire: '1 = sauter : la prochaine adresse sera V au lieu de P + 1', ...bitPins('V', 2, 'de l\'adresse de saut V'), ...bitPins('P', 2, 'de l\'adresse actuelle P') },
    desc: `<p>Le <b>compteur de programme</b> (PC) retient l'adresse, c'est-à-dire le numéro de ligne, de l'instruction
      en cours. C'est le « PC » que tu vois avancer quand tu fais <b>⏭ Pas</b> dans le chapitre Assemblage.</p>
      <p>Les sorties P0 et P1 affichent l'adresse actuelle P (P0 compte pour 1, P1 pour 2). Ici, le programme
      n'a que 4 lignes : P va de 0 à 3.</p>
      <p><b>Objectif :</b></p>
      <ul><li>normalement, à chaque tick, on passe à la ligne suivante : P devient P + 1 (et après 3, on revient à 0) ;</li>
      <li>mais si <b>Écrire</b> = 1, c'est un <b>saut</b> : au tick suivant, P prend la valeur V donnée par V0 et V1
      (V0 compte pour 1, V1 pour 2).</li></ul>
      <p>Exemples : P = 1 et Écrire = 0, donc au tick suivant P = 2. P = 1, Écrire = 1 et V = 3, donc au tick suivant P = 3.</p>`,
    hint: 'Il faut se souvenir de P, calculer P + 1, puis choisir entre P + 1 et V.',
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
    desc: `<p>Bienvenue dans l'<b>assemblage</b> ! Ici, tu ne construis plus de circuit : tu écris un <b>programme</b>
      pour le processeur NANDO-8.</p>
      <p>Le processeur ne comprend que des <b>octets</b>, des nombres de 8 bits. Chaque octet est une instruction,
      et il les exécute une par une, de haut en bas.</p>
      <p>Il possède des <b>registres</b>, des boîtes numérotées où ranger des nombres : R0 à R5. La boîte n°6 est
      spéciale : c'est la <b>sortie</b> (et l'entrée).</p>
      <p>Pour ce niveau, deux instructions suffisent :</p>
      <ul><li><code>00vvvvvv</code> : met le nombre v (6 bits, de 0 à 63) dans R0 ;</li>
      <li><code>10sssddd</code> : copie le registre s dans le registre d (3 bits chacun). Par exemple
      <code>0b10000110</code> copie R0 (<code>000</code>) vers la sortie (<code>110</code> = 6).</li></ul>
      <p><b>Objectif :</b> envoie <b>5</b> puis <b>21</b> sur la sortie. Écris un octet par ligne, en décimal
      (<code>134</code>), en binaire (<code>0b10000110</code>) ou en hexadécimal (<code>0x86</code>).</p>
      <p>Astuce : <code>const NOM valeur</code> donne un nom à un nombre, et les termes s'additionnent : <code>copie + 6</code>.</p>`,
    starter: '# Un octet par ligne\n',
    tests: [{ inputs: [], outputs: [5, 21] }],
  });
  addAsm({
    id: 'echo', chapter: 'assembly', title: 'Écho',
    desc: `<p>Écrire des octets à la main, c'est pénible. L'assembleur comprend maintenant des <b>mnémoniques</b> :
      des mots faciles à retenir qu'il traduit en octets pour toi (voir la référence plus bas). Par exemple,
      <code>mov in r1</code> devient l'octet <code>0b10110001</code>.</p>
      <p><code>mov SOURCE DESTINATION</code> copie une boîte dans une autre. <code>in</code> donne le prochain
      nombre qui arrive sur l'entrée, et <code>out</code> envoie un nombre sur la sortie.</p>
      <p><b>Objectif :</b> recopie chaque entrée sur la sortie, sans fin : le premier nombre reçu est renvoyé,
      puis le deuxième, et ainsi de suite.</p>
      <p>Pour répéter, pose une <b>étiquette</b> au début (un nom suivi de deux-points, comme <code>debut:</code>),
      et termine par <code>jmp debut</code>, qui retourne à l'étiquette. Pas besoin de t'arrêter : le test se
      termine tout seul quand toutes les sorties attendues sont écrites.</p>`,
    starter: 'debut:\n  \n',
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs };
    }),
  });
  addAsm({
    id: 'plus5', chapter: 'assembly', title: 'Plus cinq',
    desc: `<p>Ton processeur a une calculatrice, l'UAL. Elle travaille toujours de la même façon : elle prend
      <b>R1</b> et <b>R2</b>, et met le résultat dans <b>R3</b>. Par exemple, <code>add</code> fait R3 = R1 + R2
      et <code>sub</code> fait R3 = R1 − R2. Ces instructions ne prennent aucun argument.</p>
      <p>Pour faire entrer un nombre fixe dans le processeur, utilise <code>imm</code> : <code>imm 5</code> met 5
      dans R0 (toujours R0, de 0 à 63).</p>
      <p><b>Objectif :</b> pour chaque entrée x, écris x + 5 sur la sortie.</p>`,
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 200));
      return { inputs: xs, outputs: xs.map((x) => x + 5) };
    }),
  });
  addAsm({
    id: 'double', chapter: 'assembly', title: 'Le double',
    desc: `<p><b>Objectif :</b> pour chaque entrée x, écris son <b>double</b> (2 × x).</p>
      <p>Il n'y a pas d'instruction pour multiplier : le processeur ne sait faire que <code>add</code>,
      <code>sub</code> et des opérations bit par bit. À toi de trouver comment doubler avec ça.</p>
      <p>Les registres ne contiennent que des nombres de 0 à 255 : si le double dépasse 255, il « refait le tour »
      (on lui retire 256), comme un compteur kilométrique. Le processeur le fait tout seul : par exemple,
      2 × 200 = 400 devient 144.</p>`,
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 6 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs.map((x) => (2 * x) & 255) };
    }),
  });
  addAsm({
    id: 'parity', chapter: 'assembly', title: 'Pair ou impair',
    desc: `<p><b>Objectif :</b> pour chaque entrée, écris <b>1</b> si elle est impaire, et <b>0</b> si elle est paire.</p>
      <p>Exemples : 7 donne 1, 10 donne 0, 255 donne 1.</p>
      <p>Il n'y a pas d'instruction pour diviser. Mais tu as des opérations bit par bit (<code>and</code>,
      <code>or</code>, <code>xor</code>…) qui agissent sur chaque colonne de bits, comme tes portes.</p>`,
id: 'parity', chapter: 'assembly', title: 'Pair ou impair',
    desc: `<p><b>Objectif :</b> pour chaque entrée, écris <b>1</b> si elle est impaire, et <b>0</b> si elle est paire.</p>
      <p>Exemples : 7 donne 1, 10 donne 0, 255 donne 1.</p>
      <p>Il n'y a pas d'instruction pour diviser. Mais tu as des opérations bit par bit (<code>and</code>,
      <code>or</code>, <code>xor</code>…) qui agissent sur chaque colonne de bits, comme tes portes.</p>`,
    hint: 'Écris quelques nombres pairs et impairs en binaire : qu\'est-ce qui les distingue ?',
    tests: asmTests(3, (r) => {
      const xs = Array.from({ length: 8 }, () => randInt(r, 0, 255));
      return { inputs: xs, outputs: xs.map((x) => x & 1) };
    }),
  });
  addAsm({
    id: 'countdown', chapter: 'assembly', title: 'Compte à rebours',
    desc: `<p>Les programmes deviennent intéressants quand ils <b>décident</b>. Un <b>saut conditionnel</b> ne saute
      que si une condition sur <b>R3</b> est vraie ; sinon, le processeur continue à la ligne suivante :</p>
      <ul><li><code>jz étiquette</code> saute si R3 = 0, <code>jnz</code> si R3 ≠ 0 ;</li>
      <li><code>jgt</code> si R3 &gt; 0, <code>jlt</code> si R3 &lt; 0 ;</li>
      <li><code>jge</code> si R3 ≥ 0, <code>jle</code> si R3 ≤ 0.</li></ul>
      <p><b>Objectif :</b> lis un nombre n (entre 1 et 10), puis écris n, n − 1… jusqu'à 0 compris. Ensuite,
      lis le nombre suivant et recommence.</p>
      <p>Exemple : l'entrée 3 donne les sorties 3, 2, 1, 0.</p>
      <p>⚠️ Un saut vers une étiquette utilise R0 en cachette pour y ranger l'adresse : ne garde rien d'important dans R0.</p>`,
    tests: asmTests(3, (r) => {
      const ns = [randInt(r, 1, 10), randInt(r, 1, 10)];
      const outs = [];
      ns.forEach((n) => { for (let k = n; k >= 0; k--) outs.push(k); });
      return { inputs: ns, outputs: outs };
    }),
  });
  addAsm({
    id: 'max', chapter: 'assembly', group: 2, title: 'Le plus grand',
    desc: `<p><b>Objectif :</b> les entrées arrivent <b>deux par deux</b> : a, puis b. Pour chaque paire, écris le plus
      grand des deux (une seule sortie par paire). Si a = b, écris cette valeur. Les valeurs vont de 0 à 100.</p>
      <p>Exemple : les paires (30, 70) et (12, 5) donnent les sorties 70 puis 12.</p>
      <p>Rappel : chaque <code>mov in …</code> lit un seul nombre, le suivant dans la file. Les registres R4 et R5
      sont libres pour ranger des valeurs.</p>`,
id: 'max', chapter: 'assembly', group: 2, title: 'Le plus grand',
    desc: `<p><b>Objectif :</b> les entrées arrivent <b>deux par deux</b> : a, puis b. Pour chaque paire, écris le plus
      grand des deux (une seule sortie par paire). Si a = b, écris cette valeur. Les valeurs vont de 0 à 100.</p>
      <p>Exemple : les paires (30, 70) et (12, 5) donnent les sorties 70 puis 12.</p>
      <p>Rappel : chaque <code>mov in …</code> lit un seul nombre, le suivant dans la file. Les registres R4 et R5
      sont libres pour ranger des valeurs.</p>`,
    hint: 'Le signe de a − b te dit lequel est le plus grand : positif si c\'est a, négatif si c\'est b.',
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
    id: 'mul', chapter: 'assembly', group: 2, title: 'Multiplication',
    desc: `<p>Le processeur ne sait pas multiplier… mais il sait additionner et répéter. Or 4 × 3, c'est 4 + 4 + 4.</p>
      <p><b>Objectif :</b> les entrées arrivent par paires (a, b), avec des valeurs de 0 à 12. Pour chaque paire,
      écris a × b.</p>
      <p>Exemples : (4, 3) donne 12 ; (7, 0) donne 0. Attention au cas où un des nombres vaut 0 !</p>
      <p>C'est le niveau le plus difficile : il faut retenir plusieurs valeurs en même temps (a, ce qu'il reste à
      ajouter, le total…). Avant de coder, décide quelle boîte garde quoi, et note-le en commentaire en haut
      avec <code>#</code>.</p>`,
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
    desc: `<p><b>Objectif :</b> lis des nombres et additionne-les, jusqu'à recevoir un <b>0</b>. Le 0 veut dire « fin de
      la liste » : écris alors la somme sur la sortie, puis recommence une nouvelle somme, à partir de zéro, avec
      les nombres suivants.</p>
      <p>Exemple : les entrées 3, 4, 5, 0, 10, 0 donnent les sorties 12 puis 10.</p>`,
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
