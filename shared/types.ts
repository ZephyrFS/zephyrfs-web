// Shared types between server and client

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  lastModified: Date;
  path: string;
  encrypted: boolean;
  mimeType?: string;
  checksum?: string;
}

export interface DirectoryListing {
  path: string;
  files: FileItem[];
  totalSize: number;
  totalFiles: number;
}

export interface UploadRequest {
  filename: string;
  size: number;
  path: string;
  encrypted?: boolean;
  mimeType?: string;
}

export interface UploadResponse {
  fileId: string;
  uploadUrl: string;
  chunkSize: number;
  totalChunks: number;
}

export interface DownloadRequest {
  fileId: string;
  path: string;
}

export interface DownloadResponse {
  downloadUrl: string;
  filename: string;
  size: number;
  mimeType?: string;
}

export interface NodeStatus {
  id: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  storageUsed: number;
  storageTotal: number;
  peersConnected: number;
  lastSeen: Date;
}

export interface NetworkStatus {
  nodes: NodeStatus[];
  totalStorage: number;
  usedStorage: number;
  redundancyLevel: number;
  healthScore: number;
}

export interface AuthRequest {
  username?: string;
  password?: string;
  token?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
  };
}

export interface ApiError {
  error: string;
  message: string;
  code: number;
  timestamp: Date;
}