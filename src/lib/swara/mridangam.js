/* ============================================================================
   Mridangam-style accompaniment (experimental)
   Pure logic: reads a parsed song and returns the strokes to play. No DOM, no
   audio. The same song, level and take always give the same part. The whole
   part is composed when the song loads, so it can look ahead at the melody.

   Composing happens in this order:
     1. find every gap between melody notes (a comma counts: a held note is a
        space for the drummer to play in)
     2. keep a groove that spans two beats, so strokes fall off the beat too
     3. thin the groove under busy melody; meet long notes with an open stroke
     4. fill each gap with a phrase cut to its exact length, landing on the
        note that ends it; long gaps may get a tihai
     5. close a section that meets a cycle with a tihai onto the next sam
   The part grows through each section, and when a line comes round again.
   ========================================================================= */
import E from './engine.js';

/* Two-beat grooves, by pulses in a beat. '.' leaves the pulse empty. */
const GROOVES = {
  3: ['nam . ki ta . ki', 'dhin . ta . ki ta', 'thom . ta ki . nam'],
  4: ['nam . ki ta . ki nam .', 'dhin . ta ki . ta dhin ki', 'nam ki . ta nam . ki .', 'thom . ki ta . nam . ki']
};
const GROUP3 = 'nam . ki', GROUP4 = 'dhin . ta ki';
/* Building blocks for fills, by length. */
const PHRASES = {
  2: ['ta ki', 'ki ta'],
  3: ['ta ki ta', 'ta ka dhin', 'thom ta ki'],
  4: ['ta ka dhin mi', 'ta ki ta ka', 'thom . ta ki', 'dhin ki ta chapu'],
  5: ['ta ka ta ki ta', 'ta . ka dhin mi', 'thom ta ka dhin ki']
};
const ALIAS = { ka: 'ki', mi: 'ta' };   // spoken syllables that share a stroke
const LEVELS = {
  1: { fill: 0.5,  groove: false, reach: 1, tihai: false, gain: 0.85 },
  2: { fill: 0.85, groove: true,  reach: 2, tihai: true,  gain: 0.95 },
  3: { fill: 1,    groove: true,  reach: 3, tihai: true,  gain: 1 }
};

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function randomFrom(seed) {
  let a = seed >>> 0;
  return function () {   // mulberry32
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const words = (text) => text.split(' ').map((w) => (w === '.' ? null : w));

/* The drummer's own pulse: slow nadais are doubled and very fast ones halved,
   so the part stays playable whatever the notation's spacing. */
function pulsesInBeat(sub) {
  if (sub <= 2) return sub * 2;
  if (sub >= 6 && sub % 2 === 0) return sub / 2;
  return sub;
}

function groovesFor(ppb) {
  if (GROOVES[ppb]) return GROOVES[ppb].map(words);
  // khanda, misra and the like: a three and a four, across two beats
  const cell = (first, second) => words(first + ' ' + second + ' ' + first + ' ' + second).slice(0, ppb * 2);
  return [cell(GROUP3, GROUP4), cell(GROUP4, GROUP3)];
}

/* A phrase of exactly `length` pulses (at least 2), in groups of 2 to 5. */
function composeFill(length, random) {
  const out = [];
  let left = length;
  while (left > 0) {
    let size = left <= 5 ? left : 3 + Math.floor(random() * 3);
    if (left - size === 1) size--;   // never strand a single stroke
    const set = PHRASES[size];
    out.push(...words(set[Math.floor(random() * set.length)]));
    left -= size;
  }
  return out;
}

/* A phrase said three times with a rest between, whose last stroke falls on
   the landing. Returns null when no phrase fits the room exactly. */
function composeTihai(room, random) {
  const reach = room + 1;   // the third phrase ends on the landing itself
  for (let p = 7; p >= 3; p--) {
    for (let g = 2; g >= 0; g--) {
      if (3 * p + 2 * g !== reach) continue;
      const body = composeFill(p - 1, random).concat(['dhin']);
      const rest = new Array(g).fill(null);
      return body.concat(rest, body, rest, body);
    }
  }
  return null;
}

/* Where each note starts, in pulses, and how long it lasts. */
function readMelody(parsed, step, length) {
  const onsets = new Array(length).fill(0);
  const held = new Array(length).fill(0);
  parsed.events.forEach((e) => {
    if (e.isRest || !e.valid) return;
    const p = Math.floor(e.startSpace / step + 1e-6);
    if (p >= length) return;
    onsets[p]++;
    held[p] = Math.max(held[p], e.durationInSpaces / step);
  });
  return { onsets, held };
}

/* -> [{ space, stroke, gain, offset }], in time order. `offset` is a tiny
   lateness in seconds, the human part of the timing. */
function generate(parsed, config) {
  const sub = config.subdivisionsPerBeat || 4;
  const beats = config.beatsPerCycle || 8;
  const level = LEVELS[config.level] || LEVELS[2];
  const random = randomFrom(hash((parsed.title || '') + '|' + (config.take || 0) + '|' + (config.level || 2)));
  const total = parsed.totalSpaces;
  if (!parsed.events.length || !total) return [];

  const ppb = pulsesInBeat(sub);
  const step = sub / ppb;              // spaces in one pulse
  const cycle = ppb * beats;
  const length = Math.ceil(total / step);
  const { onsets, held } = readMelody(parsed, step, length);

  const hits = new Map();
  const put = (pulse, stroke, gain) => {
    const space = pulse * step;
    if (!stroke || space < 0 || space >= total) return;
    hits.set(space, {
      space,
      stroke: ALIAS[stroke] || stroke,
      gain: Math.min(1, gain * level.gain * (0.9 + random() * 0.18)),
      offset: random() * 0.008
    });
  };

  const report = E.cycleReport(parsed, { subdivisionsPerBeat: sub, beatsPerCycle: beats });
  const sections = report.sections.length ? report.sections : [{ startSpace: 0 }];
  const grooves = groovesFor(ppb);
  const home = Math.floor(random() * grooves.length);
  const seenLines = new Map();         // the same melody again is played fuller

  sections.forEach((sec, n) => {
    const start = Math.round(sec.startSpace / step);
    const next = sections[n + 1];
    const end = next ? Math.round(next.startSpace / step) : length;
    const span = Math.max(1, end - start);

    // how much each cycle may say
    const energy = new Map();
    for (let c = start; c < end; c += cycle) {
      const key = onsets.slice(c, Math.min(end, c + cycle)).join('');
      const seen = seenLines.get(key) || 0;
      seenLines.set(key, seen + 1);
      energy.set(c, Math.min(1, 0.2 + 0.25 * Math.min(1, n / 3) + 0.45 * ((c - start) / span) + 0.15 * seen));
    }
    const energyAt = (p) => energy.get(start + Math.floor((p - start) / cycle) * cycle) || 0.3;

    // 1. the gaps, and the phrase each one will carry
    const reserved = new Set();
    const fills = [];
    let last = -1;
    for (let p = start; p < end; p++) {
      if (!onsets[p]) continue;
      const room = p - Math.max(last + 1, start);
      if (room >= Math.max(2, ppb - 1)) {
        const e = energyAt(p);
        if (random() < level.fill * (0.65 + e)) {
          const leave = last < start ? 0 : Math.ceil(room / 4);   // let the note speak first
          const size = Math.min(room - leave, Math.ceil(ppb * (1 + e * level.reach)));
          if (size >= 2) {
            fills.push({ from: p - size, landing: p, room, e });
            for (let q = p - room; q <= p; q++) reserved.add(q);
          }
        }
      }
      last = p;
    }

    // 2 and 3. the groove, thinned to suit the melody
    for (let p = start; p < end; p++) {
      if (reserved.has(p)) continue;
      const rel = p - start;
      const inCycle = rel % cycle;
      const cycleNo = Math.floor(rel / cycle);
      const e = energyAt(p);
      if (inCycle === 0) {
        const open = cycleNo % 4 === 0;
        put(p, !open && cycleNo % 2 ? 'dhin' : 'tham', open ? 0.92 : 0.66);
        continue;
      }
      if (held[p] >= ppb * 1.5) { put(p, random() < 0.5 ? 'dhin' : 'nam', 0.6); continue; }   // meet a long note
      if (!level.groove) {
        if (inCycle % (ppb * 2) === 0) put(p, 'nam', 0.4);
        continue;
      }
      const shape = grooves[(home + (cycleNo % 4 === 3 ? 1 : 0) + n) % grooves.length];
      const stroke = shape[inCycle % shape.length];
      if (!stroke) continue;
      let busy = 0;
      for (let q = Math.max(0, p - ppb); q < Math.min(length, p + ppb); q++) if (onsets[q]) busy++;
      const light = stroke === 'ki' || stroke === 'ta';
      if (light && busy >= ppb * 1.5) continue;            // leave the melody room
      if (light && random() > 0.55 + e * 0.45) continue;   // the groove breathes
      const accent = inCycle % ppb === 0 ? 0.08 : 0;
      put(p, stroke, (light ? 0.24 + e * 0.1 : 0.4 + e * 0.12) + accent);
    }

    // 4. the fills
    fills.forEach(({ from, landing, room, e }) => {
      const size = landing - from;
      if (size < room && room >= ppb * 2 && random() < 0.35 + e * 0.3) put(landing - room + 1, 'gumki', 0.46);
      const tihai = level.tihai && size >= ppb * 2 && random() < 0.2 + e * 0.4 ? composeTihai(size, random) : null;
      const line = tihai || composeFill(size, random);
      line.forEach((st, i) => put(from + i, st, 0.32 + 0.38 * (i / Math.max(1, line.length - 1))));
      if (e > 0.5 && level.reach > 1 && !tihai && size >= 4) put(landing - 1.5, 'ki', 0.34);   // a quick flick into the landing
      const onSam = (landing - start) % cycle === 0;
      if (!tihai) put(landing, onSam ? 'tham' : (random() < 0.5 ? 'dhin' : 'nam'), onSam ? 0.95 : 0.68);
    });

    // 5. the closing tihai
    if (level.tihai && next && span % cycle === 0 && span >= cycle && energyAt(end - 1) > 0.4) {
      let line = null;
      for (let room = Math.round(ppb * 2.5); room <= ppb * 4 && !line; room++) line = composeTihai(room, random);
      if (line) {
        const from = end - (line.length - 1);
        Array.from(hits.keys()).forEach((key) => { if (key >= from * step && key < end * step) hits.delete(key); });
        line.forEach((st, i) => put(from + i, st, 0.46 + 0.34 * (i / (line.length - 1))));
      }
    }
  });

  return Array.from(hits.values()).sort((a, b) => a.space - b.space);
}

export default { generate };
