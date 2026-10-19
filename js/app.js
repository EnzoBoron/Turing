// Application : menu, progression, écrans de niveau.
(function () {
  'use strict';

  const { COMPONENTS, getDef, verifyCircuit, circuitCost, describeCircuit, truthTableOf, setCustoms, MAX_TABLE_INPUTS } = window.Circuits;
  const { CHAPTERS, LEVELS } = window.Levels;
  const Nando = window.Nando;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const bin8 = (v) => (v & 255).toString(2).padStart(8, '0');

  // ----------------------------------------------------------- Sauvegarde

  const KEY = 'turing-save-v1';
  let save = { done: {}, circuits: {}, programs: {}, notes: {}, drawings: {}, free: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) save = Object.assign(save, JSON.parse(raw));
    if (!save.notes || typeof save.notes !== 'object') save.notes = {};
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

  // Bac à sable : un circuit libre, sans objectif, avec tous les composants.
  const SANDBOX = {
    id: 'sandbox', type: 'circuit', sandbox: true, sequential: true, title: 'Bac à sable',
    inputs: [], outputs: [], tests: [], // entrées et sorties : celles que le joueur a placées
    desc: `<p>Ici, pas d'objectif imposé : tous les composants sont disponibles, pour t'exercer et
      essayer tes idées.</p>
      <p>Place tes propres <b>Entrées</b> et <b>Sorties</b> depuis la palette ; double-clic dessus pour
      les renommer. Le bouton <b>Table de vérité</b> calcule ce que fait ton circuit pour toutes les
      combinaisons des entrées câblées.</p>
      <p>Pour te lancer un défi, écris ta <b>batterie de tests</b> ci-dessous : les sorties que tu
      attends pour chaque combinaison d'entrées, puis lance-les.</p>`,
  };
  const chapterTitle = (lvl) => (lvl.sandbox ? 'Entraînement' : chapterOf(lvl).title);

  // Instructions supplémentaires disponibles dans un niveau d'assemblage :
  // celles présentées par ce niveau et par les niveaux qui le précèdent.
  function extFor(lvl) {
    const list = [];
    for (const l of LEVELS.slice(0, levelIndex(lvl.id) + 1)) for (const op of l.introduces || []) list.push(op);
    return list;
  }

  // Composants disponibles : NAND + ceux débloqués par les niveaux précédents.
  function paletteFor(lvl) {
    if (lvl.sandbox) return Object.keys(COMPONENTS).filter((t) => !COMPONENTS[t].io);
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
    loadDrawing();
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
    loadDrawing();
    location.hash = lvl.id;
    $('topbar-title').textContent = chapterTitle(lvl) + ' · ' + lvl.title;
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

  // ------------------------------------------------------------- Crayon
  // Un dessin par écran (chaque niveau, et le menu), enregistré avec la partie.

  const drawKey = () => (current ? current.id : 'menu');
  const drawLayer = new window.DrawLayer($('draw-layer'), {
    onChange: (strokes) => {
      if (strokes.length) save.drawings[drawKey()] = strokes;
      else delete save.drawings[drawKey()];
      persist();
    },
    // Un trait posé sur le circuit suit son zoom et son déplacement.
    anchorOf: (el) => (el.id === 'c-canvas' ? 'circuit' : null),
    frames: (anchor) => {
      if (anchor !== 'circuit' || !editor || document.body.dataset.screen !== 'circuit') return null;
      const r = editor.canvas.getBoundingClientRect();
      const { x: vx, y: vy, scale } = editor.view;
      return {
        toLocal: (x, y) => [(x - r.left - vx) / scale, (y - r.top - vy) / scale],
        toScreen: (x, y) => [r.left + vx + x * scale, r.top + vy + y * scale],
        clip: r,
      };
    },
    // Sur le circuit, c'est l'éditeur qui peint les traits, sous ses fils et ses portes.
    under: (anchor) => anchor === 'circuit' && !!editor && document.body.dataset.screen === 'circuit',
    onStrokes: () => { if (editor && document.body.dataset.screen === 'circuit') editor.draw(); },
  });
  function loadDrawing() {
    if (!save.drawings || typeof save.drawings !== 'object') save.drawings = {};
    const strokes = Array.isArray(save.drawings[drawKey()]) ? save.drawings[drawKey()] : [];
    // Les anciens traits du menu n'avaient pas d'accroche : ils sont rattachés à la zone qui
    // défile, en supposant le menu tout en haut (sous la barre du titre).
    const top = document.querySelector('.topbar').offsetHeight;
    drawLayer.load(strokes.filter((s) => s && Array.isArray(s.p)).map((s) => {
      if (typeof s.a === 'string') return { c: String(s.c), p: s.p.slice(), a: s.a };
      if (drawKey() !== 'menu') return { c: String(s.c), p: s.p.slice() };
      return { c: String(s.c), p: s.p.map((v, i) => (i % 2 ? v - top : v)), a: 'scroll:screen-menu' };
    }));
  }
  function setDrawing(on) {
    document.body.classList.toggle('drawing', on);
    $('draw-tools').classList.toggle('hidden', !on);
    $('draw-btn').classList.toggle('on', on);
    $('draw-btn').textContent = on ? '✓ Terminer' : '✎ Crayon';
    drawLayer.draw();
  }
  function setPen(color, eraser) {
    drawLayer.color = color;
    drawLayer.eraser = eraser;
    document.body.classList.toggle('erasing', eraser);
    let known = false;
    for (const b of document.querySelectorAll('#draw-colors .swatch[data-color]')) {
      b.classList.toggle('on', !eraser && b.dataset.color === color);
      if (b.dataset.color === color) known = true;
    }
    // Une couleur choisie au sélecteur : c'est lui qui s'allume, teint de cette couleur.
    const custom = document.querySelector('#draw-colors .swatch.custom');
    custom.classList.toggle('on', !eraser && !known);
    custom.style.background = known ? '' : color;
    $('draw-eraser').classList.toggle('on', eraser);
    drawLayer.draw();
  }
  for (const b of document.querySelectorAll('#draw-colors .swatch[data-color]')) {
    b.style.background = b.dataset.color === 'text' ? 'var(--text)' : b.dataset.color;
    b.addEventListener('click', () => setPen(b.dataset.color, false));
  }
  $('draw-custom').addEventListener('input', (e) => setPen(e.target.value, false));
  $('draw-btn').onclick = () => setDrawing(!document.body.classList.contains('drawing'));
  $('draw-eraser').onclick = () => setPen(drawLayer.color, !drawLayer.eraser);
  $('draw-undo').onclick = () => drawLayer.undo();
  $('draw-clear').onclick = () => drawLayer.clear();
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('drawing')) return;
    if (e.key === 'Escape') setDrawing(false);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); drawLayer.undo(); }
  });
  setPen('text', false);
  loadDrawing();

  // Bouton qui cache ou affiche tout l'énoncé ; le choix vaut pour tous les niveaux.
  function applyDescHidden() {
    for (const btn of document.querySelectorAll('.desc-toggle')) {
      $(btn.dataset.desc).classList.toggle('hidden', !!save.descHidden);
      btn.textContent = save.descHidden ? '▸ Afficher l\'énoncé' : '▾ Cacher l\'énoncé';
      btn.setAttribute('aria-expanded', String(!save.descHidden));
    }
  }
  for (const btn of document.querySelectorAll('.desc-toggle')) {
    btn.addEventListener('click', () => { save.descHidden = !save.descHidden; persist(); applyDescHidden(); });
  }
  applyDescHidden();

  // Panneau de l'énoncé : largeur réglable en glissant sa poignée, et repliable.
  // Les deux réglages valent pour tous les niveaux.
  const SIDE_MIN = 220;
  const narrow = window.matchMedia('(max-width: 860px)');
  const sideMax = () => Math.max(SIDE_MIN, Math.round(window.innerWidth * 0.7));
  function applySide() {
    const w = Math.min(sideMax(), Math.max(SIDE_MIN, Number(save.sideWidth) || 320));
    document.documentElement.style.setProperty('--side-w', w + 'px');
    document.body.classList.toggle('side-folded', !!save.sideFolded);
    for (const b of document.querySelectorAll('.side-fold')) {
      b.textContent = save.sideFolded ? (narrow.matches ? '▼' : '▶') : (narrow.matches ? '▲' : '◀');
      b.setAttribute('aria-label', save.sideFolded ? 'Déplier le panneau' : 'Replier le panneau');
      b.title = b.getAttribute('aria-label');
    }
  }
  const toggleSide = () => { save.sideFolded = !save.sideFolded; persist(); applySide(); };
  for (const r of document.querySelectorAll('.side-resizer')) {
    let drag = null;
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.side-fold') || save.sideFolded || narrow.matches) return;
      r.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, w: r.previousElementSibling.getBoundingClientRect().width };
      r.classList.add('dragging');
      document.body.classList.add('side-resizing');
    });
    r.addEventListener('pointermove', (e) => {
      if (!drag) return;
      save.sideWidth = Math.round(Math.min(sideMax(), Math.max(SIDE_MIN, drag.w + e.clientX - drag.x)));
      applySide();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      r.classList.remove('dragging');
      document.body.classList.remove('side-resizing');
      persist();
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', end);
    r.addEventListener('dblclick', (e) => { if (!e.target.closest('.side-fold')) toggleSide(); });
    r.querySelector('.side-fold').addEventListener('click', toggleSide);
  }
  window.addEventListener('resize', applySide);
  narrow.addEventListener('change', applySide);
  applySide();

  // Brouillon : notes libres du joueur, une par niveau, enregistrées avec la partie.
  function openNotes(prefix, lvl) {
    const box = $(prefix + '-notes-box');
    const area = $(prefix + '-notes');
    box.open = !save.notesClosed;
    area.value = save.notes[lvl.id] || '';
    area.oninput = () => {
      if (area.value) save.notes[lvl.id] = area.value;
      else delete save.notes[lvl.id];
      persist();
    };
    box.ontoggle = () => { save.notesClosed = !box.open; persist(); };
  }

  function openCircuit(lvl) {
    $('c-chapter').textContent = chapterTitle(lvl);
    $('c-verify').textContent = lvl.sandbox ? '▦ Table de vérité' : '✔ Vérifier';
    $('c-title').textContent = lvl.title;
    $('c-desc').innerHTML = lvl.desc + (lvl.sandbox ? '' : circuitGuide(lvl));
    $('c-tests').classList.toggle('hidden', !lvl.sandbox);
    $('c-builds').classList.toggle('hidden', !lvl.sandbox);
    openNotes('c', lvl);
    $('c-results').classList.add('hidden');
    document.querySelector('#screen-circuit .seq-only').classList.toggle('hidden', !lvl.sequential);

    const pal = $('c-palette');
    pal.innerHTML = '';
    if (lvl.sandbox) {
      for (const [type, label] of [['IN', 'Entrée'], ['OUT', 'Sortie']]) {
        const b = document.createElement('button');
        b.className = 'pal-item io';
        b.innerHTML = `<b>${label}</b><small>${type === 'IN' ? '0→1' : '1→0'}</small>`;
        b.title = 'Ajouter une ' + label.toLowerCase();
        b.addEventListener('click', () => editor.addIO(type));
        pal.appendChild(b);
      }
    }
    if (lvl.sandbox) refreshCustoms();
    for (const type of paletteFor(lvl)) {
      const def = COMPONENTS[type];
      const b = document.createElement('button');
      b.className = 'pal-item' + (def.stateful ? ' stateful' : '');
      b.innerHTML = `<b>${esc(def.label)}</b><small>${def.inputs.length}→${def.outputs.length}</small>`;
      b.title = 'Ajouter ' + def.label;
      b.addEventListener('click', () => editor.addComponent(type));
      pal.appendChild(b);
    }
    if (lvl.sandbox) appendCustomPalette(pal);

    let circuit = save.circuits[lvl.id];
    if (!circuit || !validCircuit(circuit, lvl)) circuit = lvl.sandbox ? { components: [], wires: [], tests: [] } : window.initialCircuit(lvl);
    else circuit = JSON.parse(JSON.stringify(circuit));

    show('circuit');
    editor = new window.CircuitEditor($('c-canvas'), {
      level: lvl,
      circuit,
      onChange: (c) => {
        save.circuits[lvl.id] = c;
        persist();
        if (lvl.sandbox) refreshSandbox();
      },
      onSim: updateCircuitStatus,
      onMessage: showToast,
      symbols: !!save.symbols,
      freeIO: !!lvl.sandbox,
      onDraw: () => drawLayer.draw(),
      underlay: (ctx, scale) => drawLayer.paint(ctx, 'circuit', scale),
    });
    drawLayer.draw();
    if (lvl.sandbox) refreshSandbox();
  }

  // ------------------------------------------------- Tests du bac à sable
  // Chaque ligne fixe une valeur par entrée et la valeur attendue de chaque sortie,
  // rangées par identifiant de composant : renommer ou déplacer une entrée ne casse rien.

  const ioOf = (type) => editor.circuit.components.filter((c) => c.type === type).sort((p, q) => p.idx - q.idx);
  const sandboxTests = () => {
    if (!Array.isArray(editor.circuit.tests)) editor.circuit.tests = [];
    return editor.circuit.tests;
  };
  const saveTests = () => { save.circuits[SANDBOX.id] = editor.circuit; persist(); refreshSandbox(); };
  function refreshSandbox() {
    renderSandboxTests();
    renderBuilds();
  }

  function renderSandboxTests() {
    const ins = ioOf('IN');
    const outs = ioOf('OUT');
    const tests = sandboxTests();
    let html = '<h4>Batterie de tests</h4>';
    if (!ins.length || !outs.length) {
      $('c-tests').innerHTML = html + '<p class="muted-note">Place au moins une Entrée et une Sortie pour écrire des tests.</p>';
      return;
    }
    html += '<p class="muted-note">Une ligne = une combinaison d\'entrées et les sorties que tu attends. Clique sur une case pour passer de 0 à 1.</p>';
    if (tests.length) {
      html += '<div class="table-scroll"><table class="truth tests-edit"><thead><tr>';
      ins.forEach((c) => { html += `<th class="in">${esc(c.name)}</th>`; });
      outs.forEach((c) => { html += `<th class="exp">${esc(c.name)}</th>`; });
      html += '<th></th></tr></thead><tbody>';
      tests.forEach((t, r) => {
        html += '<tr>';
        ins.forEach((c) => { html += `<td class="in"><button data-row="${r}" data-side="in" data-id="${esc(c.id)}">${t.in[c.id] ? 1 : 0}</button></td>`; });
        outs.forEach((c) => { html += `<td class="exp"><button data-row="${r}" data-side="out" data-id="${esc(c.id)}">${t.out[c.id] ? 1 : 0}</button></td>`; });
        html += `<td><button class="link danger" data-del="${r}" title="Supprimer cette ligne">×</button></td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += `<div class="tests-actions">
      <button id="t-add">+ Ligne</button>
      <button id="t-all" title="Une ligne pour chaque combinaison des entrées (les lignes déjà écrites sont gardées)">Toutes les combinaisons</button>
      ${tests.length ? '<button class="primary" id="t-run">▶ Lancer les tests</button>' : ''}
    </div>`;
    $('c-tests').innerHTML = html;
  }

  $('c-tests').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !editor) return;
    const tests = sandboxTests();
    if (b.dataset.row != null) {
      const t = tests[+b.dataset.row];
      t[b.dataset.side][b.dataset.id] = t[b.dataset.side][b.dataset.id] ? 0 : 1;
      saveTests();
    } else if (b.dataset.del != null) {
      tests.splice(+b.dataset.del, 1);
      saveTests();
    } else if (b.id === 't-add') {
      tests.push({ in: {}, out: {} });
      saveTests();
    } else if (b.id === 't-all') {
      const ins = ioOf('IN');
      if (ins.length > MAX_TABLE_INPUTS) {
        showToast(`Avec ${ins.length} entrées, il y aurait ${2 ** ins.length} combinaisons : ajoute plutôt tes lignes une par une avec « + Ligne ».`);
        return;
      }
      const key = (t) => ins.map((c) => (t.in[c.id] ? 1 : 0)).join('');
      const known = new Map(tests.map((t) => [key(t), t]));
      const rows = [];
      for (let n = 0; n < 1 << ins.length; n++) {
        const t = { in: {}, out: {} };
        ins.forEach((c, k) => { t.in[c.id] = (n >> (ins.length - 1 - k)) & 1; });
        rows.push(known.get(key(t)) || t);
      }
      tests.splice(0, tests.length, ...rows);
      saveTests();
    } else if (b.id === 't-run') {
      runSandboxTests();
    }
  });

  // ------------------------------------------- Constructions du bac à sable
  // Chaque construction enregistrée garde un nom et une copie du circuit, tests compris.
  // Le bac à sable continue de garder tout seul le travail en cours.

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const builds = () => {
    if (!save.builds || typeof save.builds !== 'object' || Array.isArray(save.builds)) save.builds = {};
    return save.builds;
  };
  const currentBuild = () => builds()[save.currentBuild] || null;
  // Sélectionner un composant le fait passer au premier plan : on compare donc sans tenir compte de l'ordre.
  const sameCircuit = (a, b) => {
    const norm = (c) => JSON.stringify({
      components: c.components.slice().sort((p, q) => String(p.id).localeCompare(String(q.id))),
      wires: c.wires.map((w) => `${w.from.c}.${w.from.p}>${w.to.c}.${w.to.p}`).sort(),
      tests: c.tests || [],
    });
    return norm(a) === norm(b);
  };
  const unsaved = () => {
    const b = currentBuild();
    return b ? !sameCircuit(b.circuit, editor.circuit) : editor.circuit.components.length > 0;
  };

  // Les constructions enregistrées deviennent des composants « U:<id> » du bac à sable.
  function refreshCustoms() { setCustoms(builds()); }

  // Vrai si la construction `id` utilise `target`, directement ou à travers une autre.
  function buildUses(id, target, seen = new Set()) {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const item = builds()[id];
    return !!item && item.circuit.components.some((c) => String(c.type).startsWith('U:') && buildUses(c.type.slice(2), target, seen));
  }

  function appendCustomPalette(pal) {
    const list = Object.entries(builds()).sort((p, q) => p[1].name.localeCompare(q[1].name));
    const head = document.createElement('div');
    head.className = 'pal-head';
    head.textContent = 'Mes constructions';
    pal.appendChild(head);
    if (!list.length) {
      const note = document.createElement('p');
      note.className = 'pal-note';
      note.textContent = 'Enregistre une construction : elle apparaîtra ici, prête à être posée comme un composant.';
      pal.appendChild(note);
      return;
    }
    for (const [id, item] of list) {
      // On ne pose pas une construction dans elle-même (ni dans une construction qu'elle contient).
      if (save.currentBuild && buildUses(id, save.currentBuild)) continue;
      const def = getDef('U:' + id);
      const b = document.createElement('button');
      b.className = 'pal-item custom' + (def.hasState ? ' stateful' : '');
      b.innerHTML = `<b>${esc(item.name)}</b><small>${def.inputs.length}→${def.outputs.length}</small>`;
      b.title = `Ajouter « ${item.name} » (${def.cost} NAND)`;
      b.addEventListener('click', () => {
        if (!def.inputs.length && !def.outputs.length) {
          showToast(`« ${item.name} » n'a ni entrée ni sortie : ajoute-lui des Entrées et des Sorties pour la réutiliser.`);
          return;
        }
        editor.addComponent('U:' + id);
      });
      pal.appendChild(b);
    }
  }

  // Après un enregistrement, un renommage ou une suppression : définitions et palette à jour.
  function buildsChanged() {
    persist();
    refreshCustoms();
    const pal = $('c-palette');
    pal.querySelectorAll('.pal-head, .pal-note, .pal-item.custom').forEach((el) => el.remove());
    appendCustomPalette(pal);
    editor.recompile();
    renderBuilds();
  }

  function renderBuilds() {
    const b = currentBuild();
    const status = unsaved() ? '<span class="build-dirty">• modifications non enregistrées</span>'
      : b ? '<span class="build-ok">✓ enregistrée</span>' : '';
    let html = '<h4>Mes constructions</h4>'
      + `<p class="build-current">${b ? `<b>${esc(b.name)}</b>` : '<i>Construction sans nom</i>'} ${status}</p>`
      + `<div class="tests-actions">
        <button class="primary" id="b-save">💾 Enregistrer</button>
        <button id="b-saveas">Enregistrer sous…</button>
        <button id="b-new">+ Nouvelle</button>
      </div>`;
    const list = Object.entries(builds()).sort((p, q) => p[1].name.localeCompare(q[1].name));
    if (list.length) {
      html += '<ul class="build-list">' + list.map(([id, item]) => `<li class="${id === save.currentBuild ? 'current' : ''}">
        <button class="build-open" data-open="${esc(id)}" title="Ouvrir">${esc(item.name)}</button>
        <button class="link" data-rename="${esc(id)}" title="Renommer">✎</button>
        <button class="link danger" data-remove="${esc(id)}" title="Supprimer">×</button></li>`).join('') + '</ul>';
    }
    $('c-builds').innerHTML = html;
  }

  function askBuildName(initial, exceptId) {
    const answer = window.prompt('Nom de la construction :', initial);
    if (answer == null) return null;
    const name = answer.trim().slice(0, 40);
    if (!name) return null;
    const clash = Object.entries(builds()).find(([id, item]) => id !== exceptId && item.name === name);
    return { name, clash: clash ? clash[0] : null };
  }

  function saveBuildAs() {
    const b = currentBuild();
    const res = askBuildName(b ? b.name : 'Ma construction', null);
    if (!res) return;
    let id = res.clash;
    if (id && id !== save.currentBuild && !confirm(`Une construction s'appelle déjà « ${res.name} ». La remplacer ?`)) return;
    if (!id) id = 'b' + Date.now().toString(36);
    builds()[id] = { name: res.name, circuit: clone(editor.circuit), updated: Date.now() };
    save.currentBuild = id;
    showToast(`« ${res.name} » est enregistrée.`);
    buildsChanged();
  }

  // Remplace le circuit du bac à sable, après accord si le travail en cours n'est pas enregistré.
  function loadSandbox(circuit, buildId) {
    if (unsaved() && !confirm('Les modifications non enregistrées de cette construction seront perdues. Continuer ?')) return;
    save.currentBuild = buildId;
    save.circuits[SANDBOX.id] = clone(circuit);
    persist();
    openLevel(SANDBOX);
  }

  $('c-builds').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !editor) return;
    if (b.id === 'b-save') {
      const item = currentBuild();
      if (!item) { saveBuildAs(); return; }
      item.circuit = clone(editor.circuit);
      item.updated = Date.now();
      showToast(`« ${item.name} » est enregistrée.`);
      buildsChanged();
    } else if (b.id === 'b-saveas') {
      saveBuildAs();
    } else if (b.id === 'b-new') {
      loadSandbox({ components: [], wires: [], tests: [] }, null);
    } else if (b.dataset.open) {
      const item = builds()[b.dataset.open];
      if (item && b.dataset.open !== save.currentBuild) loadSandbox(item.circuit, b.dataset.open);
    } else if (b.dataset.rename) {
      const item = builds()[b.dataset.rename];
      const res = item && askBuildName(item.name, b.dataset.rename);
      if (!res) return;
      if (res.clash) { showToast(`Le nom « ${res.name} » est déjà pris.`); return; }
      item.name = res.name;
      buildsChanged();
    } else if (b.dataset.remove) {
      const id = b.dataset.remove;
      const item = builds()[id];
      if (!item) return;
      const users = Object.entries(builds()).filter(([other]) => other !== id && buildUses(other, id)).map(([, o]) => `« ${o.name} »`);
      const warn = users.length ? `\nElle est utilisée dans ${users.join(', ')} : ces blocs ne fonctionneront plus.` : '';
      if (!confirm(`Supprimer la construction « ${item.name} » ?${warn}`)) return;
      delete builds()[id];
      if (save.currentBuild === id) save.currentBuild = null;
      buildsChanged();
    }
  });

  function runSandboxTests() {
    const ins = ioOf('IN');
    const outs = ioOf('OUT');
    const lvl = {
      inputs: ins.map((c) => c.name), outputs: outs.map((c) => c.name),
      tests: sandboxTests().map((t) => ({ steps: [{ in: ins.map((c) => (t.in[c.id] ? 1 : 0)), out: outs.map((c) => (t.out[c.id] ? 1 : 0)) }] })),
    };
    renderCircuitResults(lvl, verifyCircuit(lvl, editor.circuit));
  }

  // Le presse-papiers moderne n'existe qu'en contexte sécurisé (https ou localhost) :
  // ailleurs, on copie le texte d'une zone de saisie posée hors de l'écran. Ce second
  // moyen marche tant qu'il suit directement le clic.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => copyByTextarea(text));
    }
    return copyByTextarea(text);
  }
  function copyByTextarea(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    Object.assign(area.style, { position: 'fixed', top: '-1000px', left: '0', opacity: '0' });
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copie refusée'));
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
      // Dans le bac à sable, les constructions du joueur (« U:… ») sont aussi permises.
      const ok = (o) => allowed.has(o.type) || (lvl.sandbox && String(o.type).startsWith('U:'));
      if (!c.components.every(ok)) return false;
      if (lvl.sandbox) return Array.isArray(c.wires);
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
    if (lvl.sandbox) { renderTruthTable(lvl, truthTableOf(lvl, editor.circuit)); return; }
    const res = verifyCircuit(lvl, editor.circuit);
    renderCircuitResults(lvl, res);
    if (res.ok) {
      const cost = circuitCost(editor.circuit).nand;
      complete(lvl, cost, `Ton circuit coûte <b>${cost}</b> porte${cost > 1 ? 's' : ''} NAND.`);
    }
  };
  $('c-tick').onclick = () => editor.tick();
  $('c-reset-state').onclick = () => editor.resetState();
  // Mode « symboles » : AND, OR, NOT… dessinés comme dans les manuels. Le choix vaut pour tous les niveaux.
  function applySymbols() {
    $('c-symbols').classList.toggle('on', !!save.symbols);
    $('c-symbols').setAttribute('aria-pressed', String(!!save.symbols));
    if (editor) editor.setSymbols(!!save.symbols);
  }
  $('c-symbols').onclick = () => { save.symbols = !save.symbols; persist(); applySymbols(); };
  applySymbols();

  // Copie directe ; si le navigateur refuse, la fenêtre montre le texte à copier à la main.
  $('c-copy').onclick = () => {
    const text = describeCircuit(current, editor.circuit);
    copyText(text).then(
      () => showToast('📋 Schéma copié : colle-le où tu veux avec Ctrl+V.'),
      () => {
        $('copy-text').value = text;
        $('copy-msg').textContent = 'Ton navigateur a refusé la copie automatique : sélectionne le texte et fais Ctrl+C.';
        $('copy-msg').className = 'copy-msg bad';
        $('copy-modal').classList.remove('hidden');
        $('copy-text').focus();
        $('copy-text').select();
      },
    );
  };
  $('copy-do').onclick = () => {
    const area = $('copy-text');
    copyText(area.value).then(
      () => {
        $('copy-msg').textContent = 'Copié ✓ Colle-le où tu veux avec Ctrl+V.';
        $('copy-msg').className = 'copy-msg good';
      },
      () => {
        $('copy-msg').textContent = 'Ton navigateur bloque la copie : le texte est sélectionné, fais Ctrl+C.';
        $('copy-msg').className = 'copy-msg bad';
      },
    ).finally(() => { area.focus(); area.select(); });
  };
  $('copy-close').onclick = () => $('copy-modal').classList.add('hidden');
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

  function renderTruthTable(lvl, res) {
    const box = $('c-results');
    box.classList.remove('hidden');
    if (res.error) {
      box.innerHTML = closeBtn + `<div class="verdict bad">✘ ${esc(res.error)}</div>`;
      return;
    }
    if (!res.inputs.length || !res.outputs.length) {
      box.innerHTML = closeBtn + '<div class="verdict">Câble au moins une Entrée et une Sortie pour voir la table.</div>';
      return;
    }
    if (res.tooMany) {
      const n = res.inputs.length;
      box.innerHTML = closeBtn + `<div class="verdict">Ton circuit a ${n} entrées câblées : sa table complète aurait ${(2 ** n).toLocaleString('fr-FR')} lignes.</div>`
        + `<p class="truth-note">La table s'affiche jusqu'à ${MAX_TABLE_INPUTS} entrées. Au-delà, vérifie les cas qui t'intéressent avec la batterie de tests.</p>`;
      return;
    }
    let html = `<div class="verdict">▦ Table de vérité de ton circuit (${res.rows.length} lignes)</div>`;
    if (res.stateful) html += '<p class="truth-note">Ton circuit a de la mémoire : chaque ligne part des mémoires à 0. Utilise ⏵ Tick pour voir son évolution.</p>';
    html += '<div class="table-scroll"><table class="truth"><thead><tr>';
    res.inputs.forEach((i) => { html += `<th class="in">${esc(lvl.inputs[i])}</th>`; });
    res.outputs.forEach((i) => { html += `<th>${esc(lvl.outputs[i])}</th>`; });
    html += '</tr></thead><tbody>';
    for (const r of res.rows) {
      html += '<tr>' + r.in.map((v) => `<td class="in">${v}</td>`).join('')
        + r.out.map((v) => `<td class="${v ? 'ok' : ''}">${v}</td>`).join('') + '</tr>';
    }
    box.innerHTML = closeBtn + html + '</tbody></table></div>';
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
    openNotes('a', lvl);
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
  $('sandbox-btn').onclick = () => openLevel(SANDBOX);
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
    return {
      done: obj(data.done), circuits: obj(data.circuits), programs: obj(data.programs), notes: obj(data.notes), drawings: obj(data.drawings),
      free: !!data.free, notesClosed: !!data.notesClosed, descHidden: !!data.descHidden, symbols: !!data.symbols,
      sideWidth: Number(data.sideWidth) || undefined, sideFolded: !!data.sideFolded,
      builds: obj(data.builds), currentBuild: typeof data.currentBuild === 'string' ? data.currentBuild : null,
    };
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
      applyDescHidden();
      applySymbols();
      applySide();
      loadDrawing();
      saveMessage('Sauvegarde importée : ' + n + ' niveaux réussis.', true);
    } catch (err) {
      saveMessage('Impossible d\'importer : ' + err.message + '.', false);
    }
  });

  $('reset-progress').onclick = () => {
    if (!confirm('Effacer toute la progression, les circuits, les programmes, les brouillons, les dessins et les constructions ?')) return;
    save = { done: {}, circuits: {}, programs: {}, notes: {}, drawings: {}, free: false };
    persist();
    renderMenu();
    applyDescHidden();
    applySymbols();
    applySide();
    loadDrawing();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) hideModal();
    if (e.key === 'Escape') $('copy-modal').classList.add('hidden');
  });

  // Accès pour le débogage depuis la console du navigateur.
  window.game = { get editor() { return editor; }, get level() { return current; } };

  function route() {
    const id = location.hash.slice(1);
    if (current && current.id === id) return;
    const lvl = id === SANDBOX.id ? SANDBOX : LEVELS.find((l) => l.id === id);
    if (lvl && (lvl.sandbox || isUnlocked(lvl))) openLevel(lvl);
    else if (current || document.body.dataset.screen !== 'menu') goMenu();
  }
  window.addEventListener('hashchange', () => { hideModal(); route(); });
  updateProgress(); // aussi quand la page s'ouvre directement sur un niveau
  route();
})();
