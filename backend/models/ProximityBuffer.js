const mongoose = require('mongoose');

// Temporary in-memory buffer for BLE-detected devices
// TTL index auto-clears stale entries after timeout
const proximityBufferSchema = new mongoose.Schema({
  bluetoothDeviceId: {
    type: String,
    required: true
  },
  esp32DeviceId: {
    type: String,
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  rssi: Number,
  detectedAt: {
    type: Date,
    default: Date.now,
    expires: 120 // TTL: auto-remove after 120 seconds (2 minutes)
  }
});

proximityBufferSchema.index({ bluetoothDeviceId: 1, esp32DeviceId: 1 });

module.exports = mongoose.model('ProximityBuffer', proximityBufferSchema);
