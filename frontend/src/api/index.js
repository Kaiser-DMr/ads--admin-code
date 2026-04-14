import http from './http';

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
};

export const campaignApi = {
  list: (params) => http.get('/campaigns', { params }),
  get: (id) => http.get(`/campaigns/${id}`),
  create: (data) => http.post('/campaigns', data),
  update: (id, data) => http.put(`/campaigns/${id}`, data),
  remove: (id) => http.delete(`/campaigns/${id}`),
  summary: () => http.get('/campaigns/meta/summary'),
  submitReview: (id) => http.post(`/campaigns/${id}/submit-review`),
  withdrawReview: (id) => http.post(`/campaigns/${id}/withdraw-review`),
  approve: (id) => http.post(`/campaigns/${id}/approve`),
  reject: (id, data) => http.post(`/campaigns/${id}/reject`, data),
  activate: (id) => http.post(`/campaigns/${id}/activate`),
  pause: (id, data) => http.post(`/campaigns/${id}/pause`, data),
  complete: (id) => http.post(`/campaigns/${id}/complete`),
  terminate: (id, data) => http.post(`/campaigns/${id}/terminate`, data),
  batchSubmitReview: (ids) => http.post('/campaigns/batch/submit-review', { ids }),
  batchActivate: (ids) => http.post('/campaigns/batch/activate', { ids }),
  batchPause: (ids, reason) => http.post('/campaigns/batch/pause', { ids, reason }),
  batchTerminate: (ids, reason) => http.post('/campaigns/batch/terminate', { ids, reason }),
};

export const creativeApi = {
  list: (params) => http.get('/creatives', { params }),
  create: (data) => http.post('/creatives', data),
  review: (id, data) => http.put(`/creatives/${id}/review`, data),
  remove: (id) => http.delete(`/creatives/${id}`),
};

export const reportApi = {
  trend: (params) => http.get('/reports/trend', { params }),
  campaigns: () => http.get('/reports/campaigns'),
  platforms: () => http.get('/reports/platforms'),
};

export const baiduApi = {
  campaigns: () => http.get('/baidu/campaigns'),
  reportDaily: (params) => http.get('/baidu/report/daily', { params }),
  reportCampaign: () => http.get('/baidu/report/campaign'),
};

export const kuaishouApi = {
  campaigns: () => http.get('/kuaishou/campaigns'),
  reportDaily: (params) => http.get('/kuaishou/report/daily', { params }),
  reportCampaign: () => http.get('/kuaishou/report/campaign'),
};

export const jliangApi = {
  campaigns: () => http.get('/jliang/campaigns'),
  reportDaily: (params) => http.get('/jliang/report/daily', { params }),
  reportCampaign: () => http.get('/jliang/report/campaign'),
};

export const googleApi = {
  campaigns: () => http.get('/google/campaigns'),
  reportDaily: (params) => http.get('/google/report/daily', { params }),
  reportCampaign: () => http.get('/google/report/campaign'),
};

export const userApi = {
  list: () => http.get('/users'),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.put(`/users/${id}`, data),
  remove: (id) => http.delete(`/users/${id}`),
};
