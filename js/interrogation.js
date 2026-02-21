/* ═══════════════════════════════════════════════
   js/interrogation.js  —  Interrogation Workflow
   AI question generation + response analysis.
═══════════════════════════════════════════════ */

const Interrogation = (() => {

  let questionHistory = [];

  // ── Format AI analysis output ─────────────────
  function formatAnalysis(raw) {
    if (!raw) return '';
    return raw
      .replace(/TRUTH SCORE:\s*(\d+)/gi, (_, n) => {
        const v = parseInt(n);
        const c = v >= 70 ? '#00ff88' : v >= 40 ? '#ff9500' : '#ff3333';
        return `<b style="color:${c}">TRUTH SCORE: ${n}/100</b>`;
      })
      .replace(/FACIAL CUES:/gi,          '<b style="color:#00aaff">FACIAL CUES:</b>')
      .replace(/BODY LANGUAGE:/gi,        '<b style="color:#00aaff">BODY LANGUAGE:</b>')
      .replace(/GESTURE ANALYSIS:/gi,     '<b style="color:#ffd700">GESTURE ANALYSIS:</b>')
      .replace(/VOCAL STRESS:/gi,         '<b style="color:#ffd700">VOCAL STRESS:</b>')
      .replace(/AUTONOMIC INDICATORS:/gi, '<b style="color:#ff9500">AUTONOMIC INDICATORS:</b>')
      .replace(/DECEPTION INDICATORS:/gi, '<b style="color:#ff3333">DECEPTION INDICATORS:</b>')
      .replace(/EMOTIONAL STATE:/gi,      '<b style="color:#00aaff">EMOTIONAL STATE:</b>')
      .replace(/KEY INCONSISTENCIES:/gi,  '<b style="color:#ffd700">KEY INCONSISTENCIES:</b>')
      .replace(/RECOMMENDED FOLLOW-UPS:/gi,'<b style="color:#00aaff">RECOMMENDED FOLLOW-UPS:</b>')
      .replace(/OVERALL ASSESSMENT:/gi,   '<b style="color:#00ff88">OVERALL ASSESSMENT:</b>')
      .replace(/\n/g, '<br>');
  }

  // ── Auto-generate question ────────────────────
  async function autoGenerate() {
    const btn = document.getElementById('auto-generate-question');
    btn.textContent = '⏳ Generating…';
    btn.disabled    = true;

    const context = {
      caseDesc:     document.getElementById('case-desc').value.trim(),
      subjectType:  document.getElementById('interrogation-subject').value,
      subjectName:  document.getElementById('interrogation-subject-name').value.trim(),
      prevContext:  document.getElementById('crime-scene').value.trim()
    };

    const question = await AI.generateQuestion(context);
    document.getElementById('interrogation-question').value = question;

    // Show response section
    document.getElementById('response-section').style.display = 'block';

    btn.textContent = '🤖 AI Generate Question';
    btn.disabled    = false;
  }

  // ── Next question (log current, clear for next) ─
  function nextQuestion() {
    const q    = document.getElementById('interrogation-question').value.trim();
    const resp = document.getElementById('subject-response').value.trim();
    if (q) {
      questionHistory.push({ q, resp, ts: new Date().toISOString() });
    }
    // Move response to context
    if (resp) {
      document.getElementById('crime-scene').value = resp;
    }
    document.getElementById('interrogation-question').value = '';
    document.getElementById('subject-response').value       = '';
    document.getElementById('analysis-result').innerHTML    = '';
    document.getElementById('analysis-result').classList.remove('visible');
  }

  // ── Analyze captured media for behavioral cues ────────────────────────
  async function analyzeResponse() {
    const btn = document.getElementById('analyze-response');
    const pending = MediaCapture.getPending();

    if (!pending.length) {
      alert('No captured media to analyze.\n\nCapture a photo, video, or audio recording of the subject first, then click Analyze.');
      return;
    }

    btn.textContent = '⏳ Analyzing media…';
    btn.disabled    = true;

    // Extract frames from all captured media items
    const frames = [];
    let hasAudio = false;

    for (const item of pending) {
      if (item.type === 'photo') {
        // Photo: strip the data: URL prefix to get pure base64
        const parts = item.url.split(',');
        if (parts.length === 2) {
          const mimeMatch = parts[0].match(/data:([^;]+)/);
          frames.push({
            label:     item.label,
            mediaType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
            data:      parts[1]
          });
        }
      } else if (item.type === 'video') {
        // Video: extract up to 3 frames spread across the clip using a hidden canvas
        try {
          const extracted = await extractVideoFrames(item.url, item.label);
          extracted.forEach(f => frames.push(f));
        } catch(e) {
          console.warn('Frame extraction failed for', item.label, e);
        }
      } else if (item.type === 'audio') {
        hasAudio = true;
        // Audio waveform image: generate a simple indicator frame
        frames.push({
          label:     item.label + ' (audio recording)',
          mediaType: 'image/png',
          data:      generateAudioIndicatorFrame()
        });
      }
    }

    if (!frames.length && !hasAudio) {
      btn.textContent = '🔍 AI Analyze Media';
      btn.disabled    = false;
      alert('Could not extract analyzable content from the captured media.');
      return;
    }

    const context = {
      caseDesc:    document.getElementById('case-desc').value.trim(),
      subjectType: document.getElementById('interrogation-subject').value,
      subjectName: document.getElementById('interrogation-subject-name').value.trim(),
      question:    document.getElementById('interrogation-question').value.trim(),
      frames,
      hasAudio
    };

    const raw    = await AI.analyzeMedia(context);
    const result = document.getElementById('analysis-result');
    result.innerHTML = formatAnalysis(raw);
    result.classList.add('visible');

    // Extract truth score and update honesty for named subject
    const scoreMatch = raw.match(/TRUTH SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]) / 100;
      await updateSubjectHonesty(context.subjectName, score);
    }

    addThought('🎥 Media analysis for <b>' + (context.subjectName || 'subject') + '</b>: ' + raw.slice(0, 120) + '…');

    btn.textContent = '🔍 AI Analyze Media';
    btn.disabled    = false;
  }

  // ── Extract frames from a base64 video using a hidden video element ────
  function extractVideoFrames(videoUrl, label) {
    return new Promise(function(resolve) {
      var vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.muted       = true;
      vid.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(vid);

      var frames  = [];
      var canvas  = document.createElement('canvas');
      var ctx2    = canvas.getContext('2d');
      var grabbed = 0;

      function grabFrame(time) {
        return new Promise(function(res) {
          vid.currentTime = time;
          vid.onseeked = function() {
            canvas.width  = Math.min(vid.videoWidth,  640);
            canvas.height = Math.min(vid.videoHeight, 480);
            ctx2.drawImage(vid, 0, 0, canvas.width, canvas.height);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            var parts   = dataUrl.split(',');
            if (parts.length === 2) {
              frames.push({
                label:     label + ' (frame at ' + time.toFixed(1) + 's)',
                mediaType: 'image/jpeg',
                data:      parts[1]
              });
            }
            res();
          };
        });
      }

      vid.onloadedmetadata = async function() {
        var dur = vid.duration;
        // Grab up to 3 evenly-spaced frames: start, middle, near-end
        var times = dur <= 2
          ? [0]
          : dur <= 6
            ? [0.5, dur / 2]
            : [1, dur / 2, dur - 1.5];

        for (var i = 0; i < times.length; i++) {
          await grabFrame(times[i]);
        }
        vid.parentNode.removeChild(vid);
        resolve(frames);
      };

      vid.onerror = function() {
        if (vid.parentNode) vid.parentNode.removeChild(vid);
        resolve(frames); // return whatever we got
      };

      // Timeout safety net
      setTimeout(function() {
        if (vid.parentNode) vid.parentNode.removeChild(vid);
        resolve(frames);
      }, 15000);

      vid.src = videoUrl;
      vid.load();
    });
  }

  // ── Generate a small placeholder image to signal audio presence ────────
  function generateAudioIndicatorFrame() {
    var c   = document.createElement('canvas');
    c.width = 400; c.height = 120;
    var cx  = c.getContext('2d');
    cx.fillStyle = '#111';
    cx.fillRect(0, 0, 400, 120);
    cx.fillStyle = '#00aaff';
    cx.font = 'bold 18px monospace';
    cx.fillText('🎤 AUDIO RECORDING — VOICE STRESS ANALYSIS', 20, 40);
    cx.fillStyle = '#888';
    cx.font = '13px monospace';
    cx.fillText('Analyze for: pitch variation, speech pace, hesitation,', 20, 70);
    cx.fillText('filler words, vocal tremor, and dry mouth indicators.', 20, 92);
    return c.toDataURL('image/png').split(',')[1];
  }

  // ── Update subject honesty score in IDB ───────
  async function updateSubjectHonesty(name, score) {
    if (!name) return;
    const all  = await DB.getAll('suspects');
    const subj = all.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!subj) return;
    subj.honestyScore = score;
    subj.interviews   = subj.interviews || [];
    subj.interviews.push({
      date:     new Date().toISOString(),
      question: document.getElementById('interrogation-question').value.trim(),
      response: document.getElementById('subject-response').value.trim(),
      score
    });
    await DB.put('suspects', subj);
    await SuspectDB.renderMiniCards();
  }

  // ── Add a thought entry ───────────────────────
  function addThought(html) {
    const thoughts = document.getElementById('thoughts');
    if (!thoughts) return;
    const div = document.createElement('div');
    div.className = 'thought-entry';
    div.innerHTML = `<div class="thought-ts">${new Date().toLocaleTimeString()}</div>${html}`;
    thoughts.prepend(div);
  }

  // ── Init ──────────────────────────────────────
  function init() {
    document.getElementById('auto-generate-question').addEventListener('click', autoGenerate);
    document.getElementById('next-question').addEventListener('click', nextQuestion);
    document.getElementById('analyze-response').addEventListener('click', analyzeResponse);
  }

  return { init, addThought };
})();
