<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import {
  Cartesian3,
  Cesium3DTileset,
  CustomShader,
  CustomShaderMode,
  HeadingPitchRange,
  Ion,
  LightingModel,
  Math as CesiumMath,
  Transforms,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import metadataColorShaderSource from '../shaders/shader12/metadataColor.glsl?raw'

const container = ref<HTMLDivElement | null>(null)

let viewer: Viewer | undefined
let metadataTileset: Cesium3DTileset | undefined
let metadataCustomShader: CustomShader | undefined
let isUnmounted = false

const samplePosition = Cartesian3.fromDegrees(-75.152325, 39.94704, 0.0)

function createSampleModelMatrix() {
  return Transforms.eastNorthUpToFixedFrame(samplePosition)
}

function createMetadataCustomShader() {
  return new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    fragmentShaderText: metadataColorShaderSource,
  })
}

async function addMetadataTileset(targetViewer: Viewer) {
  const tilesetUrl = `${import.meta.env.BASE_URL}tilesets/shader12/tileset.json`
  const loadedTileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
    maximumScreenSpaceError: 4,
  })
  const customShader = createMetadataCustomShader()
  loadedTileset.customShader = customShader

  if (isUnmounted || targetViewer.isDestroyed()) {
    loadedTileset.destroy()
    customShader.destroy()
    return
  }

  metadataCustomShader = customShader
  metadataTileset = targetViewer.scene.primitives.add(loadedTileset)
  loadedTileset.modelMatrix = createSampleModelMatrix()
  await targetViewer.zoomTo(
    loadedTileset,
    new HeadingPitchRange(0.0, CesiumMath.toRadians(-22.5), 4.0),
  )
}

async function initializeScene() {
  if (!container.value) return

  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

  const targetViewer = new Viewer(container.value, {
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
  viewer = targetViewer

  await addMetadataTileset(targetViewer)
}

onMounted(() => {
  isUnmounted = false
  void initializeScene().catch((error: unknown) => {
    console.error('Shader 12B 场景初始化失败：', error)
  })
})

onUnmounted(() => {
  isUnmounted = true

  if (viewer && !viewer.isDestroyed()) {
    if (metadataTileset && !metadataTileset.isDestroyed()) {
      viewer.scene.primitives.remove(metadataTileset)
    }
    if (metadataCustomShader && !metadataCustomShader.isDestroyed()) {
      metadataCustomShader.destroy()
    }
    viewer.destroy()
  }

  metadataCustomShader = undefined
  metadataTileset = undefined
  viewer = undefined
})
</script>

<template>
  <div class="shader-scene">
    <section ref="container" class="cesium-container" aria-label="GPU Metadata 着色实验" />
  </div>
</template>

<style scoped>
.shader-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
