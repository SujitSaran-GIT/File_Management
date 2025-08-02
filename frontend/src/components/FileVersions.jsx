import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  Box,
  Typography
} from '@mui/material';
import { Close, GetApp } from '@mui/icons-material';

const FileVersions = ({ versions, onClose }) => {
  if (!versions) return null;

  return (
    <Dialog open={Boolean(versions)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Version History: {versions.originalName}
          </Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.versions.map((version) => (
                <TableRow key={version._id}>
                  <TableCell>v{version.version}</TableCell>
                  <TableCell>{(version.size / 1024).toFixed(2)} KB</TableCell>
                  <TableCell>
                    {new Date(version.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {version.isCurrent ? (
                      <Chip label="Current" color="primary" size="small" />
                    ) : (
                      <Chip label="Older" variant="outlined" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      href={`http://localhost:8000/api/files/${version._id}`}
                      target="_blank"
                    >
                      <GetApp color="primary" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
};

export default FileVersions;