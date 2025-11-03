# script_1.py
project_name = "Privacy-Aware-RAG"

docker_compose_content = """version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: privacy-aware-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: privacy_rag_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - privacy_aware_net

  redis:
    image: redis:7-alpine
    container_name: privacy-aware-redis
    restart: always
    ports:
      - "6379:6379"
    networks:
      - privacy_aware_net

  minio:
    image: minio/minio:latest
    container_name: privacy-aware-minio
    restart: always
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: secure_password
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live || exit 1"]
      interval: 10s
      retries: 5
      timeout: 10s
      start_period: 20s
    networks:
      - privacy_aware_net

  ollama:
    image: ollama/ollama:latest
    container_name: privacy-aware-ollama
    restart: always
    environment:
      - OLLAMA_HOST=0.0.0.0
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - privacy_aware_net

  chromadb:
    image: ghcr.io/chroma-core/chroma:latest
    container_name: privacy-aware-chromadb
    restart: always
    ports:
      - "8000:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=False
    networks:
      - privacy_aware_net

  worker:
    build:
      context: ./backend/worker
      dockerfile: Dockerfile
    container_name: privacy-aware-worker
    restart: always
    depends_on:
      postgres:
        condition: service_started
      redis:
        condition: service_started
      minio:
        condition: service_healthy
      ollama:
        condition: service_started
      chromadb:
        condition: service_started
    ports:
      - "8001:8001"
    environment:
      DATABASE_URL: postgresql://admin:secure_password@postgres:5432/privacy_rag_db
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: admin
      MINIO_SECRET_KEY: secure_password
      MINIO_BUCKET: privacy-documents
      OLLAMA_URL: http://ollama:11434
      OLLAMA_MODEL: mistral
      OLLAMA_EMBED_MODEL: mxbai-embed-large
      CHROMADB_URL: http://chromadb:8000
      CHROMADB_COLLECTION: privacy_documents
    networks:
      - privacy_aware_net

  api:
    build:
      context: ./backend/api
      dockerfile: Dockerfile
    container_name: privacy-aware-api
    restart: always
    depends_on:
      worker:
        condition: service_started
      postgres:
        condition: service_started
      redis:
        condition: service_started
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      WORKER_URL: http://worker:8001
      DATABASE_URL: postgresql://admin:secure_password@postgres:5432/privacy_rag_db
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: admin
      MINIO_SECRET_KEY: secure_password
      MINIO_BUCKET: privacy-documents
    networks:
      - privacy_aware_net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: privacy-aware-frontend
    restart: always
    depends_on:
      api:
        condition: service_started
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:3001
    networks:
      - privacy_aware_net

volumes:
  postgres_data:
  minio_data:
  ollama_data:
  chromadb_data:

networks:
  privacy_aware_net:
    driver: bridge
"""

with open(f"{project_name}/docker-compose.yml", "w") as f:
    f.write(docker_compose_content)

print("Created docker-compose.yml file")
