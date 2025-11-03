import os

project_name = "Privacy-Aware-RAG"

# Worker requirements.txt content
worker_requirements = """fastapi==0.104.1
uvicorn[standard]==0.24.0
psycopg2-binary==2.9.9
redis==5.0.1
requests==2.31.0
minio==7.2.0
pypdf==3.17.0
python-multipart==0.0.6
python-dotenv==1.0.0
"""

# Dockerfile content for worker
worker_dockerfile = """FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create temp directory for file processing
RUN mkdir -p /tmp

# Expose port
EXPOSE 8001

# Run the application
CMD ["python", "app.py"]
"""

# Ensure backend/worker folder exists
worker_folder = os.path.join(project_name, "backend", "worker")
os.makedirs(worker_folder, exist_ok=True)

# Write requirements.txt
with open(os.path.join(worker_folder, "requirements.txt"), "w") as f:
    f.write(worker_requirements)

# Write Dockerfile
with open(os.path.join(worker_folder, "Dockerfile"), "w") as f:
    f.write(worker_dockerfile)

print("Created worker requirements.txt and Dockerfile")
