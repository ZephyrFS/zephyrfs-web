<template>
  <Modal @close="$emit('close')">
    <template #title>Create New Folder</template>

    <form @submit.prevent="handleCreate" class="space-y-4">
      <!-- Folder name input -->
      <div>
        <label for="folderName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Folder Name
        </label>
        <input
          id="folderName"
          ref="nameInput"
          v-model="form.name"
          type="text"
          required
          class="input"
          :class="{ 'border-red-500': errors.name }"
          placeholder="Enter folder name"
          @input="validateName"
        />
        <p v-if="errors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">
          {{ errors.name }}
        </p>
      </div>

      <!-- Current path display -->
      <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Create in: <span class="font-mono">{{ displayPath }}</span>
        </p>
      </div>

      <!-- Options -->
      <div class="space-y-3">
        <label class="flex items-center">
          <input
            v-model="form.encrypted"
            type="checkbox"
            class="mr-2 rounded border-gray-300 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Create encrypted folder
          </span>
        </label>

        <div v-if="form.encrypted" class="ml-6 text-xs text-gray-500 dark:text-gray-400">
          All files uploaded to this folder will be automatically encrypted
        </div>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>
    </form>

    <template #footer>
      <button
        type="button"
        @click="$emit('close')"
        class="btn btn-outline mr-3"
      >
        Cancel
      </button>
      <button
        @click="handleCreate"
        :disabled="loading || !isValid"
        class="btn btn-primary"
        :class="{ 'opacity-50 cursor-not-allowed': loading || !isValid }"
      >
        <div v-if="loading" class="spinner w-4 h-4 mr-2"></div>
        {{ loading ? 'Creating...' : 'Create Folder' }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { apiClient } from '@/services/api'
import Modal from './Modal.vue'

interface Props {
  currentPath?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentPath: '/',
})

const emit = defineEmits<{
  close: []
  created: [path: string]
}>()

// Form state
const form = ref({
  name: '',
  encrypted: false,
})

const nameInput = ref<HTMLInputElement>()
const loading = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})

// Computed
const displayPath = computed(() => {
  return props.currentPath === '/' ? '/' : props.currentPath
})

const isValid = computed(() => {
  return form.value.name.trim().length > 0 && !errors.value.name
})

// Methods
function validateName() {
  errors.value.name = ''

  const name = form.value.name.trim()

  if (!name) {
    errors.value.name = 'Folder name is required'
    return
  }

  if (name.length > 255) {
    errors.value.name = 'Folder name must be less than 255 characters'
    return
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  if (invalidChars.test(name)) {
    errors.value.name = 'Folder name contains invalid characters'
    return
  }

  // Check for reserved names
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  if (reservedNames.includes(name.toUpperCase())) {
    errors.value.name = 'This folder name is reserved'
    return
  }

  // Check for names starting/ending with spaces or dots
  if (name.startsWith(' ') || name.endsWith(' ') || name.startsWith('.') || name.endsWith('.')) {
    errors.value.name = 'Folder name cannot start or end with spaces or dots'
    return
  }
}

async function handleCreate() {
  if (!isValid.value || loading.value) return

  loading.value = true
  error.value = ''

  try {
    const folderName = form.value.name.trim()

    // Create folder via API
    await apiClient.request({
      method: 'POST',
      url: '/files/folder',
      data: {
        name: folderName,
        path: props.currentPath,
        encrypted: form.value.encrypted,
      },
    })

    const newPath = props.currentPath === '/' ? `/${folderName}` : `${props.currentPath}/${folderName}`

    emit('created', newPath)
    emit('close')

    // Show success notification
    if (window.$notify) {
      window.$notify.success(`Folder "${folderName}" created successfully`)
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Failed to create folder'
    console.error('Create folder failed:', err)
  } finally {
    loading.value = false
  }
}

// Focus input on mount
onMounted(async () => {
  await nextTick()
  nameInput.value?.focus()
})
</script>