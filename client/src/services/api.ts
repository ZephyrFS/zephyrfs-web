import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type {
  AuthRequest,
  AuthResponse,
  DirectoryListing,
  FileItem,
  UploadResponse,
  NetworkStatus,
  NodeStatus
} from '@shared/types'

class ApiClient {
  private client: AxiosInstance

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) {
            try {
              const response = await this.refreshAuth(refreshToken)
              localStorage.setItem('auth_token', response.token)

              // Retry original request
              const originalRequest = error.config
              originalRequest.headers.Authorization = `Bearer ${response.token}`
              return this.client.request(originalRequest)
            } catch (refreshError) {
              // Refresh failed, redirect to login
              localStorage.removeItem('auth_token')
              localStorage.removeItem('refresh_token')
              window.location.href = '/login'
            }
          } else {
            // No refresh token, redirect to login
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Authentication
  async login(credentials: AuthRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials)
    return response.data
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/refresh', { refreshToken })
    return response.data
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout')
  }

  async getCurrentUser(): Promise<{ id: string; username: string }> {
    const response = await this.client.get('/auth/me')
    return response.data
  }

  // Files
  async listFiles(path: string = '/'): Promise<DirectoryListing> {
    const response = await this.client.get<DirectoryListing>('/files', {
      params: { path },
    })
    return response.data
  }

  async uploadFile(
    file: File,
    path: string = '/',
    options: {
      encrypted?: boolean;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)
    if (options.encrypted !== undefined) {
      formData.append('encrypted', options.encrypted.toString())
    }

    const response = await this.client.post<UploadResponse>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          options.onProgress(progress)
        }
      },
    })
    return response.data
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    })
    return response.data
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    const response = await this.client.get<FileItem>(`/files/${fileId}/info`)
    return response.data
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.client.delete(`/files/${fileId}`)
  }

  // Status
  async getHealthStatus(): Promise<any> {
    const response = await this.client.get('/health')
    return response.data
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    const response = await this.client.get<NetworkStatus>('/status/network')
    return response.data
  }

  async getNodeStatus(): Promise<NodeStatus> {
    const response = await this.client.get<NodeStatus>('/status/node')
    return response.data
  }

  // WebSocket connection for real-time updates
  createStatusWebSocket(): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/status/ws`
    return new WebSocket(wsUrl)
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config)
    return response.data
  }
}

// Create singleton instance
export const apiClient = new ApiClient()
export default apiClient