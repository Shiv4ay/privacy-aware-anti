# Create DocumentContext (React Context for state management)
import os

project_name = "Privacy-Aware-RAG"
document_context_content = """import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { documentAPI } from '../utils/api';

const DocumentContext = createContext();

const initialState = {
  documents: [],
  loading: false,
  error: null,
  searchResults: [],
  chatHistory: [],
  uploadProgress: {},
  systemHealth: null,
};

const documentReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload, loading: false };
    
    case 'ADD_DOCUMENT':
      return { 
        ...state, 
        documents: [action.payload, ...state.documents],
        loading: false 
      };
    
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === action.payload.id ? { ...doc, ...action.payload } : doc
        )
      };
    
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload, loading: false };
    
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatHistory: [...state.chatHistory, action.payload]
      };
    
    case 'CLEAR_CHAT_HISTORY':
      return { ...state, chatHistory: [] };
    
    case 'SET_UPLOAD_PROGRESS':
      return {
        ...state,
        uploadProgress: {
          ...state.uploadProgress,
          [action.payload.fileName]: action.payload.progress
        }
      };
    
    case 'REMOVE_UPLOAD_PROGRESS':
      const newProgress = { ...state.uploadProgress };
      delete newProgress[action.payload];
      return { ...state, uploadProgress: newProgress };
    
    case 'SET_SYSTEM_HEALTH':
      return { ...state, systemHealth: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
};

export const DocumentProvider = ({ children }) => {
  const [state, dispatch] = useReducer(documentReducer, initialState);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
    checkSystemHealth();
  }, []);

  const loadDocuments = async (page = 1, limit = 20) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await documentAPI.getDocuments(page, limit);
      dispatch({ type: 'SET_DOCUMENTS', payload: response.documents });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const uploadDocument = async (file, onProgress) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await documentAPI.uploadDocument(file, (progress) => {
        dispatch({
          type: 'SET_UPLOAD_PROGRESS',
          payload: { fileName: file.name, progress }
        });
        if (onProgress) onProgress(progress);
      });
      
      dispatch({ type: 'ADD_DOCUMENT', payload: response.document });
      dispatch({ type: 'REMOVE_UPLOAD_PROGRESS', payload: file.name });
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'REMOVE_UPLOAD_PROGRESS', payload: file.name });
      throw error;
    }
  };

  const searchDocuments = async (query, topK = 5) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await documentAPI.searchDocuments(query, topK);
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: response.results });
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const chatWithDocuments = async (query, context) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      // Add user message
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          id: Date.now(),
          type: 'user',
          content: query,
          timestamp: new Date().toISOString()
        }
      });
      
      const response = await documentAPI.chatWithDocuments(query, context);
      
      // Add assistant response
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          id: Date.now() + 1,
          type: 'assistant',
          content: response.response,
          contextUsed: response.context_used,
          timestamp: new Date().toISOString()
        }
      });
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      
      // Add error message
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          id: Date.now() + 1,
          type: 'error',
          content: 'Sorry, I encountered an error processing your request.',
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  };

  const checkSystemHealth = async () => {
    try {
      const health = await documentAPI.getSystemHealth();
      dispatch({ type: 'SET_SYSTEM_HEALTH', payload: health });
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const downloadDocument = async (documentId) => {
    try {
      await documentAPI.downloadDocument(documentId);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const getDocumentStatus = async (documentId) => {
    try {
      const response = await documentAPI.getDocumentStatus(documentId);
      dispatch({
        type: 'UPDATE_DOCUMENT',
        payload: response.document
      });
      return response.document;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const clearChatHistory = () => {
    dispatch({ type: 'CLEAR_CHAT_HISTORY' });
  };

  const value = {
    ...state,
    loadDocuments,
    uploadDocument,
    searchDocuments,
    chatWithDocuments,
    downloadDocument,
    getDocumentStatus,
    checkSystemHealth,
    clearError,
    clearChatHistory,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};

export default DocumentContext;
"""

# Create contexts directory and write DocumentContext
os.makedirs(f"{project_name}/frontend/src/contexts", exist_ok=True)
with open(f"{project_name}/frontend/src/contexts/DocumentContext.js", "w") as f:
    f.write(document_context_content)

print("Created DocumentContext for state management")