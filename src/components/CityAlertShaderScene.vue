<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileset,
  Credit,
  CustomShader,
  CustomShaderMode,
  HeadingPitchRange,
  Ion,
  LightingModel,
  Matrix4,
  Math as CesiumMath,
  UniformType,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import buildingAlertShaderSource from '../shader-demos/demo01/buildingAlert.glsl?raw'

const REEARTH_BUILDINGS_URL = 'https://buildings.reearth.land/tileset.json'
const INITIAL_HEIGHT_THRESHOLD = 100.0 // 预警高度阈值
const INITIAL_SCAN_HEIGHT_THRESHOLD = 150.0 // 扫描波高度阈值
const INITIAL_PULSE_SPEED = 2.0  // 脉冲速度
const SCAN_CENTER_WC = Cartesian3.fromDegrees(121.4997, 31.2397, 0.0)

const container = ref<HTMLDivElement | null>(null)
const heightThreshold = ref(INITIAL_HEIGHT_THRESHOLD)
const scanHeightThreshold = ref(INITIAL_SCAN_HEIGHT_THRESHOLD)
const pulseSpeed = ref(INITIAL_PULSE_SPEED)

let viewer: Viewer | undefined
let cityTileset: Cesium3DTileset | undefined
let cityCustomShader: CustomShader | undefined
let removePreRenderListener: (() => void) | undefined
let reearthCredit: Credit | undefined
let isUnmounted = false

watch(heightThreshold, (value) => {
  if (cityCustomShader && !cityCustomShader.isDestroyed()) {
    cityCustomShader.setUniform('u_heightThreshold', value)
  }
})

watch(pulseSpeed, (value) => {
  if (cityCustomShader && !cityCustomShader.isDestroyed()) {
    cityCustomShader.setUniform('u_pulseSpeed', value)
  }
})

watch(scanHeightThreshold, (value) => {
  if (cityCustomShader && !cityCustomShader.isDestroyed()) {
    cityCustomShader.setUniform('u_scanHeightThreshold', value)
  }
})

function createCityCustomShader() {
  return new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    // uniform ：所有片元共享的值
    uniforms: {
      u_time: {
        type: UniformType.FLOAT,
        value: 0.0,
      },
      u_pulseSpeed: {
        type: UniformType.FLOAT,
        value: INITIAL_PULSE_SPEED,
      },
      u_heightThreshold: {
        type: UniformType.FLOAT,
        value: INITIAL_HEIGHT_THRESHOLD,
      },
      u_scanHeightThreshold: {
        type: UniformType.FLOAT,
        value: INITIAL_SCAN_HEIGHT_THRESHOLD,
      },
      u_scanCenterWC: {
        type: UniformType.VEC3,
        value: SCAN_CENTER_WC,
      },
    },
    fragmentShaderText: buildingAlertShaderSource,
  })
}

function focusOnLujiazui(targetViewer: Viewer) {
  const center = Cartesian3.fromDegrees(121.5055, 31.2397, 100.0)
  const district = new BoundingSphere(center, 1200.0)

  targetViewer.camera.viewBoundingSphere(
    district,
    new HeadingPitchRange(
      CesiumMath.toRadians(25.0),
      CesiumMath.toRadians(-35.0),
      2800.0,
    ),
  )
  targetViewer.camera.lookAtTransform(Matrix4.IDENTITY)
}

function startUniformUpdates(targetViewer: Viewer, customShader: CustomShader) {
  const startTime = performance.now()

  removePreRenderListener = targetViewer.scene.preRender.addEventListener(() => {
    if (customShader.isDestroyed()) return

    const elapsedSeconds = (performance.now() - startTime) / 1000.0
    customShader.setUniform('u_time', elapsedSeconds)
  })
}

async function addCityTileset(targetViewer: Viewer) {
  const loadedTileset = await Cesium3DTileset.fromUrl(REEARTH_BUILDINGS_URL, {
    maximumScreenSpaceError: 8,
  })
  // 创建并挂上自定义着色器
  const customShader = createCityCustomShader()
  loadedTileset.customShader = customShader

  if (isUnmounted || targetViewer.isDestroyed()) {
    loadedTileset.destroy()
    customShader.destroy()
    return
  }

  cityCustomShader = customShader
  cityTileset = targetViewer.scene.primitives.add(loadedTileset)
  startUniformUpdates(targetViewer, customShader)
}

async function initializeScene() {
  if (!container.value) return

  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

  const targetViewer = new Viewer(container.value, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
  })
  viewer = targetViewer

  reearthCredit = new Credit(
    '<a href="https://buildings.reearth.land/" target="_blank">Re:Earth Buildings</a>',
    true,
  )
  targetViewer.creditDisplay.addStaticCredit(reearthCredit)

  focusOnLujiazui(targetViewer)
  await addCityTileset(targetViewer)
}

onMounted(() => {
  isUnmounted = false
  void initializeScene().catch((error: unknown) => {
    console.error('shader-demo-01 城市告警场景初始化失败：', error)
  })
})

onUnmounted(() => {
  isUnmounted = true
  removePreRenderListener?.()
  removePreRenderListener = undefined

  if (viewer && !viewer.isDestroyed()) {
    if (reearthCredit) {
      viewer.creditDisplay.removeStaticCredit(reearthCredit)
    }
    if (cityTileset && !cityTileset.isDestroyed()) {
      viewer.scene.primitives.remove(cityTileset)
    }
    if (cityCustomShader && !cityCustomShader.isDestroyed()) {
      cityCustomShader.destroy()
    }
    viewer.destroy()
  }

  reearthCredit = undefined
  cityCustomShader = undefined
  cityTileset = undefined
  viewer = undefined
})
</script>

<template>
  <div class="shader-scene">
    <section ref="container" class="cesium-container" aria-label="城市建筑动态告警实验" />

    <aside class="parameter-panel" aria-label="告警参数">
      <label>
        <span>告警高度阈值 {{ heightThreshold }} m</span>
        <input v-model.number="heightThreshold" type="range" min="0" max="500" step="1"/>
      </label>

      <label>
        <span>扫描高度阈值 {{ scanHeightThreshold }} m</span>
        <input v-model.number="scanHeightThreshold" type="range" min="0" max="500" step="1"/>
      </label>

      <label>
        <span>脉冲速度 {{ pulseSpeed.toFixed(1) }}</span>
        <input v-model.number="pulseSpeed" type="range" min="0" max="10" step="0.1"/>
      </label>
    </aside>
  </div>
</template>

<style scoped>
.shader-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.parameter-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  display: grid;
  gap: 14px;
  width: 240px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgb(17 24 39 / 88%);
  color: #ffffff;
  font-size: 13px;
}

.parameter-panel label {
  display: grid;
  gap: 7px;
}

.parameter-panel input {
  width: 100%;
  margin: 0;
}
</style>
