/* ============================================================================
   Mridangam-style accompaniment (experimental)
   Pure logic: reads a parsed song and returns the strokes to play. No DOM, no
   audio. The same song, level and take always give the same part.

   Each beat is judged from the notation:
     busy melody  -> step back to the beat, leave the melody room
     sustained    -> leave space, sometimes a gumki slide on the bass
     silence      -> fill the gap with a short phrase
     otherwise    -> the keeping pattern
   A part builds through each section, and a section whose end meets a cycle
   closes with a three-fold phrase landing on the next sam.
   ========================================================================= */
import E from './engine.js';

/* The keeping pattern for one beat, by how many spaces the beat has. */
const KEEP = {
  2: [['nam', 'ta'], ['dhin', 'ki']],
  3: [['nam', 'ta', 'ki'], ['dhin', 'ta', 'ki']],
  4: [['nam', null, 'ta', 'ki'], ['dhin', null, 'ta', 'chapu'], ['nam', 'ki', null, 'ta']]
};
/* Fills for a beat of open space; the last stroke leans into the next beat. */
const FILLS = {
  2: [['ta', 'ki'], ['ki', 'ta']],
  3: [['ta', 'ki', 'ta'], ['ta', 'ka', 'dhin'], ['thom', 'ta', 'ki']],
  4: [['ta', 'ka', 'dhin', 'mi'], ['ta', 'ki', 'ta', 'ka'], ['thom', null, 'ta', 'ki'], ['dhin', 'ki', 'ta', 'chapu']]
};
const ALIAS = { ka: 'ki', mi: 'ta' };   // spoken syllables that share a stroke
const LEVELS = {
  1: { fill: 0.25, keep: false, landing: false, gain: 0.85 },
  2: { fill: 0.55, keep: true,  landing: true,  gain: 0.95 },
  3: { fill: 0.85, keep: true,  landing: true,  gain: 1 }
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

function cellsFor(table, spaces) {
  if (table[spaces]) return table[spaces];
  if (spaces > 4 && table[4]) return table[4];   // longer beats: the phrase, then room
  return table[2];
}

/* What the melody does in each whole space of the song. */
function readMelody(parsed, length) {
  const onsets = new Array(length).fill(0);
  const sounding = new Array(length).fill(false);
  parsed.events.forEach((e) => {
    if (e.isRest || !e.valid) return;
    const first = Math.floor(e.startSpace);
    if (first < length) onsets[first]++;
    const end = Math.min(length, Math.ceil(e.startSpace + e.durationInSpaces));
    for (let s = first; s < end; s++) sounding[s] = true;
  });
  return { onsets, sounding };
}

/* -> [{ space, stroke, gain }], in time order. `offset` is a tiny lateness in
   seconds, the human part of the timing. */
function generate(parsed, config) {
  const sub = config.subdivisionsPerBeat || 4;
  const beats = config.beatsPerCycle || 8;
  const groups = config.beatGroups && config.beatGroups.length ? config.beatGroups : [beats];
  const level = LEVELS[config.level] || LEVELS[2];
  const random = randomFrom(hash((parsed.title || '') + '|' + (config.take || 0) + '|' + (config.level || 2)));
  const cycle = sub * beats;
  const total = parsed.totalSpaces;
  if (!parsed.events.length || !total) return [];
  const length = Math.ceil(total);
  const { onsets, sounding } = readMelody(parsed, length);

  const angaStarts = {};
  let at = 0;
  groups.forEach((g) => { angaStarts[at] = true; at += g; });

  const report = E.cycleReport(parsed, { subdivisionsPerBeat: sub, beatsPerCycle: beats });
  const sections = report.sections.length ? report.sections : [{ startSpace: 0 }];
  const hits = new Map();
  const put = (space, stroke, gain) => {
    if (!stroke || space < 0 || space >= total) return;
    hits.set(space, {
      space,
      stroke: ALIAS[stroke] || stroke,
      gain: Math.min(1, gain * level.gain * (0.92 + random() * 0.14)),
      offset: random() * 0.006
    });
  };

  sections.forEach((sec, n) => {
    const start = n === 0 ? Math.floor(sec.startSpace) : Math.round(sec.startSpace);
    const next = sections[n + 1];
    const end = next ? Math.round(next.startSpace) : length;
    const span = Math.max(1, end - start);
    let keepIndex = 0;

    for (let c = start; c < end; c += cycle) {
      const progress = Math.min(1, (c - start) / span);   // the part builds through a section
      for (let b = 0; b < beats; b++) {
        const beatAt = c + b * sub;
        if (beatAt >= end) break;
        let count = 0, held = false;
        for (let s = beatAt; s < Math.min(length, beatAt + sub); s++) { count += onsets[s]; held = held || sounding[s]; }

        if (b === 0) put(beatAt, 'tham', 1);
        else if (angaStarts[b]) put(beatAt, 'dhin', 0.78);

        if (count === 0 && !held) {
          // silence in the melody: answer it
          if (random() < level.fill + progress * 0.15) {
            const f = cellsFor(FILLS, sub);
            f[Math.floor(random() * f.length)].forEach((st, i) => { if (b > 0 || i > 0) put(beatAt + i, st, 0.5 + 0.1 * i); });
          } else if (b > 0 && !angaStarts[b]) put(beatAt, 'ta', 0.35);
        } else if (count === 0) {
          // a sustain: leave it room
          if (b > 0 && random() < 0.3 + progress * 0.2) put(beatAt, 'gumki', 0.5);
          else if (b > 0 && !angaStarts[b]) put(beatAt, 'nam', 0.32);
        } else if (count >= sub) {
          // a busy phrase: only mark the beat
          if (b > 0 && !angaStarts[b]) put(beatAt, b % 2 ? 'ta' : 'nam', 0.42);
        } else if (level.keep) {
          const k = cellsFor(KEEP, sub);
          k[keepIndex++ % k.length].forEach((st, i) => {
            if (i === 0 && (b === 0 || angaStarts[b])) return;
            put(beatAt + i, st, i === 0 ? 0.55 : 0.3 + random() * 0.14);
          });
        } else if (b > 0 && !angaStarts[b]) put(beatAt, 'nam', 0.4);
      }
    }

    // tirmanam: ta ka dhin, three times, the last dhin on the next sam
    const whole = (end - start) % cycle === 0;
    if (level.landing && next && whole && span >= cycle) {
      const period = sub + 1;
      const from = end - 2 * period - 2;
      for (let s = Math.max(start + sub, from); s < end; s++) hits.delete(s);
      for (let r = 0; r < 3; r++) {
        const p = from + r * period;
        put(p, 'ta', 0.62 + r * 0.08);
        put(p + 1, 'ki', 0.58 + r * 0.08);
        if (r < 2) put(p + 2, 'dhin', 0.74 + r * 0.08);
      }
    }
  });

  return Array.from(hits.values()).sort((a, b) => a.space - b.space);
}

export default { generate };
