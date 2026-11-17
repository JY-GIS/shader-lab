<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  buildModuleUrl,
  ImageryLayer,
  TileMapServiceImageryProvider,
  Viewer,
  Rectangle,
  SingleTileImageryProvider,
  TextureMagnificationFilter,
} from 'cesium'
import { WindLayer, type WindData, type WindLayerOptions } from 'cesium-wind-layer'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import type { OceanJson } from './oceanData'
import { createOceanSpeedImage } from './oceanSpeedRaster'
import OceanCurrentControls from './OceanCurrentControls.vue'

const container = ref<HTMLDivElement | null>(null)
const panelOptions = shallowRef<WindLayerOptions>()
let viewer: Viewer | undefined
let layer: WindLayer | undefined

import oceanUrl from './china-circulation-frame-001.json?url'
// import oceanUrl from './bohai-tide-frame-001.json?url'
// import oceanUrl from './ocean.json?url'
const request = new AbortController()

function updateLayerOptions(changes: Partial<WindLayerOptions>) {
  if (!layer || !panelOptions.value) return
  layer.updateOptions(changes)
  panelOptions.value = { ...panelOptions.value, ...changes }
}

onMounted(async () => {
  const element = container.value
  if (!element) return

  viewer = new Viewer(element, {
    // baseLayer: ImageryLayer.fromProviderAsync(
    //   TileMapServiceImageryProvider.fromUrl(
    //     buildModuleUrl('Assets/Textures/NaturalEarthII'),
    //   ),
    // ),
    baseLayerPicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
  })
  try {
    const response = await fetch(oceanUrl, { signal: request.signal })
    if (!response.ok) {
        throw new Error(`读取 ocean.json 失败：HTTP ${response.status}`)
    }

    const data: OceanJson = await response.json()
    if (request.signal.aborted) return

    const [west, south, east, north] = data.bbox

    const windData: WindData = {
        width: data.width,
        height: data.height,
        bounds: { west, south, east, north },
        u: { ...data.u, array: new Float32Array(data.u.array) },
        v: { ...data.v, array: new Float32Array(data.v.array) },
    }

    layer = new WindLayer(viewer, windData, {
      flipY: true,
      particleHeight: 10,
      speedFactor: 3,
      lineWidth: { min: 2, max: 3 },
      lineLength: { min: 50, max: 150 },
      domain: { min: 0, max: 1.85 },
      colors: ['#cccccc'],
    })
    panelOptions.value = {
      ...layer.options,
      displayRange: {
        min: layer.windData.speed.min ?? 0,
        max: layer.windData.speed.max ?? 1.85,
      },
    }

    layer.zoomTo(0)

    const halfLon = (east - west) / (data.width - 1) / 2
    const halfLat = (north - south) / (data.height - 1) / 2
    const rectangle = Rectangle.fromDegrees(
      west - halfLon,
      south - halfLat,
      east + halfLon,
      north + halfLat,
    )

    const provider = await SingleTileImageryProvider.fromUrl(
      createOceanSpeedImage(data),
      { rectangle },
    )
    if (request.signal.aborted) return

    viewer.imageryLayers.add(new ImageryLayer(provider, {
      alpha: 0.55,
      // magnificationFilter: TextureMagnificationFilter.NEAREST,
    }))

  } catch (error) {
    if (!request.signal.aborted) {
        console.error('读取洋流数据失败', error)
    }
  }
})

onBeforeUnmount(() => {
  request.abort()
  layer?.destroy()
  viewer?.destroy()
})
</script>

<template>
  <div class="ocean-scene">
    <div ref="container" class="cesium-container"></div>
    <OceanCurrentControls
      v-if="panelOptions"
      :options="panelOptions"
      @update-options="updateLayerOptions"
    />
  </div>
</template>

<style scoped>
.ocean-scene {
  position: relative;
  min-width: 0;
  min-height: 0;
}
</style>
