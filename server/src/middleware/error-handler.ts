import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError } from '../../shared/types.js';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const timestamp = new Date();

  // Log the error
  request.log.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
    },
  }, 'Request error');

  // Determine status code and error message
  let statusCode = 500;
  let message = 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';

  if (error.statusCode) {
    statusCode = error.statusCode;
  }

  // Handle specific error types
  switch (error.code) {
    case 'FST_ERR_VALIDATION':
      statusCode = 400;
      message = 'Invalid request data';
      break;
    case 'FST_JWT_NO_AUTHORIZATION_IN_HEADER':
    case 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED':
    case 'FST_JWT_AUTHORIZATION_TOKEN_INVALID':
      statusCode = 401;
      message = 'Authentication required';
      break;
    case 'FST_ERR_NOT_FOUND':
      statusCode = 404;
      message = 'Resource not found';
      break;
    case 'FST_ERR_TOO_LARGE':
      statusCode = 413;
      message = 'File too large';
      break;
    default:
      if (error.message && !error.message.includes('Internal')) {
        message = error.message;
      }
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  const errorResponse: ApiError = {
    error: code,
    message,
    code: statusCode,
    timestamp,
  };

  await reply.status(statusCode).send(errorResponse);
}