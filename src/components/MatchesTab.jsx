import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Monitor, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Check, 
  Scale, 
  CalendarDays, 
  Sliders, 
  Sparkles,
  CheckCheck,
  MessageCircle,
  Play,
  RotateCcw
} from 'lucide-react';
import ScoreModal from './ScoreModal';
import WhatsAppReminderModal from './WhatsAppReminderModal';
import SportsMatchCard from './SportsMatchCard';
import AutoFitName from './AutoFitName';
import { getConsoleStatusMap, rebalanceRemainingMatches, syncKnockoutTreeWithGuarantees, propagateWinnerInTree } from '../utils/tournamentEngine';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';

export default function MatchesTab({ 
  matches, 
  setMatches, 
  participants, 
  groups = [],
  config,
  setConfig,
  onNotify,
  onAtomicMatchUpdate,
  userRole = 'admin',
  onOpenAdjustMatch
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [reminderMatch, setReminderMatch] = useState(null);
  const [viewMode, setViewMode] = useState('consoles'); // 'consoles' (Queues) or 'list'
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consoleFilter, setConsoleFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateConfig, setShowDateConfig] = useState(false);

  // Single Console View Filter (hall coordinator can choose to focus on one console, saved in localStorage)
  const [singleConsoleFilter, setSingleConsoleFilter] = useState(() => {
    try {
      return localStorage.getItem('ksu_hall_single_console_filter') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  const handleConsoleFilterChange = (val) => {
    setSingleConsoleFilter(val);
    try {
      localStorage.setItem('ksu_hall_single_console_filter', val);
    } catch (e) {}
  };

  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const minDuration = Number(config.minMatchDuration) || 10;
  const maxDuration = Number(config.maxMatchDuration) || 15;
  const consolesCount = Number(config.consolesCount) || 5;
  const numTournamentDays = Number(config.tournamentDays) || 2;

  const [timeTick, setTimeTick] = useState(Date.now());
  useEffect(() => {
    const tickInterval = setInterval(() => setTimeTick(Date.now()), 30000);
    return () => clearInterval(tickInterval);
  }, []);

  // Today's local date string (YYYY-MM-DD)
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = getTodayDateStr();
  const dayDates = config.dayDates || {
    1: todayDateStr,
    2: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    3: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
    knockout: new Date(Date.now() + 172800000).toISOString().slice(0, 10)
  };

  // Support Day 3 (Finals / Knockout stage)
  const totalDays = Math.max(3, numTournamentDays);

  // Determine which day matches today's date automatically
  let autoTodayDay = 1;
  for (let d = 1; d <= totalDays; d++) {
    const dDate = dayDates[d] || (d === 3 ? dayDates.knockout : null);
    if (dDate === todayDateStr) {
      autoTodayDay = d;
      break;
    }
  }

  // Current effective active day: admin manual override takes precedence, else today date match
  const effectiveActiveDay = config.activeDayOverride ? Number(config.activeDayOverride) : autoTodayDay;

  // For the consoles view: which day is being inspected?
  // When dayFilter === 'all', default to effectiveActiveDay so consoles show today's relevant live queue
  const viewConsoleDay = dayFilter === 'all' ? effectiveActiveDay : Number(dayFilter);

  // Status flags for the viewed day in consoles view
  const viewDayDate = dayDates[viewConsoleDay] || (viewConsoleDay === 3 ? dayDates.knockout : null);
  const isViewDayActive = (config.activeDayOverride === viewConsoleDay) || (viewDayDate === todayDateStr);
  const isFutureDay = !isViewDayActive && viewDayDate && (viewDayDate > todayDateStr);
  const isPastDay = !isViewDayActive && viewDayDate && (viewDayDate < todayDateStr);

  // STRICT PARTITIONING: Filter matches strictly for viewConsoleDay!
  // Day 1 and Day 2 matches never intersect in the console queues. Day 3 hosts Knockout / Finals.
  const consoleDayMatches = useMemo(() => {
    return matches.filter(m => {
      const matchDay = m.dayNumber || 1;
      if (viewConsoleDay === 3) {
        return matchDay === 3 || (m.stage && m.stage !== 'group');
      }
      return matchDay === viewConsoleDay && (!m.stage || m.stage === 'group');
    });
  }, [matches, viewConsoleDay]);

  // Compute console status map ONLY for this specific day's matches!
  const consoleStatusMap = useMemo(() => {
    return getConsoleStatusMap(consoleDayMatches, consolesCount, minDuration, maxDuration, isViewDayActive, config);
  }, [consoleDayMatches, consolesCount, minDuration, maxDuration, isViewDayActive, config, timeTick]);

  // Set of all current match IDs across all consoles for quick lookup
  const currentMatchIds = useMemo(() => {
    const ids = new Set();
    Object.values(consoleStatusMap).forEach(c => {
      if (c.currentMatch) ids.add(c.currentMatch.id);
    });
    return ids;
  }, [consoleStatusMap]);

  // Set of all next match IDs across all consoles for quick lookup
  const nextMatchIds = useMemo(() => {
    const ids = new Set();
    Object.values(consoleStatusMap).forEach(c => {
      if (c.nextMatch) ids.add(c.nextMatch.id);
    });
    return ids;
  }, [consoleStatusMap]);

  const handleSaveScore = async (updatedMatch) => {
    let updated = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    // If it's a knockout match, advance winner to the next round in the tree!
    if (updatedMatch.stage && updatedMatch.stage !== 'group') {
      updated = propagateWinnerInTree(updated, updatedMatch);
    }
    // Dynamically balance queued matches ONLY within that match's day to keep days strictly partitioned
    const matchDay = updatedMatch.dayNumber || 1;
    if (updatedMatch.stage === 'group') {
      updated = rebalanceRemainingMatches(updated, consolesCount, matchDay);
    }
    if (groups && groups.length > 0) {
      updated = syncKnockoutTreeWithGuarantees(updated, groups, participantsMap, config);
    }
    setMatches(updated);
    if (onAtomicMatchUpdate) {
      await onAtomicMatchUpdate(updated, `جاري اعتماد نتيجة المباراة #${updatedMatch.matchNumber} والمزامنة الفورية...`);
    }
    onNotify(`تم اعتماد نتيجة المباراة #${updatedMatch.matchNumber}! تم تلقائياً تحديث المواعيد وحالة الصالة`, 'success');
  };

  const handleManualRebalance = async () => {
    const rebalanced = rebalanceRemainingMatches(matches, consolesCount, viewConsoleDay);
    setMatches(rebalanced);
    if (onAtomicMatchUpdate) {
      await onAtomicMatchUpdate(rebalanced, `جاري إعادة موازنة طوابير اليوم ${viewConsoleDay} بالتساوي...`);
    }
    onNotify(`تمت إعادة موازنة طوابير اليوم ${viewConsoleDay} بالتساوي على جميع أجهزة الصالة!`, 'success');
  };

  const handleUpdateDayDate = (dayKey, dateVal) => {
    if (!setConfig) return;
    setConfig(prev => ({
      ...prev,
      dayDates: {
        ...(prev.dayDates || {}),
        [dayKey]: dateVal
      }
    }));
    onNotify(`تم تحديث موعد اليوم ${dayKey} إلى ${dateVal}`, 'success');
  };

  const handleSetActiveDayOverride = (overrideVal) => {
    if (!setConfig) return;
    setConfig(prev => ({
      ...prev,
      activeDayOverride: overrideVal
    }));
    if (overrideVal === null) {
      onNotify('تمت العودة للوضع التلقائي: يتم تفعيل اليوم المطابق لتاريخ اليوم تلقائياً', 'info');
    } else {
      onNotify(`تم تفعيل اليوم ${overrideVal} يدوياً كاليوم النشط الآن! ستعمل مبارياته بالأخضر`, 'success');
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredMatches = matches.filter(m => {
    if (stageFilter === 'group' && m.stage !== 'group') return false;
    if (stageFilter === 'knockout' && m.stage === 'group') return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (consoleFilter !== 'all' && String(m.consoleId) !== String(consoleFilter)) return false;
    if (dayFilter !== 'all') {
      if (dayFilter === '3') {
        const isDay3 = (m.dayNumber || 1) === 3 || (m.stage && m.stage !== 'group');
        if (!isDay3) return false;
      } else {
        if (String(m.dayNumber || 1) !== String(dayFilter)) return false;
        if (m.stage && m.stage !== 'group') return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const p1 = participantsMap[m.player1Id];
      const p2 = participantsMap[m.player2Id];
      const name1 = p1?.name?.toLowerCase() || '';
      const name2 = p2?.name?.toLowerCase() || '';
      const phone1 = (p1?.phone || '').replace(/\D/g, '');
      const phone2 = (p2?.phone || '').replace(/\D/g, '');
      const qDigits = q.replace(/\D/g, '');

      const matchName = name1.includes(q) || name2.includes(q);
      const matchPhone = qDigits.length >= 3 && (
        phone1.includes(qDigits) || phone2.includes(qDigits) ||
        phone1.endsWith(qDigits) || phone2.endsWith(qDigits)
      );

      return matchName || matchPhone;
    }
    return true;
  });

  return (
    <div className="tab-content">
      {/* Visual Status Legend Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          <span>دليل الحالات الملون:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.825rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#ECFDF5', border: '2px solid #059669', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: '#065F46' }}>جارية الآن</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#FEF9C3', border: '2px solid #CA8A04', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: '#854D0E' }}>المباراة القادمة</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#F1F5F9', border: '1px solid #94A3B8', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 600, color: '#64748B' }}>منتهية</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#FFFFFF', border: '1px solid var(--border-strong)', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>في الانتظار</span>
          </div>
        </div>
      </div>

      {/* Hall Controls Bar - Clean, Mobile-First, Zero Horizontal Overflow */}
      <div className="clean-card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Day Selector Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>اليوم:</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', flexWrap: 'wrap', gap: '2px' }}>
              <button 
                className={`btn btn-sm ${dayFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem' }}
                onClick={() => setDayFilter('all')}
              >
                كل الأيام
              </button>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
                const dDate = dayDates[d] || (d === 3 ? dayDates.knockout : null);
                const isDActive = (config.activeDayOverride === d) || (dDate === todayDateStr);
                const isDFuture = !isDActive && dDate && dDate > todayDateStr;
                const label = d === 3 ? 'اليوم 3 (النهائيات 🏆)' : `اليوم ${d}`;
                return (
                  <button 
                    key={d}
                    className={`btn btn-sm ${dayFilter === String(d) ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => setDayFilter(String(d))}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: '0.7rem' }}>
                      {isDActive ? '🟢' : (isDFuture ? '⏳' : '✓')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Console Filter (All consoles or focus on single console - saved in localStorage) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>تصفية الأجهزة:</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', flexWrap: 'wrap', gap: '2px' }}>
              <button 
                className={`btn btn-sm ${singleConsoleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem' }}
                onClick={() => handleConsoleFilterChange('all')}
              >
                جميع الأجهزة
              </button>
              {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => (
                <button 
                  key={cId}
                  className={`btn btn-sm ${singleConsoleFilter === String(cId) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem' }}
                  onClick={() => handleConsoleFilterChange(String(cId))}
                >
                  جهاز {cId}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle & Rebalance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
              <button 
                className={`btn btn-sm ${viewMode === 'consoles' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewMode('consoles')}
              >
                <Monitor size={14} />
                <span>طوابير الصالة</span>
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewMode('list')}
              >
                <Calendar size={14} />
                <span>القائمة العامة</span>
              </button>
            </div>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleManualRebalance}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
              title="موازنة المباريات المتبقية بالتساوي على الأجهزة"
            >
              <Scale size={14} color="var(--ksu-green)" />
              <span>موازنة الطابور</span>
            </button>

            {onOpenAdjustMatch && userRole !== 'coordinator' && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={onOpenAdjustMatch}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', borderColor: '#86EFAC', color: '#065F46', background: '#F0FDF4' }}
                title="تعديل موعد ويوم مباراة بالرقم ID (خاص بالإدارة الرئيسية)"
              >
                <Clock size={14} color="var(--ksu-green)" />
                <span>تعديل موعد ويوم مباراة ⏰</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Date Configuration Panel (Collapsible / Quick Controls) */}
      {showDateConfig && (
        <div className="clean-card" style={{ padding: '16px 20px', marginBottom: '16px', background: '#F8FAFC', border: '1.5px solid var(--ksu-green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--ksu-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={18} />
              <span>تحديد تواريخ أيام البطولة والتحكم باليوم النشط:</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              تاريخ اليوم الفعلي: <b className="numeric" style={{ color: 'var(--ksu-green)' }}>{todayDateStr}</b>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                🗓️ تاريخ اليوم 1:
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates[1] || ''}
                onChange={(e) => handleUpdateDayDate(1, e.target.value)}
              />
              <span style={{ fontSize: '0.7rem', color: dayDates[1] === todayDateStr ? '#059669' : 'var(--text-dim)', fontWeight: 600 }}>
                {dayDates[1] === todayDateStr ? '🟢 اليوم 1 هو تاريخ اليوم' : (dayDates[1] > todayDateStr ? '⏳ موعد قادم' : '✓ موعد سابق')}
              </span>
            </div>

            <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                🗓️ تاريخ اليوم 2:
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates[2] || ''}
                onChange={(e) => handleUpdateDayDate(2, e.target.value)}
              />
              <span style={{ fontSize: '0.7rem', color: dayDates[2] === todayDateStr ? '#059669' : 'var(--text-dim)', fontWeight: 600 }}>
                {dayDates[2] === todayDateStr ? '🟢 اليوم 2 هو تاريخ اليوم' : (dayDates[2] > todayDateStr ? '⏳ موعد قادم' : '✓ موعد سابق')}
              </span>
            </div>

            <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                🏆 تاريخ يوم الإقصائيات (النهائي):
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates.knockout || ''}
                onChange={(e) => handleUpdateDayDate('knockout', e.target.value)}
              />
              <span style={{ fontSize: '0.7rem', color: dayDates.knockout === todayDateStr ? '#059669' : 'var(--text-dim)', fontWeight: 600 }}>
                {dayDates.knockout === todayDateStr ? '🟢 يوم الإقصائيات هو تاريخ اليوم' : '🏆 جولات خروج المغلوب'}
              </span>
            </div>
          </div>

          {/* Active Day Override Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>وضع التفعيل الحالي للصالة:</span>
              <div style={{ display: 'flex', background: '#FFFFFF', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <button 
                  className={`btn btn-sm ${config.activeDayOverride === null ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', border: 'none', fontSize: '0.78rem' }}
                  onClick={() => handleSetActiveDayOverride(null)}
                >
                  تلقائي بحسب التاريخ ({autoTodayDay ? `اليوم ${autoTodayDay}` : 'غير محدد'})
                </button>
                {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                  <button 
                    key={d}
                    className={`btn btn-sm ${config.activeDayOverride === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', border: 'none', fontSize: '0.78rem' }}
                    onClick={() => handleSetActiveDayOverride(d)}
                  >
                    {d === 3 ? 'تفعيل اليوم 3 (النهائيات) يدوياً' : `تفعيل اليوم ${d} يدوياً`}
                  </button>
                ))}
              </div>
            </div>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDateConfig(false)}
              style={{ fontSize: '0.78rem' }}
            >
              إغلاق لوحة التواريخ
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: Automated Consoles Queue Board */}
      {viewMode === 'consoles' && (
        <div>
          {/* Active Day Banner & Future Notice */}
          <div style={{
            background: isViewDayActive 
              ? 'linear-gradient(90deg, #ECFDF5 0%, #F0FDF4 100%)' 
              : (isFutureDay ? '#EFF6FF' : '#F8FAFC'),
            border: `1.5px solid ${isViewDayActive ? '#059669' : (isFutureDay ? '#3B82F6' : '#94A3B8')}`,
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={22} color={isViewDayActive ? '#059669' : (isFutureDay ? '#2563EB' : '#64748B')} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: isViewDayActive ? '#065F46' : (isFutureDay ? '#1E40AF' : '#334155'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>طوابير أجهزة الصالة — {viewConsoleDay === 3 ? 'اليوم 3 (نهائيات البطولة 🏆)' : `اليوم ${viewConsoleDay}`}</span>
                  <span className={`badge ${isViewDayActive ? 'badge-green' : (isFutureDay ? 'badge-blue' : 'badge-gray')}`} style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                    {isViewDayActive ? '🟢 نشط ومباشر الآن (Live)' : (isFutureDay ? '⏳ يوم مستقبلي (قيد الانتظار)' : '✓ يوم سابق')}
                  </span>
                  {config.activeDayOverride === viewConsoleDay && (
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>⚡ تفعيل يدوي</span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  📅 التاريخ المجدول: <b className="numeric">{viewDayDate || 'غير محدد'}</b> 
                  {isViewDayActive 
                    ? ' • (مطابق لتاريخ اليوم الحالي، المباريات تعمل مباشرة باللون الأخضر)' 
                    : (isFutureDay 
                        ? ' • (هذا موعد مستقبلي، لن تعمل المباريات بالأخضر حتى يحل تاريخ هذا اليوم أو تقوم بتفعيله)' 
                        : ' • (انتهت فعاليات هذا اليوم)')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {!isViewDayActive && (
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSetActiveDayOverride(viewConsoleDay)}
                  style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="تفعيل هذا اليوم يدوياً لتشغيل مبارياته باللون الأخضر"
                >
                  <Play size={13} />
                  <span>تفعيل اليوم {viewConsoleDay} الآن (تشغيل مبكر)</span>
                </button>
              )}

              {config.activeDayOverride && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSetActiveDayOverride(null)}
                  style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="الرجوع للوضع التلقائي بحسب تاريخ اليوم الفعلي"
                >
                  <RotateCcw size={13} />
                  <span>العودة للتاريخ التلقائي</span>
                </button>
              )}

              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDateConfig(!showDateConfig)}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Calendar size={13} />
                <span>{showDateConfig ? 'إخفاء التواريخ' : '🗓️ ضبط التواريخ'}</span>
              </button>
            </div>
          </div>

          {/* Consoles Grid: Strictly separated per day with single console filter option */}
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
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>جهاز {cId}</span>
                      {singleConsoleFilter !== 'all' && (
                        <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>تركيز مخصص</span>
                      )}
                    </div>
                    <span className="badge badge-gray numeric">
                      اليوم {viewConsoleDay}: {cData.completedCount} / {cData.totalCount} منتهية
                    </span>
                  </div>

                  {/* 1. CURRENT MATCH (Live) or FUTURE DAY NOTICE */}
                  {!isViewDayActive ? (
                    <div style={{ 
                      background: '#F8FAFC', 
                      border: '1.5px dashed #94A3B8', 
                      borderRadius: '10px', 
                      padding: '14px',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#475569', fontWeight: 700, fontSize: '0.825rem', marginBottom: '4px' }}>
                        <Clock size={15} color="#64748B" />
                        <span>{isFutureDay ? `مجدولة لتاريخ ${dayDates[viewConsoleDay] || ''}` : `مباريات اليوم ${viewConsoleDay}`}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {isFutureDay 
                          ? '⏳ هذا موعد مستقبلي — المباريات قيد الانتظار ولن تظهر باللون الأخضر حتى يحل تاريخ هذا اليوم.' 
                          : 'تم الانتهاء من فعاليات هذا اليوم أو بانتظار التفعيل.'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      background: current ? '#ECFDF5' : '#F8FAFC', 
                      border: current ? '2px solid #059669' : '1px dashed var(--border-strong)', 
                      borderRadius: '10px', 
                      padding: '12px',
                      boxShadow: current ? '0 4px 12px rgba(5, 150, 105, 0.12)' : 'none',
                      transition: 'all 0.2s ease'
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
                        <div>
                          {/* 365scores Sports Match Card */}
                          <SportsMatchCard 
                            match={current}
                            p1={p1}
                            p2={p2}
                            isCurrent={true}
                            onSelectMatch={setSelectedMatch}
                            onRemindMatch={setReminderMatch}
                          />

                          {/* Action Buttons: Direct Score Record + WhatsApp Reminder */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: '#25D366', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                              onClick={() => setReminderMatch(current)}
                              title="إرسال تذكير واتساب مباشر للاعبين"
                            >
                              <MessageCircle size={14} color="#25D366" />
                              <span>تذكير واتساب</span>
                            </button>
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ flex: 1, fontWeight: 700, fontSize: '0.825rem' }}
                              onClick={() => setSelectedMatch(current)}
                            >
                              رصد النتيجة وإنهاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-dim)', fontSize: '0.825rem' }}>
                          تم إنهاء جميع مباريات هذا الجهاز لليوم {viewConsoleDay} ✓
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. NEXT MATCH (Only shown when this day is active) */}
                  {isViewDayActive && next && (
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

                      {/* 365scores Sports Match Card for Next */}
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

                  {/* 3. FULL QUEUE FOR THIS CONSOLE IN DAY {viewConsoleDay} */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                      طابور اليوم {viewConsoleDay} على جهاز {cId} ({cData.matches.length} مباراة):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
                      {cData.matches.map((m) => {
                        const isCur = isViewDayActive && current && current.id === m.id;
                        const isNxt = isViewDayActive && next && next.id === m.id;
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

      {/* VIEW 2: General Matches List with Filters */}
      {viewMode === 'list' && (
        <div className="matches-list-container">
          {/* List Search & Filter Bar */}
          <div className="filter-bar" style={{ marginBottom: '16px' }}>
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                className="form-input" 
                placeholder="ابحث باسم اللاعب، الفريق، أو رقم الجوال..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <select 
                className="form-select" 
                value={stageFilter} 
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="all">جميع الأدوار</option>
                <option value="group">دور المجموعات</option>
                <option value="knockout">الأدوار الإقصائية</option>
              </select>

              <select 
                className="form-select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">جميع الحالات</option>
                <option value="scheduled">مجدولة / قيد الانتظار</option>
                <option value="live">جارية الآن</option>
                <option value="completed">منتهية</option>
              </select>

              <select 
                className="form-select" 
                value={consoleFilter} 
                onChange={(e) => setConsoleFilter(e.target.value)}
              >
                <option value="all">جميع الأجهزة (1-{consolesCount})</option>
                {Array.from({ length: consolesCount }, (_, i) => i + 1).map(cId => (
                  <option key={cId} value={cId}>جهاز {cId}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredMatches.map(match => {
              const p1 = participantsMap[match.player1Id];
              const p2 = participantsMap[match.player2Id];
              const isCurrent = currentMatchIds.has(match.id);
              const isNext = nextMatchIds.has(match.id);
              const isCompleted = match.status === 'completed' || match.status === 'walkover';

              let cardBg = '#FFFFFF';
              let cardBorder = 'var(--border-light)';
              if (isCurrent) {
                cardBg = '#ECFDF5';
                cardBorder = '#059669';
              } else if (isNext) {
                cardBg = '#FEF9C3';
                cardBorder = '#CA8A04';
              } else if (isCompleted) {
                cardBg = '#F1F5F9';
                cardBorder = '#CBD5E1';
              }

              return (
                <div 
                  key={match.id} 
                  className="match-card" 
                  style={{ 
                    background: cardBg, 
                    border: `2px solid ${cardBorder}`,
                    opacity: isCompleted ? 0.75 : 1
                  }}
                >
                  <div className="match-top-bar">
                    <span style={{ fontWeight: 800, color: isCurrent ? '#065F46' : 'var(--text-main)' }}>
                      مباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : ''} • <span style={{ color: '#047857' }}>اليوم {match.dayNumber || 1}</span>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-gray">
                        جهاز {match.consoleId} (ترتيب {match.orderOnConsole || 1})
                      </span>

                      {isCurrent ? (
                        <span className="badge badge-green" style={{ fontWeight: 800 }}>🟢 جارية الآن</span>
                      ) : (isNext ? (
                        <span className="badge badge-gold" style={{ fontWeight: 800 }}>🟡 التالية للاستعداد</span>
                      ) : (isCompleted ? (
                        <span className="badge badge-gray" style={{ background: '#CBD5E1', color: '#334155' }}>✓ منتهية</span>
                      ) : (
                        <span className="badge badge-gray">مجدولة</span>
                      )))}
                    </div>
                  </div>

                  <div className="match-opponents" style={{ background: isCurrent ? '#D1FAE5' : (isNext ? '#FEF08A' : 'var(--bg-subtle)') }}>
                    <div className="match-player p1" style={{ minWidth: 0, overflow: 'hidden' }}>
                      <AutoFitName 
                        text={p1?.name || 'مشارك 1'}
                        fontWeight={700}
                        color="var(--text-main)"
                        align="right"
                      />
                      <span className="player-team">{p1?.team}</span>
                    </div>

                    <div className="match-score-badge">
                      {match.score1 !== null && match.score2 !== null ? (
                        <span className="numeric">{match.score1} : {match.score2}</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>VS</span>
                      )}
                    </div>

                    <div className="match-player p2" style={{ minWidth: 0, overflow: 'hidden' }}>
                      <AutoFitName 
                        text={p2?.name || 'مشارك 2'}
                        fontWeight={700}
                        color="var(--text-main)"
                        align="left"
                      />
                      <span className="player-team">{p2?.team}</span>
                    </div>
                  </div>

                  <div className="match-footer" style={{ justifyContent: 'space-between' }}>
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

                    <button className="btn btn-primary btn-sm" onClick={() => setSelectedMatch(match)}>
                      {isCompleted ? 'تعديل النتيجة' : 'رصد النتيجة'}
                    </button>
                  </div>
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
