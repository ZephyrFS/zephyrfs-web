import { Readable } from 'node:stream';
import type { FileItem, DirectoryListing, NodeStatus, NetworkStatus } from '../../shared/types.js';

export interface ZephyrFSClientOptions {
  timeout?: number;
  retries?: number;
}

export interface UploadOptions {
  encrypted?: boolean;
  chunkSize?: number;
}

export interface DownloadOptions {
  range?: { start: number; end?: number };
}

export class ZephyrFSClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(baseUrl: string, options: ZephyrFSClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout ?? 30000;
    this.retries = options.retries ?? 3;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  async listFiles(path: string = '/'): Promise<DirectoryListing> {
    const response = await this.request('GET', `/files${path}`, undefined, {
      'Accept': 'application/json',
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    return response.json();
  }

  async uploadFile(
    path: string,
    filename: string,
    data: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<{ fileId: string; size: number }> {
    const formData = new FormData();

    if (Buffer.isBuffer(data)) {
      formData.append('file', new Blob([data]), filename);
    } else {
      // Convert readable stream to blob for web API compatibility
      const chunks: Uint8Array[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      formData.append('file', new Blob([buffer]), filename);
    }

    formData.append('path', path);
    if (options.encrypted !== undefined) {
      formData.append('encrypted', options.encrypted.toString());
    }

    const response = await this.request('POST', '/files/upload', formData, {
      'Accept': 'application/json',
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async downloadFile(fileId: string, options: DownloadOptions = {}): Promise<{
    stream: ReadableStream<Uint8Array>;
    filename: string;
    size: number;
    mimeType?: string;
  }> {
    const headers: Record<string, string> = {};

    if (options.range) {
      const { start, end } = options.range;
      headers['Range'] = `bytes=${start}-${end ?? ''}`;
    }

    const response = await this.request('GET', `/files/${fileId}/download`, undefined, headers);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body for download');
    }

    return {
      stream: response.body,
      filename: response.headers.get('Content-Disposition')?.split('filename=')[1] || 'unknown',
      size: parseInt(response.headers.get('Content-Length') || '0'),
      mimeType: response.headers.get('Content-Type') || undefined,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await this.request('DELETE', `/files/${fileId}`);

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    const response = await this.request('GET', `/files/${fileId}/info`);

    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.statusText}`);
    }

    return response.json();
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    const response = await this.request('GET', '/status/network');

    if (!response.ok) {
      throw new Error(`Failed to get network status: ${response.statusText}`);
    }

    return response.json();
  }

  async getNodeStatus(): Promise<NodeStatus> {
    const response = await this.request('GET', '/status/node');

    if (!response.ok) {
      throw new Error(`Failed to get node status: ${response.statusText}`);
    }

    return response.json();
  }

  private async request(
    method: string,
    endpoint: string,
    body?: FormData | string | Buffer,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders = new Headers(headers);

    // Don't set Content-Type for FormData - let browser set it with boundary
    if (body && !(body instanceof FormData)) {
      if (typeof body === 'string') {
        requestHeaders.set('Content-Type', 'application/json');
      } else {
        requestHeaders.set('Content-Type', 'application/octet-stream');
      }
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError!;
  }
}