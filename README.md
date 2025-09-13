# ZephyrFS Web Interface

A modern, responsive web interface for ZephyrFS with zero-knowledge encryption support and production-ready deployment.

## Features

- **Modern Web UI**: Vue.js 3 + TypeScript + Tailwind CSS
- **Zero-Knowledge Encryption**: Client-side encryption with capability-based access
- **Real-time Operations**: WebSocket support for live updates
- **File Management**: Upload, download, organize files with folder support
- **Batch Operations**: Multi-select for bulk operations
- **File Preview**: Built-in preview for images, documents, and media
- **Mobile Responsive**: Progressive Web App (PWA) support
- **WebDAV Server**: Native OS integration for mounting as network drive
- **Production Ready**: Docker containerization with monitoring
- **High Performance**: Sub-500ms response times with intelligent caching

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development servers
npm run dev:server    # Backend on :3000
npm run dev:client    # Frontend on :5173
```

### Production Deployment

```bash
# Copy and configure environment
cp .env.production.example .env.production
# Edit .env.production with your settings

# Deploy with Docker Swarm
./scripts/deploy.sh deploy

# Check health and performance
./scripts/health-check.sh
```

### Alternative Deployment

```bash
# Docker Compose
docker-compose -f deploy/production.yml up -d

# Manual deployment
npm run build
npm run start:prod
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate session
- `GET /api/auth/me` - Get current user info

### Core Operations
- `GET /api/files` - List files and folders
- `POST /api/files/upload` - Upload files
- `GET /api/files/:id/download` - Download file
- `DELETE /api/files/:id` - Delete file/folder
- `POST /api/folders` - Create folder

### Batch Operations
- `POST /api/bulk/download` - Bulk download as ZIP
- `DELETE /api/bulk/delete` - Bulk delete

### Monitoring
- `GET /api/health` - Health check
- `GET /api/metrics` - Performance metrics
- `GET /api/cache/stats` - Cache statistics
- `GET /api/status/network` - Network status
- `GET /api/status/node` - Node status
- `GET /api/status/ws` - WebSocket status updates

### WebDAV
- `GET /api/webdav` - WebDAV discovery info
- `ALL /api/webdav/*` - WebDAV protocol endpoints

## WebDAV Setup

The WebDAV server allows mounting ZephyrFS as a network drive:

### Windows
1. Open File Explorer
2. Right-click "This PC" → "Map network drive"
3. Click "Connect to a Web site"
4. Enter: `http://localhost:3000/api/webdav/`
5. Username: `zephyrfs`, Password: `webdav`

### macOS
1. Open Finder
2. Go → Connect to Server (⌘K)
3. Enter: `http://localhost:3000/api/webdav/`
4. Username: `zephyrfs`, Password: `webdav`

### Linux
1. Open file manager
2. Other Locations → Connect to Server
3. Enter: `http://localhost:3000/api/webdav/`
4. Username: `zephyrfs`, Password: `webdav`

## Configuration

Environment variables (see `.env.example`):

- `PORT` - Server port (default: 3000)
- `ZEPHYRFS_NODE_URL` - ZephyrFS node URL
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `CORS_ORIGINS` - Allowed CORS origins
- `WEBDAV_ENABLED` - Enable WebDAV server
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## Testing

```bash
npm test
```

## Architecture

The web interface acts as a bridge between web clients and the ZephyrFS node:

```
Web Client/WebDAV → Fastify API → ZephyrFS Client → ZephyrFS Node
```

- **Fastify** - High-performance web framework
- **JWT Authentication** - Stateless authentication
- **WebDAV Server** - Standards-compliant DAV implementation
- **ZephyrFS Client** - HTTP client for node communication
- **Zero-Knowledge** - Encryption keys never leave client side

## Security

- JWT tokens with configurable expiration
- Rate limiting (100 requests/minute per IP)
- Security headers (HSTS, CSP, etc.)
- CORS protection
- Input validation with Zod schemas
- Secure error handling (no info leakage)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue.js Client │────│  Fastify Server │────│  ZephyrFS Node  │
│                 │    │                 │    │                 │
│ • File Browser  │    │ • REST API      │    │ • Storage Layer │
│ • Upload/DL     │    │ • WebSocket     │    │ • Encryption    │
│ • Auth UI       │    │ • JWT Auth      │    │ • Deduplication │
│ • Real-time     │    │ • Caching       │    │ • Capabilities  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Performance

- **Response Times**: Sub-500ms for all operations
- **Caching**: Intelligent multi-layer caching
- **Compression**: Gzip compression for all responses
- **CDN Ready**: Static asset optimization
- **Monitoring**: Prometheus + Grafana metrics
- **Streaming**: Efficient file uploads/downloads
- **WebSocket**: Real-time updates
- **Connection Pooling**: Optimized HTTP connections

## Security

- **Zero-Knowledge**: Files encrypted client-side
- **JWT Authentication**: Secure token-based auth
- **CORS Protection**: Configurable origin restrictions
- **Rate Limiting**: API endpoint protection
- **TLS Termination**: HTTPS with nginx proxy
- **CSP Headers**: Content Security Policy
- **Input Validation**: Zod schema validation
- **Secure Headers**: HSTS, X-Frame-Options, etc.

## Deployment Options

### Docker Swarm (Recommended)
```bash
./scripts/deploy.sh deploy
```

### Manual Docker
```bash
docker-compose -f deploy/production.yml up -d
```

### Kubernetes
```bash
# Coming soon - K8s manifests
kubectl apply -f deploy/k8s/
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `ZEPHYRFS_NODE_URL` | ZephyrFS node URL | `http://zephyrfs-node:8080` |
| `JWT_SECRET` | JWT signing secret | (required) |
| `CORS_ORIGINS` | Allowed CORS origins | `https://your-domain.com` |
| `MAX_FILE_SIZE` | Max upload size | `1073741824` (1GB) |
| `DATA_PATH` | Data storage path | `/opt/zephyrfs/data` |

### SSL Certificates

Place SSL certificates in `${SSL_CERTS_PATH}/`:
- `cert.pem` - Certificate file
- `key.pem` - Private key file

Or use Let's Encrypt with:
```bash
certbot certonly --webroot -w /var/www/html -d your-domain.com
```

## Monitoring

Access monitoring dashboards:
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Logs**: `docker service logs zephyrfs_loki`

## Development

### Project Structure
```
zephyrfs-web/
├── client/           # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/
│   │   └── utils/
│   └── public/
├── server/           # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── integration/
│   └── tests/
├── deploy/           # Production configs
├── monitoring/       # Prometheus/Grafana
└── scripts/          # Deployment scripts
```

### Testing
```bash
npm test
```

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Run tests: `npm test`
4. Commit changes: `git commit -m "feat: description"`
5. Push branch: `git push origin feature/name`
6. Create Pull Request