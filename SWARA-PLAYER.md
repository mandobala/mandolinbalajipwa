# Swara Player — how to run it, and how to add songs

The player lives at `/swara-player/`. Visitors can only play: tempo, tonic, looping and the
metronome are theirs to change, the notation is not. Songs are text files in
`src/content/songs/`, checked when the site builds.

## 1. Try the branch before it goes live

Open PowerShell in `Documents\BalajiWebsite\mandolinbalajipwa` and run:

```
git checkout swara-player-v2
npm run dev
```

Open `http://localhost:7777/swara-player/` and press Play. Two sample songs are there — a
Hindolam piece in Rupaka and a Mohanam sarali in Adi. Check the sound, the highlighting, the
song picker, and the page on your phone if you can.

Leave `npm run dev` running while you work: it reloads on every save, and notation errors
appear in that terminal window.

## 2. Put it live

```
npm run build
```

This must finish without an error. Then:

```
git checkout main
git merge swara-player-v2
git push
```

GitHub Actions builds and deploys to Firebase on push to `main`. Nothing reaches the site until
that push, so the branch is safe to sit on for as long as you like.

## 3. Add a song

Create a file in `src/content/songs/`, named after the song — `raguvamsasudha.txt`. The file
name becomes the address (`/swara-player/?song=raguvamsasudha`), so keep it lowercase with
hyphens.

Start with the header block. Every line is optional except the raga, but the more you give, the
less a visitor has to set by hand:

```
[TITLE: Raguvamsasudha]
[COMPOSER: Patnam Subramanya Iyer]
[RAGA: Kadanakuthuhalam]
[TALA: Adi (8)]
[BEATS: 8]
[NADAI: 4]
[BPM: 56]
[SA: C#4]
```

Add the scale and the phrases too, which the player shows and uses:

```
[SCALE: S R2 G3 M1 P D2 N3]
[AROHANA: S R2 G3 M1 P D2 N3 Ṡ]
[AVAROHANA: Ṡ N3 D2 P M1 G3 R2 S]
[TAGS: kriti, patnam]
```

`TALA` is best written as one of the presets — Adi (8), Rupaka (3), Rupaka (6), Misra Chapu (7),
Khanda Chapu (5), Triputa (7), Jhampa (10), Ata (14), Dhruva (14), Eka (4), Free / no tala —
because the preset also carries the beat grouping, which decides where the stronger clicks fall.
`BEATS` and `NADAI` set the cycle on their own if you write something else. `SA` is the tonic,
key plus octave, or a frequency in Hz. `[TAGS:]` adds extra words for the search box.

**`SCALE` is what lets you use a raga the engine has never heard of.** Written with variant
numbers — `S R2 G3 M1 P D2 N3` — it tells the player exactly which swaras the raga uses, so
Kadanakuthuhalam or Chandrajyothi plays correctly with no code change at all. A numbered
`AROHANA` does the same job. Only a song that names an unknown raga *and* gives no scale stops
the build, and the message says what to add.

Header names are forgiving: `Sruthi`, `Thala`, `Arohanam`, `Avarohanam`, `Raagam`, `Gati`,
`Tempo` and `Song` are all understood and stored under the standard names.

Then the music, section by section:

```
[SECTION: Pallavi]
[SWARA]
G,,,    | M,,,    | G,   M,   ||
[SAHITYA]
go        var       dha  ni
```

Only `[SWARA]` rows make sound. The `[SAHITYA]` row underneath is text — letters like S, R, G
in a lyric never become notes. Each syllable attaches to whichever swara sits above its first
letter, so line the columns up by eye and the highlighting follows.

Save the file. The dev server reloads and the song appears in the picker.

## 4. The notation, in short

| You write | It means |
| --- | --- |
| `G` | one note-space, pitch resolved through the raga |
| `G,` `G,,,` | each comma adds a note-space and holds the same note — one sound, not repeated |
| `[G M D N]` | double speed: each swara and comma inside takes half a note-space |
| `.N` or `Ṇ` | lower octave |
| `N'` or `Ṅ` | upper octave |
| `G2`, `M1` | an explicit variant, overriding the raga's default |
| `\|` `\|\|` | bar lines — shown, silent, and they take no time |
| `,` at the start | silence: this is how a song enters after sam (see Eduppu below) |
| `-` `/` `\` `~` | phrasing and gamakam marks — shown, silent, no time |

A note-space is the smallest unit: at 8 beats with nadai 4, a cycle is 32 of them. Bare letters
resolve through the raga, so in Hindolam `G M D N` plays G2 M1 D1 N2. A swara the raga does not
contain — `P` in Hindolam — is an error, not a guess.

If the raga you need isn't in the engine yet, add it to the `RAGAS` table at the top of
`src/lib/swara/engine.js`:

```js
'Kadanakuthuhalam': {
  swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3'],
  arohana: 'S R2 G3 M1 P D2 N3 Ṡ',
  avarohana: 'Ṡ N3 D2 P M1 G3 R2 S'
},
```

Where a raga holds two variants of one letter, add `defaults: { D: 'D2', N: 'N2' }` to say what
a bare letter means.

### Eduppu

A comma with no swara before it in its section is silence, not a sustain, so a song that enters
after sam is written the way you would write it on paper:

```
[SWARA]
, , , , , ,  G,,, | M,,, G,,, M,,, D,,, ||
```

Those six note-spaces of rest count towards the cycle, the metronome clicks through them, and
the player reports the eduppu — "+6" — in the information strip. Each `[SECTION:]` starts fresh,
so the anupallavi may enter at a different point from the pallavi without the pallavi's last
note being stretched into it.

All the cycle arithmetic is measured from the eduppu, not from sam. A song that enters six
note-spaces late and keeps that position throughout is correct, and nothing is reported — the
six spaces are not a shortfall.

For atita eduppu, where the song begins *before* sam, give the pick-up its own line padded with
commas so the first swaras land at the end of it; sam then falls at the start of the next line.

`-`, `/`, `\` and `~` are reading marks — phrasing and gamakam hints. They are displayed and
take no time at all. `*` is not recognised and will be reported as an error.

## 5. When the build complains

A notation mistake stops the build with the file, line and column:

```
Error: Notation errors in src/content/songs/raguvamsasudha.txt
  line 14, col 9: "P" is not part of Kadanakuthuhalam...
```

Fix that line and save. Cycle arithmetic is a warning rather than an error, and it is reported
one line at a time — `line 12 — 30 note-spaces, 2 missing` — rather than as a total for the
whole passage. The build continues either way, because a fragment or an exercise may
legitimately not close.

## 6. Writing songs comfortably

Use the standalone editor in `Documents\Swara-Player` — open `index.html` in a browser. It has
the notation editor with line numbers, inline error highlighting, the cycle check, a raga editor,
and fields for composer, tags, arohana and avarohana. A strip at the top shows the song's raga,
tala, beats × nadai, sruthi, tempo and cycle count as you work.

The Help tab has a row of tap-to-copy swaras for the three octaves — Ṣ Ṛ G̣ Ṃ P̣ Ḍ Ṇ below,
S R G M P D N in the middle, Ṡ Ṙ Ġ Ṁ Ṗ Ḋ Ṅ above — so a dotted note can be pasted in rather
than typed. `.N` and `N'` still work if you prefer them.

**Download Text** now writes the whole header block for you, so the exported file drops straight
into `src/content/songs/` with nothing to type. Opening a file there reads those headers back —
raga, tala, tempo and sruthi are restored to the controls — so a song moves between the site and
the editor without losing its settings.

That app is for you alone and is never deployed. The site gets the finished text file.

## 7. What a visitor can do

When a song loads, a strip above the notation shows its raga, tala, beats × nadai, sruthi,
tempo and cycle count, with the arohana and avarohana underneath — and the song's own tempo and
sruthi are applied, so it plays as you saved it.

Pick a song from the box at the top: typing filters by song name, raga, composer, tala or
anything in `[TAGS:]`, with the matching text highlighted in each result. Arrow keys move
through the list, Enter opens, Escape closes. The chosen song is remembered, and its address
(`?song=<file name>`) can be linked to directly.

Press play, pause, stop or restart. Tap any swara to start from there. Shift-tap a second swara
to mark a passage, then set Loop to "Selected passage" — or loop the whole song or the current
section. Change tempo in the bar at the bottom, and tonic, octave, volumes and the metronome in
the *Tempo, pitch and sound* panel. On a keyboard: space plays or pauses, S stops, R restarts,
M toggles the click, and the arrow keys nudge the tempo.

Their changes are theirs alone — nothing they do touches the notation or affects anyone else.
