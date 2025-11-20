// frontend/src/contexts/DocumentContext.jsx
import React, { createContext, useContext, useState } from 'react'

const DocumentContext = createContext()

export function DocumentProvider({ children }) {
  const [documents, setDocuments] = useState([])

  const addDocument = (doc) => {
    // push or update if your response includes docId
    setDocuments(prev => [doc, ...prev])
  }

  const setList = (list) => {
    setDocuments(Array.isArray(list) ? list : [])
  }

  return (
    <DocumentContext.Provider value={{ documents, addDocument, setList }}>
      {children}
    </DocumentContext.Provider>
  )
}

export function useDocuments() {
  return useContext(DocumentContext)
}
