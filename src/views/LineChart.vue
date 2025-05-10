<template>
    <div>
      <canvas ref="chartCanvas"></canvas>
    </div>
  </template>
  
  <script>
  import { Chart, registerables } from 'chart.js';
  import { ref, onMounted, watch } from 'vue';
  
  Chart.register(...registerables);
  
  export default {
    props: {
      chartData: Object
    },
    setup(props) {
      const chartCanvas = ref(null);
      let chartInstance = null;
  
      onMounted(() => {
        if (chartCanvas.value) {
          chartInstance = new Chart(chartCanvas.value, {
            type: 'line',
            data: props.chartData,
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }
      });
  
      watch(props.chartData, (newData) => {
        if (chartInstance) {
          chartInstance.data = newData;
          chartInstance.update();
        }
      }, { deep: true });
  
      return { chartCanvas };
    }
  };
  </script>
  
  <style scoped>
  div {
    width: 100%;
    height: 300px;
  }
  </style>
  