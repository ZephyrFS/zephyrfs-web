# Multi-stage build for Vue.js client
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../shared ./shared

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zephyrfs -u 1001 -G nodejs

# Set ownership
RUN chown -R zephyrfs:nodejs /usr/share/nginx/html && \
    chown -R zephyrfs:nodejs /var/cache/nginx && \
    chown -R zephyrfs:nodejs /var/log/nginx && \
    chown -R zephyrfs:nodejs /etc/nginx/conf.d

# Make directories writable
RUN touch /var/run/nginx.pid && \
    chown -R zephyrfs:nodejs /var/run/nginx.pid

# Switch to non-root user
USER zephyrfs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]