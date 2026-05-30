import { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Languages, Trash2, Copy, Check, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LANGUAGES = [
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { code: 'es-ES', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { code: 'de-DE', label: 'German', flag: '🇩🇪' },
  { code: 'ja-JP', label: 'Japanese', flag: '🇯🇵' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ar-SA', label: 'Arabic', flag: '🇸🇦' },
  { code: 'pt-BR', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'ko-KR', label: 'Korean', flag: '🇰🇷' },
  { code: 'it-IT', label: 'Italian', flag: '🇮🇹' },
  { code: 'ru-RU', label: 'Russian', flag: '🇷🇺' },
];

export default function LiveMeeting() {
  // ── All original state & logic preserved ────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [sourceLang, setSourceLang] = useState('en-US');
  const [interimText, setInterimText] = useState('');
  const [lines, setLines] = useState([]);
  const [copied, setCopied] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, interimText]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setTimeout(() => setSupported(false), 0);
  }, []);

  const startRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = sourceLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setIsRecording(true); setError(null); };
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            setLines(prev => [...prev, { original: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
            setInterimText('');
          }
        } else { interim += result[0].transcript; }
      }
      setInterimText(interim);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') setError('Microphone access was denied. Please allow microphone access in your browser.');
      else if (event.error !== 'no-speech') setError(`Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition && isRecording) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [sourceLang, isRecording]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  const toggleRecording = () => { isRecording ? stopRecognition() : startRecognition(); };

  const handleSourceChange = (e) => {
    setSourceLang(e.target.value);
    if (isRecording) { stopRecognition(); setTimeout(() => startRecognition(), 100); }
  };

  const clearTranscript = () => { setLines([]); setInterimText(''); };

  const copyTranscript = () => {
    const text = lines.map(l => `[${l.timestamp}] ${l.original}`).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const fullText = lines.map(l => l.original).join(' ');
  const wordCount = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
  const sourceLangLabel = LANGUAGES.find(l => l.code === sourceLang);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Radio size={16} style={{ color: isRecording ? '#F472B6' : '#7C3AED' }} />
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: '#fff', margin: 0 }}>
              Live Transcription
            </h2>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.78rem', fontFamily: 'Fira Code, monospace' }}>
            Powered by Web Speech API · Browser-native
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Language selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.4rem 0.75rem' }}>
            <Languages size={13} style={{ color: '#64748B' }} />
            <select
              value={sourceLang}
              onChange={handleSourceChange}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ background: '#111827' }}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>

          {/* Record button */}
          <motion.button
            onClick={toggleRecording}
            disabled={!supported}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem', borderRadius: '10px', border: 'none', cursor: supported ? 'pointer' : 'not-allowed',
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.875rem',
              background: isRecording ? 'rgba(244,114,182,0.15)' : 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              color: isRecording ? '#F472B6' : '#fff',
              outline: isRecording ? '1px solid rgba(244,114,182,0.4)' : 'none',
              boxShadow: isRecording ? '0 0 20px rgba(244,114,182,0.2)' : '0 0 20px rgba(124,58,237,0.3)',
            }}
          >
            {isRecording ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Start Recording</>}
          </motion.button>
        </div>
      </div>

      {/* ── Warnings ────────────────────────────────────── */}
      {!supported && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.25)', color: '#F472B6', fontSize: '0.85rem' }}>
          ⚠ Your browser doesn't support the Web Speech API. Use <strong>Google Chrome</strong> or Microsoft Edge.
        </div>
      )}
      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.25)', color: '#F472B6', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Recording indicator ──────────────────────────── */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', background: 'rgba(244,114,182,0.07)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '10px' }}
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#F472B6', display: 'inline-block' }}
            />
            <span style={{ fontSize: '0.78rem', color: '#F472B6', fontFamily: 'Fira Code, monospace', letterSpacing: '0.04em' }}>
              REC · Listening in {sourceLangLabel?.label}…
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transcript Panel ─────────────────────────────── */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: '320px', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Transcript · {lines.length} utterances · {wordCount} words
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={copyTranscript} disabled={lines.length === 0}
              style={{ padding: '0.3rem 0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: copied ? '#10B981' : '#64748B', cursor: lines.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'color 0.2s' }}
            >
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
            <button
              onClick={clearTranscript} disabled={lines.length === 0}
              style={{ padding: '0.3rem 0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#64748B', cursor: lines.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {lines.length === 0 && !interimText && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#334155', paddingTop: '3rem' }}>
              <Mic size={36} style={{ opacity: 0.2 }} />
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                {supported ? 'Click "Start Recording" and speak…' : 'Use Chrome or Edge for live transcription'}
              </span>
            </div>
          )}

          {lines.map((line, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
            >
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.62rem', color: '#334155', whiteSpace: 'nowrap', paddingTop: '0.25rem', flexShrink: 0 }}>
                {line.timestamp}
              </span>
              <p style={{ margin: 0, color: '#E2E8F0', fontSize: '0.92rem', lineHeight: 1.65 }}>
                {line.original}
              </p>
            </motion.div>
          ))}

          {interimText && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.62rem', color: '#334155', whiteSpace: 'nowrap', paddingTop: '0.25rem', flexShrink: 0 }}>
                live…
              </span>
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.92rem', lineHeight: 1.65, fontStyle: 'italic' }}>
                {interimText}
              </p>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}
