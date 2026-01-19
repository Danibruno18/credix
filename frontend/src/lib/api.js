import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Categories API
export const categoriesApi = {
  getAll: async () => {
    const response = await axios.get(`${API}/categories`);
    return response.data;
  },
  create: async (data) => {
    const response = await axios.post(`${API}/categories`, data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await axios.put(`${API}/categories/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await axios.delete(`${API}/categories/${id}`);
  }
};

// Transactions API
export const transactionsApi = {
  getAll: async (params = {}) => {
    const response = await axios.get(`${API}/transactions`, { params });
    return response.data;
  },
  create: async (data) => {
    const response = await axios.post(`${API}/transactions`, data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await axios.put(`${API}/transactions/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await axios.delete(`${API}/transactions/${id}`);
  }
};

// Reports API
export const reportsApi = {
  getSummary: async (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const response = await axios.get(`${API}/reports/summary`, { params });
    return response.data;
  },
  getByCategory: async (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const response = await axios.get(`${API}/reports/by-category`, { params });
    return response.data;
  }
};
