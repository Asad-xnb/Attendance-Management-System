const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const canvas = require('canvas');
const faceapi = require('face-api.js');
const { Student, Class } = require('../models');

// Configure canvas for face-api
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Load face-api models
let modelsLoaded = false;
async function loadModels() {
  if (modelsLoaded) return;
  
  const modelPath = path.join(__dirname, '../FACE_API_Models');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  modelsLoaded = true;
  console.log('Face-api models loaded successfully');
}

// Initialize models on server start
loadModels().catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png) are allowed'));
    }
  }
});

// Extract face descriptors from uploaded images
async function extractFaceDescriptors(imagePaths) {
  const descriptors = [];
  
  for (const imagePath of imagePaths) {
    try {
      // Load image
      const img = await canvas.loadImage(imagePath);
      
      // Detect face and extract descriptor
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
      } else {
        console.warn(`No face detected in image: ${imagePath}`);
      }
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
    }
  }
  
  return descriptors;
}

// Enrollment endpoint
router.post('/enroll', upload.array('images', 5), async (req, res) => {
  try {
    const { username, fullName, rollNo, email, password, classRef } = req.body;
    
    // Validate required fields
    if (!username || !fullName || !rollNo || !email || !password || !classRef) {
      // Clean up uploaded files
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }
    
    // Check if student already exists
    const existing = await Student.findOne({ 
      $or: [
        { username }, 
        { rollNo: rollNo.toUpperCase() },
        { email: email.toLowerCase() }
      ] 
    });
    
    if (existing) {
      // Clean up uploaded files
      for (const file of req.files) {
        await fs.unlink(file.path).catch(console.error);
      }
      return res.status(400).json({ error: 'Username, roll number, or email already exists' });
    }
    
    // Extract face descriptors
    const imagePaths = req.files.map(file => file.path);
    const faceDescriptors = await extractFaceDescriptors(imagePaths);
    
    // Clean up uploaded files after processing
    for (const file of req.files) {
      await fs.unlink(file.path).catch(console.error);
    }
    
    // Validate face descriptors
    if (faceDescriptors.length === 0) {
      return res.status(400).json({ error: 'No faces detected in uploaded images. Please provide clear face images.' });
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
      faceDescriptors,
      isEnrolled: true
    });
    
    // Add student to class
    await Class.findByIdAndUpdate(classRef, {
      $push: { students: student._id }
    });
    
    res.json({ 
      success: true, 
      message: 'Student enrolled successfully',
      descriptorCount: faceDescriptors.length
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(console.error);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
