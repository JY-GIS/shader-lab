export type OceanJson = {
    time?: number
    width: number
    height: number
    bbox: [west: number, south: number, east: number, north: number]
    u: { array: number[]; min: number; max: number }
    v: { array: number[]; min: number; max: number }
    validMask?: number[]
}

export type OceanFrame = {
    time: string
    file: string
}
