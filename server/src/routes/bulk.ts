import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';

const bulkDownloadSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100), // Limit to 100 files
  format: z.enum(['zip', 'tar']).default('zip'),
  archiveName: z.string().optional(),
});

const bulkDeleteSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100),
});

const bulkMoveSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100),
  targetPath: z.string(),
});

export async function bulkRoutes(fastify: FastifyInstance) {
  // Bulk download files as archive
  fastify.post<{
    Body: z.infer<typeof bulkDownloadSchema>;
  }>('/files/bulk/download', {
    schema: {
      body: bulkDownloadSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileIds, format, archiveName } = request.body as z.infer<typeof bulkDownloadSchema>;

    try {
      // Create archive
      const archive = archiver(format, {
        zlib: { level: 6 }, // Compression level for zip
      });

      const passThrough = new PassThrough();
      archive.pipe(passThrough);

      // Set response headers
      const timestamp = new Date().toISOString().split('T')[0];
      const defaultName = archiveName || `zephyrfs-files-${timestamp}.${format}`;

      reply.header('Content-Type', `application/${format}`);
      reply.header('Content-Disposition', `attachment; filename="${defaultName}"`);

      // Handle archive errors
      archive.on('error', (err) => {
        fastify.log.error(err, 'Archive creation failed');
        if (!reply.sent) {
          reply.code(500).send({ error: 'Archive creation failed' });
        }
      });

      // Process each file
      const filePromises = fileIds.map(async (fileId) => {
        try {
          // Get file info first
          const fileInfo = await fastify.zephyrfs.getFileInfo(fileId);

          // Download file stream
          const download = await fastify.zephyrfs.downloadFile(fileId);

          // Add to archive
          archive.append(download.stream as any, {
            name: fileInfo.name,
            date: fileInfo.lastModified,
          });

        } catch (error) {
          fastify.log.warn({ fileId, error }, 'Failed to add file to archive');
          // Continue with other files instead of failing entire operation
        }
      });

      // Wait for all files to be processed
      await Promise.allSettled(filePromises);

      // Finalize archive
      await archive.finalize();

      // Stream the archive
      return reply.send(passThrough);

    } catch (error) {
      fastify.log.error(error, 'Bulk download failed');
      throw fastify.httpErrors.internalServerError('Bulk download failed');
    }
  });

  // Bulk delete files
  fastify.delete<{
    Body: z.infer<typeof bulkDeleteSchema>;
  }>('/files/bulk/delete', {
    schema: {
      body: bulkDeleteSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileIds } = request.body as z.infer<typeof bulkDeleteSchema>;

    try {
      const results = await Promise.allSettled(
        fileIds.map(fileId => fastify.zephyrfs.deleteFile(fileId))
      );

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Get details of failures
      const failures = results
        .map((result, index) => ({ result, fileId: fileIds[index] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ result, fileId }) => ({
          fileId,
          error: (result as PromiseRejectedResult).reason?.message || 'Unknown error'
        }));

      return {
        success: true,
        summary: {
          total: fileIds.length,
          successful,
          failed,
        },
        failures: failed > 0 ? failures : undefined,
      };

    } catch (error) {
      fastify.log.error(error, 'Bulk delete failed');
      throw fastify.httpErrors.internalServerError('Bulk delete failed');
    }
  });

  // Bulk move files
  fastify.post<{
    Body: z.infer<typeof bulkMoveSchema>;
  }>('/files/bulk/move', {
    schema: {
      body: bulkMoveSchema,
    },
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileIds, targetPath } = request.body as z.infer<typeof bulkMoveSchema>;

    try {
      // For now, return not implemented since file moving requires
      // proper implementation in the ZephyrFS core
      throw fastify.httpErrors.notImplemented('Bulk move is not yet implemented');

    } catch (error) {
      fastify.log.error(error, 'Bulk move failed');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Bulk move failed');
    }
  });

  // Get bulk operation status
  fastify.get<{
    Params: { operationId: string };
  }>('/files/bulk/status/:operationId', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { operationId } = request.params as { operationId: string };

    try {
      // For now, return not implemented since this would require
      // background job tracking
      throw fastify.httpErrors.notImplemented('Bulk operation status tracking is not yet implemented');

    } catch (error) {
      fastify.log.error(error, 'Failed to get bulk operation status');
      if (error.statusCode) {
        throw error;
      }
      throw fastify.httpErrors.internalServerError('Failed to get bulk operation status');
    }
  });
}