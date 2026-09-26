/* ============================================================================
   Swara Player — public playback client

   Playback only: no editing, no uploads, no project files. Songs arrive from
   the page as build-validated text, so the parser here never meets a song that
   has not already been checked.
   ========================================================================= */
import E from '../../lib/swara/engine.js';

const $ = (id) => document.getElementById(id);

const state = {
  songs: [],
  index: 0,
  source: '',
  title: '',
  bpm: 60,
  subdivisionsPerBeat: 4,
  beatsPerCycle: 8,
  beatGroups: [4, 2, 2],
  metronome: true,
  subClick: false,
  loopMode: 'off',
  layout: 'written',
  tonicKey: 'C',
  tonicOctave: 4,
  tonicHz: 261.63,
  raga: 'Chromatic (all swaras)',
  volMaster: 0.85,
  volPiano: 0.8,
  volClick: 0.5,
  selection: { start: null, end: null }
};

let parsed = null, timingInfo = null, ticks = [];

/* ------------------------------------------------------------------ audio */
let actx = null, busMaster = null, busPiano = null, busClick = null;
let voices = [];

function ensureAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return actx; }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  actx = new Ctor();
  busMaster = actx.createGain();
  busPiano = actx.createGain();
  busClick = actx.createGain();
  busPiano.connect(busMaster);
  busClick.connect(busMaster);
  busMaster.connect(actx.destination);
  applyVolumes();
  return actx;
}

function applyVolumes() {
  if (!actx) return;
  busMaster.gain.value = state.volMaster;
  busPiano.gain.value = state.volPiano;
  busClick.gain.value = state.volClick * 0.6;
}

const HARMONICS = [
  { ratio: 1, gain: 1.0, type: 'triangle' },
  { ratio: 2, gain: 0.42, type: 'sine' },
  { ratio: 3, gain: 0.2, type: 'sine' },
  { ratio: 4.01, gain: 0.1, type: 'sine' },
  { ratio: 6, gain: 0.04, type: 'sine' }
];

function playNote(freq, when, dur) {
  if (!actx || !isFinite(freq) || freq <= 0) return;
  const start = Math.max(when, actx.currentTime + 0.001);
  const length = Math.max(0.06, dur - (start - when));
  const out = actx.createGain();
  const filt = actx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 0.6;
  filt.frequency.setValueAtTime(Math.min(9000, freq * 9), start);
  filt.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 3), start + Math.min(1.2, length * 0.8) + 0.05);
  filt.connect(out);
  out.connect(busPiano);

  const peak = 0.32;
  const g = out.gain;
  g.setValueAtTime(0.0001, start);
  g.linearRampToValueAtTime(peak, start + 0.012);
  g.exponentialRampToValueAtTime(peak * 0.55, start + Math.min(0.45, length * 0.6));
  g.setTargetAtTime(peak * 0.34, start + Math.min(0.45, length * 0.6), 0.6);
  const release = start + length;
  g.setTargetAtTime(0.0001, release, 0.05);

  const oscs = [];
  HARMONICS.forEach((h) => {
    const osc = actx.createOscillator();
    osc.type = h.type;
    osc.frequency.setValueAtTime(freq * h.ratio, start);
    const hg = actx.createGain();
    hg.gain.value = h.gain;
    osc.connect(hg); hg.connect(filt);
    osc.start(start);
    osc.stop(release + 0.35);
    oscs.push(osc);
  });
  voices.push({ out, oscs, end: release + 0.35 });
  if (voices.length > 64) voices = voices.filter((v) => v.end > actx.currentTime - 0.5);
}

const CLICKS = {
  cycle: { freq: 1500, gain: 0.5, len: 0.055 },
  group: { freq: 1100, gain: 0.34, len: 0.045 },
  beat: { freq: 900, gain: 0.26, len: 0.04 },
  finger: { freq: 2200, gain: 0.22, len: 0.025, type: 'triangle' },   // laghu counts
  wave: { freq: 520, gain: 0.3, len: 0.07, type: 'sine' },            // drutam wave
  sub: { freq: 640, gain: 0.1, len: 0.028 }
};

function playClick(kind, when) {
  if (!actx) return;
  const c = CLICKS[kind] || CLICKS.beat;
  const start = Math.max(when, actx.currentTime + 0.001);
  const osc = actx.createOscillator();
  const g = actx.createGain();
  osc.type = c.type || 'square';
  osc.frequency.setValueAtTime(c.freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(c.gain, start + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, start + c.len);
  osc.connect(g); g.connect(busClick);
  osc.start(start); osc.stop(start + c.len + 0.02);
}

function stopAllVoices() {
  if (!actx) return;
  const now = actx.currentTime;
  voices.forEach((v) => {
    try {
      v.out.gain.cancelScheduledValues(now);
      v.out.gain.setTargetAtTime(0.0001, now, 0.015);
      v.oscs.forEach((o) => { try { o.stop(now + 0.1); } catch (e) {} });
    } catch (e) {}
  });
  voices = [];
}

/* -------------------------------------------------------------- transport */
const transport = {
  status: 'stopped',
  origin: 0,
  uiOrigin: 0,
  pendingOrigins: [],
  eventPtr: 0,
  tickPtr: 0,
  pausedAt: 0,
  timer: null,
  raf: null,
  endAt: null
};
const LOOKAHEAD = 0.25, INTERVAL = 25;

const schedule = () => (timingInfo ? timingInfo.schedule : []);

function loopBounds() {
  const sch = schedule();
  if (!sch.length) return null;
  const sps = timingInfo.secondsPerNoteSpace;
  if (state.loopMode === 'song') return { start: 0, end: parsed.totalSpaces * sps };
  if (state.loopMode === 'selection' && state.selection.start !== null) {
    const end = state.selection.end === null ? state.selection.start : state.selection.end;
    const a = Math.min(state.selection.start, end);
    const b = Math.max(state.selection.start, end);
    return { start: sch[a].startTime, end: sch[b].startTime + sch[b].duration };
  }
  if (state.loopMode === 'section') {
    const idx = Math.min(transport.eventPtr, sch.length - 1);
    const sec = sch[idx] ? sch[idx].event.section : '';
    let first = null, last = null;
    sch.forEach((s, i) => { if (s.event.section === sec) { if (first === null) first = i; last = i; } });
    if (first === null) return null;
    return { start: sch[first].startTime, end: sch[last].startTime + sch[last].duration };
  }
  return null;
}

function firstEventAtOrAfter(t) {
  const sch = schedule();
  for (let i = 0; i < sch.length; i++) if (sch[i].startTime >= t - 1e-9) return i;
  return sch.length;
}
function firstTickAtOrAfter(t) {
  for (let i = 0; i < ticks.length; i++) if (ticks[i].time >= t - 1e-9) return i;
  return ticks.length;
}

function buildTicks() {
  ticks = [];
  if (!parsed || !timingInfo) return;
  const grid = E.metronomeGrid(Math.ceil(parsed.totalSpaces), {
    subdivisionsPerBeat: state.subdivisionsPerBeat,
    beatsPerCycle: state.beatsPerCycle,
    beatGroups: state.beatGroups
  });
  const sps = timingInfo.secondsPerNoteSpace;
  grid.forEach((t) => ticks.push({ time: t.space * sps, kind: t.kind, space: t.space }));
}

function play(fromIndex) {
  if (!parsed || !schedule().length) return;
  if (!ensureAudio()) return;
  if (transport.status === 'playing') return;

  const sch = schedule();
  let startTime;
  if (transport.status === 'paused') {
    startTime = transport.pausedAt;
  } else {
    let idx = typeof fromIndex === 'number' ? fromIndex
      : (state.selection.start !== null ? state.selection.start : 0);
    idx = Math.max(0, Math.min(idx, sch.length - 1));
    startTime = sch[idx].startTime;
  }

  transport.origin = actx.currentTime + 0.12 - startTime;
  transport.uiOrigin = transport.origin;
  transport.pendingOrigins = [];
  let sIdx = sch.length;
  for (let i = 0; i < sch.length; i++) {
    if (sch[i].startTime + sch[i].duration > startTime + 1e-9) { sIdx = i; break; }
  }
  transport.eventPtr = sIdx;
  transport.tickPtr = firstTickAtOrAfter(startTime);
  transport.endAt = null;
  transport.status = 'playing';

  transport.timer = setInterval(schedulerTick, INTERVAL);
  schedulerTick();
  startUiLoop();
  syncTransportUi();
}

function schedulerTick() {
  if (transport.status !== 'playing') return;
  const sch = schedule();
  const horizon = actx.currentTime + LOOKAHEAD;
  const loop = state.loopMode !== 'off' ? loopBounds() : null;
  const endT = loop ? loop.end : timingInfo.totalSeconds;
  let guard = 0;

  while (guard++ < 200) {
    while (transport.eventPtr < sch.length &&
           sch[transport.eventPtr].startTime < endT - 1e-9 &&
           transport.origin + sch[transport.eventPtr].startTime < horizon) {
      const s = sch[transport.eventPtr];
      if (s.event.valid && s.event.semitone !== null) {
        playNote(E.frequencyOf(state.tonicHz, s.event.semitone, s.event.octave),
          transport.origin + s.startTime, s.duration);
      }
      transport.eventPtr++;
    }
    while (transport.tickPtr < ticks.length &&
           ticks[transport.tickPtr].time < endT - 1e-9 &&
           transport.origin + ticks[transport.tickPtr].time < horizon) {
      const tk = ticks[transport.tickPtr];
      if (state.metronome && (tk.kind !== 'sub' || state.subClick)) {
        playClick(tk.kind, transport.origin + tk.time);
      }
      transport.tickPtr++;
    }
    const eventsDone = transport.eventPtr >= sch.length || sch[transport.eventPtr].startTime >= endT - 1e-9;
    const ticksDone = transport.tickPtr >= ticks.length || ticks[transport.tickPtr].time >= endT - 1e-9;
    if (eventsDone && ticksDone && transport.origin + endT < horizon) {
      if (loop) {
        const applyAt = transport.origin + endT;
        transport.origin += (endT - loop.start);
        transport.pendingOrigins.push({ applyAt, origin: transport.origin });
        transport.eventPtr = firstEventAtOrAfter(loop.start);
        transport.tickPtr = firstTickAtOrAfter(loop.start);
        continue;
      }
      transport.endAt = transport.origin + endT + 0.35;
      break;
    }
    break;
  }

  if (transport.endAt !== null && actx.currentTime >= transport.endAt) stop(true);
}

function pause() {
  if (transport.status !== 'playing') return;
  transport.pausedAt = actx.currentTime - transport.uiOrigin;
  clearInterval(transport.timer); transport.timer = null;
  stopAllVoices();
  transport.status = 'paused';
  syncTransportUi();
}

function stop(ended) {
  clearInterval(transport.timer); transport.timer = null;
  if (transport.raf) cancelAnimationFrame(transport.raf);
  transport.raf = null;
  stopAllVoices();
  transport.status = 'stopped';
  transport.pausedAt = 0;
  transport.endAt = null;
  transport.pendingOrigins = [];
  clearHighlights();
  updateReadout(null);
  $('spNow').textContent = ended ? 'Finished' : 'Ready';
  syncTransportUi();
}

function syncTransportUi() {
  const playing = transport.status === 'playing';
  const btn = $('spPlay');
  btn.textContent = playing ? '❚❚ Pause' : (transport.status === 'paused' ? '▶ Resume' : '▶ Play');
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  const metro = $('spMetro');
  metro.classList.toggle('on', state.metronome);
  metro.setAttribute('aria-pressed', state.metronome ? 'true' : 'false');
  const subs = $('spSubMini');
  subs.classList.toggle('on', state.subClick);
  subs.setAttribute('aria-pressed', state.subClick ? 'true' : 'false');
}

/* ------------------------------------------------------------ UI updates */
let lastActive = -1, lastPassageEl = null;

function startUiLoop() {
  if (transport.raf) cancelAnimationFrame(transport.raf);
  const frame = () => {
    if (transport.status !== 'playing') return;
    while (transport.pendingOrigins.length && actx.currentTime >= transport.pendingOrigins[0].applyAt) {
      transport.uiOrigin = transport.pendingOrigins.shift().origin;
    }
    updateFromTime(actx.currentTime - transport.uiOrigin);
    transport.raf = requestAnimationFrame(frame);
  };
  transport.raf = requestAnimationFrame(frame);
}

function updateFromTime(songTime) {
  const sch = schedule();
  if (songTime < 0) return;
  let idx = -1;
  for (let i = 0; i < sch.length; i++) {
    if (sch[i].startTime <= songTime + 1e-6 && songTime < sch[i].startTime + sch[i].duration - 1e-9) { idx = i; break; }
    if (sch[i].startTime > songTime) break;
  }
  if (idx === -1 && sch.length) {
    for (let j = sch.length - 1; j >= 0; j--) { if (sch[j].startTime <= songTime) { idx = j; break; } }
  }
  if (idx !== lastActive) { highlight(idx); lastActive = idx; }
  updateReadout(idx, songTime);
}

function clearHighlights() {
  document.querySelectorAll('.sp-cell.active, .sp-gl-cell.active, .sp-gl-syl.active')
    .forEach((n) => n.classList.remove('active'));
  lastActive = -1;
}

function highlight(idx) {
  clearHighlights();
  if (idx < 0) return;
  const ev = schedule()[idx].event;
  if (state.layout === 'cycle') {
    const cells = document.querySelectorAll(`.sp-gl-cell[data-index="${idx}"]`);
    cells.forEach((c) => c.classList.add('active'));
    if (ev.sahityaId) {
      const syl = document.querySelector(`.sp-gl-syl[data-token="${ev.sahityaId}"]`);
      if (syl) syl.classList.add('active');
    }
    if (cells[0]) {
      const r = cells[0].getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight - 120) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        cells[0].scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      }
    }
    return;
  }
  const cell = document.querySelector(`.sp-cell.swara[data-index="${idx}"]`);
  if (!cell) return;
  cell.classList.add('active');
  if (ev.sahityaId) {
    const syl = document.querySelector(`.sp-cell.sahitya[data-token="${ev.sahityaId}"]`);
    if (syl) syl.classList.add('active');
  }
  const container = cell.closest('.sp-passage');
  if (!container) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = cell.offsetLeft - container.clientWidth / 2 + cell.offsetWidth / 2;
  try { container.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' }); }
  catch (e) { container.scrollLeft = target; }
  if (container !== lastPassageEl) {
    lastPassageEl = container;
    const r = container.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight - 120) {
      container.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    }
  }
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function updateReadout(idx, songTime) {
  const sch = schedule();
  const total = timingInfo ? timingInfo.totalSeconds : 0;
  const s = idx !== null && idx >= 0 && sch[idx] ? sch[idx] : null;
  const ev = s ? s.event : null;
  const stats = [
    ['Section', ev && ev.section ? ev.section : '—'],
    ['Cycle', s ? s.cycle + 1 : '—'],
    ['Beat', s ? `${s.beatInCycle + 1}/${state.beatsPerCycle}` : '—'],
    ['Swara', ev ? (ev.isRest ? 'rest' : E.displaySwara(ev)) : '—'],
    ['Elapsed', `${fmtTime(songTime || 0)} / ${fmtTime(total)}`]
  ];
  $('spReadout').replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement('div');
    box.className = 'sp-stat';
    const b = document.createElement('b');
    b.textContent = label;
    const v = document.createElement('span');
    v.textContent = String(value);
    box.append(b, v);
    return box;
  }));
  const pct = total > 0 ? Math.max(0, Math.min(100, ((songTime || 0) / total) * 100)) : 0;
  $('spProgress').style.width = pct + '%';
  if (ev) $('spNow').textContent = `${E.displaySwara(ev)}  ${ev.sahitya || ''}`;
}

/* -------------------------------------------------------------- rendering */
const UNIT = 48;

function renderScore() {
  const host = $('spScore');
  host.replaceChildren();
  if (!parsed || !parsed.rows.length) return;

  const globalIndex = {};
  parsed.events.forEach((e, i) => { globalIndex[e.id] = i; });
  const loop = state.selection.start !== null && state.selection.end !== null
    ? { a: Math.min(state.selection.start, state.selection.end), b: Math.max(state.selection.start, state.selection.end) }
    : null;

  parsed.rows.forEach((row) => {
    if (row.type === 'section') {
      const h = document.createElement('div');
      h.className = 'sp-section';
      h.textContent = row.name;
      host.appendChild(h);
      return;
    }
    if (row.type === 'text') {
      if (row.role === 'meta') return;     // header lines belong in the strip, not the score
      /* A line the parser could not pair — shown rather than silently dropped,
         so nothing in the song disappears from the page. */
      const plain = document.createElement('div');
      plain.className = 'sp-plain';
      plain.textContent = row.text;
      host.appendChild(plain);
      return;
    }
    if (row.type !== 'passage') return;

    const columns = [];
    row.events.forEach((e) => columns.push({ kind: 'event', at: e.sourceStartColumn, event: e }));
    row.marks.forEach((m) => columns.push({ kind: 'bar', at: m.column, mark: m }));
    columns.sort((a, b) => a.at - b.at);

    const tokenByEvent = {};
    row.sahityaTokens.forEach((t) => { if (t.anchorEventId) tokenByEvent[t.anchorEventId] = t; });

    const passage = document.createElement('div');
    passage.className = 'sp-passage';
    const inner = document.createElement('div');
    inner.className = 'sp-passage-inner';
    const swaraLine = document.createElement('div');
    swaraLine.className = 'sp-line';
    const sahityaLine = document.createElement('div');
    sahityaLine.className = 'sp-line sp-line-sahitya';

    const groups = [];
    let current = null;

    columns.forEach((col) => {
      let width;
      if (col.kind === 'bar') {
        const bar = document.createElement('div');
        bar.className = 'sp-cell bar' + (col.mark.type === 'mark' ? ' hint' : '');
        bar.textContent = col.mark.type === 'doublebar' ? '‖'
          : (col.mark.type === 'mark' ? col.mark.glyph : '|');
        width = 14;
        swaraLine.appendChild(bar);
      } else {
        const e = col.event;
        const gi = globalIndex[e.id];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'sp-cell swara' + (e.insideSpeedGroup ? ' speed' : '') + (e.isRest ? ' rest' : '');
        if (loop && gi >= loop.a && gi <= loop.b) cell.classList.add('in-loop');
        if (state.selection.start === gi) cell.classList.add('sel-start');
        cell.dataset.index = String(gi);
        cell.textContent = e.isRest ? E.displaySwara(e)
          : E.displaySwara(e) + (e.commaCount ? ','.repeat(e.commaCount) : '');
        width = Math.max(30, e.durationInSpaces * UNIT);
        cell.style.width = width + 'px';
        if (e.insideSpeedGroup) cell.style.fontSize = '0.92rem';
        cell.setAttribute('aria-label', e.isRest
          ? `Rest, ${e.durationInSpaces} note-spaces.`
          : `Swara ${e.resolvedSwara}${e.octave ? (e.octave > 0 ? ' upper octave' : ' lower octave') : ''}` +
            `${e.sahitya ? ', syllable ' + e.sahitya : ''}. Play from here.`);
        swaraLine.appendChild(cell);
        if (tokenByEvent[e.id]) current = tokenByEvent[e.id];
      }
      const owner = current;
      if (groups.length && groups[groups.length - 1].token === owner) groups[groups.length - 1].width += width;
      else groups.push({ token: owner, width });
    });

    const seen = {};
    groups.forEach((g) => {
      const cell = document.createElement('div');
      cell.className = 'sp-cell sahitya';
      cell.style.width = g.width + 'px';
      if (g.token && !seen[g.token.id]) {
        cell.textContent = g.token.text;
        cell.dataset.token = g.token.id;
        seen[g.token.id] = true;
      } else {
        cell.textContent = ' ';
      }
      sahityaLine.appendChild(cell);
    });

    inner.appendChild(swaraLine);
    if (row.sahityaTokens.length) inner.appendChild(sahityaLine);
    passage.appendChild(inner);
    host.appendChild(passage);
  });
  renderGrid();
}

/* ---------------------------------------------------------- by-cycle grid */
/* One row per written line, laid on the tala: every swara and comma sits
   where it is written. A line is set in from sam only when its own first bar
   line says so, and notes written after ‖ fall in the shaded columns past
   the end of the cycle. */
function setLayout(mode) {
  state.layout = mode === 'cycle' ? 'cycle' : 'written';
  $('spLayoutWritten').setAttribute('aria-pressed', String(state.layout === 'written'));
  $('spLayoutCycle').setAttribute('aria-pressed', String(state.layout === 'cycle'));
  $('spScore').hidden = state.layout === 'cycle';
  $('spGrid').hidden = state.layout !== 'cycle';
  renderGrid();
  if (lastActive >= 0) highlight(lastActive);
  savePrefs();
}

function glEl(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function renderGrid() {
  const host = $('spGrid');
  host.replaceChildren();
  if (state.layout !== 'cycle' || !parsed || !parsed.events.length) return;

  const nadai = state.subdivisionsPerBeat || 4;
  const beats = state.beatsPerCycle || 8;
  const cycle = beats * nadai;
  const angas = state.beatGroups && state.beatGroups.length ? state.beatGroups : [beats];
  let RES = 1;
  parsed.events.forEach((e) => {
    while (RES < 8 && Math.abs(e.durationInSpaces * RES - Math.round(e.durationInSpaces * RES)) > 1e-6) RES *= 2;
  });

  const indexById = {};
  parsed.events.forEach((e, i) => { indexById[e.id] = i; });
  const loop = state.selection.start !== null && state.selection.end !== null
    ? { a: Math.min(state.selection.start, state.selection.end), b: Math.max(state.selection.start, state.selection.end) }
    : null;

  const firstAnga = angas[0] * nadai;
  const lines = [];
  parsed.rows.forEach((row) => {
    if (row.type !== 'passage' || !(row.endSpace > row.startSpace)) return;
    const len = row.endSpace - row.startSpace;
    const bars = row.marks.filter((m) => m.type === 'bar' || m.type === 'doublebar');
    const firstBar = bars.length ? bars[0].atSpace - row.startSpace : null;
    /* Set in only when that puts every bar line on an anga boundary. A line
       barred on every beat already sits on the tala from sam. */
    const angaAt = {};
    let at0 = 0;
    angas.forEach((g) => { angaAt[at0 * nadai] = true; at0 += g; });
    const onAngas = (off) => bars.every((m) => angaAt[((m.atSpace - row.startSpace + off) % cycle + cycle) % cycle]);
    const setIn = firstAnga - firstBar;
    const offset = (firstBar !== null && firstBar > 0 && firstBar < firstAnga && angas.length > 1 &&
      !onAngas(0) && onAngas(setIn)) ? setIn : 0;
    const slices = [];
    parsed.events.forEach((e) => {
      const s = Math.max(e.startSpace, row.startSpace);
      const end = Math.min(e.startSpace + e.durationInSpaces, row.endSpace);
      if (end - s < 1e-6) return;
      slices.push({ event: e, col: offset + s - row.startSpace, span: end - s, skip: s - e.startSpace });
    });
    lines.push({ row, offset, len, slices, section: row.section || '' });
  });

  let width = cycle;
  lines.forEach((ln) => { width = Math.max(width, Math.ceil(ln.offset + ln.len)); });
  const cols = width * RES;
  const cycleCols = cycle * RES;
  const beatCols = nadai * RES;
  const angaStarts = {};
  let acc = 0;
  angas.forEach((g) => { angaStarts[acc * beatCols] = true; acc += g; });
  const template = `34px repeat(${cols}, minmax(0, 1fr))`;
  const lineClass = (c) => {
    if (c === 0 || c === cycleCols) return ' sp-gl-sam';
    if (c < cycleCols && angaStarts[c]) return ' sp-gl-anga';
    if (c % beatCols === 0) return ' sp-gl-beat';
    return '';
  };

  const header = () => {
    const r = glEl('div', 'sp-gl-row sp-gl-head');
    r.style.gridTemplateColumns = template;
    r.appendChild(glEl('div', 'sp-gl-no', ''));
    for (let c = 0; c < cols; c += beatCols) {
      const b = c / beatCols;
      const past = c >= cycleCols;
      const cell = glEl('div', 'sp-gl-beatno' + lineClass(c) + (past ? ' sp-gl-past' : ''),
        past ? '+' + (b - beats + 1) : String(b + 1));
      cell.style.gridColumn = `${c + 2} / span ${Math.min(beatCols, cols - c)}`;
      r.appendChild(cell);
    }
    return r;
  };

  const seenSyl = {};
  let block = null, lastSection = null;
  lines.forEach((ln) => {
    if (ln.section !== lastSection || !block) {
      if (ln.section) host.appendChild(glEl('div', 'sp-section', ln.section));
      block = glEl('div', 'sp-gl-block');
      host.appendChild(block);
      block.appendChild(header());
      lastSection = ln.section;
    }
    const r = glEl('div', 'sp-gl-row');
    r.style.gridTemplateColumns = template;
    const no = glEl('div', 'sp-gl-no', String(ln.row.swaraLine + 1));
    no.title = `Line ${ln.row.swaraLine + 1} · ${ln.len} note-spaces` +
      (ln.offset ? ` · set in ${ln.offset} from sam, because its first bar line comes ${ln.offset} before the end of the laghu` : '');
    r.appendChild(no);

    for (let c = 0; c < cols; c += beatCols) {
      const bg = glEl('div', 'sp-gl-bg' + lineClass(c) + (c >= cycleCols ? ' sp-gl-past' : ''));
      bg.style.gridColumn = `${c + 2} / span ${Math.min(beatCols, cols - c)}`;
      bg.style.gridRow = '1 / span 2';
      r.appendChild(bg);
    }

    const sorted = ln.slices.slice().sort((a, b) => a.col - b.col);
    sorted.forEach((sl) => {
      const e = sl.event;
      const idx = indexById[e.id];
      const startCol = Math.round(sl.col * RES);
      /* one cell per written character, each as long as it is written:
         half inside [ ], whole outside, so [PR,,] ,, reads back as written */
      const lengths = [e.insideSpeedGroup ? 0.5 : 1].concat(e.commaSpaces || []);
      let pos = 0;
      lengths.forEach((len, k) => {
        const a = Math.max(pos, sl.skip);
        const b = Math.min(pos + len, sl.skip + sl.span);
        const from = pos;
        pos += len;
        if (b - a < 1e-6) return;
        const at = startCol + Math.round((a - sl.skip) * RES);
        const comma = k > 0 || a > from + 1e-6;
        const cell = glEl('button', 'sp-gl-cell' +
          (len < 1 ? ' sp-gl-speed' : '') +
          (e.isRest ? ' sp-gl-rest' : '') +
          (comma ? ' sp-gl-hold' : '') +
          (loop && idx >= loop.a && idx <= loop.b ? ' in-loop' : '') +
          lineClass(at) + (at >= cycleCols ? ' sp-gl-past' : ''));
        cell.type = 'button';
        cell.style.gridColumn = `${at + 2} / span ${Math.max(1, Math.round((b - a) * RES))}`;
        cell.style.gridRow = '1';
        cell.dataset.index = String(idx);
        cell.textContent = (comma || e.isRest) ? ',' : E.displaySwara(e);
        cell.setAttribute('aria-label', e.isRest ? 'Rest.'
          : `${comma ? 'Held ' : 'Swara '}${e.resolvedSwara}, line ${e.sourceLine + 1}. Play from here.`);
        r.appendChild(cell);
      });
    });

    const carriers = sorted.filter((sl) => {
      if (sl.skip > 0 || !sl.event.sahitya) return false;
      const key = sl.event.sahityaId || 'e' + indexById[sl.event.id];
      if (seenSyl[key]) return false;
      seenSyl[key] = true;
      return true;
    });
    carriers.forEach((sl, i) => {
      const s = Math.round(sl.col * RES);
      const end = i + 1 < carriers.length ? Math.round(carriers[i + 1].col * RES) : cols;
      const syl = glEl('div', 'sp-gl-syl', sl.event.sahitya);
      syl.style.gridColumn = `${s + 2} / span ${Math.max(1, end - s)}`;
      syl.style.gridRow = '2';
      if (sl.event.sahityaId) syl.dataset.token = sl.event.sahityaId;
      r.appendChild(syl);
    });
    block.appendChild(r);
  });
  fitGrid();
}

/* Columns are fractions of the width, so nothing overflows; the type size is
   what gives on a dense tala. */
function fitGrid() {
  document.querySelectorAll('.sp-gl-block').forEach((b) => {
    const row = b.querySelector('.sp-gl-row:not(.sp-gl-head)');
    const cols = row && (row.style.gridTemplateColumns.match(/repeat\((\d+)/) || [])[1];
    if (!cols) return;
    const per = (b.clientWidth - 34) / Number(cols);
    b.style.fontSize = Math.max(9, Math.min(17, per * 1.45)) + 'px';
  });
}

/* ------------------------------------------------------------ song loading */
function talaFromMeta(meta) {
  const name = (meta.TALA || '').trim();
  if (name && E.TALAS[name]) return { name, ...E.TALAS[name] };
  const match = Object.keys(E.TALAS).find((k) => k.toLowerCase().startsWith(name.toLowerCase()) && name);
  if (match) return { name: match, ...E.TALAS[match] };
  return null;
}

/* A raga the engine does not ship is registered from the song's own scale, so
   the notation still resolves without any code change. */
function ensureRaga(meta) {
  const name = meta.RAGA;
  if (!name) return 'Chromatic (all swaras)';
  if (E.RAGAS[name]) return name;
  const derived = E.swarasFromScale(meta.SCALE || meta.AROHANA);
  if (derived) {
    E.registerRaga(name, {
      swaras: derived.swaras,
      defaults: derived.defaults,
      arohana: meta.AROHANA || '',
      avarohana: meta.AVAROHANA || ''
    });
    return name;
  }
  return 'Chromatic (all swaras)';
}

function applyMeta(meta) {
  const tala = talaFromMeta(meta);
  if (tala) {
    state.beatGroups = tala.groups.slice();
    state.beatsPerCycle = tala.groups.reduce((a, b) => a + b, 0);
    state.subdivisionsPerBeat = tala.subdivisions;
  }
  if (meta.BEATS && !isNaN(parseInt(meta.BEATS, 10))) {
    state.beatsPerCycle = parseInt(meta.BEATS, 10);
    if (!tala) state.beatGroups = [state.beatsPerCycle];
  }
  if (meta.NADAI && !isNaN(parseInt(meta.NADAI, 10))) state.subdivisionsPerBeat = parseInt(meta.NADAI, 10);
  if (meta.BPM && !isNaN(parseInt(meta.BPM, 10))) state.bpm = Math.max(20, Math.min(300, parseInt(meta.BPM, 10)));
  state.raga = ensureRaga(meta);
  if (meta.SA) {
    const raw = String(meta.SA).trim();
    const hz = raw.match(/^([\d.]+)\s*(hz)?$/i);
    const key = raw.match(/^([A-G]#?)\s*(\d)?$/i);
    if (key) {
      state.tonicKey = key[1].toUpperCase();
      state.tonicOctave = key[2] ? parseInt(key[2], 10) : 4;
      state.tonicHz = E.keyToFrequency(state.tonicKey, state.tonicOctave);
    } else if (hz && parseFloat(hz[1]) > 20) {
      state.tonicHz = parseFloat(hz[1]);
      state.tonicKey = '';
    }
  }
}

function loadSong(i) {
  stop();
  const song = state.songs[i];
  if (!song) return;
  state.index = i;
  state.source = song.text;
  state.selection = { start: null, end: null };

  applyMeta(song.meta || {});
  rebuild();

  state.title = parsed.title || song.title || '';
  $('spTitle').textContent = state.title;
  const search = $('spSearch');
  if (search) search.value = state.title;
  $('spMeta').textContent = (song.meta && song.meta.COMPOSER) || '';
  renderSongBar(song.meta || {});

  syncControls();
  try { localStorage.setItem('sp-song', song.slug); } catch (e) {}
  const url = new URL(window.location.href);
  url.searchParams.set('song', song.slug);
  window.history.replaceState({}, '', url);
}

function rebuild() {
  parsed = E.parse(state.source, { raga: state.raga });
  timingInfo = E.timing(parsed, {
    bpm: state.bpm,
    subdivisionsPerBeat: state.subdivisionsPerBeat,
    beatsPerCycle: state.beatsPerCycle
  });
  buildTicks();
  renderScore();
  updateReadout(null);
}

function setBpm(v) {
  v = Math.max(20, Math.min(300, Math.round(v || 60)));
  state.bpm = v;
  $('spBpm').value = String(v);
  $('spBpmRange').value = String(v);
  $('spBpmMini').value = String(v);
  const meta = (state.songs[state.index] || {}).meta || {};
  if (parsed) renderSongBar(meta);
  const wasPlaying = transport.status === 'playing';
  const at = wasPlaying ? actx.currentTime - transport.uiOrigin : null;
  rebuild();
  if (wasPlaying) {
    const idx = firstEventAtOrAfter(at);
    pause(); transport.status = 'stopped';
    play(Math.max(0, Math.min(idx, schedule().length - 1)));
  }
  savePrefs();
}

function syncControls() {
  $('spBpm').value = String(state.bpm);
  $('spBpmRange').value = String(state.bpm);
  $('spBpmMini').value = String(state.bpm);
  $('spTonic').value = state.tonicKey;
  $('spOctave').value = String(state.tonicOctave);
  $('spLoop').value = state.loopMode;
  $('spSubClick').checked = state.subClick;
  $('spVolMaster').value = String(state.volMaster);
  $('spVolPiano').value = String(state.volPiano);
  $('spVolClick').value = String(state.volClick);
  syncTransportUi();
}

/* Only sound preferences persist — the song supplies its own tempo and tonic. */
function savePrefs() {
  try {
    localStorage.setItem('sp-prefs', JSON.stringify({
      metronome: state.metronome, subClick: state.subClick, loopMode: state.loopMode, layout: state.layout,
      volMaster: state.volMaster, volPiano: state.volPiano, volClick: state.volClick
    }));
  } catch (e) {}
}
function loadPrefs() {
  try {
    const raw = localStorage.getItem('sp-prefs');
    if (!raw) return;
    Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}



/* Everything about the song, compactly, above the notation. */
function tonicLabel() {
  return state.tonicKey ? state.tonicKey + state.tonicOctave : Number(state.tonicHz).toFixed(2) + ' Hz';
}

/* Where the first sounding swara falls, read from the rests in the notation. */
function eduppuLabel() {
  const ed = E.eduppuOf(parsed, {
    beatsPerCycle: state.beatsPerCycle,
    subdivisionsPerBeat: state.subdivisionsPerBeat
  });
  if (!ed) return '—';
  if (ed.onSam) return 'samam';
  return `+${ed.spaces}` + (ed.beats % 1 === 0 ? ` (${ed.beats} beat${ed.beats === 1 ? '' : 's'})` : '');
}

function renderSongBar(meta) {
  const bar = $('spSongBar');
  if (!bar) return;
  const cycle = E.cycleReport(parsed, {
    subdivisionsPerBeat: state.subdivisionsPerBeat,
    beatsPerCycle: state.beatsPerCycle
  });
  const rows = [
    ['Raga', state.raga === 'Chromatic (all swaras)' ? (meta.RAGA || '—') : state.raga],
    ['Tala', meta.TALA || `${state.beatsPerCycle} beats`],
    ['Beats × nadai', `${state.beatsPerCycle} × ${state.subdivisionsPerBeat}`],
    ['Sruthi', tonicLabel()],
    ['Tempo', `${state.bpm} BPM`],
    ['Cycles', cycle.totalCycles],
    ['Eduppu', eduppuLabel()]
  ];
  const dl = document.createElement('dl');
  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = String(value);
    row.append(dt, dd);
    dl.appendChild(row);
  });
  bar.replaceChildren(dl);

  const scale = [
    meta.AROHANA ? 'Arohana ' + meta.AROHANA : '',
    meta.AVAROHANA ? 'Avarohana ' + meta.AVAROHANA : ''
  ].filter(Boolean).join('   ·   ') || (meta.SCALE ? 'Swaras ' + meta.SCALE : '');
  if (scale) {
    const sc = document.createElement('span');
    sc.className = 'sp-scale';
    sc.textContent = scale;
    bar.appendChild(sc);
  }
}

/* ------------------------------------------------------- searchable picker */
const fold = (v) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const combo = { open: false, active: -1, matches: [] };

function comboOptions() {
  return Array.from(document.querySelectorAll('.sp-songopt'));
}

/* Show the query inside the matched text, so it is clear why a song matched. */
function markMatch(el, query) {
  el.querySelectorAll('b, span').forEach((part) => {
    const text = part.dataset.text || part.textContent;
    part.dataset.text = text;
    if (!query) { part.textContent = text; return; }
    const at = fold(text).indexOf(query);
    if (at < 0) { part.textContent = text; return; }
    part.replaceChildren(
      document.createTextNode(text.slice(0, at)),
      Object.assign(document.createElement('mark'), { textContent: text.slice(at, at + query.length) }),
      document.createTextNode(text.slice(at + query.length))
    );
  });
}

function filterSongs(raw) {
  const query = fold(raw.trim());
  const options = comboOptions();
  combo.matches = [];
  options.forEach((el) => {
    const hit = !query || el.dataset.search.indexOf(query) !== -1;
    el.hidden = !hit;
    if (hit) { combo.matches.push(el); markMatch(el, query); }
  });
  const list = $('spSongList');
  let empty = list.querySelector('.sp-noresult');
  if (!combo.matches.length) {
    if (!empty) {
      empty = document.createElement('li');
      empty.className = 'sp-noresult';
      list.appendChild(empty);
    }
    empty.textContent = 'No song matches "' + raw.trim() + '".';
    empty.hidden = false;
  } else if (empty) {
    empty.hidden = true;
  }
  const count = $('spCount');
  if (count) {
    count.textContent = !query
      ? ''
      : combo.matches.length + (combo.matches.length === 1 ? ' song matches' : ' songs match');
  }
  setActive(combo.matches.length ? 0 : -1);
}

function setActive(i) {
  combo.active = i;
  const input = $('spSearch');
  comboOptions().forEach((el) => {
    el.classList.remove('sp-active');
    el.setAttribute('aria-selected', 'false');
  });
  const el = combo.matches[i];
  if (el) {
    el.classList.add('sp-active');
    el.setAttribute('aria-selected', 'true');
    el.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', el.id);
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function openCombo(showAll) {
  const input = $('spSearch');
  if (showAll) filterSongs('');
  $('spSongList').hidden = false;
  input.setAttribute('aria-expanded', 'true');
  combo.open = true;
}

function closeCombo() {
  $('spSongList').hidden = true;
  $('spSearch').setAttribute('aria-expanded', 'false');
  $('spSearch').removeAttribute('aria-activedescendant');
  combo.open = false;
}

function chooseActive() {
  const el = combo.matches[combo.active];
  if (!el) return;
  closeCombo();
  loadSong(parseInt(el.dataset.index, 10));
}

function wireSearch() {
  const input = $('spSearch');
  if (!input) return;
  const list = $('spSongList');

  input.addEventListener('focus', () => { input.select(); openCombo(true); });
  input.addEventListener('input', () => { filterSongs(input.value); openCombo(false); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!combo.open) { openCombo(true); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const n = combo.matches.length;
      if (n) setActive((combo.active + step + n) % n);
    } else if (e.key === 'Enter') {
      if (combo.open) { e.preventDefault(); chooseActive(); }
    } else if (e.key === 'Escape') {
      if (combo.open) { e.stopPropagation(); closeCombo(); input.value = state.title; }
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (combo.open) { closeCombo(); input.value = state.title; } }, 150);
  });

  list.addEventListener('mousedown', (e) => e.preventDefault());   // keep focus for blur order
  list.addEventListener('click', (e) => {
    const el = e.target.closest('.sp-songopt');
    if (!el) return;
    closeCombo();
    loadSong(parseInt(el.dataset.index, 10));
  });

  const toggle = $('spSearchToggle');
  if (toggle) toggle.addEventListener('click', () => {
    if (combo.open) { closeCombo(); return; }
    input.focus();
    openCombo(true);
  });

  document.addEventListener('click', (e) => {
    if (combo.open && !e.target.closest('.sp-combo')) { closeCombo(); input.value = state.title; }
  });

  filterSongs('');
}

/* ------------------------------------------------------------------- wiring */
function wire() {
  $('spPlay').addEventListener('click', () => {
    if (transport.status === 'playing') pause(); else play();
  });
  $('spStop').addEventListener('click', () => stop());
  $('spRestart').addEventListener('click', () => { stop(); play(0); });
  $('spMetro').addEventListener('click', () => {
    state.metronome = !state.metronome;
    syncTransportUi(); savePrefs();
  });

  $('spBpm').addEventListener('change', function () { setBpm(parseInt(this.value, 10)); });
  $('spBpmRange').addEventListener('input', function () { setBpm(parseInt(this.value, 10)); });
  $('spBpmMini').addEventListener('change', function () { setBpm(parseInt(this.value, 10)); });

  const retune = () => {
    state.tonicHz = E.keyToFrequency(state.tonicKey, state.tonicOctave);
    renderSongBar((state.songs[state.index] || {}).meta || {});
    const wasPlaying = transport.status === 'playing';
    const at = wasPlaying ? actx.currentTime - transport.uiOrigin : null;
    if (wasPlaying) {
      const idx = firstEventAtOrAfter(at);
      pause(); transport.status = 'stopped';
      play(Math.max(0, Math.min(idx, schedule().length - 1)));
    }
  };
  $('spTonic').addEventListener('change', function () { state.tonicKey = this.value; retune(); });
  $('spOctave').addEventListener('change', function () { state.tonicOctave = parseInt(this.value, 10); retune(); });

  $('spLoop').addEventListener('change', function () { state.loopMode = this.value; savePrefs(); });
  $('spSubClick').addEventListener('change', function () { state.subClick = this.checked; syncTransportUi(); savePrefs(); });
  $('spSubMini').addEventListener('click', () => {
    state.subClick = !state.subClick;
    $('spSubClick').checked = state.subClick;
    syncTransportUi(); savePrefs();
  });
  $('spLayoutWritten').addEventListener('click', () => setLayout('written'));
  $('spLayoutCycle').addEventListener('click', () => setLayout('cycle'));
  window.addEventListener('resize', fitGrid);
  $('spVolMaster').addEventListener('input', function () { state.volMaster = parseFloat(this.value); applyVolumes(); savePrefs(); });
  $('spVolPiano').addEventListener('input', function () { state.volPiano = parseFloat(this.value); applyVolumes(); savePrefs(); });
  $('spVolClick').addEventListener('input', function () { state.volClick = parseFloat(this.value); applyVolumes(); savePrefs(); });

  wireSearch();

  const onScoreTap = (ev) => {
    const cell = ev.target.closest && ev.target.closest('.sp-cell.swara, .sp-gl-cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.index, 10);
    if (ev.shiftKey && state.selection.start !== null) {
      state.selection.end = idx;
      if (state.loopMode === 'off') { state.loopMode = 'selection'; $('spLoop').value = 'selection'; }
      renderScore();
      return;
    }
    state.selection.start = idx;
    state.selection.end = null;
    renderScore();
    stop();
    play(idx);
  };
  $('spScore').addEventListener('click', onScoreTap);
  $('spGrid').addEventListener('click', onScoreTap);

  $('spClearSel').addEventListener('click', () => {
    state.selection = { start: null, end: null };
    if (state.loopMode === 'selection') { state.loopMode = 'off'; $('spLoop').value = 'off'; }
    renderScore();
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === ' ') { e.preventDefault(); transport.status === 'playing' ? pause() : play(); }
    else if (e.key === 's' || e.key === 'S') stop();
    else if (e.key === 'r' || e.key === 'R') { stop(); play(0); }
    else if (e.key === 'm' || e.key === 'M') $('spMetro').click();
    else if (e.key === 'ArrowLeft') setBpm(state.bpm - 2);
    else if (e.key === 'ArrowRight') setBpm(state.bpm + 2);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && transport.status === 'playing') pause();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (lastActive >= 0) highlight(lastActive); }, 250);
  });
}

/* --------------------------------------------------------------------- init */
function readSongs() {
  return Array.from(document.querySelectorAll('#spSongs > pre')).map((el) => ({
    slug: el.dataset.slug,
    title: el.dataset.title || '',
    meta: JSON.parse(el.dataset.meta || '{}'),
    text: el.textContent
  }));
}

function init() {
  const host = $('spPlayer');
  if (!host) return;
  state.songs = readSongs();
  if (!state.songs.length) return;
  loadPrefs();
  wire();
  setLayout(state.layout);

  const wanted = new URLSearchParams(window.location.search).get('song');
  let start = state.songs.findIndex((s) => s.slug === wanted);
  if (start < 0) {
    let remembered = null;
    try { remembered = localStorage.getItem('sp-song'); } catch (e) {}
    start = state.songs.findIndex((s) => s.slug === remembered);
  }
  if (start < 0) start = 0;
  loadSong(start);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
