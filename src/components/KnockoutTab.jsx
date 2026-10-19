import React, { useState } from 'react';
import { Trophy, GitMerge, Award, CheckCircle, Shield, Medal } from 'lucide-react';
import { generateKnockoutBracket } from '../utils/tournamentEngine';
import ScoreModal from './ScoreModal';
import confetti from 'canvas-confetti';

export default function KnockoutTab({ 
  groups, 
  matches, 
  setMatches, 
  participants, 
  config,
  onNotify
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = matches.filter(m => m.stage !== 'group');

  const handleGenerateBracket = () => {
    if (groups.length === 0) {
      onNotify('يجب إجراء قرعة المجموعات أولاً قبل توليد شجرة الإقصائيات', 'error');
      return;
    }

    if (knockoutMatches.length > 0) {
      if (!window.confirm('تم توليد أدوار إقصائية سابقاً. هل تود بالتأكيد إعادة توليد شجرة خروج المغلوب؟')) {
        return;
      }
    }

    const { bracketMatches } = generateKnockoutBracket(groups, matches, participantsMap, config);
    if (bracketMatches.length === 0) {
      onNotify('لم يتم العثور على متأهلين كافيين من المجموعات', 'error');
      return;
    }

    const nonKnockout = matches.filter(m => m.stage === 'group');
    setMatches([...nonKnockout, ...bracketMatches]);
    onNotify(`تم بنجاح تصعيد المتأهلين وبناء شجرة خروج المغلوب (${bracketMatches.length} مباراة)!`, 'success');
  };

  const handleSaveScore = (updatedMatch) => {
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    onNotify(`تم حفظ نتيجة مباراة الإقصائيات #${updatedMatch.matchNumber}`, 'success');

    // Check if this was the final match
    if (updatedMatch.stage === 'final' && updatedMatch.winnerId) {
      try {
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 }
        });
      } catch (e) {}
    }
  };

  // Group knockout matches by stage
  const stages = [
    { key: 'r32', label: 'دور الـ 32' },
    { key: 'r16', label: 'دور الـ 16' },
    { key: 'qf', label: 'ربع النهائي' },
    { key: 'sf', label: 'نصف النهائي' },
    { key: 'final', label: 'المباراة النهائية الكبرى 🏆' }
  ];

  // Final match status and Champion
  const finalMatch = knockoutMatches.find(m => m.stage === 'final');
  const champion = finalMatch?.winnerId ? participantsMap[finalMatch.winnerId] : null;
  const runnerUp = champion ? (
    finalMatch.winnerId === finalMatch.player1Id ? participantsMap[finalMatch.player2Id] : participantsMap[finalMatch.player1Id]
  ) : null;

  return (
    <div className="tab-content">
      {/* Knockout Header Bar */}
      <div className="clean-card">
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <div>
            <div className="card-title">
              <GitMerge size={20} color="var(--ksu-green)" />
              <span>شجرة أدوار خروج المغلوب (Knockout Stage)</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              تصعيد متصدري ووصيفي المجموعات تلقائياً لمسار التتويج بالبطولة
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleGenerateBracket}>
            <GitMerge size={18} />
            {knockoutMatches.length === 0 ? 'توليد شجرة الإقصائيات' : 'تحديث مسار المتأهلين'}
          </button>
        </div>
      </div>

      {/* Champion Podium View (if final match is completed) */}
      {champion && (
        <div className="clean-card" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFFFF 100%)', border: '2px solid #F59E0B', textAlign: 'center', padding: '32px 20px' }}>
          <Trophy size={56} color="#D97706" style={{ margin: '0 auto 12px auto' }} />
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#92400E', marginBottom: '4px' }}>
            🎉 بطل كأس السكن: FC27 🎉
          </h2>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {champion.name}
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            نادي: {champion.team} | {champion.room}
          </div>

          {runnerUp && (
            <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <Medal size={18} color="#64748B" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>الوصيف (المركز الثاني):</span>
              <b>{runnerUp.name} ({runnerUp.team})</b>
            </div>
          )}
        </div>
      )}

      {knockoutMatches.length === 0 ? (
        <div className="clean-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Trophy size={48} color="var(--border-strong)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            شجرة الإقصائيات لم تُنشأ بعد
          </h3>
          <p style={{ maxWidth: '500px', margin: '0 auto 16px auto', fontSize: '0.9rem' }}>
            بعد اكتمال مباريات المجموعات وتحديد المراكز، اضغط على زر توليد شجرة الإقصائيات لتوزيع المتأهلين في الأدوار الحاسمة.
          </p>
          <button className="btn btn-primary" onClick={handleGenerateBracket}>
            <GitMerge size={18} />
            توليد شجرة الإقصائيات الآن
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {stages.map(st => {
            const stageMatches = knockoutMatches.filter(m => m.stage === st.key);
            if (stageMatches.length === 0) return null;

            return (
              <div key={st.key} className="clean-card">
                <div className="card-header">
                  <div className="card-title">
                    <Trophy size={18} color="var(--trophy-gold)" />
                    <span>{st.label}</span>
                  </div>
                  <span className="badge badge-gray">{stageMatches.length} مباريات</span>
                </div>

                <div className="matches-grid">
                  {stageMatches.map(match => {
                    const p1 = participantsMap[match.player1Id];
                    const p2 = participantsMap[match.player2Id];
                    const isCompleted = match.status === 'completed' || match.status === 'walkover';
                    const winner = match.winnerId ? participantsMap[match.winnerId] : null;

                    return (
                      <div key={match.id} className="match-card" style={{ border: winner ? '1.5px solid #F59E0B' : '1px solid var(--border-light)' }}>
                        <div className="match-top-bar">
                          <span style={{ fontWeight: 700 }}>مباراة #{match.matchNumber}</span>
                          {winner && (
                            <span className="badge badge-gold">
                              🏆 الفائز: {winner.name}
                            </span>
                          )}
                        </div>

                        <div className="match-opponents">
                          <div className="match-player p1" style={{ opacity: winner && winner.id !== p1?.id ? 0.5 : 1 }}>
                            <span className="player-name">{p1?.name || 'في انتظار المتأهل'}</span>
                            <span className="player-team">{p1?.team}</span>
                          </div>

                          <div className="match-score-badge">
                            {match.score1 !== null && match.score2 !== null ? (
                              <span>
                                {match.score1} : {match.score2}
                                {match.penalty1 !== null && (
                                  <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>
                                    ({match.penalty1} - {match.penalty2} ترجيح)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>VS</span>
                            )}
                          </div>

                          <div className="match-player p2" style={{ opacity: winner && winner.id !== p2?.id ? 0.5 : 1 }}>
                            <span className="player-name">{p2?.name || 'في انتظار المتأهل'}</span>
                            <span className="player-team">{p2?.team}</span>
                          </div>
                        </div>

                        <div className="match-footer" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedMatch(match)}
                            disabled={!match.player1Id || !match.player2Id}
                          >
                            {isCompleted ? 'تعديل النتيجة' : 'رصد نتيجة الإقصائيات'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
