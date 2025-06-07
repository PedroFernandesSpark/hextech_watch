<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title class="ion-text-center">HEXTECH 0.6.3</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-grid>
        <ion-row class="ion-justify-content-center">
          <ion-col size="12" size-md="6">
            <ion-button expand="block" @click="scanDevices" color="tertiary">
              <ion-icon name="bluetooth" slot="start"></ion-icon>
              Procurar Dispositivos
            </ion-button>
          </ion-col>
        </ion-row>

        <ion-row class="ion-justify-content-center">
          <ion-col size="12" size-md="8">
            <ion-list v-if="devices.length">
              <ion-item v-for="device in devices" :key="device.uuids">
                <ion-label>{{ device.name || 'Unnamed' }} - {{ device.uuids }}</ion-label>
              </ion-item>
            </ion-list>
            <ion-card v-if="dataFromDevice">
              <ion-card-header>
                <ion-label>Conectado a: HEXTECH WATCH</ion-label>
              </ion-card-header>
            </ion-card>
            <ion-card v-if="readsPerSec">
              <ion-card-header>
                <ion-label>Frequência de Leitura: {{ readsPerSec.toFixed(2) }} Hz</ion-label>
              </ion-card-header>
            </ion-card>
          </ion-col>
        </ion-row>
        <ion-card v-if="dataFromDevice">
          <ion-card-header>
            <ion-label>Conectado a: HEXTECH WATCH</ion-label>
          </ion-card-header>
          <ion-card-header>
            <ion-label>Frequência Atual: {{ readsPerSec.toFixed(2) }} Hz</ion-label>
          </ion-card-header>
        </ion-card>

        <ion-row class="ion-justify-content-center ion-margin-top">
          <ion-col size="6" size-md="4">
            <ion-button expand="block" color="success" @click="startCountdownBeforeMeasurement">
              FC por 10s (Wavelet)
            </ion-button>
          </ion-col>
        </ion-row>
        <ion-modal v-if="countdown" :is-open="showOverlay" css-class="countdown-modal" :show-backdrop="false">
        <div class="countdown-overlay">
          <div class="countdown-circle">
            <div class="countdown-number">{{ countdown }}</div>
            <div class="countdown-label">Iniciando medição...</div>
          </div>
        </div>
      </ion-modal>
        <ion-row v-if="chartData.datasets[0].data.length && render && !countdown" class="ion-margin-top">
          <ion-col size="12">
            <div class="chart-wrapper">
              <LineChart :chartData="chartData" :options="chartOptions" />
            </div>
          </ion-col>
        </ion-row>

        <ion-row v-if="heartRateCharts.length && !countdown" class="ion-margin-top">
          <ion-col size="12">
            <ion-segment v-model="activeTab" scrollable>
              <ion-segment-button
                v-for="(chart, index) in heartRateCharts"
                :key="'seg-' + index"
                :value="index.toString()"
              >
                <ion-label>{{ index + 1 }}s - {{ chart.datasets[0].label }}</ion-label>
              </ion-segment-button>
            </ion-segment>
          </ion-col>
        </ion-row>

        <ion-row v-if="heartRateCharts.length > 9  && !countdown" class="ion-margin-top">
          <ion-col size="12">
            <div
              v-for="(chart, index) in heartRateCharts"
              :key="'tab-chart-' + index"
              v-show="activeTab === index.toString()"
              class="chart-wrapper"
            >
              <LineChart :chartData="chart" :options="chartOptions" />
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.countdown-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  color: white;
}

.countdown-circle {
  width: 200px;
  height: 200px;
  background: #222;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

.countdown-number {
  font-size: 4rem;
  font-weight: bold;
  color: #ffcc00;
}

.countdown-label {
  margin-top: 10px;
  font-size: 1.2rem;
  text-align: center;
}

.chart-wrapper {
  width: 100%;
  height: 300px;
  padding: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  background: #fff;
  border-radius: 12px;
}

ion-card-header ion-label {
  font-weight: bold;
  font-size: 1rem;
  color: var(--ion-color-dark);
}
</style>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonList, IonItem, IonCard, IonCardHeader,
  IonGrid, IonRow, IonCol, IonLabel, IonSegment, IonSegmentButton, IonIcon
} from '@ionic/vue';
import { BleClient } from '@capacitor-community/bluetooth-le';
import LineChart from './LineChart.vue';
import { reactive } from 'vue';

export default {
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonList, IonItem, IonCard, IonCardHeader,
    IonGrid, IonRow, IonCol, IonLabel, IonSegment, IonSegmentButton, IonIcon,
    LineChart
  },
  data() {
    return {
      countdown: 0,
      showOverlay: false,
      heartRateCharts: [],
      activeTab: '0',
      devices: [],
      deviceId: null,
      serviceUUID: "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
      characteristicUUID: "e5a1d466-344c-4be3-ab3f-189f80dd7518",
      dataFromDevice: '',
      readsPerSec: 0,
      array: [],
      bpmHistory: [],
      heartRateOverTime: [],
      render: false,
      chartData: reactive({
        labels: [],
        datasets: [{ label: 'Bluetooth Data', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 }]
      }),
      chartOptions: { responsive: true, maintainAspectRatio: false }
    };
  },
  async created() {
    await BleClient.initialize({ androidNeverForLocation: true });
  },
  methods: {
    startCountdownBeforeMeasurement() {
      this.countdown = 10;
      this.showOverlay = true;

      const interval = setInterval(() => {
        this.countdown--;
        if (this.countdown <= 0) {
          clearInterval(interval);
          this.showOverlay = false;
          this.collectHeartRateOverTime(); // chama o método real
        }
      }, 1000);
    },
    resetChartDataset(label, color, tension = 0.1) {
      this.chartData.datasets[0] = {
        label,
        data: [],
        borderColor: color,
        tension
      };
    },
    async scanDevices() {
      try {
        this.devices = [];
        const device = await BleClient.requestDevice({ name: 'HEXTECH_WATCH', services: [this.serviceUUID] });
        if (!device) return;
        this.deviceId = device.deviceId;
        await BleClient.connect(this.deviceId);
        this.dataFromDevice = this.deviceId;
        this.startReading();
      } catch (error) {
        console.error('Erro ao escanear dispositivos:', error);
      }
    },
    renderChartAndSaveData() {
      this.resetChartDataset('Bluetooth Data', 'rgb(75, 192, 192)');
      this.readsPerSec = 0;
      if (this.array.length > 1) {
        const totalTime = this.array[this.array.length - 1].timestamp - this.array[0].timestamp;
        if (totalTime > 0) this.readsPerSec = (this.array.length * 1000) / totalTime;
      }
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const filteredData = this.array.filter(item => item.timestamp >= oneSecondAgo);
      this.chartData.labels = filteredData.map(item => new Date(item.timestamp).toLocaleTimeString());
      this.chartData.datasets[0].data = filteredData.map(item => item.value);
      this.render = true;
    },
    async calculateHeartRateWavelet() {
  const now = Date.now();
  const windowStart = now - 10000;
  const dataWindow = this.array.filter(item => item.timestamp >= windowStart);
  if (dataWindow.length < 200) return { chart: null, bpm: 0 };

  const rawValues = dataWindow.map(i => i.value);

  // Filtro de média móvel (janela de 5)
  const smoothed = rawValues.map((_, i, arr) => {
    const slice = arr.slice(Math.max(i - 2, 0), i + 3);
    const valid = slice.filter(x => typeof x === 'number');
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  });

  const min = Math.min(...smoothed);
  const max = Math.max(...smoothed);
  const normalized = smoothed.map(v => (v - min) / (max - min || 1));

  const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;
  const std = Math.sqrt(normalized.reduce((a, b) => a + (b - avg) ** 2, 0) / normalized.length);
  const threshold = avg + std * 1.2;

  const peaks = [];
  const timestamps = dataWindow.map(i => i.timestamp);
  const minIntervalMs = 400;
  const maxIntervalMs = 1200;
  const minSamplesBetweenPeaks = Math.floor(50 * (minIntervalMs / 1000));

  for (let i = 1; i < normalized.length - 1; i++) {
    if (
      normalized[i] > normalized[i - 1] &&
      normalized[i] > normalized[i + 1] &&
      normalized[i] > threshold
    ) {
      const isFar = peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minSamplesBetweenPeaks;
      if (isFar) peaks.push(i);
    }
  }

  let bpm = 0;
  if (peaks.length >= 2) {
    const times = peaks.map(i => timestamps[i]);
    const intervals = times.slice(1).map((t, i) => t - times[i]);

    const valid = intervals.filter(i => i >= minIntervalMs && i <= maxIntervalMs);
    if (!valid.length) return { chart: null, bpm: 0 };

    const avgInterval = valid.reduce((a, b) => a + b, 0) / valid.length;
    bpm = 60000 / avgInterval;
  }

  if (!isNaN(bpm) && bpm >= 45 && bpm <= 180) {
    const last = this.bpmHistory[this.bpmHistory.length - 1];
    if (!last || Math.abs(bpm - last) <= 20) {
      this.bpmHistory.push(bpm);
      if (this.bpmHistory.length > 8) this.bpmHistory.shift();
    }
  }

  const weights = Array.from({ length: this.bpmHistory.length }, (_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const avgBPM = this.bpmHistory.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;

  const chart = {
    labels: timestamps.map(t => {
      const d = new Date(t);
      return `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, '0')}`;
    }),
    datasets: [
      {
        label: `${Math.round(avgBPM)} BPM`,
        data: normalized,
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.2
      }
    ]
  };

  return { chart, bpm: Math.round(avgBPM) };
}
,

    async collectHeartRateOverTime() {
      this.heartRateOverTime = [];
      this.heartRateCharts = [];
      let count = 0;

      const interval = setInterval(async () => {
        const { chart, bpm } = await this.calculateHeartRateWavelet();
        if (!chart) return;

        this.heartRateCharts.push(chart);
        this.heartRateOverTime.push(bpm);
        count++;

        if (count >= 10) {
          clearInterval(interval);
          this.renderHeartRateOverTimeChart();
        }
      }, 1000);
    },

    renderHeartRateOverTimeChart() {
      this.resetChartDataset('FC por 10s (BPM)', 'rgb(255, 99, 132)', 0.3);
      this.chartData.labels = this.heartRateOverTime.map((_, i) => `${i + 1}s`);
      this.chartData.datasets[0].data = [...this.heartRateOverTime];
      this.render = true;
    },

    startReading() {
      if (!this.deviceId) return;

      let readCount = 0;
      const samplingInterval = 10;

      setInterval(async () => {
        try {
          const data = await BleClient.read(this.deviceId, this.serviceUUID, this.characteristicUUID);
          const decoded = new TextDecoder().decode(data);
          const values = decoded.split(',').map(v => Number(v.trim()));
          const timestamp = Date.now();
          values.forEach(value => {
            if (!isNaN(value)) {
              this.array.push({ value, timestamp });
              readCount++;
            }
          });
        } catch (error) {
          console.error('Erro ao ler dados:', error);
        }
      }, samplingInterval);

      // Atualiza a frequência de leitura (Hz) a cada 1 segundo
      setInterval(() => {
        this.readsPerSec = readCount;
        readCount = 0;
      }, 1000);
    }
  }
};

</script>
