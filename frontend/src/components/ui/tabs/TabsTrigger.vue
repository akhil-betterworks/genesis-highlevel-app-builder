<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'
const props = defineProps<{ value: string; class?: HTMLAttributes['class']; disabled?: boolean }>()
</script>

<template>
  <TabsTrigger
    :value="value"
    :disabled="disabled"
    :class="
      cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow [&_svg]:size-3.5',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
