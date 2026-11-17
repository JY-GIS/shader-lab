import { Cartesian2, SceneMode } from 'cesium'
import type { WindLayer } from 'cesium-wind-layer'
import trailVertexMain from './oceanTrailMain.glsl?raw'

type SegmentPrimitive = {
  vertexShaderSource?: { sources: string[] }
  uniformMap?: {
    oceanTrailViewport?: () => Cartesian2
    oceanTrailScale?: () => Cartesian2
  }
  commandToExecute?: unknown
}

const nearHeightRatio = 0.01
const nearWidthScale = 0.9
const nearLengthScale = 0.82

export function applyOceanTrailStyle(
  layer: WindLayer,
  zoomAdaptive: () => boolean
) {
  // 0.10.1 has no render hook. Use its per-layer shader before the first draw.
  const { particleSystem } = layer as unknown as {
    particleSystem?: {
      rendering?: {
        primitives?: {
          segments?: SegmentPrimitive
        }
      }
    }
  }
  const segments = particleSystem?.rendering?.primitives?.segments
  const vertexShader = segments?.vertexShaderSource
  const source = vertexShader?.sources?.[0]
  const mainStart = source?.indexOf('\nvec4 calculateOffsetOnNormalDirection(') ?? -1
  if (!segments?.uniformMap || !vertexShader || !source || mainStart < 0 || segments.commandToExecute) {
    return false
  }

  const { camera, canvas } = layer.viewer.scene
  const overviewHeight = camera.positionCartographic.height
  const viewport = new Cartesian2()
  const trailScale = new Cartesian2()

  segments.uniformMap.oceanTrailViewport = () => Cartesian2.fromElements(
    Math.max(canvas.clientWidth, 1), Math.max(canvas.clientHeight, 1), viewport,
  )
  segments.uniformMap.oceanTrailScale = () => {
    if (!zoomAdaptive() || layer.scene.mode !== SceneMode.SCENE3D || overviewHeight <= 0) {
      return Cartesian2.fromElements(1, 1, trailScale)
    }

    const heightRatio = camera.positionCartographic.height / overviewHeight
    const clampedRatio = Math.max(nearHeightRatio, Math.min(1, heightRatio))
    const progress = Math.log(clampedRatio) / Math.log(nearHeightRatio)
    const eased = progress * progress * (3 - 2 * progress)

    return Cartesian2.fromElements(
      1 + (nearWidthScale - 1) * eased,
      1 + (nearLengthScale - 1) * eased,
      trailScale,
    )
  }

  vertexShader.sources[0] = `${source.slice(0, mainStart)}\n${trailVertexMain}`
  return true
}
