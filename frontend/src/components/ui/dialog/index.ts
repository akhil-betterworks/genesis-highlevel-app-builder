import { defineComponent, h } from 'vue'
import { cn } from '@/lib/utils'

export { DialogRoot as Dialog, DialogTrigger, DialogClose } from 'reka-ui'
export { default as DialogContent } from './DialogContent.vue'
export { default as DialogTitle } from './DialogTitle.vue'
export { default as DialogDescription } from './DialogDescription.vue'

export const DialogHeader = defineComponent({
  props: { class: String },
  setup: (props, { slots }) => () =>
    h('div', { class: cn('flex flex-col gap-1.5 text-left', props.class) }, slots.default?.()),
})

export const DialogFooter = defineComponent({
  props: { class: String },
  setup: (props, { slots }) => () =>
    h('div', { class: cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', props.class) }, slots.default?.()),
})
