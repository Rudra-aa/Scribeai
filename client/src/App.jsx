import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';

// Eager-load Landing (above fold, critical path)
import Landing from './pages/Landing';

// Lazy-load authenticated/heavy pages for code splitting
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveMeeting = lazy(() => import('./pages/LiveMeeting'));

function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#05060A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '2px solid rgba(124,58,237,0.3)',
        borderTopColor: '#7C3AED',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveMeeting />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
