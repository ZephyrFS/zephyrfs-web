<template>
  <div id="app" class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading overlay -->
    <div
      v-if="authStore.loading"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
        <div class="spinner w-5 h-5"></div>
        <span class="text-gray-700 dark:text-gray-300">Loading...</span>
      </div>
    </div>

    <!-- Main app -->
    <RouterView />

    <!-- Global notifications -->
    <Teleport to="body">
      <NotificationContainer />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import NotificationContainer from '@/components/NotificationContainer.vue'

const authStore = useAuthStore()

onMounted(async () => {
  // Initialize authentication
  await authStore.initializeAuth()
})
</script>

<style scoped>
/* Component styles */
</style>