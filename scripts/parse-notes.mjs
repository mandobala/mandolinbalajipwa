import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notesDir = path.join(__dirname, '..', 'public', 'notesfromtext');

function convertNotationToHtml(notation) {
  // Convert notation symbols to HTML
  return notation
    .replace(/,/g, '<span class="comma">, </span>')
    .replace(/\|/g, '<span class="bar">|</span>')
    .replace(/\*/g, '<span class="asterisk">*</span>')
    .replace(/\{([^}]+)\}/g, '<span class="braces">{$1}</span>')
    .replace(/Ṡ/g, '<span class="special-char">Ṡ</span>')
    .replace(/Ṙ/g, '<span class="special-char">Ṙ</span>')
    .replace(/Ġ/g, '<span class="special-char">Ġ</span>')
    .replace(/ḷ/g, '<span class="special-char">ḷ</span>')
    .replace(/Ṇ/g, '<span class="special-char">Ṇ</span>')
    .replace(/Ṭ/g, '<span class="special-char">Ṭ</span>')
    .replace(/Ṛ/g, '<span class="special-char">Ṛ</span>')
    .replace(/Ḍ/g, '<span class="special-char">Ḍ</span>')
    .replace(/Ṁ/g, '<span class="special-char">Ṁ</span>')
    .replace(/Ṣ/g, '<span class="special-char">Ṣ</span>');
}

function convertLyricsToHtml(lyrics) {
  // Convert lyrics to HTML, preserving spaces
  return lyrics.replace(/ /g, '&nbsp;');
}

function parseText(text) {
  const lines = text.split('\n');
  let metatags = {};
  let sections = [];
  let currentSection = null;
  let inMeta = false;

  for (let line of lines) {
    line = line.trim();
    if (line.includes('infoS:') || line.includes('MetaS')) {
      inMeta = true;
      let metaLine = line;
      if (line.includes('infoE:') || line.includes('MetaE')) {
        const start = line.indexOf('infoS:') !== -1 ? line.indexOf('infoS:') + 6 : line.indexOf('MetaS') + 6;
        const end = line.indexOf('infoE:') !== -1 ? line.indexOf('infoE:') : line.indexOf('MetaE');
        metaLine = line.substring(start, end).trim();
        inMeta = false;
      } else {
        const start = line.indexOf('infoS:') !== -1 ? line.indexOf('infoS:') + 6 : line.indexOf('MetaS') + 6;
        metaLine = line.substring(start).trim();
      }
      // parse metaLine
      const parts = metaLine.split('|').map(p => p.trim());
      parts.forEach(p => {
        const colonIndex = p.indexOf(':');
        if (colonIndex > -1) {
          const key = p.substring(0, colonIndex).trim();
          const value = p.substring(colonIndex + 1).trim();
          metatags[key] = value;
        }
      });
      continue;
    }
    if (line.includes('infoE:') || line.includes('MetaE')) {
      inMeta = false;
      continue;
    }
    if (inMeta) {
      // parse additional lines if any
      const parts = line.split('|').map(p => p.trim());
      parts.forEach(p => {
        const colonIndex = p.indexOf(':');
        if (colonIndex > -1) {
          const key = p.substring(0, colonIndex).trim();
          const value = p.substring(colonIndex + 1).trim();
          metatags[key] = value;
        }
      });
      continue;
    }
    if (line.endsWith(':') && !line.startsWith('Line:') && !line.startsWith('LR:') && !line.includes('info') && !line.includes('Meta')) {
      // section marker
      const sectionName = line.slice(0, -1);
      currentSection = { name: sectionName, lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (line.startsWith('Line:')) {
      const notation = line.substring(5).trim();
      if (currentSection) {
        currentSection.lines.push({ 
          notation: notation, 
          lyrics: '' 
        });
      }
      continue;
    }
    if (line.startsWith('LR:')) {
      const lyrics = line.substring(3).trim();
      if (currentSection && currentSection.lines.length > 0) {
        currentSection.lines[currentSection.lines.length - 1].lyrics = lyrics;
      }
      continue;
    }
  }

  // Ensure common metatags are present
  const defaultMetatags = ['Rāga', 'Tāḷa', 'Ārō', 'Avarō'];
  defaultMetatags.forEach(key => {
    if (!(key in metatags)) metatags[key] = '';
  });

  return { metatags, sections };
}

function main() {
  const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.txt'));
  
  const songs = files.map(f => {
    const filename = f.replace('.txt', '');
    const filepath = path.join(notesDir, f);
    const content = fs.readFileSync(filepath, 'utf8');
    const parsed = parseText(content);
    
    // Normalize metadata keys to handle all variations
    const normalizeKey = (key) => {
      // Remove diacritical marks and convert to lowercase
      const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      // Arohana variations: Aroh, Aro, Arohana, Ārō, Ārō
      if (normalized.includes('aro') && !normalized.includes('avaro')) {
        return 'arohana';
      }
      // Avarohana variations: Ava, Avaro, Avarohana, Avarō, Avarō
      if (normalized.includes('avaro')) {
        return 'avarohana';
      }
      // Raga variations: Raga, Rāga, Rāga
      if (normalized.includes('rag')) {
        return 'raga';
      }
      // Tala variations: Tala, Tāḷa, Tāḷa
      if (normalized.includes('tal')) {
        return 'tala';
      }
      // Composer
      if (normalized.includes('compos')) {
        return 'composer';
      }
      // Song
      if (normalized.includes('song')) {
        return 'song';
      }
      return normalized;
    };
    
    // Create normalized metadata object
    const metadata = {};
    Object.keys(parsed.metatags).forEach(key => {
      const normalizedKey = normalizeKey(key);
      // Only set if not already set (keep first occurrence)
      if (!metadata[normalizedKey]) {
        metadata[normalizedKey] = parsed.metatags[key];
      }
    });
    
    return {
      name: filename,
      raga: metadata.raga || '',
      tala: metadata.tala || '',
      arohana: metadata.arohana || '',
      avarohana: metadata.avarohana || '',
      composer: metadata.composer || '',
      song: metadata.song || filename,
      allMetadata: parsed.metatags
    };
  });
  
  fs.writeFileSync(path.join(notesDir, 'index.json'), JSON.stringify(songs, null, 2));
  console.log(`Generated index.json with ${songs.length} songs and normalized metadata`);
}

main();