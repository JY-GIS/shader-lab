import {
  ArcType,
  Axis,
  BoundingSphere,
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  CircleGeometry,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  CustomShader,
  CustomShaderMode,
  CylinderGeometry,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  HeadingPitchRange,
  LightingModel,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Model,
  NearFarScalar,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PointPrimitiveCollection,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  UniformType,
  VaryingType,
  Viewer,
} from 'cesium'
import { createCityModel } from './cityModel'
import cityVertexSource from './cityVertex.glsl?raw'
import cityFragmentSource from './cityFragment.glsl?raw'
import flyLineSource from './flyLine.glsl?raw'
import energyFlyLineSource from './energyFlyLine.glsl?raw'
import signalImpactSource from './signalImpact.glsl?raw'
import pulseRingSource from './pulseRing.glsl?raw'
import stationBeaconSource from './stationBeacon.glsl?raw'
import { createStationBadge } from './stationBadge'

export type TwinLayer = 'buildings' | 'roads' | 'flows' | 'rings' | 'markers' | 'scan'

export interface DigitalTwinSceneController {
  setLayer: (layer: TwinLayer, enabled: boolean) => void
  setSpeed: (speed: number) => void
  setGlow: (strength: number) => void
  setFlightTailLength: (length: number) => void
  setPaused: (paused: boolean) => void
  setOrbit: (enabled: boolean) => void
  resetView: () => void
  zoom: (direction: number) => void
  destroy: () => void
}

interface SceneCallbacks {
  onReady: (buildingCount: number) => void
  onError: (message: string) => void
  onSelect: (name: string) => void
}

// 以珠江新城为原点，所有示意模型、道路、特效共用 ENU 米制坐标。
const ORIGIN = Cartesian3.fromDegrees(113.321, 23.119, 0)
const LOCAL_FRAME = Transforms.eastNorthUpToFixedFrame(ORIGIN)
// 周期结束前让最长 0.6 的光尾完整离开弧线，避免重新发射时突然截断。
const FLIGHT_HEAD_RANGE = 1.72
const STATIONS = [
  { name: '基站发射中心', east: 0, north: 650, color: '#ffc650' },
  { name: '珠江大道西', east: -1140, north: 180, color: '#5cf7c0' },
  { name: '珠江大道东', east: -860, north: 1070, color: '#68f3c4' },
  { name: '珠江大道中', east: 1040, north: 1050, color: '#7df2a9' },
  { name: '珠江大道北', east: 1320, north: 250, color: '#8df58f' },
  { name: '广州西路北', east: 1180, north: -580, color: '#66ebbb' },
] as const

function world(east: number, north: number, height = 0) {
  return Matrix4.multiplyByPoint(LOCAL_FRAME, new Cartesian3(east, north, height), new Cartesian3())
}

function cssColor(value: string, alpha = 1) {
  return Color.fromCssColorString(value).withAlpha(alpha)
}

function addLine(
  collection: PrimitiveCollection,
  points: Cartesian3[],
  width: number,
  material: Material,
  id?: string,
) {
  return collection.add(new Primitive({
    geometryInstances: new GeometryInstance({
      id,
      geometry: new PolylineGeometry({
        positions: points,
        width,
        arcType: ArcType.NONE,
        vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
      }),
    }),
    appearance: new PolylineMaterialAppearance({ material, translucent: true }),
    asynchronous: false,
  })) as Primitive
}

function addPolygon(collection: PrimitiveCollection, coordinates: number[][], color: Color) {
  collection.add(new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(coordinates.map(([x, y]) => world(x!, y!, 0.5))),
        perPositionHeight: true,
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
    }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: color.alpha < 1 }),
    asynchronous: false,
  }))
}

function addDiamond(
  collection: PrimitiveCollection, east: number, north: number, color: Color, orbitMaterial: Material,
) {
  const positions = new Float64Array([
    0, 0, 65, -31, -31, 20, 31, -31, 20, 31, 31, 20, -31, 31, 20, 0, 0, -65,
  ])
  const faces = new Uint16Array([
    0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1,
    5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4,
  ])
  const edges = new Uint16Array([
    0, 1, 0, 2, 0, 3, 0, 4, 5, 1, 5, 2, 5, 3, 5, 4, 1, 2, 2, 3, 3, 4, 4, 1,
  ])
  const makeGeometry = (indices: Uint16Array, primitiveType: PrimitiveType) => new Geometry({
    attributes: Object.assign(new GeometryAttributes(), {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
    }),
    indices,
    primitiveType,
    boundingSphere: BoundingSphere.fromVertices(positions),
  })
  const diamond = new PrimitiveCollection()
  for (const [geometry, alpha] of [
    [makeGeometry(faces, PrimitiveType.TRIANGLES), 0.18],
    [makeGeometry(edges, PrimitiveType.LINES), 0.85],
  ] as const) {
    diamond.add(new Primitive({
      geometryInstances: new GeometryInstance({
        geometry,
        id: `station:${STATIONS.find((station) => station.east === east)?.name ?? ''}`,
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(color.withAlpha(alpha)) },
      }),
      appearance: new PerInstanceColorAppearance({ flat: true, translucent: true, closed: false }),
      asynchronous: false,
    }))
  }
  // 两个倾斜轨道与棱锥共用局部坐标系，随棱锥一起旋转、悬浮。
  for (let orbit = 0; orbit < 2; orbit++) {
    const points = Array.from({ length: 81 }, (_, segment) => {
      const angle = segment / 80 * CesiumMath.TWO_PI
      return orbit === 0
        ? new Cartesian3(Math.cos(angle) * 64, Math.sin(angle) * 34, Math.sin(angle) * 42)
        : new Cartesian3(Math.cos(angle) * 33, Math.sin(angle) * 64, -Math.cos(angle) * 43)
    })
    addLine(diamond, points, 1.5, orbitMaterial, `station:${STATIONS.find((station) => station.east === east)?.name ?? ''}`)
  }
  collection.add(diamond)
  const position = world(east, north, 185)
  const base = Transforms.eastNorthUpToFixedFrame(position)
  return { diamond, base }
}

export function createDigitalTwinScene(
  container: HTMLElement,
  callbacks: SceneCallbacks,
): DigitalTwinSceneController {
  const viewer = new Viewer(container, {
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
    skyBox: false,
    skyAtmosphere: false,
    scene3DOnly: true,
    showRenderLoopErrors: false,
    contextOptions: { webgl: { alpha: false } },
  })
  const scene = viewer.scene
  let initializationCleanup: (() => void) | undefined
  let sourceCleanup: (() => void) | undefined
  const materials: Material[] = []
  try {
    scene.backgroundColor = cssColor('#070d17')
    scene.globe.baseColor = cssColor('#080e17')
    scene.globe.enableLighting = false
    scene.globe.showGroundAtmosphere = false
    scene.fog.enabled = false
    scene.highDynamicRange = false
    scene.postProcessStages.fxaa.enabled = true
    const bloom = scene.postProcessStages.bloom
    bloom.enabled = false
    bloom.uniforms.glowOnly = false
    bloom.uniforms.contrast = 128
    bloom.uniforms.brightness = -0.25
    bloom.uniforms.delta = 0.7
    bloom.uniforms.sigma = 1.5
    bloom.uniforms.stepSize = 1
    scene.screenSpaceCameraController.minimumZoomDistance = 300
    scene.screenSpaceCameraController.maximumZoomDistance = 17000

    const ground = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const city = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const roadGlow = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const flows = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const rings = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const markers = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection
    const stationBadges = markers.add(new BillboardCollection()) as BillboardCollection
    const stationCores = markers.add(new PointPrimitiveCollection()) as PointPrimitiveCollection
    const flightPoints = flows.add(new PointPrimitiveCollection()) as PointPrimitiveCollection
    const animatedMaterials: Material[] = []
    const flightMaterials: { material: Material; tailScale: number }[] = []
    const colorMaterial = (color: Color) => {
      const material = Material.fromType('Color', { color })
      materials.push(material)
      return material
    }
    const animatedMaterial = (source: string, color: Color, uniforms: Record<string, number | Color> = {}) => {
      const material = new Material({
        fabric: {
          source,
          uniforms: { u_time: 0, u_speed: 0.25, u_color: color, u_glowStrength: 1, u_phase: 0, ...uniforms },
        },
        translucent: true,
      })
      materials.push(material)
      animatedMaterials.push(material)
      return material
    }

    const customShader = new CustomShader({
      mode: CustomShaderMode.MODIFY_MATERIAL,
      lightingModel: LightingModel.UNLIT,
      varyings: { v_cityPositionMC: VaryingType.VEC3, v_cityNormalMC: VaryingType.VEC3 },
      uniforms: {
        u_time: { type: UniformType.FLOAT, value: 0 },
        u_scanEnabled: { type: UniformType.FLOAT, value: 1 },
        u_glowStrength: { type: UniformType.FLOAT, value: 1 },
      },
      vertexShaderText: cityVertexSource,
      fragmentShaderText: cityFragmentSource,
    })
    initializationCleanup = () => {
      if (!customShader.isDestroyed()) customShader.destroy()
    }

    // 底图同样在本地生成。道路两层叠加：深色路基 + 可独立开关的流光。
    addPolygon(ground, [[-6200, -4200], [6200, -4200], [6200, 6500], [-6200, 6500]], cssColor('#0c131d'))
    const roadBase = colorMaterial(cssColor('#1d2934', 0.5))
    const minorRoad = colorMaterial(cssColor('#18232e', 0.4))
    const roadLight = animatedMaterial(flyLineSource, cssColor('#9edc53', 0.8))
    for (let x = -5000; x <= 5000; x += 260) {
      const points = [world(x, -730, 2), world(x, 5000, 2)]
      addLine(ground, points, 4, roadBase)
      if ((x + 5000) % 520 === 0) addLine(roadGlow, points, 1.3, roadLight)
      addLine(ground, [world(x, -3800, 2), world(x, -1380, 2)], 3, minorRoad)
    }
    for (let y = -650; y <= 5000; y += 230) {
      const points = [world(-5500, y, 2), world(5500, y, 2)]
      addLine(ground, points, 4, roadBase)
      if ((y + 650) % 690 === 0) addLine(roadGlow, points, 1.3, roadLight)
    }
    for (let y = -3500; y < -1400; y += 250) {
      addLine(ground, [world(-5000, y, 2), world(5000, y, 2)], 4, roadBase)
    }
    const riverNorth: number[][] = []
    const riverSouth: number[][] = []
    for (let x = -6200; x <= 6200; x += 200) {
      const bend = Math.sin(x / 1800) * 120
      riverNorth.push([x, -820 + bend])
      riverSouth.push([x, -1260 + bend])
    }
    addPolygon(ground, [...riverNorth, ...[...riverSouth].reverse()], cssColor('#182935'))
    const shore = colorMaterial(cssColor('#418c9e', 0.45))
    for (const bank of [riverNorth, riverSouth]) {
      addLine(ground, bank.map(([x, y]) => world(x!, y!, 3)), 1.3, shore)
    }
    // 海心沙与中轴广场用低矮地面轮廓暗示，不使用在线地图瓦片。
    addPolygon(ground, [[-730, -1010], [-430, -940], [50, -960], [320, -1050], [80, -1140], [-550, -1100]], cssColor('#11202b'))
    addPolygon(ground, [[-110, -660], [110, -660], [110, 1100], [-110, 1100]], cssColor('#112b2a'))
    for (const x of [-1800, 1790]) {
      addLine(ground, [world(x, -1520, 6), world(x + 100, -550, 6)], 12, roadBase)
      addLine(roadGlow, [world(x, -1520, 8), world(x + 100, -550, 8)], 2, roadLight)
    }

    function addRing(
      collection: PrimitiveCollection, east: number, north: number, radius: number,
      color: Color, material = animatedMaterial(pulseRingSource, color),
    ) {
      collection.add(new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new CircleGeometry({
            center: world(east, north, 4),
            radius,
            height: 4,
            vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
          }),
        }),
        appearance: new MaterialAppearance({ material, translucent: true, faceForward: true }),
        asynchronous: false,
      }))
    }
    for (const ring of [
      { radius: 1550, color: '#5ee6f4', speed: 0.12, phase: 0 },
      { radius: 1000, color: '#9c8bff', speed: 0.16, phase: 0.31 },
      { radius: 520, color: '#ffc16a', speed: 0.2, phase: 0.63 },
    ]) {
      const color = cssColor(ring.color, 0.85)
      addRing(rings, 0, 0, ring.radius, color, animatedMaterial(pulseRingSource, color, {
        u_speed: ring.speed, u_phase: ring.phase,
      }))
    }

    const diamonds: ReturnType<typeof addDiamond>[] = []
    const flightPalette = [
      ['#ffb149', '#fff0a6'],
      ['#ffd479', '#68eaff'],
      ['#ff9856', '#ffe58b'],
      ['#ae8fff', '#68e6ff'],
      ['#55ddd3', '#c6ffad'],
    ] as const
    const flights: { index: number; speed: number; phase: number; pointIndex: number }[] = []
    for (const [index, station] of STATIONS.entries()) {
      const stationColor = cssColor(station.color)
      diamonds.push(addDiamond(markers, station.east, station.north, stationColor,
        animatedMaterial(flyLineSource, stationColor.withAlpha(0.9))))
      stationCores.add({
        id: `station:${station.name}`,
        position: world(station.east, station.north, 185),
        color: cssColor('#ddfffb'), pixelSize: 5,
        outlineColor: stationColor.withAlpha(0.5), outlineWidth: 3,
      })
      addRing(markers, station.east, station.north, 94, cssColor(station.color, 0.9))
      markers.add(new Primitive({
        geometryInstances: new GeometryInstance({
          id: `station:${station.name}`,
          modelMatrix: Transforms.eastNorthUpToFixedFrame(world(station.east, station.north, 147)),
          geometry: new CylinderGeometry({
            length: 280, topRadius: 3, bottomRadius: 12, slices: 24,
            vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
          }),
        }),
        appearance: new MaterialAppearance({
          material: animatedMaterial(stationBeaconSource, stationColor, {
            u_speed: 0.3, u_phase: index * 0.19,
          }),
          translucent: true, faceForward: true, closed: false,
        }),
        asynchronous: false,
      }))
      stationBadges.add({
        id: `station:${station.name}`,
        position: world(station.east, station.north, 355),
        image: createStationBadge(station.name, index, station.color),
        width: 176, height: 51,
        pixelOffset: new Cartesian2(station.east === 0 ? 0 : station.east < 0 ? -20 : 20, -12 - (index % 2) * 9),
        scaleByDistance: new NearFarScalar(1500, 1, 10000, 0.65),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
      if (index === 0) continue
      const center = STATIONS[0]
      const palette = flightPalette[index - 1]!
      const color = cssColor(palette[0])
      const accentColor = cssColor(palette[1])
      const flightSpeed = 0.23 + (index % 3) * 0.025
      const phase = index * 0.173
      const points = Array.from({ length: 121 }, (_, segment) => flightPosition(index, segment / 120))
      const energyMaterial = (halo: boolean, tailScale = 1) => {
        const material = animatedMaterial(energyFlyLineSource, color, {
          u_speed: flightSpeed, u_phase: phase, u_accentColor: accentColor, u_headRange: FLIGHT_HEAD_RANGE,
          u_tailLength: 0.42 * tailScale, u_halo: halo ? 1 : 0,
        })
        flightMaterials.push({ material, tailScale })
        return material
      }
      // 同路径宽柔光 + 窄亮芯，无需全屏 Bloom 就能看清彗星拖尾。
      addLine(flows, points, 22, energyMaterial(true))
      addLine(flows, points, 7.5, energyMaterial(false))

      const direction = new Cartesian2(station.east - center.east, station.north - center.north)
      Cartesian2.normalize(direction, direction)
      const filament = points.map((_point, segment) => {
        const t = segment / 120
        const envelope = Math.sin(t * Math.PI)
        const offset = Math.sin(t * Math.PI * 10 + index) * 19 * envelope
        return world(
          CesiumMath.lerp(center.east, station.east, t) - direction.y * offset,
          CesiumMath.lerp(center.north, station.north, t) + direction.x * offset,
          30 + Math.sin(t * Math.PI) * (710 + index * 48)
            + Math.cos(t * Math.PI * 10 + index) * 15 * envelope,
        )
      })
      addLine(flows, filament, 2, energyMaterial(false, 0.5))

      const pointIndex = flightPoints.length
      flightPoints.add({ position: points[0], pixelSize: 19, color: accentColor.withAlpha(0.12) })
      flightPoints.add({
        position: points[0], pixelSize: 4, color: cssColor('#f1fcff'),
        outlineColor: accentColor.withAlpha(0.75), outlineWidth: 1.5,
      })
      flights.push({ index, speed: flightSpeed, phase, pointIndex })
      // 落点冲击波与主光头抵达末端共享同一周期，整体归属飞线图层。
      addRing(flows, station.east, station.north, 125, accentColor,
        animatedMaterial(signalImpactSource, accentColor, {
          u_speed: flightSpeed, u_phase: phase, u_headRange: FLIGHT_HEAD_RANGE,
        }))
    }

    function flightPosition(index: number, t: number) {
      const station = STATIONS[index]!
      const center = STATIONS[0]
      return world(
        CesiumMath.lerp(center.east, station.east, t),
        CesiumMath.lerp(center.north, station.north, t),
        30 + Math.sin(t * Math.PI) * (710 + index * 48),
      )
    }

    let destroyed = false
    let failed = false
    let paused = false
    let orbit = false
    let speed = 1
    let elapsed = 0
    let previousTime = performance.now()
    let orbitHeading = CesiumMath.toRadians(8)
    const cameraTarget = world(0, -40, 80)
    function fittedCameraRange() {
      const aspect = scene.canvas.clientWidth / Math.max(scene.canvas.clientHeight, 1)
      return Math.min(10000, 4100 * Math.max(1, 0.9 / aspect))
    }
    function resetView() {
      if (destroyed) return
      viewer.camera.lookAt(cameraTarget, new HeadingPitchRange(
        CesiumMath.toRadians(8), CesiumMath.toRadians(-30), fittedCameraRange(),
      ))
      // 解除局部相机约束后保留 Cesium 原生拖动、缩放、倾斜操作。
      viewer.camera.lookAtTransform(Matrix4.IDENTITY)
      orbitHeading = CesiumMath.toRadians(8)
    }
    resetView()

    const reportError = (error: unknown) => {
      if (destroyed || viewer.isDestroyed() || failed) return
      failed = true
      console.error('demo04 数字孪生场景加载失败：', error)
      callbacks.onError('场景渲染失败，请检查浏览器 WebGL 支持后重试。')
    }
    const source = createCityModel()
    sourceCleanup = source.dispose
    let cityModel: Model | undefined
    let buildingsVisible = true
    void Model.fromGltfAsync({
      url: source.url,
      modelMatrix: LOCAL_FRAME,
      // 只转换 Y-up，不采用默认 Z-forward→X-forward 的额外转向，确保楼体对齐 ENU 底图。
      forwardAxis: Axis.X,
      customShader,
      incrementallyLoadTextures: false,
      enablePick: false,
    }).then((model) => {
      if (destroyed || viewer.isDestroyed()) {
        model.destroy()
        return
      }
      city.add(model)
      cityModel = model
      model.show = buildingsVisible
      model.readyEvent.addEventListener(() => {
        if (!destroyed && !failed) callbacks.onReady(source.buildingCount)
      })
      model.errorEvent.addEventListener(reportError)
    }).catch(reportError)

    const stopRenderError = scene.renderError.addEventListener((_scene, error) => reportError(error))
    const stopPreRender = scene.preRender.addEventListener(() => {
      const currentTime = performance.now()
      const delta = Math.min((currentTime - previousTime) / 1000, 0.1)
      previousTime = currentTime
      if (!paused) elapsed += delta * speed
      customShader.setUniform('u_time', elapsed)
      for (const material of animatedMaterials) material.uniforms.u_time = elapsed
      // PolylineGeometry 的 st.s 随采样点编号变化，均匀 t 与材质光头严格对齐。
      for (const flight of flights) {
        const head = CesiumMath.mod(elapsed * flight.speed + flight.phase, 1) * FLIGHT_HEAD_RANGE - 0.08
        const halo = flightPoints.get(flight.pointIndex)
        const point = flightPoints.get(flight.pointIndex + 1)
        halo.show = point.show = head >= 0 && head <= 1
        if (point.show) {
          const position = flightPosition(flight.index, head)
          halo.position = position
          point.position = position
        }
      }
      for (const [index, { diamond, base }] of diamonds.entries()) {
        const rotation = Matrix3.fromRotationZ(elapsed * 0.35 + index)
        const transform = Matrix4.fromRotationTranslation(rotation, new Cartesian3(0, 0, Math.sin(elapsed * 1.4 + index) * 13))
        const matrix = Matrix4.multiply(base, transform, new Matrix4())
        for (let i = 0; i < diamond.length; i++) (diamond.get(i) as Primitive).modelMatrix = matrix
        const station = STATIONS[index]!
        stationCores.get(index).position = world(station.east, station.north, 185 + Math.sin(elapsed * 1.4 + index) * 13)
      }
      if (orbit && !paused) {
        orbitHeading += delta * 0.045
        viewer.camera.lookAt(cameraTarget, new HeadingPitchRange(orbitHeading, CesiumMath.toRadians(-30), fittedCameraRange()))
        viewer.camera.lookAtTransform(Matrix4.IDENTITY)
      }
    })
    const handler = new ScreenSpaceEventHandler(scene.canvas)
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const picked = scene.pick(movement.position) as { id?: unknown } | undefined
      if (typeof picked?.id === 'string' && picked.id.startsWith('station:')) {
        callbacks.onSelect(picked.id.slice('station:'.length))
      }
    }, ScreenSpaceEventType.LEFT_CLICK)
    const collections = { buildings: city, roads: roadGlow, flows, rings, markers }

    return {
      setLayer(layer, enabled) {
        if (layer === 'scan') customShader.setUniform('u_scanEnabled', enabled ? 1 : 0)
        else if (layer === 'buildings') {
          buildingsVisible = enabled
          if (cityModel) cityModel.show = enabled
        }
        else collections[layer].show = enabled
      },
      setSpeed(value) { speed = value },
      setGlow(value) {
        customShader.setUniform('u_glowStrength', value)
        for (const material of animatedMaterials) material.uniforms.u_glowStrength = value
        bloom.enabled = value > 1.3
        bloom.uniforms.brightness = -0.35 + value * 0.1
      },
      setFlightTailLength(value) {
        for (const { material, tailScale } of flightMaterials) {
          material.uniforms.u_tailLength = value * tailScale
        }
      },
      setPaused(value) { paused = value },
      setOrbit(value) {
        orbit = value
        if (value) orbitHeading = viewer.camera.heading
      },
      resetView,
      zoom(direction) {
        const distance = Cartesian3.distance(viewer.camera.positionWC, cameraTarget)
        const targetDistance = CesiumMath.clamp(distance * (direction > 0 ? 0.82 : 1.18), 650, 16000)
        viewer.camera.zoomIn(distance - targetDistance)
      },
      destroy() {
        if (destroyed) return
        destroyed = true
        stopPreRender()
        stopRenderError()
        handler.destroy()
        viewer.destroy()
        if (!customShader.isDestroyed()) customShader.destroy()
        for (const material of materials) if (!material.isDestroyed()) material.destroy()
        source.dispose()
      },
    }
  } catch (error) {
    // 初始化同步失败时，工厂尚未返回，必须在这里回收已创建的 WebGL 资源。
    if (!viewer.isDestroyed()) viewer.destroy()
    initializationCleanup?.()
    sourceCleanup?.()
    for (const material of materials) if (!material.isDestroyed()) material.destroy()
    throw error
  }
}
