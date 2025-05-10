import { butterBandPass, filtfilt } from './filtersUtils'; // funções auxiliares que criamos

export class PreprocessFiltering {
  constructor() {
    this.lowCut = 0.8;
    this.highCut = 4.5;
    this.samplingFreq = 25;
    this.filterOrder = 2;
    this.mu = 0.0002;
    this.M = 10;
  }

  filter(signal) {
    // 1. Butterworth
    const buttered = filtfilt(...butterBandPass(this.lowCut, this.highCut, this.samplingFreq, this.filterOrder), signal);
    
    // 2. LMS (simplificado só para o sinal)
    const e = [];
    let w = Array(this.M).fill(0);
    const xx = Array(this.M).fill(0);

    for (let n = 0; n < buttered.length; n++) {
      xx.shift();
      xx.push(0); // sem ruído de referência no modo 1D

      let v = 0;
      for (let i = 0; i < this.M; i++) {
        v += w[i] * xx[i];
      }
      const error = buttered[n] - v;
      e.push(error);

      for (let i = 0; i < this.M; i++) {
        w[i] += this.mu * error * xx[i];
      }
    }

    return e;
  }
}
