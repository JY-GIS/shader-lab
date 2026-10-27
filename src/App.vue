<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'

const demos = [
  { id: 'demo01', label: 'Demo 01 · 城市告警', component: defineAsyncComponent(() => import('./components/CityAlertShaderScene.vue')) },
  { id: 'demo02', label: 'Demo 02 · 城市夜景', component: defineAsyncComponent(() => import('./components/CityNightShaderScene.vue')) },
  { id: 'demo03', label: 'Demo 03 · 方向箭头', component: defineAsyncComponent(() => import('./components/RouteArrowShaderScene.vue')) },
  { id: 'demo04', label: 'Demo 04 · 数字孪生', component: defineAsyncComponent(() => import('./Vibe-Coding/Byte-Dance/byte-dance/DigitalTwinShaderScene.vue/index.js')) },
]
const activeDemo = ref(new URLSearchParams(window.location.search).get('demo') || 'demo04')
const currentDemo = computed(() => demos.find((demo) => demo.id === activeDemo.value) ?? demos[3]!)

function changeDemo() {
  const url = new URL(window.location.href)
  url.searchParams.set('demo', activeDemo.value)
  window.history.replaceState(null, '', url)
}
</script>

<template>
  <main class="app-shell">
    <header class="workspace-bar">
      <div class="workspace-title">
        <span class="lab-symbol">S<span>/</span>L</span>
        <strong>Shader Lab</strong>
        <span class="workspace-description">图形与城市可视化实验</span>
      </div>
      <div class="workspace-navigation">
        <span class="workspace-engine">CESIUM / GLSL</span>
        <select v-model="activeDemo" aria-label="切换 Demo" @change="changeDemo">
          <option v-for="demo in demos" :key="demo.id" :value="demo.id">{{ demo.label }}</option>
        </select>
      </div>
    </header>
    <component :is="currentDemo.component" />
  </main>
</template>
