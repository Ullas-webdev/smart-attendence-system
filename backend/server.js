require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/proximity', require('./routes/proximity'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/classes', require('./routes/classes'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a class room for real-time updates
  socket.on('join_class', ({ classId }) => {
    socket.join(`class_${classId}`);
    console.log(`Socket ${socket.id} joined class room: class_${classId}`);
  });

  socket.on('leave_class', ({ classId }) => {
    socket.leave(`class_${classId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Seed demo data on first run
const seedDemoData = async () => {
  const User = require('./models/User');
  const Class = require('./models/Class');
  const bcrypt = require('bcryptjs');

  // Fix existing demo students created with insertMany (plain-text passwords)
  const demoStudentEmails = ['arjun@demo.com', 'priya@demo.com', 'rahul@demo.com', 'sneha@demo.com', 'kiran@demo.com'];
  for (const email of demoStudentEmails) {
    const u = await User.findOne({ email }).select('+password');
    if (u && u.password && !u.password.startsWith('$2')) {
      u.password = await bcrypt.hash('password123', 12);
      await u.save();
      console.log(`Fixed password hash for ${email}`);
    }
  }

  const existing = await User.findOne({ email: 'teacher@demo.com' });
  if (existing) return;

  console.log('Seeding demo data...');

  const teacher = await User.create({
    name: 'Dr. Rajesh Kumar',
    email: 'teacher@demo.com',
    password: 'password123',
    role: 'teacher',
    department: 'Computer Science'
  });

  // Use create() so pre('save') hashes passwords; insertMany() does NOT run middleware
  const studentData = [
    { name: 'Arjun Sharma', email: 'arjun@demo.com', password: 'password123', role: 'student', rollNumber: 'CS2021001', department: 'Computer Science', semester: 6, bluetoothDeviceId: 'AA:BB:CC:DD:EE:01' },
    { name: 'Priya Nair', email: 'priya@demo.com', password: 'password123', role: 'student', rollNumber: 'CS2021002', department: 'Computer Science', semester: 6, bluetoothDeviceId: 'AA:BB:CC:DD:EE:02' },
    { name: 'Rahul Verma', email: 'rahul@demo.com', password: 'password123', role: 'student', rollNumber: 'CS2021003', department: 'Computer Science', semester: 6, bluetoothDeviceId: 'AA:BB:CC:DD:EE:03' },
    { name: 'Sneha Patel', email: 'sneha@demo.com', password: 'password123', role: 'student', rollNumber: 'CS2021004', department: 'Computer Science', semester: 6, bluetoothDeviceId: 'AA:BB:CC:DD:EE:04' },
    { name: 'Kiran Reddy', email: 'kiran@demo.com', password: 'password123', role: 'student', rollNumber: 'CS2021005', department: 'Computer Science', semester: 6, bluetoothDeviceId: 'AA:BB:CC:DD:EE:05' }
  ];
  const students = [];
  for (const data of studentData) {
    students.push(await User.create(data));
  }

  const cls = await Class.create({
    name: 'CS301 - A',
    subject: 'Data Structures & Algorithms',
    subjectCode: 'CS301',
    teacher: teacher._id,
    students: students.map(s => s._id),
    department: 'Computer Science',
    semester: 6,
    esp32DeviceId: 'ESP32_CLASSROOM_A',
    totalClassesHeld: 20,
    schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }]
  });

  await User.findByIdAndUpdate(teacher._id, { $push: { teachingClasses: cls._id } });
  await User.updateMany(
    { _id: { $in: students.map(s => s._id) } },
    { $push: { enrolledClasses: cls._id } }
  );

  // Add some historical attendance
  const Attendance = require('./models/Attendance');
  for (const student of students) {
    const presentCount = Math.floor(Math.random() * 8) + 12; // 12-20 present out of 20
    for (let i = 1; i <= presentCount; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 2);
      d.setHours(0, 0, 0, 0);
      try {
        await Attendance.create({
          student: student._id,
          class: cls._id,
          date: d,
          status: 'present',
          markedBy: 'student',
          bluetoothVerified: true,
          rssiAtMarkTime: -55
        });
      } catch (e) { /* skip duplicates */ }
    }
  }

  console.log('✅ Demo data seeded!');
  console.log('Teacher login: teacher@demo.com / password123');
  console.log('Student login: arjun@demo.com / password123');
};

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedDemoData();
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
