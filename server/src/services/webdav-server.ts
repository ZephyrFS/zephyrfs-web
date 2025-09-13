import { v2 as webdav } from 'webdav-server';
import type { ZephyrFSClient } from '../integration/zephyrfs-client.js';
import { Readable } from 'node:stream';

export class ZephyrFSWebDAVFileSystem extends webdav.FileSystem {
  private zephyrfs: ZephyrFSClient;

  constructor(zephyrfsClient: ZephyrFSClient) {
    super();
    this.zephyrfs = zephyrfsClient;
  }

  _lockManager(): webdav.LockManager {
    return new webdav.LocalLockManager();
  }

  _propertyManager(): webdav.PropertyManager {
    return new webdav.LocalPropertyManager();
  }

  async _fastExistCheck(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      if (path.isRoot()) {
        return callback(null, true);
      }

      // Try to get file info to check if it exists
      await this.zephyrfs.listFiles(path.toString());
      callback(null, true);
    } catch (error) {
      callback(null, false);
    }
  }

  async _type(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      if (path.isRoot()) {
        return callback(null, webdav.ResourceType.Directory);
      }

      const listing = await this.zephyrfs.listFiles(path.getParent().toString());
      const fileName = path.fileName();
      const file = listing.files.find(f => f.name === fileName);

      if (!file) {
        return callback(webdav.Errors.ResourceNotFound);
      }

      callback(null, file.type === 'directory' ? webdav.ResourceType.Directory : webdav.ResourceType.File);
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _size(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const listing = await this.zephyrfs.listFiles(path.getParent().toString());
      const fileName = path.fileName();
      const file = listing.files.find(f => f.name === fileName);

      if (!file) {
        return callback(webdav.Errors.ResourceNotFound);
      }

      callback(null, file.size);
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _lastModifiedDate(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const listing = await this.zephyrfs.listFiles(path.getParent().toString());
      const fileName = path.fileName();
      const file = listing.files.find(f => f.name === fileName);

      if (!file) {
        return callback(webdav.Errors.ResourceNotFound);
      }

      callback(null, file.lastModified.getTime());
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _readDir(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const listing = await this.zephyrfs.listFiles(path.toString());
      const children = listing.files.map(file => file.name);
      callback(null, children);
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _openReadStream(ctx: webdav.RequestContext, path: webdav.Path, info: webdav.OpenReadStreamInfo, callback: webdav.SimpleCallback): Promise<void> {
    try {
      // Get file info first to get the file ID
      const listing = await this.zephyrfs.listFiles(path.getParent().toString());
      const fileName = path.fileName();
      const file = listing.files.find(f => f.name === fileName);

      if (!file) {
        return callback(webdav.Errors.ResourceNotFound);
      }

      const download = await this.zephyrfs.downloadFile(file.id);

      // Convert web ReadableStream to Node.js Readable
      const nodeStream = new Readable({
        read() {} // No-op, we'll push data manually
      });

      const reader = download.stream.getReader();

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              nodeStream.push(null); // End stream
              break;
            }
            nodeStream.push(Buffer.from(value));
          }
        } catch (error) {
          nodeStream.destroy(error);
        }
      };

      pump();

      callback(null, nodeStream);
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _openWriteStream(ctx: webdav.RequestContext, path: webdav.Path, info: webdav.OpenWriteStreamInfo, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const chunks: Buffer[] = [];
      const writeStream = new (require('stream').Writable)({
        write(chunk: Buffer, encoding: string, callback: Function) {
          chunks.push(chunk);
          callback();
        },
        final: async (callback: Function) => {
          try {
            const data = Buffer.concat(chunks);
            const fileName = path.fileName();
            const parentPath = path.getParent().toString();

            await this.zephyrfs.uploadFile(parentPath, fileName, data);
            callback();
          } catch (error) {
            callback(error);
          }
        }
      });

      callback(null, writeStream);
    } catch (error) {
      callback(error);
    }
  }

  async _delete(ctx: webdav.RequestContext, path: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    try {
      // Get file info to get the file ID
      const listing = await this.zephyrfs.listFiles(path.getParent().toString());
      const fileName = path.fileName();
      const file = listing.files.find(f => f.name === fileName);

      if (!file) {
        return callback(webdav.Errors.ResourceNotFound);
      }

      await this.zephyrfs.deleteFile(file.id);
      callback(null);
    } catch (error) {
      callback(webdav.Errors.ResourceNotFound);
    }
  }

  async _create(ctx: webdav.RequestContext, path: webdav.Path, type: webdav.ResourceType, callback: webdav.SimpleCallback): Promise<void> {
    if (type === webdav.ResourceType.Directory) {
      // Directories are created implicitly when files are uploaded to them
      callback(null);
    } else {
      // Files are created when written to
      callback(null);
    }
  }

  async _move(ctx: webdav.RequestContext, pathFrom: webdav.Path, pathTo: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    // Move/rename not implemented in basic version
    callback(webdav.Errors.MethodNotAllowed);
  }

  async _copy(ctx: webdav.RequestContext, pathFrom: webdav.Path, pathTo: webdav.Path, callback: webdav.SimpleCallback): Promise<void> {
    // Copy not implemented in basic version
    callback(webdav.Errors.MethodNotAllowed);
  }
}

export function createWebDAVServer(zephyrfsClient: ZephyrFSClient, options: {
  port?: number;
  host?: string;
  username?: string;
  password?: string;
} = {}) {
  const server = new webdav.WebDAVServer({
    port: options.port || 3001,
    hostname: options.host || '0.0.0.0',
  });

  // Add authentication if provided
  if (options.username && options.password) {
    const userManager = new webdav.SimpleUserManager();
    const user = userManager.addUser(options.username, options.password);

    server.setDefaultUser(user);
    server.setHTTPAuthentication(new webdav.HTTPBasicAuthentication(userManager));
  }

  // Set up the file system
  server.setFileSystem('/', new ZephyrFSWebDAVFileSystem(zephyrfsClient));

  return server;
}