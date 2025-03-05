<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Bluetooth App</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-button @click="scanDevices">Search Devices</ion-button>

      <ion-list>
        <ion-item v-for="device in devices" :key="device.uuids" v-if="device[0]">
          {{ device.name || 'Unnamed' }} - {{ device.uuids }}
        </ion-item>
      </ion-list>

      <ion-card v-if="dataFromDevice">
        <ion-card-header>
          Connected to: HEXTECH WATCH
        </ion-card-header>
        <ion-card-content>
          Data from device: {{ dataFromDevice }}
        </ion-card-content>
      </ion-card>

      <div v-if="chartData.datasets[0].data.length">
        <LineChart :chart-data="chartData" :chart-options="chartOptions" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonItem, IonCard, IonCardHeader, IonCardContent } from '@ionic/vue';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

export default {
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonItem, IonCard, IonCardHeader, IonCardContent, LineChart: Line
  },
  data() {
    return {
      devices: [],
      dataFromDevice: '',
      chartData: {
        labels: [],
        datasets: [{
          label: 'Bluetooth Data',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false
      }
    };
  },
  async created() {
    await BleClient.initialize({ androidNeverForLocation: true });
    console.log('Bluetooth LE initialized');
  },
  methods: {
    async scanDevices() {
      try {
        await BleClient.requestLEScan({ name: 'HEXTECH_WATCH' }, async (e) => {
          if (e) this.devices.push(e);
        });
        
        await BleClient.connect("F0:24:F9:57:5C:8E");
        let i = 0;
        while (i <= 700) {
          const data = await BleClient.read(
            "F0:24:F9:57:5C:8E",
            "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
            "e5a1d466-344c-4be3-ab3f-189f80dd7518"
          );
          
          this.dataFromDevice = new TextDecoder().decode(data);
          this.updateChartData(parseFloat(this.dataFromDevice));
          await this.saveDataToFile(this.dataFromDevice);
          i++;
        }
      } catch (error) {
        console.error('Error during scan:', error);
      }
    },
    async saveDataToFile(data) {
      try {
        await Filesystem.appendFile({
          path: 'bluetooth_data.txt',
          data: data + '\n',
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        console.log('Data saved:', data);
      } catch (error) {
        console.error('Error saving file:', error);
      }
    },
    updateChartData(value) {
      if (!isNaN(value)) {
        this.chartData.labels.push(new Date().toLocaleTimeString());
        this.chartData.datasets[0].data.push(value);
        if (this.chartData.labels.length > 20) {
          this.chartData.labels.shift();
          this.chartData.datasets[0].data.shift();
        }
      }
    }
  }
};
</script>

<style scoped>
div {
  height: 300px;
  width: 100%;
}
</style>
