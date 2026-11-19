<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { OceanFrame } from './oceanData'

const props = defineProps<{
  frames: OceanFrame[]
  currentIndex: number
  loading: boolean
  loadingIndex: number
  error: string
  playing: boolean
}>()
const emit = defineEmits<{
  select: [index: number]
  togglePlayback: []
  pause: []
}>()
const selectedIndex = ref(0)
const ticks = computed(() => props.frames.filter((_, index) =>
  index % 6 === 0 || index === props.frames.length - 1,
))

watch(() => props.currentIndex, (index) => {
  selectedIndex.value = Math.max(index, 0)
})

function formatTime(index: number) {
  return props.frames[index]?.time.replace('T', ' ').replace(':00Z', ' UTC') ?? '尚未加载'
}
</script>

<template>
  <div class="ocean-time">
    <div class="playback">
      <button
        type="button"
        :disabled="!playing && (loading || currentIndex < 0)"
        :aria-pressed="playing"
        @click="emit('togglePlayback')"
      >{{ playing ? '暂停' : '播放' }}</button>
      <span>每 5 秒切换一小时</span>
    </div>
    <div class="time-labels">
      <span>当前画面 · {{ formatTime(currentIndex) }}</span>
      <span v-if="loading" role="status">正在加载 {{ formatTime(loadingIndex) }}</span>
      <span v-else>选择 · {{ formatTime(selectedIndex) }}</span>
    </div>
    <input
      v-model.number="selectedIndex"
      type="range"
      aria-label="海流时间"
      :aria-valuetext="formatTime(selectedIndex)"
      min="0"
      :max="frames.length - 1"
      step="1"
      @pointerdown="emit('pause')"
      @input="emit('pause')"
      @change="emit('select', selectedIndex)"
    />
    <div class="time-ticks">
      <span v-for="frame in ticks" :key="frame.time">{{ frame.time.slice(5, 16).replace('T', ' ') }}</span>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.ocean-time {
  position: absolute;
  bottom: 32px;
  right: 16px;
  width: min(400px, calc(100% - 32px));
  padding: 10px 14px;
  border-radius: 6px;
  color: #edf4fc;
  background: #152538ed;
  font-size: 12px;
}
.time-labels, .time-ticks { display: flex; justify-content: space-between; gap: 8px; }
.time-labels { flex-wrap: wrap; }
.playback { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; color: #b9cce0; }
button { padding: 4px 8px; border: 1px solid #54718a; border-radius: 4px; background: #213951; color: #edf4fc; font: inherit; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
input { width: 100%; margin: 10px 0 4px; accent-color: #68b9f7; }
.time-ticks { color: #b9cce0; font-size: 10px; }
p { margin: 6px 0 0; color: #ffb6ad; }
</style>
