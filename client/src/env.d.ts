/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

// Global notification interface
declare global {
  interface Window {
    $notify: {
      success: (message: string, title?: string, duration?: number) => void
      error: (message: string, title?: string, duration?: number) => void
      warning: (message: string, title?: string, duration?: number) => void
      info: (message: string, title?: string, duration?: number) => void
    }
  }
}

export {}