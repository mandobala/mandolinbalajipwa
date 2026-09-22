/* ============================================================================
   Carnatic Swara Notation Engine
   Pure logic: parsing, timing, pitch/raga resolution, sahitya alignment.
   No DOM, no audio. Runnable in Node (tests) and in the browser.
   ========================================================================= */
const CarnaticEngine = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Swara positions (12-TET semitones above Sa)
     --------------------------------------------------------------------- */
  var DEFAULT_POSITIONS = {
    S: 0,
    R1: 1, R2: 2, R3: 3,
    G1: 2, G2: 3, G3: 4,
    M1: 5, M2: 6,
    P: 7,
    D1: 8, D2: 9, D3: 10,
    N1: 9, N2: 10, N3: 11
  };

  var ALL_SWARA_NAMES = ['S', 'R1', 'R2', 'R3', 'G1', 'G2', 'G3', 'M1', 'M2', 'P', 'D1', 'D2', 'D3', 'N1', 'N2', 'N3'];

  /* Ragas: the list of swara variants each raga admits.
     A bare letter in the notation is resolved through this list.       */
  var RAGAS = {
    'Chromatic (all swaras)': {
      swaras: ALL_SWARA_NAMES.slice(),
      // bare-letter defaults when every variant is available
      defaults: { R: 'R2', G: 'G3', M: 'M1', D: 'D2', N: 'N3' },
      arohana: 'S R2 G3 M1 P D2 N3 Ṡ',
      avarohana: 'Ṡ N3 D2 P M1 G3 R2 S'
    },
    'Hindolam': {
      swaras: ['S', 'G2', 'M1', 'D1', 'N2'],
      arohana: 'S G2 M1 D1 N2 Ṡ',
      avarohana: 'Ṡ N2 D1 M1 G2 S'
    },
    'Mayamalavagowla': {
      swaras: ['S', 'R1', 'G3', 'M1', 'P', 'D1', 'N3'],
      arohana: 'S R1 G3 M1 P D1 N3 Ṡ',
      avarohana: 'Ṡ N3 D1 P M1 G3 R1 S'
    },
    'Shankarabharanam': {
      swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3'],
      arohana: 'S R2 G3 M1 P D2 N3 Ṡ',
      avarohana: 'Ṡ N3 D2 P M1 G3 R2 S'
    },
    'Kalyani': {
      swaras: ['S', 'R2', 'G3', 'M2', 'P', 'D2', 'N3'],
      arohana: 'S R2 G3 M2 P D2 N3 Ṡ',
      avarohana: 'Ṡ N3 D2 P M2 G3 R2 S'
    },
    'Kharaharapriya': {
      swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D2', 'N2'],
      arohana: 'S R2 G2 M1 P D2 N2 Ṡ',
      avarohana: 'Ṡ N2 D2 P M1 G2 R2 S'
    },
    'Hanumatodi': {
      swaras: ['S', 'R1', 'G2', 'M1', 'P', 'D1', 'N2'],
      arohana: 'S R1 G2 M1 P D1 N2 Ṡ',
      avarohana: 'Ṡ N2 D1 P M1 G2 R1 S'
    },
    'Mohanam': {
      swaras: ['S', 'R2', 'G3', 'P', 'D2'],
      arohana: 'S R2 G3 P D2 Ṡ',
      avarohana: 'Ṡ D2 P G3 R2 S'
    },
    'Abhogi': {
      swaras: ['S', 'R2', 'G2', 'M1', 'D2'],
      arohana: 'S R2 G2 M1 D2 Ṡ',
      avarohana: 'Ṡ D2 M1 G2 R2 S'
    },
    'Sriranjani': {
      swaras: ['S', 'R2', 'G2', 'M1', 'D2', 'N2'],
      arohana: 'S R2 G2 M1 D2 N2 Ṡ',
      avarohana: 'Ṡ N2 D2 M1 G2 R2 S'
    },
    'Madhyamavati': {
      swaras: ['S', 'R2', 'M1', 'P', 'N2'],
      arohana: 'S R2 M1 P N2 Ṡ',
      avarohana: 'Ṡ N2 P M1 R2 S'
    },
    'Hamsadhwani': {
      swaras: ['S', 'R2', 'G3', 'P', 'N3'],
      arohana: 'S R2 G3 P N3 Ṡ',
      avarohana: 'Ṡ N3 P G3 R2 S'
    }
  };

  /* Tala presets: beat groups (laghu/drutam structure expressed as counts). */
  var TALAS = {
    'Adi (8)':        { groups: [4, 2, 2], subdivisions: 4 },
    'Rupaka (3)':     { groups: [1, 2],    subdivisions: 4 },
    'Rupaka (6)':     { groups: [2, 4],    subdivisions: 4 },
    'Misra Chapu (7)':{ groups: [3, 2, 2], subdivisions: 2 },
    'Khanda Chapu (5)':{groups: [2, 3],    subdivisions: 2 },
    'Triputa (7)':    { groups: [3, 2, 2], subdivisions: 4 },
    'Jhampa (10)':    { groups: [7, 1, 2], subdivisions: 4 },
    'Ata (14)':       { groups: [5, 5, 2, 2], subdivisions: 4 },
    'Dhruva (14)':    { groups: [4, 2, 4, 4], subdivisions: 4 },
    'Eka (4)':        { groups: [4],       subdivisions: 4 },
    'Free / no tala': { groups: [4],       subdivisions: 4 }
  };

  /* Western key names → semitones above C */
  var KEY_SEMITONES = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };

  function keyToFrequency(key, octave) {
    // A4 = 440 Hz. MIDI note = 12*(octave+1) + semitone.
    var semitone = KEY_SEMITONES[key];
    if (semitone === undefined) return 261.6255653005986;
    var midi = 12 * (octave + 1) + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function frequencyOf(saFrequency, semitone, octave) {
    return saFrequency * Math.pow(2, (semitone + 12 * octave) / 12);
  }

  /* ---------------------------------------------------------------------
     Character analysis: base letter + octave marks, column-preserving
     --------------------------------------------------------------------- */
  var COMBINING_ABOVE = '̇';   // dot above
  var COMBINING_BELOW = '̣';   // dot below

  function isCombining(ch) {
    var code = ch.charCodeAt(0);
    return (code >= 0x0300 && code <= 0x036F);
  }

  /* Decompose a single character so precomposed letters such as Ṡ (S with dot
     above) or Ṣ (S with dot below) are recognised without changing columns. */
  function analyseChar(ch) {
    var d = ch.normalize ? ch.normalize('NFD') : ch;
    var base = d.charAt(0);
    var above = d.indexOf(COMBINING_ABOVE) > 0;
    var below = d.indexOf(COMBINING_BELOW) > 0;
    return { base: base, above: above, below: below };
  }

  function isSwaraLetter(ch) {
    return 'SRGMPDN'.indexOf(ch.toUpperCase()) !== -1;
  }

  /* ---------------------------------------------------------------------
     Raga resolution
     --------------------------------------------------------------------- */
  /* Register or replace a raga at runtime. Custom ragas saved in the app land
     here, so they behave exactly like the built-in ones. */
  function registerRaga(name, def) {
    if (!name || !def || !def.swaras || !def.swaras.length) return false;
    RAGAS[name] = {
      swaras: def.swaras.slice(),
      defaults: def.defaults || null,
      arohana: def.arohana || def.swaras.join(' ') + ' Ṡ',
      avarohana: def.avarohana || 'Ṡ ' + def.swaras.slice().reverse().join(' '),
      custom: true
    };
    return true;
  }
  function unregisterRaga(name) {
    if (RAGAS[name] && RAGAS[name].custom) { delete RAGAS[name]; return true; }
    return false;
  }

  /* Read a scale written as swaras — "R2 G3 M1 D2 N2", or an arohana such as
     "S R2 G3 M1 P D2 N3 S" — into the variant list a raga context needs. S and P
     are added when the scale mentions them. Bare letters are recorded as
     defaults only when the scale also gives a variant for that letter, so an
     arohana written without numbers never invents a position. */
  function swarasFromScale(text) {
    if (!text) return null;
    var found = [], defaults = {};
    var tokens = String(text).match(/[SRGMPDNsrgmpdn][123]?/g) || [];
    tokens.forEach(function (tok) {
      var letter = tok.charAt(0).toUpperCase();
      var digit = tok.length > 1 ? tok.charAt(1) : '';
      var name = (letter === 'S' || letter === 'P') ? letter : letter + digit;
      if (!digit && letter !== 'S' && letter !== 'P') return;   // bare letter: no position given
      if (DEFAULT_POSITIONS[name] === undefined) return;
      if (found.indexOf(name) === -1) found.push(name);
      if (digit) defaults[letter] = name;
    });
    if (!found.length) return null;
    if (found.indexOf('S') === -1) found.unshift('S');
    found.sort(function (a, b) { return ALL_SWARA_NAMES.indexOf(a) - ALL_SWARA_NAMES.indexOf(b); });
    return { swaras: found, defaults: defaults };
  }

  function buildRagaContext(ragaName, positions, customSwaras, customDefaults) {
    var raga = RAGAS[ragaName] || RAGAS['Chromatic (all swaras)'];
    var swaras = customSwaras && customSwaras.length ? customSwaras : raga.swaras;
    var byLetter = {};
    swaras.forEach(function (name) {
      var letter = name.charAt(0);
      if (!byLetter[letter]) byLetter[letter] = [];
      byLetter[letter].push(name);
    });
    var defaults = null;
    if (raga.defaults || customDefaults) {
      defaults = Object.assign({}, raga.defaults || {}, customDefaults || {});
      // a default only counts if the raga actually contains that variant
      Object.keys(defaults).forEach(function (letter) {
        if (swaras.indexOf(defaults[letter]) === -1) delete defaults[letter];
      });
      if (!Object.keys(defaults).length) defaults = null;
    }
    return {
      name: ragaName,
      swaras: swaras,
      byLetter: byLetter,
      defaults: defaults,
      positions: positions || DEFAULT_POSITIONS,
      arohana: raga.arohana || '',
      avarohana: raga.avarohana || ''
    };
  }

  /* Resolve a written swara (letter + optional variant digit) to a named
     swara and a semitone. Returns { name, semitone, error, warning }. */
  function resolveSwara(letter, digit, ctx) {
    letter = letter.toUpperCase();
    if (digit) {
      var explicit = letter + digit;
      if (ctx.positions[explicit] === undefined) {
        return { error: 'Unknown swara "' + explicit + '"' };
      }
      var known = ctx.swaras.indexOf(explicit) !== -1;
      return {
        name: explicit,
        semitone: ctx.positions[explicit],
        warning: known ? null : explicit + ' is not part of ' + ctx.name
      };
    }
    // Bare letter: S and P have no variants.
    if (letter === 'S' || letter === 'P') {
      if (ctx.swaras.indexOf(letter) === -1) {
        return { error: letter + ' is not part of ' + ctx.name + '. Add it to the raga or correct the notation.' };
      }
      return { name: letter, semitone: ctx.positions[letter] };
    }
    var candidates = ctx.byLetter[letter];
    if (!candidates || candidates.length === 0) {
      if (ctx.defaults && ctx.defaults[letter]) {
        var def = ctx.defaults[letter];
        return { name: def, semitone: ctx.positions[def] };
      }
      return { error: letter + ' is not part of ' + ctx.name + '. Assign its position or correct the notation.' };
    }
    if (candidates.length > 1) {
      if (ctx.defaults && ctx.defaults[letter] && candidates.indexOf(ctx.defaults[letter]) !== -1) {
        var d = ctx.defaults[letter];
        return { name: d, semitone: ctx.positions[d] };
      }
      return { error: letter + ' is ambiguous in ' + ctx.name + ' (' + candidates.join(', ') + '). Write the variant explicitly.' };
    }
    return { name: candidates[0], semitone: ctx.positions[candidates[0]] };
  }

  /* ---------------------------------------------------------------------
     Line classification
     --------------------------------------------------------------------- */
  var RE_SECTION = /^\s*\[\s*SECTION\s*:?\s*(.*?)\s*\]\s*$/i;
  var RE_SWARA_MARK = /^\s*\[\s*SWARA\s*\]\s*$/i;
  var RE_SAHITYA_MARK = /^\s*\[\s*SAHITYA\s*\]\s*$/i;
  var RE_COMMENT = /^\s*(#|\/\/)/;
  var RE_TITLE = /^\s*\[\s*TITLE\s*:?\s*(.*?)\s*\]\s*$/i;
  /* Any other [KEY: value] line is song metadata — raga, tala, tempo, tonic,
     composer — so a song file carries the settings it should be played with. */
  var RE_META = /^\s*\[\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*:\s*(.*?)\s*\]\s*$/;
  /* The same field goes by several names in practice; all of them are accepted
     and stored under one key. */
  var META_ALIASES = {
    SONG: 'TITLE', NAME: 'TITLE',
    AROHANAM: 'AROHANA', ARO: 'AROHANA', ASCENT: 'AROHANA',
    AVAROHANAM: 'AVAROHANA', AVA: 'AVAROHANA', DESCENT: 'AVAROHANA',
    SRUTHI: 'SA', SRUTI: 'SA', SHRUTI: 'SA', TONIC: 'SA', KEY: 'SA',
    THALA: 'TALA', TAALA: 'TALA', TAL: 'TALA',
    TEMPO: 'BPM', SPEED: 'BPM',
    GATI: 'NADAI', NADAY: 'NADAI',
    AKSHARAS: 'BEATS', BEAT: 'BEATS',
    COMPOSER_NAME: 'COMPOSER', VAGGEYAKARA: 'COMPOSER',
    RAAGA: 'RAGA', RAGAM: 'RAGA', RAAGAM: 'RAGA'
  };
  function metaKey(raw) {
    var key = raw.trim().toUpperCase().replace(/[\s_-]+/g, '');
    return META_ALIASES[key] || key;
  }

  /* Heuristic used only when the text carries no [SWARA]/[SAHITYA] markers.
     It never starts playback on its own — the UI shows the assignment for
     review. */
  function looksLikeSwaraRow(text) {
    var stripped = text.replace(/[\s,|\[\]'._\-\/\\~\u0300-\u036F0-9]/g, '');
    if (stripped.length === 0) return text.replace(/\s/g, '').length > 0;
    var swaraChars = 0;
    for (var i = 0; i < stripped.length; i++) {
      var a = analyseChar(stripped.charAt(i));
      if (isSwaraLetter(a.base)) swaraChars++;
    }
    return swaraChars === stripped.length;
  }

  function classifyLines(source, overrides) {
    overrides = overrides || {};
    var lines = source.split('\n');
    var out = [];
    var pendingRole = null;      // set by an explicit [SWARA] / [SAHITYA] marker
    var currentSection = '';
    var title = null;
    var meta = {};
    var expectRole = 'swara';
    var hasMarkers = /\[\s*SWARA\s*\]/i.test(source);

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var entry = { index: i, text: raw, role: 'blank', section: currentSection, auto: true };

      var mTitle = raw.match(RE_TITLE);
      var mSection = raw.match(RE_SECTION);

      if (mTitle) {
        title = mTitle[1];
        meta.TITLE = mTitle[1];
        entry.role = 'meta';
      } else if (mSection) {
        currentSection = mSection[1];
        entry.role = 'section';
        entry.section = currentSection;
        expectRole = 'swara';
      } else if (RE_SWARA_MARK.test(raw)) {
        entry.role = 'marker';
        pendingRole = 'swara';
      } else if (RE_SAHITYA_MARK.test(raw)) {
        entry.role = 'marker';
        pendingRole = 'sahitya';
      } else if (RE_COMMENT.test(raw)) {
        entry.role = 'comment';
      } else if (RE_META.test(raw) && !pendingRole) {
        var m = raw.match(RE_META);
        meta[metaKey(m[1])] = m[2];
        entry.role = 'meta';
      } else if (raw.trim() === '') {
        entry.role = 'blank';
        expectRole = 'swara';
      } else if (pendingRole) {
        entry.role = pendingRole;
        entry.auto = false;
      } else if (!hasMarkers) {
        /* Without [SWARA]/[SAHITYA] markers, follow the usual convention: in
           each block of consecutive lines the notation comes first and its
           lyric line follows. A blank line or a section heading starts a new
           block. Judging each line on its own gets this wrong — a swara row
           holding a phrasing dash reads as text, and a lyric row reading
           "sa ri ga ma" reads as notation. */
        if (expectRole === 'swara' && !looksLikeSwaraRow(raw) && looksLikeSwaraRow(lines[i + 1] || '')) {
          entry.role = 'sahitya';        // a stray line ahead of the notation
        } else {
          entry.role = expectRole;
          expectRole = (expectRole === 'swara') ? 'sahitya' : 'swara';
        }
        entry.needsReview = true;
      } else {
        entry.role = 'comment';
      }

      if (overrides[i]) { entry.role = overrides[i]; entry.auto = false; entry.needsReview = false; }
      out.push(entry);
    }
    return { lines: out, title: title, meta: meta, hasMarkers: hasMarkers };
  }

  /* ---------------------------------------------------------------------
     Swara row parsing
     --------------------------------------------------------------------- */
  function parseSwaraRow(text, lineIndex, ctx, state, errors, warnings) {
    var events = [];
    var marks = [];           // bar lines etc, for display
    var i = 0;
    var speedGroupOpenAt = -1;
    var speedGroupId = null;
    var groupCounter = state.groupCounter;

    /* Every message carries the exact character range it covers, so the editor
       can highlight the offending text rather than just naming a line. */
    function pushError(col, message, severity, endCol) {
      (severity === 'warning' ? warnings : errors).push({
        line: lineIndex,
        column: col,
        endColumn: (typeof endCol === 'number' && endCol > col) ? endCol : col + 1,
        message: message,
        severity: severity || 'error'
      });
    }

    while (i < text.length) {
      var ch = text.charAt(i);

      if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

      if (ch === '[') {
        if (speedGroupOpenAt !== -1) {
          pushError(i, 'Nested square brackets are not allowed.');
          return { events: events, marks: marks, groupCounter: groupCounter, fatal: true };
        }
        speedGroupOpenAt = i;
        groupCounter++;
        speedGroupId = 'group-' + groupCounter;
        i++;
        continue;
      }

      if (ch === ']') {
        if (speedGroupOpenAt === -1) {
          pushError(i, 'Closing bracket with no opening bracket.');
          return { events: events, marks: marks, groupCounter: groupCounter, fatal: true };
        }
        speedGroupOpenAt = -1;
        speedGroupId = null;
        i++;
        continue;
      }

      /* Reading aids — phrasing dashes and gamakam marks. Displayed, silent,
         and they take no time, exactly like a bar line. */
      if ('-/\\~'.indexOf(ch) !== -1) {
        marks.push({ type: 'mark', glyph: ch, line: lineIndex, column: i, atSpace: state.space });
        i++;
        continue;
      }

      if (ch === '|') {
        var double = text.charAt(i + 1) === '|';
        marks.push({
          type: double ? 'doublebar' : 'bar',
          line: lineIndex,
          column: i,
          atSpace: state.space
        });
        i += double ? 2 : 1;
        continue;
      }

      if (ch === ',') {
        var add0 = speedGroupOpenAt !== -1 ? 0.5 : 1;
        /* A comma with nothing before it in this section is silence, not a
           sustain: this is how a song with an eduppu enters after sam. */
        if (!state.lastEvent) {
          var rest = {
            id: 'e' + state.eventCounter++,
            swara: ',', resolvedSwara: 'rest', semitone: null, valid: true,
            error: null, warning: null, isRest: true,
            octave: 0, durationInSpaces: add0, commaCount: 0,
            speed: speedGroupOpenAt !== -1 ? 2 : 1,
            insideSpeedGroup: speedGroupOpenAt !== -1,
            speedGroupId: speedGroupOpenAt !== -1 ? speedGroupId : null,
            section: state.section, sahitya: null, startSpace: state.space,
            sourceLine: lineIndex, sourceStartColumn: i, sourceEndColumn: i + 1
          };
          state.space += add0;
          state.lastEvent = rest;
          events.push(rest);
          i++;
          continue;
        }
        var last = state.lastEvent;
        var add = add0;
        last.durationInSpaces += add;
        last.commaCount += 1;
        last.sourceEndColumn = (last.sourceLine === lineIndex) ? i + 1 : last.sourceEndColumn;
        state.space += add;
        i++;
        continue;
      }

      var info = analyseChar(ch);

      // Leading dot = lower octave, e.g. .N
      var lowerByDot = false;
      var startCol = i;
      if (ch === '.') {
        var nextInfo = i + 1 < text.length ? analyseChar(text.charAt(i + 1)) : null;
        if (nextInfo && isSwaraLetter(nextInfo.base)) {
          lowerByDot = true;
          i++;
          ch = text.charAt(i);
          info = analyseChar(ch);
        } else {
          pushError(i, 'Stray "." — a lower-octave dot must sit before a swara.');
          i++;
          continue;
        }
      }

      if (!isSwaraLetter(info.base)) {
        /* A stray word in a swara row — usually a sahitya line that was not
           marked as one — is reported once, over the whole word, rather than
           once per character. */
        if (/[\p{L}]/u.test(info.base)) {
          var wordStart = i;
          while (i < text.length) {
            var wc = analyseChar(text.charAt(i));
            if (/[\p{L}\p{N}]/u.test(wc.base) || isCombining(text.charAt(i))) i++;
            else break;
          }
          var word = text.slice(wordStart, i);
          pushError(wordStart,
            '"' + word + '" is not a swara. Swara rows use S R G M P D N with optional variant numbers — ' +
            'if this is lyric text, mark the row as sahitya.',
            'error', i);
          continue;
        }
        pushError(i, 'Unexpected character "' + ch + '" in a swara row. ' +
          'Swara rows take S R G M P D N, commas, square brackets and bar lines.', 'error', i + 1);
        i++;
        continue;
      }

      var letter = info.base.toUpperCase();
      var above = info.above;
      var below = info.below || lowerByDot;
      i++;

      // combining marks written as separate characters
      while (i < text.length && isCombining(text.charAt(i))) {
        var mark = text.charAt(i);
        if (mark === COMBINING_ABOVE) above = true;
        else if (mark === COMBINING_BELOW) below = true;
        i++;
      }

      // variant digit
      var digit = '';
      if (i < text.length && /[1-3]/.test(text.charAt(i))) {
        digit = text.charAt(i);
        i++;
      }

      // apostrophe forms: N' = upper, N'' = two octaves up, N_ = lower
      while (i < text.length && (text.charAt(i) === "'" || text.charAt(i) === '’')) {
        above = above ? 'double' : true;
        i++;
      }
      while (i < text.length && text.charAt(i) === '_') {
        below = below ? 'double' : true;
        i++;
      }

      /* A swara letter glued to a non-swara letter is a word, not notation:
         "govardhana" in a swara row is reported once, over the whole word. */
      if (i < text.length) {
        var nextInfo2 = analyseChar(text.charAt(i));
        if (/[\p{L}]/u.test(nextInfo2.base) && !isSwaraLetter(nextInfo2.base)) {
          var wStart = startCol;
          while (i < text.length) {
            var wc2 = analyseChar(text.charAt(i));
            if (/[\p{L}\p{N}]/u.test(wc2.base) || isCombining(text.charAt(i))) i++;
            else break;
          }
          pushError(wStart,
            '"' + text.slice(wStart, i) + '" is not a swara. Swara rows use S R G M P D N with optional variant ' +
            'numbers — if this is lyric text, mark the row as sahitya.',
            'error', i);
          continue;
        }
      }

      var tokenEnd = i;
      if (above && below) {
        pushError(startCol, 'Ambiguous octave mark on "' + letter + '" — it has both an upper and a lower mark.',
          'error', tokenEnd);
      }

      var octave = 0;
      if (above) octave = above === 'double' ? 2 : 1;
      else if (below) octave = below === 'double' ? -2 : -1;

      var resolved = resolveSwara(letter, digit, ctx);
      if (resolved.error) pushError(startCol, resolved.error, 'error', tokenEnd);
      if (resolved.warning) pushError(startCol, resolved.warning, 'warning', tokenEnd);

      var inGroup = speedGroupOpenAt !== -1;
      var duration = inGroup ? 0.5 : 1;

      var event = {
        id: 'e' + state.eventCounter++,
        swara: letter + digit,
        resolvedSwara: resolved.name || (letter + digit),
        semitone: resolved.semitone !== undefined ? resolved.semitone : null,
        valid: !resolved.error,
        error: resolved.error || null,
        warning: resolved.warning || null,
        octave: octave,
        durationInSpaces: duration,
        commaCount: 0,
        speed: inGroup ? 2 : 1,
        insideSpeedGroup: inGroup,
        speedGroupId: inGroup ? speedGroupId : null,
        section: state.section,
        sahitya: null,
        startSpace: state.space,
        sourceLine: lineIndex,
        sourceStartColumn: startCol,
        sourceEndColumn: i
      };
      state.space += duration;
      state.lastEvent = event;
      events.push(event);
    }

    if (speedGroupOpenAt !== -1) {
      pushError(speedGroupOpenAt, 'Unmatched "[" — the double-speed phrase is never closed.');
      return { events: events, marks: marks, groupCounter: groupCounter, fatal: true };
    }

    return { events: events, marks: marks, groupCounter: groupCounter, fatal: false };
  }

  /* ---------------------------------------------------------------------
     Sahitya tokenising and linking
     --------------------------------------------------------------------- */
  function tokeniseSahitya(text, lineIndex) {
    var tokens = [];
    var re = /\S+/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      tokens.push({
        id: 'sy' + lineIndex + '_' + m.index,
        text: m[0],
        line: lineIndex,
        startColumn: m.index,
        endColumn: m.index + m[0].length,
        offset: 0,
        anchorEventId: null,
        anchorIndex: -1
      });
    }
    return tokens;
  }

  /* Attach each sahitya token to the swara event it sits beneath. */
  function linkSahitya(tokens, events, links) {
    if (!events.length) return;
    tokens.forEach(function (token) {
      if (links && links[token.id]) {
        var forced = null;
        for (var k = 0; k < events.length; k++) if (events[k].id === links[token.id]) forced = events[k];
        if (forced) {
          token.anchorEventId = forced.id;
          return;
        }
      }
      var best = events[0];
      for (var j = 0; j < events.length; j++) {
        if (events[j].sourceStartColumn <= token.startColumn) best = events[j];
        else break;
      }
      token.anchorEventId = best.id;
    });
  }

  /* ---------------------------------------------------------------------
     Full document parse
     --------------------------------------------------------------------- */
  function parse(source, options) {
    options = options || {};
    var ctx = buildRagaContext(
      options.raga || 'Chromatic (all swaras)',
      options.positions || DEFAULT_POSITIONS,
      options.ragaSwaras,
      options.ragaDefaults
    );
    var classified = classifyLines(source, options.roleOverrides);
    var errors = [];
    var warnings = [];
    var events = [];
    var marks = [];
    var sahityaTokens = [];
    var rows = [];               // display rows: swara row + its sahitya row
    var sections = [];

    var state = {
      space: 0,
      eventCounter: 0,
      groupCounter: 0,
      lastEvent: null,
      section: ''
    };

    var pendingSwaraRow = null;
    var lines = classified.lines;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      state.section = line.section;

      if (line.role === 'section') {
        state.lastEvent = null;
        sections.push({ name: line.section, atSpace: state.space, line: i });
        if (pendingSwaraRow) { rows.push(pendingSwaraRow); pendingSwaraRow = null; }
        rows.push({ type: 'section', name: line.section, line: i });
        continue;
      }

      if (line.role === 'swara') {
        if (pendingSwaraRow) { rows.push(pendingSwaraRow); pendingSwaraRow = null; }
        var res = parseSwaraRow(line.text, i, ctx, state, errors, warnings);
        state.groupCounter = res.groupCounter;
        events = events.concat(res.events);
        marks = marks.concat(res.marks);
        pendingSwaraRow = {
          type: 'passage',
          section: line.section,
          swaraLine: i,
          swaraText: line.text,
          events: res.events,
          marks: res.marks,
          sahityaLine: null,
          sahityaText: null,
          sahityaTokens: []
        };
        continue;
      }

      if (line.role === 'sahitya') {
        var tokens = tokeniseSahitya(line.text, i);
        if (pendingSwaraRow) {
          linkSahitya(tokens, pendingSwaraRow.events, options.sahityaLinks);
          pendingSwaraRow.sahityaLine = i;
          pendingSwaraRow.sahityaText = line.text;
          pendingSwaraRow.sahityaTokens = tokens;
          sahityaTokens = sahityaTokens.concat(tokens);
          rows.push(pendingSwaraRow);
          pendingSwaraRow = null;
        } else {
          rows.push({ type: 'text', role: 'sahitya', text: line.text, line: i });
        }
        continue;
      }

      if (line.role === 'comment' || line.role === 'meta') {
        if (pendingSwaraRow) { rows.push(pendingSwaraRow); pendingSwaraRow = null; }
        if (line.text.trim() !== '') rows.push({ type: 'text', role: line.role, text: line.text, line: i });
      }
    }
    if (pendingSwaraRow) rows.push(pendingSwaraRow);

    // index sahitya anchors against the global event order
    var indexOf = {};
    events.forEach(function (e, idx) { indexOf[e.id] = idx; });
    sahityaTokens.forEach(function (t) {
      t.anchorIndex = t.anchorEventId !== null && indexOf[t.anchorEventId] !== undefined ? indexOf[t.anchorEventId] : -1;
    });
    // Give every event the syllable sounding over it. A syllable is carried
    // forward only inside its own passage, never across a passage boundary.
    rows.forEach(function (row) {
      if (row.type !== 'passage') return;
      var byAnchor = {};
      row.sahityaTokens.forEach(function (t) { if (t.anchorEventId) byAnchor[t.anchorEventId] = t; });
      var current = null;
      row.events.forEach(function (e) {
        if (byAnchor[e.id]) current = byAnchor[e.id];
        if (current) { e.sahitya = current.text; e.sahityaId = current.id; }
      });
    });

    var totalSpaces = state.space;

    return {
      source: source,
      title: classified.title,
      meta: classified.meta,
      lines: lines,
      rows: rows,
      events: events,
      marks: marks,
      sections: sections,
      sahityaTokens: sahityaTokens,
      errors: errors,
      warnings: warnings,
      totalSpaces: totalSpaces,
      raga: ctx,
      needsReview: lines.some(function (l) { return l.needsReview; })
    };
  }

  /* ---------------------------------------------------------------------
     Timing
     --------------------------------------------------------------------- */
  function timing(parsed, config) {
    var bpm = config.bpm || 60;
    var subdivisions = config.subdivisionsPerBeat || 4;
    var beatsPerCycle = config.beatsPerCycle || 8;
    var secondsPerBeat = 60 / bpm;
    var secondsPerNoteSpace = secondsPerBeat / subdivisions;

    var schedule = parsed.events.map(function (e) {
      return {
        event: e,
        startSpace: e.startSpace,
        startTime: e.startSpace * secondsPerNoteSpace,
        duration: e.durationInSpaces * secondsPerNoteSpace,
        beat: Math.floor(e.startSpace / subdivisions),
        cycle: Math.floor(e.startSpace / (subdivisions * beatsPerCycle)),
        beatInCycle: Math.floor(e.startSpace / subdivisions) % beatsPerCycle,
        subdivision: e.startSpace % subdivisions
      };
    });

    var totalSeconds = parsed.totalSpaces * secondsPerNoteSpace;
    var spacesPerCycle = subdivisions * beatsPerCycle;
    var cycleFit = parsed.totalSpaces % spacesPerCycle;

    return {
      secondsPerBeat: secondsPerBeat,
      secondsPerNoteSpace: secondsPerNoteSpace,
      spacesPerCycle: spacesPerCycle,
      totalSeconds: totalSeconds,
      schedule: schedule,
      cycleRemainder: cycleFit
    };
  }

  /* ---------------------------------------------------------------------
     Cycle alignment, line by line

     Reports how each swara row sits against the tala cycle, so a piece that
     does not fill whole cycles can be traced to the lines responsible rather
     than to the total alone. A row whose own length is not a whole number of
     cycles is an "offender"; rows after it inherit the drift and are reported
     separately, as knock-on lines.
     --------------------------------------------------------------------- */
  /* How far into the cycle the first sounding swara falls — the eduppu — read
     from the rests the notation itself carries. */
  function eduppuOf(parsed, config) {
    var cycleSpaces = (config.subdivisionsPerBeat || 4) * (config.beatsPerCycle || 8);
    var first = null;
    for (var i = 0; i < parsed.events.length; i++) {
      if (!parsed.events[i].isRest) { first = parsed.events[i]; break; }
    }
    if (!first) return null;
    var offset = round6(first.startSpace % cycleSpaces);
    return {
      spaces: offset,
      beats: round6(offset / (config.subdivisionsPerBeat || 4)),
      onSam: offset === 0
    };
  }

  function cycleReport(parsed, config) {
    var subdivisions = config.subdivisionsPerBeat || 4;
    var beatsPerCycle = config.beatsPerCycle || 8;
    var cycleSpaces = subdivisions * beatsPerCycle;
    var rows = [];
    var sections = [];
    var byName = {};

    /* A song with an eduppu enters after sam, so every cycle boundary in the
       piece sits that many note-spaces later. Measure from there, otherwise a
       correctly written song reads as permanently off the beat. */
    var ed = eduppuOf(parsed, config);
    var eduppu = ed ? ed.spaces : 0;
    function offsetFrom(space) {
      return round6((((space - eduppu) % cycleSpaces) + cycleSpaces) % cycleSpaces);
    }

    parsed.rows.forEach(function (row) {
      if (row.type !== 'passage' || !row.events.length) return;
      var spaces = row.events.reduce(function (sum, e) { return sum + e.durationInSpaces; }, 0);
      var startSpace = row.events[0].startSpace;
      var name = row.events[0].section || '';
      /* Leading rests are the eduppu padding: the line still begins at sam,
         so measure where it starts from its first sounding note. */
      var firstSounding = startSpace;
      for (var ri = 0; ri < row.events.length; ri++) {
        if (!row.events[ri].isRest) { firstSounding = row.events[ri].startSpace; break; }
      }
      var entry = {
        line: row.swaraLine,
        sahityaLine: row.sahityaLine,
        section: name,
        startSpace: round6(startSpace),
        spaces: round6(spaces),
        cycles: round6(spaces / cycleSpaces),
        startOffset: offsetFrom(firstSounding),
        endOffset: offsetFrom(startSpace + spaces)
      };
      entry.endSpace = round6(startSpace + spaces);
      entry.startsOnBoundary = entry.startOffset === 0;
      entry.endsOnBoundary = entry.endOffset === 0;
      entry.wholeCycles = round6(spaces % cycleSpaces) === 0;
      rows.push(entry);

      if (!byName[name]) {
        byName[name] = { name: name, lines: [], spaces: 0, startSpace: round6(startSpace) };
        sections.push(byName[name]);
      }
      byName[name].lines.push(row.swaraLine);
      byName[name].spaces = round6(byName[name].spaces + spaces);
      byName[name].endSpace = entry.endSpace;
    });

    /* A section is the unit that should close on a cycle. Half-cycle lines
       inside a section that adds up are ordinary notation, not a mistake. */
    sections.forEach(function (s) {
      s.remainder = round6(s.spaces % cycleSpaces);
      s.shortBy = s.remainder > 0 ? round6(cycleSpaces - s.remainder) : 0;
      s.cycles = round6(s.spaces / cycleSpaces);
      s.aligned = s.remainder === 0 || offsetFrom(s.endSpace) === 0;
      s.startsOnBoundary = offsetFrom(s.startSpace) === 0 || s.startSpace === 0;
    });

    // The lines worth naming: those inside a section that does not close,
    // which end away from a beat of the cycle. Reported one by one — a
    // whole-passage total is no help to someone hunting for the line to fix.
    var offenders = rows.filter(function (r) {
      var s = byName[r.section];
      return s && !s.aligned && !r.endsOnBoundary;
    });

    // Lines pushed off the beat by an earlier section rather than by themselves.
    var knockOn = rows.filter(function (r) {
      var s = byName[r.section];
      return s && s.aligned && !s.startsOnBoundary && r === rows[rows.indexOf(r)] && !r.startsOnBoundary;
    });

    var remainder = offsetFrom(parsed.totalSpaces);
    return {
      cycleSpaces: cycleSpaces,
      eduppuSpaces: eduppu,
      totalSpaces: round6(parsed.totalSpaces),
      totalCycles: round6((parsed.totalSpaces - eduppu) / cycleSpaces),
      remainder: remainder,
      shortBy: remainder > 0 ? round6(cycleSpaces - remainder) : 0,
      rows: rows,
      sections: sections,
      offenders: offenders,
      knockOn: knockOn,
      aligned: remainder === 0 && !offenders.length
    };
  }

  function round6(n) { return Math.round(n * 1e6) / 1e6; }

  /* Metronome grid over the whole piece. */
  function metronomeGrid(totalSpaces, config) {
    var subdivisions = config.subdivisionsPerBeat || 4;
    var beatsPerCycle = config.beatsPerCycle || 8;
    var groups = config.beatGroups && config.beatGroups.length ? config.beatGroups : null;
    var accents = {};
    if (groups) {
      var at = 0;
      groups.forEach(function (g) { accents[at] = true; at += g; });
    }
    var ticks = [];
    for (var space = 0; space < totalSpaces; space++) {
      var isBeat = space % subdivisions === 0;
      var beat = space / subdivisions;
      if (isBeat) {
        var beatInCycle = beat % beatsPerCycle;
        var kind = beatInCycle === 0 ? 'cycle' : (accents[beatInCycle] ? 'group' : 'beat');
        ticks.push({ space: space, kind: kind, beat: beat, beatInCycle: beatInCycle });
      } else {
        ticks.push({ space: space, kind: 'sub' });
      }
    }
    return ticks;
  }

  /* ---------------------------------------------------------------------
     Display normalisation of octave marks
     --------------------------------------------------------------------- */
  function displaySwara(event) {
    if (event.isRest) return '\u00b7';
    var text = event.swara;
    if (event.octave > 0) text = text.charAt(0) + COMBINING_ABOVE + text.slice(1);
    else if (event.octave < 0) text = text.charAt(0) + COMBINING_BELOW + text.slice(1);
    return text;
  }

  /* ---------------------------------------------------------------------
     Text export
     --------------------------------------------------------------------- */
  function safeFilename(title) {
    var base = (title || '').trim();
    if (!base) return 'Carnatic_Notation.txt';
    return base.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 80) + '.txt';
  }

  return {
    DEFAULT_POSITIONS: DEFAULT_POSITIONS,
    ALL_SWARA_NAMES: ALL_SWARA_NAMES,
    RAGAS: RAGAS,
    TALAS: TALAS,
    KEY_SEMITONES: KEY_SEMITONES,
    keyToFrequency: keyToFrequency,
    frequencyOf: frequencyOf,
    buildRagaContext: buildRagaContext,
    registerRaga: registerRaga,
    swarasFromScale: swarasFromScale,
    unregisterRaga: unregisterRaga,
    resolveSwara: resolveSwara,
    classifyLines: classifyLines,
    parse: parse,
    timing: timing,
    cycleReport: cycleReport,
    eduppuOf: eduppuOf,
    metronomeGrid: metronomeGrid,
    displaySwara: displaySwara,
    safeFilename: safeFilename
  };
})();

export default CarnaticEngine;
