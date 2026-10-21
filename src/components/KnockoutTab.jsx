import React, { useState, useMemo } from 'react';
import { Trophy, GitMerge, LayoutGrid, CheckCircle, MessageCircle, Star, Sliders, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { generateKnockoutTree, calculateBestRunnersUp, propagateWinnerInTree } from '../utils/tournamentEngine';
import { getTeamLogoUrl } from '../utils/footballTeams';
import KnockoutTree from './KnockoutTree';
import ScoreModal from './ScoreModal';
import WhatsAppReminderModal from './WhatsAppReminderModal';

export default function KnockoutTab({ 
  groups, 
  matches, 
  setMatches, 
  participants, 
  config = {},
  setConfig,
  onNotify,
  onAtomicMatchUpdate
}) {
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'cards'
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [reminderMatch, setReminderMatch] = useState(null);
  const [showRunnersUpTable, setShowRunnersUpTable] = useState(false);
  const [showKoSettings, setShowKoSettings] = useState(false);

  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = matches.filter(m => m.stage !== 'group');

  // Compute live Best Runners-Up standings across all groups
  const bestRunnersUpData = useMemo(() => {
    return calculateBestRunnersUp(groups, matches, participantsMap, config);
  }, [groups, matches, participantsMap, config]);

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

  const handleUpdateKoConfig = (key, val) => {
    if (!setConfig) return;
    setConfig(prev => ({ ...prev, [key]: val }));
    onNotify('تم تحديث إعدادات أدوار خروج المغلوب بنجاح', 'success');
  };

  return (
    <div className="tab-content">
      {/* Top Header Bar */}
      <div className="clean-card" style={{ marginBottom: '16px' }}>
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="card-title">
              <GitMerge size={20} color="var(--ksu-green)" />
              <span>أدوار خروج المغلوب</span>
              <span className="badge badge-green" style={{ fontSize: '0.78rem' }}>
                حجم الدور: {bestRunnersUpData.targetBracketSize} لاعب
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {groups.length} بطل مجموعة + {bestRunnersUpData.spotsNeeded} أفضل وصيف = {bestRunnersUpData.targetBracketSize} متأهل
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Toggle Best Runners Up Table */}
            <button 
              className={`btn btn-sm ${showRunnersUpTable ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowRunnersUpTable(!showRunnersUpTable)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}
            >
              <Star size={14} color={showRunnersUpTable ? '#F59E0B' : 'currentColor'} />
              <span>ترتيب أفضل الوصيف ({bestRunnersUpData.spotsNeeded})</span>
              {showRunnersUpTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Knockout Settings Button */}
            <button 
              className={`btn btn-sm ${showKoSettings ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowKoSettings(!showKoSettings)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}
            >
              <Sliders size={14} />
              <span>إعدادات التأهل</span>
            </button>

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

            <button className="btn btn-primary btn-sm" onClick={handleGenerateBracket} style={{ fontWeight: 700 }}>
              <GitMerge size={15} />
              {knockoutMatches.length === 0 ? 'توليد شجرة الإقصائيات' : 'إعادة بناء الشجرة'}
            </button>
          </div>
        </div>

        {/* Collapsible Knockout Configuration Settings */}
        {showKoSettings && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', background: '#F8FAFC', padding: '14px', borderRadius: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                🎯 حجم دور خروج المغلوب الأول (Bracket Size):
              </label>
              <select 
                className="form-select"
                value={config.targetBracketSize || 'auto'}
                onChange={(e) => handleUpdateKoConfig('targetBracketSize', e.target.value)}
              >
                <option value="auto">تلقائي (بحسب عدد المجموعات: {bestRunnersUpData.targetBracketSize})</option>
                <option value="16">دور الـ 16 (16 لاعب)</option>
                <option value="32">دور الـ 32 (32 لاعب — الموصى به لـ 22 مجموعة)</option>
                <option value="64">دور الـ 64 (64 لاعب)</option>
              </select>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                يحدد حجم أول دور في شجرة خروج المغلوب.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                ⭐ عدد المتأهلين كأفضل وصيف:
              </label>
              <select 
                className="form-select"
                value={config.customBestRunnersUpCount ?? 'auto'}
                onChange={(e) => handleUpdateKoConfig('customBestRunnersUpCount', e.target.value)}
              >
                <option value="auto">تلقائي ({bestRunnersUpData.spotsNeeded} مقاعد لسد فراغ الدور)</option>
                {Array.from({ length: 17 }, (_, i) => i).map(num => (
                  <option key={num} value={String(num)}>{num} لاعبين كأفضل وصيف</option>
                ))}
              </select>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                في حال 22 مجموعة ودور 32: يتأهل 22 بطل + 10 أفضل وصيف = 32.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                🏆 معايير ترتيب ومفاضلة الوصيف:
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--ksu-green)', fontWeight: 700, background: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                النقاط &gt; فارق الأهداف &gt; الأهداف المسجلة &gt; الانتصارات &gt; اللعب النظيف (بطاقات أقل)
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Best Runners Up Table */}
        {showRunnersUpTable && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={18} color="#F59E0B" />
                <span>جدول ترتيب أفضل أصحاب المركز الثاني في كل المجموعات:</span>
              </div>
              <span className="badge badge-gold" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                المتأهلون باللون الأخضر ({bestRunnersUpData.spotsNeeded} مقاعد مؤهلة)
              </span>
            </div>

            {bestRunnersUpData.runnersUp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                لم يتم تسجيل أي مباريات أو حسم المركز الثاني في المجموعات بعد.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="clean-table" style={{ fontSize: '0.825rem', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th>اللاعب</th>
                      <th>المجموعة</th>
                      <th style={{ textAlign: 'center' }}>لعب</th>
                      <th style={{ textAlign: 'center' }}>فاز</th>
                      <th style={{ textAlign: 'center' }}>تعادل</th>
                      <th style={{ textAlign: 'center' }}>خسر</th>
                      <th style={{ textAlign: 'center' }}>له</th>
                      <th style={{ textAlign: 'center' }}>عليه</th>
                      <th style={{ textAlign: 'center' }}>الفارق</th>
                      <th style={{ textAlign: 'center' }}>النقاط</th>
                      <th style={{ textAlign: 'center' }}>حالة التأهل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestRunnersUpData.runnersUp.map((ru) => {
                      const logo = getTeamLogoUrl(ru.team);
                      return (
                        <tr key={ru.playerId} style={{ background: ru.isQualified ? '#F0FDF4' : 'transparent' }}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: ru.isQualified ? '#059669' : 'var(--text-muted)' }}>
                            {ru.rank}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {logo && (
                                <img src={logo} alt={ru.team} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                              )}
                              <div>
                                <span style={{ fontWeight: 700, color: ru.isQualified ? '#065F46' : 'var(--text-main)' }}>{ru.playerName}</span>
                                {ru.team && <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', display: 'block' }}>{ru.team}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-gray" style={{ fontSize: '0.725rem' }}>{ru.shortName}</span>
                          </td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.played}</td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.won}</td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.drawn}</td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.lost}</td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.goalsFor}</td>
                          <td style={{ textAlign: 'center' }} className="numeric">{ru.goalsAgainst}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: ru.goalDifference > 0 ? '#059669' : (ru.goalDifference < 0 ? '#DC2626' : 'inherit') }} className="numeric">
                            {ru.goalDifference > 0 ? `+${ru.goalDifference}` : ru.goalDifference}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 900, color: ru.isQualified ? '#059669' : 'inherit' }} className="numeric">
                            {ru.points}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {ru.isQualified ? (
                              <span className="badge badge-green" style={{ fontSize: '0.725rem', fontWeight: 800 }}>
                                ⭐ متأهل لدور الـ {bestRunnersUpData.targetBracketSize}
                              </span>
                            ) : (
                              <span className="badge badge-gray" style={{ fontSize: '0.725rem' }}>
                                غير متأهل
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
