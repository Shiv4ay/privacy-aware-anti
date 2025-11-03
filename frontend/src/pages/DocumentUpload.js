// /src/pages/DocumentUpload.js
/*export default function DocumentUpload() {
  return <div>Document Upload Page (Placeholder)</div>;
}*/

import React, { useState } from 'react';

export default function DocumentUpload() {
  const [file, setFile] = useState(null);
  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`${process.env.REACT_APP_API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    alert('Upload attempted!');
  };

  return (
    <div style={{ padding: 36 }}>
      <h2>Upload Document</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file}>Upload</button>
    </div>
  );
}

