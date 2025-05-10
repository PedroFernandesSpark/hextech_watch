<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>HEXTECH 0.3.1</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-button @click="scanDevices">Search Devices</ion-button>

      <ion-list>
        <ion-item v-for="device in devices" :key="device.uuids">
          {{ device.name || 'Unnamed' }} - {{ device.uuids }}
        </ion-item>
      </ion-list>

      <ion-card v-if="dataFromDevice">
        <ion-card-header>Connected to: HEXTECH WATCH</ion-card-header>
      </ion-card>

      <ion-card v-if="readsPerSec">
        <ion-card-header>Reads per Second: {{ readsPerSec }} Hz</ion-card-header>
      </ion-card>

      <ion-button @click="renderChartAndSaveData">Renderizar Gráfico</ion-button>
      <ion-button @click="renderNormalizedChart" color="tertiary">Gráfico Normalizado</ion-button>
      <ion-button @click="renderFilteredChartAdvanced" color="danger">Filtro Avançado</ion-button>
      <ion-button @click="calculateHeartRateAdvanced" color="warning">Calcular FC (Picos)</ion-button>
      <ion-button @click="calculateHeartRateWavelet" color="medium">FC (Wavelet)</ion-button>




      <div class="chart-container" v-if="chartData.datasets[0].data.length && render">
        <div class="chart-wrapper">
          <LineChart :chartData="chartData" :options="chartOptions" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonList,
  IonItem,
  IonCard,
  IonCardHeader
} from '@ionic/vue';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import LineChart from './LineChart.vue';
import { reactive } from 'vue';

// Butterworth helpers
function butterBandPass(lowCut, highCut, fs, order) {
  const nyquist = 0.5 * fs;
  const low = lowCut / nyquist;
  const high = highCut / nyquist;
  // Simplificado: valores fixos (não depende de lib externa como scipy)
  return [[low, high, order], null]; // mock de coeficientes
}

function filtfilt(params, _, signal) {
  const [low, high, order] = params;
  // Mock: faz um filtro simples (você pode depois implementar um Butterworth real aqui)
  const cutoffLow = low;
  const cutoffHigh = high;
  const filtered = signal.map((val, idx, arr) => {
    const prev = arr[idx - 1] ?? val;
    const next = arr[idx + 1] ?? val;
    return (prev + val + next) / 3;
  });
  return filtered;
}

// PreprocessFiltering class
class PreprocessFiltering {
  constructor() {
    this.lowCut = 0.8;
    this.highCut = 4.5;
    this.samplingFreq = 25;
    this.filterOrder = 2;
    this.mu = 0.0002;
    this.M = 10;
  }

  filter(signal) {
    const buttered = filtfilt(...butterBandPass(this.lowCut, this.highCut, this.samplingFreq, this.filterOrder), signal);

    const e = [];
    let w = Array(this.M).fill(0);
    const xx = Array(this.M).fill(0);

    for (let n = 0; n < buttered.length; n++) {
      xx.shift();
      xx.push(0); // sem ruído de referência

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

export default {
  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonList,
    IonItem,
    IonCard,
    IonCardHeader,
    LineChart
  },
  data() {
    return {
      calculatingHeartRate: false, 
      heartRateIntervalId: null,
      readsPerSec: 0,
      render: false,
      array: [],
      devices: [],
      dataFromDevice: '',
      isReadingData: false,
      deviceId: null,
      serviceUUID: "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
      characteristicUUID: "e5a1d466-344c-4be3-ab3f-189f80dd7518",
      chartData: reactive({
        labels: [],
        datasets: [{
          label: 'Bluetooth Data',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      }),
      chartOptions: { responsive: true, maintainAspectRatio: false },
      filterProcessor: new PreprocessFiltering()
    };
  },
//   mounted() {
//   this.heartRateIntervalId = setInterval(() => {
//     if (!this.calculatingHeartRate) {
//       if (typeof requestIdleCallback !== 'undefined') {
//         requestIdleCallback(() => this.safeCalculateHeartRate());
//       } else {
//         setTimeout(() => this.safeCalculateHeartRate(), 0);
//       }
//     }
//   }, 5000);
// },

//   beforeUnmount() {
//   if (this.heartRateIntervalId) {
//     clearInterval(this.heartRateIntervalId);
//     this.heartRateIntervalId = null;
//   }
// },


  async created() {
    await BleClient.initialize({ androidNeverForLocation: true });
    console.log('Bluetooth LE initialized');
  },
  methods: {
    async safeCalculateHeartRate() {
    try {
      this.calculatingHeartRate = true;
      await this.calculateHeartRateWavelet(); // essa é sua função original otimizada
    } catch (e) {
      console.error('Erro ao calcular FC:', e);
    } finally {
      this.calculatingHeartRate = false;
    }
  },
    async scanDevices() {
      try {
        this.devices = [];
        const device = await BleClient.requestDevice({
          name: 'HEXTECH_WATCH',
          services: [this.serviceUUID]
        });
        if (!device) return;
        this.deviceId = device.deviceId;
        await BleClient.connect(this.deviceId);
        this.dataFromDevice = this.deviceId;
        console.log(`Conectado a ${this.deviceId}`);
        this.startReading();
      } catch (error) {
        console.error('Erro ao escanear dispositivos:', error);
      }
    },
    startReading() {
      if (!this.deviceId) return;
      this.isReadingData = true;

      setInterval(async () => {
        try {
          const data = await BleClient.read(
            this.deviceId,
            this.serviceUUID,
            this.characteristicUUID
          );

          const decoded = new TextDecoder().decode(data);
          const values = decoded.split(',').map(val => Number(val.trim()));
          const timestamp = Date.now();

          for (let value of values) {
            if (!isNaN(value)) {
              this.array.push({ value, timestamp });
            }
          }
        } catch (error) {
          console.error('Erro ao ler dados:', error);
          this.isReadingData = false;
        }
      }, 10);
    },
    renderChartAndSaveData() {
      this.readsPerSec = 0;
      if (this.array.length > 1) {
        const totalTime = this.array[this.array.length - 1].timestamp - this.array[0].timestamp;
        if (totalTime > 0) {
          this.readsPerSec = (this.array.length * 1000) / totalTime;
        }
      }

      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const filteredData = this.array.filter(item => item.timestamp >= oneSecondAgo);

      this.chartData.labels = filteredData.map(item => {
        const date = new Date(item.timestamp);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = 'Bluetooth Data';
      this.chartData.datasets[0].data = filteredData.map(item => item.value);
      this.render = true;
      this.saveDataToFile(filteredData);
    },
    renderFilteredChart() {
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const filteredData = this.array.filter(item => item.timestamp >= oneSecondAgo);

      if (!filteredData.length) return;

      const values = filteredData.map(item => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const normalized = values.map(v => (v - min) / (max - min || 1));

      const smoothed = normalized.map((val, i, arr) => {
        const prev = arr[i - 1] ?? val;
        const next = arr[i + 1] ?? val;
        return (prev + val + next) / 3;
      });

      this.chartData.labels = filteredData.map(item => {
        const date = new Date(item.timestamp);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = 'Dados Normalizados Filtrados';
      this.chartData.datasets[0].data = smoothed;
      this.render = true;
    },
    renderNormalizedChart() {
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const filteredData = this.array.filter(item => item.timestamp >= oneSecondAgo);

      if (!filteredData.length) return;

      const values = filteredData.map(item => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const normalized = values.map(v => (v - min) / (max - min || 1));

      this.chartData.labels = filteredData.map(item => {
        const date = new Date(item.timestamp);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = 'Dados Normalizados';
      this.chartData.datasets[0].data = normalized;
      this.render = true;
    },
    renderFilteredChartAdvanced() {
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const filteredData = this.array.filter(item => item.timestamp >= oneSecondAgo);

      if (!filteredData.length) return;

      const values = filteredData.map(item => item.value);
      const filteredValues = this.filterProcessor.filter(values);

      this.chartData.labels = filteredData.map(item => {
        const date = new Date(item.timestamp);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = 'Filtro Avançado (Butterworth + LMS)';
      this.chartData.datasets[0].data = filteredValues;
      this.render = true;
    },
    calculateHeartRateAdvanced() {
      const now = Date.now();
      const windowStart = now - 3000; // 3 segundos
      const dataWindow = this.array.filter(item => item.timestamp >= windowStart);

      if (dataWindow.length < 10) return; // precisa de mais amostras

      const rawValues = dataWindow.map(item => item.value);

      // 1. Suavização (média móvel de 3 pontos)
      const smoothed = rawValues.map((v, i, arr) => {
        const prev = arr[i - 1] ?? v;
        const next = arr[i + 1] ?? v;
        return (prev + v + next) / 3;
      });

      // 2. Normalização min-max
      const min = Math.min(...smoothed);
      const max = Math.max(...smoothed);
      const normalized = smoothed.map(v => (v - min) / (max - min || 1));

      // 3. Parâmetros de pico (equivalente a find_peaks)
      const minHeight = 0.6;
      const minDistance = 20; // 20 amostras = 400ms (mínimo esperado entre batimentos)

      const peaks = [];
      for (let i = 1; i < normalized.length - 1; i++) {
        if (
          normalized[i] > normalized[i - 1] &&
          normalized[i] > normalized[i + 1] &&
          normalized[i] > minHeight
        ) {
          if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
            peaks.push(i);
          }
        }
      }

      // 4. Calcular BPM com base em picos e tempo da janela
      const durationSeconds = 3;
      const bpm = (peaks.length / durationSeconds) * 60;

      // 5. Atualizar gráfico
      this.chartData.labels = dataWindow.map(item => {
        const date = new Date(item.timestamp);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = `Sinal Normalizado (${Math.round(bpm)} BPM)`;
      this.chartData.datasets[0].data = normalized;
      this.render = true;

      console.log(`Frequência Cardíaca Estimada: ${Math.round(bpm)} BPM (Picos: ${peaks.length})`);
    },
    calculateHeartRateWavelet() {
      const now = Date.now();
      const windowStart = now - 8000; // janela de 8 segundos
      const dataWindow = this.array.filter(item => item.timestamp >= windowStart);

      if (dataWindow.length < 40) return;

      const rawValues = dataWindow.map(item => item.value);

      // Suavização simples
      const smoothed = rawValues.map((v, i, arr) => {
        const prev = arr[i - 1] ?? v;
        const next = arr[i + 1] ?? v;
        return (prev + v + next) / 3;
      });

      // Normalização min-max
      const min = Math.min(...smoothed);
      const max = Math.max(...smoothed);
      const normalized = smoothed.map(v => (v - min) / (max - min || 1));

      // Função Ricker wavelet
      function rickerWavelet(points, a) {
        const wavelet = [];
        const mid = Math.floor(points / 2);
        for (let i = 0; i < points; i++) {
          const x = (i - mid) / a;
          const val = (2 / (Math.sqrt(3 * a) * Math.PI ** 0.25)) * (1 - x ** 2) * Math.exp((-x) ** 2 / 2);
          wavelet.push(val);
        }
        return wavelet;
      }

      // Convolução simples
      function convolve(signal, kernel) {
        const output = [];
        const kMid = Math.floor(kernel.length / 2);
        for (let i = 0; i < signal.length; i++) {
          let acc = 0;
          for (let j = 0; j < kernel.length; j++) {
            const idx = i + j - kMid;
            if (idx >= 0 && idx < signal.length) {
              acc += signal[idx] * kernel[j];
            }
          }
          output.push(acc);
        }
        return output;
      }

      const wavelet = rickerWavelet(21, 1.5); // mais sensível
      const convolved = convolve(normalized, wavelet);

      // Threshold adaptativo
      const avg = convolved.reduce((sum, v) => sum + v, 0) / convolved.length;
      const std = Math.sqrt(convolved.reduce((sum, v) => sum + (v - avg) ** 2, 0) / convolved.length);
      const threshold = avg + std * 0.3;
      const minDistance = 25; // ~500ms

      // Detectar picos
      const peaks = [];
      const timestamps = dataWindow.map(item => item.timestamp);
      for (let i = 1; i < convolved.length - 1; i++) {
        if (
          convolved[i] > convolved[i - 1] &&
          convolved[i] > convolved[i + 1] &&
          convolved[i] > threshold
        ) {
          if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
            peaks.push(i);
          }
        }
      }

      // Calcular BPM com intervalo entre picos
      let bpm = 0;
      if (peaks.length >= 2) {
        const times = peaks.map(i => timestamps[i]);
        const intervals = times.slice(1).map((t, i) => t - times[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        bpm = 60000 / avgInterval;
      }

      // Armazenar histórico de BPMs e calcular média móvel
      if (!this.bpmHistory) this.bpmHistory = [];
      if (!isNaN(bpm) && bpm > 40 && bpm < 200) {
        this.bpmHistory.push(bpm);
        if (this.bpmHistory.length > 5) {
          this.bpmHistory.shift(); // mantém último 5
        }
      }
      const avgBPM = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length || 0;

      // Atualizar gráfico
      this.chartData.labels = timestamps.map(t => {
        const date = new Date(t);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });

      this.chartData.datasets[0].label = `Wavelet FC (${Math.round(avgBPM)} BPM)`;
      this.chartData.datasets[0].data = [...normalized];

      if (!this.chartData.datasets[1]) {
        this.chartData.datasets.push({
          label: 'Picos detectados',
          data: [],
          pointRadius: 6,
          pointBackgroundColor: 'red',
          pointStyle: 'circle',
          borderWidth: 0,
          type: 'line',
          showLine: false
        });
      }

      const peaksData = normalized.map((val, idx) => peaks.includes(idx) ? val : null);
      this.chartData.datasets[1].data = [...peaksData];

      this.render = true;

      console.log(`✅ BPM (média móvel): ${Math.round(avgBPM)} | Picos detectados: ${peaks.length}`);
    },


    async saveDataToFile(data) {
      try {
        const result = await Filesystem.writeFile({
          path: 'bluetooth_data.txt',
          data: JSON.stringify(data),
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        console.log('Data saved:', result.uri);
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
  }
};
</script>
