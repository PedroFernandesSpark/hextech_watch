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
      <ion-button @click="renderFilteredChartAdvanced" color="danger">Filtro Avançado</ion-button>
      <ion-button @click="calculateHeartRateWavelet" color="medium">FC</ion-button>

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

function butterBandPass(lowCut, highCut, fs, order) {
  const nyquist = 0.5 * fs;
  const low = lowCut / nyquist;
  const high = highCut / nyquist;
  return [[low, high, order], null];
}

function filtfilt(params, _, signal) {
  const [low, high, order] = params;
  const filtered = signal.map((val, idx, arr) => {
    const prev = arr[idx - 1] ?? val;
    const next = arr[idx + 1] ?? val;
    return (prev + val + next) / 3;
  });
  return filtered;
}

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
      xx.push(0);
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
  async created() {
    await BleClient.initialize({ androidNeverForLocation: true });
  },
  methods: {
    async safeCalculateHeartRate() {
      try {
        this.calculatingHeartRate = true;
        await this.calculateHeartRateWavelet();
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
    } 
  }
};
</script>
