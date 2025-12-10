# IP Camera (RTSP) Integration Guide

## Overview
The system now supports IP cameras via RTSP URLs. You can configure your IP camera in the Settings page and it will be used instead of the built-in webcam for both enrollment and live terminal.

## Configuration

### 1. Set Up Your IP Camera
Navigate to `/settings` and configure:
- **Active Camera**: Select "IP Camera (RTSP)"
- **IP Camera URL**: Enter your RTSP URL (e.g., `rtsp://192.168.0.103:554/11`)
- **Resolution**: Choose your preferred resolution
- Click **Save Changes**

### 2. RTSP Streaming to Browser

**Important**: Browsers cannot directly play RTSP streams. To use IP cameras, you need a media server that converts RTSP to a browser-compatible format.

## Production Setup Options

### Option 1: FFmpeg + Node.js Stream (Recommended)

Install FFmpeg and use it to convert RTSP to MJPEG or HLS:

```bash
npm install fluent-ffmpeg node-rtsp-stream
```

Create a streaming endpoint in `routes/camera.routes.js`:

```javascript
const Stream = require('node-rtsp-stream');

router.get('/api/camera/live-stream', async (req, res) => {
  const settings = await Settings.findOne({ singleton: true });
  
  if (settings.cameraType === 'ip' && settings.ipCameraUrl) {
    const stream = new Stream({
      name: 'ip-camera',
      streamUrl: settings.ipCameraUrl,
      wsPort: 9999,
      ffmpegOptions: {
        '-stats': '',
        '-r': 30
      }
    });
    
    // Stream to WebSocket
  }
});
```

### Option 2: RTSP to WebRTC (Best Quality)

Use a service like **Janus WebRTC Gateway** or **mediasoup**:

1. Install Janus: https://janus.conf.meetecho.com/
2. Configure RTSP input
3. Stream via WebRTC to browser

### Option 3: HLS Streaming

Convert RTSP to HLS using FFmpeg:

```bash
ffmpeg -i rtsp://192.168.0.103:554/11 \
  -c:v copy -c:a copy \
  -f hls -hls_time 2 -hls_list_size 3 \
  -hls_flags delete_segments \
  public/stream/output.m3u8
```

Then use HLS.js in the browser to play the stream.

### Option 4: Use a Pre-built Service

- **Wowza Streaming Engine**
- **Red5 Pro**
- **AWS Kinesis Video Streams**
- **Azure Media Services**

## Current Implementation

The system currently:
1. ✅ Stores IP camera URL in database
2. ✅ Checks camera settings before initializing video
3. ⚠️ Falls back to webcam if IP camera is selected (requires media server setup)
4. ℹ️ Shows alert with RTSP URL when IP camera is configured

## Next Steps for Full RTSP Support

To enable direct IP camera streaming:

1. Choose one of the production setup options above
2. Install required dependencies
3. Update `routes/camera.routes.js` to stream RTSP
4. Update `views/enrollment.ejs` and `views/terminal.ejs` to consume the stream
5. Remove the fallback to webcam

## Testing Your IP Camera

### Verify RTSP URL
Test your RTSP stream using VLC Media Player:
1. Open VLC
2. Media → Open Network Stream
3. Enter your RTSP URL: `rtsp://192.168.0.103:554/11`
4. Click Play

If it works in VLC, your RTSP URL is correct.

## Security Considerations

- Use RTSPS (RTSP over TLS) for encrypted streams
- Implement authentication for RTSP URLs
- Store RTSP credentials securely (not in frontend)
- Use firewall rules to restrict camera access
- Consider VPN for remote camera access

## Troubleshooting

### Camera not connecting
- Verify RTSP URL is correct
- Check network connectivity to camera
- Ensure camera supports RTSP
- Check camera authentication settings

### Stream lag or buffering
- Reduce resolution in settings
- Check network bandwidth
- Adjust FFmpeg encoding settings
- Use local streaming server

### Face recognition not working
- Ensure stream resolution is adequate (720p minimum recommended)
- Check lighting conditions
- Verify face-api models are loaded
- Test with built-in webcam first

## Resources

- FFmpeg Documentation: https://ffmpeg.org/documentation.html
- node-rtsp-stream: https://github.com/kyriesent/node-rtsp-stream
- Janus WebRTC: https://janus.conf.meetecho.com/
- HLS.js: https://github.com/video-dev/hls.js/
