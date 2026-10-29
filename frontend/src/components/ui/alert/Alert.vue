<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg~*]:pl-7 [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-card/60 text-foreground [&>svg]:text-foreground',
        destructive: 'border-red-500/40 bg-red-500/10 text-red-300 [&>svg]:text-red-400',
        warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-400',
        success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 [&>svg]:text-emerald-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

const props = defineProps<{ variant?: VariantProps<typeof alertVariants>['variant']; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div role="alert" :class="cn(alertVariants({ variant }), props.class)"><slot /></div>
</template>
