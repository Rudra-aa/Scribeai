import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Upload, Cpu, FileText, Mic, Languages, Download, Zap, Shield, ChevronDown, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── DATA ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    step: '01', icon: Upload, title: 'Upload or Link',
    desc: 'Drop a video file (MP4, MOV, MKV, WebM up to 500 MB) or paste a YouTube URL directly.',
    color: '#7C3AED',
  },
  {
    step: '02', icon: Cpu, title: 'AI Processes',
    desc: 'Whisper AI transcribes your audio with 98% accuracy. Choose source language or auto-detect.',
    color: '#06B6D4',
  },
  {
    step: '03', icon: FileText, title: 'Export Everything',
    desc: 'Get structured notes, SRT/VTT subtitles, and translated outputs — downloadable in seconds.',
    color: '#10B981',
  },
];

const features = [
  {
    title: '50+ Language Transcription',
    desc: 'Audio converted to text with 98% accuracy. Auto-detect language or choose manually.',
    icon: Languages, accent: '#7C3AED',
    terminal: ['> whisper.detect_language()', '> confidence: 98.4%', '> status: complete'],
  },
  {
    title: 'Speaker Diarisation',
    desc: 'Automatically identify and label different speakers in meetings and lectures.',
    icon: Mic, accent: '#06B6D4',
    terminal: ['> diarize.speakers()', '> found: 3 speakers', '> labels: assigned'],
  },
  {
    title: 'All Export Formats',
    desc: 'Export as Markdown notes, SRT subtitles, VTT files, or download the dubbed video.',
    icon: Download, accent: '#10B981',
    terminal: ['> export.formats()', '> md, srt, vtt, mp4', '> ready: true'],
  },
  {
    title: 'No Video Length Limit',
    desc: 'Process hour-long lectures and full-length meetings. Priority queue for pro users.',
    icon: Zap, accent: '#F59E0B',
    terminal: ['> process.duration()', '> 3.5 hours → 8min', '> status: done'],
  },
  {
    title: 'Real-Time Translation',
    desc: 'Live speech-to-text with simultaneous translation across 50+ language pairs. (Video-to-Video coming soon!)',
    icon: Mic, accent: '#F472B6',
    terminal: ['> live.translate()', '> en → hi: active', '> latency: 120ms'],
  },
  {
    title: 'Secure & Private',
    desc: 'All files are processed securely. Your data is never used for model training.',
    icon: Shield, accent: '#8B5CF6',
    terminal: ['> security.check()', '> encryption: AES256', '> GDPR: compliant'],
  },
];

const useCases = [
  { emoji: '🎓', role: 'Students', desc: 'Convert lecture recordings into structured notes and study guides instantly. Never miss a key concept.' },
  { emoji: '🔬', role: 'Researchers', desc: 'Transcribe interviews and fieldwork audio in any language. Export citations-ready text.' },
  { emoji: '📹', role: 'Content Creators', desc: 'Generate accurate subtitles for YouTube videos and podcasts in minutes, not hours.' },
  { emoji: '🏢', role: 'Remote Teams', desc: 'Turn meeting recordings into searchable transcripts with speaker labels and action items.' },
];

const testimonials = [
  {
    name: 'Aisha K.',
    role: 'PhD Researcher, University of Edinburgh',
    avatar: 'AK',
    text: 'ScribeAI cut my transcription time from 4 hours to 8 minutes. The accuracy on Hindi-English mixed speech is genuinely impressive.',
  },
  {
    name: 'Marcus R.',
    role: 'Content Creator, 280K subscribers',
    avatar: 'MR',
    text: 'I used to spend Sunday nights captioning videos. Now I upload, wait 5 minutes, and the SRT file is perfect. Game changer.',
  },
  {
    name: 'Priya S.',
    role: 'Product Manager, Series B startup',
    avatar: 'PS',
    text: 'We use it every week for user research interviews. Speaker diarisation is the killer feature — I can\'t imagine doing this manually now.',
  },
];

const faqs = [
  {
    q: 'How accurate is the transcription?',
    a: 'ScribeAI uses OpenAI\'s Whisper model, which achieves 98%+ accuracy on clear audio in most languages. Accuracy improves further when you manually select the source language.',
  },
  {
    q: 'What video formats are supported?',
    a: 'MP4, MOV, AVI, MKV, WebM, and most common audio formats (MP3, WAV). Files up to 500 MB are supported. YouTube URLs are also accepted directly.',
  },
  {
    q: 'Which languages are available?',
    a: 'ScribeAI supports 50+ languages including English, Hindi, Spanish, French, German, Japanese, Chinese, Arabic, Portuguese, Korean, Italian, and Russian.',
  },
  {
    q: 'Is my data stored permanently?',
    a: 'Files are stored securely in Firebase. You own your data and can delete any transcript at any time from your dashboard. We do not use your data to train models.',
  },
  {
    q: 'What is Live Translation?',
    a: 'Live Translation uses your browser\'s Speech Recognition API to transcribe speech in real-time, then uses the AI backend to translate it simultaneously — ideal for live meetings.',
  },
  {
    q: 'Can I export to subtitle formats?',
    a: 'Yes. Every transcript can be downloaded as Markdown, SRT, or WebVTT. You can also download the original video with subtitles burned in.',
  },
];

const integrations = [
  { name: 'Voxo', icon: '🎙️', desc: 'Real-time translation API' },
  { name: 'Whisper AI', icon: '🤖', desc: 'Transcription engine' },
  { name: 'Firebase', icon: '🔥', desc: 'Auth & storage' },
  { name: 'Socket.io', icon: '⚡', desc: 'Real-time sync' },
  { name: 'Python', icon: '🐍', desc: 'AI processing' },
  { name: 'React', icon: '⚛️', desc: 'Frontend' },
  { name: 'Vite', icon: '🚀', desc: 'Build system' },
];

const plans = [
  {
    name: 'Free', price: '$0', period: '/month',
    desc: 'Perfect for trying out ScribeAI',
    badge: null, cta: 'Start for free', ctaStyle: 'outline',
    features: ['3 videos per month', 'Up to 30 min per video', '10 language transcription', 'Markdown export', 'Standard processing queue'],
  },
  {
    name: 'Pro', price: '$12', period: '/month',
    desc: 'For students, researchers, and creators',
    badge: 'Most Popular', cta: 'Go Unlimited', ctaStyle: 'gradient',
    features: ['Unlimited videos', 'No video length limit', '50+ language transcription', 'All export formats (SRT, VTT, MP4)', 'Speaker diarisation', 'Priority processing queue', 'Real-time live translation'],
  },
];

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function ScrollCard({ children, className = '' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['0 1', '1.1 1'] });
  const y = useTransform(scrollYProgress, [0, 1], [50, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionHeader({ badge, badgeColor, title, accent, subtitle }) {
  return (
    <ScrollCard>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <span style={{
          display: 'inline-block', padding: '0.25rem 0.875rem', borderRadius: '999px',
          background: `${badgeColor}15`, border: `1px solid ${badgeColor}40`,
          color: badgeColor, fontSize: '0.75rem', fontFamily: 'Fira Code, monospace',
          letterSpacing: '0.06em', marginBottom: '1.25rem',
        }}>
          {badge}
        </span>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: '#fff', marginBottom: '1rem', lineHeight: 1.1 }}>
          {title}{' '}<span className="text-gradient">{accent}</span>
        </h2>
        {subtitle && (
          <p style={{ color: '#94A3B8', fontSize: '1.05rem', maxWidth: '38rem', margin: '0 auto', lineHeight: 1.7 }}>
            {subtitle}
          </p>
        )}
      </div>
    </ScrollCard>
  );
}

function Section({ id, children }) {
  return (
    <section id={id} style={{ position: 'relative', padding: '7rem 1.5rem', maxWidth: '1750px', margin: '0 auto', width: '100%' }}>
      {children}
    </section>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', maxWidth: '1750px', margin: '0 auto', width: '100%' }} />;
}

// ─── FAQ ITEM ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div
      className="glass-panel rounded-2xl overflow-hidden cursor-pointer"
      style={{ marginBottom: '0.75rem' }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', gap: '1rem' }}>
        <p style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>
          {q}
        </p>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ flexShrink: 0, color: '#7C3AED' }}
        >
          <ChevronDown size={18} />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div style={{ padding: '0 1.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '1rem 0 0', color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.7 }}>{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LandingSections() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <>
      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <Section id="how">
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '350px', background: 'radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <SectionHeader badge="WORKFLOW" badgeColor="#06B6D4" title="From video to notes in" accent="minutes" subtitle="Three steps. Zero manual effort. Complete knowledge extraction." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          {steps.map((step, i) => (
            <ScrollCard key={i}>
              <div className="glass-panel rounded-2xl h-full" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-8px', right: '16px', fontSize: '5.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.025)', fontFamily: 'Space Grotesk, sans-serif', userSelect: 'none', lineHeight: 1 }}>
                  {step.step}
                </div>
                <div style={{ width: 46, height: 46, borderRadius: '13px', background: `${step.color}15`, border: `1px solid ${step.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <step.icon size={21} style={{ color: step.color }} />
                </div>
                <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.625rem' }}>{step.title}</h3>
                <p style={{ color: '#94A3B8', lineHeight: 1.7, fontSize: '0.9rem', margin: 0 }}>{step.desc}</p>
              </div>
            </ScrollCard>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <Section id="features">
        <div style={{ position: 'absolute', top: '50%', right: '-100px', transform: 'translateY(-50%)', width: '500px', height: '500px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <SectionHeader badge="CAPABILITIES" badgeColor="#7C3AED" title="Architected for" accent="brilliance" subtitle="Every feature is precisely engineered to turn audio into actionable intelligence." />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
          {features.map((f, i) => {
            const isWide = i === 0 || i === 3;
            return (
              <ScrollCard key={i} className={isWide ? "xl:col-span-2" : "col-span-1"}>
                <motion.div
                  whileHover={{ y: -3, boxShadow: `0 16px 48px -8px ${f.accent}25` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="glass-panel rounded-3xl h-full flex flex-col md:flex-row overflow-hidden relative"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className={`p-8 ${isWide ? 'md:w-1/2' : 'w-full'} flex flex-col justify-center h-full`}>
                    <div style={{ width: 48, height: 48, borderRadius: '14px', background: `${f.accent}14`, border: `1px solid ${f.accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <f.icon size={24} style={{ color: f.accent }} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '0.75rem', fontWeight: 600 }}>{f.title}</h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>{f.desc}</p>
                    
                    {!isWide && (
                      <div className="mt-auto" style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '12px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'Fira Code, monospace', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {['rgba(244,114,182,0.5)', 'rgba(245,158,11,0.5)', 'rgba(16,185,129,0.5)'].map((c, j) => (
                            <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                          ))}
                        </div>
                        {f.terminal.map((line, j) => (
                          <div key={j} style={{ color: j === 0 ? '#64748B' : j === f.terminal.length - 1 ? '#10B981' : f.accent, marginBottom: j < f.terminal.length - 1 ? '4px' : 0 }}>
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isWide && (
                    <div className="md:w-1/2 bg-black/40 border-t md:border-t-0 md:border-l border-white/5 relative overflow-hidden flex items-center justify-center p-6 h-full min-h-[250px]">
                      {i === 0 ? (
                         <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0B1020] shadow-2xl p-4">
                           <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                             <div className="px-3 py-1.5 rounded-lg bg-[#7C3AED]/20 text-[#A78BFA] text-xs font-bold font-mono border border-[#7C3AED]/30">English</div>
                             <ArrowRight className="w-4 h-4 text-white/30" />
                             <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold font-mono border border-emerald-500/30">Spanish</div>
                           </div>
                           <div className="space-y-3">
                             <div className="h-2.5 bg-white/10 rounded-full w-3/4"></div>
                             <div className="h-2.5 bg-white/10 rounded-full w-full"></div>
                             <div className="h-2.5 bg-[#7C3AED]/40 rounded-full w-5/6"></div>
                           </div>
                         </div>
                      ) : (
                         <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0B1020] shadow-2xl p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-center text-xs font-mono text-white/50">
                               <span>00:00:00</span>
                               <span className="text-amber-400 font-bold tracking-widest">03:45:12</span>
                            </div>
                            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                               <motion.div animate={{ width: ['0%', '85%', '85%'] }} transition={{ duration: 3, repeat: Infinity }} className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]"></motion.div>
                            </div>
                            <div className="text-center text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">Processing 3.5 hour lecture</div>
                         </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </ScrollCard>
            )
          })}
        </div>
      </Section>

      <Divider />

      {/* ── USE CASES ────────────────────────────────────────── */}
      <Section id="use-cases">
        <SectionHeader badge="USE CASES" badgeColor="#10B981" title="Built for the" accent="curious" subtitle="Whether you're in a lecture hall, a lab, or a recording studio — ScribeAI fits your workflow." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.1rem', position: 'relative', zIndex: 1 }}>
          {useCases.map((uc, i) => (
            <ScrollCard key={i}>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="glass-panel rounded-2xl"
                style={{ padding: '1.75rem' }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{uc.emoji}</div>
                <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.5rem' }}>{uc.role}</h3>
                <p style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.65, margin: 0 }}>{uc.desc}</p>
              </motion.div>
            </ScrollCard>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── STATS STRIP ──────────────────────────────────────── */}
      <div style={{ padding: '4rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3.5rem' }}>
          {[
            { n: '50+', label: 'Languages supported' },
            { n: '98%', label: 'Transcription accuracy' },
            { n: '<3min', label: 'Per hour of audio' },
            { n: '500MB', label: 'Max file size' },
          ].map((stat, i) => (
            <ScrollCard key={i}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.75rem', fontWeight: 900, fontFamily: 'Space Grotesk, sans-serif', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
                  {stat.n}
                </div>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>{stat.label}</div>
              </div>
            </ScrollCard>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <Section id="testimonials">
        <SectionHeader badge="TESTIMONIALS" badgeColor="#F59E0B" title="Trusted by the" accent="curious" subtitle="Real feedback from students, researchers, and creators using ScribeAI every week." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem', position: 'relative', zIndex: 1 }}>
          {testimonials.map((t, i) => (
            <ScrollCard key={i}>
              <div className="glass-panel rounded-2xl" style={{ padding: '1.75rem', height: '100%' }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: '3px', marginBottom: '1rem' }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={13} style={{ color: '#F59E0B', fill: '#F59E0B' }} />)}
                </div>
                <p style={{ color: '#CBD5E1', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1.25rem', fontStyle: 'italic' }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 700 }}>{t.name}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            </ScrollCard>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── INTEGRATIONS ─────────────────────────────────────── */}
      <div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <ScrollCard>
          <p style={{ color: '#64748B', fontSize: '0.78rem', fontFamily: 'Fira Code, monospace', letterSpacing: '0.08em', marginBottom: '2rem' }}>
            BUILT ON PROVEN TECHNOLOGY
          </p>
        </ScrollCard>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', maxWidth: '48rem', margin: '0 auto' }}>
          {integrations.map((int, i) => (
            <ScrollCard key={i}>
              <div className="glass-panel rounded-xl" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{int.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>{int.name}</div>
                  <div style={{ color: '#64748B', fontSize: '0.68rem' }}>{int.desc}</div>
                </div>
              </div>
            </ScrollCard>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── PRICING ──────────────────────────────────────────── */}
      <Section id="pricing">
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <SectionHeader badge="PRICING" badgeColor="#10B981" title="Simple," accent="transparent pricing" subtitle="Start free. Upgrade when you need more." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem', maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {plans.map((plan, i) => (
            <ScrollCard key={i}>
              <div
                className="glass-panel rounded-2xl h-full"
                style={{
                  padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column',
                  border: plan.badge ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: plan.badge ? '0 0 60px -20px rgba(124,58,237,0.25)' : 'none',
                }}
              >
                {plan.badge && (
                  <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', padding: '0.2rem 0.875rem', borderRadius: '999px', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', fontSize: '0.72rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.25rem' }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '2.75rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>{plan.price}</span>
                    <span style={{ color: '#64748B', fontSize: '0.875rem' }}>{plan.period}</span>
                  </div>
                  <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.375rem', marginBottom: 0 }}>{plan.desc}</p>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {plan.features.map((feat, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.5 }}>
                      <span style={{ color: '#10B981', flexShrink: 0, fontWeight: 700 }}>✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <button
                    style={{
                      width: '100%', padding: '0.8rem', borderRadius: '12px', fontWeight: 700,
                      fontSize: '0.9rem', cursor: 'pointer', transition: 'opacity 0.2s',
                      background: plan.ctaStyle === 'gradient' ? 'linear-gradient(135deg, #7C3AED, #06B6D4)' : 'transparent',
                      color: plan.ctaStyle === 'gradient' ? '#fff' : '#94A3B8',
                      border: plan.ctaStyle === 'gradient' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            </ScrollCard>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <Section id="faq">
        <SectionHeader badge="FAQ" badgeColor="#A78BFA" title="Common" accent="questions" subtitle="Everything you need to know before uploading your first video." />

        <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {faqs.map((faq, i) => (
            <ScrollCard key={i}>
              <FaqItem
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            </ScrollCard>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <div style={{ padding: '7rem 1.5rem', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.1) 0%, transparent 55%)', pointerEvents: 'none' }} />
        <ScrollCard>
          <div className="glass-panel rounded-3xl" style={{ maxWidth: '680px', margin: '0 auto', padding: '3.5rem 2rem', position: 'relative' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'Fira Code, monospace', color: '#06B6D4', letterSpacing: '0.08em', display: 'block', marginBottom: '1rem' }}>
              // READY TO START?
            </span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#fff', marginBottom: '1rem', lineHeight: 1.15 }}>
              Upload your first video free.
            </h2>
            <p style={{ color: '#94A3B8', marginBottom: '2rem', fontSize: '1rem', lineHeight: 1.7 }}>
              No credit card required. Powered by Whisper AI &amp; Firebase Firestore.
            </p>
            <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/auth">
                <button style={{
                  padding: '0.825rem 1.875rem', borderRadius: '12px', fontWeight: 700,
                  background: '#fff', color: '#05060A', border: 'none', cursor: 'pointer',
                  fontSize: '0.95rem', fontFamily: 'Space Grotesk, sans-serif',
                }}>
                  Create free account →
                </button>
              </Link>
              <a href="#pricing">
                <button style={{
                  padding: '0.825rem 1.875rem', borderRadius: '12px', fontWeight: 600,
                  background: 'transparent', color: '#94A3B8',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.95rem',
                }}>
                  View pricing
                </button>
              </a>
            </div>
          </div>
        </ScrollCard>
      </div>
    </>
  );
}
