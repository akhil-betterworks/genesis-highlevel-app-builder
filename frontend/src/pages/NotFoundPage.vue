<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="aurora grid min-h-screen place-items-center px-6 text-center">
    <div>
      <p class="text-gradient text-7xl font-bold">404</p>
      <p class="mt-3 text-muted-foreground">This page drifted out of orbit.</p>
      <Button as-child variant="outline" class="mt-6"><RouterLink to="/">Go home</RouterLink></Button>
    </div>
  </div>
</template>
