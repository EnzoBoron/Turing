// Ordinateur NANDO-8 : jeu d'instructions, assembleur et émulateur.
//
// Instructions sur 8 bits, les deux bits de poids fort donnent le mode :
//   00vvvvvv  IMMÉDIAT  R0 <- v (0..63)
//   01000ooo  CALCUL    R3 <- R1 op R2
//   10sssddd  COPIE     d <- s   (registres 0..5, 6 = entrée / sortie)
//   11000ccc  SAUT      si condition(R3) alors PC <- R0
//
// Extensions débloquées au fil du chapitre Assemblage :
//   01001000  shl    R3 <- R1 décalé d'un cran vers la gauche (× 2)
//   01001001  shr    R3 <- R1 décalé d'un cran vers la droite (÷ 2)
//   01010000  load   R3 <- RAM[R1]
//   01010001  store  RAM[R1] <- R2
//   11001000  call   empile PC + 1, puis PC <- R0
//   11001001  ret    PC <- adresse dépilée
(function (global) {
  'use strict';

  const ALU_OPS = ['or', 'nand', 'nor', 'and', 'add', 'sub', 'xor', 'xnor'];
  // Codes de condition : bit 2 = inverse du résultat des bits 0..1.
  const CONDS = { nop: 0, jz: 1, jlt: 2, jle: 3, jmp: 4, jnz: 5, jge: 6, jgt: 7 };
  const COND_NAMES = ['jamais', '= 0', '< 0', '≤ 0', 'toujours', '≠ 0', '≥ 0', '> 0'];
  const REGS = { r0: 0, r1: 1, r2: 2, r3: 3, r4: 4, r5: 5, in: 6, out: 6 };
  const IO = 6;
  // Instructions supplémentaires : nom -> octet. Toutes sauf call s'écrivent sans argument.
  const EXT_OPS = { shl: 0b01001000, shr: 0b01001001, load: 0b01010000, store: 0b01010001, call: 0b11001000, ret: 0b11001001 };
  const EXT_NAMES = Object.fromEntries(Object.entries(EXT_OPS).map(([k, v]) => [v, k]));
  const RAM_SIZE = 256;
  const STACK_MAX = 16;

  const toSigned = (v) => (v & 0x80 ? v - 256 : v);

  function alu(op, a, c) {
    switch (op) {
      case 0: return a | c;
      case 1: return ~(a & c) & 255;
      case 2: return ~(a | c) & 255;
      case 3: return a & c;
      case 4: return (a + c) & 255;
      case 5: return (a - c) & 255;
      case 6: return a ^ c;
      default: return ~(a ^ c) & 255;
    }
  }

  function condition(code, v) {
    const s = toSigned(v);
    const base = [false, s === 0, s < 0, s <= 0][code & 3];
    return code & 4 ? !base : base;
  }

  // ---------------------------------------------------------------- Assembleur

  // Un nombre est lu d'un seul bloc (« 0b005 » est un seul jeton, refusé ensuite)
  // pour ne pas le couper silencieusement en deux nombres.
  const TOKEN_RE = /\s*(\d\w*|[a-z_][a-z0-9_]*|\+|-|\|)/iy;

  function tokenize(text) {
    const out = [];
    TOKEN_RE.lastIndex = 0;
    let pos = 0;
    while (pos < text.length) {
      if (/^\s*$/.test(text.slice(pos))) break;
      TOKEN_RE.lastIndex = pos;
      const m = TOKEN_RE.exec(text);
      if (!m) throw new Error('Caractère inattendu : « ' + text.slice(pos).trim()[0] + ' »');
      out.push(m[1]);
      pos = TOKEN_RE.lastIndex;
    }
    return out;
  }

  function parseNumber(tok) {
    if (!/^\d/.test(tok)) return null;
    const t = tok.toLowerCase().replace(/_/g, '');
    if (/^0b[01]+$/.test(t)) return parseInt(t.slice(2), 2);
    if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t.slice(2), 16);
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (t.startsWith('0b')) throw new Error('Nombre binaire invalide : « ' + tok + ' » (seulement des 0 et des 1 après 0b)');
    if (t.startsWith('0x')) throw new Error('Nombre hexadécimal invalide : « ' + tok + ' »');
    throw new Error('Nombre invalide : « ' + tok + ' »');
  }

  // Évalue une expression : nombres, constantes et étiquettes combinés par
  // `+`, `-` ou `|`. Des termes simplement juxtaposés sont combinés par OU.
  function evalExpr(tokens, symbols) {
    if (!tokens.length) throw new Error('Expression vide');
    let acc = 0;
    let op = '|';
    let expectTerm = true;
    for (const tok of tokens) {
      if (tok === '+' || tok === '-' || tok === '|') {
        if (expectTerm && !(tok === '-' && acc === 0)) throw new Error('Opérateur mal placé : ' + tok);
        op = tok;
        expectTerm = true;
        continue;
      }
      let v = parseNumber(tok);
      if (v === null) {
        const key = tok.toLowerCase();
        if (!(key in symbols)) throw new Error('Symbole inconnu : « ' + tok + ' »');
        v = symbols[key];
      }
      if (op === '+') acc += v;
      else if (op === '-') acc -= v;
      else acc |= v;
      op = '|';
      expectTerm = false;
    }
    if (expectTerm) throw new Error('Expression incomplète');
    return acc;
  }

  function isMnemonic(word) {
    return word === 'imm' || word === 'mov' || ALU_OPS.includes(word) || word in CONDS || word in EXT_OPS;
  }

  // Taille en octets d'une ligne d'instruction (avant résolution).
  function lineSize(tokens, raw) {
    const head = tokens[0].toLowerCase();
    if (!raw && (head in CONDS || head === 'call') && head !== 'nop' && tokens.length > 1) return 2;
    return 1;
  }

  function encodeLine(tokens, symbols, raw, ext) {
    const head = tokens[0].toLowerCase();
    const rest = tokens.slice(1);
    if (!raw && head in EXT_OPS) {
      if (ext && !ext.includes(head)) throw new Error('Instruction pas encore débloquée : ' + head);
      if (head === 'call') {
        if (!rest.length) return [EXT_OPS.call];
        const target = evalExpr(rest, symbols);
        if (target < 0 || target > 63) throw new Error('Cible d\'appel hors de portée de imm (0..63) : ' + target);
        return [target, EXT_OPS.call];
      }
      if (rest.length) throw new Error(head + ' ne prend pas d\'argument');
      return [EXT_OPS[head]];
    }
    if (raw || !isMnemonic(head)) {
      const v = evalExpr(tokens, symbols);
      if (v < -128 || v > 255) throw new Error('Un octet vaut de 0 à 255 (reçu ' + v + ')');
      return [v & 255];
    }

    if (head === 'imm') {
      const v = evalExpr(rest, symbols);
      if (v < 0 || v > 63) throw new Error('imm accepte une valeur de 0 à 63 (reçu ' + v + ')');
      return [v];
    }
    if (ALU_OPS.includes(head)) {
      if (rest.length) throw new Error(head + ' ne prend pas d\'argument (R3 = R1 ' + head + ' R2)');
      return [0b01000000 | ALU_OPS.indexOf(head)];
    }
    if (head === 'mov') {
      if (rest.length !== 2) throw new Error('Syntaxe : mov SOURCE DESTINATION (ex. mov in r1)');
      const [s, d] = rest.map((r) => r.toLowerCase());
      if (!(s in REGS) || s === 'out') throw new Error('Source invalide : ' + rest[0] + ' (r0..r5 ou in)');
      if (!(d in REGS) || d === 'in') throw new Error('Destination invalide : ' + rest[1] + ' (r0..r5 ou out)');
      return [0b10000000 | (REGS[s] << 3) | REGS[d]];
    }
    // Saut, avec cible optionnelle : « jz fin » devient « imm fin » + « jz ».
    const code = 0b11000000 | CONDS[head];
    if (!rest.length) return [code];
    if (head === 'nop') throw new Error('nop ne prend pas d\'argument');
    const target = evalExpr(rest, symbols);
    if (target < 0 || target > 63) throw new Error('Cible de saut hors de portée de imm (0..63) : ' + target);
    return [target, code];
  }

  // opts.raw : octets bruts ; opts.ext : liste des instructions supplémentaires
  // autorisées (toutes si absent).
  function assemble(source, opts = {}) {
    const raw = !!opts.raw;
    const ext = opts.ext || null;
    const lines = source.split('\n');
    const symbols = {};
    const errors = [];
    const parsed = [];
    let addr = 0;

    // Passe 1 : étiquettes, constantes et adresses.
    lines.forEach((text, n) => {
      let code = text.replace(/(#|;|\/\/).*$/, '').trim();
      try {
        const lab = code.match(/^([a-z_][a-z0-9_]*)\s*:/i);
        if (lab) {
          const name = lab[1].toLowerCase();
          if (name in symbols) throw new Error('Symbole déjà défini : ' + lab[1]);
          symbols[name] = addr;
          code = code.slice(lab[0].length).trim();
        }
        if (!code) return;
        const cst = code.match(/^const\s+([a-z_][a-z0-9_]*)\s+(.+)$/i);
        if (cst) {
          const name = cst[1].toLowerCase();
          if (name in symbols) throw new Error('Symbole déjà défini : ' + cst[1]);
          symbols[name] = evalExpr(tokenize(cst[2]), symbols);
          return;
        }
        const tokens = tokenize(code);
        const size = lineSize(tokens, raw);
        parsed.push({ line: n, addr, tokens });
        addr += size;
      } catch (e) {
        errors.push({ line: n, msg: e.message });
      }
    });

    // Passe 2 : encodage.
    const bytes = [];
    const lineInfo = lines.map(() => null);
    const addrToLine = [];
    for (const p of parsed) {
      try {
        const enc = encodeLine(p.tokens, symbols, raw, ext);
        enc.forEach((byte) => { addrToLine[bytes.length] = p.line; bytes.push(byte); });
        lineInfo[p.line] = { addr: p.addr, bytes: enc };
      } catch (e) {
        errors.push({ line: p.line, msg: e.message });
      }
    }
    if (bytes.length > 256) errors.push({ line: lines.length - 1, msg: 'Programme trop long (256 octets max)' });
    errors.sort((x, y) => x.line - y.line);
    return { bytes, lineInfo, addrToLine, errors, symbols };
  }

  function disassemble(byte) {
    const mode = byte >> 6;
    if (mode === 0) return 'imm ' + (byte & 63);
    if (byte in EXT_NAMES) return EXT_NAMES[byte];
    if (mode === 1) return (byte & 0b111000) ? '???' : ALU_OPS[byte & 7];
    if (mode === 2) {
      const s = (byte >> 3) & 7;
      const d = byte & 7;
      const name = (r, io) => (r === IO ? io : r === 7 ? '?' : 'r' + r);
      return 'mov ' + name(s, 'in') + ' ' + name(d, 'out');
    }
    if (byte & 0b111000) return '???';
    return Object.keys(CONDS).find((k) => CONDS[k] === (byte & 7));
  }

  // ----------------------------------------------------------------- Émulateur

  class CPU {
    constructor(bytes, inputs) {
      this.bytes = bytes;
      this.inputs = inputs.slice();
      this.inPtr = 0;
      this.reg = [0, 0, 0, 0, 0, 0];
      this.pc = 0;
      this.outputs = [];
      this.steps = 0;
      this.error = null;
      this.ram = new Array(RAM_SIZE).fill(0);
      this.stack = [];
    }

    fail(msg) {
      this.error = msg;
      return false;
    }

    step() {
      if (this.error) return false;
      if (this.pc >= this.bytes.length) {
        this.error = 'Le compteur de programme (PC = ' + this.pc + ') est sorti du programme.';
        return false;
      }
      const ins = this.bytes[this.pc];
      const mode = ins >> 6;
      this.steps++;
      if (mode === 0) {
        this.reg[0] = ins & 63;
        this.pc++;
      } else if (mode === 1) {
        const group = (ins >> 3) & 7;
        if (group === 0) this.reg[3] = alu(ins & 7, this.reg[1], this.reg[2]);
        else if (ins === EXT_OPS.shl) this.reg[3] = (this.reg[1] << 1) & 255;
        else if (ins === EXT_OPS.shr) this.reg[3] = this.reg[1] >> 1;
        else if (ins === EXT_OPS.load) this.reg[3] = this.ram[this.reg[1]];
        else if (ins === EXT_OPS.store) this.ram[this.reg[1]] = this.reg[2];
        else return this.fail('Instruction inconnue : ' + ins + ' (0b' + ins.toString(2).padStart(8, '0') + ').');
        this.pc++;
      } else if (mode === 2) {
        const s = (ins >> 3) & 7;
        const d = ins & 7;
        let v;
        if (s === IO) {
          if (this.inPtr >= this.inputs.length) {
            this.error = 'Plus aucune entrée à lire.';
            return false;
          }
          v = this.inputs[this.inPtr++];
        } else if (s === 7) {
          this.error = 'Registre source 7 inexistant.';
          return false;
        } else v = this.reg[s];
        if (d === IO) this.outputs.push(v);
        else if (d === 7) {
          this.error = 'Registre destination 7 inexistant.';
          return false;
        } else this.reg[d] = v;
        this.pc++;
      } else if (ins === EXT_OPS.call) {
        if (this.stack.length >= STACK_MAX) return this.fail('Pile d\'appels pleine : plus de ' + STACK_MAX + ' call sans ret.');
        this.stack.push((this.pc + 1) & 255);
        this.pc = this.reg[0];
      } else if (ins === EXT_OPS.ret) {
        if (!this.stack.length) return this.fail('ret sans call : la pile d\'appels est vide.');
        this.pc = this.stack.pop();
      } else if (ins & 0b111000) {
        return this.fail('Instruction inconnue : ' + ins + ' (0b' + ins.toString(2).padStart(8, '0') + ').');
      } else {
        this.pc = condition(ins & 7, this.reg[3]) ? this.reg[0] : this.pc + 1;
      }
      this.pc &= 255;
      return true;
    }
  }

  // Exécute un test : s'arrête dès que toutes les sorties attendues sont produites.
  function runTest(bytes, test, maxSteps = 5000) {
    const cpu = new CPU(bytes, test.inputs);
    while (cpu.outputs.length < test.outputs.length) {
      if (cpu.steps >= maxSteps) {
        return { ok: false, cpu, error: 'Trop d\'instructions exécutées (> ' + maxSteps + '). Boucle infinie ?' };
      }
      const before = cpu.outputs.length;
      if (!cpu.step()) return { ok: false, cpu, error: cpu.error };
      if (cpu.outputs.length > before) {
        const k = before;
        if (cpu.outputs[k] !== test.outputs[k]) {
          return {
            ok: false, cpu,
            error: 'Sortie n°' + (k + 1) + ' : attendu ' + test.outputs[k] + ', obtenu ' + cpu.outputs[k] + '.',
          };
        }
      }
    }
    return { ok: true, cpu };
  }

  const api = {
    ALU_OPS, CONDS, COND_NAMES, REGS, EXT_OPS, RAM_SIZE, alu, condition, toSigned,
    assemble, disassemble, CPU, runTest,
  };
  global.Nando = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
