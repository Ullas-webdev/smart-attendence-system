import axios from 'axios';

let rawUrl = import.meta.env.VITE_API_URL || '/api';
if (rawUrl.startsWith('http') && !rawUrl.endsWith('/api')) {
  if (rawUrl.endsWith('/')) rawUrl = rawUrl.slice(0, -1);
  rawUrl += '/api';
}

const api = axios.create({
  baseURL: rawUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});


/* ---------------- AUTH TOKEN ---------------- */

api.interceptors.request.use(config => {

  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;

});


/* ---------------- HANDLE TOKEN EXPIRY ---------------- */

api.interceptors.response.use(
  res => res,
  err => {

    if (err.response?.status === 401) {

      const isLoginRequest = err.config?.url?.includes('/auth/login');

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



/* ================= AUTH ================= */

export const login = (data) =>
  api.post('/auth/login', data);

export const register = (data) =>
  api.post('/auth/register', data);

export const getMe = () =>
  api.get('/auth/me');

export const updateBluetooth = (data) =>
  api.put('/auth/update-bluetooth', data);



/* ================= PROXIMITY ================= */

export const checkProximity = (classId) =>
  api.get(`/proximity/check/${classId}`);

export const simulateProximity = (data) =>
  api.post('/proximity/simulate', data);

/* FIXED ROUTE */
export const getActiveDevices = (classId) =>
  api.get(`/proximity/active-devices/${classId}`);



/* ================= ATTENDANCE ================= */

export const markAttendance = (data) =>
  api.post('/attendance/mark', data);

export const getMyStats = () =>
  api.get('/attendance/my-stats');

export const getClassAttendance = (classId, date) =>
  api.get(`/attendance/class/${classId}`, {
    params: date ? { date } : {}
  });

export const manualOverride = (data) =>
  api.post('/attendance/manual-override', data);

export const startSession = (data) =>
  api.post('/attendance/start-session', data);

export const getEligibilityReport = (classId) =>
  api.get(`/attendance/eligibility/${classId}`);



/* ================= CLASSES ================= */

export const getClasses = () =>
  api.get('/classes');

export const createClass = (data) =>
  api.post('/classes', data);

export const enrollInClass = (classId, studentId) =>
  api.post(`/classes/${classId}/enroll`, studentId ? { studentId } : {});

export const getClass = (classId) =>
  api.get(`/classes/${classId}`);

export const getClassStudents = (classId) =>
  api.get(`/classes/${classId}/students`);