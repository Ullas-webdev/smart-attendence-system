import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Auto-attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally (skip redirect for login request so user sees error toast)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const isLoginRequest = err.config?.url?.includes('auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');
export const updateBluetooth = (bluetoothDeviceId) => api.put('/auth/update-bluetooth', { bluetoothDeviceId });

// Proximity
export const checkProximity = (bluetoothDeviceId, classId) =>
  api.get(`/proximity/check/${bluetoothDeviceId}`, { params: { classId } });
export const simulateProximity = (classId) => api.post('/proximity/simulate', { classId });
export const getActiveDevices = (classId) => api.get(`/proximity/active-devices/${classId}`);

// Attendance
export const markAttendance = (classId) => api.post('/attendance/mark', { classId });
export const getMyStats = () => api.get('/attendance/my-stats');
export const getClassAttendance = (classId, date) =>
  api.get(`/attendance/class/${classId}`, { params: date ? { date } : {} });
export const manualOverride = (data) => api.post('/attendance/manual-override', data);
export const startSession = (classId) => api.post('/attendance/start-session', { classId });
export const getEligibilityReport = (classId) => api.get(`/attendance/eligibility/${classId}`);

// Classes
export const getClasses = () => api.get('/classes');
export const createClass = (data) => api.post('/classes', data);
export const enrollInClass = (classId, studentId) =>
  api.post(`/classes/${classId}/enroll`, studentId ? { studentId } : {});
export const getClass = (classId) => api.get(`/classes/${classId}`);
export const getClassStudents = (classId) => api.get(`/classes/${classId}/students`);
