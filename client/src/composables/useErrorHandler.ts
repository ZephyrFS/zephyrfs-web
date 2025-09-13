import { ref } from 'vue'

export interface ErrorInfo {
  id: string
  type: 'network' | 'validation' | 'auth' | 'server' | 'client' | 'unknown'
  message: string
  details?: string
  timestamp: Date
  retryable: boolean
  context?: Record<string, any>
}

const errors = ref<ErrorInfo[]>([])

export function useErrorHandler() {
  function handleError(error: any, context?: Record<string, any>): ErrorInfo {
    const errorInfo = parseError(error, context)

    // Store error for debugging
    errors.value.unshift(errorInfo)

    // Keep only last 50 errors
    if (errors.value.length > 50) {
      errors.value.splice(50)
    }

    // Show user notification
    showErrorNotification(errorInfo)

    // Log error for development
    if (import.meta.env.DEV) {
      console.error('Error handled:', errorInfo, error)
    }

    return errorInfo
  }

  function parseError(error: any, context?: Record<string, any>): ErrorInfo {
    const id = crypto.randomUUID()
    const timestamp = new Date()

    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return {
        id,
        type: 'network',
        message: 'Network connection failed',
        details: 'Please check your internet connection and try again.',
        timestamp,
        retryable: true,
        context,
      }
    }

    // Fetch/Axios errors
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      if (status === 401) {
        return {
          id,
          type: 'auth',
          message: 'Authentication required',
          details: 'Please log in again to continue.',
          timestamp,
          retryable: false,
          context,
        }
      }

      if (status === 403) {
        return {
          id,
          type: 'auth',
          message: 'Access denied',
          details: 'You do not have permission to perform this action.',
          timestamp,
          retryable: false,
          context,
        }
      }

      if (status === 404) {
        return {
          id,
          type: 'client',
          message: 'Resource not found',
          details: 'The requested resource could not be found.',
          timestamp,
          retryable: false,
          context,
        }
      }

      if (status === 413) {
        return {
          id,
          type: 'validation',
          message: 'File too large',
          details: 'The file you are trying to upload exceeds the maximum size limit.',
          timestamp,
          retryable: false,
          context,
        }
      }

      if (status === 422) {
        return {
          id,
          type: 'validation',
          message: 'Invalid data',
          details: data?.message || 'Please check your input and try again.',
          timestamp,
          retryable: false,
          context,
        }
      }

      if (status === 429) {
        return {
          id,
          type: 'client',
          message: 'Too many requests',
          details: 'Please wait a moment before trying again.',
          timestamp,
          retryable: true,
          context,
        }
      }

      if (status >= 500) {
        return {
          id,
          type: 'server',
          message: 'Server error',
          details: 'Something went wrong on our end. Please try again later.',
          timestamp,
          retryable: true,
          context,
        }
      }

      return {
        id,
        type: 'unknown',
        message: data?.message || 'An unexpected error occurred',
        details: data?.details || `HTTP ${status} error`,
        timestamp,
        retryable: status >= 500,
        context,
      }
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.type === 'validation') {
      return {
        id,
        type: 'validation',
        message: error.message || 'Validation failed',
        details: 'Please check your input and try again.',
        timestamp,
        retryable: false,
        context,
      }
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.code === 'ECONNABORTED') {
      return {
        id,
        type: 'network',
        message: 'Request timeout',
        details: 'The request took too long to complete. Please try again.',
        timestamp,
        retryable: true,
        context,
      }
    }

    // Generic error fallback
    return {
      id,
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      details: 'Please try again or contact support if the problem persists.',
      timestamp,
      retryable: true,
      context,
    }
  }

  function showErrorNotification(errorInfo: ErrorInfo) {
    if (!window.$notify) return

    const title = getErrorTitle(errorInfo.type)
    const duration = errorInfo.retryable ? 8000 : 5000

    window.$notify.error(errorInfo.message, title, duration)
  }

  function getErrorTitle(type: ErrorInfo['type']): string {
    switch (type) {
      case 'network':
        return 'Connection Error'
      case 'auth':
        return 'Authentication Error'
      case 'validation':
        return 'Validation Error'
      case 'server':
        return 'Server Error'
      case 'client':
        return 'Client Error'
      default:
        return 'Error'
    }
  }

  function clearErrors() {
    errors.value = []
  }

  function getRecentErrors(limit = 10) {
    return errors.value.slice(0, limit)
  }

  function retry(originalFunction: Function, errorInfo: ErrorInfo) {
    if (!errorInfo.retryable) {
      window.$notify?.warning('This action cannot be retried')
      return
    }

    try {
      return originalFunction()
    } catch (error) {
      handleError(error, { ...errorInfo.context, retry: true })
    }
  }

  return {
    handleError,
    clearErrors,
    getRecentErrors,
    retry,
    errors: errors.value,
  }
}

// Global error handler for uncaught errors
export function setupGlobalErrorHandler() {
  const { handleError } = useErrorHandler()

  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    handleError(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, {
      type: 'unhandled_promise_rejection',
    })
  })

  // Handle Vue errors (if using Vue)
  if (window.Vue) {
    window.Vue.config.errorHandler = (error: Error, instance: any, info: string) => {
      handleError(error, {
        component: instance?.$options.name || 'Unknown',
        info,
      })
    }
  }
}