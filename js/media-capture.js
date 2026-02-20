/* ═══════════════════════════════════════════════
   js/media-capture.js  —  Camera / Video / Audio
   Unlimited recording, stores blobs for board use.
═══════════════════════════════════════════════ */

const MediaCapture = (() => {

  // Captured items waiting to be added to board
  let pendingMedia = [];

  function getPending()  { return pendingMedia; }
  function clearPending(){ pendingMedia = []; renderPendingList(); }

  // ── Render pending list in response section ───
  function renderPendingList() {
    const list = document.getElementById('captured-media-list');
    if (!list) return;
    list.innerHTML = '';
    if (pendingMedia.length === 0) return;

    pendingMedia.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:inline-block;position:relative;margin:4px;';

      if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.url;
        img.style.cssText = 'max-width:120px;max-height:90px;border-radius:6px;display:block;';
        wrap.appendChild(img);
      } else if (item.type === 'video') {
        const vid = document.createElement('video');
        vid.src = item.url;
        vid.controls = true;
        vid.style.cssText = 'max-width:160px;border-radius:6px;display:block;';
        wrap.appendChild(vid);
      } else if (item.type === 'audio') {
        const aud = document.createElement('audio');
        aud.src = item.url;
        aud.controls = true;
        aud.style.cssText = 'width:180px;display:block;margin-top:4px;';
        wrap.appendChild(aud);
      }

      const badge = document.createElement('span');
      badge.textContent = item.type.toUpperCase();
      badge.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:3px;';
      wrap.appendChild(badge);

      list.appendChild(wrap);
    });

    // Show response section if hidden
    const rs = document.getElementById('response-section');
    if (rs) rs.style.display = 'block';
  }

  // ── Show camera capture modal ────────────────
  async function capturePhoto() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      alert('Camera access denied: ' + err.message);
      return;
    }

    const modal = createModal(`
      <h3 style="color:#00aaff;margin-bottom:12px;">📸 Capture Photo</h3>
      <video id="cam-preview" autoplay muted style="width:100%;border-radius:8px;background:#000;"></video>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
        <button class="btn" id="cam-cancel">Cancel</button>
        <button class="btn btn-primary" id="cam-snap">📸 Take Photo</button>
      </div>
    `);

    modal.querySelector('#cam-preview').srcObject = stream;

    modal.querySelector('#cam-cancel').onclick = () => {
      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    };

    modal.querySelector('#cam-snap').onclick = () => {
      const video = modal.querySelector('#cam-preview');
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      pendingMedia.push({ type: 'photo', url: dataUrl, label: 'Photo ' + (pendingMedia.length + 1) });
      renderPendingList();

      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    };
  }

  // ── Video recording (unlimited) ──────────────
  let videoRecorder = null;
  let videoChunks   = [];
  let videoTimer    = null;
  let videoStream   = null;
  let videoModal    = null;

  async function startVideo() {
    if (videoRecorder) { alert('Recording already in progress.'); return; }
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Camera/mic access denied: ' + err.message);
      return;
    }

    videoChunks = [];
    videoModal = createModal(`
      <h3 style="color:#ff3333;margin-bottom:12px;">🎥 Recording Video…</h3>
      <video id="vid-preview" autoplay muted style="width:100%;border-radius:8px;background:#000;"></video>
      <div style="text-align:center;margin:10px 0;font-size:1.5rem;color:#ff3333;" id="vid-timer">⏺ 00:00</div>
    `);
    videoModal.querySelector('#vid-preview').srcObject = videoStream;

    videoRecorder = new MediaRecorder(videoStream);
    videoRecorder.ondataavailable = e => { if (e.data.size > 0) videoChunks.push(e.data); };
    videoRecorder.onstop = () => finishVideo();
    videoRecorder.start();

    let secs = 0;
    videoTimer = setInterval(() => {
      secs++;
      const el = videoModal && videoModal.querySelector('#vid-timer');
      if (el) {
        const m = String(Math.floor(secs / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        el.textContent = `⏺ ${m}:${s}`;
      }
    }, 1000);

    // Show stop button
    const stopBtn = document.getElementById('stop-video');
    if (stopBtn) stopBtn.style.display = 'inline-flex';
  }

  function stopVideo() {
    if (videoRecorder && videoRecorder.state !== 'inactive') {
      videoRecorder.stop();
    }
  }

  function finishVideo() {
    clearInterval(videoTimer);
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    if (videoModal) videoModal.remove();
    videoModal = null;

    const blob = new Blob(videoChunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);
    pendingMedia.push({ type: 'video', url, blob, label: 'Video ' + (pendingMedia.length + 1) });
    renderPendingList();

    videoRecorder = null; videoChunks = []; videoStream = null;
    const stopBtn = document.getElementById('stop-video');
    if (stopBtn) stopBtn.style.display = 'none';
  }

  // ── Audio recording (unlimited) ──────────────
  let audioRecorder = null;
  let audioChunks   = [];
  let audioTimer    = null;
  let audioModal    = null;

  async function startAudio() {
    if (audioRecorder) { alert('Recording already in progress.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunks = [];
      audioModal = createModal(`
        <h3 style="color:#ff3333;margin-bottom:12px;">🎤 Recording Audio…</h3>
        <div style="text-align:center;padding:30px;font-size:4rem;">🎤</div>
        <div style="text-align:center;font-size:1.8rem;color:#ff3333;" id="aud-timer">⏺ 00:00</div>
      `);

      audioRecorder = new MediaRecorder(stream);
      audioRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      audioRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        finishAudio();
      };
      audioRecorder.start();

      let secs = 0;
      audioTimer = setInterval(() => {
        secs++;
        const el = audioModal && audioModal.querySelector('#aud-timer');
        if (el) {
          const m = String(Math.floor(secs / 60)).padStart(2, '0');
          const s = String(secs % 60).padStart(2, '0');
          el.textContent = `⏺ ${m}:${s}`;
        }
      }, 1000);

      const stopBtn = document.getElementById('stop-audio');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
    } catch (err) {
      alert('Microphone access denied: ' + err.message);
    }
  }

  function stopAudio() {
    if (audioRecorder && audioRecorder.state !== 'inactive') {
      audioRecorder.stop();
    }
  }

  function finishAudio() {
    clearInterval(audioTimer);
    if (audioModal) audioModal.remove();
    audioModal = null;

    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const url  = URL.createObjectURL(blob);
    pendingMedia.push({ type: 'audio', url, blob, label: 'Audio ' + (pendingMedia.length + 1) });
    renderPendingList();

    audioRecorder = null; audioChunks = [];
    const stopBtn = document.getElementById('stop-audio');
    if (stopBtn) stopBtn.style.display = 'none';
  }

  // ── Simple modal factory ──────────────────────
  function createModal(html) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background:rgba(0,0,0,0.9);z-index:2000;
      display:flex;align-items:center;justify-content:center;
    `;
    const box = document.createElement('div');
    box.style.cssText = `
      background:#1e1e1e;border:2px solid #00aaff;border-radius:12px;
      padding:24px;max-width:580px;width:100%;
    `;
    box.innerHTML = html;
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    return wrap;
  }

  // ── Init ──────────────────────────────────────
  function init() {
    document.getElementById('capture-photo').addEventListener('click', capturePhoto);
    document.getElementById('capture-video').addEventListener('click', startVideo);
    document.getElementById('stop-video').addEventListener('click',   stopVideo);
    document.getElementById('capture-audio').addEventListener('click', startAudio);
    document.getElementById('stop-audio').addEventListener('click',   stopAudio);
  }

  return { init, getPending, clearPending };
})();
