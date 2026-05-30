
import { Link } from 'react-router-dom';

export default function OsFooter() {
  return (
    <footer style={{ position: 'relative', marginTop: '4rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#05060A', overflow: 'hidden' }}>
      {/* 3D Grid Floor */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, transform: 'rotateX(60deg) scale(2)', transformOrigin: 'top center' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '72rem', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem', marginBottom: '3rem' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.875rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fira Code, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                S
              </div>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>ScribeAI</span>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: '200px' }}>
              AI-powered transcription, translation, and note generation for everyone.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Space Grotesk, sans-serif' }}>
              Product
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'How it works', href: '#how' },
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Languages', href: '#features' },
              ].map(link => (
                <a key={link.label} href={link.href} style={{ color: '#64748B', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#64748B'}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Account */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Space Grotesk, sans-serif' }}>
              Account
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Sign in', to: '/auth' },
                { label: 'Sign up free', to: '/auth?mode=signup' },
                { label: 'Dashboard', to: '/dashboard' },
              ].map(link => (
                <Link key={link.label} to={link.to} style={{ color: '#64748B', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#64748B'}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Space Grotesk, sans-serif' }}>
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(label => (
                <a key={label} href="#" style={{ color: '#64748B', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#64748B'}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', maxWidth: '72rem', margin: '0 auto' }}>
        <span style={{ color: '#64748B', fontSize: '0.78rem', fontFamily: 'Fira Code, monospace' }}>
          © {new Date().getFullYear()} ScribeAI · Free tier available · Powered by Whisper AI · Firebase Firestore
        </span>
        <span style={{ color: '#334155', fontSize: '0.75rem', fontFamily: 'Fira Code, monospace' }}>
          // ALL SYSTEMS NOMINAL
        </span>
      </div>
    </footer>
  );
}
