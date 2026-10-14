<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

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
import flowLineMaterialSource from '../shaders/shader08/flowLine.glsl?raw'

const container = ref<HTMLDivElement | null>(null)
let viewer: Viewer | undefined
let experimentMaterial: Material | undefined
let removePreRenderListener: (() => void) | undefined

function createExperimentMaterial() {
  // ?raw 将 .glsl 文件作为普通字符串导入，而不是当作 JavaScript 执行
  const shaderSource = flowLineMaterialSource.trim()

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
        id: 'shader-08-experiment-line',
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
  <section ref="container" class="cesium-container" aria-label="Cesium 三维地球场景" />
</template>
