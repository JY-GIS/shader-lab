<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
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
const outerRadius = 150_000
const eyeRadius = 20_000
const peakRadius = 45_000
const peakSpeed = 50
const inwardRatio = 0.10
const sampleSeconds = 45

let cleanup: (() => void) | undefined

function sampleSpiral(frame: Matrix4, startRadius: number, startAngle: number) {
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

  let stopPreRender: (() => void) | undefined
  cleanup = () => {
    stopPreRender?.()
    viewer.destroy()
  }

  viewer.scene.globe.baseColor = Color.fromCssColorString('#163753')
  const center = Cartesian3.fromDegrees(144, 22, 250)
  const frame = Transforms.eastNorthUpToFixedFrame(center)
  const spirals = Array.from({ length: spiralCount }, (_, index) => new GeometryInstance({
    geometry: new PolylineGeometry({
      positions: sampleSpiral(frame, outerRadius - index * 2500, index * 2 * Math.PI / spiralCount),
      width: 4,
      arcType: ArcType.NONE,
      vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
    }),
  }))

  const material = new Material({
    fabric: {
      source: typhoonFlowSource,
      uniforms: {
        u_time: 0,
        u_speed: 0.05,
        u_repeat: 15,
        u_color: Color.fromCssColorString('#73d8ff'),
      },
    },
    translucent: true,
  })
  viewer.scene.primitives.add(new Primitive({
    geometryInstances: spirals,
    appearance: new PolylineMaterialAppearance({ material, translucent: true }),
    asynchronous: false,
  }))

  viewer.camera.viewBoundingSphere(
    new BoundingSphere(center, outerRadius * 1.1),
    new HeadingPitchRange(0, -Math.PI / 2, 0),
  )

  const startTime = performance.now()
  stopPreRender = viewer.scene.preRender.addEventListener(() => {
    material.uniforms.u_time = (performance.now() - startTime) / 1000
  })
})

onUnmounted(() => cleanup?.())
</script>

<template>
  <div ref="container" class="cesium-container" aria-label="固定风眼的台风流线实验" />
</template>
