import api from './api';

export const getDocuments = () => api.get('/documents');
export const getDocument = (id) => api.get(`/documents/${id}`);
export const createDocument = (data) => api.post('/documents', data);
export const updateStatus = (id, data) => api.patch(`/documents/${id}/status`, data);
export const signDocument = (id) => api.patch(`/documents/${id}/sign`);
export const sealDocument = (id) => api.patch(`/documents/${id}/seal`);
export const updatePayment = (id, data) => api.patch(`/documents/${id}/payment`, data);
export const uploadReceipt = (id, formData) =>
  api.post(`/documents/${id}/receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
