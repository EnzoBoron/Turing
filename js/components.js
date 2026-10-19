// Définition des composants et moteur de simulation des circuits.
(function (global) {
  'use strict';

  const b = (x) => (x ? 1 : 0);

  // Chaque composant : entrées, sorties, coût en NAND, et soit une fonction
  // combinatoire `fn`, soit un comportement à état (`init`, `out`, `next`).
  // Les sorties d'un composant à état ne dépendent que de son état : il
  // casse donc les boucles, comme un registre cadencé par l'horloge.
  const COMPONENTS = {
    IN: { label: 'IN', io: true, inputs: [], outputs: [''] },
    OUT: { label: 'OUT', io: true, inputs: [''], outputs: [] },

    NAND: { label: 'NAND', inputs: ['A', 'B'], outputs: ['Q'], cost: 1, fn: ([a, c]) => [b(!(a && c))] },
    NOT: { label: 'NOT', inputs: ['A'], outputs: ['Q'], cost: 1, fn: ([a]) => [b(!a)] },
    AND: { label: 'AND', inputs: ['A', 'B'], outputs: ['Q'], cost: 2, fn: ([a, c]) => [b(a && c)] },
    OR: { label: 'OR', inputs: ['A', 'B'], outputs: ['Q'], cost: 3, fn: ([a, c]) => [b(a || c)] },
    NOR: { label: 'NOR', inputs: ['A', 'B'], outputs: ['Q'], cost: 4, fn: ([a, c]) => [b(!(a || c))] },
    XOR: { label: 'XOR', inputs: ['A', 'B'], outputs: ['Q'], cost: 4, fn: ([a, c]) => [b(a !== c)] },
    XNOR: { label: 'XNOR', inputs: ['A', 'B'], outputs: ['Q'], cost: 5, fn: ([a, c]) => [b(a === c)] },

    HALF_ADD: {
      label: '½ ADD', inputs: ['A', 'B'], outputs: ['S', 'C'], cost: 5,
      fn: ([a, c]) => [a ^ c, a & c],
    },
    FULL_ADD: {
      label: 'ADD', inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'], cost: 9,
      fn: ([a, c, ci]) => [a ^ c ^ ci, b(a + c + ci >= 2)],
    },
    MUX: {
      label: 'MUX', inputs: ['A', 'B', 'S'], outputs: ['Q'], cost: 4,
      fn: ([a, c, s]) => [s ? c : a],
    },
    DEC2: {
      label: 'DEC 2', inputs: ['A0', 'A1'], outputs: ['O0', 'O1', 'O2', 'O3'], cost: 6,
      fn: ([a0, a1]) => {
        const n = a0 + 2 * a1;
        return [0, 1, 2, 3].map((i) => b(i === n));
      },
    },
    DEC3: {
      label: 'DEC 3', inputs: ['A0', 'A1', 'A2'], outputs: ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'], cost: 14,
      fn: ([a0, a1, a2]) => {
        const n = a0 + 2 * a1 + 4 * a2;
        return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b(i === n));
      },
    },
    DELAY: {
      label: 'DÉLAI', inputs: ['D'], outputs: ['Q'], cost: 0, stateful: true,
      init: 0, out: (s) => [s], next: (s, [d]) => d,
    },
    MEM: {
      label: 'MÉMOIRE', inputs: ['Sauv', 'Val'], outputs: ['Q'], cost: 4, stateful: true,
      init: 0, out: (s) => [s], next: (s, [save, v]) => (save ? v : s),
    },
  };

  function getDef(type) {
    const def = COMPONENTS[type];
    if (!def) throw new Error('Composant inconnu : ' + type);
    return def;
  }

  // Simulateur : compile le circuit en un ordre d'évaluation topologique.
  class Simulator {
    constructor(circuit) {
      this.circuit = circuit;
      this.error = null;
      this.cycle = [];
      this.compile();
      this.reset();
    }

    compile() {
      const comps = this.circuit.components;
      this.index = new Map(comps.map((c, i) => [c.id, i]));
      this.defs = comps.map((c) => getDef(c.type));
      this.sources = comps.map((c, i) => this.defs[i].inputs.map(() => null));
      for (const w of this.circuit.wires) {
        const fi = this.index.get(w.from.c);
        const ti = this.index.get(w.to.c);
        if (fi === undefined || ti === undefined) continue;
        this.sources[ti][w.to.p] = { c: fi, p: w.from.p };
      }
      this.inputComps = [];
      this.outputComps = [];
      comps.forEach((c, i) => {
        if (c.type === 'IN') this.inputComps[c.idx] = i;
        if (c.type === 'OUT') this.outputComps[c.idx] = i;
      });

      // Tri topologique (Kahn) des composants combinatoires.
      const isComb = (i) => comps[i].type !== 'IN' && !this.defs[i].stateful;
      const indeg = comps.map(() => 0);
      const succ = comps.map(() => []);
      comps.forEach((c, i) => {
        if (!isComb(i)) return;
        const seen = new Set();
        for (const s of this.sources[i]) {
          if (s && isComb(s.c) && !seen.has(s.c)) {
            seen.add(s.c);
            succ[s.c].push(i);
            indeg[i]++;
          }
        }
      });
      const queue = [];
      comps.forEach((c, i) => { if (isComb(i) && indeg[i] === 0) queue.push(i); });
      this.order = [];
      while (queue.length) {
        const i = queue.shift();
        this.order.push(i);
        for (const j of succ[i]) if (--indeg[j] === 0) queue.push(j);
      }
      const combCount = comps.filter((c, i) => isComb(i)).length;
      if (this.order.length !== combCount) {
        this.cycle = comps.filter((c, i) => isComb(i) && indeg[i] > 0).map((c) => c.id);
        this.error = 'Boucle combinatoire : un signal dépend de lui-même sans passer par un composant à mémoire (DÉLAI).';
      }
      this.stateful = comps.map((c, i) => i).filter((i) => this.defs[i].stateful);
    }

    reset() {
      const comps = this.circuit.components;
      this.states = comps.map((c, i) => (this.defs[i].stateful ? this.defs[i].init : null));
      this.values = comps.map((c, i) => this.defs[i].outputs.map(() => 0));
      this.inputsOf = comps.map((c, i) => this.defs[i].inputs.map(() => 0));
    }

    readInputs(i) {
      return this.sources[i].map((s) => (s ? this.values[s.c][s.p] : 0));
    }

    // Calcule toutes les valeurs du tick courant (sans faire avancer l'horloge).
    evaluate(inputValues) {
      if (this.error) return;
      this.inputComps.forEach((ci, k) => {
        if (ci !== undefined) this.values[ci] = [inputValues[k] ? 1 : 0];
      });
      for (const i of this.stateful) this.values[i] = this.defs[i].out(this.states[i]);
      for (const i of this.order) {
        const ins = this.readInputs(i);
        this.inputsOf[i] = ins;
        const def = this.defs[i];
        if (def.fn) this.values[i] = def.fn(ins);
      }
      for (const i of this.stateful) this.inputsOf[i] = this.readInputs(i);
    }

    outputs(count) {
      const res = [];
      for (let k = 0; k < count; k++) {
        const ci = this.outputComps[k];
        res.push(ci === undefined ? 0 : this.inputsOf[ci][0] || 0);
      }
      return res;
    }

    // Front d'horloge : les composants à état mémorisent leurs entrées.
    tick() {
      if (this.error) return;
      for (const i of this.stateful) {
        this.states[i] = this.defs[i].next(this.states[i], this.inputsOf[i]);
      }
    }
  }

  // Vérifie un circuit face aux tests d'un niveau.
  function verifyCircuit(level, circuit) {
    const sim = new Simulator(circuit);
    if (sim.error) return { ok: false, error: sim.error, rows: [] };
    const rows = [];
    let ok = true;
    for (const test of level.tests) {
      const alts = test.alts || [test.steps];
      sim.reset();
      const got = [];
      for (const step of alts[0]) {
        sim.evaluate(step.in);
        got.push(sim.outputs(level.outputs.length));
        sim.tick();
      }
      const same = (steps) => steps.every((s, k) => s.out.every((v, j) => v === got[k][j]));
      const chosen = alts.find(same) || alts[0];
      chosen.forEach((step, k) => {
        const rowOk = step.out.every((v, j) => v === got[k][j]);
        if (!rowOk) ok = false;
        rows.push({ in: step.in, exp: step.out, got: got[k], ok: rowOk, first: k === 0 });
      });
    }
    return { ok, rows };
  }

  function circuitCost(circuit) {
    let nand = 0;
    let delays = 0;
    for (const c of circuit.components) {
      const def = getDef(c.type);
      if (def.io) continue;
      if (c.type === 'DELAY') delays++;
      nand += def.cost || 0;
    }
    return { nand, delays };
  }

  // Table de vérité d'un circuit quelconque (bac à sable), sur les seules entrées
  // et sorties câblées. Chaque ligne part des mémoires remises à 0.
  function truthTableOf(level, circuit) {
    const sim = new Simulator(circuit);
    if (sim.error) return { error: sim.error };
    const wired = (c, side) => circuit.wires.some((w) => (side === 'from' ? w.from.c : w.to.c) === c.id);
    const pick = (type, side) => circuit.components.filter((c) => c.type === type && wired(c, side))
      .map((c) => c.idx).sort((p, q) => p - q);
    const ins = pick('IN', 'from');
    const outs = pick('OUT', 'to');
    const rows = [];
    for (let n = 0; n < 1 << ins.length; n++) {
      const bits = ins.map((_, k) => (n >> (ins.length - 1 - k)) & 1);
      const values = level.inputs.map(() => 0);
      ins.forEach((idx, k) => { values[idx] = bits[k]; });
      sim.reset();
      sim.evaluate(values);
      const all = sim.outputs(level.outputs.length);
      rows.push({ in: bits, out: outs.map((idx) => all[idx]) });
    }
    return { inputs: ins, outputs: outs, rows, stateful: sim.stateful.length > 0 };
  }

  // Portes dont l'ordre des entrées ne compte pas : on n'écrit pas le nom des pattes.
  const SYMMETRIC = new Set(['NAND', 'NOT', 'AND', 'OR', 'NOR', 'XOR', 'XNOR']);

  // Décrit un circuit en texte, une ligne par composant : « MUX1 = MUX(A: AND1, B: OR1, S: Op0) ».
  // Les composants sont numérotés par type, de gauche à droite puis de haut en bas.
  function describeCircuit(level, circuit) {
    const comps = circuit.components.slice().sort((p, q) => p.x - q.x || p.y - q.y);
    const names = new Map();
    const counts = {};
    for (const c of comps) {
      if (c.type === 'IN') names.set(c.id, level.inputs[c.idx]);
      else if (c.type === 'OUT') names.set(c.id, level.outputs[c.idx]);
      else {
        const base = getDef(c.type).label.replace(/\s+/g, '');
        counts[base] = (counts[base] || 0) + 1;
        names.set(c.id, base + counts[base]);
      }
    }
    const source = (c, p) => {
      const w = circuit.wires.find((o) => o.to.c === c.id && o.to.p === p);
      if (!w || !names.has(w.from.c)) return 'rien';
      const from = circuit.components.find((o) => o.id === w.from.c);
      const outs = getDef(from.type).outputs;
      return names.get(w.from.c) + (outs.length > 1 ? '.' + outs[w.from.p] : '');
    };
    const lines = [`Circuit « ${level.title} » (${circuitCost(circuit).nand} NAND)`];
    for (const c of comps) {
      if (c.type === 'IN' || c.type === 'OUT') continue;
      const def = getDef(c.type);
      const args = def.inputs.map((pin, p) => (SYMMETRIC.has(c.type) ? '' : pin + ': ') + source(c, p));
      lines.push(`${names.get(c.id)} = ${def.label}(${args.join(', ')})`);
    }
    circuit.components.filter((c) => c.type === 'OUT').sort((p, q) => p.idx - q.idx)
      .forEach((c) => lines.push(`${names.get(c.id)} = ${source(c, 0)}`));
    return lines.join('\n');
  }

  const api = { COMPONENTS, getDef, Simulator, verifyCircuit, circuitCost, describeCircuit, truthTableOf };
  global.Circuits = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
