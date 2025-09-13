<template>
  <div class="network-status">
    <div class="flex items-center space-x-2">
      <!-- Status indicator -->
      <div
        class="w-2 h-2 rounded-full"
        :class="{
          'bg-green-500': status === 'online',
          'bg-yellow-500': status === 'degraded',
          'bg-red-500': status === 'offline',
          'bg-gray-400': status === 'unknown'
        }"
      ></div>

      <!-- Status text -->
      <span class="text-xs text-gray-600 dark:text-gray-400 capitalize">
        {{ status }}
      </span>
    </div>

    <!-- Details -->
    <div v-if="networkData" class="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Nodes:</span>
        <span>{{ networkData.nodes.length }}</span>
      </div>
      <div class="flex justify-between">
        <span>Storage:</span>
        <span>{{ formatBytes(networkData.usedStorage) }} / {{ formatBytes(networkData.totalStorage) }}</span>
      </div>
      <div class="flex justify-between">
        <span>Health:</span>
        <span>{{ Math.round(networkData.healthScore * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { apiClient } from '@/services/api'
import type { NetworkStatus } from '@shared/types'

const status = ref<'online' | 'degraded' | 'offline' | 'unknown'>('unknown')
const networkData = ref<NetworkStatus | null>(null)

let ws: WebSocket | null = null
let reconnectTimeout: NodeJS.Timeout | null = null

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function connectWebSocket() {
  try {
    ws = apiClient.createStatusWebSocket()

    ws.onopen = () => {
      status.value = 'online'
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'status_update') {
          networkData.value = data.data.network

          // Determine overall status
          if (networkData.value.healthScore > 0.8) {
            status.value = 'online'
          } else if (networkData.value.healthScore > 0.5) {
            status.value = 'degraded'
          } else {
            status.value = 'offline'
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onclose = () => {
      status.value = 'offline'
      // Attempt to reconnect after 5 seconds
      reconnectTimeout = setTimeout(() => {
        connectWebSocket()
      }, 5000)
    }

    ws.onerror = () => {
      status.value = 'offline'
    }
  } catch (error) {
    console.error('Failed to connect WebSocket:', error)
    status.value = 'offline'

    // Retry connection
    reconnectTimeout = setTimeout(() => {
      connectWebSocket()
    }, 5000)
  }
}

async function loadInitialStatus() {
  try {
    networkData.value = await apiClient.getNetworkStatus()
    status.value = 'online'
  } catch (error) {
    console.error('Failed to load network status:', error)
    status.value = 'offline'
  }
}

onMounted(() => {
  loadInitialStatus()
  connectWebSocket()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
  }
})
</script>