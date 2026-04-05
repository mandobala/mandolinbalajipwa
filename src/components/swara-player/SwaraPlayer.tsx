// Independent function to normalize scale notes (e.g., R1 G3 M2 D N3 -> R G M D N)
// Normalize notes in a string using the scale as reference (replace R1, G3, etc. with R, G, etc. if present in scale)
function normalizeNotesWithScale(notes: string, scale: string): string {
  // Build a set of all variant notes from the scale (e.g., R1, G3, M2)
  const variantNotes = new Set(
    scale.split(/\s+/)
      .filter(n => /^[SRGMPDN][1-9]$/i.test(n))
  );
  // Map variant notes to their base notes
  const variantToBase: Record<string, string> = {};
  variantNotes.forEach(n => {
    variantToBase[n.toUpperCase()] = n[0].toUpperCase();
  });
  // Replace all occurrences in the notes area
  return notes.replace(/([SRGMPDN][1-9])/gi, (m) => {
    return variantToBase[m.toUpperCase()] || m;
  });
}
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './swara-player.css';
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Play,
  Square,
  Save,
  Trash2,
  Delete,
  Music,
  Upload,
  Download,
  Wand2,
  Zap,
  Hash,
  LogOut,
  X
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { audioEngine } from '../notation-player/lib/audio';
import { exportMidi } from '../notation-player/lib/midi';
import type { MetaData, Octave } from '../notation-player/types';
import {
  DOT_ABOVE_MAP,
  DOT_BELOW_MAP,
  REVERSE_MAP,
  getSemitones
} from '../notation-player/lib/music';

interface Props {
  user: User;
  onSignOut: () => void;
}

export default function SwaraPlayer({ user, onSignOut }: Props) {
  const [editor, setEditor] = useState({ notes: '', cursorStart: 0, cursorEnd: 0 });
  const { notes } = editor;
  const applyEdit = (notes: string, cursorStart: number, cursorEnd: number = cursorStart) =>
    setEditor({ notes, cursorStart, cursorEnd });
  const [meta, setMeta] = useState<MetaData>({
    song: 'Varnam',
    composer: '',
    raga: 'Mayamalavagowla',
    arohana: '',
    avarohana: '',
    scale: 'R1 G3 M1 D1 N3',
    beats: 8,
    nadai: 4,
    sruthi: 'C#',
    bpm: 80,
    thala: '',
    edam: '',
    tags: '',
    gistId: ''
  });
  const [githubToken, setGithubToken] = useState<string>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('gh_gist_token') ?? '' : '')
  );
  const [gistStatus, setGistStatus] = useState<string>('');
  const [octave, setOctave] = useState<Octave>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [showOctaveToast, setShowOctaveToast] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState<{ lineIdx: number; noteIdx: number } | null>(null);
  const [loopEnd, setLoopEnd] = useState<{ lineIdx: number; noteIdx: number } | null>(null);
  const [settingMarker, setSettingMarker] = useState<'start' | 'end' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [songList, setSongList] = useState<{ name: string; song?: string; raga?: string; file?: string; url?: string; gistId?: string }[]>([]);
  const [edamMarked, setEdamMarked] = useState(false);

  const playbackRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(isPlaying);
  const isLoopingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (playbackRef.current) clearTimeout(playbackRef.current);
    };
  }, []);

  // Alt+U/D/N keyboard shortcuts for octave
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          setOctave('above');
          setShowOctaveToast(true);
          setTimeout(() => setShowOctaveToast(false), 1000);
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setOctave('below');
          setShowOctaveToast(true);
          setTimeout(() => setShowOctaveToast(false), 1000);
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          setOctave('normal');
          setShowOctaveToast(true);
          setTimeout(() => setShowOctaveToast(false), 1000);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Single source of truth for cursor: fires after React commits, before browser paints
  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(editor.cursorStart, editor.cursorEnd);
    }
  }, [editor.cursorStart, editor.cursorEnd]);

  // Sync highlight scroll with textarea scroll
  useEffect(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [notes]);


  const formatLine = (line: string) => {
    if (/^TAGS\b/i.test(line.trim()) || /^LR:/i.test(line.trim())) return line;
    const upperLine = line.toUpperCase();
    let clean = upperLine.replace(/\|/g, '').replace(/  +/g, ' ');
    const rawUnits = clean.match(/([A-Za-z0-9 ]+:|[SRGMPDNṠṘĠṀṖḊṄṢṚṂḌṆ][123]?\u0323?|,| |\{|\}|\[\d+:|\]|-)/gi) || [];
    const units = rawUnits.filter(u => u !== ' ');

    let beatProgress = 0;
    let formatted = '';
    let speedMultiplier = 1;
    let nadaiOverride: number | null = null;

    const isPlayable = (u: string) => /[SRGMPDNṠṘĠṀṖḊṄṢṚṂḌṆ,]/i.test(u) && !u.endsWith(':');

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const nextUnit = i < units.length - 1 ? units[i + 1] : null;

      if (unit === '{') speedMultiplier = 0.5;
      if (unit === '}') speedMultiplier = 1;
      if (unit.startsWith('[')) {
        const match = unit.match(/\d+/);
        if (match) nadaiOverride = parseInt(match[0]);
      }
      if (unit === ']') nadaiOverride = null;

      formatted += unit;

      if (isPlayable(unit)) {
        if (nadaiOverride) beatProgress += (1 / nadaiOverride);
        else beatProgress += (speedMultiplier / meta.nadai);
      }

      const isAtBeatBoundary = Math.abs(beatProgress - Math.round(beatProgress)) < 0.001 && beatProgress > 0;

      if (isAtBeatBoundary) {
        if (isPlayable(unit) || unit === '}' || unit === ']' || unit === '-') {
          if (nextUnit !== '-' && nextUnit !== '}' && nextUnit !== ']') {
            formatted += '|';
          }
        }
      } else {
        if (unit.endsWith(':')) {
          formatted += ' ';
        } else if (isPlayable(unit)) {
          if (nextUnit && isPlayable(nextUnit)) {
            formatted += ' ';
          }
        }
      }

      if (unit === '-' && isAtBeatBoundary && !formatted.endsWith('|')) {
        if (nextUnit !== '}' && nextUnit !== ']') {
          formatted += '|';
        }
      }
    }
    return formatted.trim();
  };

  const handleNadaiChange = (delta: number) => {
    const newNadai = Math.max(1, meta.nadai + delta);
    if (newNadai === meta.nadai) return;
    setMeta({ ...meta, nadai: newNadai });
  };

  const handleNoteClick = (note: string) => {
    let charToAdd = note;
    if (octave === 'above' && DOT_ABOVE_MAP[note]) {
      charToAdd = DOT_ABOVE_MAP[note];
    } else if (octave === 'below' && DOT_BELOW_MAP[note]) {
      charToAdd = DOT_BELOW_MAP[note];
    }

    if (charToAdd !== ',' && charToAdd !== '|') {
      const semitones = getSemitones(charToAdd, meta.scale);
      audioEngine.playNote(semitones, meta.sruthi, 0.3);
    }

    const start = textareaRef.current?.selectionStart ?? notes.length;
    const end = textareaRef.current?.selectionEnd ?? notes.length;
    const newNotes = notes.substring(0, start) + charToAdd + notes.substring(end);
    const newCursor = start + charToAdd.length;
    textareaRef.current?.focus();
    applyEdit(newNotes, newCursor);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.toUpperCase().normalize('NFC');
    const start = e.target.selectionStart || 0;

    if (edamMarked) setEdamMarked(false);

    if (isPlayingRef.current) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (playbackRef.current) clearTimeout(playbackRef.current);
    }

    if (newValue.length === notes.length + 1) {
      const charAdded = newValue[start - 1];
      if (['S', 'R', 'G', 'M', 'P', 'D', 'N'].includes(charAdded) ||
        Object.values(DOT_ABOVE_MAP).includes(charAdded) ||
        Object.values(DOT_BELOW_MAP).includes(charAdded)) {
        const semitones = getSemitones(charAdded, meta.scale);
        audioEngine.playNote(semitones, meta.sruthi, 0.3);
      }
    }

    applyEdit(newValue, start);
  };

  const handleBackspace = () => {
    const start = textareaRef.current?.selectionStart || 0;
    const end = textareaRef.current?.selectionEnd || 0;
    textareaRef.current?.focus();
    if (start === end && start > 0) {
      applyEdit(notes.substring(0, start - 1) + notes.substring(end), start - 1);
    } else {
      applyEdit(notes.substring(0, start) + notes.substring(end), start);
    }
  };

  const handleClear = () => {
    if (confirm('Clear all notes?')) applyEdit('', 0);
  };

  const parseContent = (content: string) => {
    const metaMatch = content.match(/MetaS:\s*(.*?)\s*MetaE:/s);
    if (metaMatch) {
      const metaStr = metaMatch[1];
      const parts = metaStr.split(/\s*\|\s*/);
      const newMeta = { ...meta };
      parts.forEach(part => {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) return;
        const key = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();
        if (key === 'Song') newMeta.song = value;
        if (key === 'Composer') newMeta.composer = value;
        if (key === 'Raga') newMeta.raga = value;
        if (key === 'Arohana') newMeta.arohana = value;
        if (key === 'Avarohana') newMeta.avarohana = value;
        if (key === 'Scale' || key === 'RagaNotes') newMeta.scale = value;
        if (key === 'Beats') newMeta.beats = parseInt(value) || 8;
        if (key === 'Nadai') newMeta.nadai = parseInt(value) || 4;
        if (key === 'Sruthi') newMeta.sruthi = value;
        if (key === 'BPM') newMeta.bpm = parseInt(value) || 80;
        if (key === 'Thala') newMeta.thala = value;
        if (key === 'Edam') newMeta.edam = value;
        if (key === 'Tags') newMeta.tags = value;
        if (key === 'GistId') newMeta.gistId = value;
      });
      setMeta(newMeta);
      const partsAfterMeta = content.split(/MetaE:\s*/);
      if (partsAfterMeta.length > 1) {
        let notationContent = partsAfterMeta[1];
        if (notationContent.startsWith('\n')) notationContent = notationContent.substring(1);
        applyEdit(notationContent.toUpperCase().normalize('NFC'), 0);
      }
    } else {
      applyEdit(content.toUpperCase().normalize('NFC'), 0);
    }
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      parseContent(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openPicker = async () => {
    if (songList.length === 0) {
      const res = await fetch('https://gist.githubusercontent.com/mandolinbalaji/2cccf69f0afcc5eb83099ab2f449edc9/raw/index.json');
      const data = await res.json();
      setSongList(data);
    }
    setShowPicker(true);
  };

  const loadFromGist = async (s: { name: string; song?: string; raga?: string; file?: string; url?: string; gistId?: string }) => {
    const fetchUrl = s.url ?? `/notesfromtext/${s.file ?? `${s.name}.txt`}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) return;
    const text = await res.text();
    parseContent(text);
    setShowPicker(false);
  };

  const saveFile = async () => {
    const fileName = `${meta.song || 'Song'}_${meta.raga || 'Raga'}.txt`;
    const content = `MetaS: Song: ${meta.song} | Composer: ${meta.composer} | Raga: ${meta.raga} | Arohana: ${meta.arohana} | Avarohana: ${meta.avarohana} | Scale: ${meta.scale} | Beats: ${meta.beats} | Nadai: ${meta.nadai} | Sruthi: ${meta.sruthi} | BPM: ${meta.bpm} | Thala: ${meta.thala} | Edam: ${meta.edam} | Tags: ${meta.tags} | GistId: ${meta.gistId || ''} | MetaE:\n${notes}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // Update index.json entry on the server
    const indexEntry = {
      name: meta.song || 'Song',
      song: meta.song || 'Song',
      composer: meta.composer || '',
      raga: meta.raga || 'Raga',
      tala: meta.thala || '',
      beats: String(meta.beats),
      arohana: meta.arohana || '',
      avarohana: meta.avarohana || '',
      scale: meta.scale || '',
      sruthi: meta.sruthi || '',
      edam: meta.edam || '',
      tags: meta.tags || '',
      file: fileName,
    };
    try {
      await fetch('/api/update-notation-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(indexEntry),
      });
    } catch {
      // Non-critical — file was already downloaded
    }
  };

  const saveToGist = async () => {
    if (!githubToken) { setGistStatus('Enter GitHub token first'); return; }
    const fileName = `${meta.song || 'Song'}_${meta.raga || 'Raga'}.txt`;
    const content = `MetaS: Song: ${meta.song} | Composer: ${meta.composer} | Raga: ${meta.raga} | Arohana: ${meta.arohana} | Avarohana: ${meta.avarohana} | Scale: ${meta.scale} | Beats: ${meta.beats} | Nadai: ${meta.nadai} | Sruthi: ${meta.sruthi} | BPM: ${meta.bpm} | Thala: ${meta.thala} | Edam: ${meta.edam} | Tags: ${meta.tags} | GistId: ${meta.gistId || ''} | MetaE:\n${notes}`;
    const body = { files: { [fileName]: { content } }, public: true };
    let gistId = meta.gistId;
    try {
      setGistStatus('Saving...');
      let res: Response;
      if (gistId) {
        res = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: { Authorization: `token ${githubToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: { Authorization: `token ${githubToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, description: `${meta.song} - ${meta.raga}` }),
        });
      }
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const data = await res.json();
      gistId = data.id;
      const gistUrl = `https://gist.githubusercontent.com/${data.owner.login}/${gistId}/raw/${fileName}`;
      setMeta(m => ({ ...m, gistId }));
      setGistStatus('Saved to Gist!');
      setTimeout(() => setGistStatus(''), 3000);
      const indexEntry = {
        name: meta.song || 'Song', song: meta.song || 'Song',
        composer: meta.composer || '', raga: meta.raga || 'Raga',
        tala: meta.thala || '', beats: String(meta.beats),
        arohana: meta.arohana || '', avarohana: meta.avarohana || '',
        scale: meta.scale || '', sruthi: meta.sruthi || '',
        edam: meta.edam || '', tags: meta.tags || '',
        file: fileName, url: gistUrl,
      };
      try {
        const indexGistId = '2cccf69f0afcc5eb83099ab2f449edc9';
        const idxRes = await fetch(`https://gist.githubusercontent.com/mandolinbalaji/${indexGistId}/raw/index.json`);
        const indexData: Record<string, unknown>[] = await idxRes.json();
        const existingIdx = indexData.findIndex((e: any) => e.file === fileName);
        if (existingIdx >= 0) {
          const existing = indexData[existingIdx];
          indexData[existingIdx] = { ...indexEntry };
          if ((existing as any).midiFile) (indexData[existingIdx] as any).midiFile = (existing as any).midiFile;
        } else {
          indexData.push(indexEntry);
        }
        await fetch(`https://api.github.com/gists/${indexGistId}`, {
          method: 'PATCH',
          headers: { Authorization: `token ${githubToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: { 'index.json': { content: JSON.stringify(indexData, null, 2) } } }),
        });
      } catch { /* Non-critical */ }
    } catch (e: any) {
      setGistStatus(`Error: ${e.message}`);
    }
  };

  const playNotation = async (customNotes?: string | React.MouseEvent, loopOverride?: boolean, customLineIdx?: number) => {
    if (isPlaying) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (playbackRef.current) clearTimeout(playbackRef.current);
      setActiveLineIdx(null);
      return;
    }

    audioEngine.unlock();

    const notesToPlay = (typeof customNotes === 'string' ? customNotes : notes) || '';
    if (!notesToPlay.trim()) return;

    isLoopingRef.current = loopOverride !== undefined ? loopOverride : (typeof customNotes === 'string') || (loopEnabled && !!(loopStart && loopEnd));

    await audioEngine.playClick(0.01);
    setIsPlaying(true);
    isPlayingRef.current = true;

    const playableUnits: { char: string; duration: number; lineIdx: number; unitIdx: number }[] = [];
    const beatDuration = (60 / meta.bpm) * 1000;
    const baseNoteDuration = beatDuration / meta.nadai;
    let speedMultiplier = 1;
    let nadaiOverride: number | null = null;

    if (typeof customNotes === 'string' && customLineIdx !== undefined) {
      const rawUnits = customNotes.match(/([A-Za-z0-9 ]+:|[SRGMPDN][123]?\u0323?|Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ|,|\||\{|\}|\[\d+:|\]|-)/gi) || [];
      rawUnits.forEach((u, unitIdx) => {
        if (u === '{') { speedMultiplier = 0.5; return; }
        if (u === '}') { speedMultiplier = 1; return; }
        if (u.startsWith('[')) { nadaiOverride = parseInt(u.match(/\d+/)![0]); return; }
        if (u === ']') { nadaiOverride = null; return; }
        if (u === '-') return;
        if (u !== '|' && !u.endsWith(':') && u !== ' ') {
          let duration = baseNoteDuration * speedMultiplier;
          if (nadaiOverride) duration = beatDuration / nadaiOverride;
          playableUnits.push({ char: u, duration, lineIdx: customLineIdx, unitIdx });
        }
      });
    } else {
      const lines = notes.split('\n');

      // Normalize loop range so start <= end
      let effectiveStart = loopStart;
      let effectiveEnd = loopEnd;
      if (loopEnabled && loopStart && loopEnd) {
        const startBefore = loopStart.lineIdx < loopEnd.lineIdx ||
          (loopStart.lineIdx === loopEnd.lineIdx && loopStart.noteIdx <= loopEnd.noteIdx);
        if (!startBefore) { effectiveStart = loopEnd; effectiveEnd = loopStart; }
      }
      const useLoop = loopEnabled && !!(effectiveStart && effectiveEnd);

      lines.forEach((line, lineIdx) => {
        if (/^TAGS\b/i.test(line.trim()) || /^LR:/i.test(line.trim())) return;
        if (useLoop && (lineIdx < effectiveStart!.lineIdx || lineIdx > effectiveEnd!.lineIdx)) return;
        const rawUnits = line.match(/([A-Za-z0-9 ]+:|[SRGMPDN][123]?\u0323?|Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ|,|\||\{|\}|\[\d+:|\]|-)/gi) || [];
        speedMultiplier = 1;
        nadaiOverride = null;
        let linePlayableIdx = 0;
        rawUnits.forEach((u, unitIdx) => {
          if (u === '{') { speedMultiplier = 0.5; return; }
          if (u === '}') { speedMultiplier = 1; return; }
          if (u.startsWith('[')) { nadaiOverride = parseInt(u.match(/\d+/)![0]); return; }
          if (u === ']') { nadaiOverride = null; return; }
          if (u === '-') return;
          if (u !== '|' && !u.endsWith(':') && u !== ' ') {
            const currentNoteIdx = linePlayableIdx++;
            if (useLoop) {
              if (lineIdx === effectiveStart!.lineIdx && currentNoteIdx < effectiveStart!.noteIdx) return;
              if (lineIdx === effectiveEnd!.lineIdx && currentNoteIdx > effectiveEnd!.noteIdx) return;
            }
            let duration = baseNoteDuration * speedMultiplier;
            if (nadaiOverride) duration = beatDuration / nadaiOverride;
            playableUnits.push({ char: u, duration, lineIdx, unitIdx });
          }
        });
      });
    }

    let currentIndex = 0;
    let totalElapsedBeats = 0;

    const playNext = async () => {
      if (!isPlayingRef.current) { setActiveLineIdx(null); return; }
      if (currentIndex >= playableUnits.length) {
        if (isLoopingRef.current) { currentIndex = 0; totalElapsedBeats = 0; playNext(); return; }
        setIsPlaying(false);
        isPlayingRef.current = false;
        setActiveLineIdx(null);
        return;
      }

      const unit = playableUnits[currentIndex];
      const currentNoteDuration = unit.duration;
      setActiveLineIdx(unit.lineIdx);

      const currentBeatVal = currentNoteDuration / beatDuration;
      if (currentIndex === 0 || Math.floor(totalElapsedBeats + 0.001) > Math.floor(totalElapsedBeats - (playableUnits[currentIndex - 1]?.duration / beatDuration) + 0.001)) {
        audioEngine.playClick();
      }
      if (unit.char !== ',') {
        const semitones = getSemitones(unit.char, meta.scale);
        audioEngine.playNote(semitones, meta.sruthi, currentNoteDuration / 1000);
      }

      totalElapsedBeats += currentBeatVal;
      currentIndex++;
      playbackRef.current = window.setTimeout(playNext, currentNoteDuration);
    };

    playNext();
  };

  const wrapSelection = (prefix: string, suffix: string, replacement?: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;

    textareaRef.current.focus();
    if (start === end && replacement) {
      const newText = notes.substring(0, start) + replacement + notes.substring(end);
      applyEdit(newText, start + replacement.length);
      return;
    }
    if (start === end) return;

    const selectedText = notes.substring(start, end);
    const newText = notes.substring(0, start) + prefix + selectedText + suffix + notes.substring(end);
    applyEdit(newText, start, start + prefix.length + selectedText.length + suffix.length);
  };

  const getTalaMap = () => {
    if (!textareaRef.current) return null;
    const start = textareaRef.current.selectionStart || 0;
    const linesBefore = notes.substring(0, start).split('\n');
    const currentLineIdx = linesBefore.length - 1;
    const fullLines = notes.split('\n');
    const currentLine = fullLines[currentLineIdx] || '';

    if (/^TAGS\b/i.test(currentLine.trim()) || /^LR:/i.test(currentLine.trim())) return null;

    const units = currentLine.match(/([A-Za-z0-9 ]+:|[SRGMPDN][123]?\u0323?|(?:Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ)[123]?|,|\|| |\{|\}|\[\d+:|\]|-)/gi) || [];

    let beatProgress = 0;
    let speedMultiplier = 1;
    let nadaiOverride: number | null = null;

    const beatStates: { progress: number }[] = [];
    for (let i = 0; i < meta.beats; i++) beatStates.push({ progress: 0 });

    units.forEach(u => {
      if (u === '{') { speedMultiplier = 0.5; return; }
      if (u === '}') { speedMultiplier = 1; return; }
      if (u.startsWith('[')) { nadaiOverride = parseInt(u.match(/\d+/)![0]); return; }
      if (u === ']') { nadaiOverride = null; return; }
      if (u === '|' || u === '-') return;

      const isPlayable = /[SRGMPDNṠṘĠṀṖḊṄṢṚṂḌṆ,]/i.test(u) && !u.endsWith(':');
      if (isPlayable) {
        const val = nadaiOverride ? (1 / nadaiOverride) : (speedMultiplier / meta.nadai);
        const idx = Math.floor(beatProgress + 0.001);
        if (idx < meta.beats) beatStates[idx].progress += val;
        beatProgress += val;
      }
    });

    return (
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
        {beatStates.map((beat, i) => {
          const isFull = Math.abs(beat.progress - 1) < 0.05;
          const isOver = beat.progress > 1.05;
          const isEmpty = beat.progress < 0.05;
          let bgColor = 'bg-gray-50 border-gray-200';
          if (isFull) bgColor = 'bg-green-50 border-green-200';
          if (isOver) bgColor = 'bg-red-50 border-red-200';
          if (!isEmpty && !isFull && !isOver) bgColor = 'bg-orange-50 border-orange-200';
          return (
            <div key={i} className={`w-12 h-10 rounded border flex flex-col items-center justify-center transition-colors ${bgColor}`}>
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Beat {i + 1}</span>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: 4 }).map((_, dotIdx) => (
                  <div key={dotIdx} className={`w-1.5 h-1.5 rounded-full ${beat.progress > dotIdx * 0.25 ? (isOver ? 'bg-red-400' : 'bg-green-400') : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHighlightedNotes = () => {
    const lines = notes.split('\n');

    const edamNoteIdx = edamMarked && meta.edam ? parseInt(meta.edam) - 1 : -1;
    let firstContentLineIdx = -1;
    if (edamNoteIdx >= 0) {
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.length > 0 && !/^TAGS\b/i.test(t) && !/^LR:/i.test(t)) {
          firstContentLineIdx = i;
          break;
        }
      }
    }

    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();

      if (/^TAGS\b/i.test(trimmed)) {
        return (
          <div key={lineIdx} className="relative leading-relaxed min-h-[1.625rem]">
            <span className="text-transparent select-none">{line}</span>
          </div>
        );
      }

      if (/^LR:/i.test(trimmed)) {
        const prefixMatch = line.match(/^LR:\s*/i);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        const lyrics = line.slice(prefix.length);
        return (
          <div key={lineIdx} className="relative leading-relaxed min-h-[1.625rem]">
            <span className="text-transparent select-none">{prefix}</span>
            <span className="text-gray-400 italic font-sans text-[15px]">{lyrics}</span>
          </div>
        );
      }

      const units = line.match(/([A-Za-z0-9 ]+:|[SRGMPDN][123]?\u0323?|(?:Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ)[123]?|,|\|| |\{|\}|\[\d+:|\]|-)/gi) || [];
      let currentBrace: { count: number } | null = null;
      let currentNadaiBlock: { nadai: number } | null = null;
      let playableNoteIdx = 0;

      return (
        <div key={lineIdx} className={`relative leading-relaxed min-h-[1.625rem] group transition-colors duration-200 ${activeLineIdx === lineIdx ? 'bg-yellow-100/50 rounded-md ring-1 ring-yellow-200' : ''}`}>
          <div className="absolute -left-16 top-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-auto">
            <button
              onClick={() => {
                const formatted = formatLine(line);
                const allLines = notes.split('\n');
                allLines[lineIdx] = formatted;
                const cs = textareaRef.current?.selectionStart ?? 0;
                const ce = textareaRef.current?.selectionEnd ?? 0;
                applyEdit(allLines.join('\n'), cs, ce);
              }}
              className="p-1.5 rounded-full bg-gray-100 hover:bg-purple-600 text-gray-400 hover:text-white transition-all shadow-sm"
              title="Format this line"
            >
              <Wand2 className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => playNotation(line, true, lineIdx)}
              className="p-1.5 rounded-full bg-gray-100 hover:bg-black text-gray-400 hover:text-white transition-all shadow-sm"
              title="Play this line (Loop)"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
            </button>
          </div>

          <div className="inline">
            {units.map((char, i) => {
              let color = 'text-gray-800';

              if (char === '-') return <span key={i} className="text-gray-300 mx-0.5 font-bold">{char}</span>;

              if (char === '{') {
                currentBrace = { count: 0 };
                let j = i + 1;
                while (j < units.length && units[j] !== '}') {
                  if (/[SRGMPDNṠṘĠṀṖḊṄṢṚṂḌṆ,]/i.test(units[j]) && !units[j].endsWith(':')) currentBrace.count++;
                  j++;
                }
                const isOdd = currentBrace.count % 2 !== 0;
                return <span key={i} className={`font-bold ${isOdd ? 'text-red-600' : 'text-red-400'}`}>{char}</span>;
              }

              if (char === '}') {
                const isOdd = currentBrace ? currentBrace.count % 2 !== 0 : false;
                currentBrace = null;
                return <span key={i} className={`font-bold ${isOdd ? 'text-red-600' : 'text-red-400'}`}>{char}</span>;
              }

              if (char.startsWith('[')) {
                const n = parseInt(char.match(/\d+/)![0]);
                currentNadaiBlock = { nadai: n };
                return (
                  <span key={i} className="relative font-bold text-purple-400">
                    <span className="absolute -top-3 left-0 text-[8px] text-purple-600">{n}</span>
                    {char}
                  </span>
                );
              }

              if (char === ']') { currentNadaiBlock = null; return <span key={i} className="font-bold text-purple-400">{char}</span>; }
              if (char === '|') return <span key={i} className="text-gray-300 font-bold">{char}</span>;
              if (char === ' ') return <span key={i}> </span>;
              if (char.endsWith(':')) return <span key={i} className="text-gray-400 font-bold italic mr-2">{char}</span>;

              const isAbove = Object.values(DOT_ABOVE_MAP).some(v => char.startsWith(v));
              const isBelow = Object.values(DOT_BELOW_MAP).some(v => char.startsWith(v)) || char.includes('\u0323');
              if (isAbove) color = 'text-red-600';
              if (isBelow) color = 'text-blue-600';
              if (currentBrace && currentBrace.count % 2 !== 0) color = 'text-red-600 underline decoration-dotted';
              else if (currentBrace) color += ' border-t border-red-300';
              else if (currentNadaiBlock) color += ' border-t border-purple-300';

              const thisNoteIdx = playableNoteIdx++;
              const isEdamMarker = lineIdx === firstContentLineIdx && thisNoteIdx === edamNoteIdx;
              const isStartMarker = loopEnabled && loopStart?.lineIdx === lineIdx && loopStart?.noteIdx === thisNoteIdx;
              const isEndMarker = loopEnabled && loopEnd?.lineIdx === lineIdx && loopEnd?.noteIdx === thisNoteIdx;

              const handleClick = (e: React.MouseEvent) => {
                if (settingMarker) {
                  e.stopPropagation();
                  if (settingMarker === 'start') setLoopStart({ lineIdx, noteIdx: thisNoteIdx });
                  else setLoopEnd({ lineIdx, noteIdx: thisNoteIdx });
                  setSettingMarker(null);
                  return;
                }
                if (octave === 'normal') return;
                e.stopPropagation();
                const baseMatch = char.match(/[SRGMPDN]/i);
                if (!baseMatch) return;
                const baseNote = baseMatch[0].toUpperCase();
                const variantNum = char.match(/[123]/)?.[0] ?? '';
                let newChar = char;
                if (octave === 'above') newChar = (DOT_ABOVE_MAP[baseNote] || baseNote) + variantNum;
                else if (octave === 'below') newChar = (DOT_BELOW_MAP[baseNote] || baseNote) + variantNum;
                const allLines = [...lines];
                const lineUnits = [...units];
                lineUnits[i] = newChar;
                allLines[lineIdx] = lineUnits.join('');
                const cs = textareaRef.current?.selectionStart ?? 0;
                const ce = textareaRef.current?.selectionEnd ?? 0;
                applyEdit(allLines.join('\n'), cs, ce);
              };

              const isInteractive = settingMarker !== null || (octave !== 'normal' && /[SRGMPDN]/i.test(char));

              return (
                <React.Fragment key={i}>
                  {isStartMarker && (
                    <span
                      className="inline-block w-0.5 h-[1.2em] bg-green-500 mx-0.5 align-middle pointer-events-auto cursor-pointer"
                      onClick={() => setSettingMarker('start')}
                      title="Loop start — click to reposition"
                    />
                  )}
                  {isEndMarker && (
                    <span
                      className="inline-block w-0.5 h-[1.2em] bg-red-500 mx-0.5 align-middle pointer-events-auto cursor-pointer"
                      onClick={() => setSettingMarker('end')}
                      title="Loop end — click to reposition"
                    />
                  )}
                  <span
                    onClick={handleClick}
                    className={`relative ${color} font-mono text-[16px] ${isInteractive ? `pointer-events-auto cursor-pointer ${settingMarker ? 'hover:bg-green-100/60 rounded px-0.5' : 'hover:bg-black/5 rounded px-0.5'}` : 'pointer-events-none'}`}
                  >
                    {isEdamMarker && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-orange-500 font-bold leading-none pointer-events-none select-none">*</span>
                    )}
                    {char}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] p-4 md:p-8 font-sans">
      {/* Floating Octave Switcher */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-full border border-gray-200 shadow-lg">
        <button
          onClick={() => setOctave(octave === 'above' ? 'normal' : 'above')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${octave === 'above' ? 'bg-red-500 text-white scale-110 shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
          title="Dot Above (Alt+U)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => setOctave('normal')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${octave === 'normal' ? 'bg-gray-800 text-white scale-110 shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
          title="Normal (Alt+N)"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setOctave(octave === 'below' ? 'normal' : 'below')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${octave === 'below' ? 'bg-blue-500 text-white scale-110 shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
          title="Dot Below (Alt+D)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        {/* Header / Meta */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black rounded-lg">
                <Music className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-serif italic font-bold tracking-tight">Carnatic Notation Composer</h1>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-all"
              title={`Signed in as ${user.email}`}
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
          <p className="text-sm text-gray-500 font-serif italic ml-11 mb-4">
            {meta.song} — {meta.raga}{meta.composer ? ` · ${meta.composer}` : ''}
          </p>

          <div className="flex flex-wrap gap-2">
            {(['song', 'composer', 'raga', 'arohana', 'avarohana', 'scale', 'thala', 'edam', 'tags'] as const).map(field => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">{field}</label>
                <input
                  type="text"
                  value={meta[field] as string}
                  onChange={e => setMeta({ ...meta, [field]: e.target.value })}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  className="w-[8rem] bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Beats</label>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setMeta({ ...meta, beats: Math.max(1, meta.beats - 1) })} className="p-1.5 hover:bg-gray-50"><Minus className="w-2.5 h-2.5" /></button>
                <input type="number" value={meta.beats} readOnly className="w-10 text-center text-xs focus:outline-none" />
                <button onClick={() => setMeta({ ...meta, beats: meta.beats + 1 })} className="p-1.5 hover:bg-gray-50"><Plus className="w-2.5 h-2.5" /></button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Nadai</label>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => handleNadaiChange(-1)} className="p-1.5 hover:bg-gray-50"><Minus className="w-2.5 h-2.5" /></button>
                <input type="number" value={meta.nadai} readOnly className="w-10 text-center text-xs focus:outline-none" />
                <button onClick={() => handleNadaiChange(1)} className="p-1.5 hover:bg-gray-50"><Plus className="w-2.5 h-2.5" /></button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Sruthi</label>
              <select
                value={meta.sruthi}
                onChange={e => setMeta({ ...meta, sruthi: e.target.value })}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
              >
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">BPM</label>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setMeta({ ...meta, bpm: Math.max(20, meta.bpm - 5) })} className="p-1.5 hover:bg-gray-50"><Minus className="w-2.5 h-2.5" /></button>
                <input type="number" value={meta.bpm} readOnly className="w-12 text-center text-xs focus:outline-none" />
                <button onClick={() => setMeta({ ...meta, bpm: Math.min(300, meta.bpm + 5) })} className="p-1.5 hover:bg-gray-50"><Plus className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="p-6 relative">
          {getTalaMap()}

          {/* Playback + File Controls */}
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <button
              onClick={() => setOctave(octave === 'above' ? 'normal' : 'above')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${octave === 'above' ? 'bg-red-500 text-white border-red-600 shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}
            >
              <ChevronUp className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Dot Above</span>
            </button>
            <button
              onClick={() => setOctave(octave === 'below' ? 'normal' : 'below')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${octave === 'below' ? 'bg-blue-500 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              <ChevronDown className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Dot Below</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-300 mx-1" />
            <button
              onClick={() => playNotation()}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all ${isPlaying ? 'bg-red-500 text-white' : 'bg-black text-white'} shadow-lg active:scale-95 text-xs`}
            >
              {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isPlaying ? 'Stop' : 'Play'}</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-300 mx-1" />
            {/* Loop Controls */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={loopEnabled}
                onChange={e => {
                  setLoopEnabled(e.target.checked);
                  if (!e.target.checked) { setLoopStart(null); setLoopEnd(null); setSettingMarker(null); }
                }}
                className="accent-black"
              />
              <span className="text-xs font-bold text-gray-700">Loop</span>
            </label>
            {loopEnabled && (
              <>
                <button
                  onClick={() => setSettingMarker(settingMarker === 'start' ? null : 'start')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold transition-colors ${settingMarker === 'start' ? 'bg-green-500 text-white border-green-600 shadow' : loopStart ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  title="Click then click a note to set loop start"
                >
                  ▸| Start{loopStart ? ` (L${loopStart.lineIdx + 1} · ${loopStart.noteIdx + 1})` : ''}
                </button>
                <button
                  onClick={() => setSettingMarker(settingMarker === 'end' ? null : 'end')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold transition-colors ${settingMarker === 'end' ? 'bg-red-500 text-white border-red-600 shadow' : loopEnd ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  title="Click then click a note to set loop end"
                >
                  |◂ End{loopEnd ? ` (L${loopEnd.lineIdx + 1} · ${loopEnd.noteIdx + 1})` : ''}
                </button>
                {settingMarker && (
                  <span className="text-xs text-gray-500 italic">
                    Click a note to set {settingMarker === 'start' ? 'start' : 'end'} marker…
                  </span>
                )}
                {loopStart && loopEnd && !settingMarker && (
                  <span className="text-xs text-gray-400">↺ Looping marked region</span>
                )}
              </>
            )}
            <div className="h-6 w-[1px] bg-gray-300 mx-1" />
            <button
              onClick={saveFile}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all active:scale-95 text-xs border bg-white border-gray-200 hover:bg-gray-50"
            >
              <Save className="w-3 h-3" />
              <span>Save File</span>
            </button>
            <button
              onClick={() => exportMidi(notes, meta)}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-100 transition-all active:scale-95 text-xs"
            >
              <Download className="w-3 h-3" />
              <span>Export MIDI</span>
            </button>
            <label className="flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-gray-200 font-bold hover:bg-gray-50 transition-all active:scale-95 text-xs cursor-pointer">
              <Upload className="w-3 h-3" />
              <span>Import File</span>
              <input type="file" accept=".txt" onChange={importFile} className="hidden" />
            </label>
            <button
              onClick={openPicker}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-gray-200 font-bold hover:bg-gray-50 transition-all active:scale-95 text-xs"
            >
              <Music className="w-3 h-3" />
              <span>Open from Gist</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-300 mx-1" />
            <input
              type="password"
              placeholder="GitHub token (gist scope)"
              value={githubToken}
              onChange={e => { setGithubToken(e.target.value); localStorage.setItem('gh_gist_token', e.target.value); }}
              className="text-xs border border-gray-200 rounded-full px-3 py-1.5 w-44 outline-none focus:border-gray-400"
            />
            <button
              onClick={saveToGist}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-green-50 border border-green-200 text-green-700 font-bold hover:bg-green-100 transition-all active:scale-95 text-xs"
            >
              <Save className="w-3 h-3" />
              <span>{meta.gistId ? 'Update Gist' : 'Save to Gist'}</span>
            </button>
            {gistStatus && <span className="text-xs text-green-600 font-medium">{gistStatus}</span>}
          </div>

          <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">
            {octave !== 'normal'
              ? `Click notes to apply Dot ${octave === 'above' ? 'Above (upper octave)' : 'Below (lower octave)'}`
              : 'Enter Notes'}
          </label>

          {/* Formatting helpers */}
          <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg border border-gray-100">
            <button
              onClick={() => wrapSelection('{', '}')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
              title="Wrap selection in Mel-Kaala (2x speed)"
            >
              <Zap className="w-3 h-3" />
              2x Speed
            </button>
            <button
              onClick={() => wrapSelection('[3:', ']')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors shadow-sm"
              title="Thisram (3 notes/beat)"
            >
              <Hash className="w-3 h-3" />
              Thisram (3)
            </button>
            <button
              onClick={() => wrapSelection('[5:', ']')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors shadow-sm"
              title="Kandam (5 notes/beat)"
            >
              <Hash className="w-3 h-3" />
              Kandam (5)
            </button>
            <button
              onClick={() => wrapSelection('[7:', ']')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors shadow-sm"
              title="Misram (7 notes/beat)"
            >
              <Hash className="w-3 h-3" />
              Misram (7)
            </button>
            <button
              onClick={() => wrapSelection('', '', '-')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
              title="Insert hyphen"
            >
              <Minus className="w-3 h-3" />
              Hyphen (-)
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1 self-center" />
            <button
              onClick={() => {
                // Normalize notes in the notes area using the scale as reference
                const normalizedNotes = normalizeNotesWithScale(notes, meta.scale);
                const allLines = normalizedNotes.split('\n');
                applyEdit(allLines.map(l => formatLine(l)).join('\n'), 0);
                if (meta.edam) setEdamMarked(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm"
              title="Format all lines"
            >
              <Wand2 className="w-3 h-3" />
              Format All
            </button>
          </div>

          {/* Editor with highlight overlay */}
          <div className="relative h-[700px] bg-gray-50 rounded-xl border border-gray-200 font-mono text-[16px] leading-relaxed overflow-hidden">
            {showOctaveToast && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/80 text-white text-xs font-bold rounded-full">
                Octave: {octave === 'above' ? 'Dot Above' : octave === 'below' ? 'Dot Below' : 'Normal'}
              </div>
            )}
            <div
              ref={highlightRef}
              style={{ scrollbarGutter: 'stable' }}
              className="absolute inset-0 p-4 pl-20 whitespace-pre-wrap break-all z-30 pointer-events-none font-mono text-[16px] leading-relaxed select-none overflow-y-hidden"
            >
              {renderHighlightedNotes()}
            </div>
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={handleTextareaChange}
              onScroll={e => {
                if (highlightRef.current) highlightRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
              }}
              style={{ scrollbarGutter: 'stable' }}
              className="absolute inset-0 w-full h-full p-4 pl-20 bg-transparent text-transparent caret-black focus:outline-none resize-none whitespace-pre-wrap break-all z-10 font-mono text-[16px] leading-relaxed border-none shadow-none ring-0 overflow-y-auto"
              spellCheck={false}
              placeholder="Type S R G M P D N..."
            />
          </div>
        </div>

        {/* Keyboard + Controls */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          {/* Virtual Keyboard */}
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-11 gap-2">
            {['S', 'R', 'G', 'M', 'P', 'D', 'N', ',', '|'].map(note => (
              <button
                key={note}
                onClick={() => handleNoteClick(note)}
                className="h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-xl font-bold hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
              >
                {octave === 'above' && DOT_ABOVE_MAP[note]
                  ? DOT_ABOVE_MAP[note]
                  : octave === 'below' && DOT_BELOW_MAP[note]
                    ? DOT_BELOW_MAP[note]
                    : note}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
            >
              <Delete className="w-6 h-6 text-gray-500" />
            </button>
            <button
              onClick={handleClear}
              className="h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center hover:bg-red-50 active:scale-95 transition-all shadow-sm"
            >
              <Trash2 className="w-6 h-6 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          Monospaced 16px · Red: Upper Octave · Blue: Lower Octave · Alt+U/D/N to switch octave
        </p>
      </div>

      {/* Gist Song Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold font-serif italic">Open from Gist</h2>
              <button onClick={() => setShowPicker(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {songList.map(s => (
                <li key={s.name}>
                  <button
                    onClick={() => loadFromGist(s)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{s.song || s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.raga}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
