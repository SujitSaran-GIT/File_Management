import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Tooltip,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import { 
  GetApp as DownloadIcon, 
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  History as VersionsIcon
} from '@mui/icons-material';
import { 
  getFiles, 
  deleteFile,
  getFileVersions
} from '../api/files';
import FilePreview from './FilePreview';
import FileVersions from './FileVersions';

const FileList = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
  const [versionsFile, setVersionsFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await getFiles();
        setFiles(response.data);
      } catch (error) {
        console.error('Error fetching files:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteFile(id);
      setFiles(files.filter(file => file._id !== id));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleDownload = (id) => {
    window.open(`http://localhost:8000/api/files/${id}`, '_blank');
  };

  const handleViewVersions = async (filename) => {
    try {
      const response = await getFileVersions(filename);
      setVersionsFile(response.data);
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File ID</TableCell>
              <TableCell>File Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file._id}>
                <TableCell>
                  <Typography variant="body1">{file._id}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1">{file.originalName}</Typography>
                  {file.isCurrent && <Chip label="Current" size="small" color="primary" />}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={file.mimetype.split('/')[1] || file.mimetype} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  {(file.size / 1024).toFixed(2)} KB
                </TableCell>
                <TableCell>
                  {new Date(file.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Tooltip title="Download">
                    <IconButton onClick={() => handleDownload(file._id)}>
                      <DownloadIcon color="primary" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Preview">
                    <IconButton onClick={() => setPreviewFile(file)}>
                      <PreviewIcon color="secondary" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Versions">
                    <IconButton onClick={() => handleViewVersions(file.originalName)}>
                      <VersionsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => setConfirmDelete(file)}>
                      <DeleteIcon color="error" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Preview Dialog */}
      <FilePreview 
        file={previewFile} 
        onClose={() => setPreviewFile(null)} 
      />

      {/* Versions Dialog */}
      <FileVersions 
        versions={versionsFile} 
        onClose={() => setVersionsFile(null)} 
      />

      {/* Delete Confirmation */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{confirmDelete?.originalName}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button 
            onClick={() => handleDelete(confirmDelete?._id)} 
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FileList;