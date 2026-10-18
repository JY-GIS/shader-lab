<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  Matrix4,
  Math as CesiumMath,

  // ===== 3D Tiles 与拾取 =====
  Cesium3DTileset,         // 3D Tiles 数据集：白模/倾斜摄影/点云
  Cesium3DTileFeature,     // 3D Tiles 中的单个要素（如单栋建筑）
  ModelFeature,            // Model 内部的要素（更底层，featureId/highlightColor）

  // ===== 后处理效果 =====
  PostProcessStage,        // 单个后处理阶段（片元着色器）
  PostProcessStageComposite, // 多个后处理阶段按顺序组合
  PostProcessStageLibrary, // 后处理工厂：边缘检测、轮廓描边、泛光、景深、FXAA

  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  HeadingPitchRange,
  Viewer,

  Ion,
  Credit,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
// 使用 Vite 的 ?raw 将后处理 GLSL 作为字符串交给 PostProcessStage。
import movingOutlineShaderSource from '../shader-demos/demo02/movingOutline.glsl?raw'

const REEARTH_BUILDINGS_URL = 'https://buildings.reearth.land/tileset.json'
type HighlightMode = 'off' | 'native' | 'custom'

const container = ref<HTMLDivElement | null>(null)
const selectedBuilding = ref('点击建筑选择，点击空白处取消')
const highlightMode = ref<HighlightMode>('custom')
const outlineSpeed = ref(0.25)
const outlineBandWidth = ref(0.12)

let viewer: Viewer | undefined
let cityTileset: Cesium3DTileset | undefined
let pickHandler: ScreenSpaceEventHandler | undefined
let edgeStage: PostProcessStage | undefined
let silhouetteStage: PostProcessStageComposite | undefined
let customOutlineStage: PostProcessStage | undefined
let selectedFeature: Cesium3DTileFeature | ModelFeature | undefined
let removeOutlinePreRenderListener: (() => void) | undefined
let reearthCredit: Credit | undefined
let isUnmounted = false

// 模式改变时只启停已有 Stage，不重新创建 Stage 或 Tileset。
watch(highlightMode, () => {
  updateHighlightStages()
})

watch(outlineSpeed, (value) => {
  if (customOutlineStage) {
    customOutlineStage.uniforms.u_outlineSpeed = value
  }
})

watch(outlineBandWidth, (value) => {
  if (customOutlineStage) {
    customOutlineStage.uniforms.u_outlineBandWidth = value
  }
})

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

function isBuildingFeature(picked: unknown): picked is Cesium3DTileFeature | ModelFeature {
  return picked instanceof Cesium3DTileFeature || picked instanceof ModelFeature
}

function getBuildingLabel(feature: Cesium3DTileFeature | ModelFeature) {
  const featureId = feature.getProperty('feature_id')
  return featureId === undefined ? '已选择建筑' : `建筑 ${String(featureId)}`
}

function updateHighlightStages() {
  const hasSelection = selectedFeature !== undefined
  const selected = hasSelection ? [selectedFeature] : []

  if (edgeStage) {
    edgeStage.selected = selected
  }
  if (silhouetteStage) {
    silhouetteStage.enabled = hasSelection && highlightMode.value === 'native'
  }
  if (customOutlineStage) {
    customOutlineStage.selected = selected
    customOutlineStage.enabled = hasSelection && highlightMode.value === 'custom'
  }
}

function clearSelection() {
  selectedBuilding.value = '点击建筑选择，点击空白处取消'
  selectedFeature = undefined
  updateHighlightStages()
}

function createNativeSilhouette(targetViewer: Viewer) {
  if (!PostProcessStageLibrary.isSilhouetteSupported(targetViewer.scene)) {
    console.warn('当前浏览器不支持基于深度纹理的 Cesium 轮廓后处理。')
    return
  }

  const nativeEdgeStage = PostProcessStageLibrary.createEdgeDetectionStage()

  nativeEdgeStage.uniforms.color = Color.CYAN
  nativeEdgeStage.uniforms.length = 1.0

  nativeEdgeStage.selected = []

  const nativeSilhouetteStage = PostProcessStageLibrary.createSilhouetteStage([
    nativeEdgeStage,
  ])

  nativeSilhouetteStage.enabled = false

  edgeStage = nativeEdgeStage
  silhouetteStage = nativeSilhouetteStage

  targetViewer.scene.postProcessStages.add(nativeSilhouetteStage)
}

function createCustomOutline(targetViewer: Viewer) {
  const startTime = performance.now()
  const stage = new PostProcessStage({
    name: 'shader-moving-outline',
    fragmentShader: movingOutlineShaderSource,
    uniforms: {
      u_time: 0.0,
      u_outlineSpeed: outlineSpeed.value,
      u_outlineBandWidth: outlineBandWidth.value,
      u_outlineColor: Color.CYAN,
    },
  })

  stage.enabled = false
  stage.selected = []
  targetViewer.scene.postProcessStages.add(stage)
  customOutlineStage = stage

  removeOutlinePreRenderListener = targetViewer.scene.preRender.addEventListener(() => {
    stage.uniforms.u_time = (performance.now() - startTime) / 1000.0
  })
}

function createBuildingPickHandler(targetViewer: Viewer) {
  const handler = new ScreenSpaceEventHandler(targetViewer.scene.canvas)

  handler.setInputAction((movement: { position: Cartesian2 }) => {
    const picked = targetViewer.scene.pick(movement.position)

    if (!isBuildingFeature(picked)) {
      clearSelection()
      return
    }

    selectedBuilding.value = getBuildingLabel(picked)
    selectedFeature = picked
    updateHighlightStages()

    console.info(`选中 ${picked.constructor.name}：`, picked.getProperty('feature_id'))
  }, ScreenSpaceEventType.LEFT_CLICK)

  pickHandler = handler
}

async function addCityTileset(targetViewer: Viewer) {
  const loadedTileset = await Cesium3DTileset.fromUrl(REEARTH_BUILDINGS_URL, {
    maximumScreenSpaceError: 8,
  })

  if (isUnmounted || targetViewer.isDestroyed()) {
    loadedTileset.destroy()
    return
  }

  cityTileset = targetViewer.scene.primitives.add(loadedTileset)
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
  createNativeSilhouette(targetViewer)
  createCustomOutline(targetViewer)
  createBuildingPickHandler(targetViewer)
  await addCityTileset(targetViewer)
}

onMounted(() => {
  isUnmounted = false
  void initializeScene().catch((error: unknown) => {
    console.error('城市夜景场景初始化失败：', error)
  })
})

onUnmounted(() => {
  isUnmounted = true

  removeOutlinePreRenderListener?.()
  removeOutlinePreRenderListener = undefined

  if (pickHandler && !pickHandler.isDestroyed()) {
    pickHandler.destroy()
  }

  if (viewer && !viewer.isDestroyed()) {
    if (customOutlineStage) {
      viewer.scene.postProcessStages.remove(customOutlineStage)
    }
    if (silhouetteStage) {
      viewer.scene.postProcessStages.remove(silhouetteStage)
    }
    if (cityTileset && !cityTileset.isDestroyed()) {
      viewer.scene.primitives.remove(cityTileset)
    }
    if (reearthCredit) {
      viewer.creditDisplay.removeStaticCredit(reearthCredit)
    }
    viewer.destroy()
  }

  reearthCredit = undefined
  selectedFeature = undefined
  customOutlineStage = undefined
  silhouetteStage = undefined
  edgeStage = undefined
  pickHandler = undefined
  cityTileset = undefined
  viewer = undefined
})
</script>

<template>
  <div class="shader-scene">
    <section ref="container" class="cesium-container" aria-label="城市夜景与建筑高亮实验" />

    <aside class="selection-panel" aria-label="建筑选择状态">
      <strong>Cesium 白膜信息</strong>
      <span>{{ selectedBuilding }}</span>

      <label>
        <span>高亮模式</span>
        <select v-model="highlightMode">
          <option value="off">关闭</option>
          <option value="native">Cesium 原生轮廓</option>
          <option value="custom">Shader 定制轮廓</option>
        </select>
      </label>

      <div v-if="highlightMode === 'custom'" class="custom-outline-controls">
        <label>
          <span>扫描速度 {{ outlineSpeed.toFixed(2) }}</span>
          <input v-model.number="outlineSpeed" type="range" min="0" max="1" step="0.05" />
        </label>

        <label>
          <span>高亮段宽度 {{ outlineBandWidth.toFixed(2) }}</span>
          <input
            v-model.number="outlineBandWidth"
            type="range"
            min="0.02"
            max="0.4"
            step="0.01"
          />
        </label>
      </div>
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

.selection-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgb(17 24 39 / 88%);
  color: #ffffff;
  font-size: 13px;
}

.selection-panel small {
  color: #cbd5e1;
}

.selection-panel label {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.selection-panel select {
  min-width: 180px;
}

.custom-outline-controls {
  display: grid;
  gap: 8px;
}

.custom-outline-controls input {
  width: 100%;
  margin: 0;
}
</style>
