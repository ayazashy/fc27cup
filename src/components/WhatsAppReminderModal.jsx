import React, { useState, useMemo } from 'react';
import { 
  X, 
  Send, 
  Clock, 
  MessageCircle, 
  Copy, 
  Check, 
  User, 
  Edit3,
  ExternalLink,
  Phone
} from 'lucide-react';
import { 
  cleanWhatsAppPhone, 
  formatEstimatedTimeStr, 
  generateMatchReminderText, 
  buildWhatsAppUrl 
} from '../utils/whatsappHelper';

export default function WhatsAppReminderModal({
  match,
  p1,
  p2,
  onClose,
  onNotify
}) {
  const [selectedTarget, setSelectedTarget] = useState('p1'); // 'p1' or 'p2'
  const [p1PhoneInput, setP1PhoneInput] = useState(p1?.phone || p1?.displayPhone || '');
  const [p2PhoneInput, setP2PhoneInput] = useState(p2?.phone || p2?.displayPhone || '');
  const [customNote, setCustomNote] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const activePlayer = selectedTarget === 'p1' ? p1 : p2;
  const activeOpponent = selectedTarget === 'p1' ? p2 : p1;
  const activePhone = selectedTarget === 'p1' ? p1PhoneInput : p2PhoneInput;

  // Clean readable Arabic message
  const currentMessageText = useMemo(() => {
    return generateMatchReminderText({
      player: activePlayer,
      opponent: activeOpponent,
      match,
      customNote
    });
  }, [activePlayer, activeOpponent, match, customNote]);

  // Clean WhatsApp URL for active target
  const activeWhatsAppUrl = useMemo(() => {
    return buildWhatsAppUrl(activePhone, currentMessageText);
  }, [activePhone, currentMessageText]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(currentMessageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    if (onNotify) onNotify('تم نسخ نص الرسالة بنجاح!', 'info');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeWhatsAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    if (onNotify) onNotify('تم نسخ رابط الواتساب!', 'info');
  };

  const validatePhone = (phone, playerName) => {
    const cleaned = cleanWhatsAppPhone(phone);
    if (!cleaned || cleaned.length < 9) {
      if (onNotify) onNotify(`يرجى إدخال رقم جوال صحيح للاعب ${playerName || ''}`, 'error');
      return false;
    }
    return true;
  };

  const estTimeStr = formatEstimatedTimeStr(match);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content whatsapp-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '560px', 
          width: '100%', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0, 
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)',
          color: '#FFFFFF',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#25D366',
              color: '#FFFFFF',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                تذكير بمباراة #{match.matchNumber}
              </h3>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px', display: 'flex', gap: '6px' }}>
                <span>جهاز {match.consoleId}</span>
                <span>•</span>
                <span>{match.groupName || match.title || 'المجموعات'}</span>
                {match.dayNumber && (
                  <>
                    <span>•</span>
                    <span>اليوم {match.dayNumber}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '14px', 
          flex: 1, 
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Estimated Time Alert */}
          <div style={{
            background: match.status === 'live' ? '#ECFDF5' : '#FEF9C3',
            border: `1px solid ${match.status === 'live' ? '#10B981' : '#FCD34D'}`,
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Clock size={18} color={match.status === 'live' ? '#059669' : '#B45309'} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: match.status === 'live' ? '#065F46' : '#92400E' }}>
              <span>موعد المباراة المتوقع: </span>
              <b>{estTimeStr}</b>
            </div>
          </div>

          {/* Participant Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
              اختر اللاعب المراد مراسلته:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Player 1 Card */}
              <div 
                onClick={() => setSelectedTarget('p1')}
                style={{
                  background: selectedTarget === 'p1' ? '#F0FDF4' : '#FFFFFF',
                  border: `2px solid ${selectedTarget === 'p1' ? '#059669' : 'var(--border-light)'}`,
                  borderRadius: '10px',
                  padding: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>الطرف الأول</span>
                  {selectedTarget === 'p1' && <Check size={15} color="#059669" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p1?.name || match.player1Placeholder || 'اللاعب 1'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {p1?.team || '—'}
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={p1PhoneInput}
                    onChange={(e) => setP1PhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>

              {/* Player 2 Card */}
              <div 
                onClick={() => setSelectedTarget('p2')}
                style={{
                  background: selectedTarget === 'p2' ? '#F0FDF4' : '#FFFFFF',
                  border: `2px solid ${selectedTarget === 'p2' ? '#059669' : 'var(--border-light)'}`,
                  borderRadius: '10px',
                  padding: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>الطرف الثاني</span>
                  {selectedTarget === 'p2' && <Check size={15} color="#059669" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p2?.name || match.player2Placeholder || 'اللاعب 2'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {p2?.team || '—'}
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={p2PhoneInput}
                    onChange={(e) => setP2PhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '5px 8px', direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Edit3 size={13} color="var(--text-muted)" />
              <span>ملاحظة إضافية للاعب (اختياري):</span>
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="مثال: يرجى التواجد فوراً أو إحضار يد التحكم الخاصة بك"
              className="form-input"
              style={{ fontSize: '0.82rem', padding: '7px 10px' }}
            />
          </div>

          {/* Clean Readable Message Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                معاينة نص الرسالة:
              </span>
              <button 
                type="button"
                onClick={handleCopyMessage}
                className="btn btn-sm btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copiedText ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                <span>{copiedText ? 'تم النسخ ✓' : 'نسخ النص'}</span>
              </button>
            </div>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              whiteSpace: 'pre-line',
              maxHeight: '130px',
              overflowY: 'auto'
            }}>
              {currentMessageText}
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer - Mobile-First & Always Accessible */}
        <div style={{
          background: '#FFFFFF',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}>
          {/* Primary WhatsApp Action Button: Full Width & Prominent */}
          <a
            href={activeWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              background: '#25D366',
              borderColor: '#25D366',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.95rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              width: '100%',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)'
            }}
            onClick={(e) => {
              if (!validatePhone(activePhone, activePlayer?.name)) {
                e.preventDefault();
              } else if (onNotify) {
                onNotify(`جاري فتح محادثة واتساب لـ ${activePlayer?.name}! 📲`, 'success');
              }
            }}
          >
            <Send size={18} />
            <span>إرسال التذكير عبر واتساب الآن 📲</span>
          </a>

          {/* Secondary Actions Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={onClose}
              style={{ flex: 1, padding: '7px 12px' }}
            >
              إغلاق
            </button>

            <button 
              type="button"
              onClick={handleCopyLink}
              className="btn btn-secondary btn-sm"
              title="نسخ رابط الواتساب"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '7px 12px', fontSize: '0.8rem' }}
            >
              {copiedLink ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              <span>{copiedLink ? 'تم نسخ الرابط' : 'نسخ الرابط'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
