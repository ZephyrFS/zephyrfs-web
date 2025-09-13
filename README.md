# ZephyrFS Web Interface

A modern web interface and WebDAV server for ZephyrFS distributed storage system.

## Features

- **RESTful API** - Complete file management operations
- **JWT Authentication** - Secure token-based authentication
- **WebDAV Server** - Native OS integration for mounting as network drive
- **Real-time Updates** - WebSocket-based status monitoring
- **Zero-Knowledge Security** - Preserves ZephyrFS encryption architecture
- **High Performance** - Sub-2-second response times with streaming support

## Quick Start

### Development

1. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

### Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

### Docker

```bash
docker-compose up -d
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate session
- `GET /api/auth/me` - Get current user info

### Files
- `GET /api/files` - List files in directory
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id/download` - Download file
- `GET /api/files/:id/info` - Get file metadata
- `DELETE /api/files/:id` - Delete file

### Status
- `GET /api/health` - Health check
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

## Performance

- Sub-200ms API response times
- Streaming file uploads/downloads
- Efficient chunked transfer
- WebSocket real-time updates
- Connection pooling and timeouts