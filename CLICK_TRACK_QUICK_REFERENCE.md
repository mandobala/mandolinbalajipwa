# Click Track Feature - Quick Summary

## What Was Added

A **Metronome/Click Track** feature in the Rehearsal Studio that:
1. **Calculates BPM** automatically from the CSLP beats array
2. **Generates click sounds** synced with playback
3. **Provides a toggle checkbox** to enable/disable clicks
4. **Mutes automatically** when checkbox is unchecked

## Files Changed
- ✅ `src/pages/practice-studio.astro` - Main implementation

## Where to Find It
- **UI Element**: "Click" checkbox in playback controls (next to count-in button)
- **HTML**: Line ~140-145
- **JavaScript**: Lines ~1104-1125, ~1154-1157, ~1677-1679, ~1709-1711, ~2330-2445

## How It Works

```
1. Song loads → CSLP file processed
   ↓
2. Beats array analyzed → BPM calculated (auto)
   ↓
3. User clicks Play button
   ↓
4. Click Track Starts → Metronome syncs with audio
   ↓
5. User toggles "Click" checkbox
   - ☑ Checked = Click sound plays
   - ☐ Unchecked = Click sound muted
   ↓
6. User clicks Stop → Click track stops
```

## Code Organization - Deletion Guide

**All code is tagged with `// CLICK TRACK START` and `// CLICK TRACK END` markers**

To remove completely:
1. Find and delete all code between the markers
2. Test that build succeeds
3. See `CLICK_TRACK_FEATURE_DOCUMENTATION.md` for detailed removal steps

## Key Functions

| Function | Purpose | Called By |
|----------|---------|-----------|
| `calculateBPMFromBeats()` | Analyzes beats array to determine tempo | When CSLP loads |
| `startClickTrack()` | Starts metronome interval | Play button |
| `playClickSound()` | Generates single click tone | Interval timer |
| `stopClickTrack()` | Stops metronome interval | Stop button |

## Muting Mechanism
Click sounds only play when the checkbox is **checked**.
- ✅ Checked → Click sounds play
- ❌ Unchecked → All sound generation is skipped (muted)

## Testing
1. Load a song with CSLP file containing beats array
2. Check browser console for: `🎵 Calculated BPM from beats array: XXX`
3. Click Play → You should hear metronome clicks
4. Toggle "Click" checkbox → Sound mutes/unmutes
5. Click Stop → Clicks stop

## Removal Procedure
All code between **CLICK TRACK START** and **CLICK TRACK END** markers can be safely deleted:
- ~6 lines of HTML (line 140-145)
- ~20 lines of state variables (line 1104-1125)
- 3 function calls in event handlers (3 locations)
- ~115 lines of functions (line 2330-2445)

**Total**: Less than 150 lines of easily identifiable code

See `CLICK_TRACK_FEATURE_DOCUMENTATION.md` for complete removal guide.
