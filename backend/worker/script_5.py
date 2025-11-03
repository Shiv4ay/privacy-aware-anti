# Create API gateway package.json and Dockerfile
import os

project_name = "Privacy-Aware-RAG"
api_package_json = """{
  "name": "privacy-aware-rag-api",
  "version": "1.0.0",
  "description": "Privacy-Aware RAG API Gateway",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "minio": "^7.1.3",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}"""

# Write API package.json
with open(f"{project_name}/backend/api/package.json", "w") as f:
    f.write(api_package_json)

# Create API Dockerfile
api_dockerfile = """FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Run the application
CMD ["npm", "start"]
"""

# Write API Dockerfile
with open(f"{project_name}/backend/api/Dockerfile", "w") as f:
    f.write(api_dockerfile)

print("Created API gateway package.json and Dockerfile")