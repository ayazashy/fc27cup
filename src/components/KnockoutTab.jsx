import React, { useState, useMemo } from 'react';
import { Trophy, GitMerge, LayoutGrid, CheckCircle, MessageCircle, Star, Sliders, ChevronDown, ChevronUp, ShieldCheck, Monitor } from 'lucide-react';
import { generateKnockoutTree, calculateBestRunnersUp, propagateWinnerInTree, getConsoleStatusMap } from '../utils/tournamentEngine';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';
import KnockoutTree from './KnockoutTree';
import SportsMatchCard from './SportsMatchCard';
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
  const [viewMode, setViewMode] = useState('tree'); // 'tree', 'consoles', or 'cards'
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [reminderMatch, setReminderMatch] = useState(null);
  const [showRunnersUpTable, setShowRunnersUpTable] = useState(false);
  const [showKoSettings, setShowKoSettings] = useState(false);
  const [singleConsoleFilter, setSingleConsoleFilter] = useState('all');

  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const knockoutMatches = useMemo(() => matches.filter(m => m.stage !== 'group'), [matches]);
  const consolesCount = Math.max(1, Number(config.consolesCount) || 5);

  const consoleStatusMap = useMemo(() => {
    return getConsoleStatusMap(knockoutMatches, consolesCount, 10, 15, true, config);
  }, [knockoutMatches, consolesCount, config]);

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
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              <button 
                className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setViewMode('tree')}
              >
                <GitMerge size={14} />
                شجرة الأدوار
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'consoles' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setViewMode('consoles')}
              >
                <Monitor size={14} />
                توزيع الأجهزة ({consolesCount})
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
                      const hasKnownLogo = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                      return (
                        <tr key={ru.playerId} style={{ background: ru.isQualified ? '#F0FDF4' : 'transparent' }}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: ru.isQualified ? '#059669' : 'var(--text-muted)' }}>
                            {ru.rank}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {logo && (
                                <img 
                                  src={logo} 
                                  alt={ru.team || ''} 
                                  title={ru.team || ''} 
                                  style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                                  onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                                />
                              )}
                              <div>
                                <span style={{ fontWeight: 700, color: ru.isQualified ? '#065F46' : 'var(--text-main)' }}>{ru.playerName}</span>
                                {(!hasKnownLogo && ru.team) && (
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'block' }}>{ru.team}</span>
                                )}
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
      {viewMode === 'tree' && (
        <KnockoutTree
          matches={matches}
          setMatches={setMatches}
          participants={participants}
          groups={groups}
          config={config}
          onNotify={onNotify}
          onAtomicMatchUpdate={onAtomicMatchUpdate}
        />
      )}

      {/* Consoles View: Distributed across X devices with green / yellow / grey Sofascore cards */}
      {viewMode === 'consoles' && (
        <div>
          {/* Console Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              className={`btn btn-sm ${singleConsoleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSingleConsoleFilter('all')}
              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              كافة الأجهزة ({consolesCount})
            </button>
            {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => {
              const cMatches = knockoutMatches.filter(m => (m.consoleId || 1) === cId);
              const cDone = cMatches.filter(m => m.status === 'completed' || m.status === 'walkover').length;
              return (
                <button
                  key={cId}
                  className={`btn btn-sm ${singleConsoleFilter === String(cId) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSingleConsoleFilter(String(cId))}
                  style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  جهاز {cId} ({cDone}/{cMatches.length})
                </button>
              );
            })}
          </div>

          {/* Consoles Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: singleConsoleFilter !== 'all' ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))', 
            gap: '16px' 
          }}>
            {(singleConsoleFilter === 'all' 
              ? Array.from({ length: consolesCount }, (_, i) => i + 1) 
              : [parseInt(singleConsoleFilter, 10)]
            ).map(cId => {
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
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                        جهاز {cId} {cId === 1 ? '— المنصة الرئيسية (النهائي)' : ''}
                      </span>
                    </div>
                    <span className="badge badge-gray numeric">
                      {cData.completedCount} / {cData.totalCount} منتهية
                    </span>
                  </div>

                  {/* 1. CURRENT MATCH (Live 🟢) */}
                  <div style={{ 
                    background: current ? '#ECFDF5' : '#F8FAFC', 
                    border: current ? '2px solid #059669' : '1px dashed var(--border-strong)', 
                    borderRadius: '10px', 
                    padding: '12px',
                    boxShadow: current ? '0 4px 12px rgba(5, 150, 105, 0.12)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: current ? '#065F46' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: current ? '#10B981' : '#CBD5E1', display: 'inline-block' }}></span>
                        {current ? 'الجارية الآن على الجهاز' : 'لا توجد مباراة نشطة حالياً'}
                      </span>
                      {current && (
                        <span className="badge badge-green" style={{ fontWeight: 800, fontSize: '0.75rem' }}>
                          #{current.matchNumber} {current.title || ''}
                        </span>
                      )}
                    </div>

                    {current ? (
                      <div>
                        <SportsMatchCard 
                          match={current}
                          p1={p1}
                          p2={p2}
                          isCurrent={true}
                          onSelectMatch={setSelectedMatch}
                          onRemindMatch={setReminderMatch}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, padding: '7px', fontWeight: 800 }}
                            onClick={() => setSelectedMatch(current)}
                          >
                            ⚽ رصد نتيجة المباراة الحالية
                          </button>
                          {current.player1Id && current.player2Id && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: '#25D366', color: '#065F46', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setReminderMatch(current)}
                              title="إرسال تذكير واتساب"
                            >
                              <MessageCircle size={15} color="#25D366" />
                              <span>واتساب</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '8px 0' }}>
                        {cData.matches.length === 0 ? 'لم يتم تعيين مباريات لهذا الجهاز بعد' : 'اكتملت جميع مباريات هذا الجهاز ✓'}
                      </div>
                    )}
                  </div>

                  {/* 2. NEXT MATCH (التالية للاستعداد ⏳) */}
                  {next && (
                    <div style={{ 
                      background: '#FEF9C3', 
                      border: '1.5px solid #CA8A04', 
                      borderRadius: '10px', 
                      padding: '10px 12px',
                      boxShadow: '0 2px 6px rgba(202, 138, 4, 0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EAB308', display: 'inline-block' }}></span>
                          التالية للاستعداد:
                        </span>
                        <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>#{next.matchNumber} {next.title || ''}</span>
                      </div>

                      <SportsMatchCard 
                        match={next}
                        p1={nextP1}
                        p2={nextP2}
                        isNext={true}
                        onSelectMatch={setSelectedMatch}
                        onRemindMatch={setReminderMatch}
                        compact={true}
                      />
                    </div>
                  )}

                  {/* 3. FULL QUEUE ON THIS CONSOLE */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                      طابور الإقصائيات على جهاز {cId} ({cData.matches.length} مباراة):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto', paddingRight: '2px' }}>
                      {cData.matches.map((m) => {
                        const isCur = current && current.id === m.id;
                        const isNxt = next && next.id === m.id;
                        const isDone = m.status === 'completed' || m.status === 'walkover';
                        const mp1 = participantsMap[m.player1Id];
                        const mp2 = participantsMap[m.player2Id];

                        return (
                          <SportsMatchCard 
                            key={m.id}
                            match={m}
                            p1={mp1}
                            p2={mp2}
                            isCurrent={isCur}
                            isNext={isNxt}
                            isDone={isDone}
                            onSelectMatch={setSelectedMatch}
                            onRemindMatch={setReminderMatch}
                            compact={true}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards View: Grid with Device indicators and SportsMatchCards */}
      {viewMode === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              className={`btn btn-sm ${singleConsoleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSingleConsoleFilter('all')}
              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              جميع الأجهزة ({knockoutMatches.length})
            </button>
            {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => {
              const cMatches = knockoutMatches.filter(m => (m.consoleId || 1) === cId);
              return (
                <button
                  key={cId}
                  className={`btn btn-sm ${singleConsoleFilter === String(cId) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSingleConsoleFilter(String(cId))}
                  style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  جهاز {cId} ({cMatches.length})
                </button>
              );
            })}
          </div>

          <div className="matches-grid">
            {knockoutMatches
              .filter(m => singleConsoleFilter === 'all' || (m.consoleId || 1) === parseInt(singleConsoleFilter, 10))
              .map(match => {
                const p1 = participantsMap[match.player1Id];
                const p2 = participantsMap[match.player2Id];
                const cData = consoleStatusMap[match.consoleId || 1];
                const isCur = match.status === 'live' || (cData?.currentMatch?.id === match.id);
                const isNxt = !isCur && (cData?.nextMatch?.id === match.id);
                const isDone = match.status === 'completed' || match.status === 'walkover';

                return (
                  <div key={match.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                      <span style={{ fontWeight: 800 }}>مباراة #{match.matchNumber} {match.title ? `— ${match.title}` : ''}</span>
                      {match.consoleId && (
                        <span className="badge badge-gray" style={{ fontSize: '0.62rem', fontWeight: 800 }}>
                          جهاز {match.consoleId}
                        </span>
                      )}
                    </div>
                    <SportsMatchCard
                      match={match}
                      p1={p1}
                      p2={p2}
                      isCurrent={isCur}
                      isNext={isNxt}
                      isDone={isDone}
                      onSelectMatch={setSelectedMatch}
                      onRemindMatch={setReminderMatch}
                    />
                  </div>
                );
              })}
          </div>
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
