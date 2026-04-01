const express = require('express');
const router = express.Router();

const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');


/* ---------------------------
   START ATTENDANCE SESSION
---------------------------- */

router.post('/start-session', protect, authorize('teacher'), async (req, res) => {

  try {

    const { classId } = req.body;

    const classDoc = await Class.findById(classId);

    if (!classDoc) {
      return res.status(404).json({
        success:false,
        message:"Class not found"
      });
    }

    // Demo Mode: Any teacher can start session
    /*
    if (classDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success:false,
        message:"Not authorized"
      });
    }
    */

    // START SESSION
    classDoc.attendanceActive = true;
    classDoc.attendanceStartedAt = new Date();
    classDoc.totalClassesHeld += 1;

    await classDoc.save();

    // AUTO EXPIRE SESSION AFTER 2 MINUTES
    setTimeout(async () => {

      await Class.findByIdAndUpdate(classId,{
        attendanceActive:false
      });

      console.log("Attendance session expired");

    },120000); // 2 minutes


    res.json({
      success:true,
      message:"Attendance session started",
      class:classDoc
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:err.message
    });

  }

});

/* ---------------------------
   MARK ATTENDANCE
---------------------------- */

router.post('/mark', protect, authorize('student'), async (req, res) => {

  try {

    const { classId } = req.body;
    const student = req.user;

    const classDoc = await Class.findById(classId);

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    /* Check session active */

    if (!classDoc.attendanceActive) {
      return res.status(400).json({
        success: false,
        message: 'Attendance session not active'
      });
    }

    /* Check session expiry */

    const sessionAge = (Date.now() - classDoc.attendanceStartedAt) / 60000;

    if (sessionAge > 2) {

      classDoc.attendanceActive = false;
      await classDoc.save();

      return res.status(400).json({
        success: false,
        message: 'Attendance session expired'
      });

    }

    /* Check student enrolled */

    const isEnrolled = classDoc.students.some(
      id => id.toString() === student._id.toString()
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'Not enrolled in this class'
      });
    }

    /* Today's date */

    const today = new Date();
    today.setHours(0,0,0,0);

    /* Check already marked */

    const alreadyMarked = await Attendance.findOne({
      student: student._id,
      class: classId,
      date: { $gte: today }
    });

    if (alreadyMarked) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    /* Create attendance */

    const attendance = await Attendance.create({
      student: student._id,
      class: classId,
      date: today,
      status: 'present',
      markedBy: 'student'
    });

    await attendance.populate('student','name rollNumber');

    const stats = await Attendance.getAttendanceStats(student._id,classId);

    res.status(201).json({
      success:true,
      message:'Attendance marked successfully',
      attendance,
      stats
    });

  } catch(err) {

    res.status(500).json({
      success:false,
      message:err.message
    });

  }

});


/* ---------------------------
   STUDENT ATTENDANCE STATS
---------------------------- */

router.get('/my-stats', protect, authorize('student'), async (req, res) => {

  try {

    const student = req.user;

    const classes = await Class.find({
      students: student._id
    });

    const today = new Date();
    today.setHours(0,0,0,0);

    const stats = await Promise.all(
      classes.map(async (cls) => {

        const s = await Attendance.getAttendanceStats(
          student._id,
          cls._id
        );

        const todayAttendance = await Attendance.findOne({
          student: student._id,
          class: cls._id,
          date: { $gte: today }
        });

        return {
          class: {
            id: cls._id,
            name: cls.name,
            subject: cls.subject,
            subjectCode: cls.subjectCode
          },
          todayStatus: todayAttendance ? todayAttendance.status : null,
          ...s
        };

      })
    );

    res.json({
      success: true,
      stats
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});


/* ---------------------------
   ELIGIBILITY REPORT
---------------------------- */

router.get('/eligibility/:classId', protect, authorize('teacher'), async (req,res)=>{

  try{

    const { classId } = req.params;

    const classDoc = await Class.findById(classId)
.populate('students', 'name rollNumber email');

if (classDoc.attendanceActive && classDoc.attendanceStartedAt) {

  const sessionAge = (Date.now() - classDoc.attendanceStartedAt) / 60000;

  if (sessionAge > 2) {
    classDoc.attendanceActive = false;
    await classDoc.save();
  }

}
    if(!classDoc){
      return res.status(404).json({
        success:false,
        message:'Class not found'
      });
    }

    const report = [];

    for(const student of classDoc.students){

      const stats = await Attendance.getAttendanceStats(student._id,classId);

      report.push({
        student,
        ...stats
      });

    }

    const eligible = report.filter(r => r.percentage >= 75);
    const ineligible = report.filter(r => r.percentage < 75);

    res.json({
      success:true,
      eligible,
      ineligible
    });

  }catch(err){

    res.status(500).json({
      success:false,
      message:err.message
    });

  }

});


/* ---------------------------
   TEACHER VIEW CLASS ATTENDANCE
---------------------------- */

router.get('/class/:classId', protect, authorize('teacher'), async (req, res) => {

  try {

    const { classId } = req.params;

    const classDoc = await Class.findById(classId)
      .populate('students', 'name rollNumber email');

    if (!classDoc) {
      return res.status(404).json({
        success:false,
        message:'Class not found'
      });
    }

    // Demo Mode: Any teacher can view attendance
    /*
    if (classDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success:false,
        message:'Not authorized'
      });
    }
    */

    const records = await Attendance.find({
      class: classId
    }).populate('student','name rollNumber email');

    res.json({
      success:true,
      class: classDoc,
      records
    });

  } catch (err) {

    res.status(500).json({
      success:false,
      message: err.message
    });

  }

});


/* ---------------------------
   MANUAL ATTENDANCE OVERRIDE
---------------------------- */

router.post('/manual-override', protect, authorize('teacher'), async (req, res) => {

  try {

    const { studentId, classId, status } = req.body;

    const today = new Date();
    today.setHours(0,0,0,0);

    const existing = await Attendance.findOne({
      student: studentId,
      class: classId,
      date: { $gte: today }
    });

    if (existing) {

      existing.status = status || 'manual_override';
      existing.markedBy = 'teacher';

      await existing.save();

      return res.json({
        success:true,
        attendance: existing
      });

    }

    const attendance = await Attendance.create({
      student: studentId,
      class: classId,
      date: today,
      status: status || 'manual_override',
      markedBy: 'teacher'
    });

    res.json({
      success:true,
      attendance
    });

  } catch (err) {

    res.status(500).json({
      success:false,
      message: err.message
    });

  }

});


module.exports = router;