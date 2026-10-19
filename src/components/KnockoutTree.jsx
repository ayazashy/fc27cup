import React, { useState } from 'react';
import { Trophy, Award, Medal, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Layers, Sliders } from 'lucide-react';
import ScoreModal from './ScoreModal';
import confetti from 'canvas-confetti';
import { propagateWinnerInTree } from '../utils/tournamentEngine';

export default function KnockoutTree({ 
  matches, 
  setMatches, 
  participants, 
  onNotify 
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Focused stage index for dynamic collapse (0 = First round e.g. R32, 1 = R16, 2 = QF, 3 = SF, 4 = Final)
  const [focusedStageIndex, setFocusedStageIndex] = useState(null); // null means full tree mode
  const [smartCollapse, setSmartCollapse] = useState(true);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = matches.filter(m => m.stage !== 'group');

  // Identify distinct rounds in chronological order
  const rounds = React.useMemo(() => {
    const rMap = {};
    knockoutMatches.forEach(m => {
      const rIdx = m.roundIndex ?? 0;
      if (!rMap[rIdx]) {
        let label = 'دور إقصائي';
        let short = 'دور';
        if (m.stage === 'r64') { label = 'دور الـ 64'; short = 'دوري 64'; }
        else if (m.stage === 'r32') { label = 'دور الـ 32'; short = 'دوري 32'; }
        else if (m.stage === 'r16') { label = 'دور الـ 16'; short = 'دوري 16'; }
        else if (m.stage === 'qf') { label = 'ربع النهائي'; short = 'ربع النهائي'; }
        else if (m.stage === 'sf') { label = 'نصف النهائي'; short = 'نصف النهائي'; }
        else if (m.stage === 'final') { label = 'المباراة النهائية 🏆'; short = 'النهائي 🏆'; }

        rMap[rIdx] = {
          roundIndex: rIdx,
          stage: m.stage,
          title: label,
          shortTitle: short,
          matches: []
        };
      }
      rMap[rIdx].matches.push(m);
    });

    return Object.values(rMap).sort((a, b) => a.roundIndex - b.roundIndex);
  }, [knockoutMatches]);

  const totalRounds = rounds.length;

  // Handlers for swapping left (toward finals) and right (toward early rounds)
  const handleSwapLeft = () => {
    setFocusedStageIndex(prev => {
      if (prev === null) return 1;
      return Math.min(totalRounds - 1, prev + 1);
    });
  };

  const handleSwapRight = () => {
    setFocusedStageIndex(prev => {
      if (prev === null || prev <= 0) return null;
      return prev - 1;
    });
  };

  const handleSaveScore = (updatedMatch) => {
    let newMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    newMatches = propagateWinnerInTree(newMatches, updatedMatch);
    setMatches(newMatches);

    if (onNotify) onNotify(`تم حفظ النتيجة وتصعيد الفائز للدور التالي!`, 'success');

    if (updatedMatch.stage === 'final' && updatedMatch.winnerId) {
      try {
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
      } catch (e) {}
    }
  };

  const finalMatch = knockoutMatches.find(m => m.stage === 'final');
  const champion = finalMatch?.winnerId ? participantsMap[finalMatch.winnerId] : null;
  const runnerUp = champion ? (
    finalMatch.winnerId === finalMatch.player1Id ? participantsMap[finalMatch.player2Id] : participantsMap[finalMatch.player1Id]
  ) : null;

  if (knockoutMatches.length === 0) {
    return (
      <div className="clean-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <Trophy size={48} color="var(--border-strong)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
          شجرة الإقصائيات غير منشأة بعد
        </h3>
        <p style={{ maxWidth: '500px', margin: '0 auto 16px auto', fontSize: '0.9rem' }}>
          يرجى الضغط على زر توليد شجرة الإقصائيات ليتم تصعيد المتأهلين من المجموعات وبناء شجرة خروج المغلوب تلقائياً.
        </p>
      </div>
    );
  }

  // Calculate dynamic container height depending on whether early large rounds are collapsed!
  // If focused on round index >= 2 (QF, SF, Final), height collapses down so gap becomes tiny!
  let dynamicMinHeight = '650px';
  if (focusedStageIndex !== null) {
    if (focusedStageIndex >= totalRounds - 1) dynamicMinHeight = '280px'; // Final only
    else if (focusedStageIndex >= totalRounds - 2) dynamicMinHeight = '360px'; // SF & Final
    else if (focusedStageIndex >= totalRounds - 3) dynamicMinHeight = '480px'; // QF, SF, Final
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Champion Golden Podium if final match is finished */}
      {champion && (
        <div className="clean-card" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFFFF 100%)', border: '2px solid #F59E0B', textAlign: 'center', padding: '24px 20px', marginBottom: 0 }}>
          <Trophy size={48} color="#D97706" style={{ margin: '0 auto 8px auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#92400E', marginBottom: '2px' }}>
            🎉 بطل كأس السكن: FC27 🎉
          </h2>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {champion.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            نادي: {champion.team} | {champion.room}
          </div>

          {runnerUp && (
            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <Medal size={16} color="#64748B" />
              <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>الوصيف (المركز الثاني):</span>
              <b>{runnerUp.name} ({runnerUp.team})</b>
            </div>
          )}
        </div>
      )}

      {/* DYNAMIC STAGE SWAPPER & CONTROLS BAR (المتحكم الديناميكي بالأدوار والطي التلقائي) */}
      <div className="clean-card" style={{ padding: '12px 18px', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Left / Right Swappers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              التنقل والطي الذكي:
            </span>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleSwapRight}
              title="الرجوع لليمين نحو الأدوار الأولى وتوسيع الفراغات"
              disabled={focusedStageIndex === null || focusedStageIndex === 0}
            >
              <ChevronRight size={16} />
              <span>يمين (الأدوار الأولى)</span>
            </button>

            <button 
              className="btn btn-primary btn-sm"
              onClick={handleSwapLeft}
              title="التقدم لليسار نحو النهائي وتقليص الفراغات تلقائياً"
              disabled={focusedStageIndex === totalRounds - 1}
            >
              <span>يسار (الأدوار النهائية)</span>
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Quick Stage Pills Navigator */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', flexWrap: 'wrap' }}>
            <button 
              className={`btn btn-sm ${focusedStageIndex === null ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none' }}
              onClick={() => setFocusedStageIndex(null)}
            >
              الشجرة الممتدة الكاملة
            </button>

            {rounds.map((r, rIdx) => {
              const isFocused = focusedStageIndex === rIdx;
              return (
                <button
                  key={r.roundIndex}
                  className={`btn btn-sm ${isFocused ? 'btn-gold' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none' }}
                  onClick={() => setFocusedStageIndex(rIdx)}
                >
                  {r.shortTitle}
                </button>
              );
            })}
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(Math.max(0.65, zoomLevel - 0.1))} title="تصغير الشجرة">
              <ZoomOut size={14} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(1)} title="إعادة ضبط الحجم">
              <RotateCcw size={14} /> {Math.round(zoomLevel * 100)}%
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(Math.min(1.4, zoomLevel + 0.1))} title="تكبير الشجرة">
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Collapse Indicator info */}
        {focusedStageIndex !== null && (
          <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✓ تم طي الأدوار السابقة لتقليص الفراغات وتركيز الشاشة على: <b>{rounds[focusedStageIndex]?.title}</b> وما يليها بفراغات مريحة ومدمجة!</span>
          </div>
        )}
      </div>

      {/* Visual Bracket Tree Container with Adaptive Dynamic Height */}
      <div 
        className="clean-card"
        style={{ 
          overflowX: 'auto', 
          padding: '24px', 
          background: '#FAFAFA',
          border: '1px solid var(--border-light)',
          minHeight: dynamicMinHeight,
          transition: 'min-height 0.3s ease'
        }}
      >
        <div 
          style={{ 
            display: 'flex', 
            gap: '36px', 
            minWidth: 'max-content',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top right',
            transition: 'transform 0.15s ease'
          }}
        >
          {rounds.map((round, rIdx) => {
            // Check if this round should be collapsed!
            // When user swaps to the left (e.g. focusedStageIndex is set),
            // all rounds prior to focusedStageIndex collapse into a slim mini strip!
            const isCollapsed = focusedStageIndex !== null && rIdx < focusedStageIndex;
            const isCurrentFocus = focusedStageIndex === rIdx;

            // Collapsed Stage Strip (Slim & Compact!)
            if (isCollapsed) {
              return (
                <div 
                  key={round.roundIndex}
                  onClick={() => setFocusedStageIndex(rIdx)}
                  style={{
                    width: '42px',
                    background: '#F1F5F9',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: '12px 4px',
                    transition: 'all 0.25s ease',
                    opacity: 0.8
                  }}
                  title={`انقر لإعادة فتح وتوسيع ${round.title}`}
                >
                  <span style={{ 
                    writingMode: 'vertical-rl', 
                    transform: 'rotate(180deg)',
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    color: 'var(--text-muted)',
                    letterSpacing: '1px'
                  }}>
                    {round.shortTitle} (مطوي ✓)
                  </span>
                </div>
              );
            }

            // Expanded Dynamic Stage Column
            return (
              <div 
                key={round.roundIndex}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '260px',
                  flexShrink: 0,
                  transition: 'width 0.3s ease'
                }}
              >
                {/* Round Header */}
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px 12px', 
                  background: isCurrentFocus ? 'var(--ksu-green-light)' : 'var(--bg-surface)', 
                  border: `1.5px solid ${isCurrentFocus ? 'var(--ksu-green)' : 'var(--border-light)'}`, 
                  borderRadius: '8px', 
                  fontWeight: 800, 
                  fontSize: '0.88rem',
                  color: isCurrentFocus ? 'var(--ksu-green)' : 'var(--text-main)',
                  marginBottom: '16px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {round.title}
                </div>

                {/* Match Nodes Column with dynamic compact vertical distribution */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  // If collapsed mode, use tight compact gap! If full mode, space evenly
                  justifyContent: focusedStageIndex !== null ? 'center' : 'space-around', 
                  gap: focusedStageIndex !== null ? '20px' : '28px',
                  flex: 1
                }}>
                  {round.matches.map((m, mIdx) => {
                    const p1 = participantsMap[m.player1Id];
                    const p2 = participantsMap[m.player2Id];
                    const isFinished = m.status === 'completed' || m.status === 'walkover';
                    const isP1Winner = isFinished && m.winnerId === m.player1Id;
                    const isP2Winner = isFinished && m.winnerId === m.player2Id;
                    const hasBothPlayers = m.player1Id && m.player2Id;

                    return (
                      <div 
                        key={m.id}
                        style={{ position: 'relative' }}
                      >
                        {/* Match Node Card */}
                        <div 
                          onClick={() => {
                            if (hasBothPlayers) setSelectedMatch(m);
                          }}
                          style={{
                            background: '#FFFFFF',
                            border: hasBothPlayers ? '1.5px solid var(--border-strong)' : '1px dashed var(--border-strong)',
                            borderRadius: '10px',
                            boxShadow: 'var(--shadow-sm)',
                            overflow: 'hidden',
                            cursor: hasBothPlayers ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                            opacity: hasBothPlayers ? 1 : 0.75
                          }}
                          onMouseEnter={(e) => {
                            if (hasBothPlayers) {
                              e.currentTarget.style.borderColor = 'var(--ksu-green)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (hasBothPlayers) {
                              e.currentTarget.style.borderColor = 'var(--border-strong)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          {/* Match Top Bar */}
                          <div style={{ padding: '4px 10px', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>مباراة #{m.matchNumber}</span>
                            {isFinished ? (
                              <span style={{ color: '#059669', fontWeight: 800 }}>منتهية ✓</span>
                            ) : (
                              <span>{hasBothPlayers ? 'جاهزة للعب' : 'بانتظار المتأهل'}</span>
                            )}
                          </div>

                          {/* Player 1 Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 12px',
                            background: isP1Winner ? '#F0FDF4' : 'transparent',
                            borderBottom: '1px solid var(--border-light)'
                          }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ 
                                fontWeight: isP1Winner ? 800 : (p1 ? 600 : 400), 
                                fontSize: '0.85rem',
                                color: isP1Winner ? '#065F46' : (p1 ? 'var(--text-main)' : 'var(--text-dim)'),
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {p1 ? p1.name : '—'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p1 ? p1.team : ''}</div>
                            </div>

                            <span className="numeric" style={{ 
                              fontWeight: 800, 
                              fontSize: '1rem',
                              color: isP1Winner ? '#065F46' : 'var(--text-main)',
                              marginLeft: '8px'
                            }}>
                              {m.score1 !== null ? m.score1 : ''}
                            </span>
                          </div>

                          {/* Player 2 Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 12px',
                            background: isP2Winner ? '#F0FDF4' : 'transparent'
                          }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ 
                                fontWeight: isP2Winner ? 800 : (p2 ? 600 : 400), 
                                fontSize: '0.85rem',
                                color: isP2Winner ? '#065F46' : (p2 ? 'var(--text-main)' : 'var(--text-dim)'),
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {p2 ? p2.name : '—'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p2 ? p2.team : ''}</div>
                            </div>

                            <span className="numeric" style={{ 
                              fontWeight: 800, 
                              fontSize: '1rem',
                              color: isP2Winner ? '#065F46' : 'var(--text-main)',
                              marginLeft: '8px'
                            }}>
                              {m.score2 !== null ? m.score2 : ''}
                            </span>
                          </div>
                        </div>

                        {/* Visual Connector Line to next round (in RTL, line bridges to the LEFT) */}
                        {rIdx < rounds.length - 1 && (
                          <div 
                            style={{
                              position: 'absolute',
                              left: '-36px',
                              top: '50%',
                              width: '36px',
                              height: '2px',
                              background: isFinished ? '#059669' : '#CBD5E1',
                              zIndex: 1
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
