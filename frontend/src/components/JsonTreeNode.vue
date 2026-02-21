<script setup>
import { computed, ref } from 'vue';

defineOptions({
  name: 'JsonTreeNode'
});

const props = defineProps({
  value: {
    type: null,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  depth: {
    type: Number,
    default: 0
  }
});

const expanded = ref(props.depth === 0);

const isArrayValue = computed(() => Array.isArray(props.value));
const isObjectValue = computed(() => props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value));
const isContainer = computed(() => isArrayValue.value || isObjectValue.value);

const childEntries = computed(() => {
  if (isArrayValue.value) {
    return props.value.map((item, index) => ({
      key: String(index),
      value: item
    }));
  }

  if (isObjectValue.value) {
    return Object.entries(props.value).map(([key, value]) => ({ key, value }));
  }

  return [];
});

const valueSummary = computed(() => {
  if (isArrayValue.value) {
    return `Array(${props.value.length})`;
  }

  if (isObjectValue.value) {
    return `Object(${childEntries.value.length})`;
  }

  if (props.value === null) {
    return 'null';
  }

  return JSON.stringify(props.value);
});
</script>

<template>
  <div class="json-node">
    <div class="json-node-line">
      <button v-if="isContainer" type="button" class="json-toggle" @click="expanded = !expanded">
        {{ expanded ? '▾' : '▸' }}
      </button>
      <span v-else class="json-toggle-placeholder"></span>

      <span v-if="label" class="json-key">{{ label }}:</span>
      <span :class="isContainer ? 'json-type' : 'json-value'">{{ valueSummary }}</span>
    </div>

    <div v-if="isContainer && expanded" class="json-children">
      <JsonTreeNode
        v-for="entry in childEntries"
        :key="entry.key"
        :label="entry.key"
        :value="entry.value"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.json-node-line {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  line-height: 1.45;
}

.json-toggle {
  border: 0;
  background: transparent;
  padding: 0;
  width: 1rem;
  min-width: 1rem;
  cursor: pointer;
}

.json-toggle-placeholder {
  width: 1rem;
  min-width: 1rem;
}

.json-key {
  font-weight: 600;
}

.json-type {
  color: #3b3b3b;
}

.json-value {
  white-space: pre-wrap;
  word-break: break-word;
}

.json-children {
  margin-left: 1rem;
}
</style>
