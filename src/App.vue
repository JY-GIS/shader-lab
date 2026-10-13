<script setup lang="ts">
import ShaderScene from './components/ShaderScene.vue'
</script>

<template>
  <main class="app-shell">
    <header class="workspace-bar">
      <div class="workspace-title">
        <strong>Shader Lab</strong>
        <span>第 01 课 · 实验区域</span>
      </div>
      <span class="status">Cesium Ready</span>
    </header>
    <ShaderScene />
  </main>
</template>
