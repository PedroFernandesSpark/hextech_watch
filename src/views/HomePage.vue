<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title class="ion-text-center">HEXTECH 0.5.7</ion-title>
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

        <ion-row class="ion-justify-content-center ion-margin-top">
          <ion-col size="6" size-md="4">
            <ion-button expand="block" @click="renderChartAndSaveData">
              Renderizar Gráfico
            </ion-button>
          </ion-col>
          <ion-col size="6" size-md="4">
            <ion-button expand="block" color="success" @click="collectHeartRateOverTime">
              FC por 10s (Wavelet)
            </ion-button>
          </ion-col>
        </ion-row>

        <ion-row v-if="chartData.datasets[0].data.length && render" class="ion-margin-top">
          <ion-col size="12">
            <div class="chart-wrapper">
              <LineChart :chartData="chartData" :options="chartOptions" />
            </div>
          </ion-col>
        </ion-row>

        <ion-row v-if="heartRateCharts.length" class="ion-margin-top">
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

        <ion-row v-if="heartRateCharts.length > 9" class="ion-margin-top">
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
      isReadingData: false,
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
    createFilteredChart(title, data) {
      const values = data.map(v => v.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const normalized = values.map(v => (v.value - min) / (max - min || 1));
      const smoothed = normalized.map((val, i, arr) => (arr[i - 1] ?? val + val + arr[i + 1] ?? val) / 3);
      const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
      
      return {
        labels,
        datasets: [{
          label: title,
          data: smoothed,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.2
        }]
      };
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
      if (dataWindow.length < 40) return;

      const rawValues = dataWindow.map(i => i.value);
      const smoothed = rawValues.map((v, i, arr) => {
        const w = [arr[i - 2], arr[i - 1], v, arr[i + 1], arr[i + 2]];
        const valid = w.filter(x => typeof x === 'number');
        return valid.reduce((a, b) => a + b, 0) / valid.length;
      });

      const min = Math.min(...smoothed);
      const max = Math.max(...smoothed);
      const normalized = smoothed.map(v => (v - min) / (max - min || 1));
      const convolved = normalized;
      const avg = convolved.reduce((sum, v) => sum + v, 0) / convolved.length;
      const std = Math.sqrt(convolved.reduce((sum, v) => sum + (v - avg) ** 2, 0) / convolved.length);
      const threshold = avg + std * 0.8;

      const peaks = [];
      const timestamps = dataWindow.map(item => item.timestamp);
      const minSamplesBetweenPeaks = 25;

      for (let i = 1; i < convolved.length - 1; i++) {
        if (convolved[i] > convolved[i - 1] && convolved[i] > convolved[i + 1] && convolved[i] > threshold) {
          if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minSamplesBetweenPeaks) {
            peaks.push(i);
          }
        }
      }

      let bpm = 0;
      if (peaks.length >= 2) {
        const times = peaks.map(i => timestamps[i]);
        const intervals = times.slice(1).map((t, i) => t - times[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        bpm = 60000 / avgInterval;
      }

      if (!isNaN(bpm) && bpm > 40 && bpm < 200) {
        const last = this.bpmHistory[this.bpmHistory.length - 1];
        if (!last || Math.abs(bpm - last) < 20) {
          this.bpmHistory.push(bpm);
          if (this.bpmHistory.length > 5) this.bpmHistory.shift();
        }
      }

      const weights = [0.1, 0.15, 0.2, 0.25, 0.3];
      const recent = this.bpmHistory.slice(-5);
      const avgBPM = recent.reduce((acc, val, i) => acc + val * weights[i], 0);

      this.resetChartDataset(`Wavelet FC (${Math.round(avgBPM)} BPM)`, 'rgb(54, 162, 235)', 0.2);
      this.chartData.labels = timestamps.map(t => {
        const date = new Date(t);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      });
      this.chartData.datasets[0].data = [...normalized];

      if (!this.chartData.datasets[1]) {
        this.chartData.datasets.push({
          label: 'Picos',
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
      //this.chartData.datasets[1].data = [...peaksData];
      this.heartRateCharts.push(
        {
          labels:  timestamps.map(t => {
        const date = new Date(t);
        return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      }),
          datasets: [        
            {
              label: `(${Math.round(avgBPM)} BPM)`,
              data: normalized,
              borderColor: 'rgb(54, 162, 235)',
              tension: 0.2
            }
        ]

        }
      );
      this.render = true;
    },

    async collectHeartRateOverTime() {
      this.heartRateOverTime = [];
      this.heartRateCharts = [];
      let count = 0;
      const interval = setInterval(async () => {
        const now = Date.now();
        const windowStart = now - 10000;
        const dataWindow = this.array.filter(item => item.timestamp >= windowStart);
        if (dataWindow.length < 40) return;

        await this.calculateHeartRateWavelet();
        const last = this.bpmHistory[this.bpmHistory.length - 1] ?? 0;
        this.heartRateOverTime.push(Math.round(last));

        this.createFilteredChart(`Dados Normalizados FC ${count + 1}`, dataWindow);

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
      setInterval(async () => {
        try {
          const data = await BleClient.read(this.deviceId, this.serviceUUID, this.characteristicUUID);
          const decoded = new TextDecoder().decode(data);
          const values = decoded.split(',').map(v => Number(v.trim()));
          const timestamp = Date.now();
          values.forEach(value => {
            if (!isNaN(value)) this.array.push({ value, timestamp });
          });
        } catch (error) {
          console.error('Erro ao ler dados:', error);
        }
      }, 10);
    }
  }
};
</script>
