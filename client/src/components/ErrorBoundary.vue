<template>
  <div v-if="hasError" class="error-boundary">
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div class="max-w-md w-full">
        <!-- Error icon -->
        <div class="text-center mb-6">
          <ExclamationTriangleIcon class="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            We encountered an unexpected error. This has been reported to our team.
          </p>
        </div>

        <!-- Error details (development only) -->
        <div v-if="showDetails && errorInfo" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <details class="text-sm">
            <summary class="font-medium text-red-800 dark:text-red-200 cursor-pointer">
              Error Details
            </summary>
            <div class="mt-2 text-red-700 dark:text-red-300 space-y-2">
              <div>
                <strong>Message:</strong> {{ errorInfo.message }}
              </div>
              <div v-if="errorInfo.stack">
                <strong>Stack trace:</strong>
                <pre class="mt-1 text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto">{{ errorInfo.stack }}</pre>
              </div>
              <div>
                <strong>Timestamp:</strong> {{ new Date(errorInfo.timestamp).toLocaleString() }}
              </div>
              <div v-if="errorInfo.context">
                <strong>Context:</strong>
                <pre class="mt-1 text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto">{{ JSON.stringify(errorInfo.context, null, 2) }}</pre>
              </div>
            </div>
          </details>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="handleReload"
            class="btn btn-primary flex-1"
          >
            <ArrowPathIcon class="w-4 h-4 mr-2" />
            Reload Page
          </button>

          <button
            @click="handleReset"
            class="btn btn-outline flex-1"
          >
            Reset Application
          </button>
        </div>

        <!-- Additional actions -->
        <div class="mt-4 text-center space-y-2">
          <button
            v-if="errorInfo?.retryable"
            @click="handleRetry"
            class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Try Last Action Again
          </button>

          <div class="text-xs text-gray-500 dark:text-gray-400">
            Error ID: {{ errorInfo?.id || 'unknown' }}
          </div>
        </div>

        <!-- Report issue link -->
        <div class="mt-6 text-center">
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Report this issue on GitHub →
          </a>
        </div>
      </div>
    </div>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, onMounted } from 'vue'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import { useErrorHandler, type ErrorInfo } from '@/composables/useErrorHandler'

const hasError = ref(false)
const errorInfo = ref<ErrorInfo | null>(null)
const showDetails = ref(import.meta.env.DEV)
const lastAction = ref<Function | null>(null)

const { handleError } = useErrorHandler()

// Capture Vue component errors
onErrorCaptured((error: Error, instance: any, info: string) => {
  const errorDetails = handleError(error, {
    component: instance?.$options.name || 'Unknown',
    errorInfo: info,
    timestamp: Date.now(),
  })

  hasError.value = true
  errorInfo.value = {
    ...errorDetails,
    stack: error.stack,
    context: {
      ...errorDetails.context,
      vueInfo: info,
    },
  }

  // Prevent the error from propagating further
  return false
})

// Handle global errors
onMounted(() => {
  const originalOnError = window.onerror
  const originalOnUnhandledRejection = window.onunhandledrejection

  window.onerror = (message, source, lineno, colno, error) => {
    if (error) {
      const errorDetails = handleError(error, {
        source,
        lineno,
        colno,
        timestamp: Date.now(),
      })

      hasError.value = true
      errorInfo.value = {
        ...errorDetails,
        stack: error.stack,
      }
    }

    // Call original handler
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error)
    }
    return false
  }

  window.onunhandledrejection = (event) => {
    const errorDetails = handleError(event.reason, {
      type: 'unhandled_promise_rejection',
      timestamp: Date.now(),
    })

    hasError.value = true
    errorInfo.value = errorDetails

    // Call original handler
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection(event)
    }
  }
})

function handleReload() {
  window.location.reload()
}

function handleReset() {
  // Clear all localStorage/sessionStorage
  localStorage.clear()
  sessionStorage.clear()

  // Clear any cached data
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name)
      })
    })
  }

  // Reload the page
  window.location.reload()
}

function handleRetry() {
  if (lastAction.value) {
    hasError.value = false
    errorInfo.value = null

    try {
      lastAction.value()
    } catch (error) {
      // If retry fails, show error again
      setTimeout(() => {
        const errorDetails = handleError(error, {
          retry: true,
          timestamp: Date.now(),
        })
        hasError.value = true
        errorInfo.value = errorDetails
      }, 100)
    }
  }
}

// Expose method to manually trigger error boundary
function triggerError(error: Error, action?: Function) {
  const errorDetails = handleError(error, {
    manual: true,
    timestamp: Date.now(),
  })

  hasError.value = true
  errorInfo.value = errorDetails
  lastAction.value = action || null
}

defineExpose({
  triggerError,
})
</script>

<style scoped>
.error-boundary {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
}

pre {
  font-family: 'JetBrains Mono', 'Menlo', 'Monaco', monospace;
  font-size: 10px;
  line-height: 1.4;
}

details[open] summary {
  margin-bottom: 8px;
}
</style>