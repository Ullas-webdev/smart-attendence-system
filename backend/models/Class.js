const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({

  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },

  subject: {
    type: String,
    required: true,
    trim: true
  },

  subjectCode: {
    type: String,
    trim: true
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  department: {
    type: String,
    index: true
  },

  semester: {
    type: Number,
    index: true
  },

  totalClassesHeld: {
    type: Number,
    default: 0
  },

  schedule: [{
    day: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ]
    },
    startTime: String,
    endTime: String
  }],

  /* BLE Device Assigned to Classroom */

  esp32DeviceId: {
    type: String
  },


  /* --------------------------
     Attendance Session Control
  --------------------------- */

  attendanceActive: {
    type: Boolean,
    default: false
  },

  attendanceStartedAt: {
    type: Date
  },


  createdAt: {
    type: Date,
    default: Date.now
  }

});


/* ----------------------------------
   Prevent duplicate subjects
----------------------------------- */

classSchema.index(
  { subjectCode: 1, teacher: 1, semester: 1 },
  { unique: true }
);


/* ----------------------------------
   Virtual: session active check
----------------------------------- */

classSchema.virtual('sessionValid').get(function () {

  if (!this.attendanceActive) return false;

  if (!this.attendanceStartedAt) return false;

  const minutes = (Date.now() - this.attendanceStartedAt) / 60000;

  return minutes <= 5;

});


module.exports = mongoose.model('Class', classSchema);