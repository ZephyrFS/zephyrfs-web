<template>
  <div class="json-viewer">
    <div class="json-content text-sm font-mono">
      <JsonNode
        :data="data"
        :key-name="''"
        :level="0"
        :is-root="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'

interface Props {
  data: any
}

defineProps<Props>()

// Recursive JSON node component
const JsonNode = defineComponent({
  name: 'JsonNode',
  props: {
    data: { required: true },
    keyName: { type: String, default: '' },
    level: { type: Number, default: 0 },
    isRoot: { type: Boolean, default: false },
  },
  data() {
    return {
      collapsed: this.level > 2, // Auto-collapse deep objects
    }
  },
  computed: {
    dataType() {
      if (this.data === null) return 'null'
      if (Array.isArray(this.data)) return 'array'
      return typeof this.data
    },
    isCollapsible() {
      return this.dataType === 'object' || this.dataType === 'array'
    },
    keys() {
      if (this.dataType === 'object') {
        return Object.keys(this.data)
      }
      if (this.dataType === 'array') {
        return this.data.map((_: any, index: number) => index.toString())
      }
      return []
    },
    hasChildren() {
      return this.keys.length > 0
    },
    indentStyle() {
      return {
        paddingLeft: `${this.level * 20}px`,
      }
    },
  },
  methods: {
    toggleCollapse() {
      if (this.isCollapsible) {
        this.collapsed = !this.collapsed
      }
    },
    formatValue(value: any) {
      if (value === null) return 'null'
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'boolean') return value.toString()
      if (typeof value === 'number') return value.toString()
      return String(value)
    },
    getValueClass(value: any) {
      if (value === null) return 'text-gray-500'
      if (typeof value === 'string') return 'text-green-600 dark:text-green-400'
      if (typeof value === 'boolean') return 'text-blue-600 dark:text-blue-400'
      if (typeof value === 'number') return 'text-purple-600 dark:text-purple-400'
      return 'text-gray-700 dark:text-gray-300'
    },
  },
  template: `
    <div class="json-node">
      <div
        v-if="!isRoot"
        class="json-line flex items-start hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1"
        :style="indentStyle"
      >
        <!-- Toggle button -->
        <button
          v-if="isCollapsible"
          @click="toggleCollapse"
          class="flex-shrink-0 w-4 h-4 mt-0.5 mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-90': !collapsed }" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
          </svg>
        </button>
        <span v-else class="w-4 mr-1"></span>

        <!-- Key name -->
        <span v-if="keyName" class="text-blue-700 dark:text-blue-300 mr-2">
          "{{ keyName }}":
        </span>

        <!-- Value for primitives -->
        <span
          v-if="!isCollapsible"
          :class="getValueClass(data)"
        >
          {{ formatValue(data) }}
        </span>

        <!-- Container indicators -->
        <span v-else class="text-gray-600 dark:text-gray-400">
          <span v-if="dataType === 'array'">
            [{{ collapsed ? \`\${keys.length} items\` : '' }}
          </span>
          <span v-else-if="dataType === 'object'">
            {{{ collapsed ? \`\${keys.length} keys\` : '' }}
          </span>
        </span>
      </div>

      <!-- Children -->
      <div v-if="(isRoot || !collapsed) && hasChildren">
        <JsonNode
          v-for="key in keys"
          :key="key"
          :data="data[key]"
          :key-name="key"
          :level="isRoot ? 0 : level + 1"
        />
      </div>

      <!-- Closing brackets -->
      <div
        v-if="(isRoot || !collapsed) && isCollapsible && !isRoot"
        class="text-gray-600 dark:text-gray-400 px-1"
        :style="indentStyle"
      >
        {{ dataType === 'array' ? ']' : '}' }}
      </div>
    </div>
  `,
})
</script>

<style scoped>
.json-viewer {
  @apply text-sm;
}

.json-line {
  @apply py-0.5;
}

.json-content {
  @apply leading-relaxed;
}
</style>