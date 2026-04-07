#!/bin/bash
# Generate self-signed TLS certificate for local development.
# Production: replace with Let's Encrypt certs via certbot.
set -e
CERT_DIR="$(dirname "$0")"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/dev.key" \
  -out "$CERT_DIR/dev.crt" \
  -subj "/C=IN/ST=Karnataka/L=Bangalore/O=PES University/CN=localhost"
echo "Dev certs generated at $CERT_DIR/dev.crt and $CERT_DIR/dev.key"
