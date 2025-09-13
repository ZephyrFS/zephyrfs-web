<template>
  <div
    class="file-card group cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all"
    :class="{
      'ring-2 ring-primary-500 border-primary-500': selected,
      'bg-primary-50 dark:bg-primary-900/20': selected
    }"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <!-- Selection checkbox -->
    <div class="flex items-start justify-between mb-2">
      <button
        @click.stop="$emit('select')"
        class="opacity-0 group-hover:opacity-100 transition-opacity"
        :class="{ 'opacity-100': selected }"
      >
        <div
          class="w-4 h-4 border-2 rounded border-gray-300 dark:border-gray-600 flex items-center justify-center"
          :class="{
            'bg-primary-500 border-primary-500': selected,
            'hover:border-gray-400 dark:hover:border-gray-500': !selected
          }"
        >
          <CheckIcon v-if="selected" class="w-3 h-3 text-white" />
        </div>
      </button>

      <!-- Actions menu -->
      <Menu as="div" class="relative">
        <MenuButton
          @click.stop
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity"
        >
          <EllipsisVerticalIcon class="w-4 h-4 text-gray-500" />
        </MenuButton>

        <MenuItems class="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
          <MenuItem v-slot="{ active }">
            <button
              @click="$emit('preview')"
              class="w-full text-left px-3 py-2 text-sm"
              :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <EyeIcon class="w-4 h-4 inline mr-2" />
              Preview
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              @click="$emit('download')"
              class="w-full text-left px-3 py-2 text-sm"
              :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <ArrowDownTrayIcon class="w-4 h-4 inline mr-2" />
              Download
            </button>
          </MenuItem>
          <MenuItem v-if="!file.encrypted" v-slot="{ active }">
            <button
              @click="$emit('share')"
              class="w-full text-left px-3 py-2 text-sm"
              :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <ShareIcon class="w-4 h-4 inline mr-2" />
              Share
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              @click="$emit('rename')"
              class="w-full text-left px-3 py-2 text-sm"
              :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <PencilIcon class="w-4 h-4 inline mr-2" />
              Rename
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              @click="$emit('delete')"
              class="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400"
              :class="active ? 'bg-red-50 dark:bg-red-900/20' : ''"
            >
              <TrashIcon class="w-4 h-4 inline mr-2" />
              Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>

    <!-- File icon and preview -->
    <div class="flex flex-col items-center mb-3">
      <!-- Thumbnail or icon -->
      <div class="w-16 h-16 flex items-center justify-center rounded-lg mb-2"
           :class="file.type === 'directory' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'">

        <!-- Directory icon -->
        <FolderIcon
          v-if="file.type === 'directory'"
          class="w-10 h-10 text-blue-600 dark:text-blue-400"
        />

        <!-- File icons based on type -->
        <component
          v-else
          :is="getFileIcon(file)"
          class="w-10 h-10"
          :class="getFileIconColor(file)"
        />
      </div>

      <!-- Encryption indicator -->
      <div v-if="file.encrypted" class="flex items-center text-xs text-amber-600 dark:text-amber-400 mb-1">
        <LockClosedIcon class="w-3 h-3 mr-1" />
        <span>Encrypted</span>
      </div>
    </div>

    <!-- File info -->
    <div class="text-center space-y-1">
      <!-- File name -->
      <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate" :title="file.name">
        {{ file.name }}
      </h3>

      <!-- File size and date -->
      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <div v-if="file.type === 'file'">
          {{ formatFileSize(file.size) }}
        </div>
        <div>
          {{ formatDate(file.lastModified) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  CheckIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicNoteIcon,
  ArchiveBoxIcon,
  CodeBracketIcon,
  LockClosedIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import type { FileItem } from '@shared/types'

interface Props {
  file: FileItem
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
})

const emit = defineEmits<{
  click: []
  dblclick: []
  select: []
  preview: []
  download: []
  share: []
  rename: []
  delete: []
}>()

function getFileIcon(file: FileItem) {
  if (file.type === 'directory') return FolderIcon

  const ext = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.mimeType?.toLowerCase()

  // Images
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return PhotoIcon
  }

  // Videos
  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) {
    return VideoCameraIcon
  }

  // Audio
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')) {
    return MusicNoteIcon
  }

  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'css', 'html', 'json', 'xml'].includes(ext || '')) {
    return CodeBracketIcon
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
    return ArchiveBoxIcon
  }

  return DocumentIcon
}

function getFileIconColor(file: FileItem) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.mimeType?.toLowerCase()

  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return 'text-green-600 dark:text-green-400'
  }

  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) {
    return 'text-red-600 dark:text-red-400'
  }

  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')) {
    return 'text-purple-600 dark:text-purple-400'
  }

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'css', 'html', 'json', 'xml'].includes(ext || '')) {
    return 'text-blue-600 dark:text-blue-400'
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
    return 'text-orange-600 dark:text-orange-400'
  }

  return 'text-gray-600 dark:text-gray-400'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== new Date(date).getFullYear() ? 'numeric' : undefined,
  }).format(new Date(date))
}
</script>