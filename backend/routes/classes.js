const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route  POST /api/classes
// Teacher creates a class
router.post('/', protect, authorize('teacher'), async (req, res) => {
  try {
    const { name, subject, subjectCode, department, semester, esp32DeviceId, schedule } = req.body;
    const cls = await Class.create({
      name, subject, subjectCode, department, semester, esp32DeviceId, schedule,
      teacher: req.user._id
    });

    await User.findByIdAndUpdate(req.user._id, { $push: { teachingClasses: cls._id } });
    await cls.populate('teacher', 'name email');
    res.status(201).json({ success: true, class: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/classes
// Get all classes (for teacher: their classes; for student: enrolled classes)
router.get('/', protect, async (req, res) => {
  try {
    let classes;
    if (req.user.role === 'teacher') {
      classes = await Class.find({ teacher: req.user._id }).populate('students', 'name rollNumber email department');
    } else {
      classes = await Class.find({ 
        semester: 6,
        department: req.user.department
      }).populate('teacher', 'name email');
    }
    res.json({ success: true, classes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/classes/:id/enroll
// Enroll a student in a class
router.post('/:id/enroll', protect, async (req, res) => {
  try {
    const { studentId } = req.body;
    const targetId = studentId || req.user._id;

    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: targetId } },
      { new: true }
    );
    await User.findByIdAndUpdate(targetId, { $addToSet: { enrolledClasses: cls._id } });

    res.json({ success: true, message: 'Enrolled successfully', class: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/classes/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'name rollNumber email bluetoothDeviceId department');
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, class: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/classes/:id/students
// Get students for a specific class
router.get('/:id/students', protect, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('students', 'name rollNumber email department bluetoothDeviceId');
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, students: cls.students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
