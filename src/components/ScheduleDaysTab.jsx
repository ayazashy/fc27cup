import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Users, 
  Layers, 
  Printer, 
  RefreshCw, 
  Shuffle, 
  Sparkles, 
  Search, 
  Filter, 
  Award,
  ChevronDown,
  ChevronUp,
  Monitor,
  Check,
  Download,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  splitMatchesIntoDays, 
  calculatePlayerDayWorkload, 
  getDayBreakdownStats,
  calculateFixedMatchSchedule,
  formatMinsToTime12
} from '../utils/tournamentEngine';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';

export default function ScheduleDaysTab({
  matches,
  setMatches,
  participants,
  groups,
  config,
  setConfig,
  onNotify,
  onOpenAdjustMatch
}) {
  const [selectedDaysCount, setSelectedDaysCount] = useState(Number(config.tournamentDays) || 2);
  const [playerSearch, setPlayerSearch] = useState('');
  const [activeCircleTab, setActiveCircleTab] = useState('all'); // 'all', '1', '2', '3', 'ko'
  const [expandedDay, setExpandedDay] = useState(1);
  const [filterConsole, setFilterConsole] = useState('all');
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);

  const participantsMap = useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const playersPerGroup = Number(config.playersPerGroup) || 4;
  const numCircles = playersPerGroup - 1; // Formula: p - 1 full circles

  // Calculate day stats based on current matches
  const dayStats = useMemo(() => {
    return getDayBreakdownStats(matches, participants, selectedDaysCount);
  }, [matches, participants, selectedDaysCount]);

  // Calculate player workload
  const playerWorkloads = useMemo(() => {
    return calculatePlayerDayWorkload(matches, participants, selectedDaysCount);
  }, [matches, participants, selectedDaysCount]);

  // Group matches by Circle (Round)
  const circlesData = useMemo(() => {
    const groupMatches = matches.filter(m => m.stage === 'group' || m.groupId);
    const koMatches = matches.filter(m => m.stage !== 'group' && !m.groupId);

    const circles = {};
    for (let c = 1; c <= numCircles; c++) {
      circles[c] = groupMatches.filter(m => (m.roundNumber || 1) === c);
    }

    return {
      circles,
      koMatches
    };
  }, [matches, numCircles]);

  // Fixed match schedule computed per day based on admin start times and breaks
  const fixedScheduleByDay = useMemo(() => {
    const result = {};
    for (let d = 1; d <= selectedDaysCount; d++) {
      const dayMatches = matches.filter(m => (m.dayNumber || 1) === d);
      const startTime = config.dayStartTimes?.[d] || '18:00';
      const breaks = config.dayBreaks?.[d] || [];
      const avgDuration = Math.round(((Number(config.minMatchDuration) || 10) + (Number(config.maxMatchDuration) || 15)) / 2);
      result[d] = calculateFixedMatchSchedule(dayMatches, startTime, avgDuration, breaks);
    }
    // Knockout day
    const koMatches = matches.filter(m => m.stage !== 'group' && !m.groupId);
    if (koMatches.length > 0) {
      const startTime = config.dayStartTimes?.knockout || '17:00';
      const breaks = config.dayBreaks?.knockout || [];
      const avgDuration = Math.round(((Number(config.minMatchDuration) || 10) + (Number(config.maxMatchDuration) || 15)) / 2);
      result['knockout'] = calculateFixedMatchSchedule(koMatches, startTime, avgDuration, breaks);
    }
    return result;
  }, [matches, selectedDaysCount, config.dayStartTimes, config.dayBreaks, config.minMatchDuration, config.maxMatchDuration]);

  // Today's local date string
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
    knockout: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  };

  let autoTodayDay = 1;
  for (let d = 1; d <= selectedDaysCount; d++) {
    if (dayDates[d] === todayDateStr) {
      autoTodayDay = d;
      break;
    }
  }

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

  const handleUpdateDayStartTime = (dayKey, timeVal) => {
    if (!setConfig) return;
    setConfig(prev => ({
      ...prev,
      dayStartTimes: {
        ...(prev.dayStartTimes || {}),
        [dayKey]: timeVal
      }
    }));
  };

  const handleAddBreak = (dayKey) => {
    if (!setConfig) return;
    setConfig(prev => {
      const existing = prev.dayBreaks?.[dayKey] || [];
      return {
        ...prev,
        dayBreaks: {
          ...(prev.dayBreaks || {}),
          [dayKey]: [...existing, { from: '19:00', to: '19:30' }]
        }
      };
    });
  };

  const handleUpdateBreak = (dayKey, idx, field, val) => {
    if (!setConfig) return;
    setConfig(prev => {
      const existing = [...(prev.dayBreaks?.[dayKey] || [])];
      existing[idx] = { ...existing[idx], [field]: val };
      return {
        ...prev,
        dayBreaks: {
          ...(prev.dayBreaks || {}),
          [dayKey]: existing
        }
      };
    });
  };

  const handleRemoveBreak = (dayKey, idx) => {
    if (!setConfig) return;
    setConfig(prev => {
      const existing = [...(prev.dayBreaks?.[dayKey] || [])];
      existing.splice(idx, 1);
      return {
        ...prev,
        dayBreaks: {
          ...(prev.dayBreaks || {}),
          [dayKey]: existing
        }
      };
    });
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
      onNotify(`تم تفعيل اليوم ${overrideVal} يدوياً كاليوم النشط الآن! ستعمل أجهزته بالأخضر`, 'success');
    }
  };

  // Apply Day Splitting to matches
  const handleApplySplit = (days = selectedDaysCount) => {
    const consolesCount = Number(config.consolesCount) || 5;
    const updated = splitMatchesIntoDays(matches, participants, days, consolesCount);
    setMatches(updated);
    if (setConfig) {
      setConfig(prev => ({ ...prev, tournamentDays: days }));
    }
    onNotify(`تم بنجاح توزيع وموازنة مباريات البطولة على ${days} أيام وفق قاعدة التناظر العكسي!`, 'success');
  };

  const filteredWorkloads = useMemo(() => {
    if (!playerSearch.trim()) return playerWorkloads;
    const q = playerSearch.toLowerCase();
    return playerWorkloads.filter(w => 
      w.name?.toLowerCase().includes(q) || 
      w.team?.toLowerCase().includes(q) || 
      w.phone?.includes(q)
    );
  }, [playerWorkloads, playerSearch]);

  const handlePrint = () => {
    window.print();
  };

  // CSV Export: all matches with full details
  const handleExportCSV = (dayFilter = 'all') => {
    const headers = [
      'رقم المباراة',
      'اليوم',
      'الجهاز',
      'الترتيب على الجهاز',
      'وقت البداية المقرر',
      'وقت النهاية المقرر',
      'اسم اللاعب 1',
      'جوال اللاعب 1',
      'نادي اللاعب 1',
      'اسم اللاعب 2',
      'جوال اللاعب 2',
      'نادي اللاعب 2',
      'نتيجة اللاعب 1',
      'نتيجة اللاعب 2',
      'حالة المباراة',
      'انسحاب',
      'اسم الفائز',
      'المجموعة',
      'الجولة',
      'المرحلة'
    ];

    const statusLabel = (m) => {
      if (m.status === 'completed') return 'مكتملة';
      if (m.status === 'walkover') return 'انسحاب';
      if (m.status === 'live') return 'جارية';
      return 'مجدولة';
    };

    const stageLabel = (m) => {
      if (m.stage === 'group') return 'دور المجموعات';
      if (m.stage === 'r64') return 'دور الـ 64';
      if (m.stage === 'r32') return 'دور الـ 32';
      if (m.stage === 'r16') return 'دور الـ 16';
      if (m.stage === 'qf') return 'ربع النهائي';
      if (m.stage === 'sf') return 'نصف النهائي';
      if (m.stage === 'final') return 'المباراة النهائية 🏆';
      return m.stage || 'إقصائيات';
    };

    const filteredMatches = dayFilter === 'all'
      ? matches
      : matches.filter(m => (m.dayNumber || 1) === Number(dayFilter));

    const sorted = [...filteredMatches].sort((a, b) => {
      const da = a.dayNumber || 1;
      const db = b.dayNumber || 1;
      if (da !== db) return da - db;
      const ca = a.consoleId || 1;
      const cb = b.consoleId || 1;
      if (ca !== cb) return ca - cb;
      return (a.orderOnConsole || 0) - (b.orderOnConsole || 0);
    });

    const rows = sorted.map(m => {
      const p1 = participantsMap[m.player1Id] || {};
      const p2 = participantsMap[m.player2Id] || {};
      const dayN = m.dayNumber || 1;
      const sched = fixedScheduleByDay[dayN]?.[m.id];
      const isWalkover = m.status === 'walkover';
      const winnerId = m.winnerId || m.walkoverWinnerId;
      const winnerName = winnerId ? (participantsMap[winnerId]?.name || '') : '';

      return [
        m.matchNumber || '',
        dayN,
        m.consoleId || '',
        m.orderOnConsole || '',
        sched?.timeStr || '',
        sched?.endTimeStr || '',
        p1.name || '',
        p1.displayPhone || p1.phone || '',
        p1.team || '',
        p2.name || '',
        p2.displayPhone || p2.phone || '',
        p2.team || '',
        m.score1 !== null && m.score1 !== undefined ? m.score1 : '',
        m.score2 !== null && m.score2 !== undefined ? m.score2 : '',
        statusLabel(m),
        isWalkover ? 'نعم' : 'لا',
        winnerName,
        m.groupName || '',
        m.roundNumber || '',
        stageLabel(m)
      ];
    });

    const csvLines = [
      '\uFEFF' + headers.join(','), // BOM for Arabic Excel
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dayLabel = dayFilter === 'all' ? 'جميع_الأيام' : `اليوم_${dayFilter}`;
    a.href = url;
    a.download = `جدول_مباريات_FC27_${dayLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`تم تصدير جدول المباريات (${rows.length} مباراة) إلى ملف CSV بنجاح! 📊`, 'success');
  };

  return (
    <div className="tab-content" style={{ maxWidth: '100%' }}>
      {/* Top Banner / Controller Bar */}
      <div className="clean-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={24} color="var(--ksu-green)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ksu-green)', margin: 0 }}>
                جدول أيام البطولة
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="طباعة جدول الأيام المعتمد للملصقات وإعلانات الطلاب"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportCSV('all')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065F46', borderColor: '#A7F3D0', background: '#F0FDF4' }}
              title="تصدير جدول كامل لجميع المباريات بصيغة CSV"
            >
              <Download size={15} />
              <span>تصدير CSV</span>
            </button>

            <button
              className={`btn btn-sm ${showScheduleConfig ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowScheduleConfig(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="ضبط أوقات البداية والاستراحات لكل يوم"
            >
              <Clock size={15} />
              <span>مواعيد البدء</span>
            </button>

            {onOpenAdjustMatch && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAdjustMatch}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#86EFAC', color: '#065F46', background: '#F0FDF4' }}
                title="تعديل موعد ويوم مباراة بالرقم ID (خاص بالإدارة الرئيسية)"
              >
                <Clock size={15} color="var(--ksu-green)" />
                <span>تعديل موعد مباراة ⏰</span>
              </button>
            )}

            <button 
              className="btn btn-primary btn-sm"
              onClick={() => handleApplySplit(selectedDaysCount)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              title="تطبيق هذا التقسيم وتثبيته على جميع مباريات البطولة"
            >
              <Sparkles size={15} />
              <span>تطبيق التوزيع</span>
            </button>
          </div>
        </div>

        {/* Days Count Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
              عدد أيام البطولة:
            </span>

            <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
              {[1, 2, 3, 4, 5].map(d => (
                <button
                  key={d}
                  className={`btn btn-sm ${selectedDaysCount === d ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', border: 'none', fontWeight: selectedDaysCount === d ? 800 : 600 }}
                  onClick={() => {
                    setSelectedDaysCount(d);
                    handleApplySplit(d);
                  }}
                >
                  {d === 1 && 'يوم واحد'}
                  {d === 2 && 'يومان (الموصى به ⭐)'}
                  {d === 3 && '3 أيام'}
                  {d === 4 && '4 أيام'}
                  {d === 5 && '5 أيام'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            💡 إجمالي الدورات: <b>{numCircles} دورات كاملة</b>
          </div>
        </div>

        {/* ── Schedule Config Panel (collapsible) ── */}
        {showScheduleConfig && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--ksu-green)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={18} />
              <span>تحديد أوقات البداية والاستراحات لكل يوم</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[...Array.from({ length: selectedDaysCount }, (_, i) => i + 1), 'knockout'].map(dayKey => {
                const dayLabel = dayKey === 'knockout' ? 'يوم الإقصائيات 🏆' : `اليوم ${dayKey}`;
                const startTime = config.dayStartTimes?.[dayKey] || '18:00';
                const breaks = config.dayBreaks?.[dayKey] || [];
                const dayMatchCount = dayKey === 'knockout'
                  ? matches.filter(m => m.stage !== 'group' && !m.groupId).length
                  : matches.filter(m => (m.dayNumber || 1) === Number(dayKey)).length;

                return (
                  <div key={dayKey} style={{ background: '#F8FAFC', border: '1.5px solid var(--border-light)', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{dayLabel}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{dayMatchCount} مباراة</span>
                    </div>

                    {/* Start Time */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        🕐 وقت بداية المباريات:
                      </label>
                      <input
                        type="time"
                        className="form-input numeric"
                        style={{ fontSize: '0.9rem', padding: '6px 10px' }}
                        value={startTime}
                        onChange={e => handleUpdateDayStartTime(dayKey, e.target.value)}
                      />
                    </div>

                    {/* Breaks */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          ⏸️ فترات الاستراحة:
                        </label>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => handleAddBreak(dayKey)}
                        >
                          <Plus size={11} /> إضافة استراحة
                        </button>
                      </div>

                      {breaks.length === 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>لا توجد استراحات مضافة</div>
                      )}

                      {breaks.map((brk, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', background: '#FEF9C3', borderRadius: '6px', padding: '5px 8px', border: '1px solid #FEF08A' }}>
                          <span style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 700, whiteSpace: 'nowrap' }}>من</span>
                          <input
                            type="time"
                            className="form-input numeric"
                            style={{ fontSize: '0.78rem', padding: '3px 6px', flex: 1 }}
                            value={brk.from || '19:00'}
                            onChange={e => handleUpdateBreak(dayKey, idx, 'from', e.target.value)}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 700, whiteSpace: 'nowrap' }}>إلى</span>
                          <input
                            type="time"
                            className="form-input numeric"
                            style={{ fontSize: '0.78rem', padding: '3px 6px', flex: 1 }}
                            value={brk.to || '19:30'}
                            onChange={e => handleUpdateBreak(dayKey, idx, 'to', e.target.value)}
                          />
                          <button
                            onClick={() => handleRemoveBreak(dayKey, idx)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="حذف الاستراحة"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', color: '#166534', marginTop: '12px' }}>
              💡 <b>مثال:</b> بداية 6:00 م، استراحة 7:00 م – 7:30 م. المباراة التي كانت ستبدأ 7:10 م ستُمنح موعد 7:30 م تلقائياً. مدة كل مباراة = متوسط الحد الأدنى والأقصى المضبوطين في الإعدادات ({Math.round(((Number(config.minMatchDuration) || 10) + (Number(config.maxMatchDuration) || 15)) / 2)} دقيقة حالياً).
            </div>
          </div>
        )}

        {/* SECTION: Tournament Days Dates & Live Day Controller */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--ksu-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={20} />
              <span>تحديد تواريخ أيام البطولة والأدوار الإقصائية (Tournament Dates):</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              تاريخ اليوم الفعلي: <b className="numeric" style={{ color: 'var(--ksu-green)' }}>{todayDateStr}</b>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                🗓️ موعد اليوم الأول (Day 1):
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates[1] || ''}
                onChange={(e) => handleUpdateDayDate(1, e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', marginTop: '4px', fontWeight: 600, color: dayDates[1] === todayDateStr ? '#059669' : 'var(--text-dim)' }}>
                {dayDates[1] === todayDateStr ? '🟢 اليوم 1 هو تاريخ اليوم' : (dayDates[1] > todayDateStr ? '⏳ موعد قادم' : '✓ موعد سابق')}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                🗓️ موعد اليوم الثاني (Day 2):
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates[2] || ''}
                onChange={(e) => handleUpdateDayDate(2, e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', marginTop: '4px', fontWeight: 600, color: dayDates[2] === todayDateStr ? '#059669' : 'var(--text-dim)' }}>
                {dayDates[2] === todayDateStr ? '🟢 اليوم 2 هو تاريخ اليوم' : (dayDates[2] > todayDateStr ? '⏳ موعد قادم' : '✓ موعد سابق')}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                🏆 موعد يوم الإقصائيات (Finals):
              </label>
              <input 
                type="date" 
                className="form-input numeric"
                value={dayDates.knockout || ''}
                onChange={(e) => handleUpdateDayDate('knockout', e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', marginTop: '4px', fontWeight: 600, color: dayDates.knockout === todayDateStr ? '#059669' : 'var(--text-dim)' }}>
                {dayDates.knockout === todayDateStr ? '🟢 يوم الإقصائيات والنهائي هو اليوم' : '🏆 مباريات دور خروج المغلوب'}
              </div>
            </div>
          </div>

          {/* Active Day Override Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                وضع تفعيل أجهزة الصالة:
              </span>
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
                <button 
                  className={`btn btn-sm ${config.activeDayOverride === null ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', border: 'none', fontSize: '0.78rem' }}
                  onClick={() => handleSetActiveDayOverride(null)}
                >
                  تلقائي بحسب التاريخ ({autoTodayDay ? `اليوم ${autoTodayDay}` : 'غير محدد'})
                </button>
                {Array.from({ length: selectedDaysCount }, (_, i) => i + 1).map(d => (
                  <button 
                    key={d}
                    className={`btn btn-sm ${config.activeDayOverride === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', border: 'none', fontSize: '0.78rem' }}
                    onClick={() => handleSetActiveDayOverride(d)}
                  >
                    تفعيل اليوم {d} يدوياً
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ⚡ اليوم النشط تظهر مبارياته بالأخضر في الصالة، بينما الأيام المستقبلية تظهر كمجدولة قيد الانتظار.
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Circles Info */}
        <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--ksu-green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} color="var(--ksu-green)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>الدورات الكاملة (p - 1)</div>
            <div className="numeric" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
              {numCircles} دورات كاملة
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>تضمن لعب كل لاعب مرة في كل دورة</div>
          </div>
        </div>

        {/* Card 2: Reverse Symmetry */}
        <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: selectedDaysCount === 2 ? '#ECFDF5' : '#FFFFFF', border: selectedDaysCount === 2 ? '1.5px solid #10B981' : '1px solid var(--border-light)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 700 }}>ميزان التناظر العكسي</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
              {selectedDaysCount === 2 ? '100% متناظر عكساً ✓' : `موزع على ${selectedDaysCount} أيام`}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#065F46' }}>
              {selectedDaysCount === 2 ? '50% يلعبون 2 باليوم 1 ثم 1 باليوم 2 والعكس' : 'توزيع عادل للأحمال'}
            </div>
          </div>
        </div>

        {/* Card 3: Matches Total & Days Breakdown */}
        <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={24} color="#D97706" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>إجمالي مباريات البطولة</div>
            <div className="numeric" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706' }}>
              {matches.length} مباراة
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              معدل {Math.round(matches.length / selectedDaysCount)} مباراة / اليوم
            </div>
          </div>
        </div>

        {/* Card 4: Participants */}
        <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>المشاركون المجدولون</div>
            <div className="numeric" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB' }}>
              {participants.length} لاعب
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{groups.length} مجموعات رسمية</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Visualization of the (p - 1) Circles / Loops */}
      <div className="clean-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layers size={18} color="var(--ksu-green)" />
              <span>توزيع الجولات</span>
            </h3>
          </div>

          {/* Filter Circle Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
            <button 
              className={`btn btn-sm ${activeCircleTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', border: 'none' }}
              onClick={() => setActiveCircleTab('all')}
            >
              جميع الدورات ({numCircles})
            </button>
            {Array.from({ length: numCircles }, (_, i) => i + 1).map(cNum => (
              <button 
                key={cNum}
                className={`btn btn-sm ${activeCircleTab === String(cNum) ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', border: 'none' }}
                onClick={() => setActiveCircleTab(String(cNum))}
              >
                الدورة {cNum}
              </button>
            ))}
            <button 
              className={`btn btn-sm ${activeCircleTab === 'ko' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', border: 'none' }}
              onClick={() => setActiveCircleTab('ko')}
            >
              الإقصائيات
            </button>
          </div>
        </div>

        {/* Circles Visual Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Circle 1 */}
          {(activeCircleTab === 'all' || activeCircleTab === '1') && (
            <div style={{ background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ksu-green)' }}>
                    الدورة الكاملة 1 (الجولة الأولى)
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    يلعب فيها كل لاعب من الـ {participants.length} مباراته الأولى
                  </div>
                </div>
                <span className="badge badge-green" style={{ fontWeight: 800 }}>اليوم 1 بالكامل</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                عدد مباريات الدورة: {(circlesData.circles[1] || []).length} مباراة
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {(circlesData.circles[1] || []).map((m, idx) => {
                  const sched = fixedScheduleByDay[1]?.[m.id];
                  return (
                    <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sched && (
                          <span className="numeric" style={{ fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                            🕒 {sched.timeStr}
                          </span>
                        )}
                        <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>اليوم 1</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Circle 2 (The Split Circle in 2-Day System) */}
          {(activeCircleTab === 'all' || activeCircleTab === '2') && (
            <div style={{ background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#92400E' }}>
                    الدورة الكاملة 2 (الجولة الثانية - المفصلية)
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#92400E' }}>
                    تنقسم بالتساوي 50% لليوم 1 و 50% لليوم 2 لتحقيق التناظر العكسي
                  </div>
                </div>
                <span className="badge badge-gold" style={{ fontWeight: 800 }}>مقسمة بين اليومين</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', marginBottom: '8px' }}>
                عدد مباريات الدورة: {(circlesData.circles[2] || []).length} مباراة
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {(circlesData.circles[2] || []).map((m, idx) => {
                  const isDay1 = (m.dayNumber || 1) === 1;
                  const sched = fixedScheduleByDay[m.dayNumber || 1]?.[m.id];
                  return (
                    <div key={m.id} style={{ padding: '6px 10px', background: isDay1 ? '#ECFDF5' : '#FFFFFF', border: `1px solid ${isDay1 ? '#A7F3D0' : '#E2E8F0'}`, borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sched && (
                          <span className="numeric" style={{ fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                            🕒 {sched.timeStr}
                          </span>
                        )}
                        <span className={`badge ${isDay1 ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '0.68rem' }}>
                          {isDay1 ? 'اليوم 1' : 'اليوم 2'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Circle 3 */}
          {(activeCircleTab === 'all' || activeCircleTab === '3') && (
            <div style={{ background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1E293B' }}>
                    الدورة الكاملة 3 (الجولة الثالثة والحاسمة)
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    الجولة الختامية للمجموعات لحسم هوية المتصدر والوصيف
                  </div>
                </div>
                <span className="badge badge-gray" style={{ fontWeight: 800 }}>اليوم 2</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                عدد مباريات الدورة: {(circlesData.circles[3] || []).length} مباراة
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {(circlesData.circles[3] || []).map((m, idx) => {
                  const sched = fixedScheduleByDay[2]?.[m.id];
                  return (
                    <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sched && (
                          <span className="numeric" style={{ fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                            🕒 {sched.timeStr}
                          </span>
                        )}
                        <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>اليوم 2</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Knockouts Stage */}
          {(activeCircleTab === 'all' || activeCircleTab === 'ko') && (
            <div style={{ background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ksu-green)' }}>
                    أدوار خروج المغلوب 🏆
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    المباريات الإقصائية من دور الـ 16 حتى النهائي
                  </div>
                </div>
                <span className="badge badge-green" style={{ fontWeight: 800 }}>اليوم الختامي</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                عدد المباريات الإقصائية: {circlesData.koMatches.length} مباراة
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {circlesData.koMatches.map((m, idx) => {
                  const sched = fixedScheduleByDay['knockout']?.[m.id];
                  return (
                    <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="numeric" style={{ fontWeight: 800, color: 'var(--ksu-green)', marginLeft: '6px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{m.title || `مباراة #${m.matchNumber}`}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sched && (
                          <span className="numeric" style={{ fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                            🕒 {sched.timeStr}
                          </span>
                        )}
                        <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>اليوم الختامي</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Days Breakdown Cards (Day 1, Day 2, Day X...) */}
      <div className="clean-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Calendar size={18} color="var(--ksu-green)" />
              <span>مباريات الأيام</span>
            </h3>
          </div>

          {/* Day View Filter */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
            {dayStats.map(ds => (
              <button
                key={ds.dayNumber}
                className={`btn btn-sm ${expandedDay === ds.dayNumber ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 14px', border: 'none' }}
                onClick={() => setExpandedDay(ds.dayNumber)}
              >
                اليوم {ds.dayNumber} ({ds.matchesCount} مباراة)
              </button>
            ))}
          </div>
        </div>

        {/* Selected Day Detailed Card */}
        {dayStats.filter(ds => ds.dayNumber === expandedDay).map(ds => (
          <div key={ds.dayNumber} style={{ border: '1.5px solid var(--border-light)', borderRadius: '12px', padding: '16px', background: '#FAFAFA' }}>
            {/* Day Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
                  جدول مباريات اليوم {ds.dayNumber}
                </span>
                <span className="badge badge-gray numeric" style={{ marginRight: '10px' }}>
                  {ds.matchesCount} مباراة مقررة
                </span>
              </div>

              {/* Reverse Symmetry Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>
                  👥 {ds.playersPlayingTwice} لاعب يلعبون مباراتين اليوم (50%)
                </div>
                <div style={{ background: '#FEF9C3', border: '1px solid #FEF08A', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: '#854D0E', fontWeight: 700 }}>
                  👤 {ds.playersPlayingOnce} لاعب يلعبون مباراة واحدة اليوم (50%)
                </div>
              </div>
            </div>

            {/* Console breakdown for this day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                توزيع مباريات اليوم على أجهزة الصالة:
              </span>
              {Object.entries(ds.consoleCounts).map(([cId, count]) => (
                <span key={cId} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Monitor size={12} color="var(--ksu-green)" />
                  جهاز {cId}: <b className="numeric">{count}</b> مباريات
                </span>
              ))}
            </div>

            {/* Matches list for this day */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                قائمة المباريات ومواعيدها المقررة:
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleExportCSV(ds.dayNumber)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '4px 10px', color: '#065F46', background: '#F0FDF4', borderColor: '#A7F3D0' }}
                title={`تصدير مباريات اليوم ${ds.dayNumber} فقط إلى CSV`}
              >
                <Download size={13} />
                <span>تصدير جدول اليوم {ds.dayNumber} (CSV)</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {ds.matches.map((m, idx) => {
                const isDone = m.status === 'completed' || m.status === 'walkover';
                const isLive = m.status === 'live';
                const sched = fixedScheduleByDay[ds.dayNumber]?.[m.id];
                return (
                  <div key={m.id} style={{ background: isLive ? '#ECFDF5' : (isDone ? '#F1F5F9' : '#FFFFFF'), border: `1.5px solid ${isLive ? '#059669' : (isDone ? '#CBD5E1' : 'var(--border-light)')}`, borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        مباراة #{m.matchNumber} {m.groupName ? `(${m.groupName})` : ''}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sched && (
                          <span className="numeric" style={{ fontWeight: 800, color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>
                            🕒 {sched.timeStr}
                          </span>
                        )}
                        <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                          جهاز {m.consoleId}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name || 'مشارك 1'}</span>
                      <span className="numeric" style={{ fontWeight: 800, color: 'var(--ksu-green)' }}>
                        {m.score1 !== null && m.score2 !== null ? `${m.score1} : ${m.score2}` : 'ضد'}
                      </span>
                      <span style={{ fontWeight: 700 }}>{participantsMap[m.player2Id]?.name || 'مشارك 2'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>جولة {m.roundNumber || 1}</span>
                      {sched ? (
                        <span className="numeric" style={{ color: '#059669', fontWeight: 700 }}>
                          الوقت المقرر: {sched.timeStr} - {sched.endTimeStr}
                        </span>
                      ) : (
                        m.estimatedTime && (
                          <span className="numeric" style={{ color: '#475569' }}>
                            🕒 {m.estimatedTime.rangeStr}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 3: Player Workload Matrix (تحقق عدالة توزيع اللاعبين) */}
      <div className="clean-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={18} color="var(--ksu-green)" />
              <span>توزيع مباريات اللاعبين</span>
            </h3>
          </div>

          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <input 
              type="text"
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              placeholder="ابحث باسم اللاعب أو النادي..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="clean-table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>م</th>
                <th>اسم اللاعب</th>
                <th>النادي المختار</th>
                {Array.from({ length: selectedDaysCount }, (_, i) => i + 1).map(d => (
                  <th key={d} style={{ textAlign: 'center' }}>مباريات اليوم {d}</th>
                ))}
                <th style={{ textAlign: 'center' }}>المجموع الكلي</th>
                <th style={{ textAlign: 'center' }}>مؤشر التناظر والعدالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkloads.map((w, idx) => (
                <tr key={w.playerId}>
                  <td className="numeric" style={{ fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 800 }}>{w.name}</td>
                  <td>
                    {(() => {
                      const logo = getTeamLogoUrl(w.team);
                      const hasKnown = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {logo && (
                            <img 
                              src={logo} 
                              alt={w.team || ''} 
                              title={w.team || ''} 
                              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                              onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                            />
                          )}
                          {(!hasKnown && w.team) && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{w.team}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  {Array.from({ length: selectedDaysCount }, (_, i) => i + 1).map(d => (
                    <td key={d} className="numeric" style={{ textAlign: 'center', fontWeight: 800 }}>
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: (w.days[d] || 0) === 2 ? '#ECFDF5' : '#FEF9C3',
                          color: (w.days[d] || 0) === 2 ? '#065F46' : '#854D0E',
                          border: `1px solid ${(w.days[d] || 0) === 2 ? '#A7F3D0' : '#FEF08A'}`
                        }}
                      >
                        {w.days[d] || 0} مباراة
                      </span>
                    </td>
                  ))}
                  <td className="numeric" style={{ textAlign: 'center', fontWeight: 900, color: 'var(--ksu-green)' }}>
                    {w.totalMatches}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {selectedDaysCount === 2 ? (
                      w.isReverseBalanced ? (
                        <span className="badge badge-green" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          متوازن عكساً ({w.days[1]} + {w.days[2]} = {w.totalMatches}) ✓
                        </span>
                      ) : (
                        <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>
                          عادي ({w.totalMatches})
                        </span>
                      )
                    ) : (
                      <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                        موزع بانتظام ✓
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
