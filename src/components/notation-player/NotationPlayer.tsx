import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Minus,
  Play,
  Square,
  Save,
  Music,
  Upload,
  Download,
  X,
  ChevronRight,
  LogOut
} from 'lucide-react';
import type { User } from 'firebase/auth';
import './notation-player.css';
import { audioEngine } from './lib/audio';
import type { MetaData } from './types';
import {
  DOT_ABOVE_MAP,
  DOT_BELOW_MAP,
  getSemitones
} from './lib/music';
import { exportMidi } from './lib/midi';
import { logActivity } from '../../lib/activity';

interface Props {
  user: User;
  onSignOut: () => void;
}

export default function NotationPlayer({ user, onSignOut }: Props) {
    // Helper to get query param from URL
    function getQueryParam(name: string): string | null {
      if (typeof window === 'undefined') return null;
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    }

    // On mount, check for file param and load if present
    useEffect(() => {
      const fileParam = getQueryParam('file');
      if (fileParam) {
        // Sanitize: allow only safe base names
        const safeBase = fileParam.replace(/[^\w\-]/g, '');
        const filename = `${safeBase}.txt`;
        fetch(`/notesfromtext/${filename}`)
          .then(res => {
            if (!res.ok) throw new Error('File not found');
            return res.text();
          })
          .then(text => {
            parseContent(text);
          })
          .catch(() => {
            setNotes('Error: Notation file not found.');
          });
      }
    }, []);
  const [notes, setNotes] = useState('');
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
    tags: ''
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<number | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const isLoopingRef = useRef(false);
  const [clickEnabled, setClickEnabled] = useState(true);
  const clickEnabledRef = useRef(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState<{ lineIdx: number; noteIdx: number } | null>(null);
  const [loopEnd, setLoopEnd] = useState<{ lineIdx: number; noteIdx: number } | null>(null);
  const [settingMarker, setSettingMarker] = useState<'start' | 'end' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [songList, setSongList] = useState<{ name: string; song: string; raga: string; file?: string }[]>([]);
  const [pickerFilter, setPickerFilter] = useState('');
  // MIDI modal state
  const [showMidiModal, setShowMidiModal] = useState(false);
  const [midiList, setMidiList] = useState<{ name: string; song: string; raga: string; midiFile: string }[]>([]);
  const [lyrics, setLyrics] = useState<string>('');

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (playbackRef.current) clearTimeout(playbackRef.current);
    };
  }, []);

  const normaliseLyrics = (text: string): string =>
    text
      .replace(/[Ṡ]/g, 'S').replace(/[Ṙ]/g, 'R').replace(/[Ġ]/g, 'G')
      .replace(/[Ṁ]/g, 'M').replace(/[Ṗ]/g, 'P').replace(/[Ḋ]/g, 'D').replace(/[Ṅ]/g, 'N')
      .replace(/[Ṣ]/g, 'S').replace(/[Ṛ]/g, 'R').replace(/[Ṃ]/g, 'M')
      .replace(/[Ḍ]/g, 'D').replace(/[Ṇ]/g, 'N')
      .replace(/[GP]\u0323/g, c => c[0]);

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
      });
      setMeta(newMeta);
      const partsAfterMeta = content.split(/MetaE:\s*/);
      if (partsAfterMeta.length > 1) {
        let notationContent = partsAfterMeta[1];
        if (notationContent.startsWith('\n')) notationContent = notationContent.substring(1);
        notationContent = notationContent.replace(/LyricsS:[\s\S]*?LyricsE:\s*/gi, '').trim();
        setNotes(notationContent.toUpperCase());
      }
    }
    const lyricsMatch = content.match(/LyricsS:\s*([\s\S]*?)\s*LyricsE:/i);
    setLyrics(lyricsMatch ? normaliseLyrics(lyricsMatch[1].trim()) : '');
  };

  const formatLyricLine = (lyricContent: string, notationLine: string): string => {
    if (!lyricContent.includes('|')) return lyricContent;
    const notationSegs = notationLine.split('|');
    const lyricSegs = lyricContent.split('|');
    const count = Math.max(notationSegs.length, lyricSegs.length);
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const notSeg = notationSegs[i] ?? '';
      const lyrSeg = lyricSegs[i] ?? '';
      result.push(lyrSeg.length < notSeg.length ? lyrSeg.padEnd(notSeg.length) : lyrSeg);
    }
    return result.join('|');
  };

  const openPicker = async () => {
    if (songList.length === 0) {
      const res = await fetch('https://gist.githubusercontent.com/mandolinbalaji/2cccf69f0afcc5eb83099ab2f449edc9/raw/index.json?t=' + Date.now());
      const data: Record<string, unknown>[] = await res.json();
      setSongList(data.filter((e: any) => !e.private) as any);
    }
    setPickerFilter('');
    setShowPicker(true);
  };

  const loadSong = async (s: { name: string; song?: string; raga?: string; file?: string; url?: string }) => {
    const fetchUrl = s.url ?? `/notesfromtext/${s.file ?? `${s.name}.txt`}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) return;
    const text = await res.text();
    parseContent(text);
    setShowPicker(false);
    logActivity(user, 'song_loaded', { song: s.song ?? s.name, raga: s.raga ?? '', file: s.file ?? `${s.name}.txt` });
  };

  // Download MIDI modal logic
  const openMidiModal = async () => {
    if (midiList.length === 0) {
      const res = await fetch('https://gist.githubusercontent.com/mandolinbalaji/2cccf69f0afcc5eb83099ab2f449edc9/raw/index.json?t=' + Date.now());
      const data: Record<string, unknown>[] = await res.json();
      const midiEntries = data.filter((entry: any) => entry.midiFile && !entry.private);
      setMidiList(midiEntries);
    }
    setShowMidiModal(true);
  };

  const downloadMidi = (midiFile: string, song: string, raga: string) => {
    const link = document.createElement('a');
    link.href = `/notesfromtext/${midiFile}`;
    link.download = `${song || 'Song'}-${raga || 'Raga'}.mid`.toLowerCase().replace(/\s+/g, '-');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowMidiModal(false);
  };

  const saveFile = () => {
    const content = `MetaS: Song: ${meta.song} | Composer: ${meta.composer} | Raga: ${meta.raga} | Arohana: ${meta.arohana} | Avarohana: ${meta.avarohana} | Scale: ${meta.scale} | Beats: ${meta.beats} | Nadai: ${meta.nadai} | Sruthi: ${meta.sruthi} | BPM: ${meta.bpm} | Thala: ${meta.thala} | Edam: ${meta.edam} | Tags: ${meta.tags} | MetaE:\n${notes}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.song || 'Song'}_${meta.raga || 'Raga'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const playNotation = async (customNotes?: string | React.MouseEvent, loopOverride?: boolean, customLineIdx?: number) => {
    if (isPlaying) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (playbackRef.current) clearTimeout(playbackRef.current);
      setActiveLineIdx(null);
      return;
    }

    // Unlock AudioContext synchronously within the user gesture (required for iOS).
    audioEngine.unlock();

    const notesToPlay = (typeof customNotes === 'string' ? customNotes : notes) || '';
    if (!notesToPlay.trim()) return;

    if (typeof customNotes !== 'string') {
      logActivity(user, 'song_played', { song: meta.song, raga: meta.raga });
    }

    isLoopingRef.current = loopOverride !== undefined ? loopOverride : (typeof customNotes === 'string') || (loopEnabled && !!(loopStart && loopEnd));

    clickEnabledRef.current = clickEnabled;
    if (clickEnabled) await audioEngine.playClick(0.01);
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
        if (/^TAGS\b/i.test(line.trim())) return;
        if (/^LR:/i.test(line.trim())) return;
        if (/^[A-Za-z][A-Za-z0-9 ]*:$/.test(line.trim())) return;
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
      if (!isPlayingRef.current) {
        setActiveLineIdx(null);
        return;
      }

      if (currentIndex >= playableUnits.length) {
        if (isLoopingRef.current) {
          currentIndex = 0;
          totalElapsedBeats = 0;
          playNext();
          return;
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
        setActiveLineIdx(null);
        return;
      }

      const unit = playableUnits[currentIndex];
      const char = unit.char;
      const currentNoteDuration = unit.duration;

      setActiveLineIdx(unit.lineIdx);

      const currentBeatVal = currentNoteDuration / beatDuration;

      if (clickEnabledRef.current && (currentIndex === 0 || Math.floor(totalElapsedBeats + 0.001) > Math.floor(totalElapsedBeats - (playableUnits[currentIndex - 1]?.duration / beatDuration) + 0.001))) {
        audioEngine.playClick();
      }

      if (char !== ',') {
        const semitones = getSemitones(char, meta.scale);
        audioEngine.playNote(semitones, meta.sruthi, currentNoteDuration / 1000);
      }

      totalElapsedBeats += currentBeatVal;
      currentIndex++;
      playbackRef.current = window.setTimeout(playNext, currentNoteDuration);
    };

    playNext();
  };

  const renderHighlightedNotes = () => {
    const lines = notes.split('\n');
    let lineNum = 0;

    return lines.map((line, lineIdx) => {
      if (/^TAGS\b/i.test(line.trim())) return null;

      if (line.trim() === '') {
        return <div key={lineIdx} className="min-h-[0.75rem]" />;
      }

      if (/^LR:\s*$/i.test(line.trim())) {
        return <div key={lineIdx} className="min-h-[0.75rem]" />;
      }

      if (/^LR:/i.test(line.trim())) {
        const prefix = line.match(/^LR:\s*/i)![0];
        const lyric = line.slice(prefix.length);
        let notationLine = '';
        for (let i = lineIdx - 1; i >= 0; i--) {
          const t = lines[i].trim();
          if (t === '' || /^LR:/i.test(t) || /^TAGS\b/i.test(t)) continue;
          if (/^[A-Za-z][A-Za-z0-9 ]*:$/.test(t)) break;
          notationLine = lines[i];
          break;
        }
        return (
          <div key={lineIdx} className="relative flex items-start gap-3 leading-relaxed min-h-[1.625rem] p-1 group">
            <div className="w-6 shrink-0 flex items-start justify-center pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  const formatted = formatLyricLine(lyric, notationLine);
                  const allLines = notes.split('\n');
                  allLines[lineIdx] = prefix + formatted;
                  const cs = textareaRef.current?.selectionStart ?? 0;
                  const ce = textareaRef.current?.selectionEnd ?? 0;
                  applyEdit(allLines.join('\n'), cs, ce);
                }}
                className="p-1.5 rounded-full bg-gray-100 hover:bg-purple-600 text-gray-400 hover:text-white transition-all shadow-sm"
                title="Align lyrics to notation pipes"
              >
                <Wand2 className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="w-5 shrink-0" />
            <div className="flex-1 italic text-black font-mono text-[16px] whitespace-pre">{lyric}</div>
          </div>
        );
      }

      if (/^[A-Za-z][A-Za-z0-9 ]*:$/.test(line.trim())) {
        lineNum = 0;
        const label = line.trim().slice(0, -1);
        return (
          <div key={lineIdx} className="flex items-center gap-3 mt-3 mb-1 px-1">
            <div className="w-6 shrink-0" />
            <div className="w-5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
        );
      }

      const currentLineNum = ++lineNum;
      const units = line.match(/([A-Za-z0-9 ]+:|[SRGMPDN][123]?\u0323?|Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ|,|\|| |\{|\}|\[\d+:|\]|-)/gi) || [];

      let currentBrace: { startIdx: number; count: number } | null = null;
      let currentNadaiBlock: { startIdx: number; nadai: number } | null = null;
      let playableNoteIdx = 0;

      return (
        <div key={lineIdx} className={`relative flex items-start gap-3 leading-relaxed min-h-[1.625rem] group transition-colors duration-200 p-1 ${activeLineIdx === lineIdx ? 'bg-yellow-100/50 rounded-md ring-1 ring-yellow-200' : ''}`}>
          <button
            onClick={() => playNotation(line, true, lineIdx)}
            className={`mt-1 p-1 rounded-md transition-all ${activeLineIdx === lineIdx ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 opacity-40 group-hover:opacity-100'}`}
            title="Play line in loop"
          >
            {activeLineIdx === lineIdx ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </button>
          <span className="text-[9px] text-gray-400 w-5 shrink-0 text-right mt-1.5 select-none font-mono">{currentLineNum}</span>
          <div className="inline flex-1">
            {units.map((char, i) => {
              let color = 'text-gray-800';

              if (char === '-') {
                return <span key={i} className="text-gray-300 mx-0.5 font-bold">{char}</span>;
              }

              if (char === '{') {
                currentBrace = { startIdx: i, count: 0 };
                let j = i + 1;
                while (j < units.length && units[j] !== '}') {
                  const isPlayable = /[SRGMPDN]|Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ|,/i.test(units[j]) && !units[j].endsWith(':');
                  if (isPlayable) currentBrace.count++;
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
                currentNadaiBlock = { startIdx: i, nadai: n };
                return (
                  <span key={i} className="relative font-bold text-purple-400">
                    <span className="absolute -top-3 left-0 text-[8px] text-purple-600">{n}</span>
                    {char}
                  </span>
                );
              }

              if (char === ']') {
                currentNadaiBlock = null;
                return <span key={i} className="font-bold text-purple-400">{char}</span>;
              }

              if (char.endsWith(':')) {
                return <span key={i} className="text-gray-400 font-bold italic mr-2">{char}</span>;
              }

              const isAbove = Object.values(DOT_ABOVE_MAP).some(v => char.startsWith(v));
              const isBelow = Object.values(DOT_BELOW_MAP).some(v => char.startsWith(v)) || char.includes('\u0323');

              if (isAbove) color = 'text-red-600';
              if (isBelow) color = 'text-blue-600';

              if (currentBrace && currentBrace.count % 2 !== 0) {
                color = 'text-red-600 underline decoration-dotted';
              } else if (currentBrace) {
                color += ' border-t border-red-300';
              } else if (currentNadaiBlock) {
                color += ' border-t border-purple-300';
              }

              const isPlayableNote = /^([SRGMPDN][123]?\u0323?|Ṡ|Ṙ|Ġ|Ṁ|Ṗ|Ḋ|Ṅ|Ṣ|Ṛ|Ṃ|Ḍ|Ṇ|,)$/i.test(char);
              if (isPlayableNote) {
                const thisNoteIdx = playableNoteIdx++;
                const isStartMarker = loopEnabled && loopStart?.lineIdx === lineIdx && loopStart?.noteIdx === thisNoteIdx;
                const isEndMarker = loopEnabled && loopEnd?.lineIdx === lineIdx && loopEnd?.noteIdx === thisNoteIdx;
                const handleNoteClick = (e: React.MouseEvent) => {
                  if (!settingMarker) return;
                  e.stopPropagation();
                  if (settingMarker === 'start') setLoopStart({ lineIdx, noteIdx: thisNoteIdx });
                  else setLoopEnd({ lineIdx, noteIdx: thisNoteIdx });
                  setSettingMarker(null);
                };
                return (
                  <span key={i} className="inline-flex items-center">
                    {isStartMarker && (
                      <span
                        className="inline-block w-0.5 h-[1.2em] bg-green-500 mx-0.5 align-middle pointer-events-auto cursor-pointer"
                        onClick={() => setSettingMarker('start')}
                        title="Loop start — click to reposition"
                      />
                    )}
                    <span
                      onClick={handleNoteClick}
                      className={`${color} font-mono text-[16px] ${settingMarker ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                    >
                      {char}
                    </span>
                    {isEndMarker && (
                      <span
                        className="inline-block w-0.5 h-[1.2em] bg-red-500 mx-0.5 align-middle pointer-events-auto cursor-pointer"
                        onClick={() => setSettingMarker('end')}
                        title="Loop end — click to reposition"
                      />
                    )}
                  </span>
                );
              }

              return (
                <span key={i} className={`${color} font-mono text-[16px] pointer-events-none`}>
                  {char}
                </span>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        {/* Header / Meta Section */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black rounded-lg">
                  <Music className="w-6 h-6 text-white" />
                </div>
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
            <p className="text-sm text-black font-serif italic ml-11">
              {meta.song} — {meta.raga}{meta.composer ? ` · ${meta.composer}` : ''}
            </p>
            {(meta.arohana || meta.avarohana) && (
              <p className="text-xs text-black font-mono ml-11 mt-0.5">
                {meta.arohana && <span>↑ {meta.arohana}</span>}
                {meta.arohana && meta.avarohana && <span className="mx-2">·</span>}
                {meta.avarohana && <span>↓ {meta.avarohana}</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Scale</label>
              <input type="text" value={meta.scale} readOnly className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Thala</label>
              <input type="text" value={meta.thala} readOnly className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Edam</label>
              <input type="text" value={meta.edam} readOnly className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Beats</label>
              <input type="number" value={meta.beats} readOnly className="w-full text-center text-xs focus:outline-none py-1.5 bg-gray-50 border border-gray-200 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Nadai</label>
              <input type="number" value={meta.nadai} readOnly className="w-full text-center text-xs focus:outline-none py-1.5 bg-gray-50 border border-gray-200 rounded-lg" />
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
            <div className="flex flex-col gap-1 col-span-2 md:col-span-2">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400">BPM</label>
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setMeta({ ...meta, bpm: Math.max(20, meta.bpm - 5) })} className="p-1.5 hover:bg-gray-50"><Minus className="w-2.5 h-2.5" /></button>
                <input type="number" value={meta.bpm} readOnly className="w-full text-center text-xs focus:outline-none" />
                <button onClick={() => setMeta({ ...meta, bpm: Math.min(300, meta.bpm + 5) })} className="p-1.5 hover:bg-gray-50"><Plus className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <button
              onClick={() => playNotation()}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all ${isPlaying ? 'bg-red-500 text-white shadow-red-200' : 'bg-black text-white shadow-gray-200'} shadow-lg active:scale-95 text-sm`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Stop Playback' : 'Start Playback'}</span>
            </button>

            <div className="h-8 w-[1px] bg-gray-300 mx-2" />

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clickEnabled}
                onChange={e => setClickEnabled(e.target.checked)}
                className="accent-black"
              />
              <span className="text-xs font-bold text-gray-700">Click</span>
            </label>

            <div className="h-8 w-[1px] bg-gray-300 mx-2" />

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettingMarker(settingMarker === 'start' ? null : 'start')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold transition-colors ${settingMarker === 'start' ? 'bg-green-500 text-white border-green-600 shadow' : loopStart ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  title="Click then click a note to set loop start"
                >
                  ▸| Start{loopStart ? ` (L${loopStart.lineIdx + 1}·${loopStart.noteIdx + 1})` : ''}
                </button>
                <button
                  onClick={() => setSettingMarker(settingMarker === 'end' ? null : 'end')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold transition-colors ${settingMarker === 'end' ? 'bg-red-500 text-white border-red-600 shadow' : loopEnd ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  title="Click then click a note to set loop end"
                >
                  |◂ End{loopEnd ? ` (L${loopEnd.lineIdx + 1}·${loopEnd.noteIdx + 1})` : ''}
                </button>
                {settingMarker && (
                  <span className="text-xs text-gray-500 italic">
                    Click a note to set {settingMarker === 'start' ? 'start' : 'end'} marker…
                  </span>
                )}
                {loopStart && loopEnd && !settingMarker && (
                  <span className="text-xs text-gray-400">↺ Looping marked region</span>
                )}
              </div>
            )}

            <div className="h-8 w-[1px] bg-gray-300 mx-2" />

            <button
              onClick={openPicker}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-gray-200 font-bold hover:bg-gray-50 transition-all active:scale-95 text-sm cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Import Notation</span>
            </button>

            <button
              onClick={saveFile}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-gray-200 font-bold hover:bg-gray-50 transition-all active:scale-95 text-sm shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>

            {/* Hide the original MIDI button by commenting it out */}
            {false && (
              <button
                onClick={() => exportMidi(notes, meta)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-100 transition-all active:scale-95 text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>MIDI</span>
              </button>
            )}
            {/* New Download MIDI button */}
            <button
              onClick={openMidiModal}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-100 transition-all active:scale-95 text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download MIDI</span>
            </button>
                {/* MIDI Download Modal */}
                {showMidiModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMidiModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between p-5 border-b border-gray-100">
                        <h2 className="text-lg font-bold font-serif italic">Download MIDI File</h2>
                        <button onClick={() => setShowMidiModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                      <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                        {midiList.length === 0 && (
                          <li className="px-5 py-4 text-gray-500 text-center">No MIDI files available.</li>
                        )}
                        {midiList.map((m) => (
                          <li key={m.midiFile}>
                            <button
                              onClick={() => downloadMidi(m.midiFile, m.song, m.raga)}
                              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                            >
                              <div>
                                <p className="font-semibold text-sm text-gray-900">{m.song || m.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{m.raga}</p>
                              </div>
                              <Download className="w-4 h-4 text-gray-400 shrink-0" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
          </div>
        </div>

        {/* Notation Display */}
        <div className="p-6 relative">
          {lyrics && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">Lyrics</span>
              <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-gray-700">{lyrics}</p>
            </div>
          )}
          <div className="relative h-[700px] bg-gray-50 rounded-xl border border-gray-200 font-mono text-[16px] leading-relaxed overflow-hidden">
            <div
              ref={highlightRef}
              style={{ scrollbarGutter: 'stable' }}
              className="absolute inset-0 p-4 pl-10 whitespace-pre-wrap break-all z-30 font-mono text-[16px] leading-relaxed overflow-y-auto"
            >
              {renderHighlightedNotes()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          Monospaced 16px · Red: Upper Octave · Blue: Lower Octave
        </p>
      </div>

      {/* Song Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold font-serif italic">Choose a Notation</h2>
              <button onClick={() => setShowPicker(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Filter by name, raga, composer, tala, tags…"
                value={pickerFilter}
                onChange={e => setPickerFilter(e.target.value)}
                autoFocus
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {songList.filter(s => {
                const q = pickerFilter.toLowerCase();
                if (!q) return true;
                return [s.song, s.name, (s as any).raga, (s as any).composer, (s as any).tala, (s as any).tags]
                  .some(v => v && String(v).toLowerCase().includes(q));
              }).map(s => (
                <li key={s.name}>
                  <button
                    onClick={() => loadSong(s)}
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
