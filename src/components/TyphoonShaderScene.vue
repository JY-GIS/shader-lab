<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArcType,
  BoundingSphere,
  buildModuleUrl,
  Cartesian3,
  Color,
  GeometryInstance,
  HeadingPitchRange,
  ImageryLayer,
  Material,
  Matrix4,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  TileMapServiceImageryProvider,
  Transforms,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import typhoonFlowSource from '../shader-demos/demo04/typhoonFlow.glsl?raw'

const container = ref<HTMLDivElement | null>(null)
const spiralCount = 5
const maxOuterRadiusKm = 220
const outerRadiusKm = ref(150)
const eyeRadiusKm = ref(20)
const particleCount = ref(75)
const particleSpeed = ref(1)
const baseFlowSpeed = 0.05
const peakRadius = 45_000
const peakSpeed = 50
const inwardRatio = 0.10
const sampleSeconds = 45

let cleanup: (() => void) | undefined

function sampleSpiral(frame: Matrix4, startRadius: number, startAngle: number, eyeRadius: number) {
  const positions: Cartesian3[] = []
  let radius = startRadius
  let angle = startAngle

  // 等时间步取样，让相邻顶点的距离体现风速的变化。
  while (radius > eyeRadius) {
    const position = new Cartesian3(radius * Math.cos(angle), radius * Math.sin(angle), 0)
    positions.push(Matrix4.multiplyByPoint(frame, position, position))

    const ratio = radius / peakRadius
    const speed = peakSpeed * ratio * Math.exp(1 - ratio)
    const angleStep = speed / radius * sampleSeconds
    angle += angleStep
    radius *= Math.exp(-inwardRatio * angleStep)
  }

  return positions
}

onMounted(() => {
  if (!container.value) return

  const viewer = new Viewer(container.value, {
    baseLayer: ImageryLayer.fromProviderAsync(
      TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
    ),
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

  viewer.scene.globe.baseColor = Color.fromCssColorString('#163753')
  const center = Cartesian3.fromDegrees(144, 22, 250)
  const frame = Transforms.eastNorthUpToFixedFrame(center)

  const material = new Material({
    fabric: {
      source: typhoonFlowSource,
      uniforms: {
        u_progress: 0,
        u_repeat: particleCount.value / spiralCount,
        u_distanceScale: 1,
        u_color: Color.WHITE,
      },
    },
    translucent: true,
  })
  const appearance = new PolylineMaterialAppearance({ material, translucent: true })
  const primitives = viewer.scene.primitives

  function addFlow() {
    const outerRadius = outerRadiusKm.value * 1000
    const eyeRadius = eyeRadiusKm.value * 1000
    const spirals = Array.from({ length: spiralCount }, (_, index) => new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: sampleSpiral(frame, outerRadius - index * 2500, index * 2 * Math.PI / spiralCount, eyeRadius),
        width: 8,
        arcType: ArcType.NONE,
        vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
      }),
    }))

    return primitives.add(new Primitive({ geometryInstances: spirals, appearance, asynchronous: false }))
  }

  let flow = addFlow()
  const stopRadiusWatch = watch([eyeRadiusKm, outerRadiusKm], () => {
    const previousFlow = flow
    flow = addFlow()
    primitives.remove(previousFlow)
  })
  const stopCountWatch = watch(particleCount, (count) => {
    material.uniforms.u_repeat = count / spiralCount
  })

  // 给最大外圈留出空间，调整半径时保持视角，方便比较大小。
  viewer.camera.viewBoundingSphere(
    new BoundingSphere(center, maxOuterRadiusKm * 1100),
    new HeadingPitchRange(0, -Math.PI / 2, 0),
  )

  let previousTime = performance.now()
  let progress = 0
  const stopPreRender = viewer.scene.preRender.addEventListener(() => {
    const now = performance.now()
    const dt = (now - previousTime) / 1000
    previousTime = now

    // 累加每帧位移，调速时从当前进度继续。
    progress = (progress + dt * baseFlowSpeed * particleSpeed.value) % 1
    material.uniforms.u_progress = progress

    const distance = Cartesian3.distance(viewer.camera.positionWC, center)
    const zoom = Math.min(1, Math.max(0, (distance - 150_000) / 900_000))
    material.uniforms.u_distanceScale = 1 - 0.5 * zoom
  })

  cleanup = () => {
    stopRadiusWatch()
    stopCountWatch()
    stopPreRender()
    viewer.destroy()
  }
})

onUnmounted(() => cleanup?.())
</script>

<template>
  <div class="typhoon-shader-scene">
    <div ref="container" class="cesium-container" aria-label="固定风眼的台风流线实验" />

    <div class="typhoon-controls">
      <label>
        <span>风眼半径 <span>{{ eyeRadiusKm }} km</span></span>
        <input v-model.number="eyeRadiusKm" type="range" min="5" max="50" step="1">
      </label>
      <label>
        <span>外圈半径 <span>{{ outerRadiusKm }} km</span></span>
        <input v-model.number="outerRadiusKm" type="range" min="80" :max="maxOuterRadiusKm" step="5">
      </label>
      <label>
        <span>粒子数量 <span>{{ particleCount }}</span></span>
        <input v-model.number="particleCount" type="range" min="15" max="150" :step="spiralCount">
      </label>
      <label>
        <span>粒子速度 <span>{{ particleSpeed.toFixed(1) }}×</span></span>
        <input v-model.number="particleSpeed" type="range" min="0.1" max="3" step="0.1">
      </label>
    </div>
  </div>
</template>

<style scoped>
.typhoon-shader-scene {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.typhoon-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  display: grid;
  gap: 8px;
  width: min(190px, calc(100% - 24px));
  padding: 10px 12px;
  border: 1px solid #d7dee7;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
}

.typhoon-controls label {
  display: grid;
  gap: 4px;
}

.typhoon-controls label > span {
  display: flex;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}

.typhoon-controls input {
  width: 100%;
  margin: 0;
  accent-color: #238ae2;
}
</style>
