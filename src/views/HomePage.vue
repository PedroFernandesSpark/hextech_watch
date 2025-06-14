<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title class="ion-text-center">HEXTECH 0.8.f</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-grid>
        <ion-row class="ion-justify-content-center">
          <ion-col size="12" size-md="6">
            <ion-button v-if="!deviceId" expand="block" @click="abrirConfiguracoes" color="tertiary">
              <ion-icon name="bluetooth" slot="start"></ion-icon>
              Procurar Dispositivos
            </ion-button>
            <ion-button v-if="deviceId" expand="block" color="danger" @click="enviarFlagEDesconectar">
              <ion-icon name="power" slot="start"></ion-icon>
              Desconectar Dispositivo
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
        <ion-row v-if="showExportButton" class="ion-margin-top">
          <ion-col size="12" class="ion-text-center">
            <ion-button :disabled="isExporting" color="warning" @click="exportChartsToPDF">
              <ion-spinner slot="start" v-if="isExporting" name="dots"></ion-spinner>
              {{ isExporting ? 'Exportando PDF...' : 'Exportar Gráficos como PDF' }}
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
            <div class="chart-wrapper chart-capture">
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
              class="chart-wrapper chart-capture"
              
            >
              <LineChart :chartData="chart" :options="chartOptions" />
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
        <ion-modal v-if="showConfigModal" :is-open="showConfigModal" @willDismiss="showConfigModal = false">

        <ion-content class="ion-padding">
          <h2>Configurações de Conexão</h2>

          <ion-item>
            <ion-label position="stacked">Frequência (Hz)</ion-label>
            <input v-model="config.frequencia" type="number" placeholder="Ex: 50" class="native-input" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Tamanho da Janela (s)</ion-label>
            <input v-model="config.tamanhoJanela" type="number" placeholder="Ex: 50" class="native-input" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Tempo do Gráfico (s)</ion-label>
            <input v-model="config.tempoGrafico" type="number" placeholder="Ex: 50" class="native-input" />
          </ion-item>

          <ion-button expand="block" color="success" @click="confirmarConfiguracoes">Confirmar e Conectar</ion-button>
          <ion-button expand="block" color="medium" @click="showConfigModal = false">Cancelar</ion-button>
        </ion-content>
      </ion-modal>
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
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

import { reactive } from 'vue';
import jsPDF from 'jspdf';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default {
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonList, IonItem, IonCard, IonCardHeader,
    IonGrid, IonRow, IonCol, IonLabel, IonSegment, IonSegmentButton, IonIcon,
    LineChart
  },
  data() {
    return {
      showConfigModal: false,
      config: {
        frequencia: 50,
        tamanhoJanela: 10,
        tempoGrafico: 20
      },
      countdown: 0,
      isExporting: false,
      showOverlay: false,
      heartRateCharts: [],
      chartImages: [], // <- aqui salvamos os base64 das imagens
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
      showExportButton: false, // <- botão exportar
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
    async enviarFlagEDesconectar() {
      if (!this.deviceId) return;

      try {
        // Enviar flag de parada (exemplo: "STOP")
        const encoder = new TextEncoder();
        const stopFlag = encoder.encode('STOP'); // Aqui você pode trocar o conteúdo da flag
        await BleClient.write(this.deviceId, this.serviceUUID, this.characteristicUUID, stopFlag);

        // Agora desconecta
        await BleClient.disconnect(this.deviceId);

        // Limpa estados locais
        this.deviceId = null;
        this.dataFromDevice = '';
        this.readsPerSec = 0;
        this.array = [];
        this.bpmHistory = [];
        this.heartRateOverTime = [];
        this.heartRateCharts = [];
        this.render = false;
        this.showExportButton = false;

        console.log('Dispositivo desconectado com sucesso.');

      } catch (error) {
        console.error('Erro ao enviar flag ou desconectar:', error);
      }
    },
    abrirConfiguracoes() {
      this.showConfigModal = true;
    },

    async confirmarConfiguracoes() {
      this.showConfigModal = false;

      try {
        this.devices = [];

        const device = await BleClient.requestDevice({ name: 'HEXTECH_WATCH', services: [this.serviceUUID] });
        if (!device) return;

        this.deviceId = device.deviceId;
        await BleClient.connect(this.deviceId);
        this.dataFromDevice = this.deviceId;

        // Transmitindo a frequência via Bluetooth (Magia de Escrita BLE)
        const encoder = new TextEncoder();
        const freqValue = encoder.encode(this.config.frequencia.toString());
        await BleClient.write(this.deviceId, this.serviceUUID, this.characteristicUUID, freqValue);

        // Caso queira, aqui você pode salvar os outros dois parâmetros (tamanho de janela e tempo do gráfico)
        // para usar depois no processamento dos dados.

        this.startReading();
      } catch (error) {
        console.error('Erro durante conexão ou envio da frequência:', error);
      }
    },
    startCountdownBeforeMeasurement() {
      this.countdown = 10;
      this.showOverlay = true;

      const interval = setInterval(() => {
        this.countdown--;
        if (this.countdown <= 0) {
          clearInterval(interval);
          this.showOverlay = false;
          this.collectHeartRateOverTime();
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
      this.chartData.labels = rawValues.map((_, idx) => (idx / this.config.frequencia).toFixed(2));
      this.chartData.datasets[0].data = filteredData.map(item => item.value);
      this.render = true;
    },
  async calculateHeartRateWavelet() {
    const now = Date.now();
    const windowMs = this.config.tamanhoJanela * 1000;
    const windowStart = now - windowMs;

    const dataWindow = this.array.filter(item => item.timestamp >= windowStart);
    if (dataWindow.length < Math.max(50, this.config.frequencia * this.config.tamanhoJanela * 0.3)) {
      return { chart: null, bpm: 0 };
    }

    const rawValues = dataWindow.map(i => i.value);
    const timestamps = dataWindow.map(i => i.timestamp);

    const samplesPerSecond = this.config.frequencia;

    // 🔮 Suavização proporcional ajustada para cada faixa de frequência
    let smoothWindowSize = 0;
    if (samplesPerSecond <= 50) {
      smoothWindowSize = Math.max(7, Math.floor(samplesPerSecond * 0.3));  // Frequências baixas → suavização mais agressiva
    } else if (samplesPerSecond <= 100) {
      smoothWindowSize = Math.floor(samplesPerSecond * 0.15);
    } else {
      smoothWindowSize = Math.floor(samplesPerSecond * 0.07);
    }
    smoothWindowSize = Math.max(5, smoothWindowSize);

    const smoothed = rawValues.map((_, i, arr) => {
      const start = Math.max(i - Math.floor(smoothWindowSize / 2), 0);
      const end = Math.min(i + Math.floor(smoothWindowSize / 2), arr.length);
      const slice = arr.slice(start, end);
      const valid = slice.filter(x => typeof x === 'number');
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    });

    const avg = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    const std = Math.sqrt(smoothed.reduce((a, b) => a + (b - avg) ** 2, 0) / smoothed.length);

    // Amplitude mínima mais rigorosa para baixas frequências
    const amplitudeMinima = samplesPerSecond <= 50 ? std * 1.0 : std * 0.5;

    const threshold = avg + std * 1.0;
    const peaks = [];
    let lastPeakTime = 0;
    const minIntervalMs = 600;  // Fisiológico: Mínimo 600ms entre batimentos (~100 BPM máx real)

    for (let i = 1; i < smoothed.length - 1; i++) {
      const isPeak =
        smoothed[i] > smoothed[i - 1] &&
        smoothed[i] > smoothed[i + 1] &&
        smoothed[i] > threshold &&
        (smoothed[i] - avg) > amplitudeMinima;

      const timeSinceLastPeak = timestamps[i] - lastPeakTime;

      if (isPeak && timeSinceLastPeak >= minIntervalMs) {
        peaks.push(timestamps[i]);
        lastPeakTime = timestamps[i];
      }
    }

    let bpm = 0;
    if (peaks.length >= 2) {
      const intervals = peaks.slice(1).map((t, i) => t - peaks[i]);
      const validIntervals = intervals.filter(i => i >= minIntervalMs && i <= 1500);
      if (validIntervals.length > 0) {
        const avgIntervalMs = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        bpm = 60000 / avgIntervalMs;
      }
    }

    const min = Math.min(...smoothed);
    const max = Math.max(...smoothed);
    const normalized = smoothed.map(v => (v - min) / (max - min || 1));

    const labels = timestamps.map((t) => ((t - timestamps[0]) / 1000).toFixed(2));

    const chart = {
      labels,
      datasets: [
        {
          label: `${Math.round(bpm)} BPM`,
          data: normalized,
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.2
        }
      ]
    };

    return { chart, bpm: Math.round(bpm) };
  },


    async collectHeartRateOverTime() {
      this.heartRateOverTime = [];
      this.heartRateCharts = [];
      this.chartImages = [];
      this.showExportButton = false;

      let count = 0;

      // 🕑 Intervalo de coleta baseado na frequência do gráfico desejado
      // Exemplo: se o usuário quer um ponto por segundo, calcula o intervalo com base na frequência
      const graphIntervalMs = 1000; // Aqui você pode modular, por exemplo, um gráfico por segundo

      const interval = setInterval(async () => {
        const { chart, bpm } = await this.calculateHeartRateWavelet();
        if (chart) {
          this.heartRateCharts.push(chart);
          this.heartRateOverTime.push(bpm);
          count++;
        }

        // Termina após 10 ciclos (ex: 10s de medição) — ou ajuste para `config.tempoGrafico`
        if (count >= this.config.tempoGrafico) {
          clearInterval(interval);
          this.renderHeartRateOverTimeChart();
          this.$nextTick(() => {
            this.convertChartsToImages();
            this.showExportButton = true;
          });
        }
      }, graphIntervalMs);
    },

    renderHeartRateOverTimeChart() {
      this.resetChartDataset('FC por 10s (BPM)', 'rgb(255, 99, 132)', 0.3);
      this.chartData.labels = this.heartRateOverTime.map((_, i) => `${i + 1}s`);
      this.chartData.datasets[0].data = [...this.heartRateOverTime];
      this.render = true;
    },

    convertChartsToImages() {
      const canvases = document.querySelectorAll('.chart-wrapper canvas');
      this.chartImages = [];

      canvases.forEach((canvas, idx) => {
        try {
          const dataUrl = canvas.toDataURL('image/png');

          if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
            this.chartImages.push(dataUrl);
          } else {
            console.warn(`Canvas ${idx} gerou imagem inválida e será ignorado.`);
          }
        } catch (error) {
          console.error(`Erro ao gerar imagem do canvas ${idx}:`, error);
        }
      });
    },
    exportChartsToPDF() {
  this.isExporting = true;

  // 🟨 PDF em modo paisagem
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const charts = [...this.heartRateCharts, this.chartData];

  const renderChartToImage = (chartConfig) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 2000; // mais largo para paisagem
      canvas.height = 500;

      const ctx = canvas.getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: chartConfig,
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: { display: true }
          },
          scales: {
            x: { display: true },
            y: { display: true }
          }
        }
      });

      setTimeout(() => {
        const image = canvas.toDataURL('image/jpeg', 0.8);
        chart.destroy();
        canvas.remove();
        resolve(image);
      }, 300);
    });
  };

  const exportAll = async () => {
    for (let i = 0; i < charts.length; i++) {
      const image = await renderChartToImage(charts[i]);
      if (i > 0) pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, 0, width, height, undefined, 'FAST');
    }

    const pdfDataUri = pdf.output('datauristring');
    const base64Data = pdfDataUri.split(',')[1];

    try {
      await Filesystem.writeFile({
        path: 'graficos_frequencia.pdf',
        data: base64Data,
        directory: Directory.Documents
      });

      alert('PDF salvo com sucesso em Documentos!');
    } catch (err) {
      console.error('Erro ao salvar PDF:', err);
      alert('Falha ao salvar PDF.');
    } finally {
      this.isExporting = false;
    }
  };

  exportAll();
},

    startReading() {
      if (!this.deviceId) return;

      let readCount = 0;
      const samplingInterval = 100;

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

      setInterval(() => {
        this.readsPerSec = readCount;
        readCount = 0;
      }, 1000);
    }
  }
};
</script>

