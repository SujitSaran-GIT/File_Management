import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Paper, 
  Button
} from '@mui/material';
import { CloudUpload, Check, Error } from '@mui/icons-material';
import { uploadFile } from '../api/files';

const FileUpload = ({ onUpload }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        enqueueSnackbar(
          error.code === 'file-too-large' 
            ? 'File size exceeds 10MB limit' 
            : 'Invalid file type',
          { variant: 'error' }
        );
        return;
      }

      if (acceptedFiles.length === 0) return;

      try {
        setIsUploading(true);
        setProgress(0);

        await uploadFile(acceptedFiles[0], {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        });

        enqueueSnackbar('File uploaded successfully!', { variant: 'success' });
        onUpload();
      } catch (error) {
        enqueueSnackbar(error.response?.data?.error || 'Upload failed', { variant: 'error' });
      } finally {
        setIsUploading(false);
        setProgress(0);
      }
    }
  });

  return (
    <Paper
      {...getRootProps()}
      sx={{
        p: 4,
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'divider',
        backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover'
        }
      }}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress variant="determinate" value={progress} size={60} thickness={4} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Uploading {progress}%
          </Typography>
        </Box>
      ) : (
        <>
          <CloudUpload sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop the file here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF (Max 10MB)
          </Typography>
          <Button variant="contained" color="primary">
            Select File
          </Button>
        </>
      )}
    </Paper>
  );
};

export default FileUpload;