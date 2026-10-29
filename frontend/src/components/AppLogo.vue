<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <RouterLink to="/" class="group inline-flex items-center gap-2.5">
    <span
      :class="[
        'relative grid place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 transition-transform group-hover:rotate-6',
        size === 'sm' ? 'size-7' : 'size-9',
      ]"
    >
      <svg viewBox="0 0 24 24" :class="size === 'sm' ? 'size-3.5' : 'size-4'" fill="white"><path d="M5 18 12 5l7 13H5Z" /></svg>
    </span>
    <span :class="['font-semibold tracking-tight', size === 'sm' ? 'text-sm' : 'text-lg']">
      Genesis <span class="font-normal text-muted-foreground">for HighLevel</span>
    </span>
  </RouterLink>
</template>
