const express = require('express');
const router = express.Router();

const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');


/* ------------------------------------
   CREATE CLASS (Teacher)
------------------------------------ */

router.post('/', protect, authorize('teacher'), async (req, res) => {

  try {

    const {
      name,
      subject,
      subjectCode,
      department,
      semester,
      esp32DeviceId,
      schedule
    } = req.body;


    /* Prevent duplicate class */

    const existing = await Class.findOne({
      subjectCode,
      semester,
      department,
      teacher: req.user._id
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Class already exists"
      });
    }


    /* Create class */

    const cls = await Class.create({
      name,
      subject,
      subjectCode,
      department,
      semester,
      esp32DeviceId,
      schedule,
      teacher: req.user._id,
      attendanceActive: false,
      students: []
    });


    /* Add class to teacher */

    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { teachingClasses: cls._id } }
    );


    /* AUTO ENROLL EXISTING STUDENTS (DEMO FRIENDLY) */

    const students = await User.find({
      role: "student",
      department,
      semester
    });

    const studentIds = students.map(s => s._id);

    if (studentIds.length > 0) {

      cls.students = studentIds;

      await cls.save();

      await User.updateMany(
        { _id: { $in: studentIds } },
        { $addToSet: { enrolledClasses: cls._id } }
      );

    }


    await cls.populate('teacher', 'name email');


    res.status(201).json({
      success: true,
      class: cls
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



/* ------------------------------------
   GET CLASSES
------------------------------------ */

router.get('/', protect, async (req, res) => {

  try {

    let classes;

    if (req.user.role === 'teacher') {

      /* Demo Mode: All Teachers see all classes */

      classes = await Class.find({})
      .populate('students', 'name rollNumber email department')
      .populate('teacher', 'name email');

    } else {

      /* Student sees only enrolled classes */

      classes = await Class.find({
        students: req.user._id
      })
      .populate('teacher', 'name email');

    }

    res.json({
      success: true,
      classes
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



/* ------------------------------------
   ENROLL STUDENT
------------------------------------ */

router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {

  try {

    const classId = req.params.id;

    const cls = await Class.findById(classId);

    if (!cls) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }


    /* Check already enrolled */

    const already = cls.students.some(
      s => s.toString() === req.user._id.toString()
    );

    if (already) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled"
      });
    }


    cls.students.addToSet(req.user._id);
    await cls.save();


    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { enrolledClasses: cls._id } }
    );


    res.json({
      success: true,
      message: "Enrolled successfully",
      class: cls
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



/* ------------------------------------
   GET CLASS DETAILS
------------------------------------ */

router.get('/:id', protect, async (req, res) => {

  try {

    const cls = await Class.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate(
        'students',
        'name rollNumber email bluetoothDeviceId department'
      );

    if (!cls) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }


    // Demo Mode: Any teacher can view any class details

    /*
    if (
      req.user.role === "teacher" &&
      cls.teacher._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }
    */


    res.json({
      success: true,
      class: cls
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



/* ------------------------------------
   GET STUDENTS IN CLASS
------------------------------------ */

router.get('/:id/students', protect, authorize('teacher'), async (req, res) => {

  try {

    const cls = await Class.findById(req.params.id)
      .populate(
        'students',
        'name rollNumber email department bluetoothDeviceId'
      );

    if (!cls) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }


    // Demo Mode: Any teacher can view any class students
    
    /*
    if (cls.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }
    */


    res.json({
      success: true,
      students: cls.students
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});


module.exports = router;