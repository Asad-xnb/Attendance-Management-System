const router = require('express').Router();
const { Admin, Class, Course, Student, Attendance } = require('../models');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Get teacher's classes and courses
router.get('/api/teacher-data', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const teacherId = req.session.userId;
    
    // Get all classes where this teacher is an instructor
    const courses = await Course.find({ instructorRef: teacherId })
      .populate('classRef', 'name semester section department')
      .lean();
    
    // Group courses by class
    const classesMap = new Map();
    
    for (const course of courses) {
      const classId = course.classRef._id.toString();
      
      if (!classesMap.has(classId)) {
        classesMap.set(classId, {
          _id: course.classRef._id,
          name: course.classRef.name,
          semester: course.classRef.semester,
          section: course.classRef.section,
          department: course.classRef.department,
          displayName: `${course.classRef.name} ${course.classRef.semester} - ${course.classRef.section}`,
          courses: []
        });
      }
      
      classesMap.get(classId).courses.push({
        _id: course._id,
        name: course.name,
        code: course.code
      });
    }
    
    const classes = Array.from(classesMap.values());
    
    res.json({ classes });
  } catch (error) {
    console.error('Error fetching teacher data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students with face descriptors for a specific class
router.get('/api/class-students/:classId', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    
    const students = await Student.find({ 
      classRef: classId,
      isEnrolled: true,
      faceDescriptor: { $exists: true, $ne: [] }
    }).select('_id username fullName rollNo faceDescriptor').lean();
    
    res.json({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark attendance
router.post('/api/mark-attendance', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { studentId, courseId, classId, confidenceScore } = req.body;
    
    if (!studentId || !courseId || !classId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { studentId: !!studentId, courseId: !!courseId, classId: !!classId }
      });
    }
    
    const sessionDate = new Date();
    sessionDate.setHours(0, 0, 0, 0);
    
    // Check if attendance already marked today for this course
    const existingAttendance = await Attendance.findOne({
      studentRef: studentId,
      courseRef: courseId,
      sessionDate: sessionDate
    });
    
    if (existingAttendance) {
      return res.status(400).json({ 
        error: 'Attendance already marked',
        alreadyMarked: true
      });
    }
    
    // Determine status based on time (example: late after 9:15 AM)
    const now = new Date();
    const cutoffTime = new Date(now);
    cutoffTime.setHours(9, 15, 0, 0);
    const status = now > cutoffTime ? 'late' : 'present';
    
    // Create attendance record
    const attendance = await Attendance.create({
      studentRef: studentId,
      courseRef: courseId,
      classRef: classId,
      status: status,
      confidenceScore: confidenceScore || 0,
      markedBy: 'facial_recognition',
      sessionDate: sessionDate,
      timestamp: new Date()
    });
    
    // Get student info for response
    const student = await Student.findById(studentId).select('fullName rollNo').lean();
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({
      success: true,
      attendance: {
        ...attendance.toObject(),
        studentRef: studentId,
        student: student
      },
      status: status
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get today's attendance for a course
router.get('/api/today-attendance/:courseId', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required', attendance: [] });
    }
    
    const sessionDate = new Date();
    sessionDate.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.find({
      courseRef: courseId,
      sessionDate: sessionDate
    })
    .populate('studentRef', 'fullName rollNo')
    .sort({ timestamp: -1 })
    .lean();
    
    // Filter out records with null studentRef and transform the data
    const formattedAttendance = attendance
      .filter(record => record.studentRef && record.studentRef._id)
      .map(record => ({
        ...record,
        studentRef: record.studentRef._id,
        student: {
          _id: record.studentRef._id,
          fullName: record.studentRef.fullName,
          rollNo: record.studentRef.rollNo
        }
      }));
    
    res.json({ attendance: formattedAttendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: error.message, attendance: [] });
  }
});

module.exports = router;
