import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  DirectoryListing,
  UploadRequest,
  UploadResponse,
  DownloadRequest,
  DownloadResponse,
  FileItem
} from '../../shared/types.js';
import { z } from 'zod';

const listFilesSchema = z.object({
  path: z.string().optional().default('/'),
});

const uploadSchema = z.object({
  path: z.string().default('/'),
  encrypted: z.boolean().optional(),
});

const fileIdSchema = z.object({
  fileId: z.string().min(1),
});

declare module 'fastify' {
  interface FastifyInstance {
    zephyrfs: import('../integration/zephyrfs-client.js').ZephyrFSClient;
  }
}

export async function filesRoutes(fastify: FastifyInstance) {
  // List files in directory
  fastify.get<{
    Querystring: z.infer<typeof listFilesSchema>;
  }>('/files', {
    schema: {
      querystring: listFilesSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { path } = request.query as z.infer<typeof listFilesSchema>;

    try {
      const listing = await fastify.zephyrfs.listFiles(path);
      return listing;
    } catch (error) {
      fastify.log.error(error, 'Failed to list files');
      throw fastify.httpErrors.internalServerError('Failed to list files');
    }
  });

  // Upload file
  fastify.post<{
    Body: z.infer<typeof uploadSchema>;
  }>('/files/upload', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parts = request.parts();
      let fileData: Buffer | undefined;
      let filename: string | undefined;
      let path = '/';
      let encrypted = false;

      for await (const part of parts) {
        if (part.type === 'file') {
          filename = part.filename;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileData = Buffer.concat(chunks);
        } else if (part.type === 'field') {
          const fieldName = part.fieldname;
          const value = part.value as string;

          switch (fieldName) {
            case 'path':
              path = value;
              break;
            case 'encrypted':
              encrypted = value === 'true';
              break;
          }
        }
      }

      if (!fileData || !filename) {
        throw fastify.httpErrors.badRequest('File and filename are required');
      }

      const result = await fastify.zephyrfs.uploadFile(path, filename, fileData, {
        encrypted,
      });

      const response: UploadResponse = {
        fileId: result.fileId,
        uploadUrl: `/api/files/${result.fileId}`,
        chunkSize: 1024 * 1024, // 1MB
        totalChunks: Math.ceil(result.size / (1024 * 1024)),
      };

      return response;
    } catch (error) {
      fastify.log.error(error, 'Failed to upload file');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to upload file');
    }
  });

  // Download file
  fastify.get<{
    Params: z.infer<typeof fileIdSchema>;
    Querystring: { range?: string };
  }>('/files/:fileId/download', {
    schema: {
      params: fileIdSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileId } = request.params as z.infer<typeof fileIdSchema>;
    const rangeHeader = request.headers.range;

    try {
      let options = {};

      if (rangeHeader) {
        const range = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(range[0]);
        const end = range[1] ? parseInt(range[1]) : undefined;
        options = { range: { start, end } };
      }

      const download = await fastify.zephyrfs.downloadFile(fileId, options);

      // Set response headers
      reply.header('Content-Disposition', `attachment; filename="${download.filename}"`);
      reply.header('Content-Length', download.size.toString());

      if (download.mimeType) {
        reply.header('Content-Type', download.mimeType);
      }

      if (rangeHeader) {
        reply.code(206); // Partial Content
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Range', `bytes ${options.range?.start || 0}-${options.range?.end || download.size - 1}/${download.size}`);
      }

      // Stream the file
      return reply.send(download.stream);
    } catch (error) {
      fastify.log.error(error, 'Failed to download file');
      throw fastify.httpErrors.notFound('File not found');
    }
  });

  // Get file info
  fastify.get<{
    Params: z.infer<typeof fileIdSchema>;
  }>('/files/:fileId/info', {
    schema: {
      params: fileIdSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileId } = request.params as z.infer<typeof fileIdSchema>;

    try {
      const fileInfo = await fastify.zephyrfs.getFileInfo(fileId);
      return fileInfo;
    } catch (error) {
      fastify.log.error(error, 'Failed to get file info');
      throw fastify.httpErrors.notFound('File not found');
    }
  });

  // Delete file
  fastify.delete<{
    Params: z.infer<typeof fileIdSchema>;
  }>('/files/:fileId', {
    schema: {
      params: fileIdSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileId } = request.params as z.infer<typeof fileIdSchema>;

    try {
      await fastify.zephyrfs.deleteFile(fileId);
      return { success: true };
    } catch (error) {
      fastify.log.error(error, 'Failed to delete file');
      throw fastify.httpErrors.notFound('File not found');
    }
  });
}