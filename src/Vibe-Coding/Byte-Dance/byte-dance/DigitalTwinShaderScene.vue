<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {
  createDigitalTwinScene,
  type DigitalTwinSceneController,
  type TwinLayer,
} from './createDigitalTwinScene'

type Preset = 'complete' | 'city' | 'network' | 'scan'
const container = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const error = ref('')
const buildingCount = ref(0)
const selectedStation = ref('基站发射中心')
const preset = ref<Preset>('complete')
const paused = ref(false)
const orbit = ref(false)
const speed = ref(1)
const glow = ref(1)
const flightTailLength = ref(0.42)
const sidebarOpen = ref(window.matchMedia('(min-width: 701px)').matches)
const layers = ref<Record<TwinLayer, boolean>>({
  buildings: true, roads: true, flows: true, rings: true, markers: true, scan: true,
})
const layerOptions: { key: TwinLayer; title: string; subtitle: string }[] = [
  { key: 'buildings', title: '城市白模', subtitle: '青蓝渐变 · 地标建筑' },
  { key: 'flows', title: '动态飞线', subtitle: '能量彗星 · 渐变光尾' },
  { key: 'markers', title: '站点标记', subtitle: '全息信标 · 环绕轨道' },
  { key: 'roads', title: '道路流光', subtitle: '城市路网 · 绿色脉络' },
  { key: 'rings', title: '扩散光环', subtitle: '旋转刻度 · 分段波纹' },
  { key: 'scan', title: '建筑扫描', subtitle: '径向扫描 · 楼体光带' },
]
const presets: { key: Preset; number: string; name: string; description: string }[] = [
  { key: 'complete', number: '01', name: '综合场景', description: '全部特效' },
  { key: 'city', number: '02', name: '基础城市', description: '建筑与地标' },
  { key: 'network', number: '03', name: '信号网络', description: '飞线与站点' },
  { key: 'scan', number: '04', name: '城市扫描', description: '动态光环' },
]
const enabledCount = computed(() => Object.values(layers.value).filter(Boolean).length)
let controller: DigitalTwinSceneController | undefined

watch(layers, (value) => {
  for (const key of Object.keys(value) as TwinLayer[]) controller?.setLayer(key, value[key])
}, { deep: true })
watch(speed, (value) => controller?.setSpeed(value))
watch(glow, (value) => controller?.setGlow(value))
watch(flightTailLength, (value) => controller?.setFlightTailLength(value))
watch(paused, (value) => controller?.setPaused(value))
watch(orbit, (value) => controller?.setOrbit(value))

function applyPreset(value: Preset) {
  preset.value = value
  layers.value = {
    buildings: true,
    roads: value === 'complete' || value === 'network',
    flows: value === 'complete' || value === 'network',
    markers: value === 'complete' || value === 'network',
    rings: value === 'complete' || value === 'scan',
    scan: value === 'complete' || value === 'scan',
  }
}

function resetView() {
  orbit.value = false
  controller?.setOrbit(false)
  controller?.resetView()
}

function initializeScene() {
  if (!container.value) return
  controller?.destroy()
  controller = undefined
  ready.value = false
  error.value = ''
  try {
    controller = createDigitalTwinScene(container.value, {
      onReady(count: number) {
        buildingCount.value = count
        ready.value = true
      },
      onError(message: string) {
        error.value = message
      },
      onSelect(name: string) {
        selectedStation.value = name
      },
    })
    for (const key of Object.keys(layers.value) as TwinLayer[]) controller.setLayer(key, layers.value[key])
    controller.setSpeed(speed.value)
    controller.setGlow(glow.value)
    controller.setFlightTailLength(flightTailLength.value)
    controller.setPaused(paused.value)
    controller.setOrbit(orbit.value)
  } catch (reason) {
    console.error('demo04 场景初始化失败：', reason)
    error.value = '无法创建三维场景，请使用支持 WebGL 2 的浏览器。'
  }
}

onMounted(initializeScene)
onUnmounted(() => {
  controller?.destroy()
  controller = undefined
})
</script>

<template>
  <div class="digital-twin" :class="{ 'sidebar-closed': !sidebarOpen }">
    <aside class="twin-sidebar" aria-label="数字孪生场景控制">
      <div class="project-heading">
        <div class="project-mark"><span /><span /><span /><span /></div>
        <div><strong>数字孪生城市</strong><span>URBAN DIGITAL TWIN</span></div>
      </div>

      <div class="sidebar-scroll">
        <div class="section-caption"><span>场景预设</span><span>SCENES</span></div>
        <nav class="scene-presets" aria-label="场景预设">
          <button v-for="item in presets" :key="item.key" :class="{ active: preset === item.key }"
            :aria-pressed="preset === item.key" @click="applyPreset(item.key)">
            <span class="preset-number">{{ item.number }}</span>
            <span class="preset-copy"><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span>
            <span class="preset-arrow">↗</span>
          </button>
        </nav>

        <div class="section-caption layer-caption"><span>效果图层</span><span>{{ enabledCount }} / 6</span></div>
        <div class="layer-list">
          <label v-for="item in layerOptions" :key="item.key" class="layer-row">
            <span><strong>{{ item.title }}</strong><small>{{ item.subtitle }}</small></span>
            <input v-model="layers[item.key]" type="checkbox" role="switch" :aria-label="item.title" />
          </label>
        </div>

        <div class="section-caption parameter-caption"><span>动态参数</span><span>PARAMETERS</span></div>
        <label class="range-control">
          <span>动画速度 <output>{{ speed.toFixed(1) }}×</output></span>
          <input v-model.number="speed" type="range" min="0.2" max="3" step="0.1" aria-label="动画速度" />
        </label>
        <label class="range-control">
          <span>辉光强度 <output>{{ glow.toFixed(1) }}</output></span>
          <input v-model.number="glow" type="range" min="0.2" max="2" step="0.1" aria-label="辉光强度" />
        </label>
        <label class="range-control">
          <span>飞线尾长 <output>{{ Math.round(flightTailLength * 100) }}%</output></span>
          <input v-model.number="flightTailLength" type="range" min="0.12" max="0.6" step="0.02" aria-label="飞线尾长" />
        </label>
      </div>

      <div class="sidebar-footer"><i /><span>本地程序化场景</span><span class="footer-version">V.04</span></div>
    </aside>

    <div class="twin-workspace">
      <header class="twin-toolbar">
        <button class="menu-button" :aria-label="sidebarOpen ? '收起侧栏' : '展开侧栏'" @click="sidebarOpen = !sidebarOpen">☰</button>
        <div class="toolbar-title"><strong>珠江新城</strong><span>GUANGZHOU · CHINA</span></div>
        <span class="toolbar-divider" />
        <span class="toolbar-subtitle">城市数字孪生可视化</span>
        <div class="toolbar-status"><i :class="{ stopped: paused || !ready }" />{{ error ? '渲染异常' : !ready ? '场景加载中' : paused ? '动画已暂停' : '场景运行中' }}</div>
      </header>

      <div class="scene-viewport">
        <section ref="container" class="cesium-container" aria-label="珠江新城三维数字孪生场景" />
        <div class="scene-heading">
          <span class="scene-eyebrow">DEMO 04 <b>/</b> DIGITAL TWIN</span>
          <h1>连接城市的每一束光</h1>
          <p>珠江新城 · 信号网络与城市光影实验</p>
        </div>
        <div class="scene-coordinate">23°07′08″ N <span>/</span> 113°19′16″ E</div>

        <div class="view-controls" aria-label="视角工具">
          <button title="重置视角" aria-label="重置视角" @click="resetView"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7M6 10v10h12V10M10 20v-6h4v6" /></svg></button>
          <button title="放大" aria-label="放大" @click="controller?.zoom(1)">＋</button>
          <button title="缩小" aria-label="缩小" @click="controller?.zoom(-1)">−</button>
          <button :class="{ selected: orbit }" :aria-pressed="orbit" title="自动环绕" aria-label="自动环绕" @click="orbit = !orbit"><svg viewBox="0 0 24 24"><path d="M19 7c-2-3-8-4-12-1S3 16 6 18s10 3 13-1M19 3v5h-5" /></svg></button>
        </div>

        <div v-if="!ready || error" class="scene-message" :class="{ 'error-message': error }" role="status">
          <template v-if="error"><strong>场景暂时无法显示</strong><p>{{ error }}</p><button @click="initializeScene">重新加载</button></template>
          <template v-else><i class="loading-spinner" /><strong>正在构建城市</strong><p>生成建筑、路网与光影材质…</p></template>
        </div>

        <div class="station-info"><span class="station-indicator" /><span><small>当前站点</small><strong>{{ selectedStation }}</strong></span><span class="station-tag">信号节点</span></div>
        <div class="scene-legend"><span><i class="cyan" />城市建筑</span><span><i class="yellow" />信号链路</span><span><i class="green" />流光路网</span></div>
        <div class="scene-bottom-bar">
          <div class="scene-stats"><span><b>{{ ready ? buildingCount : '—' }}</b> 栋建筑</span><span><b>06</b> 信号站点</span><span><b>05</b> 连接链路</span></div>
          <div class="playback"><button :aria-label="paused ? '播放动画' : '暂停动画'" @click="paused = !paused"><span>{{ paused ? '▶' : 'Ⅱ' }}</span>{{ paused ? '继续动画' : '暂停动画' }}</button><span class="interaction-hint">左键平移 · 滚轮缩放 · 中键倾斜</span></div>
        </div>
        <span class="data-note">程序化示意模型 · 非实测地理数据</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.digital-twin {
  display: grid;
  grid-template-columns: 222px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #080f19;
  color: #dce5f2;
  font-size: 12px;
}

.twin-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #172333;
  border-right: 1px solid #2a3747;
}

.project-heading {
  height: 78px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 19px;
  border-bottom: 1px solid #2b3747;
}

.project-heading strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.project-heading div > span {
  display: block;
  margin-top: 6px;
  color: #7c8a9c;
  font: 9px 'Segoe UI', sans-serif;
  letter-spacing: 1.2px;
}

.project-mark {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 30px;
  transform: skewY(-12deg);
}

.project-mark span {
  display: block;
  width: 5px;
  background: #32d5d9;
  height: 14px;
}

.project-mark span:nth-child(2) {
  height: 26px;
  background: #388bf3;
}

.project-mark span:nth-child(3) {
  height: 20px;
  background: #73f2ed;
}

.project-mark span:nth-child(4) {
  height: 30px;
  background: #388bf3;
}

.sidebar-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 0 15px 18px;
  scrollbar-width: thin;
  scrollbar-color: #3e4d60 transparent;
}

.section-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 5px 13px;
  color: #8898ac;
  font-size: 10px;
  letter-spacing: .8px;
}

.section-caption > span:last-child {
  font: 9px 'Segoe UI', sans-serif;
  letter-spacing: 1px;
  color: #63758d;
}

.scene-presets {
  display: grid;
  gap: 5px;
}

.scene-presets button {
  border: 1px solid transparent;
  border-radius: 4px;
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  padding: 11px 12px;
  color: #9dacc1;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.scene-presets button:hover {
  background: #223148;
}

.scene-presets button.active {
  color: white;
  background: #233f60;
  border-color: #335b80;
  box-shadow: inset 3px 0 #39c2f3;
}

.preset-number {
  font: 12px Consolas, monospace;
  color: #67829f;
}

.active .preset-number {
  color: #65d8f3;
}

.preset-copy strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
}

.preset-copy small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #71879f;
}

.active .preset-copy small {
  color: #8caac7;
}

.preset-arrow {
  margin-left: auto;
  font-size: 16px;
  color: #7295b7;
}

.layer-caption {
  margin-top: 27px;
}

.layer-list {
  border-top: 1px solid #2a3748;
}

.layer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 5px;
  border-bottom: 1px solid #263344;
  cursor: pointer;
}

.layer-row strong {
  font-size: 11px;
  font-weight: 500;
  color: #b7c5d8;
}

.layer-row small {
  display: block;
  margin-top: 4px;
  font-size: 9px;
  color: #6c8199;
}

.layer-row input {
  appearance: none;
  flex-shrink: 0;
  width: 27px;
  height: 15px;
  border-radius: 10px;
  background: #344357;
  margin: 0;
  cursor: pointer;
  transition: background .2s;
}

.layer-row input::before {
  content: '';
  display: block;
  margin: 3px;
  width: 9px;
  height: 9px;
  background: #a1afc0;
  border-radius: 50%;
  transition: transform .2s;
}

.layer-row input:checked {
  background: #2689d4;
}

.layer-row input:checked::before {
  background: white;
  transform: translateX(12px);
}

.parameter-caption {
  margin-top: 25px;
}

.range-control {
  display: block;
  margin: 0 5px 18px;
  color: #9cafc5;
  font-size: 10px;
}

.range-control > span {
  display: flex;
  justify-content: space-between;
  margin-bottom: 11px;
}

.range-control output {
  color: #71caf0;
  font: 11px Consolas, monospace;
}

.range-control input {
  width: 100%;
  height: 3px;
  display: block;
  margin: 0;
  accent-color: #4ca8ed;
  cursor: pointer;
}

.sidebar-footer {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 42px;
  gap: 7px;
  padding: 0 20px;
  border-top: 1px solid #2a3748;
  font-size: 9px;
  color: #7d8da3;
}

.sidebar-footer i {
  width: 5px;
  height: 5px;
  background: #51c6b9;
  border-radius: 50%;
}

.footer-version {
  margin-left: auto;
  font: 10px Consolas, monospace;
  color: #586e87;
}

.twin-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.twin-toolbar {
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 17px;
  padding: 0 22px 0 14px;
  background: #2485e3;
  color: white;
}

.menu-button {
  border: 0;
  background: transparent;
  color: white;
  cursor: pointer;
  font-size: 19px;
  padding: 5px;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  white-space: nowrap;
}

.toolbar-title strong {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 1px;
}

.toolbar-title span {
  font: 9px 'Segoe UI', sans-serif;
  color: #bbddff;
  letter-spacing: 1.3px;
}

.toolbar-divider {
  height: 15px;
  border-left: 1px solid #70b2f0;
}

.toolbar-subtitle {
  color: #d1e7ff;
  font-size: 11px;
}

.toolbar-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  font-size: 10px;
  color: #dcf1ff;
  white-space: nowrap;
}

.toolbar-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8affc7;
  box-shadow: 0 0 6px #a6ffcb;
}

.toolbar-status i.stopped {
  background: #ffd47c;
  box-shadow: none;
}

.scene-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scene-heading {
  position: absolute;
  top: 29px;
  left: 30px;
  pointer-events: none;
  text-shadow: 0 1px 12px #000;
}

.scene-eyebrow {
  color: #67b7cf;
  font: 9px Consolas, monospace;
  letter-spacing: 1.8px;
}

.scene-eyebrow b {
  color: #3d5b73;
  margin: 0 9px;
}

.scene-heading h1 {
  font-size: 21px;
  font-weight: 400;
  letter-spacing: 3px;
  margin: 13px 0 9px;
  color: #ecf4fd;
}

.scene-heading p {
  color: #728da3;
  font-size: 10px;
  margin: 0;
  letter-spacing: 1.1px;
}

.scene-coordinate {
  position: absolute;
  top: 31px;
  right: 28px;
  color: #6c879e;
  font: 10px Consolas, monospace;
  letter-spacing: .5px;
}

.scene-coordinate span {
  color: #3e5366;
  padding: 0 8px;
}

.view-controls {
  position: absolute;
  right: 24px;
  top: 90px;
  display: grid;
  background: #142332dc;
  border: 1px solid #2b4358;
  border-radius: 5px;
  overflow: hidden;
}

.view-controls button {
  display: grid;
  place-items: center;
  width: 35px;
  height: 36px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #2a3a4b;
  color: #aec6dc;
  cursor: pointer;
  font-size: 20px;
}

.view-controls button:last-child {
  border-bottom: 0;
}

.view-controls button:hover, .view-controls button.selected {
  background: #234868;
  color: #7ae9f2;
}

.view-controls svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.station-info {
  position: absolute;
  bottom: 95px;
  left: 29px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 15px;
  background: #0f2030da;
  border: 1px solid #2b4659;
  border-left: 2px solid #53cec9;
  border-radius: 3px;
}

.station-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid #69dec7;
  box-shadow: 0 0 0 4px #4acbbf14;
}

.station-info small {
  display: block;
  font-size: 9px;
  color: #6b8b9e;
  margin-bottom: 5px;
}

.station-info strong {
  font-size: 11px;
  color: #c6e5f0;
  font-weight: 500;
}

.station-tag {
  color: #7ca0b5;
  font-size: 9px;
  padding-left: 14px;
  margin-left: 8px;
  border-left: 1px solid #2c4354;
}

.scene-legend {
  display: flex;
  gap: 20px;
  position: absolute;
  right: 29px;
  bottom: 101px;
  color: #8097aa;
  font-size: 9px;
}

.scene-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scene-legend i {
  width: 6px;
  height: 6px;
  border-radius: 1px;
}

.cyan {
  background: #3ee4ef;
}

.yellow {
  background: #f5cd59;
}

.green {
  background: #9edc53;
}

.scene-bottom-bar {
  position: absolute;
  bottom: 31px;
  left: 29px;
  right: 29px;
  border-top: 1px solid #29415588;
  padding-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.scene-stats {
  display: flex;
  gap: 25px;
  color: #6b8499;
  font-size: 10px;
}

.scene-stats b {
  color: #b7cbdc;
  font: 15px Consolas, monospace;
  margin-right: 5px;
}

.playback {
  display: flex;
  align-items: center;
  gap: 20px;
}

.playback button {
  background: #172b3ed9;
  border: 1px solid #2c455d;
  color: #a7c3db;
  border-radius: 3px;
  padding: 7px 10px;
  font-size: 10px;
  cursor: pointer;
}

.playback button span {
  color: #69cfe2;
  margin-right: 8px;
}

.interaction-hint {
  color: #5c778d;
  font-size: 9px;
}

.data-note {
  position: absolute;
  bottom: 6px;
  right: 29px;
  font-size: 8px;
  color: #526b7e;
}

.scene-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 25px 32px;
  background: #102033ef;
  border: 1px solid #2e4960;
  border-radius: 6px;
  color: #c9e5f4;
}

.scene-message strong {
  font-size: 14px;
  font-weight: 500;
}

.scene-message p {
  color: #7f9ab2;
  font-size: 11px;
  line-height: 1.8;
}

.scene-message button {
  border: 1px solid #3c8bbd;
  border-radius: 3px;
  background: #216894;
  color: white;
  padding: 7px 18px;
  cursor: pointer;
}

.loading-spinner {
  display: block;
  width: 24px;
  height: 24px;
  margin: 0 auto 15px;
  border: 2px solid #2d455a;
  border-top-color: #65e3e4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sidebar-closed {
  grid-template-columns: 0 minmax(0, 1fr);
}

.sidebar-closed .twin-sidebar {
  visibility: hidden;
}

button, input {
  font-family: inherit;
}

button:focus-visible, input:focus-visible {
  outline: 2px solid #75e2f6;
  outline-offset: 3px;
}

@media (max-height: 850px) {
  .project-heading {
    height: 65px;
  }
  .section-caption {
    margin-top: 18px;
  }
  .scene-presets button {
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .layer-row {
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .range-control {
    margin-bottom: 16px;
  }
}

@media (max-width: 1050px) {
  .digital-twin {
    grid-template-columns: 195px minmax(0, 1fr);
  }
  .sidebar-closed {
    grid-template-columns: 0 minmax(0, 1fr);
  }
  .toolbar-subtitle, .toolbar-divider, .interaction-hint {
    display: none;
  }
  .toolbar-title span {
    font-size: 8px;
  }
  .scene-legend {
    gap: 12px;
  }
  .scene-heading h1 {
    font-size: 18px;
  }
}

@media (max-width: 700px) {
  .digital-twin {
    grid-template-columns: 0 minmax(0, 1fr);
  }
  .twin-sidebar {
    visibility: hidden;
  }
  .digital-twin:not(.sidebar-closed) .twin-sidebar {
    position: absolute;
    top: 102px;
    left: 0;
    bottom: 0;
    width: 215px;
    z-index: 5;
    visibility: visible;
    box-shadow: 8px 0 30px #0005;
  }
  .toolbar-title span, .scene-coordinate, .scene-legend {
    display: none;
  }
  .scene-heading {
    top: 23px;
    left: 20px;
  }
  .scene-heading h1 {
    font-size: 17px;
    letter-spacing: 1px;
  }
  .scene-bottom-bar {
    left: 20px;
    right: 20px;
  }
  .scene-stats {
    gap: 12px;
    font-size: 9px;
  }
  .scene-stats b {
    font-size: 12px;
  }
  .station-info {
    left: 20px;
    bottom: 88px;
  }
  .twin-toolbar {
    gap: 12px;
  }
  .toolbar-status {
    font-size: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}
</style>
