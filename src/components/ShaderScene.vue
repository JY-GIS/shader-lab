<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import {
  Cartesian3,
  Color,
  GeometryInstance,  // 几何体实例，包装几何体并附加 id 等属性
  Math as CesiumMath,
  Material,          // 材质，定义表面如何着色（颜色、图片、条纹等）
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import parameterizedFlowMaterialSource from '../shaders/shader09/parameterizedFlow.glsl?raw'

const container = ref<HTMLDivElement | null>(null)
const period = ref(3.0)
const highlightHalfWidth = ref(0.01)
let viewer: Viewer | undefined
let experimentMaterial: Material | undefined
let removePreRenderListener: (() => void) | undefined

// 滑块变化时只更新 Uniform，不重新创建 Geometry 或 Primitive。
watch(period, (value) => {
  if (!experimentMaterial) return
  experimentMaterial.uniforms.u_period = value
})

// 高亮宽度变化时，只更新控制高亮核心范围的 Uniform。
watch(highlightHalfWidth, (value) => {
  if (!experimentMaterial) return
  experimentMaterial.uniforms.u_highlightHalfWidth = value
})

function createExperimentMaterial() {
  // ?raw 将 .glsl 文件作为普通字符串导入，而不是当作 JavaScript 执行
  const shaderSource = parameterizedFlowMaterialSource.trim()

  // 文件为空时继续使用内置材质，保证准备阶段仍可正常运行
  if (!shaderSource) {
    return Material.fromType('Color', {
      color: Color.fromCssColorString('#22c55e').withAlpha(0.85),
    })
  }

  return new Material({
    fabric: {
      source: shaderSource, // Fabric 使用的 Cesium Material GLSL 源码
      // Fabric 根据初始值 0.0 将 u_time 注册为 float uniform
      uniforms: {
        u_time: 0.0,
        // 流光完成一次循环所需的秒数，稍后由 GLSL 读取。
        u_period: period.value,
        // 纹理坐标中的高亮核心半宽，不是实际地理距离。
        u_highlightHalfWidth: highlightHalfWidth.value,
      },
    },
    translucent: true, // 允许后续通过 material.alpha 控制透明度
  })
}

function addExperimentLine(targetViewer: Viewer) {
  const positions = Cartesian3.fromDegreesArrayHeights([
    110.0, 30.0, 20000.0,
    111.0, 31.2, 50000.0,
    112.5, 30.6, 80000.0,
    114.0, 32.0, 40000.0,
  ])

  const geometry = new PolylineGeometry({
    positions,
    width: 18.0,
    vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
  })

  // 保存 Material 引用，后续继续复用已有的 u_time 更新机制。
  experimentMaterial = createExperimentMaterial()

  const appearance = new PolylineMaterialAppearance({
    material: experimentMaterial,
    translucent: true, // 开启 Alpha 混合
  })

  targetViewer.scene.primitives.add(
    new Primitive({
      geometryInstances: new GeometryInstance({
        geometry,
        id: 'shader-09-experiment-line',
      }),
      appearance,
      asynchronous: false, // 是否异步创建，false 表示立即创建
    }),
  )

  targetViewer.camera.setView({
    destination: Cartesian3.fromDegrees(112.0, 31.0, 900000.0),
    orientation: {
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    },
  })
}

onMounted(() => {
  if (!container.value) return

  // 创建 Cesium Viewer
  viewer = new Viewer(container.value, {
    animation: false,
    baseLayer: false,
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

  viewer.scene.backgroundColor = Color.BLUE   // 设置场景背景色为蓝色
  viewer.scene.globe.baseColor = Color.WHITE // 设置地球基础色为白色

  addExperimentLine(viewer)

  // performance.now() 返回毫秒；记录起点后换算为真实经过秒数。
  const startTime = performance.now()
  removePreRenderListener = viewer.scene.preRender.addEventListener(() => {
    if (!experimentMaterial) return

    const elapsedSeconds = (performance.now() - startTime) / 1000.0
    experimentMaterial.uniforms.u_time = elapsedSeconds
  })
})

onUnmounted(() => {
  // 先解除每帧回调，避免它继续访问即将销毁的场景和材质。
  removePreRenderListener?.()
  removePreRenderListener = undefined

  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy()
  }
  viewer = undefined
  experimentMaterial = undefined
})
</script>

<template>
  <div class="shader-scene">
    <section ref="container" class="cesium-container" aria-label="Cesium 三维地球场景" />

    <div class="parameter-panel">
      <label class="parameter-control">
        <span>流光周期：{{ period.toFixed(1) }} 秒</span>
        <input
          v-model.number="period"
          type="range"
          min="0.5"
          max="8"
          step="0.5"
          aria-label="流光循环周期"
        >
      </label>

      <label class="parameter-control">
        <span>高亮半宽：{{ highlightHalfWidth.toFixed(3) }}</span>
        <input
          v-model.number="highlightHalfWidth"
          type="range"
          min="0.005"
          max="0.08"
          step="0.005"
          aria-label="流光高亮半宽"
        >
      </label>
    </div>
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
  width: 220px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: rgb(255 255 255 / 92%);
  color: #1f2937;
  font-size: 13px;
}

.parameter-control {
  display: grid;
  gap: 8px;
}

.parameter-control input {
  width: 100%;
}
</style>
