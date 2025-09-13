import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().default('/'),
  encrypted: z.boolean().optional().default(false),
});

const renameFolderSchema = z.object({
  newName: z.string().min(1).max(255),
});

const moveFolderSchema = z.object({
  sourcePath: z.string(),
  targetPath: z.string(),
});

export async function foldersRoutes(fastify: FastifyInstance) {
  // Create folder
  fastify.post<{
    Body: z.infer<typeof createFolderSchema>;
  }>('/files/folder', {
    schema: {
      body: createFolderSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, path, encrypted } = request.body as z.infer<typeof createFolderSchema>;

    try {
      // Validate folder name
      const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
      if (invalidChars.test(name)) {
        throw fastify.httpErrors.badRequest('Folder name contains invalid characters');
      }

      // Check for reserved names
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
      if (reservedNames.includes(name.toUpperCase())) {
        throw fastify.httpErrors.badRequest('This folder name is reserved');
      }

      // Trim and validate
      const folderName = name.trim();
      if (!folderName || folderName.startsWith('.') || folderName.endsWith('.')) {
        throw fastify.httpErrors.badRequest('Invalid folder name');
      }

      // Check if folder already exists
      try {
        const listing = await fastify.zephyrfs.listFiles(path);
        const existingFolder = listing.files.find(f => f.name === folderName && f.type === 'directory');
        if (existingFolder) {
          throw fastify.httpErrors.conflict('Folder already exists');
        }
      } catch (error) {
        // If listing fails, the parent directory doesn't exist
        if (error.statusCode === 404) {
          throw fastify.httpErrors.notFound('Parent directory does not exist');
        }
        throw error;
      }

      // Create folder by creating a marker file (since most storage systems don't support empty directories)
      const folderPath = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
      const markerFileName = '.zephyrfs_folder_marker';
      const markerContent = JSON.stringify({
        type: 'directory',
        name: folderName,
        created: new Date().toISOString(),
        encrypted: encrypted,
      });

      const markerBuffer = Buffer.from(markerContent, 'utf-8');
      await fastify.zephyrfs.uploadFile(folderPath, markerFileName, markerBuffer, {
        encrypted: false, // Marker files are always unencrypted for metadata
      });

      return {
        success: true,
        path: folderPath,
        name: folderName,
        encrypted: encrypted,
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to create folder');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to create folder');
    }
  });

  // Rename folder
  fastify.patch<{
    Params: { path: string };
    Body: z.infer<typeof renameFolderSchema>;
  }>('/files/folder/:path(*)', {
    schema: {
      body: renameFolderSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const folderPath = '/' + (request.params as any).path;
    const { newName } = request.body as z.infer<typeof renameFolderSchema>;

    try {
      // Validate new name
      const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
      if (invalidChars.test(newName)) {
        throw fastify.httpErrors.badRequest('Folder name contains invalid characters');
      }

      const trimmedName = newName.trim();
      if (!trimmedName || trimmedName.startsWith('.') || trimmedName.endsWith('.')) {
        throw fastify.httpErrors.badRequest('Invalid folder name');
      }

      // Get parent path
      const pathParts = folderPath.split('/').filter(Boolean);
      const parentPath = pathParts.length > 1 ? '/' + pathParts.slice(0, -1).join('/') : '/';

      // Check if target name already exists
      try {
        const parentListing = await fastify.zephyrfs.listFiles(parentPath);
        const existingItem = parentListing.files.find(f => f.name === trimmedName);
        if (existingItem) {
          throw fastify.httpErrors.conflict('An item with this name already exists');
        }
      } catch (error) {
        if (error.statusCode === 404) {
          throw fastify.httpErrors.notFound('Parent directory does not exist');
        }
        throw error;
      }

      // For now, return not implemented since folder renaming requires moving all contained files
      // This would need to be implemented in the ZephyrFS core with proper atomic operations
      throw fastify.httpErrors.notImplemented('Folder renaming is not yet implemented');

    } catch (error) {
      fastify.log.error(error, 'Failed to rename folder');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to rename folder');
    }
  });

  // Move folder
  fastify.post<{
    Body: z.infer<typeof moveFolderSchema>;
  }>('/files/folder/move', {
    schema: {
      body: moveFolderSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sourcePath, targetPath } = request.body as z.infer<typeof moveFolderSchema>;

    try {
      // For now, return not implemented since folder moving requires atomic operations
      // This would need to be implemented in the ZephyrFS core
      throw fastify.httpErrors.notImplemented('Folder moving is not yet implemented');

    } catch (error) {
      fastify.log.error(error, 'Failed to move folder');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to move folder');
    }
  });

  // Delete empty folder
  fastify.delete<{
    Params: { path: string };
  }>('/files/folder/:path(*)', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const folderPath = '/' + (request.params as any).path;

    try {
      // Check if folder exists and is empty
      const listing = await fastify.zephyrfs.listFiles(folderPath);

      // Filter out the marker file
      const realFiles = listing.files.filter(f => f.name !== '.zephyrfs_folder_marker');

      if (realFiles.length > 0) {
        throw fastify.httpErrors.badRequest('Folder is not empty');
      }

      // Delete the marker file
      const markerFile = listing.files.find(f => f.name === '.zephyrfs_folder_marker');
      if (markerFile) {
        await fastify.zephyrfs.deleteFile(markerFile.id);
      }

      return { success: true };

    } catch (error) {
      fastify.log.error(error, 'Failed to delete folder');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to delete folder');
    }
  });
}