<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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

import type { OceanJson, OceanFrame } from './oceanData'
import { createOceanSpeedImage } from './oceanSpeedRaster'
import { applyOceanTrailStyle } from './oceanTrailStyle'
import OceanCurrentControls from './OceanCurrentControls.vue'
import OceanTimeSlider from './OceanTimeSlider.vue'
import frameIndex from './ocean-frames/index.json'

const container = ref<HTMLDivElement | null>(null)
const panelOptions = shallowRef<WindLayerOptions>()
const screenSizedTrails = ref(false)
const zoomAdaptive = ref(true)
let viewer: Viewer | undefined
let layer: WindLayer | undefined
let speedLayer: ImageryLayer | undefined
const frames: OceanFrame[] = frameIndex.frames
const currentIndex = ref(-1)
const loading = ref(false)
const loadingIndex = ref(0)
const frameError = ref('')
const playing = ref(false)

const frameUrls = import.meta.glob<string>('./ocean-frames/frame-*.json', {
  query: '?url',
  import: 'default',
  eager: true,
})
let request: AbortController | undefined
// 只缓存 CPU 侧的数据和底图提供器，不保留每帧的 GPU 图层。
const frameCache = new Map<number, {
  windData: WindData
  provider: SingleTileImageryProvider
}>()

// 每帧显示五秒后才请求下一帧，暂停或离开页面时清除计时器。
watch([playing, loading, currentIndex, frameError], (_, __, onCleanup) => {
  if (!playing.value || loading.value) return
  if (frameError.value || currentIndex.value >= frames.length - 1) {
    playing.value = false
    return
  }
  const timer = window.setTimeout(() => {
    loadFrame(currentIndex.value + 1)
  }, 5000)
  onCleanup(() => window.clearTimeout(timer))
})

async function togglePlayback() {
  if (playing.value) {
    playing.value = false
    return
  }
  if (currentIndex.value === frames.length - 1) await loadFrame(0)
  if (!frameError.value) playing.value = true
}

function updateLayerOptions(changes: Partial<WindLayerOptions>) {
  if (!layer || !panelOptions.value) return
  layer.updateOptions(changes)
  panelOptions.value = { ...panelOptions.value, ...changes }
}

function zoomToOverview() {
  layer?.zoomTo(0)
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
    navigationInstructionsInitiallyVisible: false,
  })
  await loadFrame(0)
})

async function loadFrame(index: number) {
  if (!viewer || !frames[index]) return
  request?.abort()
  const pending = new AbortController()
  request = pending
  loading.value = true
  loadingIndex.value = index
  frameError.value = ''
  try {
    let cached = frameCache.get(index)
    if (!cached) {
      const url = frameUrls[`./ocean-frames/${frames[index].file}`]
      if (!url) throw new Error('找不到对应时刻的数据文件')
      const response = await fetch(url, { signal: pending.signal })
      if (!response.ok) {
          throw new Error(`读取海流数据失败：HTTP ${response.status}`)
      }

      const data: OceanJson = await response.json()
      if (pending.signal.aborted) return

      const [west, south, east, north] = data.bbox

      const windData: WindData = {
          width: data.width,
          height: data.height,
          bounds: { west, south, east, north },
          u: { ...data.u, array: new Float32Array(data.u.array) },
          v: { ...data.v, array: new Float32Array(data.v.array) },
      }

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
      if (pending.signal.aborted) return

      cached = { windData, provider }
      frameCache.set(index, cached)
    }
    const { windData, provider } = cached

    if (layer) {
      layer.updateWindData(windData)
    } else {
      layer = new WindLayer(viewer, windData, {
        flipY: true,
        particleHeight: 10,
        speedFactor: 2.4,
        particlesTextureSize: 112,
        lineWidth: { min: 2, max: 3 },
        lineLength: { min: 50, max: 150 },
        domain: { min: 0, max: 0.9 },
        colors: ['#e4f6ff'],
        useViewerBounds: true,
      })
      zoomToOverview()
      screenSizedTrails.value = applyOceanTrailStyle(layer, () => zoomAdaptive.value)
      if (screenSizedTrails.value) {
        layer.updateOptions({
          lineWidth: { min: 1.3, max: 2.1 },
          lineLength: { min: 12, max: 25 },
        })
      } else {
        console.warn('当前 cesium-wind-layer 版本无法启用屏幕像素尾迹。')
      }

      panelOptions.value = {
        ...layer.options,
        displayRange: {
          min: layer.windData.speed.min ?? 0,
          max: layer.windData.speed.max ?? 1.85,
        },
      }
      layer.updateOptions({ displayRange: panelOptions.value.displayRange })
    }

    const nextSpeedLayer = new ImageryLayer(provider, {
      alpha: 0.48,
      // magnificationFilter: TextureMagnificationFilter.NEAREST,
    })
    viewer.imageryLayers.add(nextSpeedLayer)
    if (speedLayer) viewer.imageryLayers.remove(speedLayer, true)
    speedLayer = nextSpeedLayer
    currentIndex.value = index

  } catch (error) {
    if (!pending.signal.aborted) {
      frameError.value = error instanceof Error ? error.message : String(error)
      console.error('读取洋流数据失败', error)
    }
  } finally {
    if (request === pending) loading.value = false
  }
}

onBeforeUnmount(() => {
  request?.abort()
  frameCache.clear()
  layer?.destroy()
  viewer?.destroy()
})
</script>

<template>
  <div class="ocean-scene">
    <div ref="container" class="cesium-container"></div>
    <OceanCurrentControls
      v-if="panelOptions"
      v-model:zoom-adaptive="zoomAdaptive"
      :options="panelOptions"
      :screen-sized-trails="screenSizedTrails"
      @update-options="updateLayerOptions"
      @zoom-to-overview="zoomToOverview"
    />
    <OceanTimeSlider
      :frames="frames"
      :current-index="currentIndex"
      :loading="loading"
      :loading-index="loadingIndex"
      :error="frameError"
      :playing="playing"
      @toggle-playback="togglePlayback"
      @pause="playing = false"
      @select="loadFrame"
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
