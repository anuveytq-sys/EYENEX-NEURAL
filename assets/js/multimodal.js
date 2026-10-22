(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const startButton = $('#cameraStart'), calibrateButton = $('#cameraCalibrate');
  const pauseButton = $('#cameraPause'), blinkButton = $('#cameraBlink'), stopButton = $('#cameraStop');
  const modeButton = $('#cameraMode'), openSettingsButton = $('#openSettings');
  const video = $('#cameraPreview'), previewOverlay = $('#cameraPreviewOverlay');
  const status = $('#cameraStatus'), feedback = $('#cameraFeedback');
  const settingsDialog = $('#settingsDialog');
  if (!startButton || !video || !status || !feedback) return;

  const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  let stream = null, landmarker = null, raf = 0, paused = false, blinkConfirm = false;
  let baseline = null, smoothed = null, eyeBaseline = null, eyeSmoothed = null, pointerMode = 'head', closedAt = 0, blinkConsumed = false, lastFrameAt = 0;
  let pointer = null, pointerX = window.innerWidth / 2, pointerY = window.innerHeight / 2;
  let lastConfirmAt = 0, lastDetectErrorAt = 0;

  function setStatus(label, active = false) {
    status.textContent = label;
    status.classList.toggle('is-active', active);
  }
  function say(message) { feedback.textContent = message; }
  function ensurePointer() {
    if (pointer) return pointer;
    pointer = document.createElement('div');
    pointer.className = 'eyenex-camera-pointer';
    pointer.setAttribute('aria-hidden', 'true');
    (settingsDialog && settingsDialog.open ? settingsDialog : document.body).appendChild(pointer);
    return pointer;
  }
  function updatePointer(x, y) {
    pointerX = Math.max(8, Math.min(window.innerWidth - 8, x));
    pointerY = Math.max(8, Math.min(window.innerHeight - 8, y));
    const node = ensurePointer();
    node.style.left = pointerX + 'px';
    node.style.top = pointerY + 'px';
    node.classList.add('is-active');
  }
  function safeConfirmAtPointer() {
    const now = performance.now();
    if (now - lastConfirmAt < 1300) return;
    lastConfirmAt = now;
    const target = document.elementFromPoint(pointerX, pointerY);
    if (!target) { say('Blink detected, but no confirmable control is under the pointer.'); return; }
    const button = target.closest('button:not(:disabled)');
    const label = button ? [button.textContent, button.title, button.getAttribute('aria-label') || ''].join(' ') : '';
    const destructive = /\b(delete|remove|clear|reset|stop camera|erase)\b/i.test(label);
    if (!button || button.type === 'submit' || destructive || button.matches('.danger,#removeSavedKey,.settings-close,#closeSettings,#closeDialog') ||
        button.closest('.camera-control-card') || button.getAttribute('aria-hidden') === 'true' || button.matches('#cameraMode,#cameraCalibrate,#cameraPause,#cameraBlink,#cameraStart,#cameraStop')) {
      say('Blink registered. Move the pointer onto a safe, non-destructive button to confirm.');
      return;
    }
    say('Deliberate blink detected — confirming: ' + (button.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) || 'button'));
    button.click();
  }
  function getBlendshape(categories, name) {
    const entry = categories && categories.find(item => item.categoryName === name);
    return entry ? entry.score : 0;
  }
  function setControls(active) {
    calibrateButton.disabled = !active;
    pauseButton.disabled = !active;
    blinkButton.disabled = !active;
    if (modeButton) modeButton.disabled = !active;
    stopButton.disabled = !active;
    startButton.disabled = active;
    pauseButton.textContent = paused ? 'Resume tracking' : 'Pause tracking';
    blinkButton.textContent = 'Blink confirm: ' + (blinkConfirm ? 'ON' : 'OFF');
    if (modeButton) modeButton.textContent = 'Pointer mode: ' + (pointerMode === 'head' ? 'HEAD' : 'EYE GAZE');
  }
  async function stopCamera(message = 'Camera stopped. The video stream has been released.') {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    paused = false;
    blinkConfirm = false;
    closedAt = 0;
    blinkConsumed = false;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.pause();
    video.srcObject = null;
    video.classList.remove('is-visible');
    previewOverlay.classList.remove('is-hidden');
    previewOverlay.textContent = 'PREVIEW OFF';
    if (landmarker) { try { landmarker.close(); } catch (_) {} }
    landmarker = null;
    if (pointer) pointer.classList.remove('is-active', 'is-confirming');
    setStatus('CAMERA OFF');
    setControls(false);
    say(message);
    startButton.disabled = false;
  }
  async function loadLandmarker() {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const files = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    return vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    });
  }
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say('Camera access is unavailable. Open the HTTPS site in a browser that supports camera access.');
      return;
    }
    startButton.disabled = true;
    say('Requesting camera permission…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }
      });
      video.srcObject = stream;
      await video.play();
      say('Loading face-landmark model. The first start may take a moment…');
      landmarker = await loadLandmarker();
      baseline = null;
      smoothed = null;
      eyeBaseline = null;
      eyeSmoothed = null;
      paused = false;
      video.classList.add('is-visible');
      previewOverlay.classList.add('is-hidden');
      setStatus('TRACKING · CALIBRATE', true);
      setControls(true);
      say('Camera active. Keep your head in a comfortable neutral position and press Calibrate center.');
      ensurePointer();
      tick();
    } catch (error) {
      await stopCamera('Could not start camera tracking: ' + (error && error.name === 'NotAllowedError' ? 'camera permission was denied.' : error && error.message ? error.message.slice(0, 160) : 'browser or model initialization failed.') + ' No camera data is saved.');
      startButton.disabled = false;
    }
  }
  function tick() {
    if (!stream || !landmarker || paused || document.hidden) {
      if (stream && !paused && document.hidden) raf = requestAnimationFrame(tick);
      return;
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const now = performance.now();
      if (now - lastFrameAt >= 45) {
        lastFrameAt = now;
        try {
          const result = landmarker.detectForVideo(video, now);
          const face = result.faceLandmarks && result.faceLandmarks[0];
          if (face && face[1]) {
            const nose = face[1];
            const sample = { x: nose.x, y: nose.y };
            if (face[468] && face[473]) {
              const eyeSample = { x: (face[468].x + face[473].x) / 2, y: (face[468].y + face[473].y) / 2 };
              if (!eyeSmoothed) eyeSmoothed = eyeSample;
              else { eyeSmoothed.x += (eyeSample.x - eyeSmoothed.x) * 0.28; eyeSmoothed.y += (eyeSample.y - eyeSmoothed.y) * 0.28; }
            }
            if (!smoothed) smoothed = sample;
            else {
              const alpha = 0.22;
              smoothed.x += (sample.x - smoothed.x) * alpha;
              smoothed.y += (sample.y - smoothed.y) * alpha;
            }
            if (baseline) {
              let x, y;
              if (pointerMode === 'eye' && eyeBaseline && eyeSmoothed) {
                x = (0.5 - (eyeSmoothed.x - eyeBaseline.x) * 7.0) * window.innerWidth;
                y = (0.5 + (eyeSmoothed.y - eyeBaseline.y) * 8.0) * window.innerHeight;
              } else {
                x = (0.5 + (smoothed.x - baseline.x) * 3.2) * window.innerWidth;
                y = (0.5 + (smoothed.y - baseline.y) * 3.2) * window.innerHeight;
              }
              updatePointer(x, y);
              setStatus(blinkConfirm ? 'TRACKING · BLINK ON' : 'TRACKING', true);
            }
            const categories = result.faceBlendshapes && result.faceBlendshapes[0] && result.faceBlendshapes[0].categories;
            const closed = getBlendshape(categories, 'eyeBlinkLeft') > 0.58 && getBlendshape(categories, 'eyeBlinkRight') > 0.58;
            if (closed && closedAt === 0) { closedAt = now; blinkConsumed = false; }
            if (!closed && closedAt > 0) {
              const duration = now - closedAt;
              if (blinkConfirm && !blinkConsumed && duration >= 250 && duration <= 900) {
                blinkConsumed = true;
                if (pointer) pointer.classList.add('is-confirming');
                safeConfirmAtPointer();
                setTimeout(() => pointer && pointer.classList.remove('is-confirming'), 350);
              }
              closedAt = 0;
            }
          } else {
            setStatus('FACE NOT DETECTED', true);
          }
        } catch (error) {
          if (now - lastDetectErrorAt > 3000) {
            lastDetectErrorAt = now;
            say('Tracking paused after a frame-processing issue. You can stop and restart the camera.');
          }
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }
  startButton.addEventListener('click', startCamera);
  calibrateButton.addEventListener('click', () => {
    if (!smoothed) { say('Face not detected yet. Face the camera and try calibration again.'); return; }
    baseline = { x: smoothed.x, y: smoothed.y };
    eyeBaseline = eyeSmoothed ? { x: eyeSmoothed.x, y: eyeSmoothed.y } : null;
    updatePointer(window.innerWidth / 2, window.innerHeight / 2);
    say('Center calibrated for ' + (pointerMode === 'head' ? 'head tracking' : 'eye gaze') + '. Recalibrate after changing pointer mode or moving position.');
    setStatus(blinkConfirm ? 'TRACKING · BLINK ON' : 'TRACKING', true);
  });
  pauseButton.addEventListener('click', () => {
    if (!stream) return;
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume tracking' : 'Pause tracking';
    if (paused) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (pointer) pointer.classList.remove('is-active');
      setStatus('PAUSED · CAMERA ON');
      say('Tracking paused. Camera stream remains active until you press Stop camera.');
    } else {
      setStatus('TRACKING', true);
      say('Tracking resumed. Recalibrate if your position has changed.');
      tick();
    }
  });
  if (modeButton) modeButton.addEventListener('click', () => {
    pointerMode = pointerMode === 'head' ? 'eye' : 'head';
    if (smoothed) baseline = { x: smoothed.x, y: smoothed.y };
    if (eyeSmoothed) eyeBaseline = { x: eyeSmoothed.x, y: eyeSmoothed.y };
    setControls(!!stream);
    say(pointerMode === 'eye' ? 'Eye-gaze mode enabled. Use Calibrate center while looking at the screen center; small eye movements steer the pointer.' : 'Head-pointer mode enabled. Use Calibrate center while holding a comfortable neutral head position.');
  });
  blinkButton.addEventListener('click', () => {
    blinkConfirm = !blinkConfirm;
    blinkButton.textContent = 'Blink confirm: ' + (blinkConfirm ? 'ON' : 'OFF');
    say(blinkConfirm ? 'Blink confirmation enabled. Close both eyes deliberately for about 0.25–0.9 seconds, then reopen to confirm a safe button under the pointer. Ordinary short blinks may be ignored.' : 'Blink confirmation disabled. Head tracking remains active.');
  });
  stopButton.addEventListener('click', () => stopCamera());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (pointer) pointer.classList.remove('is-active');
      say('Page hidden: tracking processing paused. Camera remains on until you return or stop it.');
    } else if (!document.hidden && stream && !paused) {
      tick();
    }
  });
  window.addEventListener('resize', () => {
    if (baseline && pointer && !paused) updatePointer(window.innerWidth / 2, window.innerHeight / 2);
  });
  if (settingsDialog) {
    settingsDialog.addEventListener('close', () => {
      if (pointer) document.body.appendChild(pointer);
      if (stream) say('Settings closed. Head/eye tracking continues in the background. Reopen Settings to pause or stop the camera.');
    });
  }
  if (openSettingsButton && settingsDialog) openSettingsButton.addEventListener('click', () => {
    if (pointer && settingsDialog.open) settingsDialog.appendChild(pointer);
  });
  setControls(false);
})();