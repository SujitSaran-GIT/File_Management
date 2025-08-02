import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);

  const handleUpload = (newFile) => {
    setFiles([newFile, ...files]);
  };

  return (
    <div className="App">
      <h1>Document Management System</h1>
      <FileUpload onUpload={handleUpload} />
      <FileList files={files} />
    </div>
  );
}

export default App;