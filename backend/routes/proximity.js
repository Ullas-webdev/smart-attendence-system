const express = require('express');
const router = express.Router();
const ProximityBuffer = require('../models/ProximityBuffer');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect } = require('../middleware/auth');

// @route  POST /api/proximity/verify-proximity
// Called by ESP32 hardware to whitelist a detected BLE device
// ESP32 POSTs: { bluetoothDeviceId, esp32DeviceId, rssi, classId? }
router.post('/verify-proximity', async (req, res) => {
  try {
    const { bluetoothDeviceId, esp32DeviceId, rssi, classId } = req.body;

    if (!bluetoothDeviceId || !esp32DeviceId) {
      return res.status(400).json({ success: false, message: 'bluetoothDeviceId and esp32DeviceId are required' });
    }

    // Only whitelist if signal is strong enough (RSSI > -70 dBm = within ~5 meters)
    const RSSI_THRESHOLD = -70;
    if (rssi && rssi < RSSI_THRESHOLD) {
      return res.json({ success: false, message: 'Device out of range', rssi });
    }

    // Find class by esp32DeviceId if classId not provided
    let resolvedClassId = classId;
    if (!resolvedClassId) {
      const classDoc = await Class.findOne({ esp32DeviceId });
      if (classDoc) resolvedClassId = classDoc._id;
    }

    // Upsert: update or create proximity entry (resets TTL timer)
    await ProximityBuffer.findOneAndUpdate(
      { bluetoothDeviceId, esp32DeviceId },
      { bluetoothDeviceId, esp32DeviceId, rssi, classId: resolvedClassId, detectedAt: new Date() },
      { upsert: true, new: true }
    );

    // Emit real-time event via socket.io (attached to req.app)
    const io = req.app.get('io');
    if (io && resolvedClassId) {
      const student = await User.findOne({ bluetoothDeviceId }, 'name rollNumber');
      if (student) {
        io.to(`class_${resolvedClassId}`).emit('device_detected', {
          studentName: student.name,
          rollNumber: student.rollNumber,
          bluetoothDeviceId,
          rssi,
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, message: 'Device whitelisted', classId: resolvedClassId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/proximity/check/:bluetoothDeviceId
// Frontend polls this to check if student's device is in range
router.get('/check/:bluetoothDeviceId', protect, async (req, res) => {
  try {
    const { bluetoothDeviceId } = req.params;
    const { classId } = req.query;

    const query = { bluetoothDeviceId };
    if (classId) query.classId = classId;

    const entry = await ProximityBuffer.findOne(query).sort({ detectedAt: -1 });

    if (!entry) {
      return res.json({ success: true, inRange: false, message: 'Device not detected by any ESP32' });
    }

    // Check if entry is fresh (within last 2 minutes)
    const ageSeconds = (Date.now() - new Date(entry.detectedAt).getTime()) / 1000;
    const isRecent = ageSeconds < 120;

    res.json({
      success: true,
      inRange: isRecent,
      rssi: entry.rssi,
      classId: entry.classId,
      detectedAt: entry.detectedAt,
      ageSeconds: Math.round(ageSeconds)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  GET /api/proximity/active-devices/:classId
// Teacher can see all currently in-range devices for their class
router.get('/active-devices/:classId', protect, async (req, res) => {
  try {
    const activeEntries = await ProximityBuffer.find({ classId: req.params.classId });
    const deviceIds = activeEntries.map(e => e.bluetoothDeviceId);

    const students = await User.find({ bluetoothDeviceId: { $in: deviceIds } }, 'name rollNumber bluetoothDeviceId');

    const result = students.map(s => {
      const entry = activeEntries.find(e => e.bluetoothDeviceId === s.bluetoothDeviceId);
      return { student: s, rssi: entry?.rssi, detectedAt: entry?.detectedAt };
    });

    res.json({ success: true, count: result.length, activeDevices: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/proximity/simulate
// DEV ONLY: Simulate an ESP32 detection for testing without hardware
router.post('/simulate', protect, async (req, res) => {
  try {
    const { classId } = req.body;
    const user = req.user;
    if (!user.bluetoothDeviceId) {
      return res.status(400).json({ success: false, message: 'No Bluetooth device ID registered for this user' });
    }

    await ProximityBuffer.findOneAndUpdate(
      { bluetoothDeviceId: user.bluetoothDeviceId },
      {
        bluetoothDeviceId: user.bluetoothDeviceId,
        esp32DeviceId: 'SIMULATED_ESP32',
        rssi: -55,
        classId,
        detectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Proximity simulated successfully', inRange: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
