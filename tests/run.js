// Vérifie que chaque niveau est résoluble avec une solution de référence
// n'utilisant que les composants disponibles à ce stade.
// Lancement : node tests/run.js
'use strict';

const { verifyCircuit, getDef } = require('../js/components.js');
const { LEVELS } = require('../js/levels.js');
const Nando = require('../js/cpu.js');

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
  if (!ok) failures++;
};

// Construit un circuit : gates = { nom: [type, ...références] }, outs = [référence par sortie].
// Une référence est un nom d'entrée du niveau, un nom de porte, ou « porte.n » pour sa n-ième sortie.
function build(level, gates, outs) {
  const components = [];
  const wires = [];
  level.inputs.forEach((_, k) => components.push({ id: 'in' + k, type: 'IN', idx: k, x: 0, y: 0 }));
  level.outputs.forEach((_, k) => components.push({ id: 'out' + k, type: 'OUT', idx: k, x: 0, y: 0 }));
  for (const [name, [type]] of Object.entries(gates)) components.push({ id: name, type, x: 0, y: 0 });
  const src = (ref) => {
    const k = level.inputs.indexOf(ref);
    if (k >= 0) return { c: 'in' + k, p: 0 };
    const [g, p] = ref.split('.');
    if (!gates[g]) throw new Error('référence inconnue ' + ref);
    return { c: g, p: p ? +p : 0 };
  };
  for (const [name, [, ...ins]] of Object.entries(gates)) {
    ins.forEach((ref, p) => { if (ref) wires.push({ from: src(ref), to: { c: name, p } }); });
  }
  outs.forEach((ref, k) => wires.push({ from: src(ref), to: { c: 'out' + k, p: 0 } }));
  return { components, wires };
}

const SOLUTIONS = {
  nand: [{ n: ['NAND', 'A', 'B'] }, ['n']],
  not: [{ n: ['NAND', 'A', 'A'] }, ['n']],
  constants: [{ na: ['NOT', 'A'], un: ['NAND', 'A', 'na'], zero: ['NOT', 'un'] }, ['un', 'zero']],
  and: [{ n: ['NAND', 'A', 'B'], m: ['NAND', 'n', 'n'] }, ['m']],
  and3: [{ ab: ['AND', 'A', 'B'], q: ['AND', 'ab', 'C'] }, ['q']],
  a_not_b: [{ nb: ['NOT', 'B'], q: ['AND', 'A', 'nb'] }, ['q']],
  or: [{ a: ['NOT', 'A'], b: ['NOT', 'B'], n: ['NAND', 'a', 'b'] }, ['n']],
  or3: [{ ab: ['OR', 'A', 'B'], q: ['OR', 'ab', 'C'] }, ['q']],
  implies: [{ q: ['NAND', 'A', 'nb'], nb: ['NOT', 'B'] }, ['q']],
  alarm: [{ nc: ['NOT', 'Code'], ad: ['AND', 'Armée', 'Porte'], q: ['AND', 'ad', 'nc'] }, ['q']],
  nor: [{ o: ['OR', 'A', 'B'], n: ['NOT', 'o'] }, ['n']],
  none3: [{ ab: ['OR', 'A', 'B'], q: ['NOR', 'ab', 'C'] }, ['q']],
  xor: [{ n: ['NAND', 'A', 'B'], a: ['NAND', 'A', 'n'], b: ['NAND', 'B', 'n'], q: ['NAND', 'a', 'b'] }, ['q']],
  parity3: [{ ab: ['XOR', 'A', 'B'], q: ['XOR', 'ab', 'C'] }, ['q']],
  exactly_one: [{
    p: ['XOR', 'A', 'B'], odd: ['XOR', 'p', 'C'], ab: ['AND', 'A', 'B'], all: ['AND', 'ab', 'C'],
    nall: ['NOT', 'all'], q: ['AND', 'odd', 'nall'],
  }, ['q']],
  xnor: [{ x: ['XOR', 'A', 'B'], n: ['NOT', 'x'] }, ['n']],
  all_equal: [{ ab: ['XNOR', 'A', 'B'], bc: ['XNOR', 'B', 'C'], q: ['AND', 'ab', 'bc'] }, ['q']],
  eq2: [{ e0: ['XNOR', 'A0', 'B0'], e1: ['XNOR', 'A1', 'B1'], q: ['AND', 'e0', 'e1'] }, ['q']],
  cmp1: [{ nb: ['NOT', 'B'], na: ['NOT', 'A'], sup: ['AND', 'A', 'nb'], inf: ['AND', 'na', 'B'], eq: ['XNOR', 'A', 'B'] }, ['sup', 'eq', 'inf']],
  gt2: [{
    nb1: ['NOT', 'B1'], nb0: ['NOT', 'B0'], hi: ['AND', 'A1', 'nb1'], e1: ['XNOR', 'A1', 'B1'],
    lo: ['AND', 'A0', 'nb0'], lo2: ['AND', 'e1', 'lo'], q: ['OR', 'hi', 'lo2'],
  }, ['q']],
  ge5: [{ o: ['OR', 'N0', 'N1'], q: ['AND', 'N2', 'o'] }, ['q']],
  prime: [{ n2: ['NOT', 'N2'], a: ['AND', 'N1', 'n2'], b: ['AND', 'N0', 'N2'], q: ['OR', 'a', 'b'] }, ['q']],
  mult3: [{
    // 3 = 011 et 6 = 110 : N1 = 1 et N0 ≠ N2 ; ou bien N = 0.
    x: ['XOR', 'N0', 'N2'], t: ['AND', 'x', 'N1'], o: ['OR', 'N0', 'N1'], zero: ['NOR', 'o', 'N2'], q: ['OR', 't', 'zero'],
  }, ['q']],
  maj: [{ ab: ['AND', 'A', 'B'], bc: ['AND', 'B', 'C'], ac: ['AND', 'A', 'C'], o1: ['OR', 'ab', 'bc'], o2: ['OR', 'o1', 'ac'] }, ['o2']],
  half_add: [{ s: ['XOR', 'A', 'B'], c: ['AND', 'A', 'B'] }, ['s', 'c']],
  full_add: [{ h1: ['HALF_ADD', 'A', 'B'], h2: ['HALF_ADD', 'h1', 'Ci'], c: ['OR', 'h1.1', 'h2.1'] }, ['h2', 'c']],
  mux: [{ ns: ['NOT', 'S'], a: ['AND', 'A', 'ns'], b: ['AND', 'B', 'S'], q: ['OR', 'a', 'b'] }, ['q']],
  dec2: [{
    n0: ['NOT', 'A0'], n1: ['NOT', 'A1'],
    o0: ['AND', 'n0', 'n1'], o1: ['AND', 'A0', 'n1'], o2: ['AND', 'n0', 'A1'], o3: ['AND', 'A0', 'A1'],
  }, ['o0', 'o1', 'o2', 'o3']],
  osc: [{ d: ['DELAY', 'n'], n: ['NOT', 'd'] }, ['d']],
  mem: [{ d: ['DELAY', 'm'], m: ['MUX', 'd', 'Val', 'Sauv'] }, ['d']],
  counter: [{
    d0: ['DELAY', 'x0'], d1: ['DELAY', 'x1'],
    x0: ['XOR', 'd0', 'Inc'], c: ['AND', 'd0', 'Inc'], x1: ['XOR', 'd1', 'c'],
  }, ['d0', 'd1']],
  alu1: [{
    and: ['AND', 'A', 'B'], or: ['OR', 'A', 'B'], xor: ['XOR', 'A', 'B'], add: ['FULL_ADD', 'A', 'B', 'Ci'],
    m0: ['MUX', 'and', 'or', 'Op0'], m1: ['MUX', 'xor', 'add', 'Op0'], r: ['MUX', 'm0', 'm1', 'Op1'],
    isadd: ['AND', 'Op0', 'Op1'], co: ['AND', 'isadd', 'add.1'],
  }, ['r', 'co']],
  cond: [{
    zn: ['OR', 'Z', 'N'], m0: ['AND', 'C0', 'Z'], m1: ['MUX', 'N', 'zn', 'C0'], base: ['MUX', 'm0', 'm1', 'C1'],
    q: ['XOR', 'base', 'C2'],
  }, ['q']],
  dec3: [{
    d: ['DEC2', 'A0', 'A1'], na: ['NOT', 'A2'],
    o0: ['AND', 'd.0', 'na'], o1: ['AND', 'd.1', 'na'], o2: ['AND', 'd.2', 'na'], o3: ['AND', 'd.3', 'na'],
    o4: ['AND', 'd.0', 'A2'], o5: ['AND', 'd.1', 'A2'], o6: ['AND', 'd.2', 'A2'], o7: ['AND', 'd.3', 'A2'],
  }, ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']],
  reg: [{ m: ['MEM', 'Charger', 'Val'], q: ['AND', 'm', 'Lire'] }, ['q']],
  pc: [{
    p0: ['DELAY', 'n0'], p1: ['DELAY', 'n1'],
    q0: ['NOT', 'p0'], q1: ['XOR', 'p1', 'p0'],
    n0: ['MUX', 'q0', 'V0', 'Écrire'], n1: ['MUX', 'q1', 'V1', 'Écrire'],
  }, ['p0', 'p1']],
};

const PROGRAMS = {
  machine_code: `const COPIE 0b10000000
const SORTIE 6
5
COPIE + SORTIE   # R0 -> sortie
21
COPIE + SORTIE`,
  echo: `debut:
  mov in out
  jmp debut`,
  plus5: `  imm 5
  mov r0 r2
boucle:
  mov in r1
  add
  mov r3 out
  jmp boucle`,
  double: `boucle:
  mov in r1
  mov r1 r2
  add
  mov r3 out
  jmp boucle`,
  parity: `  imm 1
  mov r0 r2
boucle:
  mov in r1
  and
  mov r3 out
  jmp boucle`,
  countdown: `debut:
  mov in r3
boucle:
  mov r3 out
  jz debut
  mov r3 r1
  imm 1
  mov r0 r2
  sub
  jmp boucle`,
  max: `debut:
  mov in r1
  mov in r2
  sub
  imm b_plus_grand
  jlt
  mov r1 out
  jmp debut
b_plus_grand:
  mov r2 out
  jmp debut`,
  sum: `debut:
  imm 0
  mov r0 r4      # somme
lire:
  mov in r3
  jz fin
  mov r3 r1
  mov r4 r2
  add
  mov r3 r4
  jmp lire
fin:
  mov r4 out
  jmp debut`,
};

PROGRAMS.mul = `debut:
  mov in r4      # a
  mov in r5      # b, compteur
  imm 0
  mov r0 r2      # total = 0 (gardé dans r2)
test:
  mov r5 r3
  jz fin
  mov r4 r1
  add            # r3 = a + total
  mov r3 r2      # total
  mov r5 r1
  imm 1
  mov r0 r5      # r5 = 1 (temporaire)
  mov r2 r0      # r0 = total (sauvegarde)
  mov r5 r2      # r2 = 1
  sub            # r3 = b - 1
  mov r3 r5      # b = b - 1
  mov r0 r2      # total restauré
  jmp test
fin:
  mov r2 out
  jmp debut`;

// Défis avec les nouvelles instructions.
PROGRAMS.div = `debut:
  mov in r4      # a
  mov in r5      # b
  imm 0
  mov r0 r2      # q = 0, gardé dans r2
boucle:
  mov r2 r0      # q à l'abri
  mov r4 r1
  mov r5 r2
  sub            # r3 = a - b
  mov r0 r2      # q revient
  jlt fin
  mov r3 r4      # a = a - b
  imm 1
  mov r2 r1
  mov r0 r2
  add            # r3 = q + 1
  mov r3 r2
  jmp boucle
fin:
  mov r2 out
  jmp debut`;
PROGRAMS.quarter = `debut:
  mov in r1
  shr
  mov r3 r1
  shr
  mov r3 out
  jmp debut`;
PROGRAMS.times10 = `debut:
  mov in r1
  shl
  mov r3 r4      # 2x
  mov r3 r1
  shl
  mov r3 r1
  shl            # 8x
  mov r3 r1
  mov r4 r2
  add
  mov r3 out
  jmp debut`;
PROGRAMS.popcount = `debut:
  mov in r4      # x
  imm 0
  mov r0 r5      # compte
boucle:
  mov r4 r3
  jz fin
  mov r4 r1
  imm 1
  mov r0 r2
  and            # dernier bit
  mov r3 r2
  mov r5 r1
  add
  mov r3 r5
  mov r4 r1
  shr
  mov r3 r4
  jmp boucle
fin:
  mov r5 out
  jmp debut`;
PROGRAMS.to_binary = `debut:
  mov in r4
  imm 8
  mov r0 r5
bit:
  mov r4 r3
  jlt un
  imm 0
  mov r0 out
  jmp suite
un:
  imm 1
  mov r0 out
suite:
  mov r4 r1
  shl
  mov r3 r4
  mov r5 r1
  imm 1
  mov r0 r2
  sub
  mov r3 r5
  jnz bit
  jmp debut`;
PROGRAMS.lookup = `  imm 0
  mov r0 r4
remplir:
  mov r4 r1
  mov in r2
  store
  imm 1
  mov r0 r2
  add
  mov r3 r4
  imm 8
  mov r0 r2
  mov r4 r1
  sub
  jnz remplir
lire:
  mov in r1
  load
  mov r3 out
  jmp lire`;
PROGRAMS.reverse = `debut:
  imm 0
  mov r0 r4      # n
lire:
  mov in r3
  jz ecrire
  mov r3 r2
  mov r4 r1
  store
  imm 1
  mov r0 r2
  add
  mov r3 r4
  jmp lire
ecrire:
  mov r4 r3
  jz debut
  mov r4 r1
  imm 1
  mov r0 r2
  sub
  mov r3 r4
  mov r4 r1
  load
  mov r3 out
  jmp ecrire`;
PROGRAMS.sort = `  imm 5
  mov r0 r5      # nombres à lire
lire:
  mov in r1
  load           # r3 = RAM[x]
  mov r1 r4
  mov r3 r1
  imm 1
  mov r0 r2
  add
  mov r3 r2
  mov r4 r1
  store          # RAM[x] = RAM[x] + 1
  mov r5 r1
  imm 1
  mov r0 r2
  sub
  mov r3 r5
  jnz lire
  imm 0
  mov r0 r4      # v = 0
valeur:
  mov r4 r1
  load
  jz suivante
  mov r4 out
  mov r3 r1
  imm 1
  mov r0 r2
  sub
  mov r3 r2
  mov r4 r1
  store
  jmp valeur
suivante:
  mov r4 r1
  imm 1
  mov r0 r2
  add
  mov r3 r4
  jmp valeur`;
PROGRAMS.squares = `debut:
  mov in r1
  call carre     # r3 = a²
  mov r3 r2
  imm 0
  mov r0 r1
  store          # RAM[0] = a²
  mov in r1
  call carre     # r3 = b²
  mov r3 r2
  imm 0
  mov r0 r1
  load           # r3 = a²
  mov r3 r1
  add
  mov r3 out
  jmp debut

carre:           # r3 = r1 × r1
  mov r1 r4
  mov r1 r5
  imm 0
  mov r0 r2
cboucle:
  mov r5 r3
  jz cfin
  mov r4 r1
  add
  mov r5 r1
  imm 1
  mov r0 r2
  mov r3 r0
  sub
  mov r3 r5
  mov r0 r2
  jmp cboucle
cfin:
  mov r2 r3
  ret`;

// Programme volontairement faux : le testeur doit le rejeter.
const WRONG_MUL = `debut:
  mov in r1
  mov in r2
  add
  mov r3 out
  jmp debut`;

console.log('Niveaux de circuits');
for (const lvl of LEVELS.filter((l) => l.type === 'circuit')) {
  const sol = SOLUTIONS[lvl.id];
  if (!sol) { check(lvl.id, false, 'pas de solution de référence'); continue; }
  // Vérifie que la solution n'utilise que des composants disponibles.
  const idx = LEVELS.indexOf(lvl);
  const allowed = new Set(['NAND', ...LEVELS.slice(0, idx).map((l) => l.unlock).filter(Boolean), ...(lvl.give || [])]);
  const used = Object.values(sol[0]).map(([t]) => t).filter((t) => !allowed.has(t));
  if (used.length) { check(lvl.id, false, 'composants non débloqués : ' + used.join(', ')); continue; }
  const res = verifyCircuit(lvl, build(lvl, sol[0], sol[1]));
  const bad = res.rows.find((r) => !r.ok);
  check(lvl.id, res.ok, res.error || (bad && JSON.stringify(bad)));
}

console.log('Niveaux d\'assemblage');
// Instructions supplémentaires disponibles à un niveau (même règle que dans le jeu).
const extFor = (lvl) => LEVELS.slice(0, LEVELS.indexOf(lvl) + 1).flatMap((l) => l.introduces || []);

for (const lvl of LEVELS.filter((l) => l.type === 'asm')) {
  const src = PROGRAMS[lvl.id];
  const asm = Nando.assemble(src, { raw: lvl.raw, ext: extFor(lvl) });
  if (asm.errors.length) { check(lvl.id, false, JSON.stringify(asm.errors)); continue; }
  const results = lvl.tests.map((t) => Nando.runTest(asm.bytes, t, lvl.maxSteps || 5000));
  const bad = results.find((r) => !r.ok);
  check(lvl.id, !bad, bad && bad.error);
}

console.log('Assembleur et CPU');
{
  const a = Nando.assemble('mov in r1\nadd\njz 5\nimm 63', {});
  check('encodage', JSON.stringify(a.bytes) === JSON.stringify([0b10110001, 0b01000100, 5, 0b11000001, 63]), JSON.stringify(a.bytes));
  check('mnémoniques refusées en mode brut', Nando.assemble('mov in out', { raw: true }).errors.length === 1);
  check('imm hors limites', Nando.assemble('imm 64').errors.length === 1);
  check('symbole inconnu', Nando.assemble('foo').errors.length === 1);
  check('le testeur détecte un programme faux',
    !Nando.runTest(Nando.assemble(WRONG_MUL).bytes, LEVELS.find((l) => l.id === 'mul').tests[0], 20000).ok);
  check('condition signée', Nando.condition(Nando.CONDS.jlt, 200) && !Nando.condition(Nando.CONDS.jgt, 200));
  check('binaire invalide refusé', Nando.assemble('0b005', { raw: true }).errors.length === 1);
  check('octet trop grand refusé', Nando.assemble('300', { raw: true }).errors.length === 1);
  check('octet négatif accepté', Nando.assemble('-1', { raw: true }).bytes[0] === 255);
  check('instruction pas encore débloquée', Nando.assemble('shl', { ext: [] }).errors.length === 1);
  {
    const cpu = new Nando.CPU(Nando.assemble('imm 5\nmov r0 r1\nshl\nmov r3 r2\nstore\nload\ncall f\nmov r3 out\nf:\nret').bytes, []);
    for (let k = 0; k < 9; k++) cpu.step();
    check('shl, store, load', cpu.reg[3] === 10 && cpu.ram[5] === 10);
    cpu.step();
    check('call puis ret', cpu.outputs[0] === 10 && cpu.stack.length === 0, JSON.stringify(cpu.outputs));
  }
  {
    const cpu = new Nando.CPU(Nando.assemble('ret').bytes, []);
    check('ret sans call refusé', !cpu.step() && /vide/.test(cpu.error));
  }
  for (const [i, op] of Nando.ALU_OPS.entries()) {
    check('disassemble ' + op, Nando.disassemble(0b01000000 | i) === op);
  }
}

console.log('Composants débloqués');
for (const lvl of LEVELS) if (lvl.unlock) check(lvl.id + ' → ' + lvl.unlock, !!getDef(lvl.unlock));

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
