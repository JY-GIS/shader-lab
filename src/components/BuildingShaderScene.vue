<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import {
  Cartesian3,
  Cesium3DTileset,
  Cesium3DTileStyle,
  createOsmBuildingsAsync,
  CustomShader,
  CustomShaderMode,
  Ion,
  LightingModel,
  Math as CesiumMath,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import modelColorShaderSource from '../shaders/shader10/modelColor.glsl?raw'

const container = ref<HTMLDivElement | null>(null)

let viewer: Viewer | undefined
let buildingsTileset: Cesium3DTileset | undefined
let buildingCustomShader: CustomShader | undefined
let isUnmounted = false

function createBuildingCustomShader() {
  const fragmentShaderText = modelColorShaderSource.trim()
  if (!fragmentShaderText) return undefined

  return new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    fragmentShaderText,
  })
}

function setTeachingCamera(targetViewer: Viewer) {
  targetViewer.camera.setView({
    destination: Cartesian3.fromDegrees(-74.0186, 40.6964, 900.0),
    orientation: {
      heading: CesiumMath.toRadians(5.0),
      pitch: CesiumMath.toRadians(-25.0),
      roll: 0.0,
    },
  })
}

async function addOsmBuildings(targetViewer: Viewer) {
  const customShader = createBuildingCustomShader()
  const loadedTileset = await createOsmBuildingsAsync({
    // GLSL 为空时仍显示白模，便于从 HAND 阶段开始输入。
    style: new Cesium3DTileStyle({
      color: "color('#ffffff')",
    }),
    enableShowOutline: true,
    showOutline: true,
  })

  // CustomShader 与 Cesium3DTileStyle 不混用。
  if (customShader) {
    loadedTileset.style = undefined
    loadedTileset.customShader = customShader
  }

  // 网络请求可能在组件卸载后才结束；此时不再访问已销毁的 Viewer。
  if (isUnmounted || targetViewer.isDestroyed()) {
    loadedTileset.destroy()
    customShader?.destroy()
    return
  }

  buildingCustomShader = customShader
  buildingsTileset = targetViewer.scene.primitives.add(loadedTileset)
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

  setTeachingCamera(targetViewer)

  await addOsmBuildings(targetViewer)
}

onMounted(() => {
  isUnmounted = false
  void initializeScene()
})

onUnmounted(() => {
  isUnmounted = true

  if (viewer && !viewer.isDestroyed()) {
    // PrimitiveCollection.remove 会销毁其中的 Cesium3DTileset GPU 资源。
    if (buildingsTileset && !buildingsTileset.isDestroyed()) {
      viewer.scene.primitives.remove(buildingsTileset)
    }
    if (buildingCustomShader && !buildingCustomShader.isDestroyed()) {
      buildingCustomShader.destroy()
    }
    viewer.destroy()
  }

  buildingCustomShader = undefined
  buildingsTileset = undefined
  viewer = undefined
})
</script>

<template>
  <div class="shader-scene">
    <section ref="container" class="cesium-container" aria-label="Cesium OSM 建筑白模场景" />
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
