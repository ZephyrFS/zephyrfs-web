<template>
  <div class="notification-container fixed top-4 right-4 z-50 space-y-2">
    <TransitionGroup name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4"
        :class="{
          'border-green-200 dark:border-green-800': notification.type === 'success',
          'border-blue-200 dark:border-blue-800': notification.type === 'info',
          'border-yellow-200 dark:border-yellow-800': notification.type === 'warning',
          'border-red-200 dark:border-red-800': notification.type === 'error'
        }"
      >
        <div class="flex items-start">
          <!-- Icon -->
          <div class="flex-shrink-0 mr-3">
            <CheckCircleIcon
              v-if="notification.type === 'success'"
              class="w-5 h-5 text-green-500"
            />
            <InformationCircleIcon
              v-else-if="notification.type === 'info'"
              class="w-5 h-5 text-blue-500"
            />
            <ExclamationTriangleIcon
              v-else-if="notification.type === 'warning'"
              class="w-5 h-5 text-yellow-500"
            />
            <ExclamationCircleIcon
              v-else-if="notification.type === 'error'"
              class="w-5 h-5 text-red-500"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <h4
              v-if="notification.title"
              class="text-sm font-medium text-gray-900 dark:text-white"
            >
              {{ notification.title }}
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {{ notification.message }}
            </p>
          </div>

          <!-- Close button -->
          <button
            @click="removeNotification(notification.id)"
            class="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>

        <!-- Progress bar for auto-dismiss -->
        <div
          v-if="notification.duration && notification.duration > 0"
          class="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        >
          <div
            class="h-full bg-gray-400 dark:bg-gray-500 transition-all duration-100 ease-linear"
            :style="`width: ${getProgressWidth(notification)}%`"
          ></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
  createdAt: number
}

const notifications = ref<Notification[]>([])

function addNotification(notification: Omit<Notification, 'id' | 'createdAt'>) {
  const id = crypto.randomUUID()
  const newNotification: Notification = {
    ...notification,
    id,
    createdAt: Date.now(),
    duration: notification.duration ?? 5000,
  }

  notifications.value.push(newNotification)

  // Auto-remove after duration
  if (newNotification.duration && newNotification.duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, newNotification.duration)
  }
}

function removeNotification(id: string) {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

function getProgressWidth(notification: Notification): number {
  if (!notification.duration) return 0

  const elapsed = Date.now() - notification.createdAt
  const progress = Math.max(0, (notification.duration - elapsed) / notification.duration * 100)
  return progress
}

// Global notification methods
function showSuccess(message: string, title?: string, duration?: number) {
  addNotification({ type: 'success', title, message, duration })
}

function showError(message: string, title?: string, duration?: number) {
  addNotification({ type: 'error', title, message, duration })
}

function showWarning(message: string, title?: string, duration?: number) {
  addNotification({ type: 'warning', title, message, duration })
}

function showInfo(message: string, title?: string, duration?: number) {
  addNotification({ type: 'info', title, message, duration })
}

// Expose methods globally
onMounted(() => {
  window.$notify = {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
  }
})
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>