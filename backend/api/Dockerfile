# backend/api/Dockerfile
FROM node:18-bullseye-slim

LABEL org.opencontainers.image.source="privacy-aware-rag"

WORKDIR /app

# If your app uses native modules uncomment and install build deps:
# RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files and install deps (cache-friendly)
COPY package*.json ./
RUN npm ci --no-audit --progress=false || npm install

# Copy application source
COPY . .

# Create a non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Expose port used by your API (ensure app binds to 0.0.0.0:3001)
EXPOSE 3001

# Start via package.json start script (node index.js)
CMD ["npm", "start"]
