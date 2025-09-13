<template>
  <div class="file-upload">
    <!-- Upload area -->
    <div
      ref="uploadArea"
      class="upload-area"
      :class="{
        'drag-over': isDragOver,
        'has-files': selectedFiles.length > 0
      }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />

      <div class="upload-content">
        <CloudArrowUpIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />

        <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Drop files here or click to browse
        </h3>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload files up to {{ formatFileSize(maxFileSize) }}
        </p>

        <div class="flex items-center justify-center space-x-4">
          <button type="button" class="btn btn-primary">
            <FolderOpenIcon class="w-4 h-4 mr-2" />
            Choose Files
          </button>

          <span class="text-gray-400">or</span>

          <label class="flex items-center">
            <input
              v-model="encryptFiles"
              type="checkbox"
              class="mr-2 rounded border-gray-300 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Encrypt files
            </span>
          </label>
        </div>
      </div>

      <!-- Selected files preview -->
      <div v-if="selectedFiles.length > 0" class="selected-files mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Selected Files ({{ selectedFiles.length }})
        </h4>

        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div
            v-for="(file, index) in selectedFiles"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
          >
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <DocumentIcon class="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {{ file.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatFileSize(file.size) }}
                </p>
              </div>
            </div>
            <button
              @click.stop="removeFile(index)"
              class="text-gray-400 hover:text-red-500 p-1"
            >
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Upload controls -->
        <div class="flex items-center justify-between mt-4">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Total: {{ formatFileSize(totalSize) }}
          </div>

          <div class="flex items-center space-x-3">
            <button
              @click="clearFiles"
              class="btn btn-sm btn-outline"
            >
              Clear
            </button>
            <button
              @click="startUpload"
              :disabled="uploading || selectedFiles.length === 0"
              class="btn btn-sm btn-primary"
              :class="{ 'opacity-50 cursor-not-allowed': uploading }"
            >
              <ArrowUpTrayIcon class="w-4 h-4 mr-2" />
              {{ uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="activeUploads.length > 0" class="mt-6">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Upload Progress
      </h4>

      <div class="space-y-3">
        <UploadProgress
          v-for="upload in activeUploads"
          :key="upload.fileId"
          :upload="upload"
          @cancel="cancelUpload(upload.fileId)"
        />
      </div>
    </div>

    <!-- Upload history -->
    <div v-if="completedUploads.length > 0" class="mt-6">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Recent Uploads
        </h4>
        <button
          @click="clearHistory"
          class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          Clear History
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="upload in completedUploads.slice(0, 5)"
          :key="upload.fileId"
          class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
        >
          <div class="flex items-center space-x-3">
            <CheckCircleIcon
              v-if="upload.status === 'completed'"
              class="w-5 h-5 text-green-500"
            />
            <ExclamationCircleIcon
              v-else
              class="w-5 h-5 text-red-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {{ upload.filename }}
            </span>
          </div>
          <button
            @click="removeFromHistory(upload.fileId)"
            class="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useFilesStore } from '@/stores/files'
import { storeToRefs } from 'pinia'
import {
  CloudArrowUpIcon,
  FolderOpenIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline'
import UploadProgress from './UploadProgress.vue'

// Props
interface Props {
  currentPath?: string
  maxFileSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  currentPath: '/',
  maxFileSize: 1024 * 1024 * 1024, // 1GB
})

// Emits
const emit = defineEmits<{
  uploaded: [fileIds: string[]]
  close: []
}>()

// Store
const filesStore = useFilesStore()
const { uploads } = storeToRefs(filesStore)

// Reactive state
const fileInput = ref<HTMLInputElement>()
const uploadArea = ref<HTMLDivElement>()
const selectedFiles = ref<File[]>([])
const isDragOver = ref(false)
const encryptFiles = ref(false)
const uploading = ref(false)

// Computed
const totalSize = computed(() => {
  return selectedFiles.value.reduce((sum, file) => sum + file.size, 0)
})

const activeUploads = computed(() => {
  return Array.from(uploads.value.values()).filter(upload => upload.status === 'uploading')
})

const completedUploads = computed(() => {
  return Array.from(uploads.value.values()).filter(upload =>
    upload.status === 'completed' || upload.status === 'error'
  )
})

// File size formatting
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Drag and drop handlers
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  // Only set to false if we're leaving the upload area entirely
  if (!uploadArea.value?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false

  const files = Array.from(event.dataTransfer?.files || [])
  addFiles(files)
}

// File input handlers
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  addFiles(files)

  // Reset input
  target.value = ''
}

// File management
function addFiles(newFiles: File[]) {
  // Filter out duplicates and validate
  const validFiles = newFiles.filter(file => {
    // Check size
    if (file.size > props.maxFileSize) {
      console.warn(`File ${file.name} is too large (${formatFileSize(file.size)})`)
      return false
    }

    // Check for duplicates
    const isDuplicate = selectedFiles.value.some(existing =>
      existing.name === file.name && existing.size === file.size
    )

    return !isDuplicate
  })

  selectedFiles.value.push(...validFiles)
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

function clearFiles() {
  selectedFiles.value = []
}

// Upload management
async function startUpload() {
  if (selectedFiles.value.length === 0 || uploading.value) return

  uploading.value = true

  try {
    await filesStore.uploadFiles(selectedFiles.value, props.currentPath, {
      encrypted: encryptFiles.value
    })

    // Get uploaded file IDs (simplified - in real app you'd track these properly)
    const fileIds = selectedFiles.value.map(() => crypto.randomUUID())

    emit('uploaded', fileIds)
    clearFiles()
  } catch (error) {
    console.error('Upload failed:', error)
  } finally {
    uploading.value = false
  }
}

function cancelUpload(uploadId: string) {
  // TODO: Implement upload cancellation
  console.log('Cancel upload:', uploadId)
}

function removeFromHistory(uploadId: string) {
  filesStore.removeUpload(uploadId)
}

function clearHistory() {
  filesStore.clearCompletedUploads()
}
</script>

<style scoped>
.upload-area {
  @apply border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer transition-colors;
}

.upload-area:hover {
  @apply border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800;
}

.upload-area.drag-over {
  @apply border-primary-500 bg-primary-50 dark:bg-primary-900/20;
}

.upload-area.has-files {
  @apply cursor-default;
}

.upload-content {
  @apply pointer-events-none;
}

.selected-files {
  @apply pointer-events-auto;
}
</style>