# Create API utility functions
import os

project_name = "Privacy-Aware-RAG"
api_utils_content = """import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        'An unexpected error occurred';
    
    // Handle specific error codes
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login or refresh token
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    
    return Promise.reject(new Error(errorMessage));
  }
);

// Document API functions
export const documentAPI = {
  // Get system health
  getSystemHealth: async () => {
    return await apiClient.get('/api/health');
  },

  // Upload document
  uploadDocument: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return await apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) onProgress(progress);
      },
    });
  },

  // Get documents list
  getDocuments: async (page = 1, limit = 20) => {
    return await apiClient.get(`/api/documents?page=${page}&limit=${limit}`);
  },

  // Download document
  downloadDocument: async (documentId) => {
    const response = await axios.get(`${API_BASE_URL}/api/download/${documentId}`, {
      responseType: 'blob',
    });
    
    // Create blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Get document status
  getDocumentStatus: async (documentId) => {
    return await apiClient.get(`/api/documents/${documentId}/status`);
  },

  // Search documents
  searchDocuments: async (query, topK = 5) => {
    return await apiClient.post('/api/search', { query, top_k: topK });
  },

  // Chat with documents
  chatWithDocuments: async (query, context = null) => {
    return await apiClient.post('/api/chat', { query, context });
  },
};

// Utility functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getFileIcon = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  const iconMap = {
    pdf: '📄',
    doc: '📄',
    docx: '📄',
    txt: '📄',
    md: '📄',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    mp4: '🎥',
    mov: '🎥',
    avi: '🎥',
    mp3: '🎵',
    wav: '🎵',
    zip: '📦',
    rar: '📦',
    tar: '📦',
  };
  
  return iconMap[extension] || '📄';
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const validateFile = (file, maxSize = 50 * 1024 * 1024) => { // 50MB default
  const errors = [];
  
  if (!file) {
    errors.push('No file selected');
    return errors;
  }
  
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${formatFileSize(maxSize)}`);
  }
  
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (!allowedTypes.includes(file.type)) {
    errors.push('File type not supported. Please upload PDF, DOC, DOCX, TXT, or MD files.');
  }
  
  return errors;
};

export default apiClient;
"""

# Write API utility
with open(f"{project_name}/frontend/src/utils/api.js", "w") as f:
    f.write(api_utils_content)

print("Created API utility functions")