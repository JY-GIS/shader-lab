export type OceanJson = {
    width: number
    height: number
    bbox: [west: number, south: number, east: number, north: number]
    u: { array: number[]; min: number; max: number }
    v: { array: number[]; min: number; max: number }
    validMask?: number[]
}