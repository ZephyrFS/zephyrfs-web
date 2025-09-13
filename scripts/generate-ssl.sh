#!/bin/bash

# Script to generate self-signed SSL certificates for development
# For production, use proper certificates from Let's Encrypt or a CA

set -e

SSL_DIR="nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

echo "Generating self-signed SSL certificate for ZephyrFS..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate private key
openssl genrsa -out "$KEY_FILE" 2048

# Generate certificate signing request
openssl req -new -key "$KEY_FILE" -out "$SSL_DIR/cert.csr" -subj "/C=US/ST=State/L=City/O=ZephyrFS/OU=Development/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$SSL_DIR/cert.csr" -signkey "$KEY_FILE" -out "$CERT_FILE" -extensions v3_req -extfile <(cat <<EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = zephyrfs.local
DNS.3 = *.zephyrfs.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Clean up CSR
rm "$SSL_DIR/cert.csr"

# Set proper permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "SSL certificate generated successfully!"
echo "Certificate: $CERT_FILE"
echo "Private key: $KEY_FILE"
echo ""
echo "For production deployment:"
echo "1. Replace these files with proper certificates from Let's Encrypt or a CA"
echo "2. Update the certificate paths in nginx/nginx.conf if needed"
echo "3. Ensure proper file permissions (600 for key, 644 for cert)"