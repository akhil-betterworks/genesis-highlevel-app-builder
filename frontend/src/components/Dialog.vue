<template>
  <div v-if="open" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div class="bg-background rounded-lg border border-border shadow-lg max-w-md w-full mx-4">
      <div class="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 class="text-lg font-semibold">
          <slot name="title" />
        </h2>
        <button
          @click="$emit('close')"
          class="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div class="px-6 py-4">
        <slot />
      </div>
      <div v-if="$slots.footer" class="flex gap-2 justify-end px-6 py-4 border-t border-border">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
}>()

defineEmits<{
  close: []
}>()
</script>
