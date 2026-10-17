// Application : menu, progression, écrans de niveau.
(function () {
  'use strict';

  const { COMPONENTS, verifyCircuit, circuitCost } = window.Circuits;
  const { CHAPTERS, LEVELS } = window.Levels;
  const Nando = window.Nando;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const bin8 = (v) => (v & 255).toString(2).padStart(8, '0');

  // ----------------------------------------------------------- Sauvegarde

  const KEY = 'turing-save-v1';
  let save = { done: {}, circuits: {}, programs: {}, free: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) save = Object.assign(save, JSON.parse(raw));
  } catch (e) { /* stockage indisponible : la partie ne sera pas sauvegardée */ }

  let saveTimer = null;
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignoré */ }
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 200);
  }
  window.addEventListener('pagehide', () => { if (saveTimer) flush(); });

  const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);
  const isDone = (lvl) => !!save.done[lvl.id];
  const isUnlocked = (lvl) => {
    const i = levelIndex(lvl.id);
    return save.free || i === 0 || isDone(LEVELS[i - 1]) || isDone(lvl);
  };
  const chapterOf = (lvl) => CHAPTERS.find((c) => c.id === lvl.chapter);

  // Instructions supplémentaires disponibles dans un niveau d'assemblage :
  // celles présentées par ce niveau et par les niveaux qui le précèdent.
  function extFor(lvl) {
    const list = [];
    for (const l of LEVELS.slice(0, levelIndex(lvl.id) + 1)) for (const op of l.introduces || []) list.push(op);
    return list;
  }

  // Composants disponibles : NAND + ceux débloqués par les niveaux précédents.
  function paletteFor(lvl) {
    const list = ['NAND'];
    for (const l of LEVELS.slice(0, levelIndex(lvl.id))) if (l.unlock && !list.includes(l.unlock)) list.push(l.unlock);
    for (const g of lvl.give || []) if (!list.includes(g)) list.push(g);
    return list;
  }

  // -------------------------------------------------------------- Écrans

  let current = null; // niveau ouvert
  let editor = null;
  const SCREENS = ['menu', 'circuit', 'asm', 'lesson'];

  function show(name) {
    SCREENS.forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    document.body.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  function leaveLevel() {
    stopRun();
    $('c-toast').classList.add('hidden');
    if (editor) { editor.destroy(); editor = null; }
    current = null;
  }

  function updateProgress() {
    const n = LEVELS.filter(isDone).length;
    $('progress').textContent = n + ' / ' + LEVELS.length + ' niveaux';
  }

  function goMenu() {
    leaveLevel();
    $('topbar-title').textContent = 'du NAND à l\'assembleur';
    renderMenu();
    show('menu');
    location.hash = '';
  }

  function renderMenu() {
    updateProgress();
    $('free-mode').checked = !!save.free;
    const root = $('chapters');
    root.innerHTML = '';
    CHAPTERS.forEach((ch, ci) => {
      const levels = LEVELS.filter((l) => l.chapter === ch.id);
      const done = levels.filter(isDone).length;
      const sec = document.createElement('section');
      sec.className = 'chapter';
      sec.innerHTML = `<div class="chapter-head"><span class="chapter-num">${ci + 1}</span>
        <div><h2>${esc(ch.title)}</h2><p>${esc(ch.blurb)}</p></div>
        <span class="chapter-count">${done}/${levels.length}</span></div>`;
      const grid = document.createElement('div');
      grid.className = 'level-grid';
      levels.forEach((lvl) => {
        const b = document.createElement('button');
        const unlocked = isUnlocked(lvl);
        b.className = 'level-card' + (isDone(lvl) ? ' done' : '') + (unlocked ? '' : ' locked');
        b.disabled = !unlocked;
        const icon = isDone(lvl) ? '✓' : unlocked ? (lvl.type === 'asm' ? '⌨' : lvl.type === 'lesson' ? '◆' : '⊼') : '🔒';
        const unlockTxt = lvl.unlock ? `<span class="unlock">débloque ${esc(COMPONENTS[lvl.unlock].label)}</span>`
          : lvl.introduces ? `<span class="unlock">nouveau : ${esc(lvl.introduces.join(', '))}</span>` : '';
        b.innerHTML = `<span class="lv-icon">${icon}</span><span class="lv-title">${esc(lvl.title)}</span>${unlockTxt}`;
        b.addEventListener('click', () => openLevel(lvl));
        grid.appendChild(b);
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  function openLevel(lvl) {
    leaveLevel();
    current = lvl;
    location.hash = lvl.id;
    $('topbar-title').textContent = chapterOf(lvl).title + ' · ' + lvl.title;
    if (lvl.type === 'circuit') openCircuit(lvl);
    else if (lvl.type === 'asm') openAsm(lvl);
    else openLesson(lvl);
  }

  // ------------------------------------------------------- Victoire

  function complete(lvl, score, extra) {
    const first = !isDone(lvl);
    const prev = save.done[lvl.id];
    save.done[lvl.id] = { best: prev && prev.best != null && score != null ? Math.min(prev.best, score) : score };
    persist();
    updateProgress();
    const next = LEVELS[levelIndex(lvl.id) + 1];
    let text = extra || '';
    if (lvl.unlock && first) text += `<br>Nouveau composant débloqué : <b>${esc(COMPONENTS[lvl.unlock].label)}</b>.`;
    if (next && next.chapter !== lvl.chapter && first) text += `<br>Nouveau chapitre : <b>${esc(chapterOf(next).title)}</b> !`;
    if (!next) text += '<br>Tu as terminé tous les niveaux. Bravo, tu as construit et programmé ton propre ordinateur !';
    $('m-title').textContent = 'Niveau réussi !';
    $('m-text').innerHTML = text;
    $('m-next').classList.toggle('hidden', !next);
    $('m-next').onclick = () => { hideModal(); openLevel(next); };
    $('modal').classList.remove('hidden');
    $('m-next').focus();
  }
  function hideModal() { $('modal').classList.add('hidden'); }
  $('m-menu').onclick = () => { hideModal(); goMenu(); };
  $('m-stay').onclick = hideModal;

  // ------------------------------------------------------ Écran circuit

  // Indice facultatif, replié : on ne le voit que si on le demande.
  function hintHtml(lvl) {
    return lvl.hint ? `<details class="expected hint"><summary>Besoin d'un indice ?</summary><p>${esc(lvl.hint)}</p></details>` : '';
  }

  // Légende des entrées et sorties, puis la table attendue (repliée pour ne rien souffler).
  function circuitGuide(lvl) {
    const pins = lvl.pins || {};
    const list = (names) => names.map((n) => `<li><span class="pin-name">${esc(n)}</span>`
      + `<span>${esc(pins[n] || '')}</span></li>`).join('');
    let html = '<div class="guide">';
    if (lvl.inputs.length) html += `<h4>Entrées</h4><ul class="pins">${list(lvl.inputs)}</ul>`;
    html += `<h4>Sorties</h4><ul class="pins">${list(lvl.outputs)}</ul>`;

    const first = lvl.tests[0];
    const steps = first && (first.steps || (first.alts && first.alts[0]));
    if (steps) {
      const rows = lvl.sequential ? steps.slice(0, 8) : lvl.tests.map((t) => t.steps[0]);
      const label = lvl.sequential ? 'Voir un exemple tick par tick' : `Voir la table attendue (${rows.length} lignes)`;
      let table = '<div class="table-scroll"><table class="truth"><thead><tr>';
      if (lvl.sequential) table += '<th>tick</th>';
      lvl.inputs.forEach((n) => { table += `<th class="in">${esc(n)}</th>`; });
      lvl.outputs.forEach((n) => { table += `<th>${esc(n)}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach((r, t) => {
        table += '<tr>' + (lvl.sequential ? `<td>${t}</td>` : '')
          + r.in.map((v) => `<td class="in">${v}</td>`).join('')
          + r.out.map((v) => `<td>${v}</td>`).join('') + '</tr>';
      });
      table += '</tbody></table></div>';
      html += `<details class="expected"><summary>${label}</summary>${table}</details>`;
    }
    return html + hintHtml(lvl) + '</div>';
  }

  // Exemple d'entrées et de sorties attendues, tiré du premier test.
  function asmGuide(lvl) {
    const t = lvl.tests[0];
    const fmt = (xs) => (xs.length ? xs.slice(0, 12).join(', ') + (xs.length > 12 ? ', …' : '') : 'aucune');
    // Entrées lues par paires : on les montre groupées, « (10, 10), (8, 11) ».
    const groups = (xs, n) => xs.length ? Array.from({ length: Math.ceil(xs.length / n) },
      (_, k) => '(' + xs.slice(k * n, k * n + n).join(', ') + ')').join(', ') : 'aucune';
    const ins = lvl.group ? groups(t.inputs, lvl.group) : fmt(t.inputs);
    return '<div class="guide"><h4>Exemple</h4><table class="mini example">'
      + `<tr><th>Entrées</th><td>${ins}</td></tr>`
      + `<tr><th>Sorties attendues</th><td>${fmt(t.outputs)}</td></tr></table>${hintHtml(lvl)}</div>`;
  }

  function openCircuit(lvl) {
    $('c-chapter').textContent = chapterOf(lvl).title;
    $('c-title').textContent = lvl.title;
    $('c-desc').innerHTML = lvl.desc + circuitGuide(lvl);
    $('c-results').classList.add('hidden');
    document.querySelector('#screen-circuit .seq-only').classList.toggle('hidden', !lvl.sequential);

    const pal = $('c-palette');
    pal.innerHTML = '';
    for (const type of paletteFor(lvl)) {
      const def = COMPONENTS[type];
      const b = document.createElement('button');
      b.className = 'pal-item' + (def.stateful ? ' stateful' : '');
      b.innerHTML = `<b>${esc(def.label)}</b><small>${def.inputs.length}→${def.outputs.length}</small>`;
      b.title = 'Ajouter ' + def.label;
      b.addEventListener('click', () => editor.addComponent(type));
      pal.appendChild(b);
    }

    let circuit = save.circuits[lvl.id];
    if (!circuit || !validCircuit(circuit, lvl)) circuit = window.initialCircuit(lvl);
    else circuit = JSON.parse(JSON.stringify(circuit));

    show('circuit');
    editor = new window.CircuitEditor($('c-canvas'), {
      level: lvl,
      circuit,
      onChange: (c) => { save.circuits[lvl.id] = c; persist(); },
      onSim: updateCircuitStatus,
      onMessage: showToast,
    });
  }

  let toastTimer = null;
  function showToast(text) {
    const el = $('c-toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 6000);
  }

  function validCircuit(c, lvl) {
    try {
      const allowed = new Set(paletteFor(lvl).concat(['IN', 'OUT']));
      if (!c.components.every((o) => allowed.has(o.type))) return false;
      const ins = c.components.filter((o) => o.type === 'IN').length;
      const outs = c.components.filter((o) => o.type === 'OUT').length;
      return ins === lvl.inputs.length && outs === lvl.outputs.length;
    } catch (e) {
      return false;
    }
  }

  function updateCircuitStatus(ed) {
    const err = $('c-error');
    err.classList.toggle('hidden', !ed.sim.error);
    err.textContent = ed.sim.error || '';
    const cost = circuitCost(ed.circuit);
    const best = save.done[current.id] && save.done[current.id].best;
    $('c-stats').innerHTML = `<div><span>Coût</span><b>${cost.nand} NAND</b></div>`
      + (cost.delays ? `<div><span>Délais</span><b>${cost.delays}</b></div>` : '')
      + (best != null ? `<div><span>Record</span><b>${best} NAND</b></div>` : '');
    $('c-tickcount').textContent = 'tick ' + ed.tickCount;
  }

  $('c-verify').onclick = () => {
    const lvl = current;
    const res = verifyCircuit(lvl, editor.circuit);
    renderCircuitResults(lvl, res);
    if (res.ok) {
      const cost = circuitCost(editor.circuit).nand;
      complete(lvl, cost, `Ton circuit coûte <b>${cost}</b> porte${cost > 1 ? 's' : ''} NAND.`);
    }
  };
  $('c-tick').onclick = () => editor.tick();
  $('c-reset-state').onclick = () => editor.resetState();
  $('c-fit').onclick = () => editor.fitView();
  $('c-delete').onclick = () => editor.deleteSelection();
  $('c-clear').onclick = () => {
    if (confirm('Effacer tout le circuit de ce niveau ?')) editor.clear();
  };

  function renderCircuitResults(lvl, res) {
    const box = $('c-results');
    box.classList.remove('hidden');
    if (res.error) {
      box.innerHTML = closeBtn + `<div class="verdict bad">✘ ${esc(res.error)}</div>`;
      return;
    }
    const failed = res.rows.filter((r) => !r.ok).length;
    const head = `<div class="verdict ${res.ok ? 'good' : 'bad'}">${res.ok ? '✔ Tous les tests passent !'
      : `✘ ${failed} ligne${failed > 1 ? 's' : ''} incorrecte${failed > 1 ? 's' : ''}`}</div>`;
    const seq = lvl.sequential;
    let html = '<div class="table-scroll"><table class="truth"><thead><tr>';
    if (seq) html += '<th>tick</th>';
    lvl.inputs.forEach((n) => { html += `<th class="in">${esc(n)}</th>`; });
    lvl.outputs.forEach((n) => { html += `<th class="exp">${esc(n)} attendu</th>`; });
    lvl.outputs.forEach((n) => { html += `<th>${esc(n)} obtenu</th>`; });
    html += '</tr></thead><tbody>';
    let t = 0;
    res.rows.forEach((r) => {
      if (r.first) t = 0;
      html += `<tr class="${r.ok ? '' : 'fail'}${seq && r.first ? ' sep' : ''}">`;
      if (seq) html += `<td>${t++}</td>`;
      r.in.forEach((v) => { html += `<td class="in">${v}</td>`; });
      r.exp.forEach((v) => { html += `<td class="exp">${v}</td>`; });
      r.got.forEach((v, j) => { html += `<td class="${v === r.exp[j] ? 'ok' : 'ko'}">${v}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    box.innerHTML = closeBtn + head + html;
  }

  const closeBtn = '<button class="close-results" title="Fermer">×</button>';
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-results')) e.target.parentElement.classList.add('hidden');
  });

  // ---------------------------------------------------------- Référence

  const EXT_HELP = {
    shl: ['01001000', 'R3 = R1 décalé à gauche (× 2)'],
    shr: ['01001001', 'R3 = R1 décalé à droite (÷ 2)'],
    load: ['01010000', 'R3 = case mémoire n° R1'],
    store: ['01010001', 'case mémoire n° R1 = R2'],
    call: ['11001000', 'retient l\'adresse suivante, puis PC = R0'],
    ret: ['11001001', 'revient après le dernier call'],
  };

  function isaHtml(raw, ext = [], fresh = []) {
    const extRows = ext.map((op) => `<tr${fresh.includes(op) ? ' class="fresh"' : ''}><td><code>${op}${op === 'call' ? ' etiq' : ''}</code></td>`
      + `<td><code>${EXT_HELP[op][0]}</code></td><td>${EXT_HELP[op][1]}${fresh.includes(op) ? ' <b class="new-tag">nouveau</b>' : ''}</td></tr>`).join('');
    const ops = Nando.ALU_OPS.map((o, i) => `<tr><td><code>${o}</code></td><td><code>01000${i.toString(2).padStart(3, '0')}</code></td><td>R3 = R1 ${o.toUpperCase()} R2</td></tr>`).join('');
    const conds = Object.keys(Nando.CONDS).map((k) => `<tr><td><code>${k}</code></td><td><code>11000${Nando.CONDS[k].toString(2).padStart(3, '0')}</code></td><td>${k === 'nop' ? 'ne fait rien' : 'PC = R0 si R3 ' + Nando.COND_NAMES[Nando.CONDS[k]]}</td></tr>`).join('');
    return `<summary>Référence NANDO-8</summary>
      <p>6 registres de 8 bits (R0 à R5). Chaque instruction tient sur un octet :</p>
      <table class="mini isa-table">
        <tr><th>Mode</th><th>Octet</th><th>Effet</th></tr>
        <tr><td>Immédiat</td><td><code>00vvvvvv</code></td><td>R0 = v (0 à 63)</td></tr>
        <tr><td>Calcul</td><td><code>01000ooo</code></td><td>R3 = R1 op R2</td></tr>
        <tr><td>Copie</td><td><code>10sssddd</code></td><td>registre d = registre s<br>(6 = entrée en source, sortie en destination)</td></tr>
        <tr><td>Saut</td><td><code>11000ccc</code></td><td>si condition(R3) : PC = R0</td></tr>
      </table>
      ${raw ? '<p class="note">Dans ce niveau, seuls les nombres, <code>const</code> et les étiquettes sont acceptés.</p>' : `
      <h4>Mnémoniques</h4>
      <table class="mini isa-table">
        <tr><td><code>imm v</code></td><td><code>00vvvvvv</code></td><td>R0 = v</td></tr>
        <tr><td><code>mov s d</code></td><td><code>10sssddd</code></td><td>s : r0…r5, <code>in</code> ; d : r0…r5, <code>out</code></td></tr>
        ${ops}${conds}${extRows}
      </table>
      <p class="note"><code>jz etiquette</code> est un raccourci pour <code>imm etiquette</code> puis <code>jz</code> : il écrase R0.</p>`}
      <h4>Syntaxe</h4>
      <ul class="note">
        <li><code>boucle:</code> définit une étiquette (adresse de la ligne suivante).</li>
        <li><code>const NOM 0b1010</code> définit une constante.</li>
        <li>Les termes se combinent : <code>COPIE + 6</code>, <code>A | B</code>.</li>
        <li>Commentaires après <code>#</code> ou <code>;</code>.</li>
      </ul>`;
  }

  // ---------------------------------------------------- Écran assembleur

  let asm = null; // { result, cpu, testIdx }
  let runTimer = null;

  function openAsm(lvl) {
    $('a-title').textContent = lvl.title;
    $('a-desc').innerHTML = lvl.desc + asmGuide(lvl);
    $('a-isa').innerHTML = isaHtml(lvl.raw, extFor(lvl), lvl.introduces || []);
    $('a-results').classList.add('hidden');
    const sel = $('a-test');
    sel.innerHTML = lvl.tests.map((t, i) => `<option value="${i}">${i + 1}</option>`).join('');
    const code = $('a-code');
    code.value = save.programs[lvl.id] != null ? save.programs[lvl.id] : (lvl.starter || '');
    asm = { testIdx: 0 };
    show('asm');
    reassemble();
  }

  function reassemble() {
    const lvl = current;
    stopRun();
    asm.result = Nando.assemble($('a-code').value, { raw: lvl.raw, ext: extFor(lvl) });
    resetCpu();
  }

  function resetCpu() {
    stopRun();
    const test = current.tests[asm.testIdx];
    asm.cpu = new Nando.CPU(asm.result.bytes, test.inputs);
    asm.status = null;
    renderAsm();
  }

  function renderGutter() {
    const res = asm.result;
    const lines = $('a-code').value.split('\n');
    const errs = new Map(res.errors.map((e) => [e.line, e.msg]));
    const pcLine = asm.cpu ? res.addrToLine[asm.cpu.pc] : undefined;
    $('a-gutter').innerHTML = lines.map((_, n) => {
      const info = res.lineInfo[n];
      if (errs.has(n)) return `<div class="g-line err" title="${esc(errs.get(n))}">⚠ erreur</div>`;
      if (!info) return '<div class="g-line"></div>';
      const cur = n === pcLine;
      return `<div class="g-line${cur ? ' cur' : ''}"><span class="g-addr">${cur ? '▶' : ''}${info.addr}</span>${info.bytes.map(bin8).join(' ')}</div>`;
    }).join('');
    $('a-gutter').scrollTop = $('a-code').scrollTop;
  }

  function renderAsm() {
    renderGutter();
    const cpu = asm.cpu;
    const test = current.tests[asm.testIdx];
    const res = asm.result;
    let html = '';
    if (res.errors.length) {
      html += '<div class="asm-errors">' + res.errors.map((e) => `<div>Ligne ${e.line + 1} : ${esc(e.msg)}</div>`).join('') + '</div>';
    }
    const ins = cpu.bytes[cpu.pc];
    html += `<div class="cpu-row"><span>PC</span><b>${cpu.pc}</b><span class="dis">${ins === undefined ? '—' : esc(Nando.disassemble(ins))}</span></div>`;
    html += '<div class="regs">' + cpu.reg.map((v, i) => `<div class="reg"><span>R${i}</span><b>${v}</b><small>${bin8(v)}</small></div>`).join('') + '</div>';
    html += `<div class="cpu-row"><span>Instructions</span><b>${cpu.steps}</b><span class="dis">${res.bytes.length} octets</span></div>`;
    const ext = extFor(current);
    if (ext.includes('load')) {
      html += '<h4>Mémoire <small>(cases 0 à 15)</small></h4><div class="ram">' + cpu.ram.slice(0, 16)
        .map((v, i) => `<div class="${v ? 'set' : ''}"><span>${i}</span><b>${v}</b></div>`).join('') + '</div>';
    }
    if (ext.includes('call')) {
      html += '<h4>Pile d\'appels</h4><div class="io-list">' + (cpu.stack.length
        ? cpu.stack.map((a) => `<span title="adresse de retour">${a}</span>`).join('') : '<em>vide</em>') + '</div>';
    }
    html += '<h4>Entrées</h4><div class="io-list">' + (test.inputs.length
      ? test.inputs.map((v, i) => `<span class="${i < cpu.inPtr ? 'used' : i === cpu.inPtr ? 'next' : ''}">${v}</span>`).join('')
      : '<em>aucune</em>') + '</div>';
    html += '<h4>Sorties</h4><div class="io-list">' + test.outputs.map((v, i) => {
      const got = cpu.outputs[i];
      const cls = got === undefined ? '' : got === v ? 'ok' : 'ko';
      return `<span class="${cls}" title="attendu ${v}">${got === undefined ? '·' : got}<small>${v}</small></span>`;
    }).join('') + '</div>';
    if (asm.status) html += `<div class="verdict ${asm.status.ok ? 'good' : 'bad'}">${esc(asm.status.msg)}</div>`;
    $('a-cpu').innerHTML = html;
  }

  function stepCpu() {
    const cpu = asm.cpu;
    const test = current.tests[asm.testIdx];
    if (asm.result.errors.length) {
      asm.status = { ok: false, msg: 'Corrige les erreurs d\'assemblage d\'abord.' };
      return false;
    }
    if (cpu.outputs.length >= test.outputs.length) {
      asm.status = { ok: true, msg: 'Toutes les sorties de ce test sont correctes.' };
      return false;
    }
    const n = cpu.outputs.length;
    if (!cpu.step()) {
      asm.status = { ok: false, msg: cpu.error };
      return false;
    }
    if (cpu.outputs.length > n && cpu.outputs[n] !== test.outputs[n]) {
      asm.status = { ok: false, msg: `Sortie n°${n + 1} : attendu ${test.outputs[n]}, obtenu ${cpu.outputs[n]}.` };
      return false;
    }
    if (cpu.outputs.length >= test.outputs.length) {
      asm.status = { ok: true, msg: 'Toutes les sorties de ce test sont correctes.' };
      return false;
    }
    if (cpu.steps >= (current.maxSteps || 5000)) {
      asm.status = { ok: false, msg: 'Trop d\'instructions exécutées. Boucle infinie ?' };
      return false;
    }
    return true;
  }

  function stopRun() {
    if (runTimer) clearInterval(runTimer);
    runTimer = null;
    $('a-run').textContent = '⏵ Exécuter';
  }

  $('a-code').addEventListener('input', () => {
    save.programs[current.id] = $('a-code').value;
    persist();
    reassemble();
  });
  $('a-code').addEventListener('scroll', () => { $('a-gutter').scrollTop = $('a-code').scrollTop; });
  $('a-code').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart;
      ta.setRangeText('  ', s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  $('a-test').addEventListener('change', (e) => { asm.testIdx = +e.target.value; resetCpu(); });
  $('a-step').onclick = () => { stopRun(); stepCpu(); renderAsm(); };
  $('a-reset').onclick = resetCpu;
  $('a-run').onclick = () => {
    if (runTimer) { stopRun(); return; }
    if (asm.status) resetCpu();
    $('a-run').textContent = '⏸ Pause';
    const tickRun = () => {
      const speed = +$('a-speed').value;
      const perTick = Math.max(1, Math.round(speed / 20));
      for (let k = 0; k < perTick; k++) {
        if (!stepCpu()) { stopRun(); break; }
      }
      renderAsm();
    };
    const speed = +$('a-speed').value;
    runTimer = setInterval(tickRun, Math.max(16, 1000 / speed));
  };
  $('a-verify').onclick = () => {
    stopRun();
    const lvl = current;
    const res = asm.result;
    const box = $('a-results');
    box.classList.remove('hidden');
    if (res.errors.length) {
      box.innerHTML = closeBtn + `<div class="verdict bad">✘ Le programme contient ${res.errors.length} erreur(s) d'assemblage.</div>`;
      return;
    }
    let total = 0;
    const rows = lvl.tests.map((t, i) => {
      const r = Nando.runTest(res.bytes, t, lvl.maxSteps || 5000);
      total += r.cpu.steps;
      return { i, r };
    });
    const ok = rows.every((x) => x.r.ok);
    box.innerHTML = closeBtn + `<div class="verdict ${ok ? 'good' : 'bad'}">${ok ? '✔ Tous les tests passent !' : '✘ Certains tests échouent'}</div>`
      + '<ul class="test-list">' + rows.map(({ i, r }) => `<li class="${r.ok ? 'ok' : 'ko'}">Test ${i + 1} : ${r.ok
        ? `réussi en ${r.cpu.steps} instructions` : esc(r.error)}</li>`).join('') + '</ul>';
    if (ok) {
      complete(lvl, total, `Programme de <b>${res.bytes.length}</b> octets, <b>${total}</b> instructions exécutées au total.`);
    }
  };

  // ------------------------------------------------------------- Leçon

  function openLesson(lvl) {
    const art = $('lesson');
    art.innerHTML = `
      <div class="chapter-tag">${esc(chapterOf(lvl).title)}</div>
      <h1>L'ordinateur NANDO-8</h1>
      <p>Tu possèdes maintenant toutes les pièces d'un processeur. En les assemblant en 8 bits de large,
        on obtient <b>NANDO-8</b>, un ordinateur Turing-complet : avec assez de temps et de mémoire,
        il peut exécuter n'importe quel algorithme.</p>
      ${architectureSvg()}
      <h2>Le cycle d'une instruction</h2>
      <ol>
        <li>Le <b>compteur de programme</b> donne l'adresse de l'instruction dans la mémoire du programme.</li>
        <li>Les deux bits de poids fort passent dans un <b>décodeur 2 bits</b> qui choisit le mode :
          immédiat, calcul, copie ou saut.</li>
        <li>En mode copie, deux <b>décodeurs 3 bits</b> sélectionnent les <b>registres</b> à lire et à charger
          sur le bus. Le numéro 6 correspond aux ports d'entrée et de sortie.</li>
        <li>En mode calcul, l'<b>ALU</b> (8 tranches de ton ALU 1 bit, enrichies de NAND, NOR, SUB…) combine
          R1 et R2 et range le résultat dans R3.</li>
        <li>En mode saut, l'<b>unité de condition</b> examine R3 ; si la condition est vraie, le compteur de programme
          est <i>écrit</i> avec la valeur de R0 au lieu de s'incrémenter.</li>
      </ol>
      <p>Ce simple mécanisme de <b>saut conditionnel</b> et de <b>mémoire</b> suffit à rendre la machine Turing-complète :
        boucles, tests, calculs arbitraires… tout devient possible.</p>
      <details class="isa" open>${isaHtml(false)}</details>
      <p>Au chapitre suivant, tu vas programmer cette machine : d'abord directement en binaire,
        puis avec ton propre langage d'assemblage.</p>
      <div class="lesson-actions"><button class="primary" id="lesson-done">J'ai compris, continuer →</button></div>`;
    show('lesson');
    $('lesson-done').onclick = () => complete(lvl, null, 'Place à la programmation !');
  }

  function architectureSvg() {
    const box = (x, y, w, h, label, sub, cls = '') => `<g class="arch-box ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
      <text x="${x + w / 2}" y="${y + h / 2 - (sub ? 6 : 0)}">${label}</text>${sub ? `<text class="sub" x="${x + w / 2}" y="${y + h / 2 + 12}">${sub}</text>` : ''}</g>`;
    const line = (pts) => `<polyline class="arch-line" points="${pts}"/>`;
    return `<svg class="arch" viewBox="0 0 640 330" role="img" aria-label="Schéma de l'architecture NANDO-8">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arch-arrow"/></marker></defs>
      ${line('110,60 160,60')}${line('260,60 300,60')}${line('350,85 350,120')}
      ${line('400,140 460,140')}${line('350,165 350,205')}${line('230,230 300,230')}
      ${line('460,230 400,230')}${line('520,165 520,205')}${line('580,140 615,140 615,290 60,290 60,85')}
      ${box(10, 35, 100, 50, 'Compteur', 'de programme')}
      ${box(160, 35, 100, 50, 'Programme', 'mémoire')}
      ${box(300, 35, 100, 50, 'Décodeur', 'mode', 'hl')}
      ${box(300, 120, 100, 45, 'Décodeurs', '3 bits')}
      ${box(460, 115, 120, 50, 'Unité de', 'condition', 'hl')}
      ${box(300, 205, 100, 50, 'Bus', '8 bits')}
      ${box(120, 205, 110, 50, 'Registres', 'R0 … R5')}
      ${box(460, 205, 120, 50, 'ALU 8 bits', 'R3 = R1 op R2', 'hl')}
      <text class="arch-label" x="250" y="310">saut : PC ← R0</text>
    </svg>`;
  }

  // ---------------------------------------------------------- Démarrage

  $('home-btn').onclick = goMenu;
  $('free-mode').addEventListener('change', (e) => { save.free = e.target.checked; persist(); renderMenu(); });
  // Fichier de sauvegarde : export / import JSON.
  const SAVE_FORMAT = 'turing-sauvegarde';

  function saveMessage(text, ok) {
    const el = $('save-msg');
    el.textContent = text;
    el.className = 'save-msg ' + (ok ? 'good' : 'bad');
  }

  function exportSave() {
    flush();
    const data = Object.assign({ format: SAVE_FORMAT, version: 1, date: new Date().toISOString() }, save);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'turing-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    saveMessage('Sauvegarde exportée (' + LEVELS.filter(isDone).length + ' niveaux réussis).', true);
  }

  function parseSave(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('ce fichier n\'est pas un JSON valide'); }
    if (!data || data.format !== SAVE_FORMAT) throw new Error('ce fichier n\'est pas une sauvegarde de TURING');
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    return { done: obj(data.done), circuits: obj(data.circuits), programs: obj(data.programs), free: !!data.free };
  }

  $('export-save').onclick = exportSave;
  $('import-save').onclick = () => $('import-file').click();
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const loaded = parseSave(await file.text());
      const n = LEVELS.filter((l) => loaded.done[l.id]).length;
      if (!confirm(`Charger cette sauvegarde (${n} niveaux réussis) ? Ta progression actuelle sera remplacée.`)) return;
      save = loaded;
      flush();
      renderMenu();
      saveMessage('Sauvegarde importée : ' + n + ' niveaux réussis.', true);
    } catch (err) {
      saveMessage('Impossible d\'importer : ' + err.message + '.', false);
    }
  });

  $('reset-progress').onclick = () => {
    if (!confirm('Effacer toute la progression, les circuits et les programmes ?')) return;
    save = { done: {}, circuits: {}, programs: {}, free: false };
    persist();
    renderMenu();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) hideModal();
  });

  // Accès pour le débogage depuis la console du navigateur.
  window.game = { get editor() { return editor; }, get level() { return current; } };

  function route() {
    const id = location.hash.slice(1);
    if (current && current.id === id) return;
    const lvl = LEVELS.find((l) => l.id === id);
    if (lvl && isUnlocked(lvl)) openLevel(lvl);
    else if (current || document.body.dataset.screen !== 'menu') goMenu();
  }
  window.addEventListener('hashchange', () => { hideModal(); route(); });
  route();
})();
