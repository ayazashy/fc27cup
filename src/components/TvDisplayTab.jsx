import React, { useState, useEffect } from 'react';
import { Tv, Monitor, Maximize2, Minimize2, Trophy, Clock, Volume2, Award, Search, Share2, Check, Bell, Play, Pause, ExternalLink, RefreshCw, Phone, Calendar, UserCheck } from 'lucide-react';
import { calculateGroupStandings, getConsoleStatusMap, calculateFixedMatchSchedule } from '../utils/tournamentEngine';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';
import KnockoutTree from './KnockoutTree';
import SyncLoadingOverlay from './SyncLoadingOverlay';
import SportsMatchCard from './SportsMatchCard';
import logoUrl from '../utils/logo';

// Helper: Extract all raw digits written (handling Arabic-Indic numerals)
function extractRawDigits(phone) {
  if (!phone) return '';
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let cleaned = String(phone).trim();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }
  return cleaned.replace(/\D/g, '');
}

// Helper: Normalize Saudi phone numbers to digits only, handling Arabic-Indic numerals
function normalizePhoneDigits(phone) {
  if (!phone) return '';
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let cleaned = String(phone).trim();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }
  let digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('966')) {
    digits = digits.slice(3);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

// Helper: Format ISO date string into readable Arabic format (e.g. الثلاثاء، 22 أكتوبر)
function formatArabicDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${dayNames[date.getDay()]}، ${date.getDate()} ${monthNames[date.getMonth()]}`;
  } catch (e) {
    return dateStr;
  }
}

export default function TvDisplayTab({ 
  matches, 
  groups, 
  participants, 
  config,
  isPublicMode = false,
  onNotify,
  onRefreshData,
  onShowCelebration,
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

  const [selectedMatchedPlayerId, setSelectedMatchedPlayerId] = useState(null);

  // Clear manual player selection when user alters search text
  useEffect(() => {
    setSelectedMatchedPlayerId(null);
  }, [playerSearch]);

  // Precompute full schedule map across all days for all matches
  const fullScheduleMap = React.useMemo(() => {
    const map = {};
    const dCount = Number(config.tournamentDays) || 2;
    const avgDuration = Math.round(((Number(config.minMatchDuration) || 10) + (Number(config.maxMatchDuration) || 15)) / 2);
    
    // Group stage
    for (let d = 1; d <= dCount; d++) {
      const dayMatches = matches.filter(m => (m.dayNumber || 1) === d && (m.stage === 'group' || !m.stage));
      const startTime = config.dayStartTimes?.[d] || '18:00';
      const breaks = config.dayBreaks?.[d] || [];
      const sched = calculateFixedMatchSchedule(dayMatches, startTime, avgDuration, breaks);
      Object.assign(map, sched);
    }
    // Knockout stage
    const koMatches = matches.filter(m => m.stage && m.stage !== 'group' && !m.groupId);
    if (koMatches.length > 0) {
      const startTime = config.dayStartTimes?.knockout || config.dayStartTimes?.[2] || '17:00';
      const breaks = config.dayBreaks?.knockout || [];
      const sched = calculateFixedMatchSchedule(koMatches, startTime, avgDuration, breaks);
      Object.assign(map, sched);
    }
    return map;
  }, [matches, config]);

  const rawWrittenDigits = extractRawDigits(playerSearch);
  const digitsWrittenCount = rawWrittenDigits.length;
  const isPhoneInput = digitsWrittenCount > 0;
  // Apply phone number search ONLY when the number written exceeds 8 digits (> 8 digits)
  // For non-numeric text search (name), apply when length >= 3
  const isSearchApplied = isPhoneInput ? (digitsWrittenCount > 8) : (playerSearch.trim().length >= 3);

  // Dynamic nearest phone matching (ranks by exact, suffix, prefix, and near-match digits)
  // Applied strictly when the number written exceeds 8 digits (> 8 digits)
  const nearestPhoneMatches = React.useMemo(() => {
    if (!isSearchApplied) return [];
    const qClean = playerSearch.trim();
    const qDigits = normalizePhoneDigits(qClean);
    const qLower = qClean.toLowerCase();

    const scored = participants.map(p => {
      let score = 0;
      const pRawPhone = p.phone || p.displayPhone || '';
      const pDigits = normalizePhoneDigits(pRawPhone);

      if (qDigits.length > 0 && pDigits.length > 0) {
        if (pDigits === qDigits) {
          score = 10000; // Exact match
        } else if (pDigits.endsWith(qDigits)) {
          // Suffix match (user entered last digits of phone)
          score = 5000 + qDigits.length * 100;
        } else if (pDigits.startsWith(qDigits)) {
          // Prefix match (e.g. 501...)
          score = 3000 + qDigits.length * 100;
        } else if (pDigits.includes(qDigits)) {
          score = 2000 + qDigits.length * 50;
        } else if (qDigits.length >= 5) {
          let matchCount = 0;
          const minLen = Math.min(pDigits.length, qDigits.length);
          for (let i = 0; i < minLen; i++) {
            if (pDigits[i] === qDigits[i]) matchCount++;
          }
          if (matchCount >= 4) {
            score = 1000 + matchCount * 50;
          }
        }
      }

      // Name search fallback (when not typing a phone number)
      if (!isPhoneInput && p.name && p.name.toLowerCase().includes(qLower)) {
        score = Math.max(score, 1800 + (p.name.toLowerCase() === qLower ? 2000 : 0));
      }

      return { player: p, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [playerSearch, participants, isSearchApplied, isPhoneInput]);

  const activeMatchedPlayer = React.useMemo(() => {
    if (!isSearchApplied) return null;
    if (selectedMatchedPlayerId) {
      const p = participants.find(x => x.id === selectedMatchedPlayerId);
      if (p) return p;
    }
    return nearestPhoneMatches[0]?.player || null;
  }, [selectedMatchedPlayerId, nearestPhoneMatches, participants, isSearchApplied]);

  // ALL matches assigned to activeMatchedPlayer with Time and Day
  const playerScheduleResult = React.useMemo(() => {
    if (!activeMatchedPlayer) return null;

    const assigned = matches.filter(m => m.player1Id === activeMatchedPlayer.id || m.player2Id === activeMatchedPlayer.id);

    // Sort chronologically: dayNumber, then schedule time / match number
    assigned.sort((a, b) => {
      const dayA = a.dayNumber || 1;
      const dayB = b.dayNumber || 1;
      if (dayA !== dayB) return dayA - dayB;
      const schedA = fullScheduleMap[a.id]?.startMins || 0;
      const schedB = fullScheduleMap[b.id]?.startMins || 0;
      if (schedA !== schedB) return schedA - schedB;
      return (a.matchNumber || 0) - (b.matchNumber || 0);
    });

    const enriched = assigned.map(m => {
      const isP1 = m.player1Id === activeMatchedPlayer.id;
      const oppId = isP1 ? m.player2Id : m.player1Id;
      const opp = participantsMap[oppId];
      const oppPlaceholder = isP1 ? m.player2Placeholder : m.player1Placeholder;
      const oppName = opp?.name || oppPlaceholder || 'بانتظار المتأهل';
      const oppTeam = opp?.team || '';
      const oppLogo = getTeamLogoUrl(opp?.team);

      const sched = fullScheduleMap[m.id];
      const timeStr = sched ? `${sched.timeStr} - ${sched.endTimeStr}` : (m.estimatedTime?.rangeStr || 'مجدولة');

      const dayNum = m.dayNumber || 1;
      const isKnockout = m.stage && m.stage !== 'group' && !m.groupId;
      const dayDateRaw = config.dayDates?.[isKnockout ? 'knockout' : dayNum] || config.dayDates?.[dayNum] || '';
      const dayDateFormatted = formatArabicDate(dayDateRaw);

      let stageLabel = 'دور المجموعات';
      if (isKnockout) {
        if (m.stage === 'r64') stageLabel = 'دور الـ 64';
        else if (m.stage === 'r32') stageLabel = 'دور الـ 32';
        else if (m.stage === 'r16') stageLabel = 'دور الـ 16';
        else if (m.stage === 'qf') stageLabel = 'ربع النهائي';
        else if (m.stage === 'sf') stageLabel = 'نصف النهائي';
        else if (m.stage === 'final') stageLabel = 'المباراة النهائية 🏆';
        else stageLabel = m.title || 'إقصائيات';
      } else if (m.groupName) {
        stageLabel = `المجموعة ${m.groupName}${m.roundNumber ? ` (الجولة ${m.roundNumber})` : ''}`;
      }

      const isCompleted = m.status === 'completed' || m.status === 'walkover';
      const isLive = m.status === 'live';
      const isNext = !isCompleted && !isLive && (
        (consoleStatusMap[m.consoleId]?.nextMatch?.id === m.id)
      );

      const playerScore = isP1 ? m.score1 : m.score2;
      const oppScore = isP1 ? m.score2 : m.score1;
      const playerPen = isP1 ? m.penalty1 : m.penalty2;
      const oppPen = isP1 ? m.penalty2 : m.penalty1;
      const hasPens = playerPen !== null && oppPen !== null && playerPen !== undefined && oppPen !== undefined;
      const isWinner = isCompleted && m.winnerId === activeMatchedPlayer.id;
      const isLoser = isCompleted && m.winnerId && m.winnerId !== activeMatchedPlayer.id;
      const isDraw = isCompleted && !m.winnerId && playerScore === oppScore;

      return {
        ...m,
        isP1,
        opp,
        oppName,
        oppTeam,
        oppLogo,
        sched,
        timeStr,
        dayNum,
        dayDateFormatted,
        stageLabel,
        isCompleted,
        isLive,
        isNext,
        playerScore,
        oppScore,
        playerPen,
        oppPen,
        hasPens,
        isWinner,
        isLoser,
        isDraw
      };
    });

    return {
      player: activeMatchedPlayer,
      matches: enriched,
      totalCount: enriched.length,
      completedCount: enriched.filter(m => m.isCompleted).length,
      upcomingCount: enriched.filter(m => !m.isCompleted).length
    };
  }, [activeMatchedPlayer, matches, participantsMap, fullScheduleMap, consoleStatusMap, config]);

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

      {/* Dynamic Player Phone Match Finder & Complete Schedule Viewer */}
      <div className="clean-card" style={{ padding: '14px 18px', marginBottom: '18px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', boxShadow: '0 2px 8px rgba(5,150,105,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={20} color="#059669" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065F46' }}>
                استعلام عن مواعيد وجدول المباريات
              </div>
              <div style={{ fontSize: '0.78rem', color: '#047857' }}>
                ابحث برقم الجوال لعرض كافة مبارياتك ومواعيدها بالأيام والساعات
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
            <input 
              type="text"
              className="form-input numeric"
              style={{ 
                padding: '8px 36px 8px 32px', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                borderRadius: '8px', 
                border: '1.5px solid #10B981', 
                background: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              placeholder="أدخل رقم جوالك (مثال: 0501234567)..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
            />
            <Search size={16} color="#059669" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            {playerSearch && (
              <button 
                onClick={() => setPlayerSearch('')} 
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '0.85rem' }}
                title="مسح البحث"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Typing indicator: when user is typing phone number and it has not yet exceeded 8 digits */}
        {isPhoneInput && digitsWrittenCount <= 8 && (
          <div style={{ 
            marginTop: '10px', 
            fontSize: '0.8rem', 
            color: '#065F46', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: '#F0FDF4', 
            padding: '8px 14px', 
            borderRadius: '8px', 
            border: '1px dashed #6EE7B7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.9rem' }}>ℹ️</span>
              <span>يرجى كتابة رقم الجوال كاملاً للبحث عن جدول ومواعيد مبارياتك (يتم تفعيل البحث بعد تجاوز 8 أرقام)...</span>
            </div>
            <span className="badge badge-gray" style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 8px' }}>
              {digitsWrittenCount} / 9+ أرقام
            </span>
          </div>
        )}

        {/* Dynamic Search Results & Full Schedule */}
        {isSearchApplied && (
          <div style={{ marginTop: '14px', padding: '16px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #86EFAC', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            {playerScheduleResult ? (
              <div>
                {/* Player Profile Header Bar */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  flexWrap: 'wrap', 
                  gap: '12px', 
                  paddingBottom: '14px', 
                  borderBottom: '1px solid #E2E8F0',
                  marginBottom: '14px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getTeamLogoUrl(playerScheduleResult.player.team) && (
                      <img 
                        src={getTeamLogoUrl(playerScheduleResult.player.team)} 
                        alt={playerScheduleResult.player.team} 
                        style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{playerScheduleResult.player.name}</span>
                        <span className="badge badge-green" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                          {playerScheduleResult.player.team}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span className="numeric">📞 {playerScheduleResult.player.displayPhone || playerScheduleResult.player.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-gray" style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700 }}>
                      إجمالي المباريات: <b>{playerScheduleResult.totalCount}</b>
                    </span>
                    <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700 }}>
                      منتهية: <b>{playerScheduleResult.completedCount}</b>
                    </span>
                    <span className="badge badge-gold" style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700 }}>
                      قادمة: <b>{playerScheduleResult.upcomingCount}</b>
                    </span>
                  </div>
                </div>

                {/* Alternative Closest Phone Matches (Prevents any mistype confusion) */}
                {nearestPhoneMatches.length > 1 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    flexWrap: 'wrap', 
                    marginBottom: '14px', 
                    padding: '8px 12px', 
                    background: '#F8FAFC', 
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    fontSize: '0.78rem' 
                  }}>
                    <span style={{ fontWeight: 700, color: '#64748B' }}>نتائج أرقام أخرى مطابقة:</span>
                    {nearestPhoneMatches.slice(0, 4).map(item => {
                      const isCurrentActive = item.player.id === playerScheduleResult.player.id;
                      return (
                        <button
                          key={item.player.id}
                          className={`btn btn-sm ${isCurrentActive ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.74rem', padding: '2px 8px', height: 'auto', minHeight: 'unset' }}
                          onClick={() => setSelectedMatchedPlayerId(item.player.id)}
                        >
                          {item.player.name} ({item.player.displayPhone || item.player.phone})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* All Matches Timeline / Cards List */}
                {playerScheduleResult.matches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    لا توجد مباريات مسندة لهذا اللاعب في النظام حالياً.
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065F46', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} />
                      <span>جدول ومواعيد مبارياتك المقررة ({playerScheduleResult.matches.length}):</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                      {playerScheduleResult.matches.map((m) => (
                        <div 
                          key={m.id}
                          style={{
                            background: m.isLive ? '#ECFDF5' : (m.isNext ? '#FEF9C3' : (m.isCompleted ? '#F8FAFC' : '#FFFFFF')),
                            border: `1.5px solid ${m.isLive ? '#059669' : (m.isNext ? '#CA8A04' : (m.isCompleted ? '#CBD5E1' : '#E2E8F0'))}`,
                            borderRadius: '10px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: m.isLive ? '0 4px 12px rgba(5,150,105,0.15)' : '0 1px 3px rgba(0,0,0,0.04)'
                          }}
                        >
                          {/* Match Top Bar: Day • Time • Console */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.74rem', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                                اليوم {m.dayNum}
                              </span>
                              {m.dayDateFormatted && (
                                <span style={{ color: 'var(--text-muted)' }}>({m.dayDateFormatted})</span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="numeric" style={{ fontWeight: 800, color: '#0F172A', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                                ⏰ {m.timeStr}
                              </span>
                              <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '1px 5px', fontWeight: 800 }}>
                                جهاز {m.consoleId}
                              </span>
                            </div>
                          </div>

                          {/* Match Stage & Number */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 700 }}>{m.stageLabel}</span>
                            <span>مباراة #{m.matchNumber}</span>
                          </div>

                          {/* Sports Match Card Component */}
                          <SportsMatchCard 
                            match={m}
                            p1={participantsMap[m.player1Id]}
                            p2={participantsMap[m.player2Id]}
                            isCurrent={m.isLive}
                            isNext={m.isNext}
                            compact={false}
                            isPublicMode={isPublicMode}
                            onShowCelebration={onShowCelebration}
                          />

                          {/* Status & Outcome Banner */}
                          <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, paddingTop: '2px' }}>
                            {m.isCompleted ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                {m.isWinner && (
                                  <span className="badge badge-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                    فوز 🏆
                                  </span>
                                )}
                                {m.isLoser && (
                                  <span className="badge badge-gray" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                    خسارة
                                  </span>
                                )}
                                {m.isDraw && (
                                  <span className="badge badge-gray" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                    تعادل
                                  </span>
                                )}
                                {m.hasPens && (
                                  <span className="badge" style={{ fontSize: '0.68rem', color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '1px 6px' }}>
                                    ركلات ترجيح ({m.playerPen} - {m.oppPen})
                                  </span>
                                )}
                              </div>
                            ) : m.isLive ? (
                              <span style={{ color: '#047857', fontWeight: 800 }}>
                                🔴 المباراة جارية الآن على جهاز {m.consoleId} — تفضل بالصالة فوراً!
                              </span>
                            ) : m.isNext ? (
                              <span style={{ color: '#854D0E', fontWeight: 800 }}>
                                ⏳ المباراة التالية على جهاز {m.consoleId} — يرجى الاستعداد بالصالة!
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                🕒 موعد المباراة المقرر: {m.timeStr} (يرجى الحضور قبل الموعد بـ 5 دقائق)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#DC2626', fontSize: '0.88rem', fontWeight: 600 }}>
                لم يتم العثور على أي لاعب برقم الجوال المدخل ("{playerSearch}"). يرجى التأكد من كتابة الرقم بشكل صحيح.
              </div>
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
                    padding: '8px 10px' 
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
                        onShowCelebration={onShowCelebration}
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
                    padding: '8px 10px',
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
                      onShowCelebration={onShowCelebration}
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
                              onShowCelebration={onShowCelebration}
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
                      {standings.map((st, i) => {
                        const logo = getTeamLogoUrl(st.team);
                        const hasKnownLogo = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                        return (
                          <tr key={st.playerId} className={i < 2 ? 'qualifier-row' : ''}>
                            <td className="numeric" style={{ fontWeight: 700 }}>{i + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {logo && (
                                  <img 
                                    src={logo} 
                                    alt={st.team || ''} 
                                    title={st.team || ''} 
                                    style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }}
                                    onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                                  />
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                                  {(!hasKnownLogo && st.team) && (
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{st.team}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="numeric">{st.won}</td>
                            <td className="numeric">{st.drawn}</td>
                            <td className="numeric">{st.lost}</td>
                            <td className="numeric" style={{ fontWeight: 700 }}>{st.gd > 0 ? `+${st.gd}` : st.gd}</td>
                            <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, color: 'var(--ksu-green)' }}>{st.points}</td>
                          </tr>
                        );
                      })}
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
          isPublicMode={isPublicMode}
          onShowCelebration={onShowCelebration}
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
                    <td>
                      {(() => {
                        const logo = getTeamLogoUrl(sc.team);
                        const hasKnown = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {logo && (
                              <img 
                                src={logo} 
                                alt={sc.team || ''} 
                                title={sc.team || ''} 
                                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                                onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                              />
                            )}
                            {(!hasKnown && sc.team) && (
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{sc.team}</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
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
