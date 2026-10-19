import React, { useState, useEffect } from 'react';
import { Calendar, Monitor, Search, Filter, Play, Pause, RotateCcw, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import ScoreModal from './ScoreModal';
import { getConsoleStatusMap } from '../utils/tournamentEngine';

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

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleStatusMap = React.useMemo(() => {
    return getConsoleStatusMap(matches, consolesCount);
  }, [matches, consolesCount]);

  const handleStartMatch = (match) => {
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'live', startedAt: new Date().toISOString() } : m));
    onNotify(`تم بدء المباراة #${match.matchNumber} على جهاز ${match.consoleId}`, 'info');
    resetTimer();
    setIsTimerRunning(true);
  };

  const handleSaveScore = (updatedMatch) => {
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    onNotify(`تم حفظ واعتماد نتيجة المباراة #${updatedMatch.matchNumber}! تم تلقائياً تصعيد المباراة التالية على جهاز ${updatedMatch.consoleId}`, 'success');
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="tab-content">
      {/* Top Bar: Official Match Timer & View Mode */}
      <div className="clean-card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Match Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color="var(--ksu-green)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>مؤقت الصالة:</span>
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

            <button className="btn btn-secondary btn-sm" onClick={() => resetTimer()}>
              <RotateCcw size={14} />
            </button>
          </div>

          {/* View Mode Toggle: Consoles Queue Board vs All Matches List */}
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

      {/* VIEW 1: Automated Consoles Queue Board (الأجهزة والمطابقة التلقائية) */}
      {viewMode === 'consoles' && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(270px, 1fr))`, gap: '16px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Monitor size={18} color="var(--ksu-green)" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>جهاز {cId}</span>
                  </div>
                  <span className="badge badge-gray numeric">{cData.completedCount} / {cData.totalCount} منتهية</span>
                </div>

                {/* CURRENT MATCH (الآن على الجهاز) */}
                <div style={{ 
                  background: current ? '#ECFDF5' : 'var(--bg-subtle)', 
                  border: current ? '2px solid #059669' : '1px dashed var(--border-strong)', 
                  borderRadius: '10px', 
                  padding: '12px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8rem', color: current ? '#065F46' : 'var(--text-muted)' }}>
                      🟢 الجارية الآن (Current)
                    </span>
                    {current && (
                      <span className="badge badge-green">مباراة #{current.matchNumber}</span>
                    )}
                  </div>

                  {current ? (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {current.groupName} — جولة {current.roundNumber || 1}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p1?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p1?.team}</div>
                        </div>
                        <div className="numeric" style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--ksu-green)' }}>
                          {current.score1 !== null ? `${current.score1} : ${current.score2}` : 'ضد'}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p2?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p2?.team}</div>
                        </div>
                      </div>

                      {/* Action buttons for Current match */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        {current.status !== 'live' && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1 }}
                            onClick={() => handleStartMatch(current)}
                          >
                            <Play size={13} />
                            بدء الآن
                          </button>
                        )}
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ flex: 1 }}
                          onClick={() => setSelectedMatch(current)}
                        >
                          رصد النتيجة وإنهاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      تم انتهاء جميع مباريات هذا الجهاز ✓
                    </div>
                  )}
                </div>

                {/* NEXT MATCH (التالي للاستعداد) */}
                {next && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                      🟡 التالي للاستعداد (Up Next):
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {nextP1?.name} ضد {nextP2?.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      مباراة #{next.matchNumber} {next.groupName} — جولة {next.roundNumber || 1}
                    </div>
                  </div>
                )}

                {/* FULL QUEUE OF REMAINING MATCHES (طابور الجهاز الكامل) */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    طابور الجهاز بالترتيب الكامل ({cData.matches.length} مباراة):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto', paddingRight: '2px' }}>
                    {cData.matches.map((m, idx) => {
                      const isCur = current && current.id === m.id;
                      const isNext = next && next.id === m.id;
                      const isDone = m.status === 'completed' || m.status === 'walkover';
                      const mp1 = participantsMap[m.player1Id];
                      const mp2 = participantsMap[m.player2Id];

                      return (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedMatch(m)}
                          style={{
                            padding: '6px 10px',
                            background: isCur ? '#ECFDF5' : (isNext ? '#FFFBEB' : (isDone ? '#F8FAFC' : '#FFFFFF')),
                            border: `1px solid ${isCur ? '#059669' : (isNext ? '#FCD34D' : 'var(--border-light)')}`,
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isDone ? 0.65 : 1
                          }}
                          title="اضغط لرصد أو تعديل النتيجة"
                        >
                          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            <span className="numeric" style={{ fontWeight: 700, color: 'var(--text-dim)', marginLeft: '6px' }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontWeight: isCur ? 800 : 600 }}>
                              {mp1?.name} ضد {mp2?.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                              {m.groupName} (جولة {m.roundNumber || 1})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {isDone ? (
                              <span className="numeric" style={{ fontWeight: 800, color: '#059669' }}>
                                {m.score1} : {m.score2} ✓
                              </span>
                            ) : (
                              <span className={`badge ${isCur ? 'badge-green' : (isNext ? 'badge-gold' : 'badge-gray')}`} style={{ fontSize: '0.65rem' }}>
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

      {/* VIEW 2: General Filterable List View */}
      {viewMode === 'list' && (
        <div className="matches-grid">
          {matches.map(match => {
            const p1 = participantsMap[match.player1Id];
            const p2 = participantsMap[match.player2Id];
            const isCompleted = match.status === 'completed' || match.status === 'walkover';
            const isLive = match.status === 'live';

            return (
              <div key={match.id} className={`match-card ${isLive ? 'live' : ''}`}>
                <div className="match-top-bar">
                  <span style={{ fontWeight: 700 }}>
                    مباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-gray">
                      جهاز {match.consoleId} (ترتيب {match.orderOnConsole || 1})
                    </span>
                    <span className={`badge ${isCompleted ? 'badge-green' : (isLive ? 'badge-gold' : 'badge-gray')}`}>
                      {isCompleted ? 'منتهية' : (isLive ? 'جارية بالصالة' : 'مجدولة')}
                    </span>
                  </div>
                </div>

                <div className="match-opponents">
                  <div className="match-player p1">
                    <span className="player-name">{p1?.name || 'مشارك 1'}</span>
                    <span className="player-team">{p1?.team}</span>
                  </div>

                  <div className="match-score-badge">
                    {match.score1 !== null && match.score2 !== null ? (
                      <span>{match.score1} : {match.score2}</span>
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
