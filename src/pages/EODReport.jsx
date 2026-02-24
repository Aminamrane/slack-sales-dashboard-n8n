// src/pages/EODReport.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";
import "../index.css";

const STATUS = { success: "#10b981", danger: "#ef4444" };

// Security limits
const LIMITS = {
  TASK_NAME_MAX: 300,
  ANSWER_MAX: 3000,
  MAX_TASKS: 20,
  MAX_SUBTASKS: 15,
  HOURS_MIN: 0,
  HOURS_MAX: 24,
  SUBMIT_COOLDOWN_MS: 3000,
  MAX_PAYLOAD_BYTES: 50000,
};

// Sanitize text: strip HTML tags, dangerous URIs, event handlers
function sanitizeText(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

// Sanitize hours: clamp [0, 24], round to 0.5
function sanitizeHours(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(LIMITS.HOURS_MIN, Math.min(LIMITS.HOURS_MAX, n));
  return Math.round(clamped * 2) / 2;
}

// Question pools - rotation hebdomadaire
const QUESTION_POOLS = {
  A: {
    q1: "Qu'est-ce qui t'a le plus marqué dans ta journée ?",
    q2: "Comment décrirais-tu le rythme de ta journée ?",
    q3: "Avec qui as-tu collaboré aujourd'hui et sur quoi ?",
  },
  B: {
    q1: "Qu'est-ce qui t'a donné de l'énergie ? Et pris ?",
    q2: "As-tu eu des moments de vraie concentration ?",
    q3: "Un échange qui t'a aidé ou fait plaisir ?",
  },
  C: {
    q1: "Qu'as-tu appris que tu ne savais pas hier ?",
    q2: "Quelque chose t'a ralenti ou tu aurais fait différemment ?",
    q3: "De qui aurais-tu eu besoin aujourd'hui ?",
  },
};

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getTodayQuestions() {
  const now = new Date();
  const week = getWeekNumber(now);
  const poolIndex = ((week - 1) % 3);
  const poolKey = ["A", "B", "C"][poolIndex];
  const pool = QUESTION_POOLS[poolKey];

  return { questions: [pool.q1, pool.q2, pool.q3], poolKey };
}

export default function EODReport() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const C = {
    bg: darkMode ? '#1e1f28' : '#ffffff',
    border: darkMode ? '#2a2b36' : '#e2e6ef',
    surface: darkMode ? '#13141b' : '#edf0f8',
    text: darkMode ? '#eef0f6' : '#1e2330',
    muted: darkMode ? '#5e6273' : '#9ca3af',
    subtle: darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent: darkMode ? '#7c8adb' : '#5b6abf',
    shadow: darkMode
      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  // Sync dark-mode class on body & html (needed for CSS rules like body.dark-mode .board-frame)
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // Form state
  const [step, setStep] = useState(0); // 0: tasks, 1: questions
  const [tasks, setTasks] = useState([]);
  const [removingTaskId, setRemovingTaskId] = useState(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newSubtasks, setNewSubtasks] = useState([{ name: "", hours: "" }]);
  const [todayReport, setTodayReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 0 typing animation
  const [typedText, setTypedText] = useState("");
  const fullText = "Quelles tâches avez-vous effectuées aujourd'hui ?";

  // Step 2: Questions flow
  const { questions: poolQuestions, poolKey } = getTodayQuestions();
  const [customQuestion, setCustomQuestion] = useState(null); // { id, question } or null
  const todayQuestions = useMemo(() => {
    const qs = [...poolQuestions];
    // Only add custom question if it's not a duplicate of a pool question
    if (customQuestion && !poolQuestions.includes(customQuestion.question)) {
      qs.push(customQuestion.question);
    }
    return qs;
  }, [poolQuestions, customQuestion]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionTypedText, setQuestionTypedText] = useState("");
  const [questionTypingDone, setQuestionTypingDone] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [allQuestionsDone, setAllQuestionsDone] = useState(false);
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const inputRef = useRef(null);
  const lastSubmitRef = useRef(0);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await apiClient.getMe();
        setSession(user);

        const access = await apiClient.hasAccess("eod_reports");
        setHasAccess(access);

        if (!access) {
          navigate("/");
          return;
        }

        await loadTodayReport();
        // Fetch personalized question from OpenClaw (via backend)
        // GET /eod/my-question is now idempotent (backend filters on answered=false,
        // marks served+answered only on POST /eod/submit). No client-side cache needed.
        try {
          const qResp = await apiClient.get("/api/v1/eod/my-question");
          if (qResp?.question) {
            setCustomQuestion({ id: qResp.id, question: qResp.question });
          }
        } catch (_) { /* No custom question available */ }
        setTimeout(() => setFadeIn(true), 50);
      } catch (error) {
        console.error("Auth error:", error);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  // Step 0: Typing animation
  useEffect(() => {
    if (!fadeIn || step !== 0) return;

    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [fadeIn, step]);

  // Step 1: Question typing animation
  useEffect(() => {
    if (step !== 1 || allQuestionsDone) return;

    const question = todayQuestions[questionIndex];
    if (!question) return;

    setQuestionTypedText("");
    setQuestionTypingDone(false);
    setCurrentAnswer("");

    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= question.length) {
        setQuestionTypedText(question.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setQuestionTypingDone(true);
      }
    }, 18);

    return () => clearInterval(typingInterval);
  }, [step, questionIndex, allQuestionsDone]);

  // Auto-focus input when typing is done
  useEffect(() => {
    if (questionTypingDone && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [questionTypingDone]);

  const loadTodayReport = async () => {
    try {
      const resp = await apiClient.get("/api/v1/eod/today");
      if (resp.exists && resp.report) {
        setTodayReport(resp.report);
        setTasks(resp.report.tasks || []);
      }
    } catch (error) {
      console.error("Error loading today's report:", error);
    }
  };

  const addMainTask = (name = "") => {
    if (tasks.length >= LIMITS.MAX_TASKS) return;
    setTasks([
      ...tasks,
      {
        _id: Date.now(),
        task_name: name,
        subtasks: [{ _id: Date.now() + 1, task_name: "", hours_spent: 0 }],
      },
    ]);
  };

  const updateNewSubtask = (index, field, value) => {
    setNewSubtasks(prev => {
      const updated = prev.map((s, i) => i === index ? { ...s, [field]: value } : s);
      // If last subtask now has content, add a new empty row
      const last = updated[updated.length - 1];
      if (last.name.trim() && updated.length < LIMITS.MAX_SUBTASKS) {
        updated.push({ name: "", hours: "" });
      }
      return updated;
    });
  };

  const removeNewSubtask = (index) => {
    setNewSubtasks(prev => {
      if (prev.length <= 1 || index === 0) return prev; // never remove the first
      return prev.filter((_, i) => i !== index);
    });
  };

  // Save current composer content to tasks array. Returns true if saved.
  const saveComposerToTasks = () => {
    const trimmed = newTaskName.trim();
    if (!trimmed || tasks.length >= LIMITS.MAX_TASKS) return false;
    const first = newSubtasks[0];
    if (!first || !first.name.trim()) return false;
    const firstHours = parseFloat(first.hours);
    if (!firstHours || firstHours <= 0) return false;
    const subtasks = newSubtasks
      .filter(s => s.name.trim())
      .map((s, i) => ({
        _id: Date.now() + i + 1,
        task_name: s.name.trim(),
        hours_spent: Math.min(Math.max(parseFloat(s.hours) || 0, 0), 24),
      }));
    setTasks(prev => [...prev, { _id: Date.now(), task_name: trimmed, subtasks }]);
    setNewTaskName("");
    setNewSubtasks([{ name: "", hours: "" }]);
    return true;
  };

  // "Ajouter une tâche" pill clicked — save current task, composer resets for next
  const handleStartNewTask = () => {
    saveComposerToTasks();
  };

  // Arrow on compact card — edit that task (load into composer)
  const editTask = (taskId) => {
    // Save current composer if it has valid content
    if (newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0) {
      saveComposerToTasks();
    }
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;
    setNewTaskName(task.task_name);
    setNewSubtasks(
      task.subtasks.length > 0
        ? task.subtasks.map(s => ({ name: s.task_name, hours: String(s.hours_spent) }))
        : [{ name: "", hours: "" }]
    );
    setTasks(prev => prev.filter(t => t._id !== taskId));
  };

  // Delete a compact card with exit animation
  const deleteTask = (taskId) => {
    setRemovingTaskId(taskId);
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
      setRemovingTaskId(null);
    }, 350);
  };

  // Arrow button in composer — save and reset
  const handleAddTaskFromInput = () => {
    saveComposerToTasks();
  };

  const updateMainTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index][field] = value;
    setTasks(newTasks);
  };

  const removeMainTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const addSubtask = (mainTaskIndex) => {
    const newTasks = [...tasks];
    if (!newTasks[mainTaskIndex].subtasks) {
      newTasks[mainTaskIndex].subtasks = [];
    }
    if (newTasks[mainTaskIndex].subtasks.length >= LIMITS.MAX_SUBTASKS) return;
    newTasks[mainTaskIndex].subtasks.push({
      _id: Date.now(),
      task_name: "",
      hours_spent: 0,
    });
    setTasks(newTasks);
  };

  const updateSubtask = (mainTaskIndex, subtaskIndex, field, value) => {
    const newTasks = [...tasks];
    newTasks[mainTaskIndex].subtasks[subtaskIndex][field] = value;
    setTasks(newTasks);
  };

  const removeSubtask = (mainTaskIndex, subtaskIndex) => {
    const newTasks = [...tasks];
    newTasks[mainTaskIndex].subtasks = newTasks[mainTaskIndex].subtasks.filter(
      (_, i) => i !== subtaskIndex
    );
    setTasks(newTasks);
  };

  const calculateTotalHours = () => {
    return tasks.reduce((total, task) => {
      const subHours = (task.subtasks || []).reduce(
        (sub, subtask) => sub + (parseFloat(subtask.hours_spent) || 0),
        0
      );
      return total + subHours;
    }, 0);
  };

  const handleNext = () => {
    if (step === 0) {
      // Auto-save composer if it has valid content
      if (newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0) {
        saveComposerToTasks();
      }
      // Use callback to check tasks after state update
      setTimeout(() => {}, 0);
    }

    // Validate (tasks may have just been updated by saveComposerToTasks)
    setTasks(prev => {
      if (step === 0) {
        if (prev.length === 0) {
          alert("Veuillez ajouter au moins une tâche.");
          return prev;
        }
        const invalidTasks = prev.filter(
          (t) => !t.task_name.trim() || !sanitizeText(t.task_name.trim()) || !t.subtasks || t.subtasks.length === 0 || !t.subtasks.some((st) => st.task_name.trim() && sanitizeText(st.task_name.trim()))
        );
        if (invalidTasks.length > 0) {
          alert("Chaque tâche doit avoir un nom valide et au moins une sous-tâche.");
          return prev;
        }
        const totalHours = prev.reduce((total, task) => {
          return total + (task.subtasks || []).reduce((sub, st) => sub + (parseFloat(st.hours_spent) || 0), 0);
        }, 0);
        if (totalHours > 24) {
          alert("Le total des heures ne peut pas dépasser 24h par jour.");
          return prev;
        }
        setStep(1);
      } else {
        setStep(s => s + 1);
      }
      return prev;
    });
  };

  const handleSendAnswer = useCallback(async () => {
    if (!currentAnswer.trim() || sendingAnswer) return;

    setSendingAnswer(true);

    // If all questions already answered (retry after failed submit), don't add again
    const allAnswered = questionAnswers.length >= todayQuestions.length;
    const newAnswers = allAnswered
      ? questionAnswers
      : [...questionAnswers, {
          question: todayQuestions[questionIndex],
          answer: currentAnswer.trim(),
        }];
    if (!allAnswered) setQuestionAnswers(newAnswers);

    // Small delay for smooth transition
    await new Promise((r) => setTimeout(r, 300));
    setSendingAnswer(false);

    if (!allAnswered && questionIndex + 1 < todayQuestions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      // All questions done — submit entire EOD
      const success = await handleFinalSubmit(newAnswers);
      if (success) {
        setAllQuestionsDone(true);
      }
    }
  }, [currentAnswer, sendingAnswer, questionIndex, todayQuestions, questionAnswers]);

  const handleFinalSubmit = async (answers) => {
    // Rate limiting
    const now = Date.now();
    if (now - lastSubmitRef.current < LIMITS.SUBMIT_COOLDOWN_MS) return false;
    lastSubmitRef.current = now;

    setSubmitting(true);
    try {
      const cleanTasks = tasks
        .filter((t) => t.task_name.trim())
        .map((t) => ({
          task_name: sanitizeText(t.task_name.trim()).slice(0, LIMITS.TASK_NAME_MAX),
          hours_spent: 0,
          subtasks: (t.subtasks || [])
            .filter((st) => st.task_name.trim())
            .map((st) => ({
              task_name: sanitizeText(st.task_name.trim()).slice(0, LIMITS.TASK_NAME_MAX),
              hours_spent: sanitizeHours(st.hours_spent),
            })),
        }));

      const reportDate = new Date().toISOString().split("T")[0];

      // Separate pool answers from custom answer by index (not text, to avoid duplicates)
      const poolCount = poolQuestions.length;
      const poolAnswers = answers.slice(0, poolCount).map((a) => ({
        question: sanitizeText(a.question).slice(0, LIMITS.ANSWER_MAX),
        answer: sanitizeText(a.answer).slice(0, LIMITS.ANSWER_MAX),
      }));
      const customAnswerEntry = customQuestion && answers.length > poolCount
        ? answers[poolCount]
        : null;
      // Only include custom_answer if the answer is non-empty after sanitization
      const sanitizedCustomAnswer = customAnswerEntry && customQuestion
        ? sanitizeText(customAnswerEntry.answer).slice(0, LIMITS.ANSWER_MAX).trim()
        : "";

      const payload = {
        report_date: reportDate,
        pool_key: poolKey,
        question_answers: poolAnswers,
        tasks: cleanTasks,
        ...(sanitizedCustomAnswer && {
          custom_answer: {
            question_id: customQuestion.id,
            question: sanitizeText(customQuestion.question).slice(0, LIMITS.ANSWER_MAX),
            answer: sanitizedCustomAnswer,
          },
        }),
      };

      // Payload size guard
      if (JSON.stringify(payload).length > LIMITS.MAX_PAYLOAD_BYTES) {
        alert("Le contenu est trop volumineux. Veuillez raccourcir vos réponses.");
        return false;
      }

      // 1. Send to backend (blocking — must succeed)
      await apiClient.post("/api/v1/eod/submit", payload);

      // 2. Send to OpenClaw (fire-and-forget — don't block the user)
      const openclawUrl = import.meta.env.VITE_OPENCLAW_WEBHOOK_URL;
      if (openclawUrl) {
        const user = apiClient.getUser();
        const totalHours = cleanTasks.reduce((sum, t) =>
          sum + (t.subtasks || []).reduce((s, st) => s + (st.hours_spent || 0), 0), 0);

        fetch(openclawUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": import.meta.env.VITE_OPENCLAW_API_KEY || "",
          },
          body: JSON.stringify({
            event: "eod_submitted",
            timestamp: new Date().toISOString(),
            user: {
              id: user?.id,
              name: user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
              email: user?.email,
              role: user?.role,
              department: ({ admin: "tech", hr: "rh", finance_director: "finance", finance_team: "finance" }[user?.department || user?.role]) || user?.department || user?.role,
            },
            eod: {
              report_date: reportDate,
              pool_key: poolKey,
              tasks: cleanTasks,
              question_answers: answers,
              total_hours: totalHours,
            },
          }),
        }).catch((err) => console.warn("[OpenClaw] Send failed (non-blocking):", err));
      }

      return true;
    } catch (error) {
      console.error("Error submitting EOD:", error);
      alert("Erreur lors de la soumission de l'EOD.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Enter key in answer input
  const handleAnswerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && currentAnswer.trim()) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  if (loading) {
    return <p style={{ padding: 24 }}>Chargement...</p>;
  }

  if (!hasAccess) {
    return <p style={{ padding: 24 }}>Accès non autorisé.</p>;
  }

  return (
    <div
      style={{
        padding: 0,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        background: C.surface,
        minHeight: "100vh",
        paddingTop: 80,
        color: C.text,
      }}
    >
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{
        maxWidth: 1400,
        margin: '32px auto 64px',
        padding: '18px',
        background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)',
        borderRadius: '32px',
      }}>
      <style>{`
        #eod-board-frame.board-frame {
          background: linear-gradient(180deg, rgba(91,106,191,0.20) 0%, #ffffff 80%) !important;
        }
        body.dark-mode #eod-board-frame.board-frame {
          background: linear-gradient(180deg, rgba(124,138,219,0.25) 0%, #1e1f28 80%) !important;
        }
      `}</style>
      <div id="eod-board-frame" className="board-frame" style={{
        margin: 0,
        paddingTop: "24px",
      }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 20px",
            opacity: fadeIn ? 1 : 0,
            transform: fadeIn ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Header - Centered */}
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: C.text,
                margin: 0,
              }}
            >
              End of Day Report
            </h1>
            <p style={{ fontSize: "14px", color: C.secondary, margin: "4px 0 0 0" }}>
              Partagez votre journée de travail
            </p>
          </div>

          {/* Progress indicator (hidden, space preserved) */}
          {!todayReport && (
          <div style={{ marginBottom: "12px", visibility: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              {[0, 1].map((s) => (
                <div
                  key={s}
                  style={{
                    width: step === s ? "48px" : "12px",
                    height: "12px",
                    borderRadius: "6px",
                    background: step >= s ? C.accent : C.border,
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
          </div>
          )}

          {/* Global styles */}
          <style>
            {`
              @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
              }
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(-12px) scale(0.97);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
              @keyframes compactIn {
                from {
                  opacity: 0;
                  transform: translateY(8px);
                  max-height: 0;
                  margin-bottom: 0;
                  padding: 0 16px;
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                  max-height: 70px;
                  margin-bottom: 0;
                  padding: 12px 16px;
                }
              }
              @keyframes compactOut {
                from {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                  max-height: 70px;
                }
                to {
                  opacity: 0;
                  transform: translateX(-30px) scale(0.95);
                  max-height: 0;
                  padding-top: 0;
                  padding-bottom: 0;
                  margin-bottom: 0;
                  border-width: 0;
                }
              }
              @keyframes subtaskSlideIn {
                from {
                  opacity: 0;
                  transform: translateX(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              @keyframes fadeUp {
                from {
                  opacity: 0;
                  transform: translateY(16px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes subtaskReveal {
                from {
                  opacity: 0;
                  transform: translateY(-8px) scale(0.97);
                  max-height: 0;
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                  max-height: 50px;
                }
              }
              @keyframes gentlePulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
              .eod-free-input {
                width: 100%;
                border: none;
                border-bottom: 2px solid ${C.border};
                background: transparent;
                font-size: 17px;
                line-height: 1.8;
                padding: 8px 0;
                color: ${C.text};
                font-family: inherit;
                outline: none;
                resize: none;
                transition: border-color 0.3s ease;
              }
              .eod-free-input:focus {
                border-bottom-color: ${C.accent};
              }
              .eod-free-input::placeholder {
                color: ${C.muted};
                font-style: italic;
              }
            `}
          </style>

          {/* Form */}
          <div
            style={{
              padding: "40px 0",
            }}
          >
            {/* Already submitted today */}
            {todayReport && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  animation: "fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both",
                }}
              >
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: `${STATUS.success}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <span style={{ fontSize: "28px", color: STATUS.success }}>&#10003;</span>
                </div>
                <h2 style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: "8px",
                }}>
                  EOD déjà soumis aujourd'hui
                </h2>
                <p style={{
                  fontSize: "15px",
                  color: C.secondary,
                  margin: "0 0 24px 0",
                  lineHeight: 1.6,
                }}>
                  Vous avez déjà complété votre End of Day pour aujourd'hui.
                  <br />Revenez demain !
                </p>
              </div>
            )}

            {/* Step 0: Tasks */}
            {!todayReport && step === 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: "32px",
                    textAlign: "center",
                    minHeight: "32px",
                  }}
                >
                  {typedText}
                  <span
                    style={{
                      opacity: typedText.length < fullText.length ? 1 : 0,
                      animation: "blink 1s infinite",
                    }}
                  >
                    |
                  </span>
                </h2>

                {/* ── Compact task cards ── */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: tasks.length > 0 ? "12px" : "0" }}>
                  {tasks.map((task) => {
                    const subCount = (task.subtasks || []).length;
                    const totalH = (task.subtasks || []).reduce((s, st) => s + (parseFloat(st.hours_spent) || 0), 0);
                    return (
                      <div
                        key={task._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          maxWidth: "560px",
                          padding: "12px 16px",
                          background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                          borderRadius: "50px",
                          border: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                          animation: removingTaskId === task._id
                            ? "compactOut 0.35s cubic-bezier(0.4,0,0.2,1) both"
                            : "compactIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
                          boxSizing: "border-box",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: "6px" }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {task.task_name}
                          </div>
                          <div style={{ fontSize: "11.5px", color: C.muted, marginTop: "1px" }}>
                            +{subCount} sous-tâche{subCount > 1 ? "s" : ""}
                          </div>
                        </div>
                        <span style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: C.accent,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}>
                          {totalH.toFixed(1)}h
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => editTask(task._id)}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            border: "none",
                            background: "transparent",
                            color: C.muted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "color 0.2s, background 0.2s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = darkMode ? "rgba(124,138,219,0.12)" : "rgba(91,106,191,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(task._id)}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            border: "none",
                            background: "transparent",
                            color: C.muted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "color 0.2s, background 0.2s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = darkMode ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Active composer ── */}
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "560px" }}>
                      {/* Main pill input */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
                          borderRadius: newTaskName.trim() ? "20px 20px 0 0" : "50px",
                          padding: "6px 6px 6px 22px",
                          border: `1px solid ${newTaskName.trim()
                            ? (darkMode ? "rgba(124,138,219,0.3)" : "rgba(91,106,191,0.25)")
                            : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)")}`,
                          borderBottom: newTaskName.trim() ? "none" : undefined,
                          transition: "border-radius 0.35s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease, background 0.3s ease",
                        }}
                      >
                        <input
                          type="text"
                          placeholder={tasks.length > 0 ? "Tâche suivante..." : "Titre de la tâche"}
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTaskFromInput(); } }}
                          maxLength={LIMITS.TASK_NAME_MAX}
                          disabled={tasks.length >= LIMITS.MAX_TASKS}
                          style={{
                            flex: 1,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: "15px",
                            fontWeight: 500,
                            color: C.text,
                            fontFamily: "inherit",
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddTaskFromInput}
                          disabled={!newTaskName.trim() || tasks.length >= LIMITS.MAX_TASKS}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            border: "none",
                            background: newTaskName.trim() ? C.accent : darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            color: newTaskName.trim() ? "#fff" : C.muted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: newTaskName.trim() ? "pointer" : "default",
                            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                            transform: newTaskName.trim() ? "scale(1)" : "scale(0.92)",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
                      </div>

                      {/* Subtask rows — smooth reveal */}
                      <div
                        style={{
                          overflow: "hidden",
                          maxHeight: newTaskName.trim() ? `${newSubtasks.length * 52 + 16}px` : "0px",
                          opacity: newTaskName.trim() ? 1 : 0,
                          transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease 0.05s",
                        }}
                      >
                        <div
                          style={{
                            background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.018)",
                            borderRadius: "0 0 20px 20px",
                            border: `1px solid ${darkMode ? "rgba(124,138,219,0.3)" : "rgba(91,106,191,0.25)"}`,
                            borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}`,
                            padding: "8px 14px 10px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {newSubtasks.map((sub, idx) => {
                            const isFirst = idx === 0;
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  paddingLeft: "8px",
                                  animation: !isFirst ? `subtaskReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) both` : undefined,
                                  animationDelay: !isFirst ? `${idx * 0.04}s` : undefined,
                                }}
                              >
                                <span style={{ color: C.muted, fontSize: "13px", flexShrink: 0 }}>↳</span>
                                <input
                                  type="text"
                                  placeholder={isFirst ? "Sous-tâche" : "Sous-tâche (optionnel)"}
                                  value={sub.name}
                                  onChange={(e) => updateNewSubtask(idx, "name", e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTaskFromInput(); } }}
                                  maxLength={LIMITS.TASK_NAME_MAX}
                                  style={{
                                    flex: 1,
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    fontSize: "13.5px",
                                    color: C.secondary,
                                    fontFamily: "inherit",
                                  }}
                                />
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                    borderRadius: "8px",
                                    padding: "5px 10px",
                                    flexShrink: 0,
                                  }}
                                >
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={sub.hours}
                                    onChange={(e) => { const v = e.target.value; if (v === "" || /^\d{0,2}(\.\d{0,1})?$/.test(v)) updateNewSubtask(idx, "hours", v); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTaskFromInput(); } }}
                                    style={{
                                      width: "36px",
                                      border: "none",
                                      background: "transparent",
                                      outline: "none",
                                      fontSize: "13px",
                                      fontWeight: 600,
                                      color: C.text,
                                      fontFamily: "inherit",
                                      textAlign: "center",
                                    }}
                                  />
                                  <span style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}>h</span>
                                </div>
                                {isFirst ? (
                                  newSubtasks.length === 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => setNewSubtasks(prev => [...prev, { name: "", hours: "" }])}
                                      style={{
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "transparent",
                                        color: darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                                        opacity: 1,
                                        animation: "subtaskReveal 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = darkMode ? "rgba(124,138,219,0.12)" : "rgba(91,106,191,0.08)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.color = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"; e.currentTarget.style.background = "transparent"; }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <div style={{ width: "28px", flexShrink: 0 }} />
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => removeNewSubtask(idx)}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "8px",
                                      border: "none",
                                      background: "transparent",
                                      color: C.muted,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                      transition: "color 0.2s, background 0.2s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = darkMode ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* "Ajouter une tâche" pill — appears when first subtask is filled */}
                      {(() => {
                        const canAdd = newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0;
                        return (
                          <div
                            style={{
                              overflow: "hidden",
                              maxHeight: canAdd ? "56px" : "0px",
                              opacity: canAdd ? 1 : 0,
                              transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease 0.08s",
                              marginTop: canAdd ? "12px" : "0px",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={handleStartNewTask}
                              style={{
                                padding: "10px 28px",
                                borderRadius: "50px",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
                                background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                                color: C.muted,
                                fontSize: "13.5px",
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                                whiteSpace: "nowrap",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = darkMode ? "rgba(124,138,219,0.3)" : "rgba(91,106,191,0.25)"; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = darkMode ? "rgba(124,138,219,0.08)" : "rgba(91,106,191,0.05)"; e.currentTarget.style.padding = "10px 60px"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"; e.currentTarget.style.color = C.muted; e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)"; e.currentTarget.style.padding = "10px 28px"; }}
                            >
                              Ajouter une tâche
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── "Passer à l'étape suivante" button — appears when first subtask is filled ── */}
                {!todayReport && step === 0 && (() => {
                  const canProceed = newTaskName.trim() && newSubtasks[0]?.name?.trim() && parseFloat(newSubtasks[0]?.hours) > 0 || tasks.length > 0;
                  return (
                    <div
                      style={{
                        overflow: "hidden",
                        maxHeight: canProceed ? "80px" : "0px",
                        opacity: canProceed ? 1 : 0,
                        transition: "max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease 0.1s",
                        marginTop: canProceed ? "28px" : "0px",
                        display: "flex",
                        justifyContent: "center",
                        padding: canProceed ? "6px 0 16px" : "0",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleNext}
                        style={{
                          padding: "13px 36px",
                          background: "transparent",
                          color: C.accent,
                          border: `1.5px solid ${darkMode ? "rgba(124,138,219,0.35)" : "rgba(91,106,191,0.3)"}`,
                          borderRadius: "50px",
                          fontSize: "14px",
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                          letterSpacing: "-0.01em",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = darkMode ? "rgba(124,138,219,0.12)" : "rgba(91,106,191,0.08)";
                          e.currentTarget.style.borderColor = C.accent;
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = darkMode ? "0 4px 16px rgba(124,138,219,0.2)" : "0 4px 16px rgba(91,106,191,0.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = darkMode ? "rgba(124,138,219,0.35)" : "rgba(91,106,191,0.3)";
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        Passer à l'étape suivante
                      </button>
                    </div>
                  );
                })()}

                {/* ── Total hours (hidden — re-enable after animation validation) ── */}
                {false && tasks.length > 0 && (
                  <div
                    style={{
                      padding: "12px 20px",
                      background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                      borderRadius: "12px",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: C.secondary }}>
                      Total heures
                    </span>
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: calculateTotalHours() > 24 ? STATUS.danger : C.accent,
                      }}
                    >
                      {calculateTotalHours().toFixed(1)}h
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Questions */}
            {!todayReport && step === 1 && (
              <div style={{ minHeight: "200px" }}>
                {!allQuestionsDone ? (
                  <div>
                    {/* Question counter */}
                    <div style={{
                      textAlign: "center",
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: C.muted,
                      fontWeight: 500,
                    }}>
                      Question {questionIndex + 1} / {todayQuestions.length}
                    </div>

                    {/* Previous answers */}
                    {questionAnswers.length > 0 && (
                      <div style={{ marginBottom: "32px" }}>
                        {questionAnswers.map((qa, i) => (
                          <div
                            key={i}
                            style={{
                              marginBottom: "20px",
                              paddingBottom: "20px",
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            <p style={{
                              fontSize: "14px",
                              color: C.muted,
                              margin: "0 0 6px 0",
                              fontWeight: 500,
                            }}>
                              {qa.question}
                            </p>
                            <p style={{
                              fontSize: "16px",
                              color: C.secondary,
                              margin: 0,
                              lineHeight: 1.6,
                              fontStyle: "italic",
                            }}>
                              {qa.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Current question with typing animation */}
                    <h2
                      style={{
                        fontSize: "22px",
                        fontWeight: 600,
                        color: C.text,
                        marginBottom: "24px",
                        textAlign: "left",
                        minHeight: "30px",
                        lineHeight: 1.4,
                      }}
                    >
                      {questionTypedText}
                      <span
                        style={{
                          opacity: !questionTypingDone ? 1 : 0,
                          animation: "blink 1s infinite",
                          transition: "opacity 0.3s ease",
                        }}
                      >
                        |
                      </span>
                    </h2>

                    {/* Free-form input — appears after typing done */}
                    <div
                      style={{
                        opacity: questionTypingDone ? 1 : 0,
                        transform: questionTypingDone ? "translateY(0)" : "translateY(12px)",
                        transition: "opacity 0.5s ease, transform 0.5s ease",
                        pointerEvents: questionTypingDone ? "auto" : "none",
                      }}
                    >
                      <textarea
                        ref={inputRef}
                        className="eod-free-input"
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyDown={handleAnswerKeyDown}
                        placeholder="Écrivez votre réponse..."
                        maxLength={LIMITS.ANSWER_MAX}
                        rows={2}
                        style={{
                          overflow: "hidden",
                        }}
                        onInput={(e) => {
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                      />

                      {/* Send button — appears when user starts typing */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: "16px",
                          opacity: currentAnswer.trim().length > 0 ? 1 : 0,
                          transform: currentAnswer.trim().length > 0 ? "translateY(0)" : "translateY(8px)",
                          transition: "opacity 0.35s ease, transform 0.35s ease",
                          pointerEvents: currentAnswer.trim().length > 0 ? "auto" : "none",
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleSendAnswer}
                          disabled={sendingAnswer}
                          style={{
                            padding: "10px 28px",
                            background: sendingAnswer ? C.muted : C.accent,
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: sendingAnswer ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!sendingAnswer) {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {sendingAnswer ? "Envoi..." : "Envoyer"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Thank you screen */
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      animation: "fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both",
                    }}
                  >
                    <div style={{
                      fontSize: "48px",
                      marginBottom: "16px",
                    }}>
                      &#10003;
                    </div>
                    <h2 style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: "8px",
                    }}>
                      Merci d'avoir répondu au formulaire
                    </h2>
                    <p style={{
                      fontSize: "16px",
                      color: C.secondary,
                      margin: 0,
                    }}>
                      À demain !
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons (hidden — re-enable after animation validation) */}
            {/* Old Suivant/Précédent block removed — replaced by "Passer à l'étape suivante" above */}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
