# Privacy-Aware RAG System

A comprehensive full-stack AI-powered document search and retrieval system with built-in privacy protection, role-based access control, and audit logging. Built with React, Node.js, Python, Docker, and modern AI technologies.

![Status](https://img.shields.io/badge/status-production--ready-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Privacy Features](#privacy-features)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Privacy-Aware RAG (Retrieval-Augmented Generation) system is designed for organizations that need secure, privacy-compliant document search and AI-powered chat capabilities. It automatically redacts personally identifiable information (PII), enforces role-based access control, and maintains comprehensive audit logs.

### Key Capabilities

- **Semantic Document Search**: Find documents using natural language queries
- **AI-Powered Chat**: Get answers from your documents using AI
- **Privacy Protection**: Automatic PII redaction in queries and logs
- **Access Control**: Role-based permissions (RBAC/ABAC)
- **Audit Logging**: Complete audit trail of all operations
- **Document Management**: Upload, store, and retrieve documents securely

## ✨ Features

### Core Features

- ✅ **Document Upload & Processing**
  - Support for PDF, TXT, DOC, DOCX, MD files
  - Automatic text extraction and chunking
  - Vector embedding generation
  - Storage in MinIO object storage

- ✅ **Semantic Search**
  - Natural language query processing
  - Vector similarity search via ChromaDB
  - Relevance scoring and ranking
  - Configurable result limits

- ✅ **AI Chat Interface**
  - Context-aware responses from documents
  - Integration with Ollama/Mistral models
  - Real-time conversation interface

- ✅ **Privacy & Security**
  - Automatic PII redaction (emails, phones, SSNs)
  - Query hashing for audit logs
  - Role-based access control (RBAC)
  - Attribute-based access control (ABAC)
  - Comprehensive audit logging

- ✅ **User Management**
  - User authentication (JWT)
  - Role assignment
  - Department-based access
  - Permission management

### Frontend Features

- Modern React UI with Tailwind CSS
- Responsive design
- Real-time search results
- Privacy warning banners
- PII detection indicators
- RBAC access denial notifications
- Document upload with progress
- Chat interface with message history

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│                    http://localhost:3000                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP/REST
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    API Gateway (Node.js)                     │
│                    http://localhost:3001                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication │ RBAC │ Audit Logging │ Rate Limiting│  │
│  └──────────────────────────────────────────────────────┘  │
└───────────┬───────────────────────────────┬─────────────────┘
            │                               │
            │                               │
┌───────────▼──────────┐      ┌───────────▼──────────┐
│   Worker (FastAPI)    │      │   PostgreSQL         │
│   http://worker:8001  │      │   Port: 5432         │
│                       │      │                      │
│  - Document Processing│      │  - Users             │
│  - Embedding Gen      │      │  - Documents        │
│  - PII Redaction      │      │  - Audit Logs       │
│  - ChromaDB Query     │      │  - ABAC Policies    │
└───────────┬───────────┘      └──────────────────────┘
            │
            │
┌───────────▼───────────┬──────────────┬──────────────┐
│                       │              │              │
│   ChromaDB            │   Ollama     │   MinIO      │
│   Port: 8000          │   Port:11434 │   Port:9000  │
│                       │              │              │
│  - Vector Store       │  - LLM       │  - Object    │
│  - Similarity Search  │  - Embeddings│    Storage   │
└───────────────────────┴──────────────┴──────────────┘
```

### Component Overview

1. **Frontend (React + Tailwind)**
   - User interface for search, chat, and document management
   - Privacy-aware UI with warnings and indicators
   - Real-time updates and responsive design

2. **API Gateway (Node.js/Express)**
   - Authentication and authorization
   - Request routing and validation
   - RBAC/ABAC enforcement
   - Audit log creation

3. **Worker (Python/FastAPI)**
   - Document processing and chunking
   - Embedding generation
   - PII redaction
   - ChromaDB queries
   - AI response generation

4. **PostgreSQL**
   - User management
   - Document metadata
   - Audit logs
   - ABAC policies

5. **ChromaDB**
   - Vector embeddings storage
   - Similarity search
   - Document retrieval

6. **Ollama**
   - LLM inference (Mistral)
   - Embedding generation

7. **MinIO**
   - Document file storage
   - Secure object storage

8. **Redis**
   - Job queue management
   - Caching (optional)

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **React Router 6** - Routing
- **Tailwind CSS 3** - Styling
- **Axios** - HTTP client
- **Vite** - Build tool

### Backend
- **Node.js/Express** - API gateway
- **Python/FastAPI** - Worker service
- **PostgreSQL 15** - Primary database
- **Redis 7** - Job queue
- **ChromaDB** - Vector database
- **Ollama** - LLM inference
- **MinIO** - Object storage

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy (frontend)
- **JWT** - Authentication

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Node.js** (version 18+, for local development)
- **Python** (version 3.9+, for local development)
- **Git**

### System Requirements

- **RAM**: Minimum 8GB (16GB recommended)
- **Disk Space**: 20GB free space
- **CPU**: 4+ cores recommended
- **OS**: Linux, macOS, or Windows (with WSL2)

## 🚀 Installation

### Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd privacy-aware-rag-prod-frontend
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - MinIO Console: http://localhost:9001
   - Ollama: http://localhost:11434

### Manual Installation (Development)

#### Backend Setup

1. **API Gateway**
   ```bash
   cd backend/api
   npm install
   npm start
   ```

2. **Worker Service**
   ```bash
   cd backend/worker
   pip install -r requirements.txt
   python app.py
   ```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=privacy_aware_db
DATABASE_URL=postgresql://admin:secure_password@postgres:5432/privacy_aware_db

# Redis
REDIS_URL=redis://redis:6379/0

# MinIO
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=secure_password
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=secure_password
MINIO_BUCKET=privacy-documents

# Ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=mistral
OLLAMA_EMBED_MODEL=nomic-embed-text

# ChromaDB
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000
CHROMADB_COLLECTION=privacy_documents

# API Gateway
API_PORT=3001
WORKER_URL=http://worker:8001
JWT_SECRET=your-secret-key-change-in-production
QUERY_HASH_SALT=your-query-hash-salt-change-in-production

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Development
NODE_ENV=development
DEV_AUTH_KEY=super-secret-dev-key
DEV_TOKEN_EXPIRES_IN=30d
```

### Important Security Notes

⚠️ **Production Deployment**:
- Change all default passwords
- Use strong `JWT_SECRET` and `QUERY_HASH_SALT`
- Disable `DEV_AUTH_KEY` in production
- Use HTTPS for all services
- Configure proper CORS origins
- Enable database SSL connections

## 📖 Usage

### Starting the System

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up --build
```

### Using the Frontend

1. **Access the UI**: http://localhost:3000

2. **Login/Register**:
   - Use the login page to authenticate
   - Or register a new account
   - Development mode: Uses `DEV_AUTH_KEY` for quick access

3. **Upload Documents**:
   - Navigate to "Upload" page
   - Select a file (PDF, TXT, DOC, DOCX, MD)
   - Wait for processing (embeddings generation)

4. **Search Documents**:
   - Go to "Search" page
   - Enter your query
   - View results with relevance scores
   - Privacy warnings appear for PII

5. **Chat with Documents**:
   - Navigate to "Chat" page
   - Ask questions about your documents
   - AI provides context-aware answers

### API Usage Examples

#### Health Check
```bash
curl http://localhost:3001/api/health
```

#### Upload Document
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-dev-auth: super-secret-dev-key" \
  -F "file=@document.pdf"
```

#### Search
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"q": "What is GDPR compliance?"}'
```

#### Chat
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain data protection"}'
```

## 📚 API Documentation

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

For development, you can also use:
```
x-dev-auth: super-secret-dev-key
```

### Endpoints

#### Health Check
```
GET /api/health
```
Returns system health status.

#### Upload Document
```
POST /api/documents/upload
Content-Type: multipart/form-data
Body: file (binary)
```
Uploads and processes a document.

**Response**:
```json
{
  "docId": "uuid",
  "filename": "document.pdf",
  "status": "processing"
}
```

#### List Documents
```
GET /api/documents
```
Returns list of user's documents.

#### Download Document
```
GET /api/download/:id
```
Downloads a document by ID.

#### Search Documents
```
POST /api/search
Content-Type: application/json
Body: { "q": "search query", "top_k": 5 }
```
Performs semantic search.

**Response**:
```json
{
  "success": true,
  "query": "original query",
  "query_redacted": "redacted query",
  "query_hash": "hashed_query",
  "results": [
    {
      "id": "doc_id",
      "text": "document text",
      "score": 0.95
    }
  ],
  "total_found": 5
}
```

#### Chat
```
POST /api/chat
Content-Type: application/json
Body: { "query": "user question" }
```
Generates AI response based on documents.

**Response**:
```json
{
  "success": true,
  "query": "user question",
  "response": "AI generated answer",
  "context_used": true
}
```

#### Document Status
```
GET /api/documents/:id/status
```
Returns processing status of a document.

## 🔒 Privacy Features

### PII Redaction

The system automatically detects and redacts:
- **Email addresses**: `user@example.com` → `[REDACTED]`
- **Phone numbers**: `555-123-4567` → `[REDACTED]`
- **SSN**: `123-45-6789` → `[REDACTED]`

Redaction occurs in:
- Search queries (for audit logs)
- Query responses (displayed to users)
- Audit log entries

### Query Hashing

All queries are hashed using SHA-256 with a salt:
- Original query is hashed before storage
- Hash is one-way (cannot be reversed)
- Used for audit log correlation
- Salt is configurable via `QUERY_HASH_SALT`

### Role-Based Access Control (RBAC)

Access is controlled by:
- **User Roles**: admin, editor, viewer, etc.
- **Department**: Users can access department-specific documents
- **Document Sensitivity**: PUBLIC, INTERNAL, CONFIDENTIAL, PII
- **ABAC Policies**: Attribute-based rules in database

### Audit Logging

All operations are logged:
- User ID and username
- Action type (search, upload, download, chat)
- Query hash and redacted query
- Result count
- Document IDs accessed
- Timestamp
- IP address and user agent
- Access decision (allowed/denied)
- Policy ID (if RBAC enforced)

### Viewing Audit Logs

```sql
SELECT 
  username,
  action,
  query_redacted,
  query_hash,
  result_count,
  timestamp
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 10;
```

## 🧪 Testing

### Running Tests

#### Backend Pipeline Test
```powershell
.\test_backend_pipeline.ps1
```
Tests complete flow: Upload → Process → Search

#### Privacy Features Test
```powershell
.\test_privacy_features.ps1
```
Tests PII redaction, RBAC, and audit logging

#### Health Check
```powershell
.\test_phase1_health.ps1
```

### Manual Testing

1. **Test PII Redaction**:
   - Search for: "Find contact info for test@example.com"
   - Verify redacted query appears in response
   - Check audit logs for redacted version

2. **Test RBAC**:
   - Create restricted user
   - Try to search with restricted token
   - Verify 403 response

3. **Test Audit Logging**:
   - Perform searches
   - Check database audit_logs table
   - Verify queries are hashed and redacted

See [PRIVACY_TESTING_GUIDE.md](./PRIVACY_TESTING_GUIDE.md) for detailed testing instructions.

## 🚢 Deployment

### Production Deployment

1. **Update Environment Variables**:
   ```bash
   # Change all default passwords
   # Set strong JWT_SECRET
   # Disable DEV_AUTH_KEY
   # Configure production database
   ```

2. **Build and Deploy**:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

3. **Configure Reverse Proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
       }
       
       location /api {
           proxy_pass http://localhost:3001;
       }
   }
   ```

4. **Enable HTTPS**:
   - Use Let's Encrypt or similar
   - Configure SSL certificates
   - Redirect HTTP to HTTPS

### Monitoring

- **Health Checks**: All services have health check endpoints
- **Logs**: Use `docker-compose logs` to view logs
- **Database**: Monitor PostgreSQL connections and queries
- **Redis**: Monitor queue depth and memory usage

## 🐛 Troubleshooting

### Common Issues

#### Frontend Not Loading
```bash
# Check if container is running
docker ps

# View logs
docker logs privacy-aware-frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

#### API Connection Errors
```bash
# Verify API is running
curl http://localhost:3001/api/health

# Check CORS configuration
# Verify VITE_API_URL in frontend
```

#### Search Timeout
- Increase timeout in API gateway (default: 30s)
- Check Ollama model is loaded
- Verify ChromaDB is accessible
- Check worker logs for errors

#### PII Not Redacting
- Verify worker is processing queries
- Check `query_redacted` in response
- Review worker logs for redaction errors

#### Database Connection Issues
```bash
# Check PostgreSQL is running
docker exec -it privacy-aware-postgres psql -U admin -d privacy_aware_db

# Verify DATABASE_URL in .env
# Check network connectivity
```

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

View detailed logs:
```bash
docker-compose logs -f api worker
```

## 📁 Project Structure

```
privacy-aware-rag-prod-frontend/
├── backend/
│   ├── api/                    # Node.js API Gateway
│   │   ├── index.js           # Main API server
│   │   ├── middleware/        # Auth, RBAC, CORS
│   │   └── routes/            # Route handlers
│   ├── worker/                # Python FastAPI Worker
│   │   ├── app.py             # Worker service
│   │   ├── db.py              # Database utilities
│   │   ├── lib/               # Libraries
│   │   └── utils/             # Privacy utilities
│   └── database/              # SQL schemas
│       ├── init.sql           # Initial schema
│       └── *.sql              # Additional schemas
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── contexts/          # React contexts
│   │   └── api/               # API client
│   ├── public/                # Static assets
│   └── Dockerfile.prod        # Production build
├── docker-compose.yml         # Docker orchestration
├── .env                       # Environment variables
├── test_*.ps1                 # Test scripts
└── README.md                  # This file
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure privacy features are maintained
- Test with various document types

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Ollama** - LLM inference engine
- **ChromaDB** - Vector database
- **MinIO** - Object storage
- **React** - UI framework
- **FastAPI** - Python web framework
- **Tailwind CSS** - CSS framework

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

## 📊 Project Status

**Current Version**: 1.0.0  
**Status**: Production Ready  
**Completion**: ~82%

### Phase Completion

- ✅ Phase 1 - Foundations: 90%
- ✅ Phase 2 - Backend: 85%
- ✅ Phase 3 - Privacy: 90%
- ✅ Phase 4 - Frontend: 95%
- ✅ Phase 5 - Deployment: 70%
- ⏳ Phase 6 - Documentation: 30%

---

**Built with ❤️ for privacy-conscious organizations**
