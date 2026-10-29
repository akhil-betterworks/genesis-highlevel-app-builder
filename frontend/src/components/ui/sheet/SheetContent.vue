<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: HTMLAttributes['class']; side?: 'left' | 'right' }>(), { side: 'right' })
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      :class="
        cn(
          'fixed inset-y-0 z-50 flex h-full w-full flex-col gap-4 border-l bg-card p-6 shadow-2xl transition ease-in-out sm:max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'right'
            ? 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
            : 'left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
