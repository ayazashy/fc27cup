import React, { useState, useEffect } from 'react';
import { Tv, Monitor, Maximize2, Minimize2, Trophy, Clock, Volume2, Award, Search, Share2, Check, Bell, Play, Pause, ExternalLink, RefreshCw } from 'lucide-react';
import { calculateGroupStandings, getConsoleStatusMap } from '../utils/tournamentEngine';
import KnockoutTree from './KnockoutTree';
import SyncLoadingOverlay from './SyncLoadingOverlay';
import SportsMatchCard from './SportsMatchCard';
import logoUrl from '../utils/logo';

export default function TvDisplayTab({ 
  matches, 
  groups, 
  participants, 
  config,
  isPublicMode = false,
  onNotify,
  onRefreshData,
  isLoading = false
}) {
  const [activeTab, setActiveTab] = useState('consoles'); // 'consoles', 'standings', 'tree', 'scorers'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(!isPublicMode);
  const [playerSearch, setPlayerSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [announcement, setAnnouncement] = useState('أهلاً بكم في بطولة كأس السكن FC27 — يرجى من اللاعبين الحضور قبل موعد المباراة بـ 5 دقائق');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [tempNotice, setTempNotice] = useState(announcement);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (e) {
      console.warn('Manual refresh failed:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
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

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayDateStr = getTodayDateStr();
  const dayDates = config.dayDates || { 1: todayDateStr };
  const numTournamentDays = Number(config.tournamentDays) || 2;

  let autoTodayDay = 1;
  for (let d = 1; d <= numTournamentDays; d++) {
    if (dayDates[d] === todayDateStr) {
      autoTodayDay = d;
      break;
    }
  }

  const effectiveActiveDay = config.activeDayOverride ? Number(config.activeDayOverride) : autoTodayDay;
  const [tvDay, setTvDay] = useState(effectiveActiveDay);

  const isTvDayActive = (config.activeDayOverride === tvDay) || (dayDates[tvDay] === todayDateStr);
  const isFutureDay = !isTvDayActive && dayDates[tvDay] && (dayDates[tvDay] > todayDateStr);

  const tvDayMatches = React.useMemo(() => {
    return matches.filter(m => (m.dayNumber || 1) === tvDay);
  }, [matches, tvDay]);

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleStatusMap = React.useMemo(() => {
    return getConsoleStatusMap(tvDayMatches, consolesCount, minDuration, maxDuration, isTvDayActive, config);
  }, [tvDayMatches, consolesCount, minDuration, maxDuration, isTvDayActive, config, timeTick]);

  // Auto-rotate tabs for projector display (18 seconds per tab)
  useEffect(() => {
    if (!isAutoRotate || isPublicMode) return;
    const tabs = ['consoles', 'standings', 'tree', 'scorers'];
    const timer = setInterval(() => {
      setActiveTab(prev => {
        const curIdx = tabs.indexOf(prev);
        return tabs[(curIdx + 1) % tabs.length];
      });
    }, 18000);
    return () => clearInterval(timer);
  }, [isAutoRotate, isPublicMode]);

  // Top scorers calculation
  const topScorers = React.useMemo(() => {
    const scoreMap = {};
    matches.filter(m => m.status === 'completed' || m.status === 'walkover').forEach(m => {
      const p1 = participantsMap[m.player1Id];
      const p2 = participantsMap[m.player2Id];
      if (p1) {
        if (!scoreMap[p1.id]) scoreMap[p1.id] = { name: p1.name, team: p1.team, goals: 0 };
        scoreMap[p1.id].goals += Number(m.score1 || 0);
      }
      if (p2) {
        if (!scoreMap[p2.id]) scoreMap[p2.id] = { name: p2.name, team: p2.team, goals: 0 };
        scoreMap[p2.id].goals += Number(m.score2 || 0);
      }
    });
    return Object.values(scoreMap).sort((a, b) => b.goals - a.goals).slice(0, 10);
  }, [matches, participantsMap]);

  // Player Search Result (Where is my match?)
  const searchResult = React.useMemo(() => {
    if (!playerSearch.trim()) return null;
    const q = playerSearch.toLowerCase();
    const foundPlayer = participants.find(p => p.name?.toLowerCase().includes(q) || p.studentId?.includes(q));
    if (!foundPlayer) return { found: false };

    // Find next upcoming match for this player
    const playerMatches = matches.filter(m => m.player1Id === foundPlayer.id || m.player2Id === foundPlayer.id);
    const nextMatch = playerMatches.find(m => m.status !== 'completed' && m.status !== 'walkover');
    const pastMatches = playerMatches.filter(m => m.status === 'completed' || m.status === 'walkover');

    const nextMatchWithEst = nextMatch 
      ? (consoleStatusMap[nextMatch.consoleId]?.matches?.find(m => m.id === nextMatch.id) || nextMatch)
      : null;

    return {
      found: true,
      player: foundPlayer,
      nextMatch,
      nextMatchWithEst,
      totalMatches: playerMatches.length,
      pastMatches
    };
  }, [playerSearch, participants, matches, consoleStatusMap]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleCopyPublicLink = () => {
    const url = window.location.origin + window.location.pathname + '?view=tv';
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    if (onNotify) onNotify('تم نسخ رابط متابعة مباريات الصالة للطلاب إلى الحافظة!', 'success');
  };

  return (
    <div className="tab-content" style={{ maxWidth: '100%' }}>
      {/* View Navigation & Controls Bar */}
      <div className="clean-card tv-nav-bar" style={{ padding: '10px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* View Selector Buttons */}
          <div className="tv-tabs-group" style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', overflowX: 'auto', maxWidth: '100%' }}>
            <button 
              className={`btn btn-sm ${activeTab === 'consoles' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab('consoles')}
            >
              الأجهزة والمباريات
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'standings' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab('standings')}
            >
              المجموعات
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab('tree')}
            >
              شجرة الإقصائيات
            </button>
            <button 
              className={`btn btn-sm ${activeTab === 'scorers' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab('scorers')}
            >
              الهدافون
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Auto-rotate Toggle for Projector (Admin only) */}
            {!isPublicMode && (
              <button 
                className={`btn btn-sm ${isAutoRotate ? 'btn-gold' : 'btn-secondary'}`}
                onClick={() => setIsAutoRotate(!isAutoRotate)}
                title="تقليب دوري تلقائي للشاشات"
              >
                {isAutoRotate ? <Pause size={14} /> : <Play size={14} />}
                <span>{isAutoRotate ? 'إيقاف الدوران' : 'دوران تلقائي'}</span>
              </button>
            )}

            {/* Fullscreen Button */}
            <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen} title="ملء الشاشة">
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Player Match Finder */}
      <div className="clean-card" style={{ padding: '12px 16px', marginBottom: '16px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="var(--ksu-green)" />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#065F46' }}>
              استعلام عن موعد مباراة:
            </span>
          </div>

          <div style={{ width: '320px', maxWidth: '100%' }}>
            <input 
              type="text"
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              placeholder="ابحث باسمك أو رقمك الجامعي..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Search Result Banner */}
        {searchResult && (
          <div style={{ marginTop: '10px', padding: '12px 14px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #86EFAC' }}>
            {searchResult.found ? (
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  أهلاً {searchResult.player.name} ({searchResult.player.team}):
                </div>
                {searchResult.nextMatch ? (
                  <div>
                    <div style={{ color: '#065F46', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                      مباراتك القادمة على <b>جهاز {searchResult.nextMatch.consoleId}</b> — اليوم {searchResult.nextMatch.dayNumber || 1} (#{searchResult.nextMatch.matchNumber}):
                    </div>
                    <SportsMatchCard 
                      match={searchResult.nextMatchWithEst || searchResult.nextMatch}
                      p1={participantsMap[searchResult.nextMatch.player1Id]}
                      p2={participantsMap[searchResult.nextMatch.player2Id]}
                      isCurrent={searchResult.nextMatch.status === 'in_progress'}
                      compact={false}
                      isPublicMode={isPublicMode}
                    />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    أكملت جميع مبارياتك المقررة حالياً ✓
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.82rem', color: '#DC2626' }}>لم يتم العثور على لاعب بهذا الاسم أو الرقم.</span>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: Consoles & Full Queue of Matches per Device */}
      {activeTab === 'consoles' && (
        <div>
          {/* Day Selector & Future Day Notice */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', background: '#FFFFFF', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>اختر اليوم:</span>
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
                {Array.from({ length: numTournamentDays }, (_, i) => i + 1).map(d => {
                  const dDate = dayDates[d];
                  const isDAct = (config.activeDayOverride === d) || (dDate === todayDateStr);
                  const isDFut = !isDAct && dDate && dDate > todayDateStr;
                  return (
                    <button
                      key={d}
                      className={`btn btn-sm ${tvDay === d ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 12px', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setTvDay(d)}
                    >
                      <span>اليوم {d}</span>
                      <span style={{ fontSize: '0.7rem' }}>
                        {isDAct ? '🟢' : (isDFut ? '⏳' : '✓')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: isTvDayActive ? '#059669' : (isFutureDay ? '#2563EB' : 'var(--text-muted)'), fontWeight: 700 }}>
              {isTvDayActive ? (
                <span>🟢 اليوم {tvDay} — نشط الآن</span>
              ) : (
                <span>{isFutureDay ? `⏳ اليوم ${tvDay} (${dayDates[tvDay] || ''})` : `✓ اليوم ${tvDay} (منتهي)`}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`, gap: '16px' }}>
          {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => {
            const cData = consoleStatusMap[cId] || { matches: [], currentMatch: null, nextMatch: null };
            const current = cData.currentMatch;
            const next = cData.nextMatch;
            const p1 = current ? participantsMap[current.player1Id] : null;
            const p2 = current ? participantsMap[current.player2Id] : null;
            const nextP1 = next ? participantsMap[next.player1Id] : null;
            const nextP2 = next ? participantsMap[next.player2Id] : null;

            return (
              <div key={cId} className="clean-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: 0 }}>
                {/* Device Title */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border-light)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Monitor size={20} color="var(--ksu-green)" />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>جهاز {cId}</span>
                  </div>
                  <span className="badge badge-gray numeric">اليوم {tvDay}: {cData.matches.length} مباريات</span>
                </div>

                {/* CURRENT LIVE MATCH or FUTURE NOTICE */}
                {!isTvDayActive ? (
                  <div style={{ 
                    background: '#F8FAFC', 
                    border: '1.5px dashed #94A3B8', 
                    borderRadius: '10px', 
                    padding: '14px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      ⏳ مجدولة لتاريخ {dayDates[tvDay] || ''}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      المباريات قيد الانتظار ولم تبدأ بعد
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    background: current ? '#ECFDF5' : 'var(--bg-subtle)', 
                    border: current ? '2px solid #059669' : '1px dashed var(--border-strong)', 
                    borderRadius: '10px', 
                    padding: '12px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: current ? '#065F46' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: current ? '#10B981' : '#CBD5E1', display: 'inline-block' }}></span>
                        {current ? 'الجارية الآن على الجهاز' : 'لا توجد مباراة نشطة'}
                      </span>
                      {current && (
                        <span className="badge badge-green" style={{ fontWeight: 800, fontSize: '0.75rem' }}>
                          #{current.matchNumber} {current.groupName || ''}
                        </span>
                      )}
                    </div>

                    {current ? (
                      <SportsMatchCard 
                        match={current}
                        p1={p1}
                        p2={p2}
                        isCurrent={true}
                        isPublicMode={isPublicMode}
                        compact={false}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        الجهاز متاح وجاهز للاستقبال ✓
                      </div>
                    )}
                  </div>
                )}

                {/* NEXT MATCH (التالي للاستعداد) */}
                {isTvDayActive && next && (
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
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>#{next.matchNumber} {next.groupName || ''}</span>
                    </div>

                    <SportsMatchCard 
                      match={next}
                      p1={nextP1}
                      p2={nextP2}
                      isNext={true}
                      compact={true}
                      isPublicMode={isPublicMode}
                    />
                  </div>
                )}

                {/* FULL LIST ORDER OF ALL MATCHES (قائمة طابور الجهاز الكاملة) */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                    قائمة مباريات الجهاز بالترتيب الكامل:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto', paddingRight: '2px' }}>
                    {cData.matches.map((m, idx) => {
                      const isCur = isTvDayActive && current && current.id === m.id;
                      const isNext = isTvDayActive && next && next.id === m.id;
                      const isDone = m.status === 'completed' || m.status === 'walkover';
                      const mp1 = participantsMap[m.player1Id];
                      const mp2 = participantsMap[m.player2Id];

                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="numeric" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)', minWidth: '22px' }}>
                            #{idx + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <SportsMatchCard 
                              match={m}
                              p1={mp1}
                              p2={mp2}
                              isCurrent={isCur}
                              isNext={isNext}
                              isDone={isDone}
                              compact={true}
                              isPublicMode={isPublicMode}
                            />
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
        </div>
      )}

      {/* TAB 2: Live Group Standings */}
      {activeTab === 'standings' && (
        <div className="groups-grid">
          {groups.map(group => {
            const standings = calculateGroupStandings(group, matches, participantsMap, config);
            return (
              <div key={group.id} className="group-card">
                <div className="group-header">
                  <h3>{group.name}</h3>
                </div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="clean-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '28px' }}>م</th>
                        <th>اللاعب</th>
                        <th>ف</th>
                        <th>ت</th>
                        <th>خ</th>
                        <th>+/-</th>
                        <th style={{ textAlign: 'center', color: 'var(--ksu-green)' }}>ن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((st, i) => (
                        <tr key={st.playerId} className={i < 2 ? 'qualifier-row' : ''}>
                          <td className="numeric" style={{ fontWeight: 700 }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{st.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{st.team}</div>
                          </td>
                          <td className="numeric">{st.won}</td>
                          <td className="numeric">{st.drawn}</td>
                          <td className="numeric">{st.lost}</td>
                          <td className="numeric" style={{ fontWeight: 700 }}>{st.gd > 0 ? `+${st.gd}` : st.gd}</td>
                          <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, color: 'var(--ksu-green)' }}>{st.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Connected Knockout Tree */}
      {activeTab === 'tree' && (
        <KnockoutTree
          matches={matches}
          setMatches={() => {}} // Read-only for spectator portal
          participants={participants}
          groups={groups}
          config={config}
          onNotify={onNotify}
        />
      )}

      {/* TAB 4: Top Goalscorers */}
      {activeTab === 'scorers' && (
        <div className="clean-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-header">
            <div className="card-title">
              <Award size={22} color="var(--trophy-gold)" />
              <span>قائمة هدافي البطولة (الحذاء الذهبي)</span>
            </div>
            <span className="badge badge-gold">الأعلى تهديفاً</span>
          </div>

          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="clean-table" style={{ fontSize: '0.95rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>المركز</th>
                  <th>اسم اللاعب</th>
                  <th>النادي المختار</th>
                  <th style={{ textAlign: 'center', color: 'var(--ksu-green)' }}>الأهداف</th>
                </tr>
              </thead>
              <tbody>
                {topScorers.map((sc, idx) => (
                  <tr key={idx}>
                    <td className="numeric" style={{ fontWeight: 800 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{sc.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{sc.team}</td>
                    <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', color: 'var(--ksu-green)' }}>
                      {sc.goals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Announcement Ticker */}
      <div style={{ marginTop: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
          <Bell size={18} color="var(--ksu-green)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ksu-green)', whiteSpace: 'nowrap' }}>إعلان الصالة:</span>
          {isEditingNotice && !isPublicMode ? (
            <input 
              type="text" 
              className="form-input" 
              style={{ padding: '4px 10px', fontSize: '0.85rem' }}
              value={tempNotice}
              onChange={(e) => setTempNotice(e.target.value)}
            />
          ) : (
            <marquee style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {announcement}
            </marquee>
          )}
        </div>

        {!isPublicMode && (
          <button 
            className="btn btn-secondary btn-sm"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              if (isEditingNotice) {
                setAnnouncement(tempNotice);
                setIsEditingNotice(false);
              } else {
                setTempNotice(announcement);
                setIsEditingNotice(true);
              }
            }}
          >
            {isEditingNotice ? 'حفظ الإعلان' : 'تعديل الإعلان'}
          </button>
        )}
      </div>

      {/* Circular Loading Overlay with Blurred Background & Competition Logo */}
      <SyncLoadingOverlay 
        show={isLoading || isRefreshing}
        message="جاري تحديث البيانات..."
        subtext=""
      />
    </div>
  );
}
