import React, { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { verifyAndDecodeKey, storeAdminKey } from '../utils/securityGate';

export default function AdminLockScreen({
  onUnlockSuccess,
  onGoToPublic
}) {
  const [inputKey, setInputKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMessage('يرجى إدخال مفتاح فك التشفير.');
      return;
    }

    setIsDecoding(true);
    setErrorMessage('');

    try {
      // Attempt AES-256-GCM Web Crypto decryption with the provided key
      const result = await verifyAndDecodeKey(inputKey);

      if (result.success && result.payload) {
        // Save key in localStorage so subsequent visits open directly
        storeAdminKey(inputKey.trim());
        onUnlockSuccess(result.payload, inputKey.trim());
      } else {
        setErrorMessage('❌ مفتاح فك التشفير غير صحيح! فشلت محاولة فك تشفير لوحة الإدارة.');
      }
    } catch (err) {
      setErrorMessage('❌ حدث خطأ أثناء محاولة فك التشفير. يرجى المحاولة مجدداً.');
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #0F172A 100%)',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Decorative Background Elements */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.08)',
        filter: 'blur(70px)',
        top: '10%',
        left: '15%'
      }} />
      <div style={{
        position: 'absolute',
        width: '280px',
        height: '280px',
        borderRadius: '50%',
        background: 'rgba(56, 189, 248, 0.06)',
        filter: 'blur(60px)',
        bottom: '15%',
        right: '15%'
      }} />

      {/* Main Lock Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        width: '100%',
        maxWidth: '460px',
        padding: '36px 30px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Competition Logo */}
        <div style={{ marginBottom: '18px' }}>
          <img 
            src="/logo.png" 
            alt="شعار كأس السكن FC27" 
            style={{ 
              height: '84px', 
              width: 'auto', 
              objectFit: 'contain',
              margin: '0 auto',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
            }} 
          />
        </div>

        {/* Header Title */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#ECFDF5',
          color: '#065F46',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 800,
          marginBottom: '10px'
        }}>
          <KeyRound size={13} color="#059669" />
          <span>منطقة الكادر الإداري (/KSUHTSTAFF)</span>
        </div>

        <h1 style={{
          fontSize: '1.45rem',
          fontWeight: 900,
          color: '#0F172A',
          marginBottom: '6px'
        }}>
          كأس السكن: FC27
        </h1>

        <p style={{
          fontSize: '0.85rem',
          color: '#64748B',
          lineHeight: 1.5,
          marginBottom: '24px'
        }}>
          الصفحة مشفرة بالكامل. يرجى إدخال مفتاح فك التشفير للوصول إلى لوحة الإدارة والتحكم.
        </p>

        {/* Error Alert Box */}
        {errorMessage && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #F87171',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#B91C1C',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'right'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Decryption Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="أدخل مفتاح فك التشفير..."
              disabled={isDecoding}
              autoFocus
              className="form-input"
              style={{
                width: '100%',
                padding: '12px 42px 12px 14px',
                fontSize: '0.95rem',
                borderRadius: '10px',
                border: '1.5px solid var(--border-strong)',
                background: '#F8FAFC',
                boxSizing: 'border-box',
                direction: 'ltr',
                textAlign: 'left',
                fontFamily: 'monospace'
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title={showPassword ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isDecoding}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.95rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              cursor: isDecoding ? 'not-allowed' : 'pointer'
            }}
          >
            {isDecoding ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span>جاري فك التشفير والتحقق...</span>
              </>
            ) : (
              <>
                <Unlock size={18} />
                <span>فك التشفير والدخول 🔓</span>
              </>
            )}
          </button>
        </form>

        {/* Public Portal Return Link */}
        <div style={{ marginTop: '22px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onGoToPublic}
            className="btn btn-secondary btn-sm"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#475569',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={14} />
            <span>الذهاب إلى بوابة المشاهدين العامة (TV Display)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
