import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/services/api'
import type { DirectoryListing, FileItem, UploadResponse } from '@shared/types'

interface UploadProgress {
  fileId: string
  filename: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

export const useFilesStore = defineStore('files', () => {
  // State
  const currentListing = ref<DirectoryListing | null>(null)
  const currentPath = ref<string>('/')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const uploads = ref<Map<string, UploadProgress>>(new Map())
  const selectedFiles = ref<Set<string>>(new Set())
  const viewMode = ref<'grid' | 'list'>('grid')
  const sortBy = ref<'name' | 'size' | 'date'>('name')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // Getters
  const sortedFiles = computed(() => {
    if (!currentListing.value) return []

    const files = [...currentListing.value.files]

    files.sort((a, b) => {
      let comparison = 0

      switch (sortBy.value) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'date':
          comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
          break
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })

    // Always put directories first
    return files.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'directory') return 1
      return 0
    })
  })

  const activeUploads = computed(() =>
    Array.from(uploads.value.values()).filter(upload => upload.status === 'uploading')
  )

  const hasSelection = computed(() => selectedFiles.value.size > 0)

  // Actions
  async function loadDirectory(path: string = '/'): Promise<void> {
    loading.value = true
    error.value = null

    try {
      currentListing.value = await apiClient.listFiles(path)
      currentPath.value = path
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to load directory'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function uploadFiles(
    files: File[],
    path: string = currentPath.value,
    options: { encrypted?: boolean } = {}
  ): Promise<void> {
    const uploadPromises = files.map(file => uploadFile(file, path, options))
    await Promise.allSettled(uploadPromises)
  }

  async function uploadFile(
    file: File,
    path: string = currentPath.value,
    options: { encrypted?: boolean } = {}
  ): Promise<UploadResponse> {
    const uploadId = crypto.randomUUID()

    // Add to uploads tracking
    uploads.value.set(uploadId, {
      fileId: uploadId,
      filename: file.name,
      progress: 0,
      status: 'uploading',
    })

    try {
      const result = await apiClient.uploadFile(file, path, {
        ...options,
        onProgress: (progress) => {
          const upload = uploads.value.get(uploadId)
          if (upload) {
            upload.progress = progress
          }
        },
      })

      // Mark as completed
      const upload = uploads.value.get(uploadId)
      if (upload) {
        upload.status = 'completed'
        upload.fileId = result.fileId
      }

      // Refresh directory listing if we're in the same path
      if (path === currentPath.value) {
        await loadDirectory(currentPath.value)
      }

      return result
    } catch (err: any) {
      // Mark as error
      const upload = uploads.value.get(uploadId)
      if (upload) {
        upload.status = 'error'
        upload.error = err.response?.data?.message || 'Upload failed'
      }
      throw err
    }
  }

  async function downloadFile(file: FileItem): Promise<void> {
    try {
      const blob = await apiClient.downloadFile(file.id)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Download failed'
      throw err
    }
  }

  async function deleteFile(fileId: string): Promise<void> {
    try {
      await apiClient.deleteFile(fileId)

      // Refresh directory listing
      await loadDirectory(currentPath.value)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Delete failed'
      throw err
    }
  }

  async function deleteSelectedFiles(): Promise<void> {
    if (!hasSelection.value) return

    const deletePromises = Array.from(selectedFiles.value).map(fileId =>
      apiClient.deleteFile(fileId)
    )

    try {
      await Promise.allSettled(deletePromises)
      clearSelection()
      await loadDirectory(currentPath.value)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Delete failed'
      throw err
    }
  }

  function toggleFileSelection(fileId: string): void {
    if (selectedFiles.value.has(fileId)) {
      selectedFiles.value.delete(fileId)
    } else {
      selectedFiles.value.add(fileId)
    }
  }

  function selectAllFiles(): void {
    if (!currentListing.value) return

    currentListing.value.files.forEach(file => {
      selectedFiles.value.add(file.id)
    })
  }

  function clearSelection(): void {
    selectedFiles.value.clear()
  }

  function removeUpload(uploadId: string): void {
    uploads.value.delete(uploadId)
  }

  function clearCompletedUploads(): void {
    for (const [id, upload] of uploads.value.entries()) {
      if (upload.status === 'completed' || upload.status === 'error') {
        uploads.value.delete(id)
      }
    }
  }

  function setViewMode(mode: 'grid' | 'list'): void {
    viewMode.value = mode
    localStorage.setItem('files_view_mode', mode)
  }

  function setSortBy(field: 'name' | 'size' | 'date'): void {
    if (sortBy.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = field
      sortOrder.value = 'asc'
    }
  }

  function clearError(): void {
    error.value = null
  }

  // Initialize view mode from localStorage
  const savedViewMode = localStorage.getItem('files_view_mode') as 'grid' | 'list'
  if (savedViewMode) {
    viewMode.value = savedViewMode
  }

  return {
    // State
    currentListing,
    currentPath,
    loading,
    error,
    uploads,
    selectedFiles,
    viewMode,
    sortBy,
    sortOrder,

    // Getters
    sortedFiles,
    activeUploads,
    hasSelection,

    // Actions
    loadDirectory,
    uploadFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    deleteSelectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    removeUpload,
    clearCompletedUploads,
    setViewMode,
    setSortBy,
    clearError,
  }
})