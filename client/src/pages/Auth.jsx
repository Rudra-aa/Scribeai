import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowLeft, Sparkles } from 'lucide-react';

// ─── PASSWORD STRENGTH ──────────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  const calc = (v) => {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  };
  const score = calc(password);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
  if (!password) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{ flex: 1, height: '3px', borderRadius: '2px', background: n <= score ? colors[score] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '0.72rem', color: colors[score], fontFamily: 'Fira Code, monospace' }}>
        {labels[score]}
      </span>
    </div>
  );
}

// ─── FLOATING ORBS (Left Panel) ─────────────────────────────────────────────────
function FloatingOrb({ size, color, x, y, delay }) {
  return (
    <motion.div
      animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, filter: `blur(${size * 0.6}px)`, left: x, top: y, pointerEvents: 'none' }}
    />
  );
}

// ─── INPUT FIELD ────────────────────────────────────────────────────────────────
function OsInput({ label, type, placeholder, value, onChange, rightEl }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.02em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', padding: '0.75rem 1rem', paddingRight: rightEl ? '2.5rem' : '1rem',
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${focused ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px', color: '#fff', fontSize: '0.9rem', outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.15), 0 0 20px rgba(124,58,237,0.1)' : 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'Inter, sans-serif',
          }}
        />
        {rightEl && (
          <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
            {rightEl}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN AUTH COMPONENT ────────────────────────────────────────────────────────
export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [showReset, setShowReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Auth Logic (unchanged from original) ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email) return setError('Please enter your email address.');
    if (!password) return setError('Please enter your password.');
    if (mode === 'signup') {
      if (!name) return setError('Please enter your name.');
      if (password.length < 8) return setError('Password must be at least 8 characters.');
      if (password !== confirm) return setError("Passwords don't match.");
    }
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`http://localhost:5001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Authentication failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name || '');
      localStorage.setItem('userEmail', data.email || '');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter your email.');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowReset(false);
      setResetSuccess(true);
    }, 1000);
  };

  const switchMode = (m) => { setMode(m); setError(null); };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#05060A', fontFamily: 'Inter, sans-serif' }}>

      {/* ── LEFT PANEL ──────────────────────────────────────── */}
      <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '3rem', background: 'linear-gradient(145deg, #0B1020 0%, #05060A 100%)' }}
        className="hidden lg:flex">

        {/* Ambient orbs */}
        <FloatingOrb size={300} color="rgba(124,58,237,0.15)" x="10%" y="15%" delay={0} />
        <FloatingOrb size={200} color="rgba(6,182,212,0.1)" x="60%" y="50%" delay={2} />
        <FloatingOrb size={150} color="rgba(124,58,237,0.08)" x="20%" y="70%" delay={1} />

        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '9px', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fira Code, monospace', fontSize: '0.8rem', fontWeight: 700, color: '#fff', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
              S
            </div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>ScribeAI</span>
          </Link>

          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.3rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4', fontSize: '0.72rem', fontFamily: 'Fira Code, monospace', marginBottom: '1.5rem' }}>
              <Sparkles size={11} /> Whisper AI · v3.0 Online
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#fff', lineHeight: 1.1, marginBottom: '1rem' }}>
              Your notes,<br />
              <span style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                written for you.
              </span>
            </h1>
            <p style={{ color: '#94A3B8', lineHeight: 1.7, maxWidth: '340px', fontSize: '1rem' }}>
              Upload any video and get structured notes, AI summaries, and subtitles — in any language, in minutes.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem' }}>
            {[
              { n: '50+', l: 'Languages' },
              { n: '98%', l: 'Accuracy' },
              { n: '<3m', l: 'Per hour' },
            ].map(stat => (
              <div key={stat.l}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: '1.75rem', color: '#fff', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {stat.n}
                </div>
                <div style={{ color: '#64748B', fontSize: '0.78rem', marginTop: '2px' }}>{stat.l}</div>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              'No video length limit',
              '50+ language transcription',
              'All export formats (SRT, VTT, MD)',
              'Speaker diarisation',
              'Real-time live translation',
            ].map(feat => (
              <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94A3B8', fontSize: '0.875rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#10B981', flexShrink: 0 }}>
                  ✓
                </div>
                {feat}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', color: '#334155', fontSize: '0.75rem', fontFamily: 'Fira Code, monospace' }}>
          © 2026 ScribeAI · Powered by Whisper AI · Free tier available
        </div>
      </div>

      {/* ── RIGHT PANEL (Auth Form) ──────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem', overflowY: 'auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#64748B'}>
            <ArrowLeft size={14} /> Back to home
          </Link>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div style={{ width: 26, height: 26, borderRadius: '7px', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontFamily: 'Fira Code, monospace', fontWeight: 700, color: '#fff' }}>S</div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#fff', fontSize: '1rem' }}>ScribeAI</span>
          </div>
        </div>

        {/* Card */}
        <div style={{ maxWidth: '420px', width: '100%', margin: 'auto' }}>
          <AnimatePresence mode="wait">
            {!showReset && !resetSuccess && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#fff', marginBottom: '0.4rem' }}>
                  {mode === 'signup' ? 'Create an account' : 'Welcome back'}
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                  {mode === 'signup'
                    ? (<>Already have an account? <button onClick={() => switchMode('signin')} style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Sign in</button></>)
                    : (<>Don't have an account? <button onClick={() => switchMode('signup')} style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Sign up free</button></>)
                  }
                </p>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {['signin', 'signup'].map(m => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      style={{
                        flex: 1, padding: '0.55rem', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s',
                        background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent',
                        color: mode === m ? '#fff' : '#64748B',
                        boxShadow: mode === m ? 'inset 0 0 0 1px rgba(124,58,237,0.4)' : 'none',
                      }}
                    >
                      {m === 'signin' ? 'Sign in' : 'Sign up'}
                    </button>
                  ))}
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    ⚠ {error}
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  {mode === 'signup' && (
                    <OsInput label="Full name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
                  )}
                  <OsInput label="Email address" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  <OsInput
                    label="Password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    rightEl={
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  {mode === 'signup' && password.length > 0 && <PasswordStrength password={password} />}

                  {mode === 'signup' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <OsInput
                        label="Confirm password" type={showConfirm ? 'text' : 'password'} placeholder="••••••••"
                        value={confirm} onChange={e => setConfirm(e.target.value)}
                        rightEl={
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex' }}>
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>
                  )}

                  {mode === 'signin' && (
                    <div style={{ textAlign: 'right', marginBottom: '1rem', marginTop: '-0.25rem' }}>
                      <button type="button" onClick={() => { setShowReset(true); setError(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.8rem', textDecoration: 'underline', padding: 0 }}>
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', marginTop: '1rem', padding: '0.875rem', borderRadius: '14px', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#fff', transition: 'opacity 0.2s, transform 0.1s',
                      background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                      boxShadow: '0 0 30px rgba(124,58,237,0.3)',
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading
                      ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : mode === 'signup' ? 'Create account' : 'Sign in'
                    }
                  </button>

                  {mode === 'signup' && (
                    <p style={{ color: '#64748B', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>
                      By signing up you agree to our{' '}
                      <a href="#" style={{ color: '#7C3AED', textDecoration: 'underline' }}>Terms</a>
                      {' '}and{' '}
                      <a href="#" style={{ color: '#7C3AED', textDecoration: 'underline' }}>Privacy Policy</a>.
                    </p>
                  )}
                </form>
              </motion.div>
            )}

            {showReset && !resetSuccess && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem' }}>Reset password</h2>
                <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Enter your email and we'll send a reset link.</p>
                {error && <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: '0.85rem', marginBottom: '1rem' }}>⚠ {error}</div>}
                <form onSubmit={handleResetSubmit}>
                  <OsInput label="Email address" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem', padding: '0.875rem', borderRadius: '14px', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#fff', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>
                    {loading ? '…' : 'Send reset link'}
                  </button>
                </form>
                <button onClick={() => { setShowReset(false); setError(null); }} style={{ display: 'block', margin: '1.25rem auto 0', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.82rem', textDecoration: 'underline' }}>
                  ← Back to sign in
                </button>
              </motion.div>
            )}

            {resetSuccess && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem', color: '#10B981' }}>
                  ✓
                </div>
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: '#fff', marginBottom: '0.75rem' }}>Check your inbox</h2>
                <p style={{ color: '#94A3B8', marginBottom: '2rem' }}>We've sent a password reset link to <strong style={{ color: '#fff' }}>{email}</strong>.</p>
                <button onClick={() => { setResetSuccess(false); setShowReset(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', textDecoration: 'underline', fontSize: '0.875rem' }}>
                  ← Back to sign in
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
