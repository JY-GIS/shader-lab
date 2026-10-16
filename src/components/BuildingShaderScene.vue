<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import {
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Cesium3DTileStyle,
  createOsmBuildingsAsync,
  CustomShader,
  CustomShaderMode,
  Ion,
  LightingModel,
  Math as CesiumMath,
  ModelFeature,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VaryingType,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import modelColorShaderSource from '../shaders/shader10/modelColor.glsl?raw'
import vertexShaderSource from '../shaders/shader11/vertex.glsl?raw'
import fragmentShaderSource from '../shaders/shader11/fragment.glsl?raw'

const container = ref<HTMLDivElement | null>(null)

let viewer: Viewer | undefined
let buildingsTileset: Cesium3DTileset | undefined
let buildingCustomShader: CustomShader | undefined
let featurePickHandler: ScreenSpaceEventHandler | undefined
let isUnmounted = false

// 当前实验只启用 3D Tiles Styling，不与 CustomShader 混用。
const useShader11Experiment = false

const candidatePropertyIds = [
  'elementId',
  'elementType',
  'height',
  'cesium#estimatedHeight',
  'building',
] as const

type InspectableFeature = Cesium3DTileFeature | ModelFeature

function getValueType(value: unknown) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function printFeatureProperties(feature: InspectableFeature) {
  const featureType = feature instanceof Cesium3DTileFeature ? 'Cesium3DTileFeature' : 'ModelFeature'
  const propertyIds = feature.getPropertyIds()
  const properties = propertyIds.map((propertyId) => {
    const value: unknown = feature.getProperty(propertyId)
    return {
      propertyId,
      value,
      type: getValueType(value),
    }
  }).filter(({ value }) => value !== undefined)
  const candidates = candidatePropertyIds.map((propertyId) => {
    const value: unknown = feature.getProperty(propertyId)
    return {
      propertyId,
      value,
      type: getValueType(value),
    }
  })

  console.group(`建筑 Feature：${featureType}，ID=${feature.featureId}`)
  console.info('当前 Feature 有值的属性：')
  console.table(properties)
  console.info('候选字段（缺失字段显示为 undefined）：')
  console.table(candidates)
  console.groupEnd()
}

function createFeaturePickHandler(targetViewer: Viewer) {
  const handler = new ScreenSpaceEventHandler(targetViewer.scene.canvas)

  handler.setInputAction((movement: ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = targetViewer.scene.pick(movement.position)

    if (picked instanceof Cesium3DTileFeature || picked instanceof ModelFeature) {
      printFeatureProperties(picked)
    }
  }, ScreenSpaceEventType.LEFT_CLICK)

  return handler
}

function createBuildingCustomShader() {
  const vertexShaderText = vertexShaderSource.trim() || undefined
  const fragmentShaderText = fragmentShaderSource.trim() || modelColorShaderSource.trim()

  return new CustomShader({
    mode: CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: LightingModel.UNLIT,
    varyings: {
      v_localHeight: VaryingType.FLOAT,
    },
    vertexShaderText,
    fragmentShaderText,
  })
}

function createHeightClassificationStyle() {
  return new Cesium3DTileStyle({
    color: {
      // 3D Tiles Styling Language
      // ${feature['...']} ：读取当前 Feature 的属性
      conditions: [
        ["!Boolean(${feature['cesium#estimatedHeight']})", "color('#808080')"],
        ["${feature['cesium#estimatedHeight']} < 65.0", "color('#1971c2')"],
        ["${feature['cesium#estimatedHeight']} < 90.0", "color('#ffd43b')"],
        ['true', "color('#e03131')"],
      ],
    },
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
  const customShader = useShader11Experiment ? createBuildingCustomShader() : undefined
  const loadedTileset = await createOsmBuildingsAsync({
    style: createHeightClassificationStyle(),
    enableShowOutline: true,
    showOutline: true,
  })
  loadedTileset.maximumScreenSpaceError = 4

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
  featurePickHandler = createFeaturePickHandler(targetViewer)

  await addOsmBuildings(targetViewer)
}

onMounted(() => {
  isUnmounted = false
  void initializeScene()
})

onUnmounted(() => {
  isUnmounted = true

  if (featurePickHandler && !featurePickHandler.isDestroyed()) {
    featurePickHandler.destroy()
  }

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
  featurePickHandler = undefined
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
