/* ═══════════════════════════════════════════════
   js/ai-engine.js  —  Anthropic API Integration
   All AI features live here.
═══════════════════════════════════════════════ */

const AI = (() => {

  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-sonnet-4-20250514';

  // ── API key management ────────────────────────
  function getKey()       { return DB.Prefs.get('anthropicKey') || ''; }
  function hasKey()       { return !!getKey(); }

  function initKeyBanner() {
    const saved = getKey();
    const input  = document.getElementById('api-key-input');
    const status = document.getElementById('api-key-status');
    if (saved) {
      input.value       = saved;
      status.textContent = '✅ Key saved';
    }
    document.getElementById('save-api-key').addEventListener('click', () => {
      const val = input.value.trim();
      if (!val.startsWith('sk-ant-')) {
        status.textContent = '❌ Invalid key format';
        status.style.color = '#ff3333';
        return;
      }
      DB.Prefs.set('anthropicKey', val);
      status.textContent = '✅ Key saved';
      status.style.color = '#00ff88';
    });
  }

  // ── Core API call ─────────────────────────────
  async function call(systemPrompt, userMessage, maxTokens = 800) {
    if (!hasKey()) {
      return '⚠️ No API key set. Paste your Anthropic key in the banner above.';
    }
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return `❌ API error ${resp.status}: ${err.error?.message || resp.statusText}`;
      }

      const data = await resp.json();
      return data.content?.map(b => b.text || '').join('') || '(no response)';

    } catch (err) {
      return `❌ Network error: ${err.message}`;
    }
  }

  // ── Generate interrogation question ──────────
  async function generateQuestion(context) {
    const sys = `You are an expert detective and interrogation specialist.
Generate one sharp, tactful interrogation question based on the context provided.
Output ONLY the question — no preamble, no explanation, no quotes.`;
    const msg = `Case description: ${context.caseDesc || '(none)'}
Subject type: ${context.subjectType || 'unknown'}
Subject name: ${context.subjectName || 'unknown'}
Previous context / last response: ${context.prevContext || '(none)'}
Generate the single best next question to ask.`;
    return call(sys, msg, 200);
  }

  // ── Analyze captured media for behavioral deception cues ─────────────
  // Accepts an array of base64 image frames extracted from photos/video.
  // Audio is analyzed by describing voice stress context.
  async function analyzeMedia(context) {
    if (!hasKey()) {
      return '⚠️ No API key set. Paste your Anthropic key in the banner above.';
    }

    const sys = `You are an expert forensic behavioral analyst specializing in deception detection.
You are analyzing interrogation media (photos, video frames, audio context) of a subject.
Look for nonverbal behavioral cues that may indicate deception, stress, or concealment.

Examine and report on:
- FACIAL EXPRESSIONS: microexpressions, asymmetry, forced vs genuine emotion, eye contact avoidance, blink rate changes
- BODY LANGUAGE & POSTURE: self-soothing gestures, crossed arms/legs, leaning away, shoulder tension, fidgeting
- HAND & GESTURE ANALYSIS: covering mouth, touching face/neck, object manipulation, illustrator suppression
- VOCAL STRESS INDICATORS (if audio present): pitch changes, speech rate, hesitations, voice tremor, dry mouth signs
- AUTONOMIC RESPONSES: flushing, sweating, swallowing, pupil dilation (if visible)

Return your analysis in this exact format:

TRUTH SCORE: [0-100]
FACIAL CUES: [specific observations or "Not visible"]
BODY LANGUAGE: [specific observations or "Not visible"]  
GESTURE ANALYSIS: [specific observations or "Not visible"]
VOCAL STRESS: [specific observations or "Audio not provided"]
AUTONOMIC INDICATORS: [specific observations or "None visible"]
DECEPTION INDICATORS: [summarize the most significant red flags, or "None detected"]
EMOTIONAL STATE: [overall emotional assessment]
OVERALL ASSESSMENT: [2-3 sentence behavioral summary and credibility judgment]`;

    // Build the message content array — text context + image frames
    const contentParts = [];

    // Add text context first
    contentParts.push({
      type: 'text',
      text: `Case: ${context.caseDesc || '(none)'}
Subject: ${context.subjectName || 'unknown'} (${context.subjectType || 'unknown'})
Question asked during capture: ${context.question || '(none)'}
Number of media items analyzed: ${context.frames ? context.frames.length : 0}
Audio recording present: ${context.hasAudio ? 'Yes' : 'No'}

Analyze the following captured media for behavioral deception indicators:`
    });

    // Add image frames
    if (context.frames && context.frames.length > 0) {
      context.frames.forEach((frame, i) => {
        contentParts.push({
          type: 'text',
          text: `[Media item ${i + 1} of ${context.frames.length} — ${frame.label || 'capture'}]:`
        });
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: frame.mediaType || 'image/jpeg',
            data: frame.data  // pure base64, no data: prefix
          }
        });
      });
    }

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 900,
          system: sys,
          messages: [{ role: 'user', content: contentParts }]
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return `❌ API error ${resp.status}: ${err.error?.message || resp.statusText}`;
      }
      const data = await resp.json();
      return data.content?.map(b => b.text || '').join('') || '(no response)';
    } catch (err) {
      return `❌ Network error: ${err.message}`;
    }
  }

  // ── Generate case insights ────────────────────
  async function generateCaseInsights(context) {
    const sys = `You are a brilliant detective AI. Analyze all available case evidence.
Provide a structured report in this format:

CASE SUMMARY: [brief overview]

SUSPECT ANALYSIS:
[For each suspect, assess their guilt probability with reasoning]

KEY EVIDENCE CONNECTIONS: [what links together]

BLIND SPOTS: [what the investigation may be missing]

RECOMMENDED NEXT STEPS:
1.
2.
3.

MOST LIKELY PERPETRATOR: [name or "insufficient data"] — [confidence %] — [brief reason]`;

    const suspects = context.suspects || [];
    const suspectSummary = suspects.map(s =>
      `- ${s.name}: ${s.description || ''} | History: ${s.crimeHistory || 'none'} | Statement: ${s.statement || 'none'}`
    ).join('\n');

    const msg = `Case Description: ${context.caseDesc || '(none)'}
Detective Notes: ${context.notes || '(none)'}
Suspects/Witnesses:\n${suspectSummary || '(none added yet)'}
Evidence photos uploaded: ${context.evidenceCount || 0}
Board connections: ${context.boardConnections || 0}`;

    return call(sys, msg, 1000);
  }

  // ── Generate subject profile ──────────────────
  async function generateSubjectProfile(subject, caseDesc) {
    const sys = `You are a criminal profiler. Based on the subject data provided,
generate a short behavioral profile (3-5 sentences) and assign a guilt probability (0-100%)
based solely on the described circumstances. Format: PROFILE: [text] | GUILT: [number]`;

    const msg = `Case: ${caseDesc || '(none)'}
Subject: ${subject.name}, Age ${subject.age}, ${subject.sex}
Crime history: ${subject.crimeHistory || 'none'}
Statement: ${subject.statement || 'none'}
Notes: ${subject.history || 'none'}`;

    return call(sys, msg, 300);
  }

  return {
    initKeyBanner,
    hasKey,
    generateQuestion,
    analyzeMedia,
    generateCaseInsights,
    generateSubjectProfile
  };
})();
