require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let teacher = await User.findOne({ email: 'teacher@demo.com' });
  if (!teacher) {
    teacher = await User.create({
      name: 'Dr. Rajesh Kumar',
      email: 'teacher@demo.com',
      password: 'password123',
      role: 'teacher',
      department: 'Computer Science'
    });
  }

  const subjects = [
    { name: 'IOT301 - A', subject: 'Block Chain Technology', subjectCode: 'IOT301', esp32DeviceId: 'ESP32_IOT_A' },
    { name: 'IOT302 - A', subject: 'Applied Cryptography', subjectCode: 'IOT302', esp32DeviceId: 'ESP32_IOT_B' },
    { name: 'IOT303 - A', subject: 'AI in Cybersecurity', subjectCode: 'IOT303', esp32DeviceId: 'ESP32_IOT_C' },
    { name: 'IOT304 - A', subject: 'Big Data Analysis', subjectCode: 'IOT304', esp32DeviceId: 'ESP32_IOT_D' },
    { name: 'IOT305 - A', subject: 'Internet of Things', subjectCode: 'IOT305', esp32DeviceId: 'ESP32_IOT_E' }
  ];

  for (const sub of subjects) {
    // Because CS IoT classes are what we want to create
    const existing = await Class.findOne({ subjectCode: sub.subjectCode, department: 'CS IoT' });
    if (!existing) {
      const cls = await Class.create({
        name: sub.name,
        subject: sub.subject,
        subjectCode: sub.subjectCode,
        teacher: teacher._id,
        students: [], // No students enrolled by default, students enroll themselves later or when registering maybe?
        department: 'CS IoT',
        semester: 6,
        esp32DeviceId: sub.esp32DeviceId,
        totalClassesHeld: 0,
        schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }, { day: 'Tuesday', startTime: '09:00', endTime: '10:00' }, { day: 'Wednesday', startTime: '09:00', endTime: '10:00' }, { day: 'Thursday', startTime: '09:00', endTime: '10:00' }, { day: 'Friday', startTime: '09:00', endTime: '10:00' }]
      });
      console.log(`Created ${sub.subject} for CS IoT`);
      await User.findByIdAndUpdate(teacher._id, { $addToSet: { teachingClasses: cls._id } });
    } else {
      console.log(`${sub.subject} already exists for CS IoT`);
    }
  }

  mongoose.disconnect();
}

seed().catch(console.error);
