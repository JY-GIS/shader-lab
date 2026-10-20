<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  CustomShader,
  CustomShaderMode,
  LightingModel,
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
  UniformType,
  VaryingType,
  Viewer,

  Ion,
  Credit,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
// 使用 Vite 的 ?raw 将后处理 GLSL 作为字符串交给 PostProcessStage。
import movingOutlineShaderSource from '../shader-demos/demo02/movingOutline.glsl?raw'
// 夜景窗户使用模型 CustomShader，与屏幕空间轮廓 PostProcessStage 分工独立。
import facadeWindowsShaderSource from '../shader-demos/demo02/facadeWindows.glsl?raw'
import facadeWindowsVertexShaderSource from '../shader-demos/demo02/facadeWindowsVertex.glsl?raw'

const REEARTH_BUILDINGS_URL = 'https://buildings.reearth.land/tileset.json'
type HighlightMode = 'off' | 'native' | 'custom'

const container = ref<HTMLDivElement | null>(null)
const selectedBuilding = ref('点击建筑选择，点击空白处取消')
const highlightMode = ref<HighlightMode>('custom')
const outlineSpeed = ref(0.25)
const outlineBandWidth = ref(0.12)
const nightEnabled = ref(true)
const windowDensity = ref(0.65)
const windowBrightness = ref(1.2)
const windowWidth = ref(4.0)
const floorHeight = ref(3.0)

let viewer: Viewer | undefined
let cityTileset: Cesium3DTileset | undefined
let pickHandler: ScreenSpaceEventHandler | undefined
let edgeStage: PostProcessStage | undefined
let silhouetteStage: PostProcessStageComposite | undefined
let customOutlineStage: PostProcessStage | undefined
let selectedFeature: Cesium3DTileFeature | ModelFeature | undefined
let removeOutlinePreRenderListener: (() => void) | undefined
let facadeCustomShader: CustomShader | undefined
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

// Vue 参数变化时只更新 CustomShader Uniform，不重新创建 Tileset 或 Shader。
watch(nightEnabled, (value) => {
  if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
    facadeCustomShader.setUniform('u_nightEnabled', value)
  }
})

watch(windowDensity, (value) => {
  if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
    facadeCustomShader.setUniform('u_windowDensity', value)
  }
})

watch(windowBrightness, (value) => {
  if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
    facadeCustomShader.setUniform('u_windowBrightness', value)
  }
})

watch(windowWidth, (value) => {
  if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
    facadeCustomShader.setUniform('u_windowWidth', value)
  }
})

watch(floorHeight, (value) => {
  if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
    facadeCustomShader.setUniform('u_floorHeight', value)
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
    const elapsedSeconds = (performance.now() - startTime) / 1000.0
    stage.uniforms.u_time = elapsedSeconds

    if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
      facadeCustomShader.setUniform('u_time', elapsedSeconds)
    }
  })
}

function createFacadeCustomShader() {
  return new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    // Cesium 1.146 的 fragmentMain 不能直接读取 normalMC，先声明跨阶段 Varying。
    varyings: {
      v_normalMC: VaryingType.VEC3,
    },
    uniforms: {
      u_time: {
        type: UniformType.FLOAT,
        value: 0.0,
      },
      u_nightEnabled: {
        type: UniformType.BOOL,
        value: nightEnabled.value,
      },
      u_windowDensity: {
        type: UniformType.FLOAT,
        value: windowDensity.value,
      },
      u_windowBrightness: {
        type: UniformType.FLOAT,
        value: windowBrightness.value,
      },
      u_windowWidth: {
        type: UniformType.FLOAT,
        value: windowWidth.value,
      },
      u_floorHeight: {
        type: UniformType.FLOAT,
        value: floorHeight.value,
      },
    },
    vertexShaderText: facadeWindowsVertexShaderSource,
    fragmentShaderText: facadeWindowsShaderSource,
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
  const customShader = createFacadeCustomShader()
  loadedTileset.customShader = customShader

  if (isUnmounted || targetViewer.isDestroyed()) {
    loadedTileset.destroy()
    if (!customShader.isDestroyed()) {
      customShader.destroy()
    }
    return
  }

  facadeCustomShader = customShader
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
    if (facadeCustomShader && !facadeCustomShader.isDestroyed()) {
      facadeCustomShader.destroy()
    }
    if (reearthCredit) {
      viewer.creditDisplay.removeStaticCredit(reearthCredit)
    }
    viewer.destroy()
  }

  reearthCredit = undefined
  selectedFeature = undefined
  customOutlineStage = undefined
  facadeCustomShader = undefined
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

      <div class="night-controls">
        <label class="checkbox-row">
          <input v-model="nightEnabled" type="checkbox" />
          <span>程序化夜景</span>
        </label>

        <label>
          <span>亮灯比例 {{ windowDensity.toFixed(2) }}</span>
          <input v-model.number="windowDensity" type="range" min="0" max="1" step="0.05" />
        </label>

        <label>
          <span>窗户亮度 {{ windowBrightness.toFixed(1) }}</span>
          <input v-model.number="windowBrightness" type="range" min="0.2" max="3" step="0.1" />
        </label>

        <label>
          <span>窗格宽度 {{ windowWidth.toFixed(1) }} m</span>
          <input v-model.number="windowWidth" type="range" min="2" max="10" step="0.5" />
        </label>

        <label>
          <span>楼层高度 {{ floorHeight.toFixed(1) }} m</span>
          <input v-model.number="floorHeight" type="range" min="2" max="6" step="0.5" />
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

.night-controls {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgb(255 255 255 / 20%);
}

.night-controls input[type='range'] {
  width: 100%;
  margin: 0;
}

.selection-panel .checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.checkbox-row input {
  margin: 0;
}
</style>
