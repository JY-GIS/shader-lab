<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import {
  ArcType,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  GeometryInstance,
  HeadingPitchRange,
  LabelStyle,
  Material,
  Math as CesiumMath,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import directionalArrowsMaterialSource from '../shader-demos/demo03/directionalArrows.glsl?raw'

const container = ref<HTMLDivElement | null>(null)

const TEST_ROUTE_COORDINATES = [
  114.04780, 22.54120, 35.0,
  114.04875, 22.54145, 35.0,
  114.05390, 22.54450, 35.0,
  114.05535, 22.54305, 35.0,
  114.06120, 22.54520, 35.0,
  114.06305, 22.54285, 35.0,
  114.06720, 22.54415, 35.0,
] as const

let cleanup: (() => void) | undefined

function addRouteLayer(
  viewer: Viewer , positions: Cartesian3[],
  config: { width: number; material: Material; id: string },
) {
  const geometry = new PolylineGeometry({
    positions,
    width: config.width,
    arcType: ArcType.NONE,
    vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
  })

  return viewer.scene.primitives.add(
    new Primitive({
      geometryInstances: new GeometryInstance({ 
        geometry,
        id: config.id,
      }),
      appearance: new PolylineMaterialAppearance({
        material: config.material,
        translucent: true,
      }),
      asynchronous: false,
    }),
  )
}

function addEndpointMarkers(viewer: Viewer, positions: Cartesian3[]) {
  const basePointStyle = {
    pixelSize: 13,
    outlineColor: Color.WHITE,
    outlineWidth: 3,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }

  const endpoints = [
    { suffix: 'start', position: positions[0], color: '#22c55e', text: '起点' },
    { suffix: 'end', position: positions.at(-1), color: '#ef4444', text: '终点' },
  ]

  for (const { suffix, position, color, text } of endpoints) {
    viewer.entities.add({
      id: `route-${suffix}`,
      position,
      point: {
        ...basePointStyle,
        color: Color.fromCssColorString(color),
      },
      label: {
        text,
        font: '15px Microsoft YaHei',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -24),
      },
    })
  }
}

function initializeScene(containerEl: HTMLElement): () => void {
  const viewer = new Viewer(containerEl, {
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

  viewer.scene.backgroundColor = Color.fromCssColorString('#eef2f6')
  viewer.scene.globe.baseColor = Color.fromCssColorString('#eef2f6')

  const positions = Cartesian3.fromDegreesArrayHeights([...TEST_ROUTE_COORDINATES])

  // 底层：静态深蓝底
  addRouteLayer(viewer, positions, {
    width: 14.0,
    material: Material.fromType('Color', {
      color: Color.fromCssColorString('#12314a').withAlpha(0.96),
    }),
    id: 'demo03-base-route',
  })

  // 上层：流动箭头
  const arrowMaterial = new Material({
    fabric: {
      source: directionalArrowsMaterialSource,
      uniforms: {
        u_time: 0.0,
        u_repeat: 12.0,
        u_speed: 0.22,
        u_arrowColor: Color.fromCssColorString('#35e6ff'),
      },
    },
    translucent: true,
  })
  addRouteLayer(viewer, positions, {
    width: 22.0,
    material: arrowMaterial,
    id: 'arrow-overlay',
  })

  addEndpointMarkers(viewer, positions)

  viewer.camera.viewBoundingSphere(
    BoundingSphere.fromPoints(positions),
    new HeadingPitchRange(0.0, CesiumMath.toRadians(-90.0), 2400.0),
  )

  // 每帧驱动 u_time
  const startTime = performance.now()
  const stopPreRender = viewer.scene.preRender.addEventListener(() => {
    arrowMaterial.uniforms.u_time = (performance.now() - startTime) / 1000.0
  })

  return () => {
    stopPreRender()
    if (!viewer.isDestroyed()) {
      viewer.destroy()
    }
  }
}

onMounted(() => {
  if (!container.value) return
  cleanup = initializeScene(container.value)
})

onUnmounted(() => {
  cleanup?.()
  cleanup = undefined
})
</script>

<template>
  <div class="route-arrow-scene">
    <section ref="container" class="cesium-container" aria-label="公交路线方向箭头实验场景" />

    <div class="route-note">
      <span><i class="start-dot" />起点　→　终点<i class="end-dot" /></span>
    </div>
  </div>
</template>

<style scoped>
.route-arrow-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.route-note {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 12px;
  border: 1px solid #d7dee7;
  border-radius: 6px;
  background: rgb(255 255 255 / 92%);
  color: #334155;
  box-shadow: 0 2px 8px rgb(15 23 42 / 10%);
  font-size: 12px;
}

.route-note span {
  display: flex;
  align-items: center;
  color: #64748b;
}

.route-note i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.start-dot {
  margin-right: 5px;
  background: #22c55e;
}

.end-dot {
  margin-left: 5px;
  background: #ef4444;
}
</style>
