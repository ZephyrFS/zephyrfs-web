import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/services/api'
import type { AuthRequest, AuthResponse } from '@shared/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<{ id: string; username: string } | null>(null)
  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // Actions
  async function login(credentials: AuthRequest): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.login(credentials)
      await setAuthData(response)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true

    try {
      await apiClient.logout()
    } catch (err) {
      // Ignore logout errors
      console.warn('Logout request failed:', err)
    } finally {
      clearAuthData()
      loading.value = false
    }
  }

  async function refreshAuthToken(): Promise<void> {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await apiClient.refreshAuth(refreshToken.value)
      await setAuthData(response)
    } catch (err) {
      clearAuthData()
      throw err
    }
  }

  async function initializeAuth(): Promise<void> {
    if (initialized.value) return

    // Check for stored tokens
    const storedToken = localStorage.getItem('auth_token')
    const storedRefreshToken = localStorage.getItem('refresh_token')

    if (storedToken && storedRefreshToken) {
      token.value = storedToken
      refreshToken.value = storedRefreshToken

      try {
        // Verify token by fetching user info
        user.value = await apiClient.getCurrentUser()
      } catch (err) {
        // Token is invalid, try to refresh
        try {
          await refreshAuthToken()
        } catch (refreshErr) {
          clearAuthData()
        }
      }
    }

    initialized.value = true
  }

  async function setAuthData(authResponse: AuthResponse): Promise<void> {
    token.value = authResponse.token
    refreshToken.value = authResponse.refreshToken
    user.value = authResponse.user

    // Persist to localStorage
    localStorage.setItem('auth_token', authResponse.token)
    localStorage.setItem('refresh_token', authResponse.refreshToken)

    // Clear any previous errors
    error.value = null
  }

  function clearAuthData(): void {
    user.value = null
    token.value = null
    refreshToken.value = null

    // Clear from localStorage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // State
    user,
    token,
    refreshToken,
    loading,
    error,
    initialized,

    // Getters
    isAuthenticated,

    // Actions
    login,
    logout,
    refreshAuthToken,
    initializeAuth,
    setAuthData,
    clearAuthData,
    clearError,
  }
})