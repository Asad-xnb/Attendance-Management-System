const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { Admin, Class, Course, Student } = require('../models');

// Management Page
router.get('/manage', isAuthenticated, hasRole('admin'), (req, res) => {
  res.render('admin/manage');
});

// Get all teachers
router.get('/api/teachers', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const teachers = await Admin.find({ role: 'teacher' }).select('-password');
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add teacher
router.post('/api/teachers', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const { username, fullName, email, password } = req.body;

    // Check if username or email exists
    const existing = await Admin.findOne({ 
      $or: [{ username }, { email: email.toLowerCase() }] 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create teacher
    const teacher = await Admin.create({
      username,
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'teacher',
      isActive: true
    });

    res.json({ success: true, teacher: { ...teacher.toObject(), password: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all classes
router.get('/api/classes', isAuthenticated, async (req, res) => {
  try {
    const classes = await Class.find().populate('students', 'fullName rollNo');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add class
router.post('/api/classes', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const { name, semester, section, academicYear, department } = req.body;

    // Check if class already exists
    const existing = await Class.findOne({ name, semester, section, academicYear });
    if (existing) {
      return res.status(400).json({ error: 'Class already exists' });
    }

    const newClass = await Class.create({
      name,
      semester: parseInt(semester),
      section,
      academicYear,
      department: department || 'Computer Science',
      isActive: true
    });

    res.json({ success: true, class: newClass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all courses
router.get('/api/courses', isAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('classRef', 'name semester section')
      .populate('instructorRef', 'fullName email');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add course
router.post('/api/courses', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { name, code, classRef, instructorRef } = req.body;

    // Check if course code exists
    const existing = await Course.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const course = await Course.create({
      name,
      code: code.toUpperCase(),
      classRef,
      instructorRef,
      totalSessions: 0
    });

    // Add course to class
    await Class.findByIdAndUpdate(classRef, {
      $push: { courses: course._id }
    });

    // Add course to teacher's classes array
    await Admin.findByIdAndUpdate(instructorRef, {
      $addToSet: { classes: classRef }
    });

    res.json({ success: true, course });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all students
router.get('/api/students', isAuthenticated, async (req, res) => {
  try {
    const students = await Student.find()
      .populate('classRef', 'name semester section')
      .select('-password -faceDescriptors');
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add student
router.post('/api/students', isAuthenticated, hasRole('admin', 'teacher'), async (req, res) => {
  try {
    const { username, fullName, rollNo, email, password, classRef } = req.body;

    // Check if username, rollNo, or email exists
    const existing = await Student.findOne({ 
      $or: [
        { username }, 
        { rollNo: rollNo.toUpperCase() },
        { email: email.toLowerCase() }
      ] 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Username, roll number, or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create student
    const student = await Student.create({
      username,
      fullName,
      rollNo: rollNo.toUpperCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      classRef,
      isEnrolled: false
    });

    // Add student to class
    await Class.findByIdAndUpdate(classRef, {
      $push: { students: student._id }
    });

    res.json({ success: true, student: { ...student.toObject(), password: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
