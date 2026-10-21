import React, { useState } from 'react';
import { Trophy, GitMerge, LayoutGrid, CheckCircle, MessageCircle } from 'lucide-react';
import { generateKnockoutTree } from '../utils/tournamentEngine';
import KnockoutTree from './KnockoutTree';
import ScoreModal from './ScoreModal';
import WhatsAppReminderModal from './WhatsAppReminderModal';
import { propagateWinnerInTree } from '../utils/tournamentEngine';

export default function KnockoutTab({ 
  groups, 
  matches, 
  setMatches, 
  participants, 
  config,
  onNotify,
  onAtomicMatchUpdate
}) {
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'cards'
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [reminderMatch, setReminderMatch] = useState(null);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = matches.filter(m => m.stage !== 'group');

  const handleGenerateBracket = async () => {
    if (groups.length === 0) {
      onNotify('يجب إجراء قرعة المجموعات أولاً قبل توليد شجرة الإقصائيات', 'error');
      return;
    }

    if (knockoutMatches.length > 0) {
      if (!window.confirm('تم توليد أدوار إقصائية سابقاً. هل تود بالتأكيد إعادة توليد شجرة خروج المغلوب؟')) {
        return;
      }
    }

    const { bracketMatches } = generateKnockoutTree(groups, matches, participantsMap, config);
    if (bracketMatches.length === 0) {
      onNotify('لم يتم العثور على متأهلين كافيين من المجموعات', 'error');
      return;
    }

    const nonKnockout = matches.filter(m => m.stage === 'group');
    const newMatches = [...nonKnockout, ...bracketMatches];
    setMatches(newMatches);
    if (onAtomicMatchUpdate) {
      await onAtomicMatchUpdate(newMatches, 'جاري بناء وحفظ شجرة الإقصائيات سحابياً...');
    }
    onNotify(`تم بنجاح تصعيد المتأهلين وبناء شجرة خروج المغلوب المتصلة (${bracketMatches.length} مباراة)!`, 'success');
  };

  const handleSaveScore = async (updatedMatch) => {
    let newMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    newMatches = propagateWinnerInTree(newMatches, updatedMatch);
    setMatches(newMatches);
    if (onAtomicMatchUpdate) {
      await onAtomicMatchUpdate(newMatches, `جاري رصد نتيجة المباراة #${updatedMatch.matchNumber} والمزامنة الفورية...`);
    }
    onNotify(`تم حفظ النتيجة وتصعيد الفائز للدور التالي!`, 'success');
  };

  return (
    <div className="tab-content">
      {/* Top Header Bar */}
      <div className="clean-card">
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <div>
            <div className="card-title">
              <GitMerge size={20} color="var(--ksu-green)" />
              <span>أدوار خروج المغلوب</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
              <button 
                className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setViewMode('tree')}
              >
                <GitMerge size={14} />
                شجرة الأدوار
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={14} />
                قائمة المباريات
              </button>
            </div>

            <button className="btn btn-primary" onClick={handleGenerateBracket}>
              <GitMerge size={16} />
              {knockoutMatches.length === 0 ? 'توليد شجرة الإقصائيات' : 'إعادة بناء الشجرة'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Knockout Content */}
      {viewMode === 'tree' ? (
        <KnockoutTree
          matches={matches}
          setMatches={setMatches}
          participants={participants}
          groups={groups}
          config={config}
          onNotify={onNotify}
          onAtomicMatchUpdate={onAtomicMatchUpdate}
        />
      ) : (
        /* Cards View Fallback */
        <div className="matches-grid">
          {knockoutMatches.map(match => {
            const p1 = participantsMap[match.player1Id];
            const p2 = participantsMap[match.player2Id];
            const isCompleted = match.status === 'completed' || match.status === 'walkover';
            const winner = match.winnerId ? participantsMap[match.winnerId] : null;

            return (
              <div key={match.id} className="match-card" style={{ border: winner ? '1.5px solid #F59E0B' : '1px solid var(--border-light)' }}>
                <div className="match-top-bar">
                  <span style={{ fontWeight: 700 }}>مباراة #{match.matchNumber} {match.title ? `— ${match.title}` : ''}</span>
                  {winner && (
                    <span className="badge badge-gold">
                      🏆 الفائز: {winner.name}
                    </span>
                  )}
                </div>

                <div className="match-opponents">
                  <div className="match-player p1">
                    <span className="player-name">{p1?.name || match.player1Placeholder || 'بانتظار حسم التأهل'}</span>
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
                    <span className="player-name">{p2?.name || match.player2Placeholder || 'بانتظار حسم التأهل'}</span>
                    <span className="player-team">{p2?.team}</span>
                  </div>
                </div>

                <div className="match-footer" style={{ justifyContent: 'space-between' }}>
                  {match.player1Id && match.player2Id && !isCompleted ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: '#25D366', color: '#065F46', display: 'flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => setReminderMatch(match)}
                      title="إرسال تذكير واتساب لموعد المباراة"
                    >
                      <MessageCircle size={14} color="#25D366" />
                      <span>تذكير واتساب</span>
                    </button>
                  ) : <div />}

                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedMatch(match)}
                    disabled={!match.player1Id || !match.player2Id}
                  >
                    {!match.player1Id || !match.player2Id ? 'بانتظار حسم المتأهلين' : (isCompleted ? 'تعديل النتيجة' : 'رصد نتيجة الإقصائيات')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp Match Reminder Modal */}
      {reminderMatch && (
        <WhatsAppReminderModal
          match={reminderMatch}
          p1={participantsMap[reminderMatch.player1Id]}
          p2={participantsMap[reminderMatch.player2Id]}
          onClose={() => setReminderMatch(null)}
          onNotify={onNotify}
        />
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
