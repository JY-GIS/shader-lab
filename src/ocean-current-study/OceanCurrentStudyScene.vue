<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  buildModuleUrl,
  ImageryLayer,
  TileMapServiceImageryProvider,
  Viewer,
} from 'cesium'
import { WindLayer, type WindData } from 'cesium-wind-layer'
import 'cesium/Build/Cesium/Widgets/widgets.css'

type OceanJson = Pick<WindData, 'width' | 'height'> & {
  bbox: [west: number, south: number, east: number, north: number]
  u: { array: number[]; min: number; max: number }
  v: { array: number[]; min: number; max: number }
}

const container = ref<HTMLDivElement | null>(null)
let viewer: Viewer | undefined
let layer: WindLayer | undefined

import oceanUrl from './ocean.json?url'
const request = new AbortController()

onMounted(async () => {
  const element = container.value
  if (!element) return

  viewer = new Viewer(element, {
    baseLayer: ImageryLayer.fromProviderAsync(
      TileMapServiceImageryProvider.fromUrl(
        buildModuleUrl('Assets/Textures/NaturalEarthII'),
      ),
    ),
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
  speedFactor: 8,
  colors: ['#45e6ff'],
})

    layer.zoomTo(0)
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
  <div ref="container" class="cesium-container"></div>
</template>