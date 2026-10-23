import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Calendar, CalendarDays, Monitor, Search, Check, RotateCcw, Trophy, Shield, AlertCircle, ArrowLeftRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';
import { parseTimeToMins, formatMinsToTime12, calculateFixedMatchSchedule } from '../utils/tournamentEngine';

// Helper: Format date string to Arabic
function formatArabicDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${dayNames[date.getDay()]}، ${date.getDate()} ${monthNames[date.getMonth()]}`;
  } catch (e) {
    return dateStr;
  }
}

export default function AdminAdjustMatchModal({
  isOpen,
  onClose,
  matches = [],
  participants = [],
  groups = [],
  config = {},
  onUpdateMatch,
  onNotify
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [editedDay, setEditedDay] = useState(1);
  const [editedTime, setEditedTime] = useState('');
  const [editedConsole, setEditedConsole] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Map participants for quick O(1) lookup
  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  // Find currently selected match object
  const selectedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    return matches.find(m => m.id === selectedMatchId) || null;
  }, [selectedMatchId, matches]);

  // Populate form fields whenever a new match is selected
  useEffect(() => {
    if (selectedMatch) {
      setEditedDay(selectedMatch.dayNumber || 1);
      setEditedTime(selectedMatch.customTime || '');
      setEditedConsole(selectedMatch.consoleId || 1);
      setSaveSuccess(false);
    }
  }, [selectedMatch]);

  // Search filter for matches (by match ID, matchNumber, participant name, or team)
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const qClean = searchQuery.trim().toLowerCase();
    const qDigits = qClean.replace(/\D/g, '');

    return matches.filter(m => {
      // 1. Exact or partial ID match
      if (m.id.toLowerCase().includes(qClean)) return true;

      // 2. Match number match (e.g. typing "14" or "#14")
      if (qDigits && String(m.matchNumber) === qDigits) return true;
      if (qDigits && String(m.matchNumber).includes(qDigits)) return true;

      // 3. Player names or teams match
      const p1 = participantsMap[m.player1Id];
      const p2 = participantsMap[m.player2Id];
      if (p1?.name?.toLowerCase().includes(qClean)) return true;
      if (p2?.name?.toLowerCase().includes(qClean)) return true;
      if (p1?.team?.toLowerCase().includes(qClean)) return true;
      if (p2?.team?.toLowerCase().includes(qClean)) return true;

      return false;
    }).slice(0, 10);
  }, [searchQuery, matches, participantsMap]);

  // Auto-select match if exact ID or exact matchNumber is typed
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const qClean = searchQuery.trim().toLowerCase();
    const exactIdMatch = matches.find(m => m.id.toLowerCase() === qClean);
    if (exactIdMatch) {
      setSelectedMatchId(exactIdMatch.id);
      return;
    }
    const qDigits = qClean.replace(/\D/g, '');
    if (qDigits) {
      const exactNumMatch = matches.find(m => String(m.matchNumber) === qDigits);
      if (exactNumMatch && filteredMatches.length === 1) {
        setSelectedMatchId(exactNumMatch.id);
      }
    }
  }, [searchQuery, matches, filteredMatches]);

  const tournamentDaysCount = Math.max(3, Number(config?.tournamentDays) || 2);
  const consolesCount = Number(config?.consolesCount) || 5;
  const dayDates = config?.dayDates || {};

  // Compute match duration in minutes
  const matchDurationMins = useMemo(() => {
    return Math.round(((Number(config?.minMatchDuration) || 10) + (Number(config?.maxMatchDuration) || 15)) / 2);
  }, [config?.minMatchDuration, config?.maxMatchDuration]);

  // Compute schedule of all OTHER matches for the selected day
  const otherMatchesSchedule = useMemo(() => {
    if (!selectedMatch) return {};
    const d = Number(editedDay) || 1;
    const isKnockout = selectedMatch.stage && selectedMatch.stage !== 'group' && !selectedMatch.groupId;
    const dayKey = isKnockout ? 'knockout' : d;
    const dayMatches = matches.filter(m => (m.dayNumber || 1) === d && m.id !== selectedMatch.id);
    const startTime = config?.dayStartTimes?.[dayKey] || config?.dayStartTimes?.[d] || '18:00';
    const breaks = config?.dayBreaks?.[dayKey] || config?.dayBreaks?.[d] || [];
    return calculateFixedMatchSchedule(dayMatches, startTime, matchDurationMins, breaks);
  }, [matches, selectedMatch, editedDay, config, matchDurationMins]);

  // Real-time Device Availability & Conflict Detection across all X devices
  const validationResult = useMemo(() => {
    if (!selectedMatch || !editedTime || !editedTime.trim()) {
      return {
        hasCustomTime: false,
        isValid: true,
        deviceStatus: {},
        selectedConflict: null,
        allOccupied: false,
        availableConsoles: [],
        playerConflict: null,
        breakConflict: null
      };
    }

    const targetStart = parseTimeToMins(editedTime);
    const targetEnd = targetStart + matchDurationMins;
    const d = Number(editedDay) || 1;
    const otherMatches = matches.filter(m => (m.dayNumber || 1) === d && m.id !== selectedMatch.id);

    // 1. Device by device availability map across all X devices
    const deviceStatus = {};
    for (let c = 1; c <= consolesCount; c++) {
      const cMatches = otherMatches.filter(m => (m.consoleId || 1) === c);
      const conflicting = cMatches.find(m => {
        const sched = otherMatchesSchedule[m.id];
        if (!sched) return false;
        // Overlap: max(start1, start2) < min(end1, end2)
        return Math.max(targetStart, sched.startMins) < Math.min(targetEnd, sched.endMins);
      });

      if (conflicting) {
        const sched = otherMatchesSchedule[conflicting.id];
        const p1Name = participantsMap[conflicting.player1Id]?.name || conflicting.player1Placeholder || 'الطرف 1';
        const p2Name = participantsMap[conflicting.player2Id]?.name || conflicting.player2Placeholder || 'الطرف 2';
        deviceStatus[c] = {
          available: false,
          conflictMatch: conflicting,
          conflictSched: sched,
          label: `#${conflicting.matchNumber} (${sched.timeStr})`,
          detail: `مباراة #${conflicting.matchNumber}: ${p1Name} ضد ${p2Name} (${sched.timeStr} - ${sched.endTimeStr})`
        };
      } else {
        deviceStatus[c] = {
          available: true,
          label: 'متاح'
        };
      }
    }

    // 2. Selected Console Conflict
    const selectedConsoleStatus = deviceStatus[editedConsole];
    const selectedConflict = (selectedConsoleStatus && !selectedConsoleStatus.available) ? selectedConsoleStatus : null;

    // 3. Are all consoles occupied at this time?
    const allOccupied = Object.values(deviceStatus).length > 0 && Object.values(deviceStatus).every(s => !s.available);

    // 4. Available consoles list
    const availableConsoles = Object.keys(deviceStatus)
      .map(Number)
      .filter(c => deviceStatus[c]?.available);

    // 5. Player Conflict check
    const p1Id = selectedMatch.player1Id;
    const p2Id = selectedMatch.player2Id;
    let playerConflict = null;
    if (p1Id || p2Id) {
      const conflictingPlayerMatch = otherMatches.find(m => {
        const isP1 = p1Id && (m.player1Id === p1Id || m.player2Id === p1Id);
        const isP2 = p2Id && (m.player1Id === p2Id || m.player2Id === p2Id);
        if (!isP1 && !isP2) return false;
        const sched = otherMatchesSchedule[m.id];
        if (!sched) return false;
        return Math.max(targetStart, sched.startMins) < Math.min(targetEnd, sched.endMins);
      });
      if (conflictingPlayerMatch) {
        const sched = otherMatchesSchedule[conflictingPlayerMatch.id];
        const pName = (conflictingPlayerMatch.player1Id === p1Id || conflictingPlayerMatch.player2Id === p1Id)
          ? (participantsMap[p1Id]?.name || 'اللاعب 1')
          : (participantsMap[p2Id]?.name || 'اللاعب 2');
        playerConflict = {
          playerName: pName,
          match: conflictingPlayerMatch,
          sched
        };
      }
    }

    // 6. Break Conflict check
    const isKnockout = selectedMatch.stage && selectedMatch.stage !== 'group' && !selectedMatch.groupId;
    const dayKey = isKnockout ? 'knockout' : d;
    const breaks = config?.dayBreaks?.[dayKey] || config?.dayBreaks?.[d] || [];
    const breakConflict = breaks.find(b => {
      const bFrom = parseTimeToMins(b.from);
      const bTo = parseTimeToMins(b.to);
      return Math.max(targetStart, bFrom) < Math.min(targetEnd, bTo);
    });

    const isValid = !selectedConflict && !allOccupied && !playerConflict;

    return {
      hasCustomTime: true,
      targetStart,
      targetEnd,
      targetTimeStr: formatMinsToTime12(targetStart),
      targetEndTimeStr: formatMinsToTime12(targetEnd),
      deviceStatus,
      selectedConflict,
      allOccupied,
      availableConsoles,
      playerConflict,
      breakConflict,
      isValid
    };
  }, [selectedMatch, editedTime, editedConsole, editedDay, matches, config, matchDurationMins, otherMatchesSchedule, participantsMap, consolesCount]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedMatch) return;
    if (validationResult.hasCustomTime && !validationResult.isValid) {
      if (validationResult.selectedConflict) {
        if (onNotify) onNotify(`تعارض في الموعد: الجهاز ${editedConsole} مشغول في هذا التوقيت بمباراة #${validationResult.selectedConflict.conflictMatch.matchNumber}! يرجى اختيار جهاز متاح.`, 'error');
      } else if (validationResult.allOccupied) {
        if (onNotify) onNotify(`تعارض: جميع أجهزة البطولة (${consolesCount} أجهزة) مشغولة في هذا التوقيت! يرجى اختيار توقيت آخر.`, 'error');
      } else if (validationResult.playerConflict) {
        if (onNotify) onNotify(`تعارض في جدول اللاعبين: اللاعب ${validationResult.playerConflict.playerName} لديه مباراة أخرى في هذا التوقيت!`, 'error');
      }
      return;
    }

    setIsSaving(true);
    try {
      const updatedMatch = {
        ...selectedMatch,
        dayNumber: Number(editedDay) || 1,
        customTime: editedTime ? editedTime.trim() : null,
        consoleId: Number(editedConsole) || selectedMatch.consoleId || 1
      };

      if (onUpdateMatch) {
        await onUpdateMatch(updatedMatch);
      }
      setSaveSuccess(true);
      if (onNotify) {
        onNotify(`تم بنجاح تحديث موعد ويوم المباراة #${updatedMatch.matchNumber} وسريان التعديل عبر كافة الشاشات والصفحات!`, 'success');
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving adjusted match:', err);
      if (onNotify) onNotify(`حدث خطأ أثناء حفظ المباراة: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCustomTime = () => {
    setEditedTime('');
  };

  // Quick preset chips for match times
  const timePresets = [
    { time: '17:00', label: '05:00 م' },
    { time: '17:30', label: '05:30 م' },
    { time: '18:00', label: '06:00 م' },
    { time: '18:30', label: '06:30 م' },
    { time: '19:00', label: '07:00 م' },
    { time: '19:30', label: '07:30 م' },
    { time: '20:00', label: '08:00 م' },
    { time: '20:30', label: '08:30 م' },
    { time: '21:00', label: '09:00 م' },
    { time: '21:30', label: '09:30 م' },
    { time: '22:00', label: '10:00 م' }
  ];

  const p1 = selectedMatch ? participantsMap[selectedMatch.player1Id] : null;
  const p2 = selectedMatch ? participantsMap[selectedMatch.player2Id] : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      direction: 'rtl'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        border: '1px solid #CBD5E1',
        animation: 'modalSlideUp 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#DCFCE7',
              border: '1.5px solid #86EFAC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ksu-green)'
            }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>تعديل موعد ويوم المباراة</span>
                <span className="badge badge-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  🔒 إدارة رئيسية
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                ابحث بمعرّف أو رقم المباراة لتعديل وقتها ويومها وجهازها وسريان التعديل فوراً عبر جميع الصفحات
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B'
            }}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* STEP 1: Search or Pick Match ID */}
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              1. أدخل معرّف أو رقم المباراة (Match ID or #):
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input numeric"
                placeholder="أدخل رقم المباراة (مثال: 14 أو #14) أو معرّف ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '1.5px solid #10B981',
                  background: '#FFFFFF'
                }}
              />
              <Search size={18} color="#059669" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="مسح"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick dropdown fallback to pick from all matches */}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>أو اختر من القائمة:</span>
              <select
                className="form-select"
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
              >
                <option value="">-- اختر مباراة لتعديل موعدها --</option>
                {matches.map(m => {
                  const mP1 = participantsMap[m.player1Id]?.name || 'طرف 1';
                  const mP2 = participantsMap[m.player2Id]?.name || 'طرف 2';
                  return (
                    <option key={m.id} value={m.id}>
                      #{m.matchNumber}: {mP1} ضد {mP2} (اليوم {m.dayNumber || 1} • جهاز {m.consoleId})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Matching Suggestions list if searching */}
            {searchQuery.trim() && filteredMatches.length > 0 && (
              <div style={{
                marginTop: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '140px',
                overflowY: 'auto'
              }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', padding: '2px 8px', fontWeight: 700 }}>
                  نتائج المطابقة ({filteredMatches.length}):
                </span>
                {filteredMatches.map(m => {
                  const isCur = m.id === selectedMatchId;
                  const mP1 = participantsMap[m.player1Id]?.name || 'طرف 1';
                  const mP2 = participantsMap[m.player2Id]?.name || 'طرف 2';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMatchId(m.id)}
                      style={{
                        textAlign: 'right',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: isCur ? '#DCFCE7' : '#FFFFFF',
                        border: isCur ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>مباراة #{m.matchNumber}: {mP1} ⚔️ {mP2}</span>
                      <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>
                        اليوم {m.dayNumber || 1} • جهاز {m.consoleId}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 2: Display Match Data Card */}
          {selectedMatch ? (
            <div style={{
              background: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Match Header Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                paddingBottom: '10px',
                borderBottom: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-green" style={{ fontSize: '0.85rem', fontWeight: 900, padding: '3px 10px' }}>
                    مباراة #{selectedMatch.matchNumber}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedMatch.stage === 'group' || !selectedMatch.stage 
                      ? (selectedMatch.groupName ? `دور المجموعات (${selectedMatch.groupName})` : 'دور المجموعات')
                      : (selectedMatch.title || 'الأدوار الإقصائية')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-gray" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                    معرّف: <span className="numeric">{selectedMatch.id}</span>
                  </span>
                  <span className={`badge ${selectedMatch.status === 'completed' ? 'badge-gray' : (selectedMatch.status === 'live' ? 'badge-green' : 'badge-gold')}`} style={{ fontSize: '0.72rem' }}>
                    {selectedMatch.status === 'completed' ? 'منتهية ✓' : (selectedMatch.status === 'live' ? 'جارية الآن 🔴' : 'مجدولة ⏳')}
                  </span>
                </div>
              </div>

              {/* Competitors Display */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '10px',
                background: '#FFFFFF',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0'
              }}>
                {/* Competitor 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getTeamLogoUrl(p1?.team) && (
                    <img 
                      src={getTeamLogoUrl(p1?.team)} 
                      alt={p1?.team} 
                      style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      {p1?.name || selectedMatch.player1Placeholder || 'اللاعب 1'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {p1?.team || '—'} {p1?.displayPhone ? `• 📞 ${p1.displayPhone}` : ''}
                    </div>
                  </div>
                </div>

                {/* VS or Score */}
                <div style={{ textAlign: 'center', padding: '0 8px' }}>
                  {selectedMatch.status === 'completed' || selectedMatch.status === 'walkover' ? (
                    <div className="numeric" style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--ksu-green)' }}>
                      {selectedMatch.score1 ?? 0} - {selectedMatch.score2 ?? 0}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#94A3B8' }}>
                      ضد
                    </div>
                  )}
                </div>

                {/* Competitor 2 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', textAlign: 'left' }}>
                      {p2?.name || selectedMatch.player2Placeholder || 'اللاعب 2'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'left' }}>
                      {p2?.team || '—'} {p2?.displayPhone ? `• 📞 ${p2.displayPhone}` : ''}
                    </div>
                  </div>
                  {getTeamLogoUrl(p2?.team) && (
                    <img 
                      src={getTeamLogoUrl(p2?.team)} 
                      alt={p2?.team} 
                      style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                    />
                  )}
                </div>
              </div>

              {/* Current Match Parameters info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#475569' }}>
                <span><b>اليوم الحالي:</b> اليوم {selectedMatch.dayNumber || 1}</span>
                <span>•</span>
                <span><b>الجهاز الحالي:</b> جهاز {selectedMatch.consoleId || 1}</span>
                <span>•</span>
                <span>
                  <b>الموعد الحالي:</b> {selectedMatch.customTime ? `${formatMinsToTime12(parseTimeToMins(selectedMatch.customTime))} (مخصص يدوياً ⚠️)` : 'تلقائي وفق جدول الصالة'}
                </span>
              </div>

              {/* STEP 3: Controls to Adjust Time & Day */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1.5px solid #86EFAC',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} />
                  <span>تعديل اليوم والموعد والجهاز للمباراة:</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  {/* Day Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-main)' }}>
                      🗓️ اليوم المقترح:
                    </label>
                    <select
                      className="form-select numeric"
                      value={editedDay}
                      onChange={(e) => setEditedDay(Number(e.target.value))}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      {Array.from({ length: tournamentDaysCount }, (_, i) => i + 1).map(d => {
                        const dateStr = dayDates[d] || (d === 3 ? dayDates.knockout : '');
                        const dayLabel = d === 3 ? 'اليوم 3 (النهائيات)' : `اليوم ${d}`;
                        return (
                          <option key={d} value={d}>
                            {dayLabel} {dateStr ? `(${dateStr})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Match Time Input */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        ⏰ موعد الانطلاق:
                      </label>
                      {editedTime && (
                        <button
                          type="button"
                          onClick={handleClearCustomTime}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#DC2626',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="استعادة الجدولة التلقائية"
                        >
                          <RotateCcw size={11} />
                          <span>تلقائي</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="time"
                      className="form-input numeric"
                      value={editedTime}
                      onChange={(e) => setEditedTime(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem', fontWeight: 800 }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                      {editedTime ? `الموعد بالصيغة العربية: ${formatMinsToTime12(parseTimeToMins(editedTime))}` : 'متروك تلقائياً بحسب تسلسل مباريات الصالة'}
                    </span>
                  </div>

                  {/* Console Selector Dropdown (Quick) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-main)' }}>
                      🎮 جهاز البلايستيشن:
                    </label>
                    <select
                      className="form-select numeric"
                      value={editedConsole}
                      onChange={(e) => setEditedConsole(Number(e.target.value))}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      {Array.from({ length: consolesCount }, (_, i) => i + 1).map(c => {
                        const devStatus = validationResult.deviceStatus[c];
                        const label = validationResult.hasCustomTime 
                          ? (devStatus?.available ? `جهاز ${c} (متاح ✓)` : `جهاز ${c} (${devStatus?.label || 'مشغول ✕'})`)
                          : `جهاز ${c}`;
                        return (
                          <option key={c} value={c}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Quick Time Preset Chips */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    خيارات أوقات سريعة:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {timePresets.map(preset => {
                      const isSelected = editedTime === preset.time;
                      return (
                        <button
                          key={preset.time}
                          type="button"
                          onClick={() => setEditedTime(preset.time)}
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.72rem', padding: '2px 8px', height: 'auto', minHeight: 'unset' }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Device Availability Matrix across all X devices */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      <Monitor size={15} color="var(--ksu-green)" />
                      <span>حالة الأجهزة الـ ({consolesCount}) في التوقيت المحدد:</span>
                    </div>
                    {validationResult.hasCustomTime && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: validationResult.allOccupied ? '#DC2626' : (validationResult.availableConsoles.length > 0 ? '#16A34A' : '#64748B')
                      }}>
                        {validationResult.allOccupied 
                          ? '⚠️ جميع الأجهزة مشغولة' 
                          : `${validationResult.availableConsoles.length} من أصل ${consolesCount} متاحة`}
                      </span>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(consolesCount, 5)}, 1fr)`,
                    gap: '8px'
                  }}>
                    {Array.from({ length: consolesCount }, (_, i) => i + 1).map(c => {
                      const isSelected = Number(editedConsole) === c;
                      const devStatus = validationResult.deviceStatus[c];
                      const isAvail = !validationResult.hasCustomTime || (devStatus?.available !== false);

                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditedConsole(c)}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '10px',
                            border: isSelected
                              ? (isAvail ? '2px solid #16A34A' : '2px solid #DC2626')
                              : (isAvail ? '1.5px solid #CBD5E1' : '1.5px solid #FCA5A5'),
                            background: isSelected
                              ? (isAvail ? '#DCFCE7' : '#FEE2E2')
                              : (isAvail ? '#FFFFFF' : '#FFF1F2'),
                            color: isSelected
                              ? (isAvail ? '#065F46' : '#991B1B')
                              : (isAvail ? 'var(--text-main)' : '#9F1239'),
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected 
                              ? (isAvail ? '0 0 0 3px rgba(34,197,94,0.2)' : '0 0 0 3px rgba(239,68,68,0.25)') 
                              : 'none'
                          }}
                          title={devStatus?.detail || `جهاز ${c}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Monitor size={12} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>جهاز {c}</span>
                          </div>
                          {validationResult.hasCustomTime ? (
                            <span style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: isAvail ? '#BBF7D0' : '#FECDD3',
                              color: isAvail ? '#166534' : '#991B1B',
                              whiteSpace: 'nowrap'
                            }}>
                              {isAvail ? 'متاح ✓' : (devStatus?.label || 'مشغول ✕')}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.64rem', color: '#64748B' }}>
                              {isSelected ? 'المحدد' : 'اختيار'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conflict Warnings & Availability Banners */}
                {validationResult.hasCustomTime && (
                  <div>
                    {/* 1. Selected Device Conflict Banner */}
                    {validationResult.selectedConflict && (
                      <div style={{
                        background: '#FEF2F2',
                        border: '1.5px solid #F87171',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 800, fontSize: '0.84rem' }}>
                          <AlertTriangle size={18} color="#DC2626" />
                          <span>تعارض في التوقيت على جهاز {editedConsole}!</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#7F1D1D', lineHeight: 1.4 }}>
                          هذا الجهاز محجوز بالفعل في هذا التوقيت بـ <b>{validationResult.selectedConflict.detail}</b>.
                        </div>
                        {validationResult.availableConsoles.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46' }}>الأجهزة المتاحة الآن:</span>
                            {validationResult.availableConsoles.map(ac => (
                              <button
                                key={ac}
                                type="button"
                                onClick={() => setEditedConsole(ac)}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px' }}
                              >
                                تحويل إلى جهاز {ac} ⚡
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. All Devices Occupied Alert */}
                    {validationResult.allOccupied && (
                      <div style={{
                        background: '#FEF2F2',
                        border: '1.5px solid #EF4444',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#991B1B',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertCircle size={20} color="#DC2626" />
                        <span>تعارض كامل: جميع أجهزة البطولة ({consolesCount} أجهزة) مشغولة في هذا التوقيت ({validationResult.targetTimeStr} - {validationResult.targetEndTimeStr})! يرجى اختيار وقت آخر.</span>
                      </div>
                    )}

                    {/* 3. Player Schedule Conflict */}
                    {validationResult.playerConflict && (
                      <div style={{
                        background: '#FFFBEB',
                        border: '1.5px solid #F59E0B',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#92400E',
                        fontSize: '0.82rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                          <AlertTriangle size={18} color="#D97706" />
                          <span>تعارض في جدول اللاعبين!</span>
                        </div>
                        <div style={{ fontSize: '0.78rem' }}>
                          اللاعب <b>{validationResult.playerConflict.playerName}</b> مجدول في مباراة أخرى (<b>#{validationResult.playerConflict.match.matchNumber}</b>) في نفس التوقيت على جهاز {validationResult.playerConflict.match.consoleId} ({validationResult.playerConflict.sched.timeStr})!
                        </div>
                      </div>
                    )}

                    {/* 4. Break Warning */}
                    {validationResult.breakConflict && (
                      <div style={{
                        background: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.76rem',
                        color: '#92400E',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <AlertCircle size={15} color="#D97706" />
                        <span>تنبيه: هذا التوقيت يتزامن مع فترة استراحة الصالة ({validationResult.breakConflict.from} - {validationResult.breakConflict.to}).</span>
                      </div>
                    )}

                    {/* 5. Success Availability Confirmation */}
                    {validationResult.isValid && (
                      <div style={{
                        background: '#F0FDF4',
                        border: '1px solid #86EFAC',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.78rem',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }}>
                        <CheckCircle2 size={16} color="#16A34A" />
                        <span>الموعد مؤكد ومتاح على جهاز {editedConsole} من {validationResult.targetTimeStr} إلى {validationResult.targetEndTimeStr} بدون أي تعارض.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Save Confirmation Message */}
                {saveSuccess && (
                  <div style={{
                    background: '#ECFDF5',
                    border: '1px solid #6EE7B7',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: '#065F46',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Check size={16} />
                    <span>تم حفظ التعديل بنجاح وسريانه على كافة الشاشات والصفحات!</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onClose}
                    disabled={isSaving}
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving || (validationResult.hasCustomTime && !validationResult.isValid)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 20px',
                      fontWeight: 800,
                      opacity: (validationResult.hasCustomTime && !validationResult.isValid) ? 0.5 : 1,
                      cursor: (validationResult.hasCustomTime && !validationResult.isValid) ? 'not-allowed' : 'pointer'
                    }}
                    title={validationResult.hasCustomTime && !validationResult.isValid ? 'يرجى حل التعارض في الجهاز أو اللاعبين للحفظ' : ''}
                  >
                    <Check size={16} />
                    <span>{isSaving ? 'جاري المزامنة والحفظ...' : 'حفظ وتحديث المباراة فوراً'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1.5px dashed #CBD5E1',
              color: 'var(--text-muted)'
            }}>
              <AlertCircle size={32} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                يرجى إدخال رقم أو معرّف المباراة في الحقل أعلاه
              </div>
              <div style={{ fontSize: '0.78rem' }}>
                سيتم عرض بيانات المباراة كاملة فور إدخال رقمها (مثال: 10 أو #10 أو اختيارها من القائمة) لتعديل توقيتها ويومها.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
