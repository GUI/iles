<script setup lang="ts">
const props = defineProps<{
  src: string | Record<string, any>[]
}>()

let sources = $computed(() => Array.isArray(props.src) ? props.src : [{ srcset: props.src }])

let img = $computed(() => ({
  sources: sources.slice(0, -1),
  attrs: sources[sources.length - 1],
}))
</script>

<script lang="ts">
export default {
  inheritAttrs: false
}
</script>

<template>
  <picture>
    <source v-for="(source, index) in img.sources" :key="index" :type="source.type" :srcset="source.srcset">
    <img v-bind="{ ...$attrs, ...img.attrs }">
  </picture>
</template>
