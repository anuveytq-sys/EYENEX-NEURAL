(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const startButton = $('#cameraStart'), calibrateButton = $('#cameraCalibrate');
  const pauseButton = $('#cameraPause'), blinkButton = $('#cameraBlink'), stopButton = $('#cameraStop');
  const modeButton = $('#cameraMode'), handButton = $('#cameraHandMode'), openSettingsButton = $('#openSettings');
  const video = $('#cameraPreview'), previewOverlay = $('#cameraPreviewOverlay');
  const status = $('#cameraStatus'), feedback = $('#cameraFeedback');
  const settingsDialog = $('#settingsDialog');
  if (!startButton || !video || !status || !feedback) return;

  const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  let stream = null, landmarker = null, handLandmarker = null, raf = 0, paused = false, blinkConfirm = false, handMode = false, pinchWasClosed = false, handSmoothed = null, lastHandY = null, lastHandActionAt = 0;
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
    if (now - lastConfirmAt < 850) return;
    lastConfirmAt = now;
    // Resolve the real element at the pointer position. The visual pointer itself
    // has pointer-events:none, so it should never mask the underlying control.
    const hit = document.elementFromPoint(pointerX, pointerY);
    if (!hit) { say('Gesture detected, but no control is under the pointer.'); return; }
    const control = hit.closest('button, a[href], [role="button"], input[type="button"], input[type="checkbox"], input[type="radio"], label, summary');
    if (!control || control.matches(':disabled,[aria-disabled="true"]')) {
      say('Gesture detected. Move the pointer directly over a button or interactive control.');
      return;
    }
    const label = [control.textContent || '', control.getAttribute('aria-label') || '', control.getAttribute('title') || '', control.id || ''].join(' ').trim();
    const destructive = /\\b(delete|erase|wipe|factory reset)\\b/i.test(label);
    // Keep the deliberate-touch safety gate for all submit controls except the
    // non-destructive command composer button, which is specifically requested
    // to support blink confirmation when a command has been entered.
    const isCommandSend = control.matches('#commandForm .send-button[type="submit"]');
    if ((control.matches('button[type="submit"],input[type="submit"],.danger,#removeSavedKey') && !isCommandSend) || destructive) {
      say('Gesture detected, but this control requires a deliberate touch/click.');
      return;
    }
    if (isCommandSend) {
      const commandInput = document.querySelector('#commandInput');
      if (!commandInput || !commandInput.value.trim()) {
        say('Send command is ready. Enter a command first, then blink while the pointer is over Send command.');
        return;
      }
    }
    try {
      control.focus({ preventScroll: true });
      control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, clientX: pointerX, clientY: pointerY, button: 0, buttons: 1 }));
      control.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, clientX: pointerX, clientY: pointerY, button: 0, buttons: 0 }));
      control.click();
      say('Gesture click activated: ' + (label.replace(/\\s+/g, ' ').slice(0, 55) || control.tagName.toLowerCase()));
    } catch (error) {
      say('Gesture found the control but could not activate it. Try a direct touch/click.');
    }
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
    if (handButton) handButton.disabled = !active;
    stopButton.disabled = !active;
    startButton.disabled = active;
    pauseButton.textContent = paused ? 'Resume tracking' : 'Pause tracking';
    blinkButton.textContent = 'Blink confirm: ' + (blinkConfirm ? 'ON' : 'OFF');
    if (modeButton) modeButton.textContent = 'Pointer mode: ' + (pointerMode === 'head' ? 'HEAD' : 'EYE GAZE');
    if (handButton) handButton.textContent = 'Hand gestures: ' + (handMode ? 'ON' : 'OFF');
  }
  async function stopCamera(message = 'Camera stopped. The video stream has been released.') {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    paused = false;
    blinkConfirm = false;
    closedAt = 0;
    blinkConsumed = false;
    handMode = false; pinchWasClosed = false; handSmoothed = null; lastHandY = null;
    if (handLandmarker) { try { handLandmarker.close(); } catch (_) {} }
    handLandmarker = null;
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
  async function loadHandLandmarker() {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const files = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    return vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55
    });
  }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function handGestureFrame(now) {
    if (!handMode || !handLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const result = handLandmarker.detectForVideo(video, now);
    const hand = result.landmarks && result.landmarks[0];
    if (!hand || hand.length < 21) { pinchWasClosed = false; lastHandY = null; setStatus('HAND NOT DETECTED', true); return; }
    const tip = hand[8], thumb = hand[4];
    const sample = { x: 1 - tip.x, y: tip.y };
    if (!handSmoothed) handSmoothed = sample;
    else { handSmoothed.x += (sample.x - handSmoothed.x) * 0.34; handSmoothed.y += (sample.y - handSmoothed.y) * 0.34; }
    updatePointer(handSmoothed.x * window.innerWidth, handSmoothed.y * window.innerHeight);
    const pinch = distance(tip, thumb) < 0.055;
    if (pinch && !pinchWasClosed && now - lastHandActionAt > 650) {
      lastHandActionAt = now; safeConfirmAtPointer();
    }
    pinchWasClosed = pinch;
    const indexUp = hand[8].y < hand[6].y, middleUp = hand[12].y < hand[10].y;
    const ringUp = hand[16].y < hand[14].y, pinkyUp = hand[20].y < hand[18].y;
    const openPalm = indexUp && middleUp && ringUp && pinkyUp && !pinch;
    if (openPalm) {
      if (lastHandY !== null) {
        const delta = (handSmoothed.y - lastHandY) * window.innerHeight;
        if (Math.abs(delta) > 1) {
          const target = document.elementFromPoint(pointerX, pointerY);
          const scrollable = target && target.closest('*');
          let node = scrollable;
          while (node && node !== document.body) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) break;
            node = node.parentElement;
          }
          (node && node !== document.body ? node : document.scrollingElement).scrollTop += delta * 1.8;
        }
      }
      lastHandY = handSmoothed.y;
    } else lastHandY = null;
    setStatus('HAND GESTURES · ACTIVE', true);
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
                x = (0.5 - (smoothed.x - baseline.x) * 3.2) * window.innerWidth;
                y = (0.5 + (smoothed.y - baseline.y) * 3.2) * window.innerHeight;
              }
              updatePointer(x, y);
              setStatus(blinkConfirm ? 'TRACKING · BLINK ON' : 'TRACKING', true);
            }
            const categories = result.faceBlendshapes && result.faceBlendshapes[0] && result.faceBlendshapes[0].categories;
            const blinkLeft = getBlendshape(categories, 'eyeBlinkLeft');
            const blinkRight = getBlendshape(categories, 'eyeBlinkRight');
            const closed = (blinkLeft + blinkRight) / 2 > 0.38 && Math.min(blinkLeft, blinkRight) > 0.18;
            if (closed && closedAt === 0) { closedAt = now; blinkConsumed = false; }
            if (!closed && closedAt > 0) {
              const duration = now - closedAt;
              if (blinkConfirm && !blinkConsumed && duration >= 120 && duration <= 850) {
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
      if (handMode) {
        try { handGestureFrame(performance.now()); }
        catch (_) { setStatus('HAND TRACKING RETRY', true); }
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
  if (handButton) handButton.addEventListener('click', async () => {
    if (!stream) return;
    if (handMode) {
      handMode = false; pinchWasClosed = false; lastHandY = null;
      if (handLandmarker) { try { handLandmarker.close(); } catch (_) {} }
      handLandmarker = null;
      setStatus('TRACKING', true);
      say('Hand gestures disabled. Your selected head/eye pointer mode is active again.');
      setControls(true); return;
    }
    handButton.disabled = true; say('Loading hand-gesture model…');
    try {
      if (!handLandmarker) handLandmarker = await loadHandLandmarker();
      handMode = true; pinchWasClosed = false; handSmoothed = null; lastHandY = null;
      setControls(true); setStatus('HAND GESTURES · ACTIVE', true);
      say('Hand mode active: move your index fingertip to steer; pinch thumb and index finger to click; hold an open palm and move vertically to scroll. Keep your hand fully visible in the camera preview.');
      tick();
    } catch (error) {
      handMode = false; setControls(true);
      say('Could not load hand tracking: ' + (error && error.message ? error.message.slice(0, 120) : 'model unavailable') + '. Head/eye tracking remains available.');
    }
  });
  blinkButton.addEventListener('click', () => {
    blinkConfirm = !blinkConfirm;
    blinkButton.textContent = 'Blink confirm: ' + (blinkConfirm ? 'ON' : 'OFF');
    say(blinkConfirm ? 'Blink confirmation enabled. close both eyes deliberately for about 0.12–0.85 seconds, then reopen to confirm a safe button under the pointer. Ordinary short blinks may be ignored.' : 'Blink confirmation disabled. Head tracking remains active.');
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