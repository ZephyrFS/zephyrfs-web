<template>
  <Modal :show="!!file" @close="$emit('close')" :closable="!loading">
    <template #title>
      <div class="flex items-center space-x-3">
        <component :is="getFileIcon(file)" class="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <span>{{ file?.name }}</span>
      </div>
    </template>

    <div class="min-h-[60vh] max-h-[80vh] overflow-hidden">
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <div class="flex items-center space-x-3">
          <div class="spinner w-6 h-6"></div>
          <span class="text-gray-600 dark:text-gray-400">Loading preview...</span>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-64 text-center">
        <ExclamationTriangleIcon class="w-12 h-12 text-red-500 mb-3" />
        <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
        <button @click="loadPreview" class="btn btn-outline">
          Try Again
        </button>
      </div>

      <!-- Preview content -->
      <div v-else class="preview-content">
        <!-- Image preview -->
        <div v-if="previewType === 'image'" class="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <img
            :src="previewUrl"
            :alt="file?.name"
            class="max-w-full max-h-[70vh] object-contain"
            @load="handleImageLoad"
            @error="handleImageError"
          />
        </div>

        <!-- Text preview -->
        <div v-else-if="previewType === 'text'" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-auto max-h-[70vh]">
          <pre class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">{{ textContent }}</pre>
        </div>

        <!-- PDF preview -->
        <div v-else-if="previewType === 'pdf'" class="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <iframe
            :src="previewUrl"
            class="w-full h-[70vh] border-0"
            title="PDF Preview"
          ></iframe>
        </div>

        <!-- Video preview -->
        <div v-else-if="previewType === 'video'" class="bg-black rounded-lg overflow-hidden flex items-center justify-center">
          <video
            :src="previewUrl"
            controls
            class="max-w-full max-h-[70vh]"
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        </div>

        <!-- Audio preview -->
        <div v-else-if="previewType === 'audio'" class="flex flex-col items-center justify-center h-64 space-y-4">
          <MusicNoteIcon class="w-16 h-16 text-gray-400" />
          <audio
            :src="previewUrl"
            controls
            class="w-full max-w-md"
            preload="metadata"
          >
            Your browser does not support audio playback.
          </audio>
        </div>

        <!-- Archive preview -->
        <div v-else-if="previewType === 'archive'" class="space-y-4">
          <div class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <ArchiveBoxIcon class="w-5 h-5" />
            <span>Archive contents ({{ archiveContents.length }} items)</span>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-auto">
            <div class="space-y-1">
              <div
                v-for="item in archiveContents"
                :key="item.path"
                class="flex items-center space-x-2 text-sm"
              >
                <component
                  :is="item.isDirectory ? FolderIcon : DocumentIcon"
                  class="w-4 h-4 text-gray-400"
                />
                <span class="font-mono text-gray-700 dark:text-gray-300">{{ item.path }}</span>
                <span v-if="!item.isDirectory" class="text-gray-500">
                  ({{ formatFileSize(item.size) }})
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- JSON preview -->
        <div v-else-if="previewType === 'json'" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-auto max-h-[70vh]">
          <JsonViewer :data="jsonData" />
        </div>

        <!-- Not supported -->
        <div v-else class="flex flex-col items-center justify-center h-64 text-center">
          <DocumentIcon class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Preview not available
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">
            This file type cannot be previewed in the browser.
          </p>
          <button @click="downloadFile" class="btn btn-primary">
            <ArrowDownTrayIcon class="w-4 h-4 mr-2" />
            Download File
          </button>
        </div>
      </div>

      <!-- File info -->
      <div v-if="file && !loading" class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">Size:</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300">{{ formatFileSize(file.size) }}</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Modified:</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300">{{ formatDate(file.lastModified) }}</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Type:</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300">{{ file.mimeType || 'Unknown' }}</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Encrypted:</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300">{{ file.encrypted ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <div class="flex items-center space-x-2">
          <button
            v-if="file"
            @click="downloadFile"
            class="btn btn-outline"
          >
            <ArrowDownTrayIcon class="w-4 h-4 mr-2" />
            Download
          </button>
          <button
            v-if="file && canShare"
            @click="shareFile"
            class="btn btn-outline"
          >
            <ShareIcon class="w-4 h-4 mr-2" />
            Share
          </button>
        </div>
        <button @click="$emit('close')" class="btn btn-primary">
          Close
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { apiClient } from '@/services/api'
import {
  ExclamationTriangleIcon,
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicNoteIcon,
  ArchiveBoxIcon,
  FolderIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  CodeBracketIcon,
} from '@heroicons/vue/24/outline'
import Modal from './Modal.vue'
import JsonViewer from './JsonViewer.vue'
import type { FileItem } from '@shared/types'

interface Props {
  file: FileItem | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  share: [file: FileItem]
}>()

// State
const loading = ref(false)
const error = ref('')
const previewUrl = ref('')
const textContent = ref('')
const jsonData = ref<any>(null)
const archiveContents = ref<Array<{ path: string; size: number; isDirectory: boolean }>>([])

// Computed
const previewType = computed(() => {
  if (!props.file?.mimeType) return 'unknown'

  const mimeType = props.file.mimeType.toLowerCase()

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'application/json' || mimeType === 'text/json') return 'json'
  if (mimeType.startsWith('text/') || mimeType === 'application/javascript') return 'text'
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) return 'archive'

  return 'unknown'
})

const canShare = computed(() => {
  return props.file && !props.file.encrypted
})

// Methods
function getFileIcon(file: FileItem | null) {
  if (!file) return DocumentIcon

  const type = previewType.value
  switch (type) {
    case 'image': return PhotoIcon
    case 'video': return VideoCameraIcon
    case 'audio': return MusicNoteIcon
    case 'archive': return ArchiveBoxIcon
    case 'json': return CodeBracketIcon
    default: return DocumentIcon
  }
}

async function loadPreview() {
  if (!props.file) return

  loading.value = true
  error.value = ''

  try {
    const blob = await apiClient.downloadFile(props.file.id)
    previewUrl.value = URL.createObjectURL(blob)

    // Load content based on type
    if (previewType.value === 'text' || previewType.value === 'json') {
      const text = await blob.text()

      if (previewType.value === 'json') {
        try {
          jsonData.value = JSON.parse(text)
        } catch {
          textContent.value = text
        }
      } else {
        textContent.value = text.slice(0, 50000) // Limit to 50KB for display
      }
    }

    // TODO: Implement archive contents parsing for ZIP files
    if (previewType.value === 'archive') {
      // This would require a ZIP parsing library
      archiveContents.value = [
        { path: 'example.txt', size: 1024, isDirectory: false },
      ]
    }

  } catch (err: any) {
    error.value = err.message || 'Failed to load preview'
    console.error('Preview failed:', err)
  } finally {
    loading.value = false
  }
}

function handleImageLoad() {
  // Image loaded successfully
}

function handleImageError() {
  error.value = 'Failed to load image'
}

async function downloadFile() {
  if (!props.file) return

  try {
    const blob = await apiClient.downloadFile(props.file.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = props.file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    if (window.$notify) {
      window.$notify.error('Failed to download file')
    }
  }
}

function shareFile() {
  if (props.file) {
    emit('share', props.file)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Watch for file changes
watch(() => props.file, (newFile) => {
  if (newFile) {
    loadPreview()
  } else {
    // Clean up
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }
    textContent.value = ''
    jsonData.value = null
    archiveContents.value = []
  }
}, { immediate: true })

// Cleanup on unmount
onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>

<style scoped>
.preview-content {
  @apply flex flex-col space-y-4;
}

pre {
  @apply break-words whitespace-pre-wrap;
}
</style>