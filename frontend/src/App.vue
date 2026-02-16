<script setup>
import { ref } from 'vue';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const status = ref('Not checked');

async function checkHealth() {
  status.value = 'Checking...';
  try {
    const response = await fetch(`${apiBaseUrl}/api/health`);
    const data = await response.json();
    status.value = `${data.status} - DB: ${data.db}`;
  } catch (_error) {
    status.value = 'API unavailable';
  }
}
</script>

<template>
  <main>
    <h1>Rogainizer</h1>
    <p>Frontend + API starter is configured.</p>
    <p><strong>API Base URL:</strong> {{ apiBaseUrl }}</p>
    <button @click="checkHealth">Check API Health</button>
    <p><strong>Status:</strong> {{ status }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 700px;
  margin: 3rem auto;
  padding: 0 1rem;
  font-family: Inter, system-ui, Arial, sans-serif;
}

button {
  margin: 1rem 0;
  padding: 0.6rem 1rem;
  cursor: pointer;
}
</style>
