<template>
  <AppLayout>
    <div class="settings-view">
      <div class="max-w-4xl mx-auto py-8 px-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

        <!-- Settings sections -->
        <div class="space-y-8">
          <!-- Appearance -->
          <div class="card">
            <div class="card-header">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Customize the look and feel</p>
            </div>
            <div class="card-body space-y-4">
              <!-- Theme -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Choose your preferred color scheme</p>
                </div>
                <select
                  v-model="settings.theme"
                  @change="updateSetting('theme', $event.target.value)"
                  class="input w-32"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <!-- Language -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Select your preferred language</p>
                </div>
                <select
                  v-model="settings.language"
                  @change="updateSetting('language', $event.target.value)"
                  class="input w-32"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <!-- File view -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Default file view</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">How files are displayed by default</p>
                </div>
                <select
                  v-model="settings.defaultFileView"
                  @change="updateSetting('defaultFileView', $event.target.value)"
                  class="input w-32"
                >
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Files & Storage -->
          <div class="card">
            <div class="card-header">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Files & Storage</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Configure file handling preferences</p>
            </div>
            <div class="card-body space-y-4">
              <!-- Auto-encrypt -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-encrypt uploads</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Automatically encrypt all uploaded files</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="settings.autoEncrypt"
                    @change="updateSetting('autoEncrypt', $event.target.checked)"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <!-- Default upload folder -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Default upload folder</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Where new files are uploaded by default</p>
                </div>
                <input
                  v-model="settings.defaultUploadFolder"
                  @blur="updateSetting('defaultUploadFolder', $event.target.value)"
                  type="text"
                  placeholder="/uploads"
                  class="input w-48"
                />
              </div>

              <!-- Max file size -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Max upload size</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Maximum file size for uploads</p>
                </div>
                <select
                  v-model="settings.maxUploadSize"
                  @change="updateSetting('maxUploadSize', parseInt($event.target.value))"
                  class="input w-32"
                >
                  <option :value="100 * 1024 * 1024">100 MB</option>
                  <option :value="500 * 1024 * 1024">500 MB</option>
                  <option :value="1024 * 1024 * 1024">1 GB</option>
                  <option :value="5 * 1024 * 1024 * 1024">5 GB</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Privacy & Security -->
          <div class="card">
            <div class="card-header">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Privacy & Security</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Control your privacy and security settings</p>
            </div>
            <div class="card-body space-y-4">
              <!-- Session timeout -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Session timeout</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Automatically log out after inactivity</p>
                </div>
                <select
                  v-model="settings.sessionTimeout"
                  @change="updateSetting('sessionTimeout', parseInt($event.target.value))"
                  class="input w-32"
                >
                  <option :value="30">30 minutes</option>
                  <option :value="60">1 hour</option>
                  <option :value="240">4 hours</option>
                  <option :value="480">8 hours</option>
                  <option :value="0">Never</option>
                </select>
              </div>

              <!-- Clear data on logout -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Clear data on logout</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Remove cached data when you log out</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="settings.clearDataOnLogout"
                    @change="updateSetting('clearDataOnLogout', $event.target.checked)"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Notifications -->
          <div class="card">
            <div class="card-header">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Choose what notifications you receive</p>
            </div>
            <div class="card-body space-y-4">
              <!-- Upload notifications -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Upload notifications</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Show notifications when uploads complete</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="settings.notifyUploads"
                    @change="updateSetting('notifyUploads', $event.target.checked)"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <!-- Error notifications -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Error notifications</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Show notifications when errors occur</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="settings.notifyErrors"
                    @change="updateSetting('notifyErrors', $event.target.checked)"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="card">
            <div class="card-header">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Actions</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Manage your account and data</p>
            </div>
            <div class="card-body space-y-4">
              <!-- Export settings -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Export settings</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Download your settings as a file</p>
                </div>
                <button @click="exportSettings" class="btn btn-outline">
                  Export
                </button>
              </div>

              <!-- Import settings -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Import settings</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Restore settings from a file</p>
                </div>
                <div class="flex items-center space-x-2">
                  <input
                    ref="importInput"
                    type="file"
                    accept=".json"
                    @change="importSettings"
                    class="hidden"
                  />
                  <button @click="$refs.importInput.click()" class="btn btn-outline">
                    Import
                  </button>
                </div>
              </div>

              <!-- Reset settings -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Reset to defaults</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Restore all settings to their default values</p>
                </div>
                <button @click="resetSettings" class="btn btn-danger">
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'

interface Settings {
  theme: 'system' | 'light' | 'dark'
  language: string
  defaultFileView: 'grid' | 'list'
  autoEncrypt: boolean
  defaultUploadFolder: string
  maxUploadSize: number
  sessionTimeout: number
  clearDataOnLogout: boolean
  notifyUploads: boolean
  notifyErrors: boolean
}

const defaultSettings: Settings = {
  theme: 'system',
  language: 'en',
  defaultFileView: 'grid',
  autoEncrypt: false,
  defaultUploadFolder: '/uploads',
  maxUploadSize: 1024 * 1024 * 1024, // 1GB
  sessionTimeout: 60, // 1 hour
  clearDataOnLogout: true,
  notifyUploads: true,
  notifyErrors: true,
}

const settings = reactive<Settings>({ ...defaultSettings })
const importInput = ref<HTMLInputElement>()

function loadSettings() {
  try {
    const saved = localStorage.getItem('zephyrfs_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      Object.assign(settings, { ...defaultSettings, ...parsed })
    }
  } catch (error) {
    console.warn('Failed to load settings:', error)
  }
}

function saveSettings() {
  try {
    localStorage.setItem('zephyrfs_settings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
    if (window.$notify) {
      window.$notify.error('Failed to save settings')
    }
  }
}

function updateSetting(key: keyof Settings, value: any) {
  (settings as any)[key] = value
  saveSettings()

  // Apply certain settings immediately
  if (key === 'theme') {
    applyTheme(value)
  }

  if (window.$notify) {
    window.$notify.success('Setting updated')
  }
}

function applyTheme(theme: string) {
  const html = document.documentElement

  if (theme === 'dark') {
    html.classList.add('dark')
  } else if (theme === 'light') {
    html.classList.remove('dark')
  } else {
    // System theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.classList.toggle('dark', prefersDark)
  }
}

function exportSettings() {
  try {
    const data = JSON.stringify(settings, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `zephyrfs-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    if (window.$notify) {
      window.$notify.success('Settings exported successfully')
    }
  } catch (error) {
    console.error('Failed to export settings:', error)
    if (window.$notify) {
      window.$notify.error('Failed to export settings')
    }
  }
}

function importSettings(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target?.result as string)
      Object.assign(settings, { ...defaultSettings, ...imported })
      saveSettings()

      // Apply theme immediately
      applyTheme(settings.theme)

      if (window.$notify) {
        window.$notify.success('Settings imported successfully')
      }
    } catch (error) {
      console.error('Failed to import settings:', error)
      if (window.$notify) {
        window.$notify.error('Failed to import settings. Please check the file format.')
      }
    }
  }

  reader.readAsText(file)

  // Reset input
  if (importInput.value) {
    importInput.value.value = ''
  }
}

function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to their defaults? This action cannot be undone.')) {
    Object.assign(settings, defaultSettings)
    saveSettings()
    applyTheme(settings.theme)

    if (window.$notify) {
      window.$notify.success('Settings reset to defaults')
    }
  }
}

onMounted(() => {
  loadSettings()
  applyTheme(settings.theme)
})
</script>