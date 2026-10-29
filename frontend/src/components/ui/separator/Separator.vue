<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: HTMLAttributes['class']; orientation?: 'horizontal' | 'vertical' }>()
</script>

<template>
  <div
    role="separator"
    :class="cn('shrink-0 bg-border', orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full', props.class)"
  />
</template>
