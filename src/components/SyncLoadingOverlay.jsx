import React from 'react';
import logoUrl from '../utils/logo';

export default function SyncLoadingOverlay({
  show,
  message = 'جاري تحديث البيانات...',
  subtext = ''
}) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      transition: 'all 0.25s ease'
    }}>
      {/* Centered Circular Loading Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 40px',
        background: 'rgba(255, 255, 255, 0.96)',
        borderRadius: '24px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
        maxWidth: '380px',
        width: '90%',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Animated Double Circular Spinner Ring around Competition Logo */}
        <div style={{
          position: 'relative',
          width: '110px',
          height: '110px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Outer Rotating Glowing Ring */}
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3.5px solid #E2E8F0',
              borderTopColor: '#059669',
              borderRightColor: '#F59E0B',
              animation: 'spinOverlayRing 1.1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite',
              filter: 'drop-shadow(0 2px 6px rgba(5, 150, 105, 0.35))'
            }} 
          />

          {/* Inner Pulsing Circle with Official Logo */}
          <div style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '8px'
          }}>
            <img 
              src={logoUrl} 
              alt="شعار كأس السكن FC27" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                animation: 'pulseLogo 1.6s ease-in-out infinite'
              }}
            />
          </div>
        </div>

        {/* Status Message Text */}
        <h3 style={{
          fontSize: '1.05rem',
          fontWeight: 800,
          color: '#0F172A',
          margin: '0 0 6px 0',
          lineHeight: 1.4
        }}>
          {message}
        </h3>

        {subtext && (
          <p style={{
            fontSize: '0.78rem',
            color: '#64748B',
            margin: '0 0 16px 0',
            lineHeight: 1.4
          }}>
            {subtext}
          </p>
        )}

        {/* Live Protection Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#065F46'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#10B981',
            display: 'inline-block',
            animation: 'pulseGreenDot 1s infinite'
          }} />
          <span>مزامنة سحابية نشطة</span>
        </div>
      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes spinOverlayRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseLogo {
          0%, 100% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes pulseGreenDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
