/** 用透明 Canvas 绘制悬浮站点 HUD，交给 Cesium Billboard 作为本地纹理。 */
export function createStationBadge(name: string, index: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 116
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const outline = () => {
    context.beginPath()
    context.moveTo(20, 5)
    context.lineTo(369, 5)
    context.lineTo(395, 31)
    context.lineTo(395, 95)
    context.lineTo(379, 111)
    context.lineTo(5, 111)
    context.lineTo(5, 20)
    context.closePath()
  }

  // 暗底保证中文可读，切角与细边只暗示全息面板，避免盖住城市主体。
  const background = context.createLinearGradient(0, 0, 400, 116)
  background.addColorStop(0, 'rgba(10, 30, 48, 0.96)')
  background.addColorStop(0.62, 'rgba(11, 35, 55, 0.91)')
  background.addColorStop(1, 'rgba(8, 26, 43, 0.96)')
  outline()
  context.fillStyle = background
  context.fill()
  context.strokeStyle = color
  context.lineWidth = 1.4
  context.globalAlpha = 0.65
  context.stroke()
  context.globalAlpha = 1

  context.save()
  outline()
  context.clip()
  const sheen = context.createLinearGradient(0, 0, 0, 116)
  sheen.addColorStop(0, 'rgba(128, 229, 255, 0.08)')
  sheen.addColorStop(0.5, 'rgba(128, 229, 255, 0)')
  sheen.addColorStop(1, 'rgba(128, 229, 255, 0.015)')
  context.fillStyle = sheen
  context.fillRect(0, 0, 400, 116)
  context.restore()

  context.strokeStyle = color
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(21, 5)
  context.lineTo(91, 5)
  context.moveTo(5, 36)
  context.lineTo(5, 82)
  context.moveTo(339, 111)
  context.lineTo(378, 111)
  context.stroke()

  context.textBaseline = 'middle'
  context.fillStyle = color
  context.font = '13px Consolas, monospace'
  context.fillText(`NODE ${String(index + 1).padStart(2, '0')}`, 25, 28)
  context.fillStyle = 'rgba(133, 176, 198, 0.72)'
  context.font = '10px Consolas, monospace'
  context.fillText('SIGNAL ACTIVE', 126, 28)

  context.fillStyle = '#d8f5ff'
  let fontSize = 34
  context.font = `500 ${fontSize}px "Microsoft YaHei", sans-serif`
  while (context.measureText(name).width > 286 && fontSize > 19) {
    fontSize--
    context.font = `500 ${fontSize}px "Microsoft YaHei", sans-serif`
  }
  context.fillText(name, 24, 66)

  // 右侧信号柱和底部标尺属于静态装饰，动画由场景中的光柱和轨道承担。
  for (let bar = 0; bar < 4; bar++) {
    const height = 10 + bar * 7
    context.fillStyle = color
    context.globalAlpha = 0.36 + bar * 0.18
    context.fillRect(337 + bar * 10, 79 - height, 5, height)
  }
  context.globalAlpha = 1
  context.fillStyle = color
  context.beginPath()
  context.arc(369, 28, 3, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = 'rgba(121, 181, 207, 0.3)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(24, 94)
  context.lineTo(318, 94)
  for (let tick = 0; tick < 29; tick++) {
    const x = 25 + tick * 10
    context.moveTo(x, 95)
    context.lineTo(x, tick % 5 === 0 ? 101 : 98)
  }
  context.stroke()
  context.fillStyle = color
  context.globalAlpha = 0.7
  context.fillRect(25, 94, 53 + index * 19, 1)
  context.globalAlpha = 1

  return canvas
}
