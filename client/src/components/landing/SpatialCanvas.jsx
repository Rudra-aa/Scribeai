import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';

function ParticleSwarm(props) {
  const ref = useRef();
  
  // Generate random points in a sphere
  const sphere = useMemo(() => {
    const arr = new Float32Array(3000);
    return random.inSphere(arr, { radius: 1.5 });
  }, []);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 10;
      ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#7C3AED"
          size={0.003}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
}

import React from 'react';

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn("WebGL Canvas crashed. Falling back to simple background.", error);
  }
  render() {
    if (this.state.hasError) {
      return null; // Just show no particles, keep the rest of the site alive
    }
    return this.props.children;
  }
}

export default function SpatialCanvas() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-background">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
      
      <CanvasErrorBoundary>
        <Canvas camera={{ position: [0, 0, 1] }}>
          <ParticleSwarm />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
