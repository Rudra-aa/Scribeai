import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import '../styles/app.css';

// Cap, fmtBytes, fmtDate, mdToHtml helpers
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function fmtBytes(b) {
  if (!b || b < 1024) return (b || 0) + " B";
  if (b < 1_048_576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1_048_576).toFixed(1) + " MB";
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function mdToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>[^\n]+\n?)+)/g, m => `<ul>${m.replace(/\n/g, "")}</ul>`)
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

// time-domain autocorrelation pitch detection for gender identification
function detectPitch(timeDomainBuffer, sampleRate) {
  const bufferSize = timeDomainBuffer.length;
  let rms = 0;
  for (let i = 0; i < bufferSize; i++) {
    const val = timeDomainBuffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / bufferSize);
  if (rms < 0.01) return -1; // Silent / background noise

  let r1 = 0, r2 = bufferSize - 1, thres = 0.2;
  for (let i = 0; i < bufferSize / 2; i++) {
    if (Math.abs(timeDomainBuffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = bufferSize - 1; i >= bufferSize / 2; i--) {
    if (Math.abs(timeDomainBuffer[i]) < thres) { r2 = i; break; }
  }
  const buffer = timeDomainBuffer.slice(r1, r2);
  const size = buffer.length;
  if (size < 64) return -1;

  let bestPeriod = -1;
  let bestCorrelation = -1;
  const minPeriod = Math.round(sampleRate / 400);
  const maxPeriod = Math.round(sampleRate / 50);

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    for (let i = 0; i < size - period; i++) {
      correlation += buffer[i] * buffer[i + period];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  if (bestPeriod !== -1 && bestCorrelation > 0.01) {
    return sampleRate / bestPeriod;
  }
  return -1;
}

// client-side speech synthesis (TTS) speaker
function speakText(text, targetLangCode, gender, retryCount = 0) {
  if (!window.speechSynthesis) return;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0 && retryCount < 15) {
    console.log(`[SpeechSynthesis] Voice list not populated yet, retrying... (attempt ${retryCount + 1}/15)`);
    setTimeout(() => {
      speakText(text, targetLangCode, gender, retryCount + 1);
    }, 100);
    return;
  }

  try {
    // If the SpeechSynthesis engine is paused (common browser state issue), resume it
    if (window.speechSynthesis.paused) {
      console.log("[SpeechSynthesis] Speech engine was paused. Resuming...");
      window.speechSynthesis.resume();
    }
    
    // Cancel any ongoing speech to speak the new text immediately
    window.speechSynthesis.cancel();
  } catch (err) {
    console.warn("[SpeechSynthesis] Cancel/Resume failed:", err);
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Normalize targetLangCode (e.g. 'en' to 'en-US', 'hi' to 'hi-IN', 'es' to 'es-ES')
  const langCodeMap = {
    'en': 'en-US', 'hi': 'hi-IN', 'es': 'es-ES', 'fr': 'fr-FR',
    'de': 'de-DE', 'ja': 'ja-JP', 'zh': 'zh-CN', 'ar': 'ar-SA'
  };
  const fullLangCode = langCodeMap[targetLangCode] || targetLangCode;
  utterance.lang = fullLangCode;

  const langPrefix = targetLangCode.toLowerCase().split('-')[0];
  const filteredVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

  let matchedVoice = null;
  if (filteredVoices.length > 0) {
    const isMale = gender === 'male';
    const maleNames = ['alex', 'fred', 'daniel', 'jorge', 'thomas', 'markus', 'otoya', 'rishi', 'ravi', 'kazu', 'ichiro', 'paulo'];
    const femaleNames = ['samantha', 'victoria', 'karen', 'tessa', 'moira', 'lekha', 'monica', 'aurelie', 'anna', 'kyoko', 'veena', 'mei-jia', 'susan', 'carmen', 'elena'];

    const genderVoices = filteredVoices.filter(v => {
      const name = v.name.toLowerCase();
      if (isMale) {
        return maleNames.some(n => name.includes(n)) || (!femaleNames.some(n => name.includes(n)) && name.includes('male'));
      } else {
        return femaleNames.some(n => name.includes(n)) || (!maleNames.some(n => name.includes(n)) && name.includes('female'));
      }
    });

    matchedVoice = genderVoices[0] || filteredVoices[0];
  }

  if (matchedVoice) {
    console.log(`[SpeechSynthesis] Speaking in matched voice: ${matchedVoice.name} (${matchedVoice.lang}) for language code: ${targetLangCode}`);
    utterance.voice = matchedVoice;
  } else {
    console.warn(`[SpeechSynthesis] No voice matched for language prefix: ${langPrefix}. Falling back to default browser voice.`);
  }

  // Diagnostic Event Listeners
  utterance.onstart = () => {
    console.log(`[SpeechSynthesis] Started speaking utterance: "${text.substring(0, 40)}..."`);
  };
  utterance.onend = () => {
    console.log("[SpeechSynthesis] Finished speaking utterance.");
  };
  utterance.onerror = (e) => {
    console.error("[SpeechSynthesis] Utterance error event:", e.error, e);
  };

  try {
    window.speechSynthesis.speak(utterance);
    // Force browser to process context activation (especially Safari/Chrome desktop compatibility)
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (speakErr) {
    console.error("[SpeechSynthesis] speak call threw error:", speakErr);
  }
}


export default function Dashboard() {
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState('upload'); // 'upload' | 'realtime' | 'history' | 'notes'
  const [theme, setTheme] = useState('dark');
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('user@example.com');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, text: '', type: '' });

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  
  const isJobStuck = (job) => {
    if (job.status !== 'processing') return false;
    const lastUpdate = new Date(job.lastProgressAt || job.updatedAt).getTime();
    const now = Date.now();
    return (now - lastUpdate) > 10 * 60 * 1000;
  };
  const [selectedJobFull, setSelectedJobFull] = useState(null);
  
  // File Upload State
  const [pendingFile, setPendingFile] = useState(null); // File object or { youtubeUrl, name }
  const [ytUrl, setYtUrl] = useState('');
  const [srcLang, setSrcLang] = useState('en');
  const [targetLang, setTargetLang] = useState('');
  
  // Progress processing state
  const [processingJobId, setProcessingJobId] = useState(null);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Uploading…');
  const [progressStatus, setProgressStatus] = useState('uploading'); // 'uploading' | 'processing' | 'done' | 'error'
  const [processCardVisible, setProcessCardVisible] = useState(false);

  // Real-time Translation State
  const [isRecording, setIsRecording] = useState(false);
  const [liveOriginalText, setLiveOriginalText] = useState('');
  const [liveTranslatedText, setLiveTranslatedText] = useState('');
  const [liveInterimText, setLiveInterimText] = useState('');
  const [liveStatus, setLiveStatus] = useState('Ready');
  const [transcribeLang, setTranscribeLang] = useState('auto');
  const [liveTargetLang, setLiveTargetLang] = useState('en');
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);

  // Health diagnostics state
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'

  // Refs for media recording & sockets
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  const latestTargetLangRef = useRef(liveTargetLang);
  const latestTranscribeLangRef = useRef(transcribeLang);
  const latestGenderRef = useRef('female'); // defaults to female
  const latestTtsEnabledRef = useRef(isTtsEnabled);

  // Pitch/Gender detection refs
  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pitchIntervalRef = useRef(null);

  useEffect(() => {
    latestTargetLangRef.current = liveTargetLang;
  }, [liveTargetLang]);

  useEffect(() => {
    latestTranscribeLangRef.current = transcribeLang;
  }, [transcribeLang]);

  useEffect(() => {
    latestTtsEnabledRef.current = isTtsEnabled;
  }, [isTtsEnabled]);


  // Pre-load voices on mount to avoid initial empty lists in Chrome/Safari
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Trigger voice list loading
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log(`[SpeechSynthesis] Voices loaded: ${voices.length} voices available.`);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);


  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Auth Guard check
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/auth");
      return;
    }

    // Set User Profile from localStorage
    setTimeout(() => {
      setUserName(localStorage.getItem("userName") || "User");
      setUserEmail(localStorage.getItem("userEmail") || "—");
    }, 0);

    // Theme Setup
    const savedTheme = localStorage.getItem("scribeai-theme") || 
      (window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);

    // Initial load of jobs & diagnostics
    checkHealthAndAuth();

    return () => {
      stopPolling();
      stopLiveRecording();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ─── Theme Management ────────────────────────────────────────────────────────
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("scribeai-theme", t);
    setTheme(t);
  };

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (msg, type = "", dur = 3500) => {
    setToast({ show: true, text: msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, text: '', type: '' });
    }, dur);
  };

  // ─── API Helper ──────────────────────────────────────────────────────────────
  const apiCall = async (path, opts = {}) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api${path}`, {
      cache: 'no-store',
      ...opts,
      headers: {
        "Authorization": `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Request failed (${res.status})`);
    }
    return res;
  };

  // ─── Load Jobs ───────────────────────────────────────────────────────────────
  const loadJobs = async () => {
    try {
      console.log("[API] Loading jobs...");
      const res = await apiCall("/jobs");
      const data = await res.json();
      console.log("[API] Jobs loaded successfully. Count:", data.length);
      setJobs(data);
    } catch (e) {
      console.error("loadJobs failed:", e);
      if (e.message.toLowerCase().includes("not authorized") || e.message.includes("401") || e.message.toLowerCase().includes("token")) {
        console.warn("[Auth] Token verification failed. Redirecting to /auth.");
        showToast("Session expired or unauthorized. Redirecting...", "err");
        setTimeout(() => {
          handleSignOut();
        }, 1500);
      } else {
        showToast("Could not load notes: " + e.message, "err");
      }
      throw e;
    }
  };

  async function checkHealthAndAuth() {
    console.log("[Diagnostics] Initiating Node backend & AI Engine health checks...");
    console.log("[Diagnostics] Auth Token present:", !!localStorage.getItem("token"));

    // 1. Check Node backend health
    try {
      const nodeRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/health`);
      if (!nodeRes.ok) throw new Error("Node backend offline");
      const nodeData = await nodeRes.json();
      setBackendStatus('online');
      console.log("[Diagnostics] Node backend is online:", nodeData);
    } catch (err) {
      console.error("[Diagnostics] Node backend is offline:", err.message);
      setBackendStatus('offline');
      showToast("Node.js server is offline on port 5001.", "err");
      return;
    }

    // 2. Python AI Engine health check removed because it is now securely internal to the Render container.

    // 3. Initial load of jobs & token verification
    try {
      await loadJobs();
    } catch (err) {
      console.error("[Diagnostics] Auth token verification failed:", err.message);
    }
  };

  // ─── Switch View ─────────────────────────────────────────────────────────────
  const handleSwitchView = (v) => {
    setView(v);
    setSidebarOpen(false);
  };

  // ─── File Selection handlers ────────────────────────────────────────────────
  const triggerBrowseFiles = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const selectFile = (file) => {
    setPendingFile(file);
    showToast("📎 " + file.name + " selected");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  // ─── YouTube URL handler ─────────────────────────────────────────────────────
  const handleYtSubmit = () => {
    const url = ytUrl.trim();
    if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
      showToast("Please enter a valid YouTube URL.", "err");
      return;
    }
    setPendingFile({ youtubeUrl: url, name: "YouTube: " + url.substring(0, 45) + "...", size: 0 });
    showToast("YouTube URL ready — select language and click Generate.");
  };

  // ─── Start Processing ───────────────────────────────────────────────────────
  const startProcessing = async () => {
    if (!pendingFile) {
      showToast("Select a file or paste a YouTube URL first.", "err");
      return;
    }

    setProcessCardVisible(true);
    setProgressPct(5);
    setProgressLabel("Connecting…");
    setProgressStatus("uploading");

    try {
      let jobId;
      if (pendingFile.youtubeUrl) {
        // YouTube Url path
        setProgressPct(15);
        setProgressLabel("Queuing YouTube download…");
        const res = await apiCall("/process-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtube_url: pendingFile.youtubeUrl,
            language: srcLang,
            target_language: targetLang || null
          })
        });
        const data = await res.json();
        jobId = data.job_id;
        setProgressPct(30);
        setProgressLabel("YouTube queued — extracting audio…");
        setProgressStatus("processing");
      } else {
        // File Upload path
        setProgressPct(15);
        setProgressLabel("Uploading file to server…");
        const form = new FormData();
        form.append("file", pendingFile);
        form.append("language", srcLang);
        if (targetLang) form.append("target_language", targetLang);

        const res = await apiCall("/upload", {
          method: "POST",
          body: form
        });
        const data = await res.json();
        jobId = data.job_id;
        setProgressPct(40);
        setProgressLabel("Upload complete — transcribing audio…");
        setProgressStatus("processing");
      }

      setProcessingJobId(jobId);
      startPolling(jobId);
    } catch (err) {
      console.error(err);
      setProgressPct(0);
      setProgressLabel("Error: " + err.message);
      setProgressStatus("error");
      showToast(err.message, "err");
    }
  };

  const handleClearError = async () => {
    if (processingJobId) {
      try {
        console.log("[Error Handling] Cleaning up failed job record:", processingJobId);
        await apiCall(`/job/${processingJobId}`, { method: "DELETE" });
      } catch (err) {
        console.warn("Could not delete job record on clear:", err.message);
      }
    }
    setProcessCardVisible(false);
    setPendingFile(null);
    setProcessingJobId(null);
    loadJobs();
    showToast("Error cleared successfully.");
  };

  // ─── Polling ──────────────────────────────────────────────────────────────────
  const startPolling = (jobId) => {
    stopPolling();
    let attempts = 0;

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 600) { // 20 min limit
        stopPolling();
        setProgressPct(0);
        setProgressLabel("Timed out — check My Transcripts");
        setProgressStatus("error");
        return;
      }

      try {
        const res = await apiCall(`/status/${jobId}`);
        const job = await res.json();

        if (job.status === "processing") {
          const pct = Math.max(40, job.progress || 40);
          setProgressPct(pct);
          setProgressLabel("AI Engine transcribing media…");
          setProgressStatus("processing");
        } else if (job.status === "done") {
          stopPolling();
          setProgressPct(100);
          setProgressLabel("Transcript ready!");
          setProgressStatus("done");
          showToast("Transcription completed successfully!", "volt");
          
          // Refresh lists
          loadJobs();
          
          // Automatically open notes after a short delay
          setTimeout(() => {
            openJob(jobId);
          }, 800);
        } else if (job.status === "error" || job.status === "failed") {
          stopPolling();
          setProgressPct(0);
          setProgressLabel("Error: " + (job.error || "Processing failed"));
          setProgressStatus("error");
          showToast(job.error || "Processing failed.", "err");
        }
      } catch (e) {
        console.warn("[polling status error]", e.message);
      }
    }, 2500);
  };

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // ─── Open Notes / Job Details ───────────────────────────────────────────────
  const openJob = async (jobId) => {
    showToast("Loading notes…");
    try {
      // Fetch full details first to avoid stale closure state
      const res = await apiCall(`/status/${jobId}`);
      const fullJob = await res.json();
      
      setSelectedJob(fullJob);
      setSelectedJobFull(fullJob);
      setView('notes');
    } catch (e) {
      showToast("Could not load details: " + e.message, "err");
    }
  };

  // ─── Delete Notes ────────────────────────────────────────────────────────────
  const handleDeleteNote = async (e) => {
    if (e) e.stopPropagation();
    if (!selectedJob) return;
    if (!window.confirm("Are you sure you want to completely delete this note? This cannot be undone.")) return;

    try {
      showToast("Deleting note...");
      await apiCall(`/job/${selectedJob.id}`, { method: "DELETE" });
      setJobs(jobs.filter(j => j.id !== selectedJob.id));
      setSelectedJob(null);
      setSelectedJobFull(null);
      setView('history');
      showToast("Note deleted successfully.");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete note: " + err.message, "err");
    }
  };

  const handleDeleteFromList = async (jobId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to completely delete this note? This cannot be undone.")) return;
    try {
      showToast("Deleting note...");
      await apiCall(`/job/${jobId}`, { method: "DELETE" });
      setJobs(jobs.filter(j => j.id !== jobId));
      if (selectedJob && selectedJob.id === jobId) {
         setSelectedJob(null);
         setSelectedJobFull(null);
         setView('history');
      }
      showToast("Note deleted successfully.");
    } catch (err) {
      showToast("Failed to delete note: " + err.message, "err");
    }
  };

  const handleRetry = async (jobId, e) => {
    if (e) e.stopPropagation();
    try {
      showToast("Initiating retry...");
      await apiCall(`/job/${jobId}/retry`, { method: "POST" });
      showToast("Retry initiated successfully");
      loadJobs();
      if (selectedJob && selectedJob.id === jobId) {
         openJob(jobId);
      }
    } catch (err) {
      showToast("Retry failed: " + err.message, "err");
    }
  };

  // ─── Download exports ────────────────────────────────────────────────────────
  const handleDownload = async (fmt) => {
    if (!selectedJob) return;
    const token = localStorage.getItem("token");
    
    if (fmt === 'md' || fmt === 'srt' || fmt === 'vtt') {
      // Server routes handle this nicely by streaming from MongoDB
      const downloadUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/download/${selectedJob.id}/${fmt}?token=${token}`;
      window.open(downloadUrl, "_blank");
      showToast(`Downloading .${fmt.toUpperCase()} file`);
    } else if (fmt === 'audio' || fmt === 'video') {
      const downloadUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/download/${selectedJob.id}/${fmt}?token=${token}`;
      window.open(downloadUrl, "_blank");
      showToast(`Downloading media file`);
    }
  };

  // ─── Real-Time Translation controls ──────────────────────────────────────────
  const toggleLiveRecording = () => {
    if (isRecording) {
      stopLiveRecording();
    } else {
      startLiveRecording();
    }
  };

  const startLiveRecording = async () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showToast("Browser doesn't support Web Speech API. Please use Chrome/Edge.", "err");
        return;
      }

      setLiveOriginalText('');
      setLiveTranslatedText('');
      setLiveInterimText('');
      latestGenderRef.current = 'female'; // reset default

      // Unlock SpeechSynthesis audio context via instant silent utterance
      if (window.speechSynthesis) {
        try { window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* ignore */ }
      }

      // Request microphone audio stream for Web Audio API gender pitch detection
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        
        const dataArray = new Float32Array(analyser.fftSize);
        const sampleRate = audioCtx.sampleRate;
        
        let pitchHistory = [];
        
        pitchIntervalRef.current = setInterval(() => {
          analyser.getFloatTimeDomainData(dataArray);
          const pitch = detectPitch(dataArray, sampleRate);
          if (pitch > 80 && pitch < 350) {
            pitchHistory.push(pitch);
            if (pitchHistory.length > 25) pitchHistory.shift();
            
            const avgPitch = pitchHistory.reduce((a, b) => a + b, 0) / pitchHistory.length;
            const classifiedGender = avgPitch < 165 ? 'male' : 'female';
            
            setLiveStatus(`Connected • Recording (${classifiedGender.toUpperCase()} voice · ${Math.round(avgPitch)} Hz)`);
            latestGenderRef.current = classifiedGender;
          }
        }, 120);
      } catch (audioErr) {
        console.warn("Could not start Web Audio API pitch tracker:", audioErr.message);
      }

      // Connect socket.io client to MERN backend
      socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5001');

      socketRef.current.on('connect', () => {
        setIsRecording(true);
        if (!audioStreamRef.current) {
          setLiveStatus("Connected • Recording");
        }
        showToast("🎙️ Real-time Speech-to-Text session started");

        // Instantiate SpeechRecognition
        const recognition = new SR();
        
        // Dynamically select locale based on user selection
        let langCode = 'en-US';
        if (transcribeLang === 'hi' || transcribeLang === 'hinglish') {
          langCode = 'hi-IN';
        } else if (transcribeLang === 'es') {
          langCode = 'es-ES';
        } else if (transcribeLang === 'fr') {
          langCode = 'fr-FR';
        } else if (transcribeLang === 'de') {
          langCode = 'de-DE';
        } else if (transcribeLang === 'ja') {
          langCode = 'ja-JP';
        } else if (transcribeLang === 'zh') {
          langCode = 'zh-CN';
        } else if (transcribeLang === 'ar') {
          langCode = 'ar-SA';
        } else if (transcribeLang === 'auto') {
          langCode = 'en-US';
        }

        recognition.lang = langCode;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              const text = result[0].transcript.trim();
              if (text) {
                setLiveOriginalText(prev => prev + text + " ");
                setLiveInterimText('');
                
                // Emit text to Node server for high-speed AI translation
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit('audioText', { 
                    text, 
                    language: latestTranscribeLangRef.current,
                    targetLanguage: latestTargetLangRef.current 
                  });
                }
              }
            } else {
              interim += result[0].transcript;
            }
          }
          setLiveInterimText(interim);
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === 'not-allowed') {
            showToast("Microphone access denied.", "err");
            stopLiveRecording();
          }
        };

        recognition.onend = () => {
          // Restart recognition if recording is still active
          if (recognitionRef.current === recognition && isRecording) {
            try { recognition.start(); } catch { /* ignore */ }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      });

      socketRef.current.on('transcription', (data) => {
        if (data.translated) {
          setLiveTranslatedText(prev => prev + data.translated + " ");
          
          // Trigger client-side Text-to-Speech voicing if enabled
          if (latestTtsEnabledRef.current) {
            speakText(data.translated, latestTargetLangRef.current, latestGenderRef.current);
          }
        }
      });

      socketRef.current.on('disconnect', () => {
        stopLiveRecording();
      });

      socketRef.current.on('error', (err) => {
        showToast("Live Translation Error: " + err.message, "err");
      });

    } catch (err) {
      console.error(err);
      showToast("Could not start real-time translation.", "err");
    }
  };

  function stopLiveRecording() {
    setIsRecording(false);
    setLiveStatus("Disconnected");

    // Clean up SpeechRecognition
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // Clean up Sockets
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Clean up Audio Analysis & stream tracks
    if (pitchIntervalRef.current) {
      clearInterval(pitchIntervalRef.current);
      pitchIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      } catch { /* ignore */ }
      audioStreamRef.current = null;
    }

    // Cancel any active SpeechSynthesis
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  };

  // ─── Sign Out ────────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    stopPolling();
    stopLiveRecording();
    navigate("/auth");
  };

  // ─── Render Sub-Views ────────────────────────────────────────────────────────
  if (backendStatus === 'offline') {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0b061b' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#120b29', borderRadius: '16px', border: '1px solid #331f63', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '500px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📡</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: '#fff', fontSize: '2rem', marginBottom: '1rem', letterSpacing: '0.02em' }}>Backend Offline</h1>
          <p style={{ color: '#aaa9c0', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            We cannot connect to the ScribeAI server. Please make sure the Node.js backend is running on port 5001.
          </p>
          <button 
            className="btn-generate" 
            onClick={checkHealthAndAuth}
            style={{ padding: '0.8rem 2rem', borderRadius: '50px', background: 'var(--volt)', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            🔄 Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sidebar Loading */}
      {toast.show && (
        <div className={`toast show ${toast.type}`} id="toast">
          {toast.text}
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <a href="/" className="sidebar-logo" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          <div className="logo-mark">S</div>ScribeAI
        </a>
        <nav className="sidebar-nav">
          <button className={`nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => handleSwitchView('upload')}>
            <span className="nav-icon">⬆</span>Upload
          </button>
          <button className={`nav-item ${view === 'realtime' ? 'active' : ''}`} onClick={() => handleSwitchView('realtime')}>
            <span className="nav-icon">🎙</span>Live Translate
          </button>
          <button className={`nav-item ${view === 'history' || view === 'notes' ? 'active' : ''}`} onClick={() => handleSwitchView('history')}>
            <span className="nav-icon">≡</span>My Transcripts
            {jobs.length > 0 && <span className="nav-badge">{jobs.length}</span>}
          </button>
          
          <div className="nav-sect">Settings</div>
          <button className="nav-item" onClick={() => showToast("Preferences coming soon!")}>
            <span className="nav-icon">⚙</span>Preferences
          </button>
          <button className="nav-item" onClick={handleSignOut}>
            <span className="nav-icon">→</span>Sign out
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-row">
            <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-email">{userEmail}</div>
            </div>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              <span>{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)}></div>}

      {/* MAIN CONTENT CONTAINER */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-l">
            <button className="mob-menu" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="page-title">
              {view === 'upload' && "Upload Video"}
              {view === 'realtime' && "Live Translation"}
              {view === 'history' && "My Transcripts"}
              {view === 'notes' && "View Transcript"}
            </div>
          </div>
          <div className="topbar-r">
            <button className="refresh-btn" onClick={loadJobs}>↻ Refresh</button>
          </div>
        </div>

        <div className="content">
          
          {/* UPLOAD VIEW */}
          {view === 'upload' && (
            <div className="view active">
              <div className="upload-zone" id="uploadZone" onDragOver={handleDragOver} onDrop={handleDrop}>
                <div className="drop-area" onClick={triggerBrowseFiles}>
                  <span className="upload-icon">🎬</span>
                  <div className="upload-title">
                    {pendingFile ? pendingFile.name : "Drop a video file here"}
                  </div>
                  <div className="upload-sub">
                    {pendingFile && pendingFile.size ? `${fmtBytes(pendingFile.size)} · click to change` : "or click to browse · max 500 MB"}
                  </div>
                  <div className="upload-fmts">
                    <span className="fmt-tag">MP4</span>
                    <span className="fmt-tag">MOV</span>
                    <span className="fmt-tag">AVI</span>
                    <span className="fmt-tag">MKV</span>
                    <span className="fmt-tag">WebM</span>
                  </div>
                </div>
                
                <input 
                  type="file" 
                  id="fileInput" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="video/*,audio/*" 
                  style={{ display: 'none' }}
                />

                <div className="yt-row">
                  <input 
                    type="text" 
                    className="yt-input" 
                    placeholder="Or paste a YouTube URL…" 
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleYtSubmit()}
                  />
                  <button className="yt-btn" onClick={handleYtSubmit}>Process →</button>
                </div>
              </div>

              {pendingFile && (
                <div className="config-row">
                  <div className="form-grp">
                    <label>Video language</label>
                    <select value={srcLang} onChange={(e) => setSrcLang(e.target.value)}>
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ar">Arabic</option>
                      <option value="pt">Portuguese</option>
                      <option value="ko">Korean</option>
                      <option value="it">Italian</option>
                      <option value="ru">Russian</option>
                    </select>
                  </div>
                  <div className="form-grp">
                    <label>Translate notes to</label>
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                      <option value="">No translation</option>
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ar">Arabic</option>
                      <option value="pt">Portuguese</option>
                      <option value="ko">Korean</option>
                    </select>
                  </div>
                  <button className="btn-generate" onClick={startProcessing}>Transcribe →</button>
                </div>
              )}

              {/* Progress processing card */}
              {processCardVisible && (
                <div className="process-card show">
                  <div className="pc-top">
                    <div className="pc-icon">🎬</div>
                    <div className="pc-info">
                      <div className="pc-name">{pendingFile ? pendingFile.name : 'video.mp4'}</div>
                      <div className="pc-size">{pendingFile && pendingFile.size ? fmtBytes(pendingFile.size) : 'YouTube'}</div>
                    </div>
                    <div className={`status-pill ${progressStatus}`}>
                      <span className="s-dot"></span>
                      <span>{cap(progressStatus)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="prog-head">
                      <span>{progressLabel}</span>
                      <span>{Math.round(progressPct)}%</span>
                    </div>
                    <div className="prog-track">
                      <div className="prog-fill" style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>
                  {progressStatus === 'done' && (
                    <button 
                      className="btn-generate" 
                      style={{ marginTop: '1rem', width: '100%' }}
                      onClick={() => openJob(processingJobId)}
                    >
                      View Notes →
                    </button>
                  )}

                  {progressStatus === 'error' && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                      <button 
                        className="btn-generate" 
                        style={{ flex: 1, padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}
                        onClick={startProcessing}
                      >
                        🔄 Retry Processing
                      </button>
                      <button 
                        className="export-btn" 
                        style={{ flex: 1, padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', borderColor: 'rgba(255,77,79,0.3)', color: '#ff4d4f' }}
                        onClick={handleClearError}
                      >
                        🗑 Clear / Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Recent jobs list */}
              <div className="mt-2">
                <div className="sec-head">
                  <div className="sec-title">Recent</div>
                  <div className="sec-count">{jobs.length} items</div>
                </div>

                <div className="jobs-list">
                  {jobs.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">📂</span>
                      <div className="empty-ttl">No videos yet</div>
                      <div className="empty-sub">Upload your first video to get started.</div>
                    </div>
                  ) : (
                    jobs.slice(0, 6).map((j) => {
                      const stuck = isJobStuck(j);
                      return (
                      <div key={j.id} className="job-card" onClick={() => openJob(j.id)}>
                        <div className="jc-icon">🎬</div>
                        <div style={{ flex: 1 }}>
                          <div className="jc-name">{j.fileName || "Untitled"}</div>
                          <div className="jc-meta">
                            {fmtDate(j.createdAt)} · {j.language}
                            {j.targetLanguage ? ` → ${j.targetLanguage}` : ''}
                          </div>
                        </div>
                        {stuck && j.status === 'processing' ? (
                            <span className="jc-badge error">Stuck</span>
                        ) : (
                            <span className={`jc-badge ${j.status}`}>{j.status}</span>
                        )}
                      </div>
                    )})
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REALTIME LIVE TRANSLATE VIEW */}
          {view === 'realtime' && (
            <div className="view active">
              <div className="sec-head">
                <div className="sec-title">Live Translate</div>
                <div className="sec-count">Speak and instantly translate across languages</div>
              </div>
              
              <div className="upload-zone" style={{ textAlign: 'center', padding: '3rem 2rem', marginBottom: '1.5rem' }}>
                <div className={`upload-icon ${isRecording ? 'pulse' : ''}`}>🎙</div>
                <div className="upload-title" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Real-Time Engine</div>
                
                {/* Manual Transcription Language & Translation Target Dropdowns */}
                <div style={{ display: 'flex', gap: '1rem', maxWidth: '600px', margin: '0 auto 1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  
                  {/* Manual Transcription Language Dropdown */}
                  <div className="form-grp" style={{ flex: 1, minWidth: '220px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-2)', fontSize: '0.88rem', fontWeight: 600 }}>
                      Transcription Language
                    </label>
                    <select 
                      value={transcribeLang} 
                      onChange={(e) => setTranscribeLang(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '0.65rem 1rem', 
                        borderRadius: '8px', 
                        background: 'var(--card-2)', 
                        border: '1px solid var(--wire)', 
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="auto">Auto Detect</option>
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>

                  {/* Manual Target Translation Language Dropdown */}
                  <div className="form-grp" style={{ flex: 1, minWidth: '220px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-2)', fontSize: '0.88rem', fontWeight: 600 }}>
                      Translate to
                    </label>
                    <select 
                      value={liveTargetLang} 
                      onChange={(e) => setLiveTargetLang(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '0.65rem 1rem', 
                        borderRadius: '8px', 
                        background: 'var(--card-2)', 
                        border: '1px solid var(--wire)', 
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-generate" 
                    onClick={toggleLiveRecording} 
                    style={{ 
                      padding: '1rem 3rem', 
                      fontSize: '1.05rem', 
                      borderRadius: '50px',
                      background: isRecording ? 'var(--rose)' : '',
                      boxShadow: isRecording ? '0 0 15px var(--rose-border)' : ''
                    }}
                  >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </button>
                  
                  <button
                    className="export-btn"
                    onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                    style={{
                      padding: '0.9rem 2rem',
                      fontSize: '1.02rem',
                      borderRadius: '50px',
                      background: isTtsEnabled ? 'rgba(0, 224, 150, 0.1)' : 'transparent',
                      color: isTtsEnabled ? 'var(--volt)' : 'var(--text-3)',
                      borderColor: isTtsEnabled ? 'var(--volt-border)' : 'var(--wire)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{isTtsEnabled ? '🔊 Voice Output ON' : '🔇 Voice Output OFF'}</span>
                  </button>
                </div>
              </div>

              <div className="notes-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '2rem' }}>
                <div className="notes-body" style={{ minHeight: '220px', padding: '1.5rem', borderColor: 'var(--wire-2)' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between' }}>
                    Original Speech 
                    <span style={{ fontSize: '0.75rem', color: isRecording ? 'var(--volt)' : 'var(--text-3)', fontWeight: 'normal', fontFamily: "'Fira Code',monospace" }}>
                      {liveStatus}
                    </span>
                  </h3>
                  <div style={{ fontSize: '1.05rem', lineHeight: 1.6, color: liveOriginalText || liveInterimText ? 'var(--text)' : 'var(--text-3)' }}>
                    {liveOriginalText || (liveInterimText ? "" : "Waiting for audio...")}
                    {liveInterimText && (
                      <span style={{ color: 'var(--text-2)', fontStyle: 'italic', opacity: 0.85 }}>
                        {liveInterimText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="notes-body" style={{ minHeight: '220px', padding: '1.5rem', borderColor: 'var(--volt-border)' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--volt)' }}>Live Translation</h3>
                  <div style={{ fontSize: '1.05rem', lineHeight: 1.6, color: liveTranslatedText ? 'var(--text)' : 'var(--text-3)' }}>
                    {liveTranslatedText || "Translation will appear here..."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ALL NOTES / HISTORY VIEW */}
          {view === 'history' && (
            <div className="view active">
              <div className="sec-head">
                <div className="sec-title">All Transcripts</div>
                <div className="sec-count">{jobs.length} items</div>
              </div>

              <div className="jobs-list">
                {jobs.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📂</span>
                    <div className="empty-ttl">No transcripts yet</div>
                    <div className="empty-sub">Upload a video to generate your first transcripts.</div>
                  </div>
                ) : (
                  jobs.map((j) => (
                    <div key={j.id} className="job-card" onClick={() => openJob(j.id)}>
                      <div className="jc-icon">🎬</div>
                      <div>
                        <div className="jc-name">{j.fileName || "Untitled"}</div>
                        <div className="jc-meta">
                          {fmtDate(j.createdAt)} · {j.language}
                          {j.targetLanguage ? ` → ${j.targetLanguage}` : ''}
                        </div>
                      </div>
                      <span className={`jc-badge ${j.status}`}>{j.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW NOTES DETAILS VIEW */}
          {view === 'notes' && selectedJob && (
            <div className="view active">
              <div className="notes-topbar">
                <button className="back-btn" onClick={() => handleSwitchView('history')}>← Back</button>
                <div className="notes-file-title">{selectedJob.fileName || "Notes"}</div>
                
                {selectedJobFull && selectedJobFull.status === 'done' && (
                  <div className="export-row">
                    <button className="export-btn" onClick={() => handleDownload('md')}>Markdown</button>
                    <button className="export-btn" onClick={() => handleDownload('srt')}>SRT</button>
                    <button className="export-btn" onClick={() => handleDownload('vtt')}>VTT</button>
                    
                    {selectedJobFull.audioSummaryPath && (
                      <button 
                        className="export-btn" 
                        onClick={() => handleDownload('audio')}
                        style={{ color: 'var(--volt)', borderColor: 'var(--volt-border)' }}
                      >
                        🎧 Download Audio
                      </button>
                    )}
                    

                    
                    <div style={{ flex: 1 }}></div>
                    
                    <button 
                      className="export-btn" 
                      onClick={handleDeleteNote}
                      style={{ color: '#ff4d4f', borderColor: 'rgba(255,77,79,0.3)' }}
                    >
                      🗑 Delete Note
                    </button>
                  </div>
                )}
              </div>

              <div className="notes-grid">
                
                {/* Notes Content Body */}
                <div className="notes-body">
                  {selectedJobFull ? (
                    selectedJobFull.notes ? (
                      <div>
                        {selectedJobFull.qualityStatus && selectedJobFull.qualityStatus !== 'good' && (
                          <div style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--rose)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255, 77, 79, 0.3)' }}>
                            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                              ⚠️ {selectedJobFull.qualityStatus === 'hallucination' ? 'Possible Hallucination Detected' : 'Low Quality Audio'}
                            </strong>
                            {selectedJobFull.rejectionReason}
                          </div>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: mdToHtml(selectedJobFull.notes) }} />
                      </div>
                    ) : selectedJobFull.status === 'processing' ? (
                      <div style={{ color: 'var(--text-2)', padding: '2rem', textAlign: 'center' }}>
                        <div className="spin" style={{ margin: '0 auto 1rem', display: isJobStuck(selectedJobFull) ? 'none' : 'block' }}></div>
                        {isJobStuck(selectedJobFull) ? (
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ color: 'var(--amber)', fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    ⚠ Processing appears stuck
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    This job hasn't updated its progress in over 10 minutes.
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button className="btn-generate" onClick={(e) => handleRetry(selectedJobFull.id, e)}>Retry</button>
                                    <button className="export-btn" style={{ borderColor: 'rgba(255,77,79,0.3)', color: '#ff4d4f' }} onClick={(e) => handleDeleteNote(e)}>Delete</button>
                                </div>
                            </div>
                        ) : (
                            <div>Still processing — check back shortly.</div>
                        )}
                        
                        {selectedJobFull.logs && selectedJobFull.logs.length > 0 && (
                            <div style={{ marginTop: '2rem', textAlign: 'left', background: 'var(--card-2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--wire)' }}>
                                <h4 style={{ color: 'var(--text)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Pipeline Logs</span>
                                </h4>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                    {selectedJobFull.logs.map((l, i) => (
                                        <div key={i} style={{ marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--text-2)' }}>[{new Date(l.timestamp).toLocaleTimeString()}]</span> <span style={{ color: 'var(--text)' }}>{l.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                      </div>
                    ) : selectedJobFull.status === 'error' ? (
                      <div style={{ color: 'var(--rose)', padding: '1rem' }}>
                        Error: {selectedJobFull.error || "Processing failed."}
                      </div>
                    ) : (
                      "No notes available."
                    )
                  ) : (
                    <div style={{ color: 'var(--text-2)', padding: '2rem', textAlign: 'center' }}>
                      <div className="spin" style={{ margin: '0 auto 1rem' }}></div>
                      Loading notes…
                    </div>
                  )}
                </div>

                {/* Sidebar Info Panel */}
                <div className="notes-sidebar">
                  {selectedJobFull && selectedJobFull.status === 'done' && (
                    <div className="media-container mb-3" style={{ display: 'block', marginBottom: '1.25rem' }}>
                      {/* Audio Player */}
                      {selectedJobFull.fileName && 
                       (selectedJobFull.fileName.toLowerCase().endsWith(".mp3") || 
                        selectedJobFull.fileName.toLowerCase().endsWith(".wav")) && (
                        <audio controls style={{ width: '100%', borderRadius: '10px', boxShadow: 'var(--shadow)' }}>
                          <source 
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/download/${selectedJobFull.id}/audio?token=${localStorage.getItem("token")}`} 
                            type="audio/mpeg" 
                          />
                        </audio>
                      )}
                    </div>
                  )}

                  <div className="info-card">
                    <div className="info-card-title">📄 Job info</div>
                    <div className="info-row">
                      <span className="info-label">File</span>
                      <span className="info-val">{selectedJob.fileName || "—"}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Language</span>
                      <span className="info-val">{selectedJob.language || "—"}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Translated</span>
                      <span className="info-val">{selectedJob.targetLanguage || "None"}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Status</span>
                      <span className="info-val" style={{ color: selectedJob.status === 'done' ? 'var(--volt)' : 'var(--amber)' }}>
                        {selectedJob.status || "—"}
                      </span>
                    </div>
                    {selectedJobFull && selectedJobFull.status === 'done' && (
                      <>
                        <div className="info-row">
                          <span className="info-label">Quality</span>
                          <span className="info-val" style={{ color: selectedJobFull.qualityStatus === 'good' ? 'var(--volt)' : 'var(--rose)' }}>
                            {selectedJobFull.qualityStatus === 'good' ? 'Good' : (selectedJobFull.qualityStatus === 'hallucination' ? 'Rejected' : 'Low Conf')}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Lang Conf</span>
                          <span className="info-val">{Math.round((selectedJobFull.languageConfidence || 0) * 100)}%</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Audio Conf</span>
                          <span className="info-val">{Math.round((selectedJobFull.transcriptConfidence || 0) * 100)}%</span>
                        </div>
                      </>
                    )}
                    <div className="info-row">
                      <span className="info-label">Created</span>
                      <span className="info-val">{fmtDate(selectedJob.createdAt)}</span>
                    </div>
                  </div>

                  {selectedJobFull && (selectedJobFull.srtText || selectedJobFull.vttText) && (
                    <div className="info-card mt-2">
                      <div className="info-card-title">📝 Subtitle files</div>
                      <a className="dl-link" href="#" onClick={(e) => { e.preventDefault(); handleDownload('srt'); }}>
                        ↓ Download .SRT
                      </a>
                      <a className="dl-link" href="#" onClick={(e) => { e.preventDefault(); handleDownload('vtt'); }}>
                        ↓ Download .VTT
                      </a>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
