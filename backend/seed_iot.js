require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Class = require('./models/Class');

async function seed() {

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Connected to MongoDB');


  /* ------------------ CREATE TEACHER ------------------ */

  let teacher = await User.findOne({ email: 'admin@university.edu' });

  if (!teacher) {

    teacher = await User.create({
      name: 'Admin Professor',
      email: 'admin@university.edu',
      password: 'password123',
      role: 'teacher',
      department: 'CS IoT'
    });

    console.log('👨‍🏫 Demo teacher created');

  }


  /* ------------------ SUBJECT LIST ------------------ */

  const subjects = [

    {
      name: 'IOT301-A',
      subject: 'Blockchain Technology',
      subjectCode: 'IOT301',
      department: 'CS IoT',
      semester: 6,
      esp32DeviceId: 'ESP32_A'
    },

    {
      name: 'IOT302-A',
      subject: 'Applied Cryptography',
      subjectCode: 'IOT302',
      department: 'CS IoT',
      semester: 6,
      esp32DeviceId: 'ESP32_B'
    },

    {
      name: 'IOT303-A',
      subject: 'AI in Cybersecurity',
      subjectCode: 'IOT303',
      department: 'CS IoT',
      semester: 6,
      esp32DeviceId: 'ESP32_C'
    },

    {
      name: 'IOT304-A',
      subject: 'Big Data Analytics',
      subjectCode: 'IOT304',
      department: 'CS IoT',
      semester: 6,
      esp32DeviceId: 'ESP32_D'
    },

    {
      name: 'IOT305-A',
      subject: 'Internet of Things',
      subjectCode: 'IOT305',
      department: 'CS IoT',
      semester: 6,
      esp32DeviceId: 'ESP32_E'
    }

  ];


  /* ------------------ CREATE CLASSES ------------------ */

  for (const sub of subjects) {

    const existing = await Class.findOne({
      subjectCode: sub.subjectCode,
      department: sub.department
    });

    if (!existing) {

      const cls = await Class.create({
        name: sub.name,
        subject: sub.subject,
        subjectCode: sub.subjectCode,
        teacher: teacher._id,
        department: sub.department,
        semester: sub.semester,
        esp32DeviceId: sub.esp32DeviceId,
        students: [],
        totalClassesHeld: 0,
        schedule: [
          { day: 'Monday', startTime: '09:00', endTime: '10:00' }
        ]
      });

      await User.findByIdAndUpdate(
        teacher._id,
        { $addToSet: { teachingClasses: cls._id } }
      );

      console.log(`📚 Created subject: ${sub.subject}`);

    } else {

      console.log(`⚠️ ${sub.subject} already exists`);

    }

  }


  console.log('🎉 Seeding completed');

  mongoose.disconnect();

}

seed().catch(console.error);