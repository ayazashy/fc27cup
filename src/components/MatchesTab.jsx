import React, { useState, useEffect } from 'react';
import { Calendar, Monitor, Search, Filter, Play, Pause, RotateCcw, Clock, CheckCircle2, AlertCircle, ArrowRight, Check, Scale } from 'lucide-react';
import ScoreModal from './ScoreModal';
import { getConsoleStatusMap, rebalanceRemainingMatches } from '../utils/tournamentEngine';

export default function MatchesTab({ 
  matches, 
  setMatches, 
  participants, 
  config,
  onNotify
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [viewMode, setViewMode] = useState('consoles'); // 'consoles' (Queues) or 'list'
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consoleFilter, setConsoleFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Built-in Hall Match Timer
  const [timerMinutes, setTimerMinutes] = useState(12);
  const [timeLeft, setTimeLeft] = useState(12 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      onNotify('⏰ انتهى وقت المباراة الرسمية!', 'info');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, onNotify]);

  const resetTimer = (mins = timerMinutes) => {
    setIsTimerRunning(false);
    setTimeLeft(mins * 60);
  };

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const minDuration = Number(config.minMatchDuration) || 10;
  const maxDuration = Number(config.maxMatchDuration) || 15;
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const tickInterval = setInterval(() => setTimeTick(Date.now()), 30000);
    return () => clearInterval(tickInterval);
  }, []);

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleStatusMap = React.useMemo(() => {
    return getConsoleStatusMap(matches, consolesCount, minDuration, maxDuration);
  }, [matches, consolesCount, minDuration, maxDuration, timeTick]);

  // Set of all current match IDs across all consoles
  const currentMatchIds = React.useMemo(() => {
    const ids = new Set();
    Object.values(consoleStatusMap).forEach(c => {
      if (c.currentMatch) ids.add(c.currentMatch.id);
    });
    return ids;
  }, [consoleStatusMap]);

  // Set of all next match IDs across all consoles
  const nextMatchIds = React.useMemo(() => {
    const ids = new Set();
    Object.values(consoleStatusMap).forEach(c => {
      if (c.nextMatch) ids.add(c.nextMatch.id);
    });
    return ids;
  }, [consoleStatusMap]);

  const handleStartMatch = (match) => {
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'live', startedAt: new Date().toISOString() } : m));
    onNotify(`تم بدء المباراة #${match.matchNumber} على جهاز ${match.consoleId}`, 'info');
    resetTimer();
    setIsTimerRunning(true);
  };

  const handleSaveScore = (updatedMatch) => {
    const updated = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    // Dynamically balance queued matches across idle / lighter devices
    const rebalanced = rebalanceRemainingMatches(updated, consolesCount);
    setMatches(rebalanced);
    onNotify(`تم اعتماد نتيجة المباراة #${updatedMatch.matchNumber}! تم تلقائياً موازنة طوابير الأجهزة وتحديث المواعيد التقديرية`, 'success');
  };

  const handleManualRebalance = () => {
    const rebalanced = rebalanceRemainingMatches(matches, consolesCount);
    setMatches(rebalanced);
    onNotify('تمت إعادة موازنة طوابير المباريات بالتساوي على جميع أجهزة الصالة!', 'success');
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredMatches = matches.filter(m => {
    if (stageFilter === 'group' && m.stage !== 'group') return false;
    if (stageFilter === 'knockout' && m.stage === 'group') return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (consoleFilter !== 'all' && String(m.consoleId) !== String(consoleFilter)) return false;
    if (dayFilter !== 'all' && String(m.dayNumber || 1) !== String(dayFilter)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const p1 = participantsMap[m.player1Id]?.name?.toLowerCase() || '';
      const p2 = participantsMap[m.player2Id]?.name?.toLowerCase() || '';
      return p1.includes(q) || p2.includes(q);
    }
    return true;
  });

  return (
    <div className="tab-content">
      {/* Visual Status Legend Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          <span>دليل الحالات الملون:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.825rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#ECFDF5', border: '2px solid #059669', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: '#065F46' }}>أخضر: المباراة الجارية الآن (Current)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FEF9C3', border: '2px solid #CA8A04', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: '#854D0E' }}>أصفر: المباراة التالية للاستعداد (Next)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#F1F5F9', border: '1px solid #94A3B8', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 600, color: '#64748B' }}>رمادي: مباراة منتهية (Finished)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FFFFFF', border: '1px solid var(--border-strong)', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>أبيض: في طابور الانتظار (Queued)</span>
          </div>
        </div>
      </div>

      {/* Official Match Timer & View Mode */}
      <div className="clean-card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Match Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color="var(--ksu-green)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>مؤقت وقت المباراة:</span>
            <span className="numeric" style={{ fontSize: '1.5rem', fontWeight: 800, color: timeLeft <= 60 ? '#DC2626' : 'var(--ksu-green)', minWidth: '70px', textAlign: 'center' }}>
              {formatTimer(timeLeft)}
            </span>

            <select 
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
              value={timerMinutes}
              onChange={(e) => {
                const m = Number(e.target.value);
                setTimerMinutes(m);
                resetTimer(m);
              }}
            >
              <option value={10}>10 دقائق (المجموعات)</option>
              <option value={12}>12 دقيقة (الافتراضي)</option>
              <option value={15}>15 دقيقة (دور 16 وربع)</option>
              <option value={20}>20 دقيقة (نصف ونهائي)</option>
            </select>

            <button 
              className={`btn ${isTimerRunning ? 'btn-danger' : 'btn-primary'} btn-sm`}
              onClick={() => setIsTimerRunning(!isTimerRunning)}
            >
              {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
              {isTimerRunning ? 'إيقاف مؤقت' : 'بدء الشوط'}
            </button>

            <button className="btn btn-secondary btn-sm" onClick={() => resetTimer()} title="إعادة تعيين المؤقت">
              <RotateCcw size={14} />
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleManualRebalance}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              title="موازنة المباريات المتبقية بالتساوي على جميع الأجهزة الشاغرة لمنع فراغ أي جهاز"
            >
              <Scale size={14} color="var(--ksu-green)" />
              <span>موازنة طوابير الأجهزة</span>
            </button>
          </div>

          {/* Day Filter & View Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
              <button 
                className={`btn btn-sm ${dayFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem' }}
                onClick={() => setDayFilter('all')}
              >
                كل الأيام
              </button>
              {Array.from({ length: Number(config.tournamentDays) || 2 }, (_, i) => i + 1).map(d => (
                <button 
                  key={d}
                  className={`btn btn-sm ${dayFilter === String(d) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem' }}
                  onClick={() => setDayFilter(String(d))}
                >
                  اليوم {d}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'consoles' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 14px', border: 'none' }}
              onClick={() => setViewMode('consoles')}
            >
              <Monitor size={15} />
              طوابير أجهزة الصالة (1 إلى {consolesCount})
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 14px', border: 'none' }}
              onClick={() => setViewMode('list')}
            >
              <Calendar size={15} />
              قائمة المباريات العامة
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* VIEW 1: Automated Consoles Queue Board */}
      {viewMode === 'consoles' && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`, gap: '16px' }}>
          {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => {
            const cData = consoleStatusMap[cId] || { matches: [], currentMatch: null, nextMatch: null, completedCount: 0, totalCount: 0 };
            const current = cData.currentMatch;
            const next = cData.nextMatch;
            const p1 = current ? participantsMap[current.player1Id] : null;
            const p2 = current ? participantsMap[current.player2Id] : null;
            const nextP1 = next ? participantsMap[next.player1Id] : null;
            const nextP2 = next ? participantsMap[next.player2Id] : null;

            return (
              <div key={cId} className="clean-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Console Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border-light)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Monitor size={20} color="var(--ksu-green)" />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>جهاز {cId}</span>
                  </div>
                  <span className="badge badge-gray numeric">{cData.completedCount} / {cData.totalCount} منتهية</span>
                </div>

                {/* 1. CURRENT MATCH (Highlighted in GREEN) */}
                <div style={{ 
                  background: current ? '#ECFDF5' : '#F8FAFC', 
                  border: current ? '2.5px solid #059669' : '1px dashed var(--border-strong)', 
                  borderRadius: '10px', 
                  padding: '14px',
                  boxShadow: current ? '0 4px 12px rgba(5, 150, 105, 0.12)' : 'none',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: current ? '#065F46' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: current ? '#10B981' : '#CBD5E1', display: 'inline-block' }}></span>
                      {current ? 'الجارية الآن على الجهاز (Current)' : 'لا توجد مباراة نشطة'}
                    </span>
                    {current && (
                      <span className="badge badge-green" style={{ fontWeight: 800 }}>مباراة #{current.matchNumber}</span>
                    )}
                  </div>

                  {current ? (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600, marginBottom: '6px' }}>
                        {current.groupName} — جولة {current.roundNumber || 1}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(5, 150, 105, 0.2)', borderBottom: '1px solid rgba(5, 150, 105, 0.2)' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)' }}>{p1?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p1?.team}</div>
                        </div>

                        <div className="numeric" style={{ fontWeight: 900, fontSize: '1.35rem', color: '#059669', padding: '0 8px' }}>
                          {current.score1 !== null ? `${current.score1} : ${current.score2}` : 'ضد'}
                        </div>

                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)' }}>{p2?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p2?.team}</div>
                        </div>
                      </div>

                      {/* Action buttons for Current match */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {current.status !== 'live' && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1, borderColor: '#059669', color: '#065F46' }}
                            onClick={() => handleStartMatch(current)}
                          >
                            <Play size={13} />
                            بدء المباراة
                          </button>
                        )}
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ flex: 1.2, fontWeight: 700 }}
                          onClick={() => setSelectedMatch(current)}
                        >
                          رصد النتيجة وإنهاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      تم إنهاء جميع مباريات هذا الجهاز ✓
                    </div>
                  )}
                </div>

                {/* 2. NEXT MATCH (Highlighted in YELLOW) */}
                {next && (
                  <div style={{ 
                    background: '#FEF9C3', 
                    border: '2px solid #CA8A04', 
                    borderRadius: '8px', 
                    padding: '10px 12px',
                    boxShadow: '0 2px 6px rgba(202, 138, 4, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EAB308', display: 'inline-block' }}></span>
                        التالية للاستعداد (Up Next):
                      </span>
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>مباراة #{next.matchNumber}</span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#713F12' }}>
                      {nextP1?.name} ضد {nextP2?.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#854D0E' }}>
                      {next.groupName} — جولة {next.roundNumber || 1}
                    </div>
                    {next.estimatedTime && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#854D0E', marginTop: '6px', fontWeight: 700 }}>
                        <Clock size={13} />
                        <span>الوقت التقديري لبدء المباراة: {next.estimatedTime.rangeStr}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. FULL QUEUE WITH COLOR CODED ROWS (Green / Yellow / Grey / White) */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    طابور الجهاز الكامل ({cData.matches.length} مباراة):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto', paddingRight: '2px' }}>
                    {cData.matches.map((m, idx) => {
                      const isCur = current && current.id === m.id;
                      const isNext = next && next.id === m.id;
                      const isDone = m.status === 'completed' || m.status === 'walkover';
                      const mp1 = participantsMap[m.player1Id];
                      const mp2 = participantsMap[m.player2Id];

                      // Dynamic Color Coding:
                      // Current -> Green (#ECFDF5 + #059669)
                      // Next -> Yellow (#FEF9C3 + #CA8A04)
                      // Finished -> Grey (#F1F5F9 + #94A3B8)
                      // Queued -> Clean White (#FFFFFF + #E2E8F0)
                      let rowBg = '#FFFFFF';
                      let rowBorder = 'var(--border-light)';
                      let rowColor = 'var(--text-main)';

                      if (isCur) {
                        rowBg = '#ECFDF5';
                        rowBorder = '#059669';
                        rowColor = '#065F46';
                      } else if (isNext) {
                        rowBg = '#FEF9C3';
                        rowBorder = '#CA8A04';
                        rowColor = '#854D0E';
                      } else if (isDone) {
                        rowBg = '#F1F5F9';
                        rowBorder = '#CBD5E1';
                        rowColor = '#64748B';
                      }

                      return (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedMatch(m)}
                          style={{
                            padding: '7px 10px',
                            background: rowBg,
                            border: `1.5px solid ${rowBorder}`,
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isDone ? 0.7 : 1,
                            transition: 'all 0.15s ease'
                          }}
                          title="اضغط لرصد أو تعديل النتيجة"
                        >
                          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            <span className="numeric" style={{ fontWeight: 800, color: isCur ? '#059669' : (isNext ? '#854D0E' : 'var(--text-dim)'), marginLeft: '6px' }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontWeight: isCur ? 800 : (isNext ? 700 : (isDone ? 500 : 600)), color: rowColor }}>
                              {mp1?.name} ضد {mp2?.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: isDone ? '#94A3B8' : 'var(--text-muted)', display: 'block' }}>
                              {m.groupName} (جولة {m.roundNumber || 1}) • <b style={{ color: '#047857' }}>اليوم {m.dayNumber || 1}</b>
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {m.estimatedTime && !isDone && !isCur && (
                              <span 
                                className="numeric"
                                style={{
                                  fontSize: '0.68rem',
                                  color: '#475569',
                                  background: '#F1F5F9',
                                  border: '1px solid #E2E8F0',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}
                                title="الوقت التقديري المتوقع لبدء المباراة (hh:mm - hh:mm)"
                              >
                                🕒 {m.estimatedTime.rangeStr}
                              </span>
                            )}
                            {isDone ? (
                              <span className="numeric" style={{ fontWeight: 800, color: '#475569' }}>
                                {m.score1} : {m.score2} ✓
                              </span>
                            ) : (
                              <span 
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isCur ? '#059669' : (isNext ? '#CA8A04' : '#E2E8F0'),
                                  color: isCur ? '#FFFFFF' : (isNext ? '#FFFFFF' : '#475569')
                                }}
                              >
                                {isCur ? 'الآن' : (isNext ? 'التالي' : 'مجدول')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: General Filterable List View with Matching Color Coding */}
      {viewMode === 'list' && (
        <div className="matches-grid">
          {filteredMatches.map(match => {
            const p1 = participantsMap[match.player1Id];
            const p2 = participantsMap[match.player2Id];
            const isCompleted = match.status === 'completed' || match.status === 'walkover';
            const isCurrent = currentMatchIds.has(match.id);
            const isNext = nextMatchIds.has(match.id);

            // Card styling by status
            let cardBg = '#FFFFFF';
            let cardBorder = 'var(--border-light)';
            if (isCurrent) {
              cardBg = '#ECFDF5';
              cardBorder = '#059669';
            } else if (isNext) {
              cardBg = '#FEF9C3';
              cardBorder = '#CA8A04';
            } else if (isCompleted) {
              cardBg = '#F1F5F9';
              cardBorder = '#CBD5E1';
            }

            return (
              <div 
                key={match.id} 
                className="match-card" 
                style={{ 
                  background: cardBg, 
                  border: `2px solid ${cardBorder}`,
                  opacity: isCompleted ? 0.75 : 1
                }}
              >
                <div className="match-top-bar">
                  <span style={{ fontWeight: 800, color: isCurrent ? '#065F46' : 'var(--text-main)' }}>
                    مباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : ''} • <span style={{ color: '#047857' }}>اليوم {match.dayNumber || 1}</span>
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-gray">
                      جهاز {match.consoleId} (ترتيب {match.orderOnConsole || 1})
                    </span>

                    {isCurrent ? (
                      <span className="badge badge-green" style={{ fontWeight: 800 }}>🟢 جارية الآن</span>
                    ) : (isNext ? (
                      <span className="badge badge-gold" style={{ fontWeight: 800 }}>🟡 التالية للاستعداد</span>
                    ) : (isCompleted ? (
                      <span className="badge badge-gray" style={{ background: '#CBD5E1', color: '#334155' }}>✓ منتهية</span>
                    ) : (
                      <span className="badge badge-gray">مجدولة</span>
                    )))}
                  </div>
                </div>

                <div className="match-opponents" style={{ background: isCurrent ? '#D1FAE5' : (isNext ? '#FEF08A' : 'var(--bg-subtle)') }}>
                  <div className="match-player p1">
                    <span className="player-name">{p1?.name || 'مشارك 1'}</span>
                    <span className="player-team">{p1?.team}</span>
                  </div>

                  <div className="match-score-badge">
                    {match.score1 !== null && match.score2 !== null ? (
                      <span className="numeric">{match.score1} : {match.score2}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>VS</span>
                    )}
                  </div>

                  <div className="match-player p2">
                    <span className="player-name">{p2?.name || 'مشارك 2'}</span>
                    <span className="player-team">{p2?.team}</span>
                  </div>
                </div>

                <div className="match-footer" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setSelectedMatch(match)}>
                    {isCompleted ? 'تعديل النتيجة' : 'رصد النتيجة'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Score Modal */}
      {selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          p1={participantsMap[selectedMatch.player1Id]}
          p2={participantsMap[selectedMatch.player2Id]}
          onClose={() => setSelectedMatch(null)}
          onSaveScore={handleSaveScore}
        />
      )}
    </div>
  );
}
