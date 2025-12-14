const router = require('express').Router();
const { Admin, Class, Course, Student, Attendance, Settings } = require('../models');
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
    const { studentId, courseId, classId, confidenceScore, faceDescriptor } = req.body;
    
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
    }).lean();
    
    if (existingAttendance) {
      return res.status(400).json({ 
        error: 'Attendance already marked',
        alreadyMarked: true
      });
    }
    
    // Fetch user settings to get lateCutoffTime (cache this in session for performance)
    const userModel = req.session.userModel || 'Teacher';
    const userId = req.session.userId;
    
    let settings = req.session.cachedSettings;
    if (!settings) {
      settings = await Settings.findOne({ userId, userModel }).lean();
      if (!settings) {
        settings = await Settings.create({ userId, userModel });
      }
      req.session.cachedSettings = settings; // Cache in session
    }
    
    // Determine status based on user's configured time
    const now = new Date();
    const cutoffTime = new Date(now);
    const [cutoffHours, cutoffMinutes] = settings.lateCutoffTime.split(':');
    cutoffTime.setHours(parseInt(cutoffHours), parseInt(cutoffMinutes), 0, 0);
    const status = now > cutoffTime ? 'late' : 'present';
    
    // Get student info first (single query)
    const student = await Student.findById(studentId).select('fullName rollNo faceDescriptor').lean();
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
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
    
    // Update face descriptor asynchronously (don't block response)
    // Only update if we have a new descriptor and confidence is high enough
    if (faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length === 128 && confidenceScore >= 0.6) {
      const existingDescriptor = student.faceDescriptor;
      
      if (existingDescriptor && existingDescriptor.length === 128) {
        // Run async without blocking
        setImmediate(async () => {
          try {
            // Blend old and new descriptor using exponential moving average
            const alpha = 0.15;
            
            const updatedDescriptor = existingDescriptor.map((oldVal, i) => {
              return oldVal * (1 - alpha) + faceDescriptor[i] * alpha;
            });
            
            // Normalize the descriptor to unit length
            const magnitude = Math.sqrt(updatedDescriptor.reduce((sum, val) => sum + val * val, 0));
            const normalizedDescriptor = updatedDescriptor.map(val => val / magnitude);
            
            // Update student's face descriptor
            await Student.findByIdAndUpdate(studentId, {
              faceDescriptor: normalizedDescriptor,
              lastDescriptorUpdate: new Date(),
              $inc: { descriptorUpdateCount: 1 }
            });
          } catch (err) {
            console.error('Error updating face descriptor:', err);
          }
        });
      }
    }
    
    // Return immediately without waiting for descriptor update
    res.json({
      success: true,
      attendance: {
        ...attendance.toObject(),
        studentRef: studentId,
        student: { fullName: student.fullName, rollNo: student.rollNo }
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
    .limit(100)
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

// Get unmarked students for a class/course session
router.get('/api/unmarked-students/:classId/:courseId', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, courseId } = req.params;
    
    if (!classId || !courseId) {
      return res.status(400).json({ error: 'Class ID and Course ID are required' });
    }
    
    const sessionDate = new Date();
    sessionDate.setHours(0, 0, 0, 0);
    
    // Get all enrolled students in this class
    const allStudents = await Student.find({
      classRef: classId,
      isEnrolled: true
    }).select('_id fullName rollNo').lean();
    
    // Get students who have been marked today for this course
    const markedAttendance = await Attendance.find({
      courseRef: courseId,
      classRef: classId,
      sessionDate: sessionDate
    }).select('studentRef').lean();
    
    const markedStudentIds = new Set(markedAttendance.map(a => a.studentRef.toString()));
    
    // Filter out marked students to get unmarked ones
    const unmarkedStudents = allStudents.filter(student => 
      !markedStudentIds.has(student._id.toString())
    );
    
    res.json({ 
      unmarkedStudents,
      totalStudents: allStudents.length,
      markedCount: markedStudentIds.size
    });
  } catch (error) {
    console.error('Error fetching unmarked students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually mark attendance (for missed students)
router.post('/api/manual-mark-attendance', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { studentId, courseId, classId, status } = req.body;
    
    if (!studentId || !courseId || !classId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['present', 'late', 'absent'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be present, late, or absent' });
    }
    
    const sessionDate = new Date();
    sessionDate.setHours(0, 0, 0, 0);
    
    // Check if attendance already marked
    const existingAttendance = await Attendance.findOne({
      studentRef: studentId,
      courseRef: courseId,
      sessionDate: sessionDate
    }).lean();
    
    if (existingAttendance) {
      return res.status(400).json({ 
        error: 'Attendance already marked for this student',
        alreadyMarked: true
      });
    }
    
    // Create attendance record
    const attendance = await Attendance.create({
      studentRef: studentId,
      courseRef: courseId,
      classRef: classId,
      status: status,
      confidenceScore: status === 'absent' ? 0 : 1,
      markedBy: 'manual',
      sessionDate: sessionDate,
      timestamp: new Date()
    });
    
    // Get student info for response
    const student = await Student.findById(studentId).select('fullName rollNo').lean();
    
    res.json({
      success: true,
      attendance: {
        ...attendance.toObject(),
        student: { fullName: student.fullName, rollNo: student.rollNo }
      }
    });
  } catch (error) {
    console.error('Error manually marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk mark absent for all unmarked students (End Session)
router.post('/api/end-session', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, courseId, markAbsent = true } = req.body;
    
    if (!classId || !courseId) {
      return res.status(400).json({ error: 'Class ID and Course ID are required' });
    }
    
    const sessionDate = new Date();
    sessionDate.setHours(0, 0, 0, 0);
    
    // Get all enrolled students
    const allStudents = await Student.find({
      classRef: classId,
      isEnrolled: true
    }).select('_id fullName rollNo').lean();
    
    // Get already marked students
    const markedAttendance = await Attendance.find({
      courseRef: courseId,
      classRef: classId,
      sessionDate: sessionDate
    }).select('studentRef').lean();
    
    const markedStudentIds = new Set(markedAttendance.map(a => a.studentRef.toString()));
    
    // Get unmarked students
    const unmarkedStudents = allStudents.filter(student => 
      !markedStudentIds.has(student._id.toString())
    );
    
    let markedAbsentCount = 0;
    
    if (markAbsent && unmarkedStudents.length > 0) {
      // Bulk create absent records for unmarked students
      const absentRecords = unmarkedStudents.map(student => ({
        studentRef: student._id,
        courseRef: courseId,
        classRef: classId,
        status: 'absent',
        confidenceScore: 0,
        markedBy: 'system',
        sessionDate: sessionDate,
        timestamp: new Date()
      }));
      
      await Attendance.insertMany(absentRecords);
      markedAbsentCount = unmarkedStudents.length;
    }
    
    res.json({
      success: true,
      message: `Session ended. ${markedAbsentCount} students marked as absent.`,
      totalStudents: allStudents.length,
      presentCount: markedAttendance.filter(a => a.status !== 'absent').length,
      absentCount: markedAbsentCount,
      unmarkedStudents: unmarkedStudents
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel/Delete attendance record
router.delete('/api/cancel-attendance/:attendanceId', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { attendanceId } = req.params;

    // Find and delete the attendance record
    const deletedAttendance = await Attendance.findByIdAndDelete(attendanceId);

    if (!deletedAttendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.json({
      success: true,
      message: 'Attendance cancelled successfully',
      deletedAttendance
    });
  } catch (error) {
    console.error('Error canceling attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
