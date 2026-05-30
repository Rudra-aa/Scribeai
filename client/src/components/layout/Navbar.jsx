import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { name: 'How it works', href: '#how' },
  { name: 'Features', href: '#features' },
  { name: 'Use Cases', href: '#use-cases' },
  { name: 'Integrations', href: '#integrations' },
  { name: 'Pricing', href: '#pricing' },
];

export default function OsNavbar() {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isOnLanding = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setTimeout(() => setMobileOpen(false), 0); }, [location]);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full transition-all duration-300"
          style={{
            background: scrolled ? 'rgba(5, 6, 10, 0.85)' : 'rgba(5, 6, 10, 0.2)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
            boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          <div className="flex items-center justify-between px-6 md:px-12 py-4 w-full max-w-[1750px] mx-auto">
            {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-white group-hover:scale-105 transition-transform"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
              S
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">ScribeAI</span>
          </Link>

          {/* Desktop Links — only show on landing page */}
          {isOnLanding && (
            <div className="hidden md:flex items-center gap-1 relative">
              {navLinks.map((link, idx) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: hoveredIndex === idx ? '#fff' : '#94A3B8' }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {link.name}
                  {hoveredIndex === idx && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg -z-10"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </a>
              ))}
            </div>
          )}

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden sm:block text-sm font-medium transition-colors"
              style={{ color: '#94A3B8' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#94A3B8'}>
              Log in
            </Link>
            <Link to="/auth">
              <button className="relative px-4 py-2 text-sm font-bold text-white rounded-xl overflow-hidden group transition-all"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)' }}>
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(6,182,212,0.5))' }} />
              </button>
            </Link>
            {/* Mobile Menu Toggle */}
            {isOnLanding && (
              <button
                className="md:hidden ml-1 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 left-4 right-4 z-40 rounded-2xl p-4 flex flex-col gap-2"
            style={{
              background: 'rgba(11,16,32,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {navLinks.map(link => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
              <Link to="/auth" className="block px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                Log in
              </Link>
              <Link to="/auth">
                <button className="w-full mt-1 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>
                  Get Started Free
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
