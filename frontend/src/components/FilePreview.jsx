import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import { Close } from '@mui/icons-material';
import axios from 'axios';

const FilePreview = ({ file, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!file || !file._id || !file.mimetype) {
        setError('Invalid file data');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // For images, we can use the direct file endpoint
        if (file.mimetype.startsWith('image/')) {
          setPreviewUrl(`http://localhost:8000/api/files/${file._id}`);
        } 
        // For other files, use the preview endpoint
        else {
          const response = await axios.get(
            `http://localhost:8000/api/file/preview/${file._id}`,
            { responseType: 'blob' }
          );
          const objectUrl = URL.createObjectURL(response.data);
          setPreviewUrl(objectUrl);
        }
      } catch (err) {
        console.error('Error loading preview:', err);
        setError('Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      if (previewUrl && file?.mimetype && !file.mimetype.startsWith('image/')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [file]);

  if (!file) {
    return null;
  }

  const isImage = file.mimetype?.startsWith('image/');
  const isPDF = file.mimetype === 'application/pdf';

  return (
    <Dialog 
      open={Boolean(file)} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #eee' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{file.originalName || 'File Preview'}</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 4,
        overflow: 'hidden'
      }}>
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center">
            <CircularProgress />
            <Typography variant="body1" mt={2}>Loading preview...</Typography>
          </Box>
        ) : error ? (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            textAlign="center"
            p={4}
            sx={{
              backgroundColor: '#fff0f0',
              borderRadius: 1,
              width: '100%'
            }}
          >
            <Typography variant="h6" color="error">Preview Error</Typography>
            <Typography variant="body1" mt={2}>{error}</Typography>
          </Box>
        ) : isImage ? (
          <img 
            src={previewUrl} 
            alt={file.originalName || 'File preview'}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        ) : isPDF ? (
          <iframe 
            src={previewUrl}
            title={file.originalName || 'PDF preview'}
            style={{ 
              width: '100%', 
              height: '100%',
              border: 'none'
            }}
          />
        ) : (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            textAlign="center"
            p={4}
            sx={{
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
              width: '100%'
            }}
          >
            <Typography variant="h6">No Preview Available</Typography>
            <Typography variant="body1" mt={2}>
              This file type cannot be previewed
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;