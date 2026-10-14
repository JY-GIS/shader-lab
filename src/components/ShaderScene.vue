<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import {
  Cartesian3,
  Color,
  GeometryInstance,  // 几何体实例，包装几何体并附加 id 等属性
  Math as CesiumMath,
  Material,          // 材质，定义表面如何着色（颜色、图片、条纹等）
  MaterialAppearance,// 外观，定义几何体如何渲染，通常配合 Material 使用
  Primitive,
  Rectangle,
  RectangleGeometry,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import animatedWaveMaterialSource from '../shaders/shader06/animatedWave.glsl?raw'

const container = ref<HTMLDivElement | null>(null)
let viewer: Viewer | undefined
let experimentMaterial: Material | undefined
let removePreRenderListener: (() => void) | undefined

function createExperimentMaterial() {
  // ?raw 将 .glsl 文件作为普通字符串导入，而不是当作 JavaScript 执行
  const shaderSource = animatedWaveMaterialSource.trim()

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

function addExperimentArea(targetViewer: Viewer) {
  const experimentArea = Rectangle.fromDegrees(110, 30, 114, 33)

  const geometry = new RectangleGeometry({
    rectangle: experimentArea,
    height: 5000,
    // 顶点格式：TEXTURED 表示包含位置、法线、纹理坐标 st，适合纹理材质
    vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
  })

  // 创建外观：控制几何体如何渲染
  experimentMaterial = createExperimentMaterial()

  const appearance = new MaterialAppearance({
    material: experimentMaterial,
    flat: true,         // 平直着色，不计算光照，颜色更均匀
    translucent: true,  // 开启半透明，材质带 alpha 时必须设置
  })

  targetViewer.scene.primitives.add(
    new Primitive({
      geometryInstances: new GeometryInstance({
        geometry,
        id: 'lesson-01-experiment-area',
      }),
      appearance,
      asynchronous: false, // 是否异步创建，false 表示立即创建
    }),
  )

  targetViewer.camera.setView({
    destination: Cartesian3.fromDegrees(112, 31.5, 8000000),
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
  viewer.scene.globe.baseColor = Color.ORANGE // 设置地球基础色为橙色（无影像底图时显示的颜色）

  addExperimentArea(viewer)

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
