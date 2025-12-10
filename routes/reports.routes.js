const router = require('express').Router();
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { Attendance, Student, Class, Course } = require('../models');

// Admin reports - all attendance records
router.get('/api/reports/admin-data', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo, classId, courseId, status, search } = req.query;
    
    let query = {};
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.sessionDate = {};
      if (dateFrom) query.sessionDate.$gte = new Date(dateFrom);
      if (dateTo) query.sessionDate.$lte = new Date(dateTo);
    }
    
    // Class filter
    if (classId) {
      query.classRef = classId;
    }
    
    // Course filter
    if (courseId) {
      query.courseRef = courseId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    let attendanceRecords = await Attendance.find(query)
      .populate('studentRef', 'fullName rollNo')
      .populate('classRef', 'name')
      .populate('courseRef', 'name')
      .sort({ sessionDate: -1, timestamp: -1 })
      .limit(1000) // Limit for performance
      .lean();
    
    // Search filter (after population)
    if (search) {
      attendanceRecords = attendanceRecords.filter(record => 
        record.studentRef?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        record.studentRef?.rollNo?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Calculate summary stats
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const avgAttendance = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : 0;
    
    res.json({
      records: attendanceRecords,
      summary: {
        totalRecords,
        avgAttendance,
        lateCount,
        absentCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teacher reports - only their assigned courses
router.get('/api/reports/teacher-data', isAuthenticated, hasRole('teacher'), async (req, res) => {
  try {
    const teacherId = req.session.userId;
    const { dateFrom, dateTo, classId, courseId, status, search } = req.query;
    
    // Get teacher's courses
    const teacherCourses = await Course.find({ instructorRef: teacherId }).select('_id');
    const courseIds = teacherCourses.map(c => c._id);
    
    let query = { courseRef: { $in: courseIds } };
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.sessionDate = {};
      if (dateFrom) query.sessionDate.$gte = new Date(dateFrom);
      if (dateTo) query.sessionDate.$lte = new Date(dateTo);
    }
    
    // Class filter
    if (classId) {
      query.classRef = classId;
    }
    
    // Course filter
    if (courseId) {
      query.courseRef = courseId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    let attendanceRecords = await Attendance.find(query)
      .populate('studentRef', 'fullName rollNo')
      .populate('classRef', 'name')
      .populate('courseRef', 'name')
      .sort({ sessionDate: -1, timestamp: -1 })
      .lean();
    
    // Search filter
    if (search) {
      attendanceRecords = attendanceRecords.filter(record => 
        record.studentRef?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        record.studentRef?.rollNo?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Calculate summary stats
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const avgAttendance = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : 0;
    
    res.json({
      records: attendanceRecords,
      summary: {
        totalRecords,
        avgAttendance,
        lateCount,
        absentCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student reports - only their own attendance
router.get('/api/reports/student-data', isAuthenticated, hasRole('student'), async (req, res) => {
  try {
    const studentId = req.session.userId;
    const { dateFrom, dateTo, courseId, status } = req.query;
    
    let query = { studentRef: studentId };
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.sessionDate = {};
      if (dateFrom) query.sessionDate.$gte = new Date(dateFrom);
      if (dateTo) query.sessionDate.$lte = new Date(dateTo);
    }
    
    // Course filter
    if (courseId) {
      query.courseRef = courseId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    const attendanceRecords = await Attendance.find(query)
      .populate('classRef', 'name')
      .populate('courseRef', 'name')
      .sort({ sessionDate: -1, timestamp: -1 })
      .lean();
    
    // Calculate summary stats
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const avgAttendance = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : 0;
    
    res.json({
      records: attendanceRecords,
      summary: {
        totalRecords,
        avgAttendance,
        lateCount,
        absentCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get classes for filter dropdown (role-based)
router.get('/api/reports/classes', isAuthenticated, async (req, res) => {
  try {
    let classes;
    
    if (req.session.role === 'teacher') {
      // Get teacher's courses first
      const teacherId = req.session.userId;
      const teacherCourses = await Course.find({ instructorRef: teacherId }).populate('classRef').lean();
      
      // Extract unique classes
      const classIds = [...new Set(teacherCourses.map(c => c.classRef?._id?.toString()).filter(Boolean))];
      classes = await Class.find({ _id: { $in: classIds } }).select('name semester section').sort({ name: 1, semester: 1, section: 1 });
    } else {
      // Admin gets all classes
      classes = await Class.find().select('name semester section').sort({ name: 1, semester: 1, section: 1 });
    }
    
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get courses for filter dropdown (role-based, filtered by class)
router.get('/api/reports/courses', isAuthenticated, async (req, res) => {
  try {
    const { classId } = req.query;
    let query = {};
    
    if (req.session.role === 'teacher') {
      query.instructorRef = req.session.userId;
    } else if (req.session.role === 'student') {
      // Get student's class
      const student = await Student.findById(req.session.userId).select('classRef');
      if (student && student.classRef) {
        query.classRef = student.classRef;
      }
    }
    
    if (classId) {
      query.classRef = classId;
    }
    
    const courses = await Course.find(query).select('name code').sort({ name: 1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Hierarchy View - Classes > Courses > Sessions
router.get('/api/reports/admin-hierarchy', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    // Get all classes with students count
    const classes = await Class.find().lean();
    
    const result = [];
    
    for (const cls of classes) {
      const studentCount = await Student.countDocuments({ classRef: cls._id, isEnrolled: true });
      const courses = await Course.find({ classRef: cls._id }).populate('instructorRef', 'fullName').lean();
      
      const coursesData = [];
      
      for (const course of courses) {
        // Get attendance records for this course
        const attendance = await Attendance.find({ courseRef: course._id }).lean();
        
        // Group by session date
        const sessionMap = new Map();
        attendance.forEach(record => {
          const dateKey = new Date(record.sessionDate).toISOString().split('T')[0];
          if (!sessionMap.has(dateKey)) {
            sessionMap.set(dateKey, { present: 0, late: 0, absent: 0, total: 0 });
          }
          const session = sessionMap.get(dateKey);
          session.total++;
          if (record.status === 'present') session.present++;
          else if (record.status === 'late') session.late++;
          else session.absent++;
        });
        
        const sessions = Array.from(sessionMap.entries()).map(([date, stats]) => ({
          date,
          presentCount: stats.present + stats.late,
          totalCount: stats.total,
          attendanceRate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalRecords = attendance.length;
        const presentCount = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
        
        coursesData.push({
          _id: course._id,
          name: course.name,
          code: course.code,
          instructor: course.instructorRef?.fullName || 'Unassigned',
          sessionCount: sessions.length,
          totalRecords,
          presentCount,
          attendanceRate: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
          sessions
        });
      }
      
      result.push({
        _id: cls._id,
        name: cls.name,
        semester: cls.semester,
        section: cls.section,
        studentCount,
        courses: coursesData
      });
    }
    
    res.json({ classes: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teacher Hierarchy View - Classes > Courses > Sessions (only their courses)
router.get('/api/reports/teacher-hierarchy', isAuthenticated, hasRole('teacher'), async (req, res) => {
  try {
    const teacherId = req.session.userId;
    
    // Get teacher's courses
    const courses = await Course.find({ instructorRef: teacherId }).populate('classRef').lean();
    
    // Group by class
    const classMap = new Map();
    
    for (const course of courses) {
      if (!course.classRef) continue;
      
      const classId = course.classRef._id.toString();
      if (!classMap.has(classId)) {
        const studentCount = await Student.countDocuments({ classRef: course.classRef._id, isEnrolled: true });
        classMap.set(classId, {
          _id: course.classRef._id,
          name: course.classRef.name,
          semester: course.classRef.semester,
          section: course.classRef.section,
          studentCount,
          courses: []
        });
      }
      
      // Get attendance for this course
      const attendance = await Attendance.find({ courseRef: course._id }).lean();
      
      // Group by session date
      const sessionMap = new Map();
      attendance.forEach(record => {
        const dateKey = new Date(record.sessionDate).toISOString().split('T')[0];
        if (!sessionMap.has(dateKey)) {
          sessionMap.set(dateKey, { present: 0, late: 0, absent: 0, total: 0 });
        }
        const session = sessionMap.get(dateKey);
        session.total++;
        if (record.status === 'present') session.present++;
        else if (record.status === 'late') session.late++;
        else session.absent++;
      });
      
      const sessions = Array.from(sessionMap.entries()).map(([date, stats]) => ({
        date,
        presentCount: stats.present + stats.late,
        totalCount: stats.total,
        attendanceRate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
      })).sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const totalRecords = attendance.length;
      const presentCount = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
      
      classMap.get(classId).courses.push({
        _id: course._id,
        name: course.name,
        code: course.code,
        sessionCount: sessions.length,
        totalRecords,
        presentCount,
        attendanceRate: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
        sessions
      });
    }
    
    res.json({ classes: Array.from(classMap.values()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get course session details (for modal)
router.get('/api/reports/course-sessions/:courseId', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const records = await Attendance.find({ courseRef: courseId })
      .populate('studentRef', 'fullName rollNo')
      .sort({ sessionDate: -1, timestamp: -1 })
      .lean();
    
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student subjects overview
router.get('/api/reports/student-subjects', isAuthenticated, hasRole('student'), async (req, res) => {
  try {
    const studentId = req.session.userId;
    
    // Get student's class
    const student = await Student.findById(studentId).select('classRef').lean();
    if (!student || !student.classRef) {
      return res.json({ subjects: [], overallAttendance: 0, totalSessions: 0 });
    }
    
    // Get courses for student's class
    const courses = await Course.find({ classRef: student.classRef }).lean();
    
    const subjects = [];
    let totalPresent = 0;
    let totalSessions = 0;
    
    for (const course of courses) {
      const attendance = await Attendance.find({ 
        studentRef: studentId, 
        courseRef: course._id 
      }).lean();
      
      const presentCount = attendance.filter(r => r.status === 'present').length;
      const lateCount = attendance.filter(r => r.status === 'late').length;
      const sessionCount = attendance.length;
      
      totalPresent += presentCount + lateCount;
      totalSessions += sessionCount;
      
      subjects.push({
        courseId: course._id,
        name: course.name,
        code: course.code,
        totalSessions: sessionCount,
        presentCount,
        lateCount,
        attendanceRate: sessionCount > 0 ? Math.round(((presentCount + lateCount) / sessionCount) * 100) : 0
      });
    }
    
    res.json({
      subjects,
      overallAttendance: totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0,
      totalSessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student course sessions (for modal)
router.get('/api/reports/student-course-sessions/:courseId', isAuthenticated, hasRole('student'), async (req, res) => {
  try {
    const studentId = req.session.userId;
    const { courseId } = req.params;
    
    const attendance = await Attendance.find({ 
      studentRef: studentId, 
      courseRef: courseId 
    }).sort({ sessionDate: -1 }).lean();
    
    const sessions = attendance.map(record => ({
      date: record.sessionDate,
      timestamp: record.timestamp,
      status: record.status
    }));
    
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
