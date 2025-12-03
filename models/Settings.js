const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // User Reference - Each admin/teacher has their own settings
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Teacher']
  },

  // Camera Settings
  cameraType: {
    type: String,
    enum: ['webcam', 'usb', 'ip'],
    default: 'webcam'
  },
  ipCameraUrl: {
    type: String,
    default: ''
  },
  
  // Time Settings
  workStartTime: {
    type: String,
    default: '09:00'
  },
  lateCutoffTime: {
    type: String,
    default: '09:15'
  },
  workEndTime: {
    type: String,
    default: '17:00'
  },
  timezone: {
    type: String,
    default: 'UTC-5'
  },
  
  // AI Recognition Settings
  matchingThreshold: {
    type: Number,
    default: 0.75,
    min: 0.5,
    max: 0.95
  },
  detectionModel: {
    type: String,
    enum: ['tiny_face_detector', 'ssd_mobilenetv1'],
    default: 'tiny_face_detector'
  },
  inputSize: {
    type: Number,
    enum: [128, 160, 224, 320, 416, 512, 608],
    default: 416
  }
}, { timestamps: true });

// Ensure one settings document per user
settingsSchema.index({ userId: 1, userModel: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
