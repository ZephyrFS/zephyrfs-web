<template>
  <div class="upload-progress bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center space-x-3 flex-1 min-w-0">
        <!-- Status icon -->
        <div class="flex-shrink-0">
          <div
            v-if="upload.status === 'uploading'"
            class="spinner w-4 h-4"
          ></div>
          <CheckCircleIcon
            v-else-if="upload.status === 'completed'"
            class="w-5 h-5 text-green-500"
          />
          <ExclamationCircleIcon
            v-else-if="upload.status === 'error'"
            class="w-5 h-5 text-red-500"
          />
        </div>

        <!-- File info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {{ upload.filename }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ getStatusText() }}
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2">
        <!-- Progress percentage -->
        <span
          v-if="upload.status === 'uploading'"
          class="text-sm text-gray-600 dark:text-gray-400 tabular-nums"
        >
          {{ Math.round(upload.progress) }}%
        </span>

        <!-- Cancel/Remove button -->
        <button
          @click="handleAction"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
          :title="upload.status === 'uploading' ? 'Cancel upload' : 'Remove'"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div
      v-if="upload.status === 'uploading'"
      class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
    >
      <div
        class="progress-bar h-full bg-primary-600 transition-all duration-300 ease-out"
        :style="{ width: `${upload.progress}%` }"
      ></div>
    </div>

    <!-- Error message -->
    <div
      v-if="upload.status === 'error' && upload.error"
      class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
    >
      <p class="text-sm text-red-600 dark:text-red-400">
        {{ upload.error }}
      </p>
    </div>

    <!-- Completed message -->
    <div
      v-if="upload.status === 'completed'"
      class="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md"
    >
      <p class="text-sm text-green-600 dark:text-green-400">
        Upload completed successfully
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'

interface UploadProgress {
  fileId: string
  filename: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

// Props
const props = defineProps<{
  upload: UploadProgress
}>()

// Emits
const emit = defineEmits<{
  cancel: [fileId: string]
  remove: [fileId: string]
}>()

function getStatusText(): string {
  switch (props.upload.status) {
    case 'uploading':
      return 'Uploading...'
    case 'completed':
      return 'Upload completed'
    case 'error':
      return 'Upload failed'
    default:
      return ''
  }
}

function handleAction() {
  if (props.upload.status === 'uploading') {
    emit('cancel', props.upload.fileId)
  } else {
    emit('remove', props.upload.fileId)
  }
}
</script>

<style scoped>
.progress-bar {
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
}

.spinner {
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>