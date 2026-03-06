const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');
const ProximityBuffer = require('../models/ProximityBuffer');
const { protect, authorize } = require('../middleware/auth');

// @route  POST /api/attendance/mark
// Student marks their own attendance (proximity verified)
router.post('/mark', protect, authorize('student'), async (req, res) => {
  try {
    const { classId } = req.body;
    const student = req.user;

    if (!student.bluetoothDeviceId) {
      return res.status(400).json({ success: false, message: 'No Bluetooth device registered. Please update your profile.' });
    }

    // 1. Verify proximity
    const proximity = await ProximityBuffer.findOne({
      bluetoothDeviceId: student.bluetoothDeviceId,
      classId
    });

    if (!proximity) {
      return res.status(403).json({ success: false, message: 'Not in range. Move closer to the classroom ESP32 device.' });
    }

    if (proximity.rssi < -70) {
      return res.status(403).json({ success: false, message: 'Signal too weak. Please move closer to the classroom device.'});
    }

    const ageSeconds = (Date.now() - new Date(proximity.detectedAt).getTime()) / 1000;
    if (ageSeconds > 120) {
      return res.status(403).json({ success: false, message: 'Proximity expired. Ensure Bluetooth is active.' });
    }

    // 2. Check student is enrolled
    const classDoc = await Class.findById(classId);
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });
    if (!classDoc.students.includes(student._id)) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this class' });
    }

    // 3. Check if already marked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const existing = await Attendance.findOne({
      student: student._id,
      class: classId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for today' });
    }

    // 4. Create attendance record
    const attendance = await Attendance.create({
      student: student._id,
      class: classId,
      date: today,
      status: 'present',
      markedBy: 'student',
      bluetoothVerified: true,
      rssiAtMarkTime: proximity.rssi,
      sessionId: `${classId}_${today.toISOString().split('T')[0]}`
    });

    await attendance.populate('student', 'name rollNumber');

    // 5. Emit real-time to teacher's room
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('attendance_marked', {
        student: { name: student.name, rollNumber: student.rollNumber, id: student._id, department: student.department },
        classId,
        markedAt: attendance.markedAt,
        bluetoothVerified: true
      });
    }

    // 6. Get updated stats
    const stats = await Attendance.getAttendanceStats(student._id, classId);

    res.status(201).json({ success: true, message: 'Attendance marked successfully!', attendance, stats });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for today' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/attendance/my-stats
// Student views their own attendance across all classes
router.get('/my-stats', protect, authorize('student'), async (req, res) => {
  try {
    const student = req.user;
    const classes = await Class.find({ students: student._id });

    const stats = await Promise.all(
      classes.map(async (cls) => {
        const s = await Attendance.getAttendanceStats(student._id, cls._id);
        return { class: { id: cls._id, name: cls.name, subject: cls.subject, subjectCode: cls.subjectCode }, ...s };
      })
    );

    const overallEligible = stats.every(s => s.eligible);
    res.json({ success: true, stats, overallEligible });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/attendance/class/:classId
// Teacher views all attendance for a class
router.get('/class/:classId', protect, authorize('teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    const classDoc = await Class.findById(classId).populate('students', 'name rollNumber email department');
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });

    let query = { class: classId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    }

    const records = await Attendance.find(query)
      .populate('student', 'name rollNumber email department')
      .sort({ markedAt: -1 });

    // Compute per-student stats
    const studentStats = await Promise.all(
      classDoc.students.map(async (stu) => {
        const s = await Attendance.getAttendanceStats(stu._id, classId);
        const todayRecord = records.find(r => r.student?._id?.toString() === stu._id.toString());
        return {
          student: stu,
          ...s,
          todayStatus: todayRecord?.status || 'absent',
          markedAt: todayRecord?.markedAt
        };
      })
    );

    res.json({
      success: true,
      class: classDoc,
      records,
      studentStats,
      belowThreshold: studentStats.filter(s => !s.eligible)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/attendance/manual-override
// Teacher manually marks a student present
router.post('/manual-override', protect, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, classId, date, status } = req.body;

    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const attendance = await Attendance.findOneAndUpdate(
      { student: studentId, class: classId, date: { $gte: today, $lt: tomorrow } },
      {
        student: studentId,
        class: classId,
        date: today,
        status: status || 'manual_override',
        markedBy: 'teacher',
        bluetoothVerified: false,
        markedAt: new Date()
      },
      { upsert: true, new: true }
    );

    await attendance.populate('student', 'name rollNumber');

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('attendance_marked', {
        student: { name: attendance.student.name, rollNumber: attendance.student.rollNumber, id: attendance.student._id, department: attendance.student.department },
        classId,
        markedAt: attendance.markedAt,
        bluetoothVerified: false,
        manualOverride: true
      });
    }

    res.json({ success: true, message: 'Manual override applied', attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/attendance/start-session
// Teacher starts a class session (increments totalClassesHeld)
router.post('/start-session', protect, authorize('teacher'), async (req, res) => {
  try {
    const { classId } = req.body;
    const classDoc = await Class.findByIdAndUpdate(
      classId,
      { $inc: { totalClassesHeld: 1 } },
      { new: true }
    );
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('session_started', {
        classId,
        totalClassesHeld: classDoc.totalClassesHeld,
        startedAt: new Date()
      });
    }

    res.json({ success: true, message: 'Session started', totalClassesHeld: classDoc.totalClassesHeld });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/attendance/eligibility/:classId
// Get eligibility report for a class
router.get('/eligibility/:classId', protect, authorize('teacher'), async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.classId).populate('students', 'name rollNumber email department semester');
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });

    const report = await Promise.all(
      classDoc.students.map(async (stu) => {
        const s = await Attendance.getAttendanceStats(stu._id, classDoc._id);
        return { student: stu, ...s };
      })
    );

    const eligible = report.filter(r => r.eligible);
    const ineligible = report.filter(r => !r.eligible);

    res.json({
      success: true,
      class: { name: classDoc.name, subject: classDoc.subject, totalClassesHeld: classDoc.totalClassesHeld },
      report,
      eligible,
      ineligible,
      summary: { total: report.length, eligible: eligible.length, ineligible: ineligible.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
