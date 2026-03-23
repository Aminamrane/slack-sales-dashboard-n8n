import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import "../index.css";
import minecraftFontUrl from "../assets/Minecraft.ttf";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const LIMITS = { TASK_NAME_MAX: 300, ANSWER_MAX: 3000, MAX_TASKS: 20, MAX_SUBTASKS: 15, HOURS_MAX: 24 };

const ONBOARDING_QUESTIONS = [
  "Quel est ton rôle principal dans l'équipe ?",
  "Qu'est-ce qui te motive le plus dans ton travail ?",
  "Comment tu gères les moments de stress ou surcharge ?",
  "Tes objectifs principaux cette semaine ?",
  "Un aspect de ton travail que tu aimerais améliorer ?",
];

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO RECORDER HOOK
// ══════════════════════════════════════════════════════════════════════════════
function useAudioRecorder() {
  const [activeId, setActiveId] = useState(null); // which field is recording
  const [transcribingId, setTranscribingId] = useState(null); // which field is transcribing
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async (id) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setActiveId(id);
    } catch (err) { console.warn('Microphone access denied:', err); }
  };

  const stopAndTranscribe = (id) => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') { resolve(null); return; }
      mr.onstop = async () => {
        setActiveId(null);
        setTranscribingId(id);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const token = apiClient.getToken();
          const resp = await fetch(`${apiClient.baseUrl}/api/v1/eod/transcribe`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
          });
          if (!resp.ok) throw new Error('Transcription failed');
          const data = await resp.json();
          resolve(data.text || '');
        } catch (err) { console.warn('Transcription error:', err); resolve(null); }
        finally { setTranscribingId(null); }
        mr.stream.getTracks().forEach(t => t.stop());
      };
      mr.stop();
    });
  };

  return { activeId, transcribingId, startRecording, stopAndTranscribe };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function EODReportV2() {
  const navigate = useNavigate();

  // ── DARK MODE (forced on this page, no flash) ──────────────────────────────
  const prevModeRef = useRef(localStorage.getItem("darkMode"));
  const [darkMode] = useState(() => {
    // Force dark SYNCHRONOUSLY before first paint
    document.body.classList.add("dark-mode");
    document.documentElement.classList.add("dark-mode");
    return true;
  });
  const setDarkMode = () => {}; // no-op — disable toggle

  useEffect(() => {

    return () => {
      // Restore previous mode on leave
      document.body.style.transition = '';
      document.documentElement.style.transition = '';
      const wasDark = prevModeRef.current === "true";
      if (!wasDark) {
        document.body.classList.remove("dark-mode");
        document.documentElement.classList.remove("dark-mode");
      }
    };
  }, []);

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff',
    border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#edf0f8',
    text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af',
    subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  // ── AUTH ────────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eodStatus, setEodStatus] = useState(null);
  const [todayReport, setTodayReport] = useState(null);

  // ── ONBOARDING ─────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState([]);
  const [onboardingCurrent, setOnboardingCurrent] = useState('');
  const [onboardingSending, setOnboardingSending] = useState(false);

  // ── STEP FLOW ──────────────────────────────────────────────────────────────
  // 0=projects, 1=onboarding (if first), 2=AI question start, 3=bank questions, 4=AI question end, 5=submit done
  const [step, setStep] = useState(0);

  // ── PROJECTS & TASKS (Step 0) ──────────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]); // { _id, task_name, project_id, subtasks: [{task_name, hours_spent}] }
  const [newTaskName, setNewTaskName] = useState('');
  const [newSubtasks, setNewSubtasks] = useState([{ name: '', hours: '' }]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [composerMode, setComposerMode] = useState('project'); // 'project' | 'task'
  const [removingTaskId, setRemovingTaskId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);

  // ── QUESTIONS (Steps 1-3) ──────────────────────────────────────────────────
  const [aiQuestionStart, setAiQuestionStart] = useState(null); // { question, id }
  const [bankQuestions, setBankQuestions] = useState([]); // [{ id, question, category }]
  const [aiQuestionEnd, setAiQuestionEnd] = useState(null); // { question, source }
  const [generatingReflection, setGeneratingReflection] = useState(false);

  // All answers collected through the flow
  const [aiStartAnswer, setAiStartAnswer] = useState('');
  const [bankAnswers, setBankAnswers] = useState([]); // [{ question, answer }]
  const [currentBankAnswer, setCurrentBankAnswer] = useState('');
  const [bankIndex, setBankIndex] = useState(0);
  const [aiEndAnswer, setAiEndAnswer] = useState('');

  // ── TYPING ANIMATION ───────────────────────────────────────────────────────
  const [typedText, setTypedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const typingRef = useRef(null);

  // ── MISC ───────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeDate, setActiveDate] = useState('today');
  const inputRef = useRef(null);
  const taskIdCounter = useRef(0);

  // Audio recorder
  const audio = useAudioRecorder();

  // ── INIT ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });

        // Check EOD status
        try {
          const status = await apiClient.get('/api/v1/eod/status');
          console.log('[EOD V2] status:', status);
          setEodStatus(status);
          // If today already submitted via status check, block the form
          if (status.today?.submitted || status.today_submitted) {
            setTodayReport({ fromStatus: true });
          }
        } catch { /* fallback: no onboarding */ }

        // Check if already submitted today
        try {
          const today = await apiClient.get('/api/v1/eod/today');
          console.log('[EOD V2] today report check:', today);
          if (today && (today.id || today.report_date || today.submitted)) setTodayReport(today);
        } catch (e) { console.log('[EOD V2] No report today:', e?.status || e); }

        // Load projects + questions in parallel
        const [projResp, questResp] = await Promise.all([
          apiClient.get('/api/v1/eod/my-projects').catch(() => ({ projects: [] })),
          apiClient.get('/api/v1/eod/my-questions').catch(() => ({})),
        ]);

        setProjects(projResp.projects || []);
        if (questResp.ai_question_start) setAiQuestionStart(questResp.ai_question_start);
        if (questResp.bank_questions) setBankQuestions(questResp.bank_questions);

      } catch { navigate("/login"); }
      finally { setLoading(false); }
    };
    init();
  }, [navigate]);

  // ── TYPING EFFECT ──────────────────────────────────────────────────────────
  const startTyping = useCallback((text) => {
    setTypedText('');
    setTypingDone(false);
    if (typingRef.current) clearInterval(typingRef.current);
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typingRef.current);
        setTypingDone(true);
      }
    }, 32);
  }, []);

  useEffect(() => { return () => { if (typingRef.current) clearInterval(typingRef.current); }; }, []);

  // Start typing when entering question steps
  useEffect(() => {
    if (step === 2 && aiQuestionStart) startTyping(aiQuestionStart.question);
    if (step === 3 && bankQuestions[bankIndex]) startTyping(bankQuestions[bankIndex].question);
    if (step === 4 && aiQuestionEnd) startTyping(aiQuestionEnd.question);
  }, [step, bankIndex, aiQuestionStart, aiQuestionEnd, startTyping]);

  // ── ONBOARDING HANDLERS ────────────────────────────────────────────────────
  const handleOnboardingNext = async () => {
    if (!onboardingCurrent.trim()) return;
    const answers = [...onboardingAnswers, { question: ONBOARDING_QUESTIONS[onboardingIndex], answer: onboardingCurrent.trim() }];
    setOnboardingAnswers(answers);
    setOnboardingCurrent('');

    if (onboardingIndex < ONBOARDING_QUESTIONS.length - 1) {
      setOnboardingIndex(onboardingIndex + 1);
    } else {
      // Submit onboarding then advance
      setOnboardingSending(true);
      try {
        await apiClient.post('/api/v1/eod/onboarding', { answers });
      } catch (err) { console.warn('Onboarding submit failed:', err); }
      setOnboardingSending(false);
      // Advance past onboarding
      advanceFrom(1);
    }
  };

  // ── PROJECT HANDLERS ───────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newProjectName.trim() || creatingProject) return;
    setCreatingProject(true);
    try {
      const resp = await apiClient.post('/api/v1/eod/projects', { name: newProjectName.trim() });
      const newProj = resp.project || resp;
      setProjects(prev => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      setNewProjectName('');
    } catch (err) { console.warn('Project creation failed:', err); }
    setCreatingProject(false);
  };

  // ── TASK HANDLERS ──────────────────────────────────────────────────────────
  const saveComposerToTasks = async () => {
    if (!newTaskName.trim()) return false;
    const validSubs = newSubtasks.filter(s => s.name.trim() && parseFloat(s.hours) > 0);
    if (validSubs.length === 0) return false;

    // In project mode, auto-create project if needed. In task mode, no project_id.
    let projId = null;
    if (composerMode === 'project') {
      projId = selectedProjectId;
      if (!projId) {
        const existing = projects.find(p => p.name.toLowerCase() === newTaskName.trim().toLowerCase());
        if (existing) {
          projId = existing.id;
        } else {
          try {
            const resp = await apiClient.post('/api/v1/eod/projects', { name: newTaskName.trim() });
            const newProj = resp.project || resp;
            setProjects(prev => [...prev, newProj]);
            projId = newProj.id;
          } catch { /* continue without project_id */ }
        }
      }
    }

    const task = {
      _id: `task-${taskIdCounter.current++}`,
      task_name: newTaskName.trim(),
      project_id: projId,
      subtasks: validSubs.map(s => ({ task_name: s.name.trim(), hours_spent: parseFloat(s.hours) })),
    };

    if (editingTaskId) {
      setTasks(prev => prev.map(t => t._id === editingTaskId ? { ...task, _id: editingTaskId } : t));
      setEditingTaskId(null);
    } else {
      setTasks(prev => [...prev, task]);
    }

    setNewTaskName('');
    setNewSubtasks([{ name: '', hours: '' }]);
    setSelectedProjectId(null);
    return true;
  };

  const deleteTask = (id) => {
    setRemovingTaskId(id);
    setTimeout(() => { setTasks(prev => prev.filter(t => t._id !== id)); setRemovingTaskId(null); }, 350);
  };

  const editTask = (task) => {
    if (newTaskName.trim()) saveComposerToTasks();
    setEditingTaskId(task._id);
    setNewTaskName(task.task_name);
    setSelectedProjectId(task.project_id);
    setNewSubtasks(task.subtasks.map(s => ({ name: s.task_name, hours: String(s.hours_spent) })));
    setTasks(prev => prev.filter(t => t._id !== task._id));
  };

  const updateNewSubtask = (idx, field, value) => {
    if (field === 'hours') {
      if (value && !/^\d{0,2}(\.\d{0,1})?$/.test(value)) return;
    }
    setNewSubtasks(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-add new row if filling last subtask
      if (idx === next.length - 1 && next[idx].name.trim() && next.length < LIMITS.MAX_SUBTASKS) {
        next.push({ name: '', hours: '' });
      }
      return next;
    });
  };

  const removeNewSubtask = (idx) => {
    if (newSubtasks.length <= 1) return;
    setNewSubtasks(prev => prev.filter((_, i) => i !== idx));
  };

  // ── STEP NAVIGATION ────────────────────────────────────────────────────────
  const advanceFrom = (currentStep) => {
    if (currentStep === 0) {
      // After projects → onboarding if first EOD, else skip to questions
      if (newTaskName.trim()) saveComposerToTasks();
      if (eodStatus?.is_first_eod && onboardingAnswers.length < ONBOARDING_QUESTIONS.length) {
        setStep(1); // onboarding
      } else if (aiQuestionStart) {
        setStep(2); // AI question start
      } else if (bankQuestions.length > 0) {
        setStep(3); // bank questions
      } else {
        // No questions at all → go to reflection
        goToReflection();
      }
    } else if (currentStep === 1) {
      // After onboarding → questions
      if (aiQuestionStart) setStep(2);
      else if (bankQuestions.length > 0) setStep(3);
      else goToReflection();
    } else if (currentStep === 2) {
      // After AI start → bank questions
      if (bankQuestions.length > 0) { setStep(3); setBankIndex(0); }
      else goToReflection();
    } else if (currentStep === 3) {
      // After bank questions → reflection
      goToReflection();
    } else if (currentStep === 4) {
      // After reflection → submit
      handleSubmit();
    }
  };

  const goToReflection = async () => {
    setStep(4);
    setGeneratingReflection(true);
    try {
      const body = {
        projects: projects.filter(p => tasks.some(t => t.project_id === p.id)).map(p => ({ id: p.id, name: p.name, status: p.status })),
        bank_answers: bankAnswers.map(ba => ({ question: ba.question, answer: ba.answer })),
      };
      const resp = await apiClient.post('/api/v1/eod/generate-reflection', body);
      setAiQuestionEnd({ question: resp.question, source: resp.source });
    } catch {
      setAiQuestionEnd({ question: "Y a-t-il quelque chose que tu ferais différemment demain ?", source: "fallback" });
    }
    setGeneratingReflection(false);
  };

  const handleNextStep = () => advanceFrom(step);

  // ── BANK QUESTION NAVIGATION ───────────────────────────────────────────────
  const handleBankNext = () => {
    if (!currentBankAnswer.trim()) return;
    const answers = [...bankAnswers, { question: bankQuestions[bankIndex].question, answer: currentBankAnswer.trim() }];
    setBankAnswers(answers);
    setCurrentBankAnswer('');

    if (bankIndex < bankQuestions.length - 1) {
      setBankIndex(bankIndex + 1);
    } else {
      // All bank questions done → generate reflection
      goToReflection();
    }
  };

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const questionAnswers = [];
      // AI start answer
      if (aiQuestionStart && aiStartAnswer.trim()) {
        questionAnswers.push({ question: aiQuestionStart.question, answer: aiStartAnswer.trim() });
      }
      // Bank answers
      bankAnswers.forEach(ba => questionAnswers.push(ba));
      // AI end answer
      if (aiQuestionEnd && aiEndAnswer.trim()) {
        questionAnswers.push({ question: aiQuestionEnd.question, answer: aiEndAnswer.trim() });
      }

      const reportDate = activeDate === 'yesterday' && eodStatus?.yesterday?.date
        ? eodStatus.yesterday.date
        : new Date().toISOString().split('T')[0];

      const payload = {
        report_date: reportDate,
        pool_key: null,
        question_answers: questionAnswers,
        tasks: tasks.map(t => ({
          task_name: t.task_name,
          hours_spent: 0,
          project_id: t.project_id || null,
          subtasks: t.subtasks,
        })),
        custom_answer: aiQuestionStart && aiStartAnswer.trim() ? {
          question_id: aiQuestionStart.id,
          question: aiQuestionStart.question,
          answer: aiStartAnswer.trim(),
        } : null,
      };

      await apiClient.post('/api/v1/eod/submit', payload);

      // Fire-and-forget to OpenClaw (AI analysis for EOD Dashboard)
      const openclawUrl = import.meta.env.VITE_OPENCLAW_WEBHOOK_URL;
      if (openclawUrl) {
        const user = apiClient.getUser();
        const totalHours = tasks.reduce((sum, t) => sum + (t.subtasks || []).reduce((s, st) => s + (st.hours_spent || 0), 0), 0);
        fetch(openclawUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': import.meta.env.VITE_OPENCLAW_API_KEY || '' },
          body: JSON.stringify({
            event: 'eod_submitted',
            timestamp: new Date().toISOString(),
            user: { id: user?.id, name: user?.name || user?.first_name || '', email: user?.email, role: user?.role, department: user?.department || user?.role },
            eod: { report_date: reportDate, pool_key: null, tasks: payload.tasks, question_answers: questionAnswers, total_hours: totalHours },
          }),
        }).catch(err => console.warn('[OpenClaw] Send failed (non-blocking):', err));
      }

      setSubmitted(true);
      setStep(5);
      // Re-fetch today report to prevent double submission on refresh
      try { const t = await apiClient.get('/api/v1/eod/today'); if (t && t.id) setTodayReport(t); } catch {}
    } catch (err) { console.error('Submit error:', err); alert('Erreur lors de la soumission. Réessayez.'); }
    setSubmitting(false);
  };

  // ── RENDER HELPERS (plain functions, not components — avoids remount/focus loss) ──
  const renderMicBtn = (myId, onTranscribe) => {
    const isRec = audio.activeId === myId;
    const isTr = audio.transcribingId === myId;
    const isBusy = audio.activeId != null && !isRec;
    const handleClick = async () => {
      if (isRec) { const text = await audio.stopAndTranscribe(myId); if (text) onTranscribe(text); }
      else if (!isBusy && !isTr) { audio.startRecording(myId); }
    };
    return (
      <button type="button" onClick={handleClick} disabled={isTr || isBusy}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: isRec ? '#ef4444' : isTr ? C.muted : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), color: isRec ? '#fff' : isTr ? '#fff' : C.muted, cursor: isTr || isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease', animation: isRec ? 'gentlePulse 1.5s ease-in-out infinite' : 'none', opacity: isBusy ? 0.3 : 1 }}
        title={isRec ? 'Arrêter' : isTr ? 'Transcription...' : isBusy ? 'Autre enregistrement en cours' : 'Enregistrer'}
      >
        {isTr ? (
          <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: '#fff', borderRadius: '50%', animation: 'loaderSpin 0.8s linear infinite' }} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {isRec ? (<><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></>) : (
              <><rect x="9" y="1" width="6" height="12" rx="3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>
            )}
          </svg>
        )}
      </button>
    );
  };

  const autoGrow = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(100, el.scrollHeight) + 'px'; };
  const renderAnswerTextarea = (value, onChange, micId, placeholder, autoFocus) => (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={(el) => { if (autoFocus && el) inputRef.current = el; if (el) autoGrow(el); }}
        className="eod-free-input"
        value={value}
        onChange={(e) => { onChange(e.target.value); autoGrow(e.target); }}
        placeholder={placeholder || "Écrivez votre réponse..."}
        maxLength={LIMITS.ANSWER_MAX}
        rows={4}
        style={{ paddingRight: 44, minHeight: 100, resize: 'none', overflowY: 'auto' }}
      />
      <div style={{ position: 'absolute', right: 0, bottom: 8 }}>
        {renderMicBtn(micId, (text) => onChange((value ? value + ' ' : '') + text))}
      </div>
    </div>
  );

  // ── LOADING (show text only after 3s) ──────────────────────────────────────
  const [showLoadingText, setShowLoadingText] = useState(false);

  // ── WELCOME TYPING ─────────────────────────────────────────────────────────
  const welcomeMsg = "COMMENT S'EST PASS\u00c9E VOTRE JOURN\u00c9E ?";
  // Accent map: accented char → { base, accent }
  const ACCENT_MAP = { 'É': { base: 'E', mark: '\u0301' }, 'È': { base: 'E', mark: '\u0300' }, 'Ê': { base: 'E', mark: '\u0302' }, 'À': { base: 'A', mark: '\u0300' }, 'Ù': { base: 'U', mark: '\u0300' }, 'Ô': { base: 'O', mark: '\u0302' } };
  const [welcomeTyped, setWelcomeTyped] = useState('');
  const [welcomeDone, setWelcomeDone] = useState(false);
  const welcomeRef = useRef(null);
  useEffect(() => {
    if (loading || todayReport || submitted) return;
    // Delay start to sync with page fade-in
    const delay = setTimeout(() => {
      let i = 0;
      welcomeRef.current = setInterval(() => {
        i++;
        setWelcomeTyped(welcomeMsg.slice(0, i));
        if (i >= welcomeMsg.length) { clearInterval(welcomeRef.current); setWelcomeDone(true); }
      }, 40);
    }, 1600); // start after page fade-in
    return () => { clearTimeout(delay); if (welcomeRef.current) clearInterval(welcomeRef.current); };
  }, [loading, todayReport, submitted]);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setShowLoadingText(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#13141b' }}>
      {showLoadingText && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: '#5e6273' }}>Chargement...</p></div>}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", paddingTop: 80, animation: 'eodPageIn 1.8s cubic-bezier(0.16,1,0.3,1) both' }}>
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} hideDarkToggle />

      <style>{`
        @font-face { font-family: 'Minecraft'; src: url('${minecraftFontUrl}') format('truetype'); font-weight: normal; font-style: normal; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes undertaleWave { 0%, 100% { transform: translateY(0); } 25% { transform: translateY(-3px); } 50% { transform: translateY(0); } 75% { transform: translateY(2px); } }
        @keyframes compactIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes compactOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-30px); max-height: 0; padding: 0; margin: 0; } }
        @keyframes subtaskReveal { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gentlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes loaderSpin { to { transform: rotate(360deg); } }
        @keyframes eodPageIn { 0% { opacity: 0; transform: scale(0.97) translateY(20px); } 30% { opacity: 0; transform: scale(0.97) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        #eod-board-frame.board-frame { background: linear-gradient(180deg, rgba(91,106,191,0.20) 0%, #ffffff 80%) !important; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important; }
        body.dark-mode #eod-board-frame.board-frame { background: linear-gradient(180deg, rgba(124,138,219,0.25) 0%, #1e1f28 80%) !important; }
        .eod-free-input { width: 100%; border: none; border-bottom: 2px solid ${C.border}; background: transparent; font-size: 17px; line-height: 1.8; padding: 8px 0; color: ${C.text}; font-family: inherit; outline: none; resize: none; transition: border-color 0.3s ease; box-sizing: border-box; }
        .eod-free-input:focus { border-bottom-color: ${C.accent}; }
        .eod-free-input::placeholder { color: ${C.muted}; font-style: italic; }
      `}</style>

      {/* ── OUTER WRAPPER ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '32px auto 64px', padding: '18px', background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)', borderRadius: '32px', animation: 'eodPageIn 1.8s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div id="eod-board-frame" className="board-frame" style={{ margin: 0, paddingTop: 24 }}>

          {/* ── HEADER ────────────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>End of Day</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
              {submitted ? 'Rapport soumis' : todayReport ? 'Déjà soumis aujourd\'hui' : step === 1 ? 'Faisons connaissance' : `Étape ${step === 0 ? 1 : step <= 1 ? 1 : step - 1} / 4`}
            </p>
            {!todayReport && !submitted && (
              <p style={{ fontSize: 16, fontWeight: 400, color: C.accent, margin: '24px 0 20px', minHeight: 32, visibility: welcomeTyped ? 'visible' : 'hidden', fontFamily: "'Minecraft', monospace", letterSpacing: '1px', WebkitFontSmoothing: 'none' }}>
                {(() => {
                  const text = welcomeTyped || '\u00A0';
                  const renderChar = (c, key, wave, waveIdx) => {
                    const acc = ACCENT_MAP[c];
                    const waveStyle = wave ? { display: 'inline-block', animation: `undertaleWave 2s ease-in-out ${waveIdx * 0.08}s infinite` } : { display: 'inline-block' };
                    if (acc) return (
                      <span key={key} style={{ ...waveStyle, position: 'relative' }}>
                        {acc.base}
                        <span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%) scaleX(1.3)', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 900, lineHeight: 1 }}>{acc.mark}</span>
                      </span>
                    );
                    if (c === ' ') return <span key={key} style={{ ...waveStyle, whiteSpace: 'pre' }}>{c}</span>;
                    return <span key={key} style={waveStyle}>{c}</span>;
                  };
                  const idx = text.indexOf("JOURN");
                  if (idx === -1 || !welcomeDone) {
                    return <>{text.split('').map((c, i) => renderChar(c, i, false, 0))}<span style={{ opacity: welcomeTyped && !welcomeDone ? 1 : 0, animation: 'blink 1s infinite', transition: 'opacity 0.5s ease' }}>|</span></>;
                  }
                  const before = text.slice(0, idx);
                  const wavePart = text.slice(idx);
                  return <>{before.split('').map((c, i) => renderChar(c, i, false, 0))}{wavePart.split('').map((c, i) => renderChar(c, `w${i}`, true, i))}</>;
                })()}
              </p>
            )}
          </div>

          {/* ── J-1 BANNER ────────────────────────────────────────────────── */}
          {eodStatus?.yesterday && !todayReport && !submitted && (() => {
            const y = eodStatus.yesterday;
            const isPast = y.deadline ? new Date() >= new Date(y.deadline) : false;
            const fDate = y.date ? new Date(y.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
            if (activeDate === 'yesterday' && y.can_submit) return (
              <div style={{ maxWidth: 560, margin: '0 auto 16px', padding: '14px 20px', borderRadius: 16, borderLeft: `4px solid ${C.accent}`, background: darkMode ? 'rgba(91,106,191,0.10)' : 'rgba(91,106,191,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: C.text }}>
                <span>Vous complétez l'EOD du <strong>{fDate}</strong></span>
                <button onClick={() => setActiveDate('today')} style={{ padding: '6px 14px', borderRadius: 50, border: `1px solid ${C.border}`, background: C.subtle, color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Revenir à aujourd'hui</button>
              </div>
            );
            if (!y.submitted && y.is_working_day && y.can_submit && !isPast && activeDate === 'today') return (
              <div style={{ maxWidth: 560, margin: '0 auto 16px', padding: '14px 20px', borderRadius: 16, borderLeft: `4px solid ${C.accent}`, background: darkMode ? 'rgba(124,138,219,0.10)' : 'rgba(91,106,191,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: C.text }}>
                <span>Vous n'avez pas soumis votre EOD du <strong>{fDate}</strong>. Vous avez jusqu'à 12h00.</span>
                <button onClick={() => setActiveDate('yesterday')} style={{ padding: '6px 14px', borderRadius: 50, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Compléter</button>
              </div>
            );
            if (!y.submitted && y.is_working_day && isPast) return (
              <div style={{ maxWidth: 560, margin: '0 auto 16px', padding: '14px 20px', borderRadius: 16, borderLeft: `4px solid ${C.muted}`, background: darkMode ? 'rgba(100,116,139,0.10)' : 'rgba(100,116,139,0.06)', fontSize: 13, color: C.muted }}>
                L'EOD du <strong style={{ color: C.secondary }}>{fDate}</strong> n'a pas été soumis. Le délai est dépassé.
              </div>
            );
            return null;
          })()}

          {/* ── ALREADY SUBMITTED ──────────────────────────────────────────── */}
          {(todayReport || submitted) && (
            <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: `2px solid ${C.accent}30` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Rapport soumis</h2>
              <p style={{ fontSize: 14, color: C.muted }}>Votre End of Day a bien été enregistré. À demain !</p>
            </div>
          )}

          {/* ── MAIN FLOW (not submitted) ──────────────────────────────────── */}
          {!todayReport && !submitted && (
            <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 20px 40px', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>

              {/* ═══════ STEP 0: PROJECTS & MISSIONS ═══════ */}
              {step === 0 && (
                <>
                  <div style={{ height: 30, marginBottom: 6 }} />

                  {/* Mode toggle: Projet / Tâche */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', width: 'fit-content', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)' }}>
                    {[{ key: 'project', label: 'Projet' }, { key: 'task', label: 'Tâche' }].map(m => {
                      const isActive = composerMode === m.key;
                      return (
                      <button key={m.key} onClick={() => { setComposerMode(m.key); if (m.key === 'task') setSelectedProjectId(null); }}
                        style={{
                          padding: '9px 22px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
                          background: isActive ? `linear-gradient(180deg, ${C.accent}dd 0%, ${C.accent} 100%)` : 'transparent',
                          color: isActive ? '#fff' : C.muted,
                          boxShadow: isActive ? `inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 2px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.2)` : 'none',
                          borderTop: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                          textShadow: isActive ? '0 1px 1px rgba(0,0,0,0.15)' : 'none',
                        }}>
                        {m.label}
                      </button>);
                    })}
                  </div>

                  {/* Existing projects as pills (only in project mode) */}
                  {composerMode === 'project' && projects.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                      {projects.map(p => {
                        const isSel = selectedProjectId === p.id;
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 50, border: `1px solid ${isSel ? C.accent : C.border}`, background: isSel ? C.accent+'12' : 'transparent', transition: 'all 0.15s', overflow: 'hidden' }}>
                            <button onClick={() => { setSelectedProjectId(p.id); setNewTaskName(p.name); }} style={{ padding: '6px 14px', border: 'none', background: 'transparent', color: isSel ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{p.name}</button>
                            <button onClick={async (e) => { e.stopPropagation(); try { await apiClient.delete(`/api/v1/eod/projects/${p.id}`); setProjects(prev => prev.filter(pp => pp.id !== p.id)); if (selectedProjectId === p.id) setSelectedProjectId(null); } catch(err) { console.warn('Delete project failed:', err); } }}
                              style={{ padding: '4px 8px 4px 0', border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = C.muted}
                              title="Supprimer le projet"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Saved tasks (compact cards) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    {tasks.map(task => {
                      const totalH = task.subtasks.reduce((s, st) => s + (st.hours_spent || 0), 0);
                      return (
                        <div key={task._id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 560, padding: '12px 16px',
                          background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', borderRadius: 50,
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          animation: removingTaskId === task._id ? 'compactOut 0.35s cubic-bezier(0.4,0,0.2,1) both' : 'compactIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: task.project_id ? `${C.accent}15` : (darkMode ? 'rgba(251,146,60,0.15)' : 'rgba(251,146,60,0.12)'), color: task.project_id ? C.accent : '#fb923c', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                            {task.project_id ? 'Projet' : 'Tâche'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.task_name}</div>
                            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{task.project_id ? `+${task.subtasks.length} mission${task.subtasks.length > 1 ? 's' : ''}` : `+${task.subtasks.length} sous-tâche${task.subtasks.length > 1 ? 's' : ''}`}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{totalH.toFixed(1)}h</span>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={() => editTask(task)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={(e) => e.currentTarget.style.color = C.accent} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                            <button onClick={() => deleteTask(task._id)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14H7L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Task composer (pill input + subtasks) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 560 }}>
                      {/* Main input */}
                      <div style={{
                        display: 'flex', alignItems: 'center', width: '100%',
                        background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)',
                        borderRadius: newTaskName.trim() ? '20px 20px 0 0' : '50px',
                        padding: '6px 6px 6px 22px',
                        border: `1px solid ${newTaskName.trim() ? (darkMode ? 'rgba(124,138,219,0.3)' : 'rgba(91,106,191,0.25)') : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)')}`,
                        borderBottom: newTaskName.trim() ? 'none' : undefined,
                        transition: 'border-radius 0.35s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease',
                      }}>
                        <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder={composerMode === 'project' ? (tasks.length > 0 ? "Projet suivant..." : "Nom du projet") : (tasks.length > 0 ? "Tâche suivante..." : "Titre de la tâche")} maxLength={LIMITS.TASK_NAME_MAX} disabled={tasks.length >= LIMITS.MAX_TASKS}
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, fontWeight: 500, color: C.text, fontFamily: 'inherit' }} />
                        {renderMicBtn('task-name', (text) => setNewTaskName(prev => (prev ? prev + ' ' : '') + text))}
                        <button type="button" onClick={() => { if (newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0) saveComposerToTasks(); }}
                          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: newTaskName.trim() ? C.accent : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), color: newTaskName.trim() ? '#fff' : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newTaskName.trim() ? 'pointer' : 'default', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        </button>
                      </div>

                      {/* Subtasks panel */}
                      <div style={{ overflow: 'hidden', maxHeight: newTaskName.trim() ? `${newSubtasks.length * 52 + 16}px` : '0px', opacity: newTaskName.trim() ? 1 : 0, transition: 'max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease 0.05s' }}>
                        <div style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.018)', borderRadius: '0 0 20px 20px', border: `1px solid ${darkMode ? 'rgba(124,138,219,0.3)' : 'rgba(91,106,191,0.25)'}`, borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`, padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {newSubtasks.map((sub, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, animation: idx > 0 ? `subtaskReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) ${idx * 40}ms both` : undefined }}>
                              <input type="text" value={sub.name} onChange={(e) => updateNewSubtask(idx, 'name', e.target.value)} placeholder={composerMode === 'project' ? (idx === 0 ? "Mission" : "Mission suivante...") : (idx === 0 ? "Sous-tâche" : "Sous-tâche suivante...")} maxLength={LIMITS.TASK_NAME_MAX}
                                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.text, padding: '6px 0', fontFamily: 'inherit' }} />
                              {renderMicBtn(`sub-${idx}`, (text) => updateNewSubtask(idx, 'name', (sub.name ? sub.name + ' ' : '') + text))}
                              <input type="text" inputMode="decimal" value={sub.hours} onChange={(e) => updateNewSubtask(idx, 'hours', e.target.value)} placeholder="h" style={{ width: 40, border: 'none', borderBottom: `1px solid ${C.border}`, background: 'transparent', outline: 'none', fontSize: 13, color: C.accent, fontWeight: 600, textAlign: 'center', padding: '4px 0', fontFamily: 'inherit' }} />
                              {idx > 0 && (
                                <button onClick={() => removeNewSubtask(idx)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14H7L5 6" /></svg>
                                </button>
                              )}
                              {idx === 0 && newSubtasks.length === 1 && sub.name.trim() && (
                                <button onClick={() => setNewSubtasks(prev => [...prev, { name: '', hours: '' }])} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = `${C.accent}15`; }} onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* "{composerMode === 'project' ? 'Ajouter un projet' : 'Ajouter une tâche'}" button */}
                      {(() => {
                        const canAdd = newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0;
                        return (
                          <div style={{ overflow: 'hidden', maxHeight: canAdd ? 56 : 0, opacity: canAdd ? 1 : 0, transition: 'max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease 0.08s', marginTop: canAdd ? 12 : 0, display: 'flex', justifyContent: 'center' }}>
                            <button onClick={() => saveComposerToTasks()} style={{ padding: '10px 28px', borderRadius: 50, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', color: C.muted, fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = `${C.accent}10`; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}>
                              {composerMode === 'project' ? 'Ajouter un projet' : 'Ajouter une tâche'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Next step button */}
                  {(() => {
                    const canProceed = tasks.length > 0 || (newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0);
                    return (
                      <div style={{ overflow: 'hidden', maxHeight: canProceed ? 80 : 0, opacity: canProceed ? 1 : 0, transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease 0.1s', marginTop: canProceed ? 28 : 0, display: 'flex', justifyContent: 'center', padding: canProceed ? '6px 0 16px' : 0 }}>
                        <button onClick={handleNextStep} style={{ padding: '13px 36px', background: 'transparent', color: C.accent, border: `1.5px solid ${darkMode ? 'rgba(124,138,219,0.35)' : 'rgba(91,106,191,0.3)'}`, borderRadius: 50, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}12`; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${C.accent}25`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = darkMode ? 'rgba(124,138,219,0.35)' : 'rgba(91,106,191,0.3)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                          Passer à l'étape suivante
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ═══════ STEP 1: AI QUESTION START ═══════ */}
              {/* ═══════ STEP 1: ONBOARDING ═══════ */}
              {step === 1 && (
                <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${C.accent}15`, border: `2px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Faisons connaissance</h2>
                    <p style={{ fontSize: 13, color: C.muted }}>Question {onboardingIndex + 1} / {ONBOARDING_QUESTIONS.length}</p>
                  </div>

                  {onboardingAnswers.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      {onboardingAnswers.map((a, i) => (
                        <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>{a.question}</p>
                          <p style={{ fontSize: 14, color: C.secondary, margin: 0, fontStyle: 'italic' }}>{a.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16, lineHeight: 1.4 }}>
                    {ONBOARDING_QUESTIONS[onboardingIndex]}
                  </h3>
                  {renderAnswerTextarea(onboardingCurrent, setOnboardingCurrent, 'onboarding', 'Votre réponse...', true)}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, opacity: onboardingCurrent.trim() ? 1 : 0, transform: onboardingCurrent.trim() ? 'none' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                    <button onClick={handleOnboardingNext} disabled={onboardingSending} style={{ padding: '10px 28px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      {onboardingSending ? 'Envoi...' : onboardingIndex < ONBOARDING_QUESTIONS.length - 1 ? 'Suivant' : 'Terminer'}
                    </button>
                  </div>
                </div>
              )}

              {/* ═══════ STEP 2: AI QUESTION START ═══════ */}
              {step === 2 && aiQuestionStart && (
                <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 500 }}>Question personnalisée</div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.4, minHeight: 30 }}>
                    {typedText}<span style={{ opacity: !typingDone ? 1 : 0, animation: 'blink 1s infinite', transition: 'opacity 0.3s ease' }}>|</span>
                  </h2>
                  <div style={{ opacity: typingDone ? 1 : 0, transform: typingDone ? 'none' : 'translateY(12px)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: typingDone ? 'auto' : 'none' }}>
                    {renderAnswerTextarea(aiStartAnswer, setAiStartAnswer, 'ai-start', null, true)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                      <button onClick={() => setStep(0)} style={{ padding: '10px 20px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
                      <div style={{ opacity: aiStartAnswer.trim() ? 1 : 0, transform: aiStartAnswer.trim() ? 'none' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                        <button onClick={handleNextStep} style={{ padding: '10px 28px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Suivant</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════ STEP 2: BANK QUESTIONS ═══════ */}
              {step === 3 && bankQuestions.length > 0 && (
                <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 500 }}>Question {bankIndex + 1} / {bankQuestions.length}</div>

                  {/* Previous bank answers */}
                  {bankAnswers.length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                      {bankAnswers.map((ba, i) => (
                        <div key={i} onClick={() => { setBankAnswers(bankAnswers.slice(0, i)); setBankIndex(i); setCurrentBankAnswer(ba.answer); }} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}`, cursor: 'pointer', borderRadius: 8, padding: '12px 14px 20px', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 6px', fontWeight: 500 }}>{ba.question}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <p style={{ fontSize: 16, color: C.secondary, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>{ba.answer}</p>
                            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0, marginTop: 4 }}>Modifier</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.4, minHeight: 30 }}>
                    {typedText}<span style={{ opacity: !typingDone ? 1 : 0, animation: 'blink 1s infinite', transition: 'opacity 0.3s ease' }}>|</span>
                  </h2>
                  <div style={{ opacity: typingDone ? 1 : 0, transform: typingDone ? 'none' : 'translateY(12px)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: typingDone ? 'auto' : 'none' }}>
                    {renderAnswerTextarea(currentBankAnswer, setCurrentBankAnswer, `bank-${bankIndex}`, null, true)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                      {bankIndex > 0 ? (
                        <button onClick={() => { const prev = bankAnswers[bankAnswers.length - 1]; setBankAnswers(bankAnswers.slice(0, -1)); setBankIndex(bankIndex - 1); setCurrentBankAnswer(prev?.answer || ''); }} style={{ padding: '10px 20px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Précédent</button>
                      ) : (
                        <button onClick={() => { if (aiQuestionStart) setStep(2); else setStep(0); }} style={{ padding: '10px 20px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
                      )}
                      <div style={{ opacity: currentBankAnswer.trim() ? 1 : 0, transform: currentBankAnswer.trim() ? 'none' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                        <button onClick={handleBankNext} style={{ padding: '10px 28px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                          {bankIndex < bankQuestions.length - 1 ? 'Suivant' : 'Continuer'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════ STEP 3: AI QUESTION END (REFLECTION) ═══════ */}
              {step === 4 && (
                <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                  {generatingReflection ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'loaderSpin 0.8s linear infinite', margin: '0 auto 20px' }} />
                      <p style={{ fontSize: 15, color: C.text, fontWeight: 500 }}>Génie a encore une question pour toi, patientez...</p>
                      <p style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Analyse de vos réponses en cours</p>
                    </div>
                  ) : aiQuestionEnd ? (
                    <>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 500 }}>Question de réflexion</div>
                      <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.4, minHeight: 30 }}>
                        {typedText}<span style={{ opacity: !typingDone ? 1 : 0, animation: 'blink 1s infinite', transition: 'opacity 0.3s ease' }}>|</span>
                      </h2>
                      <div style={{ opacity: typingDone ? 1 : 0, transform: typingDone ? 'none' : 'translateY(12px)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: typingDone ? 'auto' : 'none' }}>
                        {renderAnswerTextarea(aiEndAnswer, setAiEndAnswer, 'ai-end', null, true)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                          <button onClick={() => { setStep(3); setBankIndex(bankQuestions.length - 1); setCurrentBankAnswer(bankAnswers[bankAnswers.length - 1]?.answer || ''); setBankAnswers(bankAnswers.slice(0, -1)); }} style={{ padding: '10px 20px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
                          <div style={{ opacity: aiEndAnswer.trim() ? 1 : 0, transform: aiEndAnswer.trim() ? 'none' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                            <button onClick={handleSubmit} disabled={submitting} style={{ padding: '12px 32px', background: submitting ? C.muted : C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                              {submitting ? 'Envoi...' : 'Soumettre le rapport'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>

    </>
  );
}
