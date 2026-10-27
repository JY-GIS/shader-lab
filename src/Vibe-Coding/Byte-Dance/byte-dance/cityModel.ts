/**
 * 用少量网格生成珠江新城的示意白模。布局与地标轮廓用于 Shader 练习，
 * 并非测绘数据；glTF 采用 Y-up：x 向东、y 向上、z 向南。
 */
type Vec3 = [number, number, number]
type Ring = { height: number; radiusX: number; radiusZ: number; rotation?: number }
type MeshData = { positions: number[]; normals: number[]; indices: number[] }

const TAU = Math.PI * 2

function createMesh(): MeshData {
  return { positions: [], normals: [], indices: [] }
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(...value) || 1
  return [value[0] / length, value[1] / length, value[2] / length]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function addFace(mesh: MeshData, vertices: Vec3[]) {
  const normal = normalize(cross(subtract(vertices[1]!, vertices[0]!), subtract(vertices[2]!, vertices[0]!)))
  const start = mesh.positions.length / 3

  for (const vertex of vertices) {
    mesh.positions.push(...vertex)
    mesh.normals.push(...normal)
  }
  for (let index = 1; index < vertices.length - 1; index++) {
    mesh.indices.push(start, start + index, start + index + 1)
  }
}

function ringPoint(east: number, north: number, ring: Ring, angle: number): Vec3 {
  const rotation = ring.rotation ?? 0
  const localX = Math.cos(angle) * ring.radiusX
  const localZ = Math.sin(angle) * ring.radiusZ
  return [
    east + localX * Math.cos(rotation) - localZ * Math.sin(rotation),
    ring.height,
    -north + localX * Math.sin(rotation) + localZ * Math.cos(rotation),
  ]
}

/** 环形截面可同时描述方楼、圆角塔楼、退台和扭转地标。 */
function addTower(mesh: MeshData, east: number, north: number, rings: Ring[], sides = 4) {
  const angleOffset = sides === 4 ? Math.PI / 4 : 0

  for (let level = 0; level < rings.length - 1; level++) {
    const lower = rings[level]!
    const upper = rings[level + 1]!
    for (let side = 0; side < sides; side++) {
      const angle = angleOffset + side / sides * TAU
      const nextAngle = angleOffset + (side + 1) / sides * TAU
      addFace(mesh, [
        ringPoint(east, north, lower, angle),
        ringPoint(east, north, upper, angle),
        ringPoint(east, north, upper, nextAngle),
        ringPoint(east, north, lower, nextAngle),
      ])
    }
  }

  const top = rings.at(-1)!
  for (let side = 0; side < sides; side++) {
    addFace(mesh, [
      [east, top.height, -north],
      ringPoint(east, north, top, angleOffset + (side + 1) / sides * TAU),
      ringPoint(east, north, top, angleOffset + side / sides * TAU),
    ])
  }
}

function addBox(mesh: MeshData, east: number, north: number, width: number, depth: number, bottom: number, top: number, rotation = 0) {
  // 四边形的45°截面让 width/depth 对应实际占地宽度。
  const radiusX = width / Math.SQRT2
  const radiusZ = depth / Math.SQRT2
  addTower(mesh, east, north, [
    { height: bottom, radiusX, radiusZ, rotation },
    { height: top, radiusX, radiusZ, rotation },
  ])
}

function addRod(mesh: MeshData, start: Vec3, end: Vec3, radius: number, sides = 5) {
  const direction = normalize(subtract(end, start))
  const helper: Vec3 = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const axisU = normalize(cross(direction, helper))
  const axisV = cross(direction, axisU)
  const point = (origin: Vec3, angle: number): Vec3 => [
    origin[0] + radius * (axisU[0] * Math.cos(angle) + axisV[0] * Math.sin(angle)),
    origin[1] + radius * (axisU[1] * Math.cos(angle) + axisV[1] * Math.sin(angle)),
    origin[2] + radius * (axisU[2] * Math.cos(angle) + axisV[2] * Math.sin(angle)),
  ]

  for (let side = 0; side < sides; side++) {
    const angle = side / sides * TAU
    const nextAngle = (side + 1) / sides * TAU
    addFace(mesh, [point(start, angle), point(start, nextAngle), point(end, nextAngle), point(end, angle)])
  }
}

function random(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function addCantonTower(mesh: MeshData) {
  const east = 350
  const north = -1550
  const levels = 20
  const columns = 24
  const point = (level: number, column: number): Vec3 => {
    const height = level / levels * 450
    const waist = (height - 225) / 225
    const radius = Math.sqrt(22 ** 2 + (waist * 49) ** 2)
    const angle = column / columns * TAU + height / 450 * 1.1
    return [east + Math.cos(angle) * radius, height, -north + Math.sin(angle) * radius]
  }

  // 两组对角杆交织出镂空双曲面；没有实心圆柱挡住背面的格构。
  for (let level = 0; level < levels; level++) {
    for (let column = 0; column < columns; column++) {
      addRod(mesh, point(level, column), point(level + 1, column + 1), 1.65)
      addRod(mesh, point(level, column + 1), point(level + 1, column), 1.65)
      if (level % 2 === 0) addRod(mesh, point(level, column), point(level, column + 1), 1.35)
    }
  }
  for (let column = 0; column < columns; column++) {
    addRod(mesh, point(levels, column), point(levels, column + 1), 2.6)
  }
  addTower(mesh, east, north, [
    { height: 445, radiusX: 40, radiusZ: 40 },
    { height: 458, radiusX: 40, radiusZ: 40 },
  ], 24)
  addRod(mesh, [east, 458, -north], [east, 600, -north], 2.4, 8)
  for (let height = 470; height < 565; height += 18) {
    const width = (580 - height) / 8
    addBox(mesh, east, north, width, width, height, height + 1.7)
  }
}

function addOperaHouse(mesh: MeshData, east: number, north: number, scale: number) {
  const base: Vec3[] = [
    [east - 80 * scale, 3, -north - 46 * scale],
    [east + 18 * scale, 3, -north - 64 * scale],
    [east + 88 * scale, 3, -north - 12 * scale],
    [east + 67 * scale, 3, -north + 59 * scale],
    [east - 56 * scale, 3, -north + 49 * scale],
  ]
  const crown: Vec3 = [east + 9 * scale, 45 * scale, -north + 3 * scale]
  for (let index = 0; index < base.length; index++) {
    addFace(mesh, [base[index]!, crown, base[(index + 1) % base.length]!])
  }
}

export function createCityModel(): { url: string; buildingCount: number; dispose: () => void } {
  const cyan = createMesh()
  const white = createMesh()
  const orange = createMesh()
  let buildingCount = 0

  // 可复现的街区：中央花城广场留空，普通建筑不进入珠江河道。
  for (let row = 0; row < 15; row++) {
    for (let column = 0; column < 19; column++) {
      const seed = row * 29 + column + 1
      const east = (column - 9) * 147 + (random(seed) - 0.5) * 22
      const north = row * 150 - 620 + (random(seed + 21) - 0.5) * 22
      if (Math.abs(east) < 190 && north < 1000) continue
      if (east > 270 && east < 540 && north > 120 && north < 460) continue
      if (east > -315 && east < 20 && north > 200 && north < 550) continue
      if (north < -330 && east > -420 && east < 700) continue
      if (random(seed + 7) > 0.95) continue

      const width = 48 + random(seed + 12) * 43
      const depth = 42 + random(seed + 23) * 44
      const height = 24 + random(seed + 45) ** 1.9 * 120
      addBox(cyan, east, north, width + 17, depth + 14, 0, 9 + random(seed + 36) * 9)

      if (seed % 7 === 0) {
        addTower(cyan, east, north, [
          { height: 0, radiusX: width * 0.55, radiusZ: depth * 0.55 },
          { height, radiusX: width * 0.55, radiusZ: depth * 0.55 },
        ], 8)
      } else {
        addBox(cyan, east, north, width, depth, 0, height)
        if (seed % 4 === 0) addBox(cyan, east + 7, north, width * 0.72, depth * 0.76, height, height + 15)
        if (seed % 5 === 0) addBox(cyan, east - width * 0.35, north + depth * 0.32, width * 0.42, depth * 0.42, height, height + 7)
      }
      buildingCount++
    }
  }

  // 河南岸采用较低密度，给广州塔及滨江步道留出视线。
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 14; column++) {
      const seed = 900 + row * 19 + column
      const east = (column - 6.5) * 181
      const north = -1420 - row * 175
      if (Math.abs(east - 350) < 235 && north > -1790) continue
      const width = 55 + random(seed) * 45
      const depth = 50 + random(seed + 2) * 55
      addBox(cyan, east, north, width, depth, 0, 25 + random(seed + 5) * 95)
      buildingCount++
    }
  }

  // 东塔（周大福金融中心）：分层收束的530m天际线。
  addBox(white, 400, 300, 140, 130, 0, 31)
  addTower(white, 400, 300, [
    { height: 0, radiusX: 58, radiusZ: 55 },
    { height: 350, radiusX: 58, radiusZ: 55 },
    { height: 350, radiusX: 48, radiusZ: 45 },
    { height: 455, radiusX: 48, radiusZ: 45 },
    { height: 455, radiusX: 36, radiusZ: 34 },
    { height: 530, radiusX: 36, radiusZ: 34 },
  ])

  // 西塔（国际金融中心）：六边截面与顶部收束。
  addTower(white, -150, 360, [
    { height: 0, radiusX: 66, radiusZ: 60 },
    { height: 75, radiusX: 68, radiusZ: 62 },
    { height: 330, radiusX: 58, radiusZ: 54 },
    { height: 415, radiusX: 44, radiusZ: 42 },
    { height: 440, radiusX: 24, radiusZ: 25 },
  ], 12)

  // 广州银行与双子塔，交错排布形成有层次的高层群。
  const landmarks = [
    { east: -375, north: 185, height: 285, width: 55, depth: 67 },
    { east: -320, north: 645, height: 310, width: 51, depth: 48 },
    { east: 620, north: 515, height: 272, width: 61, depth: 50 },
    { east: 590, north: 95, height: 240, width: 52, depth: 60 },
    { east: -450, north: -130, height: 215, width: 43, depth: 54 },
    { east: 670, north: -130, height: 192, width: 40, depth: 55 },
  ]
  for (const landmark of landmarks) {
    addBox(white, landmark.east, landmark.north, landmark.width + 25, landmark.depth + 25, 0, 19)
    addBox(white, landmark.east, landmark.north, landmark.width, landmark.depth, 0, landmark.height)
    addBox(white, landmark.east, landmark.north, landmark.width * 0.7, landmark.depth * 0.78, landmark.height, landmark.height + 18)
  }

  // 曲线轮廓的高层以多级椭圆环逼近，Shader 窗格仍能跟随真实表面。
  const curvedRings: Ring[] = []
  for (let level = 0; level <= 12; level++) {
    const t = level / 12
    curvedRings.push({ height: t * 260, radiusX: 75 - 19 * Math.sin(t * Math.PI), radiusZ: 39 + t * 5, rotation: t * 0.3 })
  }
  addTower(white, -520, 490, curvedRings, 16)

  addOperaHouse(white, -180, -450, 1)
  addOperaHouse(white, -300, -445, 0.64)

  // 图书馆的错层立面、博物馆的悬浮红盒子轮廓（统一冷白材质）。
  for (let level = 0; level < 6; level++) {
    addBox(white, 500 + (level % 2 === 0 ? 9 : -9), -450, 112, 90, level * 9, (level + 1) * 9)
  }
  addBox(white, 710, -420, 84, 75, 0, 12)
  addBox(white, 710, -420, 133, 105, 12, 47)
  addCantonTower(orange)
  buildingCount += 14

  const meshes = [cyan, white, orange]
  const bufferViews: { buffer: number; byteOffset: number; byteLength: number; target: number }[] = []
  const accessors: object[] = []
  const chunks: ArrayBuffer[] = []
  let byteLength = 0

  function addAccessor(array: Float32Array | Uint32Array, type: 'VEC3' | 'SCALAR', target: number, bounds?: { min: number[]; max: number[] }) {
    const bufferView = bufferViews.length
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: array.byteLength, target })
    chunks.push(array.buffer as ArrayBuffer)
    byteLength += array.byteLength
    const index = accessors.length
    accessors.push({ bufferView, componentType: array instanceof Float32Array ? 5126 : 5125, count: array.length / (type === 'VEC3' ? 3 : 1), type, ...bounds })
    return index
  }

  const primitives = meshes.map((mesh, material) => {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let index = 0; index < mesh.positions.length; index++) {
      const axis = index % 3
      min[axis] = Math.min(min[axis]!, mesh.positions[index]!)
      max[axis] = Math.max(max[axis]!, mesh.positions[index]!)
    }
    const position = addAccessor(new Float32Array(mesh.positions), 'VEC3', 34962, { min, max })
    const normal = addAccessor(new Float32Array(mesh.normals), 'VEC3', 34962)
    const indices = addAccessor(new Uint32Array(mesh.indices), 'SCALAR', 34963)
    return { attributes: { POSITION: position, NORMAL: normal }, indices, material }
  })

  const binary = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    binary.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }
  // 分块编码避免大型数组展开触发浏览器参数数量上限。
  let binaryString = ''
  for (let start = 0; start < binary.length; start += 16384) {
    binaryString += String.fromCharCode(...binary.subarray(start, start + 16384))
  }

  const gltf = {
    asset: { version: '2.0', generator: 'Shader Lab · procedural Zhujiang New Town' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Zhujiang New Town' }],
    meshes: [{ primitives }],
    materials: [
      { name: 'city-cyan', pbrMetallicRoughness: { baseColorFactor: [0.035, 0.5, 0.92, 1], metallicFactor: 0, roughnessFactor: 1 } },
      { name: 'landmark-white', pbrMetallicRoughness: { baseColorFactor: [0.82, 0.9, 0.98, 1], metallicFactor: 0, roughnessFactor: 1 } },
      { name: 'canton-tower-orange', pbrMetallicRoughness: { baseColorFactor: [1, 0.25, 0.015, 1], metallicFactor: 0, roughnessFactor: 1 } },
    ],
    buffers: [{ uri: `data:application/octet-stream;base64,${btoa(binaryString)}`, byteLength }],
    bufferViews,
    accessors,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' }))
  return { url, buildingCount, dispose: () => URL.revokeObjectURL(url) }
}
