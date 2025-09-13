<template>
  <AppLayout>
    <div class="files-view">
      <!-- Upload modal -->
      <Modal v-if="showUploadModal" @close="showUploadModal = false">
        <template #title>Upload Files</template>
        <FileUpload
          :current-path="currentPath"
          @uploaded="handleUploaded"
          @close="showUploadModal = false"
        />
      </Modal>

      <!-- File browser -->
      <FileBrowser @upload="showUploadModal = true" />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFilesStore } from '@/stores/files'
import AppLayout from '@/components/AppLayout.vue'
import FileBrowser from '@/components/FileBrowser.vue'
import FileUpload from '@/components/FileUpload.vue'
import Modal from '@/components/Modal.vue'

const route = useRoute()
const filesStore = useFilesStore()

const showUploadModal = ref(false)

const currentPath = computed(() => {
  const path = Array.isArray(route.params.path) ? '/' + route.params.path.join('/') : route.params.path || '/'
  return path
})

function handleUploaded(fileIds: string[]) {
  showUploadModal.value = false
  // Refresh the current directory
  filesStore.loadDirectory(currentPath.value)
}
</script>