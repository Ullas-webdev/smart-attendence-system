# AttendSmart — BLE-Powered Automated Attendance System

A full-stack real-time attendance system for engineering colleges using **Bluetooth Low Energy (BLE) proximity detection** via ESP32.

---

## 🏗️ Architecture Overview

```
┌─────────────┐    BLE Scan     ┌─────────────┐    POST /verify-proximity    ┌─────────────┐
│ Student's   │ ──────────────> │   ESP32     │ ──────────────────────────> │  Node.js    │
│ Phone (BLE) │                 │ (Classroom) │                              │  Backend    │
└─────────────┘                 └─────────────┘                              │  (Express)  │
                                                                             └──────┬──────┘
                                                                                    │
┌─────────────┐    Polls /check  ┌─────────────┐                           ┌──────▼──────┐
│  React.js   │ <──────────────> │  REST API   │ <───────────────────────> │  MongoDB    │
│  Frontend   │    Socket.IO     │  + Socket   │                           │ (ProximityBuf│
│  Dashboard  │                  │             │                            │  Attendance) │
└─────────────┘                  └─────────────┘                           └─────────────┘
```

## 📁 Project Structure

```
attendance-system/
├── backend/
│   ├── models/
│   │   ├── User.js              # Student & Teacher schema
│   │   ├── Class.js             # Class/Subject schema
│   │   ├── Attendance.js        # Attendance records + stats
│   │   └── ProximityBuffer.js   # Temporary BLE detection buffer (TTL: 120s)
│   ├── routes/
│   │   ├── auth.js              # Login, register, /me
│   │   ├── proximity.js         # /verify-proximity (ESP32), /check, /simulate
│   │   ├── attendance.js        # Mark, stats, override, eligibility
│   │   └── classes.js           # Class CRUD, enroll
│   ├── middleware/
│   │   └── auth.js              # JWT protect + role authorize
│   ├── server.js                # Express + Socket.IO + MongoDB
│   └── .env
│
├── frontend/src/
│   ├── pages/
│   │   ├── Login.jsx            # Auth page with demo buttons
│   │   ├── Register.jsx         # Registration form
│   │   ├── StudentDashboard.jsx # BLE toggle, mark attendance, stats
│   │   └── TeacherDashboard.jsx # Class overview, live feed, eligibility
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── AttendanceStats.jsx  # Reusable charts & badges
│   ├── context/AuthContext.jsx  # JWT auth state
│   ├── hooks/useSocket.js       # Socket.IO real-time hook
│   ├── services/api.js          # Axios API calls
│   └── App.jsx                  # Router + protected routes
│
└── esp32/
    └── attendance_scanner.ino   # C++ BLE scanner firmware
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local: `mongod` or [MongoDB Atlas](https://cloud.mongodb.com) free tier)
- **Arduino IDE** (for ESP32 firmware, optional)

---

### 1. Backend Setup

```bash
cd attendance-system/backend
npm install

# Edit .env with your MongoDB URI
nano .env
# MONGODB_URI=mongodb://localhost:27017/attendance_system
# JWT_SECRET=change_this_to_a_random_string

npm start
# Server runs at http://localhost:5000
# Auto-seeds demo data on first run
```

**Demo accounts seeded automatically:**
| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@demo.com | password123 |
| Student | arjun@demo.com | password123 |
| Student | priya@demo.com | password123 |
| Student | rahul@demo.com | password123 |

---

### 2. Frontend Setup

```bash
cd attendance-system/frontend
npm install
npm run dev
# App runs at http://localhost:3000
```

---

### 3. ESP32 Setup (Hardware)

1. Install [Arduino IDE](https://www.arduino.cc/en/software)
2. Add ESP32 board support:
   - File > Preferences > Additional Board URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
3. Install ArduinoJson library (Tools > Manage Libraries > search "ArduinoJson" v6)
4. Edit `esp32/attendance_scanner.ino`:
   ```cpp
   const char* WIFI_SSID    = "YOUR_WIFI";
   const char* WIFI_PASSWORD = "YOUR_PASS";
   const char* SERVER_URL   = "http://YOUR_PC_IP:5000/api/proximity/verify-proximity";
   const char* ESP32_DEVICE_ID = "ESP32_CLASSROOM_A";
   ```
5. Flash to ESP32 (Tools > Board > ESP32 Dev Module, Upload)

---

## 🔌 API Reference

### ESP32 Endpoint (Hardware calls this)

```http
POST /api/proximity/verify-proximity
Content-Type: application/json

{
  "bluetoothDeviceId": "AA:BB:CC:DD:EE:FF",  // Student's BT MAC
  "esp32DeviceId": "ESP32_CLASSROOM_A",
  "rssi": -55,
  "classId": "64a1..."                         // Optional
}
```

### Frontend-facing Endpoints

```http
# Check if student's device is currently in range
GET /api/proximity/check/:bluetoothDeviceId?classId=...

# Simulate proximity (dev mode, no hardware needed)
POST /api/proximity/simulate
{ "classId": "..." }

# Mark attendance (student, proximity-gated)
POST /api/attendance/mark
{ "classId": "..." }

# Get student's attendance stats
GET /api/attendance/my-stats

# Get class attendance (teacher only)
GET /api/attendance/class/:classId

# Manual override (teacher only)
POST /api/attendance/manual-override
{ "studentId": "...", "classId": "...", "status": "manual_override" }

# Start a class session (increments totalClassesHeld)
POST /api/attendance/start-session
{ "classId": "..." }

# Eligibility report (teacher only)
GET /api/attendance/eligibility/:classId
```

---

## ⚡ System Workflow

```
1. Teacher starts session → POST /attendance/start-session (increments class count)

2. ESP32 scans BLE devices every 5 seconds
   → Filters by RSSI threshold (-70 dBm ≈ 5m range)
   → POSTs detected MACs to /verify-proximity
   → Server stores in ProximityBuffer (TTL: 120 seconds)

3. Student opens app → app polls /proximity/check every 5s
   → If device found in ProximityBuffer: Mark Attendance button ENABLES
   → If not found: Button stays DISABLED with "Out of Range" message

4. Student clicks Mark Attendance
   → Backend re-verifies proximity buffer (double-check)
   → Creates Attendance record in MongoDB
   → Emits Socket.IO event to teacher's browser

5. Teacher dashboard updates in real-time
   → Live feed shows student name + BLE verified badge
   → Table refreshes attendance status
   → Eligibility percentages recalculate
```

---

## 📊 Database Schema

### User
```js
{ name, email, password(hashed), role: 'student'|'teacher',
  rollNumber, department, semester,
  bluetoothDeviceId,  // ← key for BLE matching
  enrolledClasses[], teachingClasses[] }
```

### Class
```js
{ name, subject, subjectCode, teacher(ref), students[],
  department, semester, totalClassesHeld,
  esp32DeviceId,   // ← links ESP32 to classroom
  schedule[] }
```

### Attendance
```js
{ student(ref), class(ref), date, status, markedBy,
  bluetoothVerified, rssiAtMarkTime, sessionId }
// Unique index: student + class + date (prevents duplicates)
```

### ProximityBuffer
```js
{ bluetoothDeviceId, esp32DeviceId, classId, rssi, detectedAt }
// TTL index: auto-deletes after 120 seconds
```

---

## 🛡️ Security Notes

1. **JWT Auth**: All routes except `/verify-proximity` require Bearer token
2. **Role Guards**: Students can't access teacher routes and vice versa
3. **Double Verification**: Attendance marking re-checks proximity server-side
4. **Duplicate Prevention**: MongoDB unique index prevents same-day double marking
5. **For Production**: Add `X-ESP32-Secret` header validation to `/verify-proximity`

---

## 📱 Android/iOS BLE Notes

Modern phones randomize BLE MAC addresses. For a production deployment:

- **Option A**: Build a React Native companion app that advertises a stable UUID
- **Option B**: Use Google Nearby / Apple Core Bluetooth APIs with a UUID registered per student
- **For Testing**: Use "BLE Peripheral Simulator" (Android) or "LightBlue" (iOS) to advertise a fixed MAC

The **Simulate Proximity** button in the UI bypasses BLE for demo/testing purposes.

---

## 🎨 Features Summary

| Feature | Student | Teacher |
|---------|---------|---------|
| Login / JWT Auth | ✅ | ✅ |
| BLE Device Registration | ✅ | — |
| Proximity Status (live poll) | ✅ | — |
| Mark Attendance (BLE-gated) | ✅ | — |
| Attendance % per subject | ✅ | — |
| Eligibility status (75% rule) | ✅ | ✅ |
| Class overview table | — | ✅ |
| Real-time attendance feed | — | ✅ (Socket.IO) |
| Manual override | — | ✅ |
| Start class session | — | ✅ |
| Eligibility report | — | ✅ |
| Live BLE device list | — | ✅ |
| Dev mode simulation | ✅ | — |
