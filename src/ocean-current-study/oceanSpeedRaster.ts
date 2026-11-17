import type { OceanJson } from './oceanData'

function getSpeedColor(speed: number): string {
    if (speed < 0.025) return '#182b51' // 深蓝
    if (speed < 0.05) return '#21447d'  // 蓝
    if (speed < 0.08) return '#26749f'  // 青蓝
    if (speed < 0.12) return '#27a19b'  // 青绿
    if (speed < 0.18) return '#54b98c'  // 绿
    if (speed < 0.24) return '#4983bf'  // 亮蓝
    if (speed < 0.30) return '#7e64c6'  // 粉紫
    return '#ef4444'                    // 红
}

export function createOceanSpeedImage(data: OceanJson): string {
    const { width, height, u, v, validMask } = data
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建 Canvas 2D 绘图环境')

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const index = row * width + col
            if (validMask?.[index] === 0) continue

            const speed = Math.hypot(u.array[index], v.array[index])
            context.fillStyle = getSpeedColor(speed)
            context.fillRect(col, row, 1, 1)
        }
    }

    return canvas.toDataURL('image/png')
}