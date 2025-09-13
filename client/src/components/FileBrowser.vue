<template>
  <div class="file-browser">
    <!-- Toolbar -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <!-- Breadcrumb -->
        <nav class="flex items-center space-x-2 text-sm">
          <button
            @click="navigateToPath('/')"
            class="text-primary-600 hover:text-primary-700 font-medium"
          >
            Home
          </button>
          <template v-for="(segment, index) in pathSegments" :key="index">
            <ChevronRightIcon class="w-4 h-4 text-gray-400" />
            <button
              @click="navigateToPath(getPathUpTo(index))"
              class="text-primary-600 hover:text-primary-700"
              :class="{ 'text-gray-700 dark:text-gray-300': index === pathSegments.length - 1 }"
            >
              {{ segment }}
            </button>
          </template>
        </nav>

        <!-- Actions -->
        <div class="flex items-center space-x-2">
          <!-- View toggle -->
          <div class="flex bg-gray-100 dark:bg-gray-700 rounded-md">
            <button
              @click="filesStore.setViewMode('grid')"
              class="p-2 rounded-l-md"
              :class="viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'"
            >
              <Squares2X2Icon class="w-4 h-4" />
            </button>
            <button
              @click="filesStore.setViewMode('list')"
              class="p-2 rounded-r-md"
              :class="viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'"
            >
              <ListBulletIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- Sort dropdown -->
          <Menu as="div" class="relative">
            <MenuButton class="btn btn-outline">
              <BarsArrowUpIcon class="w-4 h-4 mr-2" />
              Sort
            </MenuButton>
            <MenuItems class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <MenuItem v-slot="{ active }">
                <button
                  @click="filesStore.setSortBy('name')"
                  class="w-full text-left px-4 py-2 text-sm"
                  :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                >
                  Name {{ sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  @click="filesStore.setSortBy('size')"
                  class="w-full text-left px-4 py-2 text-sm"
                  :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                >
                  Size {{ sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  @click="filesStore.setSortBy('date')"
                  class="w-full text-left px-4 py-2 text-sm"
                  :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                >
                  Date {{ sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>

          <!-- Upload button -->
          <button
            @click="$emit('upload')"
            class="btn btn-primary"
          >
            <ArrowUpTrayIcon class="w-4 h-4 mr-2" />
            Upload
          </button>
        </div>
      </div>

      <!-- Selection actions -->
      <div v-if="hasSelection" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <div class="flex items-center justify-between">
          <span class="text-sm text-blue-700 dark:text-blue-300">
            {{ selectedFiles.size }} file{{ selectedFiles.size !== 1 ? 's' : '' }} selected
          </span>
          <div class="flex items-center space-x-2">
            <button
              @click="downloadSelected"
              class="btn btn-sm btn-outline"
            >
              <ArrowDownTrayIcon class="w-4 h-4 mr-1" />
              Download
            </button>
            <button
              @click="deleteSelected"
              class="btn btn-sm btn-danger"
            >
              <TrashIcon class="w-4 h-4 mr-1" />
              Delete
            </button>
            <button
              @click="filesStore.clearSelection()"
              class="btn btn-sm btn-outline"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="flex items-center space-x-3">
        <div class="spinner w-6 h-6"></div>
        <span class="text-gray-600 dark:text-gray-400">Loading files...</span>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-6 text-center">
      <ExclamationTriangleIcon class="w-12 h-12 text-red-500 mx-auto mb-3" />
      <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
      <button @click="loadDirectory(currentPath)" class="btn btn-primary">
        Try Again
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!sortedFiles.length" class="p-12 text-center">
      <FolderIcon class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
        No files found
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6">
        This directory is empty. Upload some files to get started.
      </p>
      <button @click="$emit('upload')" class="btn btn-primary">
        <ArrowUpTrayIcon class="w-4 h-4 mr-2" />
        Upload Files
      </button>
    </div>

    <!-- File grid view -->
    <div v-else-if="viewMode === 'grid'" class="p-6 file-grid">
      <FileCard
        v-for="file in sortedFiles"
        :key="file.id"
        :file="file"
        :selected="selectedFiles.has(file.id)"
        @click="handleFileClick(file)"
        @select="toggleSelection(file.id)"
        @download="downloadFile(file)"
        @delete="deleteFile(file.id)"
      />
    </div>

    <!-- File list view -->
    <div v-else class="file-list">
      <FileRow
        v-for="file in sortedFiles"
        :key="file.id"
        :file="file"
        :selected="selectedFiles.has(file.id)"
        @click="handleFileClick(file)"
        @select="toggleSelection(file.id)"
        @download="downloadFile(file)"
        @delete="deleteFile(file.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFilesStore } from '@/stores/files'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon,
  BarsArrowUpIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  FolderIcon,
} from '@heroicons/vue/24/outline'
import FileCard from './FileCard.vue'
import FileRow from './FileRow.vue'
import type { FileItem } from '@shared/types'

// Emits
defineEmits<{
  upload: []
}>()

// Stores
const filesStore = useFilesStore()
const route = useRoute()
const router = useRouter()

// Computed
const { currentListing, currentPath, loading, error, selectedFiles, viewMode, sortBy, sortOrder } = filesStore
const { sortedFiles, hasSelection } = storeToRefs(filesStore)

const pathSegments = computed(() => {
  return currentPath.value.split('/').filter(Boolean)
})

// Methods
function navigateToPath(path: string) {
  router.push({ name: 'files-path', params: { path: path === '/' ? [] : path.split('/').filter(Boolean) } })
}

function getPathUpTo(index: number): string {
  return '/' + pathSegments.value.slice(0, index + 1).join('/')
}

function handleFileClick(file: FileItem) {
  if (file.type === 'directory') {
    const newPath = currentPath.value === '/' ? `/${file.name}` : `${currentPath.value}/${file.name}`
    navigateToPath(newPath)
  } else {
    // Preview or download file
    downloadFile(file)
  }
}

function toggleSelection(fileId: string) {
  filesStore.toggleFileSelection(fileId)
}

async function downloadFile(file: FileItem) {
  try {
    await filesStore.downloadFile(file)
  } catch (error) {
    console.error('Download failed:', error)
  }
}

async function deleteFile(fileId: string) {
  if (confirm('Are you sure you want to delete this file?')) {
    try {
      await filesStore.deleteFile(fileId)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }
}

async function downloadSelected() {
  // TODO: Implement bulk download
  console.log('Bulk download not implemented yet')
}

async function deleteSelected() {
  if (confirm(`Are you sure you want to delete ${selectedFiles.value.size} file(s)?`)) {
    try {
      await filesStore.deleteSelectedFiles()
    } catch (error) {
      console.error('Bulk delete failed:', error)
    }
  }
}

async function loadDirectory(path: string) {
  await filesStore.loadDirectory(path)
}

// Watch route changes
watch(
  () => route.params.path,
  (newPath) => {
    const path = Array.isArray(newPath) ? '/' + newPath.join('/') : newPath || '/'
    if (path !== currentPath.value) {
      loadDirectory(path)
    }
  },
  { immediate: true }
)

// Load initial directory
onMounted(() => {
  const path = Array.isArray(route.params.path) ? '/' + route.params.path.join('/') : route.params.path || '/'
  loadDirectory(path)
})
</script>