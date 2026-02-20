/* ═══════════════════════════════════════════════
   js/interrogation.js  —  Interrogation Workflow
   AI question generation + response analysis.
═══════════════════════════════════════════════ */

const Interrogation = (() => {

  let questionHistory = [];

  // ── Format AI analysis output ─────────────────
  function formatAnalysis(raw) {
    if (!raw) return '';
    // Colorize key sections
    return raw
      .replace(/TRUTH SCORE:\s*(\d+)/gi, (_, n) => {
        const v = parseInt(n);
        const c = v >= 70 ? '#00ff88' : v >= 40 ? '#ff9500' : '#ff3333';
        return `<b style="color:${c}">TRUTH SCORE: ${n}/100</b>`;
      })
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

  // ── Analyze response ──────────────────────────
  async function analyzeResponse() {
    const resp = document.getElementById('subject-response').value.trim();
    if (!resp) { alert('Enter the subject\'s response first.'); return; }

    const btn = document.getElementById('analyze-response');
    btn.textContent = '⏳ Analyzing…';
    btn.disabled    = true;

    const context = {
      caseDesc:    document.getElementById('case-desc').value.trim(),
      subjectType: document.getElementById('interrogation-subject').value,
      subjectName: document.getElementById('interrogation-subject-name').value.trim(),
      question:    document.getElementById('interrogation-question').value.trim(),
      response:    resp
    };

    const raw    = await AI.analyzeResponse(context);
    const result = document.getElementById('analysis-result');
    result.innerHTML = formatAnalysis(raw);
    result.classList.add('visible');

    // Extract truth score and update honesty for named subject
    const scoreMatch = raw.match(/TRUTH SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]) / 100;
      await updateSubjectHonesty(context.subjectName, score);
    }

    // Add thought entry
    addThought(`📋 Analysis for <b>${context.subjectName || 'subject'}</b>: ${raw.slice(0, 120)}…`);

    btn.textContent = '🔍 AI Analyze Response';
    btn.disabled    = false;
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
