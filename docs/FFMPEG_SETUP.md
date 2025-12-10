# FFmpeg Installation Guide for Windows

## Quick Install (Recommended)

### Option 1: Using Chocolatey (Easiest)
If you have Chocolatey installed:
```powershell
choco install ffmpeg
```

### Option 2: Manual Installation

1. **Download FFmpeg**
   - Visit: https://www.gyan.dev/ffmpeg/builds/
   - Download: `ffmpeg-release-essentials.zip`

2. **Extract Files**
   - Extract to: `C:\ffmpeg`
   - Your structure should be: `C:\ffmpeg\bin\ffmpeg.exe`

3. **Add to PATH**
   ```powershell
   # Open PowerShell as Administrator
   $env:Path += ";C:\ffmpeg\bin"
   [Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)
   ```

4. **Verify Installation**
   ```powershell
   # Close and reopen PowerShell
   ffmpeg -version
   ```

## After Installing FFmpeg

Restart your application:
```powershell
npm start
```

Then test IP camera in Settings:
1. Go to `/settings`
2. Select "IP Camera (RTSP)"
3. Enter your RTSP URL: `rtsp://192.168.0.103:554/11`
4. Save Changes
5. Go to Terminal or Enrollment
6. Start Camera

The system will automatically:
- Convert RTSP stream to MPEG1
- Stream via WebSocket on port 9999
- Display in browser using JSMpeg

## Troubleshooting

### "ffmpeg not found" error
- Restart your terminal/PowerShell after installation
- Verify PATH: `echo $env:Path`
- Try full path in code if needed

### Stream not connecting
- Check camera URL is correct
- Verify network connectivity to camera
- Check firewall allows port 9999
- Try camera URL in VLC first

### High CPU usage
- Lower resolution in Settings
- Reduce frame rate (edit camera.routes.js, change `-r 30` to `-r 15`)

## Alternative: Use Pre-built FFmpeg Binary

The app can also use a bundled FFmpeg binary. Place `ffmpeg.exe` in:
```
project_root/bin/ffmpeg.exe
```

Then update `routes/camera.routes.js`:
```javascript
const ffmpegPath = path.join(__dirname, '../bin/ffmpeg.exe');
// Set in node-rtsp-stream options
```
