import React, { useState } from 'react';
import { Trophy, Award, Medal, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Layers, Sliders } from 'lucide-react';
import ScoreModal from './ScoreModal';
import confetti from 'canvas-confetti';
import AutoFitName from './AutoFitName';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';
import { propagateWinnerInTree, syncKnockoutTreeWithGuarantees, getConsoleStatusMap } from '../utils/tournamentEngine';

export default function KnockoutTree({ 
  matches, 
  setMatches, 
  participants, 
  groups = [],
  config = {},
  onNotify,
  onAtomicMatchUpdate,
  isPublicMode = false,
  onShowCelebration
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

  // Synchronize matches with real-time group qualification guarantees
  const syncedMatches = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return syncKnockoutTreeWithGuarantees(matches, groups, participantsMap, config);
    }
    return matches;
  }, [matches, groups, participantsMap, config]);

  const knockoutMatches = syncedMatches.filter(m => m.stage !== 'group');

  // Live console status map for Green (current) / Yellow (next) / Grey status theming
  const consoleStatusMap = React.useMemo(() => {
    const cCount = Number(config.consolesCount) || 5;
    const koDay = Number(config.daysCount) || 2;
    return getConsoleStatusMap(matches, cCount, 10, 15, true, config);
  }, [matches, config]);

  // Canonical Stage Configuration & Tournament Hierarchy
  const STAGE_ORDER = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];
  const STAGE_CONFIG = {
    r64: { title: 'دور الـ 64', shortTitle: 'دوري 64' },
    r32: { title: 'دور الـ 32', shortTitle: 'دوري 32' },
    r16: { title: 'دور الـ 16', shortTitle: 'دوري 16' },
    qf: { title: 'ربع النهائي', shortTitle: 'ربع النهائي' },
    sf: { title: 'نصف النهائي', shortTitle: 'نصف النهائي' },
    final: { title: 'المباراة النهائية 🏆', shortTitle: 'النهائي 🏆' }
  };

  // Identify distinct rounds in strict chronological tournament order
  const rounds = React.useMemo(() => {
    const presentStages = STAGE_ORDER.filter(st => knockoutMatches.some(m => m.stage === st));
    
    // Fallback if stages are non-standard
    if (presentStages.length === 0 && knockoutMatches.length > 0) {
      const rMap = {};
      knockoutMatches.forEach(m => {
        const rIdx = m.roundIndex ?? 0;
        if (!rMap[rIdx]) {
          rMap[rIdx] = {
            roundIndex: rIdx,
            stage: m.stage || 'ko',
            title: `الدور الإقصائي ${rIdx + 1}`,
            shortTitle: `دور ${rIdx + 1}`,
            matches: []
          };
        }
        rMap[rIdx].matches.push(m);
      });
      return Object.values(rMap).sort((a, b) => a.roundIndex - b.roundIndex);
    }

    return presentStages.map((stageKey, rIdx) => {
      const stageMatches = knockoutMatches
        .filter(m => m.stage === stageKey)
        .sort((a, b) => (a.matchIndexInRound ?? 0) - (b.matchIndexInRound ?? 0) || (a.matchNumber || 0) - (b.matchNumber || 0));

      const conf = STAGE_CONFIG[stageKey] || { title: stageKey, shortTitle: stageKey };

      return {
        roundIndex: rIdx,
        stage: stageKey,
        title: conf.title,
        shortTitle: conf.shortTitle,
        matches: stageMatches
      };
    });
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

  const handleSaveScore = async (updatedMatch) => {
    let newMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    newMatches = propagateWinnerInTree(newMatches, updatedMatch);
    setMatches(newMatches);

    if (onAtomicMatchUpdate) {
      await onAtomicMatchUpdate(newMatches, `جاري رصد نتيجة المباراة #${updatedMatch.matchNumber} والمزامنة الفورية...`);
    }

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
  } else if (knockoutMatches.some(m => m.stage === 'r32')) {
    dynamicMinHeight = '920px';
  } else if (knockoutMatches.some(m => m.stage === 'r64')) {
    dynamicMinHeight = '1400px';
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
            {(() => {
              const cLogo = getTeamLogoUrl(champion.team);
              const cKnown = !!cLogo && cLogo !== DEFAULT_UNKNOWN_LOGO;
              return (
                <>
                  {cLogo && (
                    <img src={cLogo} alt={champion.team} title={champion.team} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  )}
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {champion.name}
                  </div>
                  {!cKnown && champion.team && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({champion.team})</span>
                  )}
                </>
              );
            })()}
          </div>

          {runnerUp && (
            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <Medal size={16} color="#64748B" />
              <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>الوصيف:</span>
              {(() => {
                const rLogo = getTeamLogoUrl(runnerUp.team);
                const rKnown = !!rLogo && rLogo !== DEFAULT_UNKNOWN_LOGO;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {rLogo && (
                      <img src={rLogo} alt={runnerUp.team} title={runnerUp.team} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                    )}
                    <b>{runnerUp.name}</b>
                    {!rKnown && runnerUp.team && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({runnerUp.team})</span>}
                  </div>
                );
              })()}
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
                    const cData = consoleStatusMap[m.consoleId || 1];
                    const hasBothPlayers = !!(m.player1Id && m.player2Id);
                    const isCur = hasBothPlayers && (m.status === 'live' || (cData && cData.currentMatch?.id === m.id));
                    const isNxt = hasBothPlayers && !isCur && (cData && cData.nextMatch?.id === m.id);
                    const isFinished = m.status === 'completed' || m.status === 'walkover';
                    const isP1Winner = isFinished && m.winnerId === m.player1Id;
                    const isP2Winner = isFinished && m.winnerId === m.player2Id;
                    const hasPenalties = m.penalty1 !== null && m.penalty1 !== undefined &&
                                         m.penalty2 !== null && m.penalty2 !== undefined;

                    const p1Logo = getTeamLogoUrl(p1?.team);
                    const hasKnownLogo1 = !!p1Logo && p1Logo !== DEFAULT_UNKNOWN_LOGO;
                    const showTeam1 = !hasKnownLogo1 && !!p1?.team;

                    const p2Logo = getTeamLogoUrl(p2?.team);
                    const hasKnownLogo2 = !!p2Logo && p2Logo !== DEFAULT_UNKNOWN_LOGO;
                    const showTeam2 = !hasKnownLogo2 && !!p2?.team;

                    // Dynamic Theme: Green (Live) / Yellow (Next) / Grey (Finished/Scheduled)
                    let cardBg = '#FFFFFF';
                    let cardBorder = hasBothPlayers ? '1.5px solid var(--border-strong)' : '1.5px dashed var(--border-strong)';
                    let cardShadow = 'var(--shadow-sm)';

                    if (isCur) {
                      cardBg = '#ECFDF5';
                      cardBorder = '2px solid #059669';
                      cardShadow = '0 4px 14px rgba(5, 150, 105, 0.22)';
                    } else if (isNxt) {
                      cardBg = '#FEF9C3';
                      cardBorder = '2px solid #CA8A04';
                      cardShadow = '0 3px 10px rgba(202, 138, 4, 0.18)';
                    } else if (isFinished) {
                      cardBg = '#F8FAFC';
                      cardBorder = '1.5px solid #CBD5E1';
                    } else if (!hasBothPlayers) {
                      cardBg = '#F8FAFC';
                      cardBorder = '1.5px dashed #CBD5E1';
                    }

                    return (
                      <div 
                        key={m.id}
                        style={{ position: 'relative' }}
                      >
                        {/* Match Node Card */}
                        <div 
                          onClick={() => {
                            if (isPublicMode) {
                              if (isFinished && typeof onShowCelebration === 'function') {
                                onShowCelebration(m);
                              }
                            } else if (hasBothPlayers) {
                              setSelectedMatch(m);
                            }
                          }}
                          style={{
                            background: cardBg,
                            border: cardBorder,
                            borderRadius: '10px',
                            boxShadow: cardShadow,
                            overflow: 'hidden',
                            cursor: (isPublicMode ? (isFinished ? 'pointer' : 'default') : (hasBothPlayers ? 'pointer' : 'default')),
                            transition: 'all 0.15s ease',
                            opacity: hasBothPlayers ? 1 : 0.8
                          }}
                          title={
                            isPublicMode && isFinished 
                              ? "اضغط لمشاهدة احتفال الفوز والتفاعل المباشر 🎉" 
                              : (hasBothPlayers && !isPublicMode ? "اضغط لتسجيل النتيجة" : undefined)
                          }
                          onMouseEnter={(e) => {
                            if (hasBothPlayers && !isCur) {
                              e.currentTarget.style.borderColor = 'var(--ksu-green)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (hasBothPlayers && !isCur) {
                              e.currentTarget.style.borderColor = cardBorder.split(' ')[2] || 'var(--border-strong)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          {/* Match Top Bar with Device Indicator & Live Status */}
                          <div style={{ 
                            padding: '4px 10px', 
                            background: isCur ? '#D1FAE5' : (isNxt ? '#FEF08A' : 'var(--bg-subtle)'), 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            fontSize: '0.7rem', 
                            borderBottom: '1px solid var(--border-light)' 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>مباراة #{m.matchNumber}</span>
                              {m.consoleId && (
                                <span className="badge badge-gray" style={{ fontSize: '0.62rem', padding: '1px 5px', fontWeight: 800 }}>
                                  جهاز {m.consoleId}
                                </span>
                              )}
                            </div>

                            <div>
                              {isFinished ? (
                                hasPenalties ? (
                                  <span className="badge" style={{ fontSize: '0.62rem', color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A', fontWeight: 800, padding: '1px 5px' }}>
                                    ركلات ترجيح ({m.penalty1} - {m.penalty2})
                                  </span>
                                ) : (
                                  <span style={{ color: '#059669', fontWeight: 800 }}>منتهية ✓</span>
                                )
                              ) : isCur ? (
                                <span className="badge badge-green" style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px' }}>
                                  الآن 🟢
                                </span>
                              ) : isNxt ? (
                                <span className="badge badge-gold" style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px' }}>
                                  التالية ⏳
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>{hasBothPlayers ? 'جاهزة للعب' : (m.roundIndex === 0 ? 'بانتظار المتأهل' : 'بانتظار الفائز')}</span>
                              )}
                            </div>
                          </div>

                          {/* Player 1 Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 10px',
                            background: isP1Winner ? '#F0FDF4' : 'transparent',
                            borderBottom: '1px solid var(--border-light)'
                          }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              {p1 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {p1Logo && (
                                    <img 
                                      src={p1Logo} 
                                      alt={p1.team || 'فريق'} 
                                      title={p1.team || ''} 
                                      style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }} 
                                    />
                                  )}
                                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <AutoFitName 
                                        text={p1.name}
                                        compact={true}
                                        fontWeight={isP1Winner ? 800 : 700}
                                        color={isP1Winner ? '#065F46' : 'var(--text-main)'}
                                        align="right"
                                      />
                                      {m.isGuaranteed1 && (
                                        <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '1px 5px', fontWeight: 800, flexShrink: 0 }}>
                                          تأهل مؤكد ✓
                                        </span>
                                      )}
                                    </div>
                                    {showTeam1 && (
                                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1 }}>{p1.team}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                  <span style={{ 
                                    fontSize: '0.78rem', 
                                    fontWeight: 600, 
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {m.player1Placeholder || (m.roundIndex === 0 ? 'المرشح من المجموعة' : 'بانتظار الفائز')}
                                  </span>
                                  {m.roundIndex === 0 && (
                                    <span className="badge badge-gray" style={{ fontSize: '0.6rem', padding: '1px 4px', flexShrink: 0 }}>
                                      قيد الحسم ⏳
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                              {hasPenalties && (
                                <span className="numeric" style={{ 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  color: '#B45309',
                                  background: '#FEF3C7',
                                  border: '1px solid #FDE68A',
                                  borderRadius: '4px',
                                  padding: '0 4px',
                                  lineHeight: '1.3'
                                }}>
                                  {m.penalty1}
                                </span>
                              )}
                              <span className="numeric" style={{ 
                                fontWeight: 800, 
                                fontSize: '1rem',
                                color: isP1Winner ? '#065F46' : 'var(--text-main)'
                              }}>
                                {m.score1 !== null ? m.score1 : ''}
                              </span>
                            </div>
                          </div>

                          {/* Player 2 Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 10px',
                            background: isP2Winner ? '#F0FDF4' : 'transparent'
                          }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              {p2 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {p2Logo && (
                                    <img 
                                      src={p2Logo} 
                                      alt={p2.team || 'فريق'} 
                                      title={p2.team || ''} 
                                      style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }} 
                                    />
                                  )}
                                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <AutoFitName 
                                        text={p2.name}
                                        compact={true}
                                        fontWeight={isP2Winner ? 800 : 700}
                                        color={isP2Winner ? '#065F46' : 'var(--text-main)'}
                                        align="right"
                                      />
                                      {m.isGuaranteed2 && (
                                        <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px', fontWeight: 800, flexShrink: 0 }}>
                                          تأهل مؤكد ✓
                                        </span>
                                      )}
                                    </div>
                                    {showTeam2 && (
                                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1 }}>{p2.team}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                  <span style={{ 
                                    fontSize: '0.78rem', 
                                    fontWeight: 600, 
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {m.player2Placeholder || (m.roundIndex === 0 ? 'المرشح من المجموعة' : 'بانتظار الفائز')}
                                  </span>
                                  {m.roundIndex === 0 && (
                                    <span className="badge badge-gray" style={{ fontSize: '0.6rem', padding: '1px 4px', flexShrink: 0 }}>
                                      قيد الحسم ⏳
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                              {hasPenalties && (
                                <span className="numeric" style={{ 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  color: '#B45309',
                                  background: '#FEF3C7',
                                  border: '1px solid #FDE68A',
                                  borderRadius: '4px',
                                  padding: '0 4px',
                                  lineHeight: '1.3'
                                }}>
                                  {m.penalty2}
                                </span>
                              )}
                              <span className="numeric" style={{ 
                                fontWeight: 800, 
                                fontSize: '1rem',
                                color: isP2Winner ? '#065F46' : 'var(--text-main)'
                              }}>
                                {m.score2 !== null ? m.score2 : ''}
                              </span>
                            </div>
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
                              background: isFinished ? '#059669' : (isCur ? '#10B981' : '#CBD5E1'),
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
