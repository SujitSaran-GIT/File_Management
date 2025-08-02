import React, { useState } from 'react';
import { Container, Typography, Box, Tabs, Tab } from '@mui/material';
import FileUpload from '../components/FileUpload';
import FileList from '../components/FileList';

const DocumentsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Document Management System
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="My Documents" />
          <Tab label="Upload" />
        </Tabs>
      </Box>

      {activeTab === 0 && <FileList key={refreshKey} />}
      {activeTab === 1 && <FileUpload onUpload={handleUploadSuccess} />}
    </Container>
  );
};

export default DocumentsPage;