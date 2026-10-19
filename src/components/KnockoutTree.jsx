import React, { useState } from 'react';
import { Trophy, Award, Medal, Check, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from 'lucide-react';
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

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = matches.filter(m => m.stage !== 'group');

  // Identify distinct rounds in order
  const rounds = React.useMemo(() => {
    const rMap = {};
    knockoutMatches.forEach(m => {
      const rIdx = m.roundIndex ?? 0;
      if (!rMap[rIdx]) {
        let label = 'دور إقصائي';
        if (m.stage === 'r64') label = 'دور الـ 64';
        else if (m.stage === 'r32') label = 'دور الـ 32';
        else if (m.stage === 'r16') label = 'دور الـ 16';
        else if (m.stage === 'qf') label = 'ربع النهائي';
        else if (m.stage === 'sf') label = 'نصف النهائي';
        else if (m.stage === 'final') label = 'المباراة النهائية 🏆';

        rMap[rIdx] = {
          roundIndex: rIdx,
          stage: m.stage,
          title: label,
          matches: []
        };
      }
      rMap[rIdx].matches.push(m);
    });

    return Object.values(rMap).sort((a, b) => a.roundIndex - b.roundIndex);
  }, [knockoutMatches]);

  const handleSaveScore = (updatedMatch) => {
    // 1. Update this match
    let newMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    // 2. Propagate winner to parent match in the tree
    newMatches = propagateWinnerInTree(newMatches, updatedMatch);
    setMatches(newMatches);

    onNotify(`تم حفظ النتيجة وتصعيد الفائز إلى الدور التالي!`, 'success');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Champion Golden Podium if final match is finished */}
      {champion && (
        <div className="clean-card" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFFFF 100%)', border: '2px solid #F59E0B', textAlign: 'center', padding: '28px 20px', marginBottom: 0 }}>
          <Trophy size={50} color="#D97706" style={{ margin: '0 auto 10px auto' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#92400E', marginBottom: '4px' }}>
            🎉 بطل كأس السكن: FC27 🎉
          </h2>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {champion.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            نادي: {champion.team} | {champion.room}
          </div>

          {runnerUp && (
            <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <Medal size={16} color="#64748B" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>الوصيف (المركز الثاني):</span>
              <b>{runnerUp.name} ({runnerUp.team})</b>
            </div>
          )}
        </div>
      )}

      {/* Tree Zoom Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(Math.max(0.7, zoomLevel - 0.1))} title="تصغير الشجرة">
          <ZoomOut size={15} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(1)} title="إعادة ضبط الحجم">
          <RotateCcw size={15} /> {Math.round(zoomLevel * 100)}%
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setZoomLevel(Math.min(1.4, zoomLevel + 0.1))} title="تكبير الشجرة">
          <ZoomIn size={15} />
        </button>
      </div>

      {/* Visual Bracket Tree Container with Horizontal Scroll */}
      <div 
        className="clean-card"
        style={{ 
          overflowX: 'auto', 
          padding: '24px', 
          background: '#FAFAFA',
          border: '1px solid var(--border-light)',
          minHeight: '520px'
        }}
      >
        <div 
          style={{ 
            display: 'flex', 
            gap: '48px', 
            minWidth: 'max-content',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top right',
            transition: 'transform 0.15s ease'
          }}
        >
          {rounds.map((round, rIdx) => {
            return (
              <div 
                key={round.roundIndex}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '260px',
                  flexShrink: 0
                }}
              >
                {/* Round Header */}
                <div style={{ 
                  textAlign: 'center', 
                  padding: '10px 14px', 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '8px', 
                  fontWeight: 800, 
                  fontSize: '0.9rem',
                  color: 'var(--ksu-green)',
                  marginBottom: '20px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {round.title}
                </div>

                {/* Match Nodes Column distributed vertically */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-around', 
                  flex: 1,
                  gap: '24px'
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
                            transition: 'all 0.2s',
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
                              <span style={{ color: '#059669', fontWeight: 700 }}>منتهية ✓</span>
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

                        {/* Visual Connector Line to next round (in RTL, line goes to the LEFT) */}
                        {rIdx < rounds.length - 1 && (
                          <div 
                            style={{
                              position: 'absolute',
                              left: '-48px',
                              top: '50%',
                              width: '48px',
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
