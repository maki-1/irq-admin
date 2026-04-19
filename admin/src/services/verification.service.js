import api from './api';

export const getVerificationStats = () => api.get('/verifications/stats');
export const getLatestApproved = (limit = 6) => api.get(`/verifications/approved?limit=${limit}`);
export const getVerifications = (status) =>
  api.get('/verifications', { params: status ? { status } : {} });
export const getVerification = (id) => api.get(`/verifications/${id}`);
export const reviewVerification = (id, data) => api.patch(`/verifications/${id}/review`, data);
