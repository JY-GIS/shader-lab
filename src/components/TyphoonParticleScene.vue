<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  BoundingSphere,
  buildModuleUrl,
  Cartesian3,
  Color,
  HeadingPitchRange,
  ImageryLayer,
  Material,
  PointPrimitiveCollection,
  PolylineCollection,
  TileMapServiceImageryProvider,
  Transforms,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const container = ref<HTMLDivElement | null>(null)

const particleCount = 150
const outerRadius = 150_000
const eyeRadius = 20_000
const peakRadius = 45_000
const peakSpeed = 50
const inwardRatio = 0.10
const fullTurn = 2 * Math.PI
const simulationRate = 2000
const trailSamples = 5
const trailInterval = 1 / 40

let cleanup: (() => void) | undefined

function polarPosition(radius: number, angle: number, result?: Cartesian3) {
  return Cartesian3.fromElements(radius * Math.cos(angle), radius * Math.sin(angle), 0, result)
}

function guidePositions() {
  return Array.from({ length: 121 }, (_, index) => {
    const sweep = fullTurn * index / 120
    const radius = 0.85 * outerRadius * Math.exp(-inwardRatio * sweep)
    return polarPosition(radius, -0.42 + sweep)
  })
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
    useDefaultRenderLoop: false,
  })

  let frameId = 0
  cleanup = () => {
    cancelAnimationFrame(frameId)
    viewer.destroy()
  }

  viewer.scene.globe.baseColor = Color.fromCssColorString('#163753')
  const center = Cartesian3.fromDegrees(144, 22, 250)
  const modelMatrix = Transforms.eastNorthUpToFixedFrame(center)
  viewer.camera.viewBoundingSphere(
    new BoundingSphere(center, outerRadius * 1.1),
    new HeadingPitchRange(0, -Math.PI / 2, 0),
  )

  const guides = viewer.scene.primitives.add(new PolylineCollection({ modelMatrix }))
  guides.add({
    positions: guidePositions(),
    width: 2,
    material: Material.fromType(Material.PolylineDashType, {
      color: Color.fromCssColorString('#d3eafb').withAlpha(0.45),
      dashLength: 12,
    }),
  })
  const points = viewer.scene.primitives.add(new PointPrimitiveCollection({ modelMatrix }))
  const color = Color.fromCssColorString('#73d8ff')
  const trailColors = Array.from({ length: trailSamples }, (_, index) => color.withAlpha(0.65 - index * 0.13))
  const particles = Array.from({ length: particleCount }, () => {
    const radius = Math.sqrt(eyeRadius ** 2 + Math.random() * (outerRadius ** 2 - eyeRadius ** 2))
    const angle = Math.random() * fullTurn
    const point = points.add({ position: polarPosition(radius, angle), pixelSize: 5.5, color })
    const trail = trailColors.map((trailColor, index) => points.add({
      show: false,
      pixelSize: 4.7 - index * 0.6,
      color: trailColor,
    }))
    return { radius, angle, point, trail }
  })

  const position = new Cartesian3()
  let previousTime: number | undefined
  let trailTime = 0

  function animate(now: number) {
    const seconds = Math.min((now - (previousTime ?? now)) / 1000, 0.05)
    previousTime = now
    const dt = seconds * simulationRate
    trailTime += seconds
    const recordTrail = trailTime >= trailInterval
    if (recordTrail) trailTime %= trailInterval

    for (const particle of particles) {
      const q = particle.radius / peakRadius
      const speed = peakSpeed * q * Math.exp(1 - q)
      particle.angle = (particle.angle + speed / particle.radius * dt) % fullTurn
      particle.radius -= inwardRatio * speed * dt

      if (particle.radius <= eyeRadius) {
        particle.radius = outerRadius
        particle.angle = Math.random() * fullTurn
        for (const sample of particle.trail) sample.show = false
      } else if (recordTrail) {
        // 从后往前移动旧位置，保留头部到尾部的透明度顺序。
        for (let index = particle.trail.length - 1; index >= 0; index--) {
          const sample = particle.trail[index]!
          const previous = index === 0 ? particle.point : particle.trail[index - 1]!
          sample.show = previous.show
          if (previous.show) sample.position = previous.position
        }
      }

      particle.point.position = polarPosition(particle.radius, particle.angle, position)
    }

    viewer.resize()
    viewer.render()
    frameId = requestAnimationFrame(animate)
  }

  frameId = requestAnimationFrame(animate)
})

onUnmounted(() => cleanup?.())
</script>

<template>
  <div ref="container" class="cesium-container" aria-label="固定风眼的台风粒子实验" />
</template>
