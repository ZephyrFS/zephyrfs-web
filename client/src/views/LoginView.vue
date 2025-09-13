<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          ZephyrFS
        </h1>
        <h2 class="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Sign in to your account
        </h2>
      </div>

      <!-- Login form -->
      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-4">
          <!-- Username field -->
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              class="input"
              :class="{ 'border-red-500': errors.username }"
              placeholder="Enter your username"
              autocomplete="username"
            />
            <p v-if="errors.username" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ errors.username }}
            </p>
          </div>

          <!-- Password field -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                class="input pr-10"
                :class="{ 'border-red-500': errors.password }"
                placeholder="Enter your password"
                autocomplete="current-password"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <EyeIcon v-if="!showPassword" class="w-4 h-4 text-gray-400" />
                <EyeSlashIcon v-else class="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p v-if="errors.password" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ errors.password }}
            </p>
          </div>
        </div>

        <!-- Remember me -->
        <div class="flex items-center justify-between">
          <label class="flex items-center">
            <input
              v-model="form.rememberMe"
              type="checkbox"
              class="mr-2 rounded border-gray-300 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Remember me
            </span>
          </label>

          <button
            type="button"
            class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Forgot password?
          </button>
        </div>

        <!-- Error message -->
        <div v-if="authStore.error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div class="flex items-center">
            <ExclamationTriangleIcon class="w-5 h-5 text-red-500 mr-2" />
            <p class="text-sm text-red-600 dark:text-red-400">
              {{ authStore.error }}
            </p>
          </div>
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="authStore.loading || !isFormValid"
          class="w-full btn btn-primary"
          :class="{ 'opacity-50 cursor-not-allowed': authStore.loading || !isFormValid }"
        >
          <div v-if="authStore.loading" class="spinner w-4 h-4 mr-2"></div>
          {{ authStore.loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <!-- Demo credentials -->
      <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <h3 class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
          Demo Credentials
        </h3>
        <div class="space-y-1 text-sm text-blue-600 dark:text-blue-400">
          <p><strong>Admin:</strong> username: admin, password: admin</p>
          <p><strong>Demo:</strong> username: demo, password: demo</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Secure, decentralized file storage with zero-knowledge encryption
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

// Store and router
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// Form state
const form = ref({
  username: '',
  password: '',
  rememberMe: false,
})

const showPassword = ref(false)
const errors = ref<Record<string, string>>({})

// Computed
const isFormValid = computed(() => {
  return form.value.username.trim().length > 0 && form.value.password.length > 0
})

// Methods
async function handleLogin() {
  if (!isFormValid.value) return

  // Clear previous errors
  errors.value = {}
  authStore.clearError()

  // Validate form
  if (form.value.username.trim().length < 2) {
    errors.value.username = 'Username must be at least 2 characters'
    return
  }

  if (form.value.password.length < 3) {
    errors.value.password = 'Password must be at least 3 characters'
    return
  }

  try {
    await authStore.login({
      username: form.value.username.trim(),
      password: form.value.password,
    })

    // Redirect to intended page or dashboard
    const redirectTo = (route.query.redirect as string) || '/'
    router.push(redirectTo)
  } catch (error) {
    // Error is handled by the store
    console.error('Login failed:', error)
  }
}

// Auto-fill demo credentials for development
onMounted(() => {
  if (import.meta.env.DEV) {
    form.value.username = 'admin'
    form.value.password = 'admin'
  }
})
</script>