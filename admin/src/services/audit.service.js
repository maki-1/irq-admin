import api from './api';

export const getAuditLogs = () => api.get('/audit');
export const logAction = (action, details) => api.post('/audit', { action, details });
