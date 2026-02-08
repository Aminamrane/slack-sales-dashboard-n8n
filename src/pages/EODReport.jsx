// src/pages/EODReport.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";
import "../index.css";

const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  danger: "#ef4444",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textTertiary: "#94a3b8",
  border: "#e2e8f0",
  background: "#f8fafc",
  cardBg: "#ffffff",
};

const RATINGS = [
  { value: 4, label: "Excellente" },
  { value: 3, label: "Bonne" },
  { value: 2, label: "Correcte" },
  { value: 1, label: "Difficile" },
  { value: 0, label: "Très difficile" },
];

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

  const dayOfWeek = now.getDay(); // 0=Sun, 2=Tue, 4=Thu
  const isTueOrThu = dayOfWeek === 2 || dayOfWeek === 4;

  const questions = [pool.q1, pool.q2];
  if (isTueOrThu) {
    questions.push(pool.q3);
  }
  return { questions, poolKey };
}

export default function EODReport() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // Form state
  const [step, setStep] = useState(0); // 0: tasks, 1: rating, 2: questions
  const [rating, setRating] = useState(3);
  const [tasks, setTasks] = useState([]);
  const [todayReport, setTodayReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 0 typing animation
  const [typedText, setTypedText] = useState("");
  const fullText = "Quelles tâches avez-vous effectuées aujourd'hui ?";

  // Step 2: Questions flow
  const { questions: todayQuestions, poolKey } = getTodayQuestions();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionTypedText, setQuestionTypedText] = useState("");
  const [questionTypingDone, setQuestionTypingDone] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [allQuestionsDone, setAllQuestionsDone] = useState(false);
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const inputRef = useRef(null);

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

  // Step 2: Question typing animation
  useEffect(() => {
    if (step !== 2 || allQuestionsDone) return;

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
    }, 40);

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
        setRating(resp.report.rating ?? 3);
        setTasks(resp.report.tasks || []);
      }
    } catch (error) {
      console.error("Error loading today's report:", error);
    }
  };

  const addMainTask = () => {
    setTasks([
      ...tasks,
      {
        _id: Date.now(),
        task_name: "",
        subtasks: [{ _id: Date.now() + 1, task_name: "", hours_spent: 0 }],
      },
    ]);
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
      if (tasks.length === 0) {
        alert("Veuillez ajouter au moins une tâche.");
        return;
      }
      const invalidTasks = tasks.filter(
        (t) => !t.task_name.trim() || !t.subtasks || t.subtasks.length === 0 || !t.subtasks.some((st) => st.task_name.trim())
      );
      if (invalidTasks.length > 0) {
        alert("Chaque tâche doit avoir un nom et au moins une sous-tâche.");
        return;
      }
      const totalHours = calculateTotalHours();
      if (totalHours > 24) {
        alert("Le total des heures ne peut pas dépasser 24h par jour.");
        return;
      }
    }

    setStep(step + 1);
  };

  const handleSendAnswer = useCallback(async () => {
    if (!currentAnswer.trim() || sendingAnswer) return;

    setSendingAnswer(true);
    const newAnswers = [...questionAnswers, {
      question: todayQuestions[questionIndex],
      answer: currentAnswer.trim(),
    }];
    setQuestionAnswers(newAnswers);

    // Small delay for smooth transition
    await new Promise((r) => setTimeout(r, 300));
    setSendingAnswer(false);

    if (questionIndex + 1 < todayQuestions.length) {
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
    setSubmitting(true);
    try {
      const payload = {
        report_date: new Date().toISOString().split("T")[0],
        rating: rating,
        pool_key: poolKey,
        question_answers: answers,
        tasks: tasks
          .filter((t) => t.task_name.trim())
          .map((t) => ({
            task_name: t.task_name.trim(),
            hours_spent: 0,
            subtasks: (t.subtasks || [])
              .filter((st) => st.task_name.trim())
              .map((st) => ({
                task_name: st.task_name.trim(),
                hours_spent: parseFloat(st.hours_spent) || 0,
              })),
          })),
      };

      await apiClient.post("/api/v1/eod/submit", payload);
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        background: darkMode ? "#1a1a1e" : COLORS.background,
        minHeight: "100vh",
        paddingTop: "16px",
      }}
    >
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="board-frame" style={{ paddingTop: "24px" }}>
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
                color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                margin: 0,
              }}
            >
              End of Day Report
            </h1>
            <p style={{ fontSize: "14px", color: COLORS.textSecondary, margin: "4px 0 0 0" }}>
              Partagez votre journée de travail
            </p>
          </div>

          {/* Progress indicator */}
          {!todayReport && (
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              {[0, 1, 2].map((s) => (
                <div
                  key={s}
                  style={{
                    width: step === s ? "48px" : "12px",
                    height: "12px",
                    borderRadius: "6px",
                    background: step >= s ? COLORS.primary : darkMode ? "#3f3f46" : COLORS.border,
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
              @keyframes gentlePulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
              .eod-free-input {
                width: 100%;
                border: none;
                border-bottom: 2px solid ${darkMode ? "#3f3f46" : COLORS.border};
                background: transparent;
                font-size: 17px;
                line-height: 1.8;
                padding: 8px 0;
                color: ${darkMode ? "#e5e7eb" : COLORS.textPrimary};
                font-family: inherit;
                outline: none;
                resize: none;
                transition: border-color 0.3s ease;
              }
              .eod-free-input:focus {
                border-bottom-color: ${COLORS.primary};
              }
              .eod-free-input::placeholder {
                color: ${darkMode ? "#52525b" : "#cbd5e1"};
                font-style: italic;
              }
            `}
          </style>

          {/* Form */}
          <div
            style={{
              background: darkMode ? "#27272a" : COLORS.cardBg,
              border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
              borderRadius: "12px",
              padding: "40px",
              marginBottom: "32px",
              boxShadow: darkMode
                ? "0 4px 20px rgba(0,0,0,0.3)"
                : "0 2px 8px rgba(0,0,0,0.04)",
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
                  background: `${COLORS.success}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <span style={{ fontSize: "28px", color: COLORS.success }}>&#10003;</span>
                </div>
                <h2 style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                  marginBottom: "8px",
                }}>
                  EOD déjà soumis aujourd'hui
                </h2>
                <p style={{
                  fontSize: "15px",
                  color: COLORS.textSecondary,
                  margin: "0 0 24px 0",
                  lineHeight: 1.6,
                }}>
                  Vous avez déjà complété votre End of Day pour aujourd'hui.
                  <br />Revenez demain !
                </p>
                <div style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: darkMode ? "#18181b" : "#f8fafc",
                  borderRadius: "8px",
                  border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                }}>
                  <span style={{ fontSize: "14px", color: COLORS.textTertiary }}>
                    Note du jour : </span>
                  <span style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: COLORS.primary,
                  }}>
                    {todayReport.rating}/4
                  </span>
                </div>
              </div>
            )}

            {/* Step 0: Tasks */}
            {!todayReport && step === 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 600,
                    color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
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

                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
                    <button
                      type="button"
                      onClick={addMainTask}
                      style={{
                        padding: "12px 32px",
                        background: COLORS.primary,
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "15px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      + Ajouter une tâche
                    </button>
                  </div>

                  {tasks.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "48px 20px",
                        background: darkMode ? "#18181b" : "#f9fafb",
                        borderRadius: "8px",
                        border: `1px dashed ${darkMode ? "#3f3f46" : COLORS.border}`,
                        animation: "slideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both",
                      }}
                    >
                      <p
                        style={{
                          color: COLORS.textTertiary,
                          fontSize: "14px",
                          margin: 0,
                        }}
                      >
                        Aucune tâche ajoutée
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {tasks.map((task, taskIndex) => (
                      <div
                        key={task._id || taskIndex}
                        style={{
                          border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                          borderRadius: "8px",
                          padding: "20px",
                          background: darkMode ? "#18181b" : "#fff",
                          animation: "slideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both",
                        }}
                      >
                        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                          <input
                            type="text"
                            placeholder="Nom de la tâche principale"
                            value={task.task_name}
                            onChange={(e) => updateMainTask(taskIndex, "task_name", e.target.value)}
                            style={{
                              flex: 1,
                              padding: "12px 16px",
                              border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                              borderRadius: "6px",
                              fontSize: "15px",
                              fontWeight: 600,
                              background: darkMode ? "#27272a" : "#f9fafb",
                              color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeMainTask(taskIndex)}
                            style={{
                              padding: "12px 20px",
                              background: COLORS.danger,
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Supprimer
                          </button>
                        </div>

                        {task.subtasks && task.subtasks.length > 0 && (
                          <div
                            style={{
                              marginLeft: "0",
                              paddingLeft: "20px",
                              borderLeft: `3px solid ${COLORS.primary}`,
                              marginBottom: "16px",
                            }}
                          >
                            {task.subtasks.map((subtask, subtaskIndex) => (
                              <div
                                key={subtask._id || subtaskIndex}
                                style={{
                                  display: "flex",
                                  gap: "12px",
                                  marginBottom: "12px",
                                  animation: "subtaskSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Sous-tâche"
                                  value={subtask.task_name}
                                  onChange={(e) =>
                                    updateSubtask(taskIndex, subtaskIndex, "task_name", e.target.value)
                                  }
                                  style={{
                                    flex: 1,
                                    padding: "10px 14px",
                                    border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    background: darkMode ? "#27272a" : "#fff",
                                    color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                                  }}
                                />
                                <input
                                  type="number"
                                  placeholder="Heures"
                                  value={subtask.hours_spent}
                                  onChange={(e) =>
                                    updateSubtask(taskIndex, subtaskIndex, "hours_spent", e.target.value)
                                  }
                                  min="0"
                                  max="24"
                                  step="0.5"
                                  style={{
                                    width: "110px",
                                    padding: "10px 14px",
                                    border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    background: darkMode ? "#27272a" : "#fff",
                                    color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSubtask(taskIndex, subtaskIndex)}
                                  style={{
                                    padding: "10px 14px",
                                    background: "transparent",
                                    color: COLORS.danger,
                                    border: `1px solid ${COLORS.danger}`,
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => addSubtask(taskIndex)}
                          style={{
                            marginLeft: "20px",
                            padding: "8px 14px",
                            background: "transparent",
                            color: COLORS.primary,
                            border: `1px solid ${COLORS.primary}`,
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          + Ajouter une sous-tâche
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {tasks.length > 0 && (
                  <div
                    style={{
                      padding: "16px 20px",
                      background: darkMode ? "#18181b" : "#f0f9ff",
                      border: `1px solid ${darkMode ? "#3f3f46" : "#bfdbfe"}`,
                      borderRadius: "8px",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                      }}
                    >
                      Total heures
                    </span>
                    <span
                      style={{
                        fontSize: "20px",
                        fontWeight: 700,
                        color: calculateTotalHours() > 24 ? COLORS.danger : COLORS.primary,
                      }}
                    >
                      {calculateTotalHours().toFixed(1)}h
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Rating */}
            {!todayReport && step === 1 && (
              <div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 600,
                    color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                    marginBottom: "32px",
                    textAlign: "center",
                  }}
                >
                  Comment s'est passée votre journée ?
                </h2>

                <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                  {RATINGS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      style={{
                        flex: 1,
                        padding: "20px",
                        border: `2px solid ${
                          rating === value ? COLORS.primary : darkMode ? "#3f3f46" : COLORS.border
                        }`,
                        borderRadius: "8px",
                        background:
                          rating === value ? `${COLORS.primary}15` : darkMode ? "#18181b" : "#fff",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        if (rating !== value) {
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (rating !== value) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }
                      }}
                    >
                      <span
                        style={{
                          fontSize: "32px",
                          fontWeight: 700,
                          color: rating === value ? COLORS.primary : darkMode ? "#d1d5db" : COLORS.textSecondary,
                        }}
                      >
                        {value}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          color: darkMode ? "#9ca3af" : COLORS.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Questions */}
            {!todayReport && step === 2 && (
              <div style={{ minHeight: "200px" }}>
                {!allQuestionsDone ? (
                  <div>
                    {/* Question counter */}
                    <div style={{
                      textAlign: "center",
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: COLORS.textTertiary,
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
                              borderBottom: `1px solid ${darkMode ? "#3f3f46" : "#f1f5f9"}`,
                            }}
                          >
                            <p style={{
                              fontSize: "14px",
                              color: COLORS.textTertiary,
                              margin: "0 0 6px 0",
                              fontWeight: 500,
                            }}>
                              {qa.question}
                            </p>
                            <p style={{
                              fontSize: "16px",
                              color: darkMode ? "#d1d5db" : COLORS.textSecondary,
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
                        color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
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
                            background: sendingAnswer ? COLORS.textTertiary : COLORS.primary,
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
                      color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                      marginBottom: "8px",
                    }}>
                      Merci d'avoir répondu au formulaire
                    </h2>
                    <p style={{
                      fontSize: "16px",
                      color: COLORS.textSecondary,
                      margin: 0,
                    }}>
                      À demain !
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons (steps 0 and 1 only) */}
            {!todayReport && step < 2 && (step > 0 || tasks.length > 0) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "32px",
                  opacity: step === 0 && tasks.length > 0 ? 1 : step > 0 ? 1 : 0,
                  transform: step === 0 && tasks.length > 0 ? "translateY(0)" : step > 0 ? "translateY(0)" : "translateY(10px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                }}
              >
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    style={{
                      padding: "14px 40px",
                      background: "transparent",
                      color: darkMode ? "#e5e7eb" : COLORS.textPrimary,
                      border: `1px solid ${darkMode ? "#3f3f46" : COLORS.border}`,
                      borderRadius: "8px",
                      fontSize: "15px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "#27272a" : "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Précédent
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  style={{
                    padding: "14px 40px",
                    background: COLORS.primary,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
