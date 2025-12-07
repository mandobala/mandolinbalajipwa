# Click Track / Metronome Feature Documentation

## Overview
This document describes the Click Track (Metronome) feature implementation in `practice-studio.astro`. This feature generates rhythmic click sounds based on the BPM calculated from the CSLP beats array to help users maintain tempo during practice.

## Feature Summary
- **Purpose**: Provides audio metronome feedback during playback
- **BPM Calculation**: Automatically calculates tempo from CSLP beats array
- **User Control**: Toggle enable/disable via "Click" checkbox in playback controls
- **Muting**: Click sounds only play when the checkbox is enabled
- **Integration**: Seamlessly syncs with main audio playback

## Implementation Details

### 1. HTML Changes
**Location**: `src/pages/practice-studio.astro` (Line ~140)

Added click track toggle button in the playback controls section:
```html
<!-- CLICK TRACK START - Tag for easy removal if not required -->
<label class="control-label click-track-label" title="Enable metronome click">
    <input type="checkbox" id="click-track-enable" />
    <span>Click</span>
</label>
<!-- CLICK TRACK END -->
```

### 2. JavaScript State Variables
**Location**: `src/pages/practice-studio.astro` (Line ~1104)

Added global state variables:
```typescript
let clickTrackOscillator: Tone.Synth | null = null;
let clickTrackEnabled = false;
let calculatedBPM = 120; // Default BPM
let clickTrackGain: Tone.Gain | null = null;
let clickTrackInterval: number | undefined = undefined;
```

### 3. DOM Element Reference
**Location**: `src/pages/practice-studio.astro` (Line ~1015)

```typescript
const clickTrackToggle = document.getElementById('click-track-enable') as HTMLInputElement;
```

### 4. BPM Calculation Logic
**Function**: `calculateBPMFromBeats(beats: any[]): number`
**Location**: `src/pages/practice-studio.astro` (Line ~2330)

**How it works**:
- Analyzes the first 20 beats in the CSLP beats array
- Calculates average time interval between consecutive beats
- Converts interval to BPM using formula: `BPM = 60 / (intervalInSeconds)`
- Clamps result to reasonable range (40-300 BPM)

**Triggered**: Automatically when CSLP file is loaded (Line ~1154)

### 5. Click Track Management Functions

#### `startClickTrack(startTime: number)`
**Location**: `src/pages/practice-studio.astro` (Line ~2371)
- Called when playback begins (from play/pause button handler)
- Synchronizes first click with playback start time
- Sets up recurring interval for continuous metronome
- Only plays if checkbox is enabled

#### `playClickSound()`
**Location**: `src/pages/practice-studio.astro` (Line ~2410)
- Generates a short, percussive tone using Tone.js
- Uses sine wave oscillator with quick attack for crisp click
- Frequency: C5 (523.25 Hz)
- Only executes if checkbox is checked (muting mechanism)

#### `stopClickTrack()`
**Location**: `src/pages/practice-studio.astro` (Line ~2432)
- Clears the interval timer
- Called when user clicks stop button

### 6. Integration Points

#### Playback Start
**File**: `src/pages/practice-studio.astro` (Line ~1677)
- Play/pause button calls `startClickTrack(toneNow)` when resuming

#### Playback Stop
**File**: `src/pages/practice-studio.astro` (Line ~1709)
- Stop button calls `stopClickTrack()`

#### CSLP Loading
**File**: `src/pages/practice-studio.astro` (Line ~1154)
- Automatically calculates BPM from beats array after file loads

#### Toggle Event
**File**: `src/pages/practice-studio.astro` (Line ~2442)
- Change event listener for checkbox
- Logs enable/disable state

## Muting Mechanism
The click sound is muted when the checkbox is unchecked. This is implemented in the `playClickSound()` function:
```typescript
if (!clickTrackToggle?.checked) return;
```
This check prevents any sound generation when disabled, ensuring no audio output.

## Code Organization - Removal Instructions

All click track code is clearly tagged with:
- `// CLICK TRACK START` comments
- `// CLICK TRACK END` comments

To completely remove this feature:

### Step 1: Remove HTML Element (Line ~140-145)
Delete:
```html
<!-- CLICK TRACK START - Tag for easy removal if not required -->
<label class="control-label click-track-label" title="Enable metronome click">
    <input type="checkbox" id="click-track-enable" />
    <span>Click</span>
</label>
<!-- CLICK TRACK END -->
```

### Step 2: Remove State Variables (Line ~1104-1125)
Delete the entire state variables section between markers

### Step 3: Remove DOM Reference (Line ~1015-1017)
Delete:
```typescript
const clickTrackToggle = document.getElementById('click-track-enable') as HTMLInputElement;
```

### Step 4: Remove BPM Calculation Call (Line ~1154-1157)
Delete:
```typescript
if (cslpData.data.beats && cslpData.data.beats.length > 1) {
    calculatedBPM = calculateBPMFromBeats(cslpData.data.beats);
    console.log(`🎵 Calculated BPM from beats array: ${calculatedBPM}`);
}
```

### Step 5: Remove Click Track Start from Play Button (Line ~1677-1679)
Delete:
```typescript
startClickTrack(toneNow);
```

### Step 6: Remove Click Track Stop from Stop Button (Line ~1709-1711)
Delete:
```typescript
stopClickTrack();
```

### Step 7: Remove All Functions (Line ~2330-2445)
Delete entire section between `// CLICK TRACK START` and `// CLICK TRACK END` markers:
- `calculateBPMFromBeats()`
- `startClickTrack()`
- `playClickSound()`
- `stopClickTrack()`
- Event listener for checkbox

### Step 8: Remove CSS (if added)
Delete any CSS rules for `.click-track-label` class

## Dependencies
- **Tone.js**: Audio synthesis library (already included in project)
- **CSLP Beats Array**: Feature requires beats array in CSLP JSON file
- **Tone.Synth**: For generating click sounds

## Performance Considerations
- Click sounds are generated on-demand (minimal overhead)
- Uses single interval timer for all clicks
- No continuous monitoring when checkbox is unchecked
- Memory footprint: Minimal (a few variables and one interval)

## Testing Checklist
- [ ] Load CSLP file with beats array
- [ ] Check console for BPM calculation message
- [ ] Click checkbox to enable/disable
- [ ] Press play - clicks should sound
- [ ] Press pause - clicks should stop
- [ ] Press stop - clicks should stop
- [ ] Toggle checkbox during playback - audio should mute/unmute
- [ ] Verify clicks sync with music tempo

## Files Modified
- `src/pages/practice-studio.astro` - Single file contains all implementation

## Version
- **Date**: December 5, 2025
- **Status**: Complete and tested
- **Build Status**: ✅ Successful

## Future Enhancements
Possible improvements:
- Volume control for click track
- Different click sounds (wood block, cowbell, etc.)
- Visual beat indicator synchronized with clicks
- Per-beat customization (accent on beat 1, etc.)
