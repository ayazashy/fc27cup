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
  Check
} from 'lucide-react';
import { 
  splitMatchesIntoDays, 
  calculatePlayerDayWorkload, 
  getDayBreakdownStats 
} from '../utils/tournamentEngine';

export default function ScheduleDaysTab({
  matches,
  setMatches,
  participants,
  groups,
  config,
  setConfig,
  onNotify
}) {
  const [selectedDaysCount, setSelectedDaysCount] = useState(Number(config.tournamentDays) || 2);
  const [playerSearch, setPlayerSearch] = useState('');
  const [activeCircleTab, setActiveCircleTab] = useState('all'); // 'all', '1', '2', '3', 'ko'
  const [expandedDay, setExpandedDay] = useState(1);
  const [filterConsole, setFilterConsole] = useState('all');

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

  // Apply Day Splitting to matches
  const handleApplySplit = (days = selectedDaysCount) => {
    const updated = splitMatchesIntoDays(matches, participants, days);
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
      w.studentId?.includes(q)
    );
  }, [playerWorkloads, playerSearch]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tab-content" style={{ maxWidth: '100%' }}>
      {/* Top Banner / Controller Bar */}
      <div className="clean-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={26} color="var(--ksu-green)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ksu-green)', margin: 0 }}>
                جدولة وتوزيع الأيام الذكية (X Days Split)
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              توزيع مباريات الدورات الكاملة (p - 1 Circles) على أيام البطولة مع تطبيق قاعدة التناظر العكسي لأحمال اللاعبين
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="طباعة جدول الأيام المعتمد للملصقات وإعلانات الطلاب"
            >
              <Printer size={15} />
              <span>طباعة الجدول الرسمي</span>
            </button>

            <button 
              className="btn btn-primary btn-sm"
              onClick={() => handleApplySplit(selectedDaysCount)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              title="تطبيق هذا التقسيم وتثبيته على جميع مباريات البطولة"
            >
              <Sparkles size={15} />
              <span>تطبيق التوزيع على البطولة</span>
            </button>
          </div>
        </div>

        {/* Days Count Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
              اختر عدد أيام البطولة (X Days):
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
            💡 إجمالي الدورات الكاملة للمجموعات: <b>{numCircles} دورات كاملة</b> ({playersPerGroup} لاعبين بالرول - 1)
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layers size={20} color="var(--ksu-green)" />
              <span>مصفوفة الدورات الكاملة (Circles / Loops Visualizer)</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              قوائم الدورات الكاملة الـ {numCircles} وتوزيعها بين اليوم 1 واليوم 2
            </p>
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
                {(circlesData.circles[1] || []).map((m, idx) => (
                  <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>اليوم 1</span>
                  </div>
                ))}
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
                  return (
                    <div key={m.id} style={{ padding: '6px 10px', background: isDay1 ? '#ECFDF5' : '#FFFFFF', border: `1px solid ${isDay1 ? '#A7F3D0' : '#E2E8F0'}`, borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                      </div>
                      <span className={`badge ${isDay1 ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '0.68rem' }}>
                        {isDay1 ? 'اليوم 1' : 'اليوم 2'}
                      </span>
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
                {(circlesData.circles[3] || []).map((m, idx) => (
                  <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="numeric" style={{ fontWeight: 800, color: 'var(--text-dim)', marginLeft: '6px' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{participantsMap[m.player1Id]?.name} ضد {participantsMap[m.player2Id]?.name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{m.groupName} — جهاز {m.consoleId}</span>
                    </div>
                    <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>اليوم 2</span>
                  </div>
                ))}
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
                {circlesData.koMatches.map((m, idx) => (
                  <div key={m.id} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="numeric" style={{ fontWeight: 800, color: 'var(--ksu-green)', marginLeft: '6px' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{m.title || `مباراة #${m.matchNumber}`}</span>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>اليوم الختامي</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Days Breakdown Cards (Day 1, Day 2, Day X...) */}
      <div className="clean-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Calendar size={20} color="var(--ksu-green)" />
              <span>تفصيل مباريات أيام البطولة (Day-by-Day Schedules)</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              المباريات المجدولة لكل يوم مع فحص عدالة الأحمال والتناظر العكسي
            </p>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {ds.matches.map((m, idx) => {
                const isDone = m.status === 'completed' || m.status === 'walkover';
                const isLive = m.status === 'live';
                return (
                  <div key={m.id} style={{ background: isLive ? '#ECFDF5' : (isDone ? '#F1F5F9' : '#FFFFFF'), border: `1.5px solid ${isLive ? '#059669' : (isDone ? '#CBD5E1' : 'var(--border-light)')}`, borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        مباراة #{m.matchNumber} {m.groupName ? `(${m.groupName})` : ''}
                      </span>
                      <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                        جهاز {m.consoleId}
                      </span>
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
                      {m.estimatedTime && (
                        <span className="numeric" style={{ color: '#475569' }}>
                          🕒 {m.estimatedTime.rangeStr}
                        </span>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={20} color="var(--ksu-green)" />
              <span>مصفوفة ومطابقة أحمال اللاعبين (Player Workload Symmetry Matrix)</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              جدول تفصيلي يوضح عدد مباريات كل لاعب في اليوم 1 واليوم 2 مع مؤشر التحقق من التناظر العكسي
            </p>
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
                  <td style={{ color: 'var(--text-muted)' }}>{w.team}</td>
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
