import React, { createContext, useState } from "react";

export const DocumentContext = createContext({});

export function DocumentProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  // Add any other global state/logic you want here

  return (
    <DocumentContext.Provider value={{ documents, setDocuments }}>
      {children}
    </DocumentContext.Provider>
  );
}
