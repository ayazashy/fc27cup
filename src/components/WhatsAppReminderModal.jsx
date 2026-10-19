import React, { useState, useMemo } from 'react';
import { 
  X, 
  Send, 
  Clock, 
  Monitor, 
  MessageCircle, 
  Copy, 
  Check, 
  AlertCircle, 
  User, 
  PhoneCall, 
  Edit3,
  ExternalLink,
  Code2,
  FileText,
  Link2
} from 'lucide-react';
import { 
  cleanWhatsAppPhone, 
  formatEstimatedTimeStr, 
  generateMatchReminderText, 
  encodeFullPercentUrl,
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEncoded, setCopiedEncoded] = useState(false);
  const [previewMode, setPreviewMode] = useState('encoded'); // 'encoded' (default, %3D/%D8) or 'readable'

  const activePlayer = selectedTarget === 'p1' ? p1 : p2;
  const activeOpponent = selectedTarget === 'p1' ? p2 : p1;
  const activePhone = selectedTarget === 'p1' ? p1PhoneInput : p2PhoneInput;

  // 1. Raw Arabic Text
  const currentMessageText = useMemo(() => {
    return generateMatchReminderText({
      player: activePlayer,
      opponent: activeOpponent,
      match,
      customNote
    });
  }, [activePlayer, activeOpponent, match, customNote]);

  // 2. Strict Full URL Percent-Encoded string (Zero literal Arabic characters, full %3D/%20/%D8%A7...)
  const encodedMessageText = useMemo(() => {
    return encodeFullPercentUrl(currentMessageText);
  }, [currentMessageText]);

  // 3. Complete WhatsApp URL with encoded parameter
  const activeWhatsAppUrl = useMemo(() => {
    return buildWhatsAppUrl(activePhone, currentMessageText);
  }, [activePhone, currentMessageText]);

  const p1WhatsAppUrl = useMemo(() => {
    const msg = generateMatchReminderText({ player: p1, opponent: p2, match, customNote });
    return buildWhatsAppUrl(p1PhoneInput, msg);
  }, [p1, p2, p1PhoneInput, match, customNote]);

  const p2WhatsAppUrl = useMemo(() => {
    const msg = generateMatchReminderText({ player: p2, opponent: p1, match, customNote });
    return buildWhatsAppUrl(p2PhoneInput, msg);
  }, [p1, p2, p2PhoneInput, match, customNote]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeWhatsAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    if (onNotify) onNotify('تم نسخ رابط الواتساب المشفر بالكامل بنجاح!', 'info');
  };

  const handleCopyEncodedText = () => {
    navigator.clipboard.writeText(encodedMessageText);
    setCopiedEncoded(true);
    setTimeout(() => setCopiedEncoded(false), 2000);
    if (onNotify) onNotify('تم نسخ النص المشفر بالكامل (%XX) بنجاح!', 'info');
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
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '680px', width: '95%', padding: 0, overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{
          background: 'linear-gradient(135deg, #065F46 0%, #047857 50%, #059669 100%)',
          color: '#FFFFFF',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#25D366',
              color: '#FFFFFF',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              <MessageCircle size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                تذكير واتساب للمباراة #{match.matchNumber}
              </h3>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span>جهاز {match.consoleId}</span>
                <span>•</span>
                <span>{match.groupName || match.title || 'مرحلة المجموعات'}</span>
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
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
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

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Estimated Time Alert Banner */}
          <div style={{
            background: match.status === 'live' ? '#ECFDF5' : '#FEF9C3',
            border: `1.5px solid ${match.status === 'live' ? '#10B981' : '#EAB308'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Clock size={20} color={match.status === 'live' ? '#059669' : '#CA8A04'} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: match.status === 'live' ? '#065F46' : '#854D0E' }}>
                الوقت التقديري لحضور واستعداد اللاعبين:
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: match.status === 'live' ? '#047857' : '#713F12' }}>
                {estTimeStr}
              </div>
            </div>
          </div>

          {/* Participant Selector Cards */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'block' }}>
              اختر اللاعب المراد إرسال التذكير له:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Player 1 Card */}
              <div 
                onClick={() => setSelectedTarget('p1')}
                style={{
                  background: selectedTarget === 'p1' ? '#F0FDF4' : '#FFFFFF',
                  border: `2px solid ${selectedTarget === 'p1' ? '#059669' : 'var(--border-light)'}`,
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>الطرف الأول (1)</span>
                  {selectedTarget === 'p1' && <Check size={16} color="#059669" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {p1?.name || match.player1Placeholder || 'اللاعب 1'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  نادي: {p1?.team || '—'} {p1?.room ? `| ${p1.room}` : ''}
                </div>

                <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>رقم الجوال (واتساب):</label>
                  <input
                    type="text"
                    value={p1PhoneInput}
                    onChange={(e) => setP1PhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px', marginTop: '2px', direction: 'ltr', textAlign: 'right' }}
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
                  padding: '12px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>الطرف الثاني (2)</span>
                  {selectedTarget === 'p2' && <Check size={16} color="#059669" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {p2?.name || match.player2Placeholder || 'اللاعب 2'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  نادي: {p2?.team || '—'} {p2?.room ? `| ${p2.room}` : ''}
                </div>

                <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>رقم الجوال (واتساب):</label>
                  <input
                    type="text"
                    value={p2PhoneInput}
                    onChange={(e) => setP2PhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '4px 8px', marginTop: '2px', direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Note Addition */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Edit3 size={14} color="var(--text-muted)" />
              <span>إضافة ملاحظة خاصة (تُشفّر وتُضاف للرسالة):</span>
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="مثال: يرجى التواجد فوراً أو إحضار يد التحكم الخاصة بك"
              className="form-input"
              style={{ fontSize: '0.85rem', padding: '8px 12px' }}
            />
          </div>

          {/* Full Encoded WhatsApp URL Field */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link2 size={14} color="#059669" />
                <span>رابط الواتساب المشفر بالكامل (Full URL Encoded with %XX):</span>
              </label>
              <button 
                type="button"
                onClick={handleCopyLink}
                className="btn btn-sm btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copiedLink ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                <span>{copiedLink ? 'تم نسخ الرابط ✓' : 'نسخ الرابط'}</span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={activeWhatsAppUrl}
              className="form-input"
              style={{
                background: '#F1F5F9',
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                color: '#0F172A',
                direction: 'ltr',
                padding: '7px 10px'
              }}
            />
          </div>

          {/* Message Encoding Box (Encrypted by default, no direct Arabic written) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('encoded')}
                  className={`btn btn-sm ${previewMode === 'encoded' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 9px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Code2 size={13} />
                  <span>النص المشفر بالكامل (%XX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('readable')}
                  className={`btn btn-sm ${previewMode === 'readable' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 9px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileText size={13} />
                  <span>المعاينة المقروءة</span>
                </button>
              </div>

              <button 
                type="button"
                onClick={handleCopyEncodedText}
                className="btn btn-sm btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copiedEncoded ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                <span>{copiedEncoded ? 'تم نسخ المشفر ✓' : 'نسخ النص المشفر (%XX)'}</span>
              </button>
            </div>

            <textarea
              readOnly
              rows={6}
              value={previewMode === 'encoded' ? encodedMessageText : currentMessageText}
              className="form-input"
              style={{
                background: previewMode === 'encoded' ? '#0F172A' : '#F8FAFC',
                color: previewMode === 'encoded' ? '#38BDF8' : '#1E293B',
                fontFamily: previewMode === 'encoded' ? 'monospace' : 'inherit',
                fontSize: previewMode === 'encoded' ? '0.72rem' : '0.82rem',
                lineHeight: 1.5,
                padding: '12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-light)',
                resize: 'none',
                direction: previewMode === 'encoded' ? 'ltr' : 'rtl',
                wordBreak: 'break-all',
                whiteSpace: previewMode === 'encoded' ? 'normal' : 'pre-line'
              }}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          background: 'var(--bg-subtle)',
          padding: '14px 20px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            إغلاق
          </button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Direct Send to Player 1 */}
            <a
              href={p1WhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                borderColor: '#25D366',
                color: '#065F46',
                fontWeight: 700,
                fontSize: '0.82rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={(e) => {
                if (!validatePhone(p1PhoneInput, p1?.name)) e.preventDefault();
                else if (onNotify) onNotify(`جاري فتح محادثة واتساب المشفرة لـ ${p1?.name}! 📲`, 'success');
              }}
            >
              <MessageCircle size={15} color="#25D366" />
              <span>إرسال لـ {p1?.name ? p1.name.split(' ')[0] : 'الطرف 1'} 📲</span>
            </a>

            {/* Direct Send to Player 2 */}
            <a
              href={p2WhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                borderColor: '#25D366',
                color: '#065F46',
                fontWeight: 700,
                fontSize: '0.82rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={(e) => {
                if (!validatePhone(p2PhoneInput, p2?.name)) e.preventDefault();
                else if (onNotify) onNotify(`جاري فتح محادثة واتساب المشفرة لـ ${p2?.name}! 📲`, 'success');
              }}
            >
              <MessageCircle size={15} color="#25D366" />
              <span>إرسال لـ {p2?.name ? p2.name.split(' ')[0] : 'الطرف 2'} 📲</span>
            </a>

            {/* Primary Action Link for active target */}
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
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)'
              }}
              onClick={(e) => {
                if (!validatePhone(activePhone, activePlayer?.name)) e.preventDefault();
                else if (onNotify) onNotify(`تم فتح رابط واتساب المشفر بنجاح! 📲`, 'success');
              }}
            >
              <Send size={16} />
              <span>فتح رابط واتساب المشفر</span>
              <ExternalLink size={13} style={{ opacity: 0.8 }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
