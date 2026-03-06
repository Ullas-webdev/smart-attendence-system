const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect } = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @route  POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department, semester, bluetoothDeviceId } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const userData = { name, email, password, role, department, semester };
    if (rollNumber) userData.rollNumber = rollNumber;
    if (bluetoothDeviceId) userData.bluetoothDeviceId = bluetoothDeviceId;

    const user = await User.create(userData);

    if (role === 'student' && department && semester) {
      const matchingClasses = await Class.find({ department, semester });
      if (matchingClasses.length > 0) {
        const classIds = matchingClasses.map(c => c._id);
        await User.findByIdAndUpdate(user._id, { $addToSet: { enrolledClasses: { $each: classIds } } });
        await Class.updateMany({ _id: { $in: classIds } }, { $addToSet: { students: user._id } });
      }
    }

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, bluetoothDeviceId: user.bluetoothDeviceId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        department: user.department,
        semester: user.semester,
        bluetoothDeviceId: user.bluetoothDeviceId,
        enrolledClasses: user.enrolledClasses,
        teachingClasses: user.teachingClasses
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('enrolledClasses', 'name subject subjectCode')
    .populate('teachingClasses', 'name subject subjectCode students');
  res.json({ success: true, user });
});

// @route  PUT /api/auth/update-bluetooth
router.put('/update-bluetooth', protect, async (req, res) => {
  try {
    const { bluetoothDeviceId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bluetoothDeviceId },
      { new: true }
    );
    res.json({ success: true, bluetoothDeviceId: user.bluetoothDeviceId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
