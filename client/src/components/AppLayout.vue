<template>
  <div class="app-layout min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="isMobileSidebarOpen"
      class="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
      @click="closeMobileSidebar"
    ></div>

    <!-- Sidebar -->
    <div
      class="sidebar fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform lg:translate-x-0 lg:static lg:inset-0"
      :class="{
        'translate-x-0': isMobileSidebarOpen,
        '-translate-x-full': !isMobileSidebarOpen
      }"
    >
      <!-- Sidebar header -->
      <div class="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
          ZephyrFS
        </h1>
        <button
          @click="closeMobileSidebar"
          class="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 py-4 space-y-1">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.to"
          class="nav-link group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :class="[
            $route.name === item.name || $route.path.startsWith(item.to)
              ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          ]"
          @click="closeMobileSidebar"
        >
          <component
            :is="item.icon"
            class="w-5 h-5 mr-3"
            :class="[
              $route.name === item.name || $route.path.startsWith(item.to)
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            ]"
          />
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- Network status -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <NetworkStatus />
      </div>

      <!-- User menu -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <Menu as="div" class="relative">
          <MenuButton class="flex items-center w-full text-left">
            <img
              class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600"
              :src="`https://ui-avatars.com/api/?name=${authStore.user?.username}&background=3b82f6&color=fff`"
              :alt="authStore.user?.username"
            />
            <div class="ml-3 flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {{ authStore.user?.username }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Online
              </p>
            </div>
            <ChevronUpDownIcon class="w-4 h-4 text-gray-400" />
          </MenuButton>

          <MenuItems class="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
            <MenuItem v-slot="{ active }">
              <RouterLink
                to="/settings"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
                :class="{ 'bg-gray-100 dark:bg-gray-700': active }"
                @click="closeMobileSidebar"
              >
                Settings
              </RouterLink>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                @click="handleLogout"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
                :class="{ 'bg-gray-100 dark:bg-gray-700': active }"
              >
                Sign out
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </div>

    <!-- Main content -->
    <div class="lg:pl-64">
      <!-- Top bar -->
      <div class="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16">
        <div class="flex items-center justify-between h-full px-4">
          <!-- Mobile menu button -->
          <button
            @click="openMobileSidebar"
            class="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Bars3Icon class="w-5 h-5" />
          </button>

          <!-- Page title -->
          <div class="flex-1 lg:flex-none">
            <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ pageTitle }}
            </h1>
          </div>

          <!-- Top bar actions -->
          <div class="flex items-center space-x-3">
            <!-- Theme toggle -->
            <button
              @click="toggleTheme"
              class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Toggle theme"
            >
              <SunIcon v-if="isDark" class="w-5 h-5" />
              <MoonIcon v-else class="w-5 h-5" />
            </button>

            <!-- Notifications -->
            <button
              class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 relative"
              title="Notifications"
            >
              <BellIcon class="w-5 h-5" />
              <span v-if="hasNotifications" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Page content -->
      <main class="flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  Bars3Icon,
  XMarkIcon,
  ChevronUpDownIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  HomeIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
} from '@heroicons/vue/24/outline'
import NetworkStatus from './NetworkStatus.vue'

// Store and router
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// State
const isMobileSidebarOpen = ref(false)
const isDark = ref(false)
const hasNotifications = ref(false)

// Navigation items
const navigation = [
  { name: 'dashboard', label: 'Dashboard', to: '/', icon: HomeIcon },
  { name: 'files', label: 'Files', to: '/files', icon: FolderIcon },
  { name: 'upload', label: 'Upload', to: '/upload', icon: ArrowUpTrayIcon },
  { name: 'settings', label: 'Settings', to: '/settings', icon: Cog6ToothIcon },
  { name: 'about', label: 'About', to: '/about', icon: InformationCircleIcon },
]

// Computed
const pageTitle = computed(() => {
  const currentRoute = navigation.find(item =>
    route.name === item.name || route.path.startsWith(item.to)
  )
  return currentRoute?.label || 'ZephyrFS'
})

// Methods
function openMobileSidebar() {
  isMobileSidebarOpen.value = true
}

function closeMobileSidebar() {
  isMobileSidebarOpen.value = false
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

// Initialize theme
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  isDark.value = true
  document.documentElement.classList.add('dark')
}
</script>

<style scoped>
.sidebar {
  transition: transform 0.3s ease-in-out;
}

.nav-link {
  @apply focus-ring;
}

@media (max-width: 1023px) {
  .sidebar {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
}
</style>