import { useEffect, Suspense, lazy } from 'react';
import Navbar from '../components/layout/Navbar';
import HeroScene from '../components/landing/HeroScene';
import LandingSections from '../components/landing/LandingSections';
import Footer from '../components/layout/Footer';

// Dynamically import heavy WebGL components
const SpatialCanvas = lazy(() => import('../components/landing/SpatialCanvas'));

export default function Landing() {
  useEffect(() => {
    document.body.style.backgroundColor = '#05060A';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#05060A', color: '#fff', overflowX: 'hidden' }}>
      {/* Layer 0: WebGL Particle Background (Lazy Loaded) */}
      <Suspense fallback={
        <div className="fixed inset-0 z-0 pointer-events-none bg-background">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
        </div>
      }>
        <SpatialCanvas />
      </Suspense>

      {/* Layer 1: HTML Content */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Navbar />
        <main>
          <HeroScene />
          <LandingSections />
        </main>
        <Footer />
      </div>
    </div>
  );
}
