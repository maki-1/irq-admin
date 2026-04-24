import api from './api';

export const getRequests = () => api.get('/requests');
export const getRequest = (id) => api.get(`/requests/${id}`);
export const updateRequestStatus = (id, data) => api.patch(`/requests/${id}/status`, data);
export const getReleases = () => api.get('/releases');
export const updateClaimStatus = (id, claimStatus) => api.patch(`/releases/${id}/claim-status`, { claimStatus });
