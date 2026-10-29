<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div :class="cn('rounded-xl border bg-card/70 text-card-foreground shadow-sm backdrop-blur', props.class)"><slot /></div>
</template>
