# backend/worker/Dockerfile
FROM python:3.11-slim

LABEL org.opencontainers.image.source="privacy-aware-rag"
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install minimal system deps: build tools for wheels and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    libffi-dev \
    libssl-dev \
    gcc \
  && rm -rf /var/lib/apt/lists/*

# Upgrade pip / setuptools
RUN python -m pip install --upgrade pip setuptools wheel

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a non-root user and set ownership
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Ensure /tmp is available and writable
USER root
RUN mkdir -p /tmp && chmod 1777 /tmp
USER appuser

# Application listens on 8001
EXPOSE 8001

# Recommended production command for FastAPI using uvicorn.
# Ensure your fastapi app object is named `app` in `app.py` or adjust the module:path accordingly.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--loop", "uvloop", "--http", "httptools"]
