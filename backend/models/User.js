const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },

  role: {
    type: String,
    enum: ['student', 'teacher'],
    default: 'student'
  },

  rollNumber: {
    type: String,
    sparse: true,
    unique: true
  },

  department: String,

  semester: Number,

  bluetoothDeviceId: {
    type: String,
    sparse: true,
    unique: true
  },

  enrolledClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],

  teachingClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],

  createdAt: {
    type: Date,
    default: Date.now
  }

});


userSchema.pre('save', async function (next) {

  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);

  next();

});


userSchema.methods.comparePassword = async function (candidatePassword) {

  return bcrypt.compare(candidatePassword, this.password);

};


module.exports = mongoose.model('User', userSchema);