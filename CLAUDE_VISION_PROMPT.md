You are tasked with building a Python computer-vision backend for an existing web-based study companion app called AIRI. The app already has a React frontend (Vite, Tailwind, TypeScript) and an Express.js backend (port 3000). You need to create a Python FastAPI service that provides real-time webcam analysis and returns structured detection results.

## WHY THIS IS NEEDED
The existing app has a "Surveillance" panel that monitors the user via webcam and alerts them (with Telugu/English voice) when they get distracted. Previous attempts failed because:
- tinyllama (Ollama) is text-only, can't process images
- TensorFlow.js + COCO-SSD in the browser fails due to network/CDN issues
- Pixel brightness heuristics are too crude

A Python backend with OpenCV + MediaPipe + YOLO is the most reliable approach.

## PROJECT ARCHITECTURE
```
Frontend (Vite React, port 5173)
  → Express API server (port 3000) - proxies vision requests
    → Python vision server (port 3001)  ← YOU BUILD THIS
```

The Express server already has an endpoint at `POST /api/vision/analyze` that should forward to your Python service. The frontend sends a base64 webcam frame to Express, Express calls Python, Python returns detections, Express returns them to the frontend.

## WHAT TO BUILD

### Files to create in `server/vision/` directory:

1. **`server/vision/requirements.txt`**
```
fastapi==0.115.0
uvicorn==0.30.0
opencv-python-headless==4.10.0
Pillow==10.4.0
numpy==1.26.0
mediapipe==0.10.18
ultralytics==8.2.0
python-multipart==0.0.9
pydantic==2.9.0
```

2. **`server/vision/main.py`** — The FastAPI server. Key requirements:

   **Endpoint: POST /analyze**
   - Accepts: `{ "image_base64": "<base64-jpeg-data-uri>" }`
   - Returns: 
   ```json
   {
     "detection": "focused|phone|sleepy|absent|someone_else",
     "comment": "1-sentence girlfriend-style alert (Telugu if requested)",
     "debug": {
       "persons": 0,
       "phones": 0,
       "faces": 0,
       "avg_brightness": 85.3,
       "eyes_closed": false,
       "face_visible": false,
       "inference_ms": 145
     }
   }
   ```

   **Detection pipeline (run every request, in order):**

   a) **Brightness check** — decode base64 → PIL Image → grayscale → mean pixel value. If < 20: detection = "absent" with comment about darkness. Skip further processing, return immediately.

   b) **YOLOv8 object detection** — Use `ultralytics.YOLO("yolov8n.pt")`. Run on the image. Extract:
      - Count of `person` class (confidence > 0.4)
      - Count of `cell phone` class (confidence > 0.3)
      - If ≥2 persons: detection = "someone_else"
      - If ≥1 cell phone: detection = "phone"
      - If 0 persons and brightness > 30: detection = "absent"

   c) **MediaPipe Face Mesh** — Use `mediapipe.solutions.face_mesh`. Run on the image.
      - Count faces detected
      - If 0 faces and YOLO also saw 0 persons: detection = "absent"
      - If 0 faces but YOLO saw 1+ persons: still check other signals, don't immediately decide
      - For each face, compute Eye Aspect Ratio (EAR):
        - Left eye landmarks: [33, 160, 158, 133, 153, 144]
        - Right eye landmarks: [362, 385, 387, 263, 373, 380]
        - EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        - If EAR < 0.2 for both eyes: eyes_closed = true
      - If eyes_closed AND face_visible: detection = "sleepy"

   d) **Decision priority order**:
      1. Dark frame (brightness < 20) → absent
      2. No person (YOLO) AND brightness normal → absent  
      3. ≥2 persons (YOLO) → someone_else
      4. Cell phone detected (YOLO) → phone
      5. Eyes closed (MediaPipe) AND face visible → sleepy
      6. Face visible AND normal → focused
      7. Nothing detected → focused

   **Comments** — The `comment` field should contain a short, girlfriend-style alert message in English. The frontend handles Telugu translation. Examples:
   - phone: "Naveen! Put the phone down and focus on your studies!"
   - sleepy: "Naveen! Get up, walk around, drink some water!"
   - absent: "Naveen! Where did you go? Come back and study!"
   - someone_else: "Hey! Don't disturb Naveen, let him study!"

   **Performance**: 
   - Keep the image small for processing (resize to 320x240 before feeding to models)
   - Use a smaller YOLO model: `yolov8n.pt` (nano)
   - Return inference_ms in debug so frontend can show latency
   - Target: < 500ms per request

   **Error handling**:
   - If YOLO model fails to load → catch error, fall back to MediaPipe-only detection (can still detect faces/eyes)
   - If MediaPipe fails → catch error, fall back to YOLO-only detection (can still detect persons/phone)
   - If both fail → return focused with debug showing errors
   - Cache the YOLO model in a global/singleton so it's loaded once

   **Startup**:
   - On startup, pre-load both YOLO and MediaPipe models
   - Print "Vision server ready" and list which models loaded successfully
   - Listen on 0.0.0.0:3001

3. **`server/vision/run.sh`**
```bash
#!/bin/bash
cd "$(dirname "$0")"
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 3001 --log-level warning
```

## INTEGRATION WITH EXISTING CODE

### Modify `server.ts` (Express server, port 3000):

Add a proxy for the vision endpoint. Before the existing Ollama/Gemini vision code, try the Python server first:

```typescript
// In POST /api/vision/analyze handler, BEFORE the Ollama try block:
// Try Python vision server first
try {
  const pyRes = await fetch("http://localhost:3001/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64 }),
    signal: AbortSignal.timeout(5000),
  });
  if (pyRes.ok) {
    const data = await pyRes.json();
    // data.detection, data.comment, data.debug
    res.json(data);
    return;
  }
} catch (e) {
  console.warn("[Vision] Python server unavailable, falling back.");
}
// Then continue with existing Ollama/Gemini/demo code...
```

### Modify frontend `VisionSystem.tsx`:

The frontend already sends frames to `POST /api/vision/analyze`. No changes needed — it will automatically receive the Python server's results via the Express proxy. The response format (`{ detection, comment }`) is identical.

## RUNNING THE WHOLE SYSTEM

1. Start Python service: `cd server/vision && bash run.sh`
2. Start Express + Vite: `npm run dev:all`
3. The Python service logs "Vision server ready" when models are loaded

## TESTS TO VERIFY

After building, verify:
1. `curl -X POST http://localhost:3001/analyze -H "Content-Type: application/json" -d '{"image_base64":"<test-image>"}'` returns valid JSON
2. The Express server proxies to Python correctly: `curl -X POST http://localhost:3000/api/vision/analyze -H "Content-Type: application/json" -d '{"image_base64":"<test-image>"}'` returns the same
3. Both YOLO and MediaPipe load without errors on startup
4. Dark image returns "absent"
5. Image with a person returns "focused"
6. Image with cell phone object returns "phone"

## IMPORTANT CONSTRAINTS
- Python 3.10+ required (check with `python3 --version`)
- macOS with Apple Silicon (M-series) — Metal/MPS acceleration may be available
- The YOLO model downloads automatically on first run (~6MB)
- MediaPipe models download on first run (~10MB)
- Make sure CORS is enabled (FastAPI's CORSMiddleware) to allow cross-origin requests from the frontend
- Set `uvicorn` log level to warning to avoid noise
- The service must handle concurrent requests safely (use async properly)
- If the camera feed stops, the service should still respond with whatever it can detect

## WHAT SUCCESS LOOKS LIKE
When the user opens the AIRI Surveillance panel in their browser:
1. Camera shows their face
2. Every 14 seconds, a scan runs
3. The log shows: `[10:32:15] focused (142ms · 1 person, 0 phones)`
4. If they pull out a phone: alert shows + voice says "Naveen! Put the phone down!"
5. If they fall asleep at desk: alert shows + voice says "Naveen! Get up!"
6. If someone walks in: alert shows + voice says "Hey! Don't disturb Naveen!"
7. If they leave the room: alert shows + voice says "Naveen! Where did you go?"

Build this now. Create all the files needed.
