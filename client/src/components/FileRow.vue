<template>
  <div
    class="file-row group flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
    :class="{
      'bg-primary-50 dark:bg-primary-900/20': selected,
      'border-primary-200 dark:border-primary-800': selected
    }"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <!-- Selection checkbox -->
    <div class="flex-shrink-0 mr-3">
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
    </div>

    <!-- File icon -->
    <div class="flex-shrink-0 mr-3">
      <div class="w-8 h-8 flex items-center justify-center">
        <FolderIcon
          v-if="file.type === 'directory'"
          class="w-6 h-6 text-blue-600 dark:text-blue-400"
        />
        <component
          v-else
          :is="getFileIcon(file)"
          class="w-6 h-6"
          :class="getFileIconColor(file)"
        />
      </div>
    </div>

    <!-- File name and info -->
    <div class="flex-1 min-w-0 mr-4">
      <div class="flex items-center space-x-2">
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ file.name }}
        </p>

        <!-- Encryption indicator -->
        <LockClosedIcon
          v-if="file.encrypted"
          class="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0"
          title="Encrypted"
        />
      </div>

      <!-- File type/description -->
      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
        {{ getFileDescription(file) }}
      </p>
    </div>

    <!-- File size -->
    <div class="flex-shrink-0 w-20 text-right mr-4">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{ file.type === 'file' ? formatFileSize(file.size) : '—' }}
      </p>
    </div>

    <!-- Last modified -->
    <div class="flex-shrink-0 w-32 text-right mr-4">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{ formatDate(file.lastModified) }}
      </p>
    </div>

    <!-- Actions menu -->
    <div class="flex-shrink-0">
      <Menu as="div" class="relative">
        <MenuButton
          @click.stop
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity"
        >
          <EllipsisHorizontalIcon class="w-5 h-5 text-gray-500" />
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
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  CheckIcon,
  EllipsisHorizontalIcon,
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

  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return PhotoIcon
  }

  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) {
    return VideoCameraIcon
  }

  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')) {
    return MusicNoteIcon
  }

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'css', 'html', 'json', 'xml'].includes(ext || '')) {
    return CodeBracketIcon
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
    return ArchiveBoxIcon
  }

  return DocumentIcon
}

function getFileIconColor(file: FileItem) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.mimeType?.toLowerCase()

  if (mimeType?.startsWith('image/')) return 'text-green-600 dark:text-green-400'
  if (mimeType?.startsWith('video/')) return 'text-red-600 dark:text-red-400'
  if (mimeType?.startsWith('audio/')) return 'text-purple-600 dark:text-purple-400'
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'css', 'html', 'json', 'xml'].includes(ext || '')) {
    return 'text-blue-600 dark:text-blue-400'
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
    return 'text-orange-600 dark:text-orange-400'
  }

  return 'text-gray-600 dark:text-gray-400'
}

function getFileDescription(file: FileItem): string {
  if (file.type === 'directory') {
    return 'Folder'
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (file.mimeType) {
    const mimeType = file.mimeType.toLowerCase()
    if (mimeType.startsWith('image/')) return 'Image'
    if (mimeType.startsWith('video/')) return 'Video'
    if (mimeType.startsWith('audio/')) return 'Audio'
    if (mimeType === 'application/pdf') return 'PDF Document'
    if (mimeType.includes('json')) return 'JSON File'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive'
  }

  // Fallback to extension
  const extMap: Record<string, string> = {
    'txt': 'Text File',
    'md': 'Markdown',
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'go': 'Go',
    'rs': 'Rust',
    'php': 'PHP',
    'rb': 'Ruby',
    'css': 'CSS',
    'html': 'HTML',
    'json': 'JSON',
    'xml': 'XML',
    'zip': 'ZIP Archive',
    'rar': 'RAR Archive',
    '7z': '7-Zip Archive',
    'tar': 'TAR Archive',
    'gz': 'Gzip Archive',
  }

  return extMap[ext || ''] || (ext ? `${ext.toUpperCase()} File` : 'File')
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}
</script>