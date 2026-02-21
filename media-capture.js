/* ═══════════════════════════════════════════════
   js/media-capture.js  —  Camera / Video / Audio
   Stop buttons are INSIDE the recording modal.
═══════════════════════════════════════════════ */

const MediaCapture = (() => {

  let pendingMedia = [];
  function getPending()   { return pendingMedia; }
  function clearPending() { pendingMedia = []; renderPendingList(); }

  function renderPendingList() {
    const list = document.getElementById('captured-media-list');
    if (!list) return;
    list.innerHTML = '';
    if (!pendingMedia.length) return;
    pendingMedia.forEach(item => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:inline-block;position:relative;margin:4px;';
      if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.url;
        img.style.cssText = 'max-width:120px;max-height:90px;border-radius:6px;display:block;';
        wrap.appendChild(img);
      } else if (item.type === 'video') {
        const vid = document.createElement('video');
        vid.src = item.url; vid.controls = true;
        vid.style.cssText = 'max-width:160px;border-radius:6px;display:block;';
        wrap.appendChild(vid);
      } else if (item.type === 'audio') {
        const aud = document.createElement('audio');
        aud.src = item.url; aud.controls = true;
        aud.style.cssText = 'width:180px;display:block;margin-top:4px;';
        wrap.appendChild(aud);
      }
      const badge = document.createElement('span');
      badge.textContent = item.type.toUpperCase();
      badge.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:3px;';
      wrap.appendChild(badge);
      list.appendChild(wrap);
    });
    const rs = document.getElementById('response-section');
    if (rs) rs.style.display = 'block';
  }

  // ── Photo ─────────────────────────────────────
  async function capturePhoto() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
    catch (err) { alert('Camera access denied: ' + err.message); return; }

    const modal = createModal(`
      <h3 style="color:#00aaff;margin-bottom:12px;">📸 Capture Photo</h3>
      <video id="cam-preview" autoplay muted style="width:100%;border-radius:8px;background:#000;"></video>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
        <button class="btn" id="cam-cancel">✕ Cancel</button>
        <button class="btn btn-primary" id="cam-snap">📸 Take Photo</button>
      </div>`);

    modal.querySelector('#cam-preview').srcObject = stream;
    modal.querySelector('#cam-cancel').onclick = () => { stream.getTracks().forEach(t=>t.stop()); modal.remove(); };
    modal.querySelector('#cam-snap').onclick = () => {
      const video = modal.querySelector('#cam-preview');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      pendingMedia.push({ type:'photo', url:canvas.toDataURL('image/jpeg',0.9), label:'Photo '+(pendingMedia.length+1) });
      renderPendingList();
      stream.getTracks().forEach(t=>t.stop()); modal.remove();
    };
  }

  // ── Video ─────────────────────────────────────
  let videoRecorder=null, videoChunks=[], videoTimer=null, videoStream=null, videoModal=null;

  async function startVideo() {
    if (videoRecorder) { alert('Recording already in progress.'); return; }
    try { videoStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true }); }
    catch(err) { alert('Camera/mic denied: '+err.message); return; }

    videoChunks = [];
    videoModal = createModal(`
      <h3 style="color:#ff3333;margin-bottom:12px;">🎥 Recording Video…</h3>
      <video id="vid-preview" autoplay muted style="width:100%;border-radius:8px;background:#000;"></video>
      <div style="text-align:center;margin:10px 0;font-size:1.4rem;color:#ff3333;" id="vid-timer">⏺ 00:00</div>
      <div style="text-align:center;">
        <button class="btn btn-danger" id="vid-stop-btn" style="padding:10px 32px;font-size:1rem;">⏹ Stop Recording</button>
      </div>`);

    videoModal.querySelector('#vid-preview').srcObject = videoStream;
    videoModal.querySelector('#vid-stop-btn').onclick  = stopVideo;

    videoRecorder = new MediaRecorder(videoStream);
    videoRecorder.ondataavailable = e => { if(e.data.size>0) videoChunks.push(e.data); };
    videoRecorder.onstop = finishVideo;
    videoRecorder.start();

    let secs=0;
    videoTimer = setInterval(() => {
      secs++;
      const el = videoModal && videoModal.querySelector('#vid-timer');
      if (el) el.textContent = '⏺ '+String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
    }, 1000);
  }

  function stopVideo()  { if (videoRecorder && videoRecorder.state!=='inactive') videoRecorder.stop(); }
  function finishVideo() {
    clearInterval(videoTimer);
    if (videoStream) videoStream.getTracks().forEach(t=>t.stop());
    if (videoModal)  videoModal.remove(); videoModal=null;
    const url = URL.createObjectURL(new Blob(videoChunks,{type:'video/webm'}));
    pendingMedia.push({type:'video',url,label:'Video '+(pendingMedia.length+1)});
    renderPendingList();
    videoRecorder=null; videoChunks=[]; videoStream=null;
  }

  // ── Audio ─────────────────────────────────────
  let audioRecorder=null, audioChunks=[], audioTimer=null, audioModal=null;

  async function startAudio() {
    if (audioRecorder) { alert('Recording already in progress.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
    catch(err) { alert('Mic denied: '+err.message); return; }

    audioChunks = [];
    audioModal = createModal(`
      <h3 style="color:#ff3333;margin-bottom:12px;">🎤 Recording Audio…</h3>
      <div style="text-align:center;padding:20px 0 8px;font-size:3.5rem;">🎤</div>
      <div style="text-align:center;font-size:1.6rem;color:#ff3333;margin-bottom:16px;" id="aud-timer">⏺ 00:00</div>
      <div style="text-align:center;">
        <button class="btn btn-danger" id="aud-stop-btn" style="padding:10px 32px;font-size:1rem;">⏹ Stop Recording</button>
      </div>`);

    audioModal.querySelector('#aud-stop-btn').onclick = stopAudio;
    audioRecorder = new MediaRecorder(stream);
    audioRecorder.ondataavailable = e => { if(e.data.size>0) audioChunks.push(e.data); };
    audioRecorder.onstop = () => { stream.getTracks().forEach(t=>t.stop()); finishAudio(); };
    audioRecorder.start();

    let secs=0;
    audioTimer = setInterval(() => {
      secs++;
      const el = audioModal && audioModal.querySelector('#aud-timer');
      if (el) el.textContent = '⏺ '+String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
    }, 1000);
  }

  function stopAudio()  { if (audioRecorder && audioRecorder.state!=='inactive') audioRecorder.stop(); }
  function finishAudio() {
    clearInterval(audioTimer);
    if (audioModal) audioModal.remove(); audioModal=null;
    const url = URL.createObjectURL(new Blob(audioChunks,{type:'audio/webm'}));
    pendingMedia.push({type:'audio',url,label:'Audio '+(pendingMedia.length+1)});
    renderPendingList();
    audioRecorder=null; audioChunks=[];
  }

  function createModal(html) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:2000;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1e1e1e;border:2px solid #00aaff;border-radius:12px;padding:24px;max-width:560px;width:90%;';
    box.innerHTML = html;
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    return wrap;
  }

  function init() {
    document.getElementById('capture-photo').addEventListener('click', capturePhoto);
    document.getElementById('capture-video').addEventListener('click', startVideo);
    document.getElementById('stop-video').addEventListener('click',   stopVideo);
    document.getElementById('capture-audio').addEventListener('click', startAudio);
    document.getElementById('stop-audio').addEventListener('click',   stopAudio);
  }

  return { init, getPending, clearPending };
})();
