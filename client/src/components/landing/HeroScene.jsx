import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Play, Upload, Mic, Languages, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HeroScene() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const yText = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // Workflow Simulation State
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section ref={containerRef} className="relative pt-32 lg:pt-40 pb-20 overflow-hidden" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      
      {/* Background ambient glow */}
      <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] rounded-full blur-[150px] opacity-10" style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="w-full max-w-[1750px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
        
        {/* ================= LEFT (50-60%) ================= */}
        <motion.div 
          style={{ y: yText, opacity }} 
          className="lg:col-span-6 xl:col-span-5 flex flex-col items-start text-left"
        >
          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}
          >
            <Sparkles className="w-4 h-4" />
            <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.8rem', fontWeight: 600 }}>ScribeAI Engine v3 Live</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ fontSize: 'clamp(3rem, 5.5vw, 4.5rem)', lineHeight: 1.05, marginBottom: '1.5rem', color: '#fff', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            ScribeAI <br/>
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>turn any media into knowledge for you</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{ fontSize: '1.15rem', color: '#94A3B8', maxWidth: '36rem', marginBottom: '2.5rem', lineHeight: 1.6 }}
          >
            Upload any video or audio file. Get highly accurate transcripts, real-time translations in 50+ languages, and AI-generated notes instantly.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link to="/auth" className="w-full sm:w-auto">
              <button
                className="w-full sm:w-auto px-8 py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: '#fff', color: '#05060A', fontSize: '1.05rem', boxShadow: '0 4px 20px rgba(255,255,255,0.2)' }}
              >
                Start for free
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <a href="#how" className="w-full sm:w-auto">
              <button
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 font-bold rounded-xl transition-all hover:bg-white/10"
                style={{ color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.15)', fontSize: '1.05rem' }}
              >
                <Play className="w-5 h-5" /> See how it works
              </button>
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex flex-wrap items-center gap-4 sm:gap-6 mt-12"
            style={{ color: '#64748B', fontSize: '0.85rem', fontFamily: 'Fira Code, monospace', fontWeight: 500 }}
          >
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Powered by Whisper v3</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Secure & Private</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 50+ Languages</span>
          </motion.div>
        </motion.div>

        {/* ================= RIGHT (40-50%) - REALISTIC WORKFLOW ================= */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 xl:col-span-7 w-full h-[550px] lg:h-[650px] relative preserve-3d mt-12 lg:mt-0"
          style={{ perspective: '1200px' }}
        >
          {/* Main Container mimicking the app UI */}
          <div 
            className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col"
            style={{ 
              background: 'rgba(11, 16, 32, 0.7)', 
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 58, 237, 0.1)',
              transform: 'rotateY(-5deg) rotateX(5deg)',
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Window Chrome */}
            <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <div className="ml-4 px-3 py-1 rounded-md bg-white/5 text-[0.7rem] font-mono text-white/50 border border-white/5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                workspace / Q3_Earnings_Call.mp4
              </div>
            </div>

            {/* Workflow Content Area */}
            <div className="flex-1 relative p-4 md:p-6 overflow-hidden">
              <AnimatePresence mode="wait">
                
                {/* STEP 0: Upload */}
                {step === 0 && (
                  <motion.div 
                    key="step0"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute inset-6 border-2 border-dashed border-[#7C3AED]/40 rounded-xl flex flex-col items-center justify-center"
                    style={{ background: 'rgba(124, 58, 237, 0.05)' }}
                  >
                    <Upload className="w-12 h-12 mb-4" style={{ color: '#7C3AED' }} />
                    <div className="text-lg font-bold text-white mb-2">Uploading File...</div>
                    <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3.5, ease: "linear" }}
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #7C3AED, #06B6D4)' }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* STEP 1: Transcription */}
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3 text-white/80 font-medium">
                      <Mic className="w-5 h-5 text-cyan-400" />
                      Generating Transcript
                    </div>
                    <div className="flex-1 rounded-xl bg-black/40 border border-white/5 p-5 font-mono text-sm text-white/70 leading-relaxed overflow-hidden relative">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        [00:00:00] Welcome everyone to the Q3 earnings call.<br/><br/>
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>[00:00:05] We are excited to announce a 40% year-over-year growth in our enterprise segment.</motion.span><br/><br/>
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>[00:00:12] Our new AI features have significantly reduced customer churn.</motion.span>
                      </motion.div>
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#05060A] to-transparent pointer-events-none" />
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Translation */}
                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3 text-white/80 font-medium">
                      <Languages className="w-5 h-5 text-rose-400" />
                      Real-time Translation (Spanish)
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source */}
                      <div className="rounded-xl bg-black/40 border border-white/5 p-4 font-mono text-xs text-white/50 leading-relaxed">
                        [00:00:00] Welcome everyone to the Q3 earnings call.<br/><br/>
                        [00:00:05] We are excited to announce a 40% year-over-year growth...
                      </div>
                      {/* Target */}
                      <div className="rounded-xl border p-4 font-mono text-xs text-white/90 leading-relaxed relative" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
                        <motion.span initial={{ opacity: 0, backgroundColor: '#7C3AED' }} animate={{ opacity: 1, backgroundColor: 'transparent' }} transition={{ duration: 0.8 }}>[00:00:00] Bienvenidos a todos a la llamada de ganancias del tercer trimestre.</motion.span><br/><br/>
                        <motion.span initial={{ opacity: 0, backgroundColor: '#7C3AED' }} animate={{ opacity: 1, backgroundColor: 'transparent' }} transition={{ duration: 0.8, delay: 1 }}>[00:00:05] Nos complace anunciar un crecimiento del 40% año tras año...</motion.span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: AI Summary */}
                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3 text-white/80 font-medium">
                      <FileText className="w-5 h-5 text-amber-400" />
                      AI Executive Summary
                    </div>
                    <div className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/20 p-6 flex flex-col gap-4">
                      <div className="text-lg font-bold text-white">Q3 Earnings Call Highlights</div>
                      <ul className="flex flex-col gap-4 text-sm text-amber-100/80">
                        <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">40% YoY growth in enterprise segment, driven by new product launches.</span>
                        </motion.li>
                        <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">AI features deployed successfully, reducing overall customer churn by 15%.</span>
                        </motion.li>
                        <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 }} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">Next quarter focuses heavily on international market expansion.</span>
                        </motion.li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Step Indicators */}
            <div className="h-12 border-t border-white/10 flex items-center justify-center gap-3 bg-black/40">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${step === i ? 'scale-150' : 'bg-white/20'}`} style={{ backgroundColor: step === i ? '#7C3AED' : '' }} />
              ))}
            </div>
          </div>

          {/* Floating UI Elements for depth */}
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-4 md:-right-8 top-10 md:top-20 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center gap-3 z-30"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-medium text-white">99.8% Accuracy</div>
          </motion.div>
          
        </motion.div>

      </div>
    </section>
  );
}