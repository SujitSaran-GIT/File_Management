import axios from 'axios';

const API_URL = 'http://localhost:8000/api/files';

const API_URL_PREVIEW = 'http://localhost:8000/api/file';

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`${API_URL}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const getFiles = () => axios.get(API_URL);
export const getFile = (id) => axios.get(`${API_URL}/${id}`);
export const getFileVersions = (filename) => axios.get(`${API_URL}/versions/${filename}`);
export const getFilePreview = (id) => axios.get(`${API_URL_PREVIEW}/preview/${id}`);
export const deleteFile = (id) => axios.delete(`${API_URL}/${id}`);