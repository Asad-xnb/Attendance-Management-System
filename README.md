# Attendance Management System (AMS-AI)

An intelligent attendance management system using facial recognition technology. Built with Node.js, Express, MongoDB, and face-api.js for real-time face detection and recognition.

## Features

### 🎯 Core Functionality
- **Real-time Face Recognition** - Automatic attendance marking using AI-powered facial recognition
- **Role-Based Access Control** - Separate interfaces for Admin, Teacher, and Student
- **IP Camera Support** - RTSP stream integration for remote camera access
- **Live Dashboard** - Real-time attendance statistics and analytics
- **Comprehensive Reports** - Detailed attendance reports with filtering options

### 👥 User Roles

#### Admin
- Manage teachers, students, classes, and courses
- View system-wide attendance statistics
- Access all reports and analytics
- Configure system settings
- Assign teachers to courses

#### Teacher
- Mark attendance using facial recognition
- View assigned classes and courses
- Access student attendance reports
- Configure personal camera settings
- Track course-specific statistics

#### Student
- View personal attendance records
- Check attendance percentage by course
- Access individual attendance history
- View course enrollment details

### 🔧 Technical Features
- **Multiple Detection Models** - Support for Tiny Face Detector and SSD MobileNet v1
- **Adjustable Recognition Settings** - Configurable matching threshold and input size
- **Per-User Settings** - Independent camera and recognition settings for each teacher/admin
- **Session Management** - Secure authentication with express-session
- **Optimized Performance** - Database indexes and query optimization for scalability
- **RTSP Streaming** - FFmpeg-powered real-time video streaming

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **face-api.js** - Face detection and recognition (server-side)
- **FFmpeg** - Video streaming and processing

### Frontend
- **EJS** - Templating engine
- **TailwindCSS** - UI styling
- **face-api.js** - Face detection and recognition (client-side)
- **Vanilla JavaScript** - Client-side interactions

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- FFmpeg (for IP camera support)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Asad-xnb/Attendance-Management-System.git
   cd Attendance-Management-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/ams-ai
   SESSION_SECRET=your-secret-key-here
   PORT=3000
   ```

4. **Install FFmpeg** (for IP camera support)
   - **Windows**: Download from [FFmpeg.org](https://ffmpeg.org/download.html) or use WinGet:
     ```bash
     winget install Gyan.FFmpeg
     ```
   - **Linux**:
     ```bash
     sudo apt install ffmpeg
     ```
   - **macOS**:
     ```bash
     brew install ffmpeg
     ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

7. **Create an admin account**
   - In the terminal Type:
     ```bash
     node My_scripts/createSuperAdmin.js
     ```
   - Go to `/login`
   - Login with the created admin account

## Project Structure

```
├── models/              # Mongoose schemas
│   ├── Admin.js
│   ├── Student.js
│   ├── Teacher.js
│   ├── Class.js
│   ├── Course.js
│   ├── Attendance.js
│   └── Settings.js
├── routes/              # Express route handlers
│   ├── base.routes.js
│   ├── admin.routes.js
│   ├── dashboard.routes.js
│   ├── reports.routes.js
│   ├── terminal.routes.js
│   ├── enrollment.routes.js
│   ├── settings.routes.js
│   └── camera.routes.js
├── views/               # EJS templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── reports.ejs
│   ├── terminal.ejs
│   ├── enrollment.ejs
│   └── settings.ejs
├── middleware/          # Custom middleware
│   └── auth.js
├── public/              # Static assets
│   └── scripts/         # Client-side face-api models
├── FACE_API_Models/     # Server-side face-api models
├── uploads/             # Student face images
├── app.js              # Application entry point
└── package.json
```

## Usage Guide

### First-Time Setup

1. **Create Admin Account**
   - Navigate to `/login`
   - Register as admin (first user becomes admin)

2. **Add Classes**
   - Login as admin
   - Go to "Manage" → "Classes"
   - Create classes with semester and section

3. **Add Courses**
   - Go to "Manage" → "Courses"
   - Assign courses to classes and teachers

4. **Enroll Students**
   - Go to "Enrollment" page
   - Fill student details and upload face images
   - System will extract face descriptors automatically

### Marking Attendance

1. **Configure Camera Settings**
   - Go to "Settings" page
   - Select camera type (Webcam/USB/IP Camera)
   - For IP Camera: Enter RTSP URL (e.g., `rtsp://192.168.0.103:554/stream`)
   - Adjust recognition settings (threshold, input size)

2. **Start Recognition**
   - Go to "Terminal" page
   - Select class and course
   - Click "Start Recognition"
   - Students will be automatically marked when detected

3. **View Reports**
   - Go to "Reports" page
   - Filter by date, class, course, or status
   - Export or analyze attendance data

## Configuration

### Recognition Settings

- **Matching Threshold** (0.5 - 0.95)
  - Lower = More lenient (may allow false positives)
  - Higher = Stricter (may reject valid faces)
  - Recommended: 0.70 - 0.80

- **Input Size** (224, 320, 416, 512)
  - Lower = Faster but less accurate
  - Higher = Slower but more accurate
  - Recommended: 416px

- **Detection Model**
  - Tiny Face Detector: Faster, good for real-time
  - SSD MobileNet v1: More accurate, slower

### Camera Types

- **Webcam**: Built-in or USB webcam
- **USB Camera**: External USB camera
- **IP Camera**: Network camera with RTSP support

### Time Settings

- **Work Start Time**: When attendance marking begins
- **Late Cutoff Time**: Time after which arrivals are marked "Late"
- **Work End Time**: When attendance marking ends
- **Timezone**: Local timezone for accurate time tracking

## Performance Optimization

The system includes several optimizations:

- **Database Indexes**: Optimized queries for fast data retrieval
- **Query Limits**: Prevents loading excessive records
- **Lean Queries**: Reduced memory usage for read operations
- **Reduced Detection Frequency**: 5 FPS (200ms intervals) for better CPU usage
- **Optimized Video Streaming**: Balanced quality and performance

## Troubleshooting

### Camera Not Working
- Check camera permissions in browser
- Verify RTSP URL format for IP cameras
- Test camera connection in Settings page
- Check FFmpeg installation for IP cameras

### Face Not Detected
- Ensure good lighting conditions
- Position face closer to camera
- Adjust input size in settings (try 512px)
- Lower matching threshold for more lenient detection

### Slow Performance
- Reduce input size to 320px or 224px
- Use Tiny Face Detector instead of SSD MobileNet
- Close other applications using camera
- Check system CPU usage

### Database Connection Issues
- Verify MongoDB is running
- Check MONGODB_URI in .env file
- Ensure MongoDB version compatibility

## Security

- Password hashing with bcrypt
- Session-based authentication
- Role-based access control
- CSRF protection (recommended to add)
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add YourFeature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - Face detection and recognition library
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
- [FFmpeg](https://ffmpeg.org/) - Video processing

## Support

For issues, questions, or contributions, please open an issue on GitHub or contact the repository owner.

---

**Built with ❤️ for educational institutions**
