const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({

  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  status: {
    type: String,
    enum: ['present', 'absent', 'manual_override'],
    default: 'present'
  },

  markedAt: {
    type: Date,
    default: Date.now
  },

  markedBy: {
    type: String,
    enum: ['student', 'teacher'],
    default: 'student'
  },

  bluetoothVerified: {
    type: Boolean,
    default: false
  },

  rssiAtMarkTime: Number,

  sessionId: String,

  photo: {
    type: String
  }

});


// Prevent duplicate attendance
attendanceSchema.index(
  { student: 1, class: 1, date: 1 },
  { unique: true }
);


// Calculate attendance stats
attendanceSchema.statics.getAttendanceStats = async function (studentId, classId) {

  const Class = require('./Class');

  const classDoc = await Class.findById(classId);

  const totalHeld = classDoc ? classDoc.totalClassesHeld : 0;

  const presentCount = await this.countDocuments({
    student: studentId,
    class: classId,
    status: { $in: ['present', 'manual_override'] }
  });

  const percentage =
    totalHeld > 0
      ? ((presentCount / totalHeld) * 100).toFixed(1)
      : 0;

  return {
    present: presentCount,
    total: totalHeld,
    percentage: parseFloat(percentage),
    eligible: parseFloat(percentage) >= 75
  };

};

module.exports = mongoose.model('Attendance', attendanceSchema);