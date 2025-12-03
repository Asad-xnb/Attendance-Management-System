const router = require('express').Router();
const { Admin, Student, Class, Course, Attendance } = require('../models');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Get Admin Dashboard Stats
router.get('/api/dashboard/admin-stats', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total enrolled students
    const totalStudents = await Student.countDocuments({ isEnrolled: true });

    // Today's attendance stats
    const todayAttendance = await Attendance.find({ sessionDate: today }).lean();
    
    const presentCount = todayAttendance.filter(a => a.status === 'present').length;
    const lateCount = todayAttendance.filter(a => a.status === 'late').length;
    const absentCount = totalStudents - presentCount;

    // Recent student activity (last 10)
    const recentActivity = await Attendance.find({ sessionDate: today })
      .populate('studentRef', 'fullName rollNo')
      .populate('courseRef', 'name code')
      .populate('classRef', 'name section')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const formattedActivity = recentActivity
      .filter(record => record.studentRef && record.courseRef)
      .map(record => ({
        studentName: record.studentRef.fullName,
        rollNo: record.studentRef.rollNo,
        courseName: record.courseRef.name,
        courseCode: record.courseRef.code,
        className: record.classRef ? `${record.classRef.name} ${record.classRef.section}` : 'N/A',
        status: record.status,
        timestamp: record.timestamp
      }));

    // Class breakdown (attendance by class)
    const classes = await Class.find().lean();
    const classBreakdown = await Promise.all(classes.map(async (cls) => {
      const classStudents = await Student.countDocuments({ classRef: cls._id, isEnrolled: true });
      const classAttendance = await Attendance.countDocuments({ 
        classRef: cls._id, 
        sessionDate: today,
        status: 'present'
      });
      
      return {
        className: `${cls.name} ${cls.semester} - ${cls.section}`,
        totalStudents: classStudents,
        presentToday: classAttendance,
        attendanceRate: classStudents > 0 ? Math.round((classAttendance / classStudents) * 100) : 0
      };
    }));

    // Weekly attendance (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayAttendance = await Attendance.find({ sessionDate: date }).lean();
      const present = dayAttendance.filter(a => a.status === 'present').length;
      const late = dayAttendance.filter(a => a.status === 'late').length;
      const absent = totalStudents - present;
      
      weeklyData.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        present,
        late,
        absent
      });
    }

    res.json({
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      recentActivity: formattedActivity,
      classBreakdown,
      weeklyData
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Teacher Dashboard Stats
router.get('/api/dashboard/teacher-stats', isAuthenticated, hasRole('teacher'), async (req, res) => {
  try {
    const teacherId = req.session.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get teacher's courses
    const teacherCourses = await Course.find({ instructorRef: teacherId }).select('_id classRef').lean();
    const courseIds = teacherCourses.map(c => c._id);
    const classIds = [...new Set(teacherCourses.map(c => c.classRef.toString()))];

    // Total enrolled students in teacher's classes
    const totalStudents = await Student.countDocuments({ 
      classRef: { $in: classIds },
      isEnrolled: true 
    });

    // Today's attendance stats for teacher's courses
    const todayAttendance = await Attendance.find({ 
      courseRef: { $in: courseIds },
      sessionDate: today 
    }).lean();
    
    const presentCount = todayAttendance.filter(a => a.status === 'present').length;
    const lateCount = todayAttendance.filter(a => a.status === 'late').length;
    const absentCount = totalStudents - presentCount;

    // Recent student activity in teacher's courses
    const recentActivity = await Attendance.find({ 
      courseRef: { $in: courseIds },
      sessionDate: today 
    })
      .populate('studentRef', 'fullName rollNo')
      .populate('courseRef', 'name code')
      .populate('classRef', 'name section')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const formattedActivity = recentActivity
      .filter(record => record.studentRef && record.courseRef)
      .map(record => ({
        studentName: record.studentRef.fullName,
        rollNo: record.studentRef.rollNo,
        courseName: record.courseRef.name,
        courseCode: record.courseRef.code,
        className: record.classRef ? `${record.classRef.name} ${record.classRef.section}` : 'N/A',
        status: record.status,
        timestamp: record.timestamp
      }));

    // Class breakdown for teacher's classes
    const classes = await Class.find({ _id: { $in: classIds } }).lean();
    const classBreakdown = await Promise.all(classes.map(async (cls) => {
      const classStudents = await Student.countDocuments({ classRef: cls._id, isEnrolled: true });
      const classAttendance = await Attendance.countDocuments({ 
        classRef: cls._id,
        courseRef: { $in: courseIds },
        sessionDate: today,
        status: 'present'
      });
      
      return {
        className: `${cls.name} ${cls.semester} - ${cls.section}`,
        totalStudents: classStudents,
        presentToday: classAttendance,
        attendanceRate: classStudents > 0 ? Math.round((classAttendance / classStudents) * 100) : 0
      };
    }));

    // Weekly attendance for teacher's courses
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayAttendance = await Attendance.find({ 
        courseRef: { $in: courseIds },
        sessionDate: date 
      }).lean();
      
      const present = dayAttendance.filter(a => a.status === 'present').length;
      const late = dayAttendance.filter(a => a.status === 'late').length;
      const absent = totalStudents - present;
      
      weeklyData.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        present,
        late,
        absent
      });
    }

    res.json({
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      recentActivity: formattedActivity,
      classBreakdown,
      weeklyData
    });
  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Student Dashboard Stats
router.get('/api/dashboard/student-stats', isAuthenticated, hasRole('student'), async (req, res) => {
  try {
    const studentId = req.session.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get student info
    const student = await Student.findById(studentId).populate('classRef').lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student's courses based on their class
    const courses = await Course.find({ classRef: student.classRef._id }).lean();
    const courseIds = courses.map(c => c._id);
    const totalCourses = courses.length;

    // Personal attendance stats (all time)
    const allAttendance = await Attendance.find({ studentRef: studentId }).lean();
    const presentCount = allAttendance.filter(a => a.status === 'present').length;
    const lateCount = allAttendance.filter(a => a.status === 'late').length;
    const absentCount = allAttendance.filter(a => a.status === 'absent').length + lateCount;
    const totalSessions = allAttendance.length;
    
    // Calculate attendance rate (only present counts as attended)
    const attendanceRate = totalSessions > 0 
      ? Math.round((presentCount / totalSessions) * 100) 
      : 0;

    // Recent personal activity
    const recentActivity = await Attendance.find({ studentRef: studentId })
      .populate('courseRef', 'name code')
      .populate('classRef', 'name section')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const formattedActivity = recentActivity
      .filter(record => record.courseRef)
      .map(record => ({
        courseName: record.courseRef.name,
        courseCode: record.courseRef.code,
        className: record.classRef ? `${record.classRef.name} ${record.classRef.section}` : 'N/A',
        status: record.status,
        timestamp: record.timestamp,
        sessionDate: record.sessionDate
      }));

    // Course-wise attendance breakdown
    const courseBreakdown = await Promise.all(courses.map(async (course) => {
      const courseAttendance = await Attendance.find({ 
        studentRef: studentId,
        courseRef: course._id 
      }).lean();
      
      const present = courseAttendance.filter(a => a.status === 'present').length;
      const late = courseAttendance.filter(a => a.status === 'late').length;
      const absent = courseAttendance.filter(a => a.status === 'absent').length + late;
      const total = courseAttendance.length;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      return {
        courseName: course.name,
        courseCode: course.code,
        present,
        late,
        absent,
        total,
        attendanceRate
      };
    }));

    // Weekly personal attendance (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayAttendance = await Attendance.find({ 
        studentRef: studentId,
        sessionDate: date 
      }).lean();
      
      const present = dayAttendance.filter(a => a.status === 'present').length;
      const late = dayAttendance.filter(a => a.status === 'late').length;
      const absent = dayAttendance.filter(a => a.status === 'absent').length;
      
      weeklyData.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        present,
        late,
        absent
      });
    }

    res.json({
      studentInfo: {
        name: student.fullName,
        rollNo: student.rollNo,
        className: `${student.classRef.name} ${student.classRef.semester} - ${student.classRef.section}`
      },
      presentCount,
      lateCount,
      absentCount,
      totalSessions,
      totalCourses,
      attendanceRate,
      recentActivity: formattedActivity,
      courseBreakdown,
      weeklyData
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
