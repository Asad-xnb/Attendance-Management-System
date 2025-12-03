const router = require('express').Router();
const Settings = require('../models/Settings');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let ffmpegProcess = null;
let streamClients = [];

// Find FFmpeg path
function getFFmpegPath() {
  let ffmpegPath = 'ffmpeg';
  
  if (os.platform() === 'win32') {
    const username = os.userInfo().username;
    const wingetPath = `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WinGet\\Packages`;
    
    try {
      if (fs.existsSync(wingetPath)) {
        const items = fs.readdirSync(wingetPath);
        const ffmpegDir = items.find(item => item.startsWith('Gyan.FFmpeg'));
        
        if (ffmpegDir) {
          const possiblePath = path.join(wingetPath, ffmpegDir, 'ffmpeg-8.0.1-full_build', 'bin', 'ffmpeg.exe');
          if (fs.existsSync(possiblePath)) {
            ffmpegPath = possiblePath;
          }
        }
      }
    } catch (e) {
      // Use default
    }
  }
  
  return ffmpegPath;
}

// Get camera stream URL for current user
router.get('/api/camera/stream-url', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.role) {
      return res.json({ cameraType: 'webcam', streamUrl: null });
    }

    const userModel = req.session.role === 'admin' ? 'Admin' : 'Teacher';
    let settings = await Settings.findOne({ 
      userId: req.session.userId,
      userModel: userModel
    });
    
    // Create default settings if none exist
    if (!settings) {
      settings = await Settings.create({
        userId: req.session.userId,
        userModel: userModel
      });
    }
    
    res.json({
      cameraType: settings.cameraType || 'webcam',
      streamUrl: settings.cameraType === 'ip' ? '/api/camera/stream' : null,
      rtspUrl: settings.ipCameraUrl || null
    });
  } catch (error) {
    console.error('Error fetching camera settings:', error);
    res.status(500).json({ error: 'Failed to fetch camera settings' });
  }
});

// Stream RTSP as MJPEG for current user
router.get('/api/camera/stream', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).send('Not authenticated');
    }

    const userModel = req.session.role === 'admin' ? 'Admin' : 'Teacher';
    const settings = await Settings.findOne({ 
      userId: req.session.userId,
      userModel: userModel
    });
    
    if (!settings || !settings.ipCameraUrl) {
      return res.status(400).send('IP camera not configured');
    }
    
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--boundary',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive'
    });
    
    const ffmpegPath = getFFmpegPath();
    
    // Convert RTSP to MJPEG stream
    const ffmpeg = spawn(ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-i', settings.ipCameraUrl,
      '-f', 'mjpeg',
      '-q:v', '5',
      '-r', '15',
      '-s', '1280x720',
      '-'
    ]);
    
    let buffer = Buffer.alloc(0);
    
    ffmpeg.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      // Find JPEG markers (FFD8 = start, FFD9 = end)
      let start = 0;
      while (start < buffer.length - 1) {
        const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), start);
        if (jpegStart === -1) break;
        
        const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
        if (jpegEnd === -1) break;
        
        // Extract complete JPEG frame
        const frame = buffer.slice(jpegStart, jpegEnd + 2);
        
        // Write as multipart frame
        res.write('--boundary\r\n');
        res.write('Content-Type: image/jpeg\r\n');
        res.write(`Content-Length: ${frame.length}\r\n\r\n`);
        res.write(frame);
        res.write('\r\n');
        
        start = jpegEnd + 2;
      }
      
      // Keep remaining incomplete data
      buffer = buffer.slice(start);
    });
    
    ffmpeg.stderr.on('data', () => {
      // Suppress FFmpeg logs
    });
    
    ffmpeg.on('error', (err) => {
      console.error('FFmpeg error:', err);
    });
    
    req.on('close', () => {
      ffmpeg.kill();
    });
    
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).send('Stream error');
  }
});

// Start RTSP stream (legacy endpoint for compatibility)
router.post('/api/camera/start-stream', async (req, res) => {
  res.json({ success: true });
});

// Stop RTSP stream (legacy endpoint for compatibility)
router.post('/api/camera/stop-stream', async (req, res) => {
  res.json({ success: true });
});

// Test camera connection
router.post('/api/camera/test', async (req, res) => {
  try {
    const { cameraType, ipCameraUrl } = req.body;
    
    if (cameraType === 'webcam' || cameraType === 'usb') {
      return res.json({ 
        success: true, 
        message: 'Webcam/USB camera will be tested when you start recognition' 
      });
    }
    
    if (cameraType === 'ip') {
      if (!ipCameraUrl) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please enter an IP camera URL' 
        });
      }
      
      // Test RTSP connection with ffmpeg
      const ffmpegPath = getFFmpegPath();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (testProcess) {
            testProcess.kill();
          }
          resolve(res.json({ 
            success: false, 
            message: 'Connection timeout - camera not responding' 
          }));
        }, 10000); // 10 second timeout
        
        const testProcess = spawn(ffmpegPath, [
          '-rtsp_transport', 'tcp',
          '-i', ipCameraUrl,
          '-frames:v', '1',
          '-f', 'null',
          '-'
        ]);
        
        let errorOutput = '';
        
        testProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        testProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          if (code === 0 || errorOutput.includes('Stream #0:0') || errorOutput.includes('Input #0')) {
            resolve(res.json({ 
              success: true, 
              message: 'Camera connection successful!' 
            }));
          } else if (errorOutput.includes('Connection refused') || errorOutput.includes('Connection timed out')) {
            resolve(res.json({ 
              success: false, 
              message: 'Connection failed - check IP address and port' 
            }));
          } else if (errorOutput.includes('401 Unauthorized') || errorOutput.includes('403 Forbidden')) {
            resolve(res.json({ 
              success: false, 
              message: 'Authentication failed - check username and password' 
            }));
          } else if (errorOutput.includes('404 Not Found')) {
            resolve(res.json({ 
              success: false, 
              message: 'Stream path not found - check RTSP URL path' 
            }));
          } else {
            resolve(res.json({ 
              success: false, 
              message: 'Connection failed - invalid URL or camera offline' 
            }));
          }
        });
        
        testProcess.on('error', (err) => {
          clearTimeout(timeout);
          resolve(res.json({ 
            success: false, 
            message: `Error: ${err.message}` 
          }));
        });
      });
    }
    
    res.json({ success: false, message: 'Unknown camera type' });
  } catch (error) {
    console.error('Test camera error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during camera test' 
    });
  }
});

module.exports = router;
