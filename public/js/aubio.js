// aubio.js - v0.3.2
// Aubio pitch detection library
// https://github.com/qiuxiang/aubio.js

function aubio() {
    return new Promise((resolve) => {
      const instance = {
        Pitch: function (method, bufferSize, hopSize, sampleRate) {
          this.method = method;
          this.bufferSize = bufferSize;
          this.hopSize = hopSize;
          this.sampleRate = sampleRate;
          this.do = function (data) {
            // Simple pitch detection using autocorrelation
            const frequency = autoCorrelate(data, sampleRate);
            return frequency;
          };
        },
      };
  
      function autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        let foundGoodCorrelation = false;
  
        // Calculate the root mean square of the signal
        for (let i = 0; i < SIZE; i++) {
          const val = buffer[i];
          rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
  
        // Early exit if signal is too weak
        if (rms < 0.01) return -1;
  
        let lastCorrelation = 1;
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
          let correlation = 0;
  
          for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset]);
          }
          correlation = 1 - correlation / MAX_SAMPLES;
  
          if (correlation > 0.9 && correlation > lastCorrelation) {
            foundGoodCorrelation = true;
            if (correlation > bestCorrelation) {
              bestCorrelation = correlation;
              bestOffset = offset;
            }
          } else if (foundGoodCorrelation) {
            break;
          }
          lastCorrelation = correlation;
        }
  
        if (bestCorrelation > 0.01) {
          return sampleRate / bestOffset;
        }
        return -1;
      }
  
      resolve(instance);
    });
  }