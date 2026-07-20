import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// The currently selected semester ('all' or a numeric id as string). Kept as a
// module-level value so every request carries it without editing each call site.
// Initialized synchronously from localStorage so the very first requests are scoped.
let currentSemester = localStorage.getItem('selectedSemester') || 'all';

export function setApiSemester(value) {
  currentSemester = value || 'all';
}
export function getApiSemester() {
  return currentSemester;
}

// Attach the selected semester to every request. The server applies it to reads
// only and ignores it for writes (new records always land in the current semester).
api.interceptors.request.use((config) => {
  config.params = { ...(config.params || {}), semester: currentSemester };
  return config;
});

export default api;
