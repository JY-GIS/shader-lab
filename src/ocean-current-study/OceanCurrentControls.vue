<script setup lang="ts">
import { ref } from 'vue'
import type { WindLayerOptions } from 'cesium-wind-layer'

const props = defineProps<{ options: WindLayerOptions; screenSizedTrails: boolean }>()
const zoomAdaptive = defineModel<boolean>('zoomAdaptive', { required: true })
const emit = defineEmits<{
  updateOptions: [changes: Partial<WindLayerOptions>]
  zoomToOverview: []
}>()
const initialOptions = props.options

type NumberKey = 'particleHeight' | 'speedFactor' | 'particlesTextureSize' | 'dropRate' | 'dropRateBump'
type RangeKey = 'lineWidth' | 'lineLength' | 'domain' | 'displayRange'
type Edge = 'min' | 'max'

interface SliderScale {
  label: string
  min: number
  max: number
  step: number
}

const numberFields: (SliderScale & { key: NumberKey })[] = [
  { key: 'particleHeight', label: '粒子高度 (m)', min: 0, max: 2000, step: 10 },
  { key: 'speedFactor', label: '动画速度', min: 0.1, max: 12, step: 0.1 },
  { key: 'particlesTextureSize', label: '粒子密度', min: 16, max: 240, step: 1 },
  { key: 'dropRate', label: '基础重置概率', min: 0, max: 0.05, step: 0.001 },
  { key: 'dropRateBump', label: '慢速额外重置概率', min: 0, max: 0.1, step: 0.001 },
]

const rangeFields: (SliderScale & { key: RangeKey })[] = [
  { key: 'lineWidth', label: '尾迹宽度', min: 0.5, max: 8, step: 0.1 },
  { key: 'lineLength', label: '尾迹长度', min: 1, max: 400, step: 1 },
  { key: 'domain', label: '流速映射 (m/s)', min: 0, max: 3, step: 0.005 },
  { key: 'displayRange', label: '可见流速 (m/s)', min: 0, max: 3, step: 0.005 },
]

const switches = [
  { key: 'dynamic', label: '播放粒子动画' },
  { key: 'useViewerBounds', label: '在当前视野内生成粒子' },
] as const

const edges = [
  { key: 'min', label: '最小' },
  { key: 'max', label: '最大' },
] as const

const densityDraft = ref<number>()

function numberValue(key: NumberKey) {
  return key === 'particlesTextureSize'
    ? densityDraft.value ?? props.options.particlesTextureSize
    : props.options[key]
}

function changeNumber(key: NumberKey, event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (key === 'particlesTextureSize') {
    densityDraft.value = value
    return
  }
  emit('updateOptions', { [key]: value })
}

function commitDensity(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (value !== props.options.particlesTextureSize) {
    emit('updateOptions', { particlesTextureSize: value })
  }
  densityDraft.value = undefined
}

function rangeValue(field: SliderScale & { key: RangeKey }, edge: Edge) {
  return props.options[field.key]?.[edge] ?? field[edge]
}

function changeRange(field: SliderScale & { key: RangeKey }, edge: Edge, event: Event) {
  const input = event.target as HTMLInputElement
  const min = rangeValue(field, 'min')
  const max = rangeValue(field, 'max')
  const gap = field.key === 'domain' || field.key === 'displayRange' ? field.step : 0
  const value = edge === 'min'
    ? Math.min(input.valueAsNumber, max - gap)
    : Math.max(input.valueAsNumber, min + gap)
  input.value = String(value)
  emit('updateOptions', { [field.key]: { min, max, [edge]: value } })
}

function changeColorMode(event: Event) {
  const mode = (event.target as HTMLSelectElement).value
  const current = props.options.colors[0] ?? '#cccccc'
  emit('updateOptions', { colors: mode === 'gradient' ? ['#326be3', '#44dcd4', '#ffe580'] : [current] })
}

function changeColor(index: number, event: Event) {
  const colors = [...props.options.colors]
  colors[index] = (event.target as HTMLInputElement).value
  emit('updateOptions', { colors })
}
</script>

<template>
  <details class="ocean-controls" open>
    <summary>洋流控制</summary>
    <div class="controls-body">
      <div class="view-controls">
        <button type="button" @click="emit('zoomToOverview')">回到全景</button>
        <label v-if="screenSizedTrails">
          <input v-model="zoomAdaptive" type="checkbox" />
          随缩放调整尾迹
        </label>
      </div>
      <div class="switches">
        <label v-for="toggle in switches" :key="toggle.key">
          <input
            type="checkbox"
            :checked="options[toggle.key]"
            @change="emit('updateOptions', { [toggle.key]: ($event.target as HTMLInputElement).checked })"
          />
          <span>{{ toggle.label }}</span>
          <small class="initial">初始 {{ initialOptions[toggle.key] ? '开启' : '关闭' }}</small>
        </label>
      </div>

      <div class="color-row">
        <label for="ocean-color-mode">尾迹颜色</label>
        <select
          id="ocean-color-mode"
          :value="options.colors.length > 1 ? 'gradient' : 'solid'"
          @change="changeColorMode"
        >
          <option value="solid">单色</option>
          <option value="gradient">按流速渐变</option>
        </select>
        <div class="swatches">
          <input
            v-for="(color, index) in options.colors"
            :key="index"
            type="color"
            :aria-label="options.colors.length > 1 ? ['低速颜色', '中速颜色', '高速颜色'][index] : '粒子颜色'"
            :value="color"
            @input="changeColor(index, $event)"
          />
        </div>
        <small class="initial initial-color">
          初始 {{ initialOptions.colors.length > 1 ? '渐变' : '单色' }} · {{ initialOptions.colors.join(' / ') }}
        </small>
      </div>

      <label v-for="field in numberFields" :key="field.key" class="slider">
        <span>{{ field.label }}</span>
        <input
          type="range"
          :aria-label="field.label"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :value="numberValue(field.key)"
          @input="changeNumber(field.key, $event)"
          @change="field.key === 'particlesTextureSize' && commitDensity($event)"
        />
        <span class="slider-values">
          <output>{{ numberValue(field.key) }}</output>
          <small class="initial">初始 {{ initialOptions[field.key] }}</small>
        </span>
      </label>
      <small class="density-note">最多 {{ (numberValue('particlesTextureSize') ** 2).toLocaleString() }} 个粒子 · 松手应用密度</small>

      <fieldset v-for="field in rangeFields" :key="field.key">
        <legend>{{ field.label }}{{ screenSizedTrails && (field.key === 'lineWidth' || field.key === 'lineLength') ? ' (全景 px)' : '' }}</legend>
        <label v-for="edge in edges" :key="edge.key" class="slider">
          <span>{{ edge.label }}</span>
          <input
            type="range"
            :aria-label="`${field.label} ${edge.label}`"
            :min="field.min"
            :max="screenSizedTrails && field.key === 'lineLength' ? 60 : field.max"
            :step="field.step"
            :value="rangeValue(field, edge.key)"
            @input="changeRange(field, edge.key, $event)"
          />
          <span class="slider-values">
            <output>{{ Number(rangeValue(field, edge.key).toFixed(3)) }}</output>
            <small class="initial">初始 {{ Number((initialOptions[field.key]?.[edge.key] ?? field[edge.key]).toFixed(3)) }}</small>
          </span>
        </label>
      </fieldset>
    </div>
  </details>
</template>

<style scoped>
.ocean-controls {
  position: absolute;
  z-index: 1;
  top: 12px;
  left: 12px;
  width: min(292px, calc(100% - 24px));
  max-height: calc(100% - 40px);
  overflow: auto;
  color: #edf4fc;
  background: #152538ed;
  border: 1px solid #54718a;
  border-radius: 8px;
  box-shadow: 0 4px 18px #09162455;
  font-size: 12px;
}

summary {
  position: sticky;
  top: 0;
  padding: 10px 12px;
  background: #213951;
  font-weight: 700;
  cursor: pointer;
}

.controls-body { display: grid; gap: 8px; padding: 10px 12px; }
.view-controls, .view-controls label { display: flex; align-items: center; gap: 6px; }
.view-controls { justify-content: space-between; }
.view-controls button { color: inherit; background: #213951; border: 1px solid #54718a; border-radius: 4px; padding: 4px 7px; font: inherit; cursor: pointer; }
.switches { display: grid; gap: 5px; }
.switches label, .color-row, .swatches { display: flex; align-items: center; gap: 6px; }
.color-row { flex-wrap: wrap; }
.initial { color: #b9cce0; font-size: 11px; }
.switches .initial { margin-left: auto; }
.initial-color { flex-basis: 100%; }
input { accent-color: #68b9f7; }
input[type='color'] { width: 25px; height: 24px; padding: 0; border: 0; background: transparent; }
select { color: inherit; background: #213951; border: 1px solid #54718a; border-radius: 4px; padding: 3px; font: inherit; }
.slider { display: grid; grid-template-columns: minmax(50px, auto) minmax(32px, 1fr) 64px; align-items: center; gap: 6px; }
.slider input { width: 100%; min-width: 0; margin: 0; }
.slider-values { display: grid; text-align: right; font-variant-numeric: tabular-nums; }
.density-note { color: #b9cce0; }
fieldset { min-width: 0; margin: 0; padding: 5px 7px; border: 1px solid #54718a; border-radius: 4px; }
legend { padding: 0 4px; color: #c8e1f7; }
</style>
