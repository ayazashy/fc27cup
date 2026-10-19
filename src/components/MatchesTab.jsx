import React, { useState } from 'react';
import { Calendar, Monitor, Search, Filter, CheckCircle2, Clock, Play, Award } from 'lucide-react';
import ScoreModal from './ScoreModal';

export default function MatchesTab({ 
  matches, 
  setMatches, 
  participants, 
  config,
  onNotify
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consoleFilter, setConsoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleOptions = Array.from({ length: consolesCount }, (_, i) => i + 1);

  const handleAssignConsole = (matchId, consoleId) => {
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          consoleId: consoleId ? Number(consoleId) : null,
          status: m.status === 'scheduled' && consoleId ? 'live' : m.status
        };
      }
      return m;
    }));
    if (consoleId) {
      onNotify(`تم إسناد المباراة إلى جهاز ${consoleId}`, 'info');
    }
  };

  const handleSaveScore = (updatedMatch) => {
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    onNotify(`تم حفظ واعتماد نتيجة المباراة #${updatedMatch.matchNumber}`, 'success');
  };

  const filteredMatches = matches.filter(m => {
    if (stageFilter === 'group' && m.stage !== 'group') return false;
    if (stageFilter === 'knockout' && m.stage === 'group') return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (consoleFilter !== 'all' && String(m.consoleId) !== String(consoleFilter)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const p1 = participantsMap[m.player1Id]?.name?.toLowerCase() || '';
      const p2 = participantsMap[m.player2Id]?.name?.toLowerCase() || '';
      return p1.includes(q) || p2.includes(q);
    }
    return true;
  });

  return (
    <div className="tab-content">
      {/* Filters Bar */}
      <div className="clean-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={16} /> تصفية:
            </span>

            {/* Stage filter */}
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">جميع الأدوار</option>
              <option value="group">دور المجموعات</option>
              <option value="knockout">الأدوار الإقصائية</option>
            </select>

            {/* Status filter */}
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">جميع الحالات</option>
              <option value="scheduled">مجدولة / قادمة</option>
              <option value="live">جارية الآن في الصالة</option>
              <option value="completed">منتهية</option>
              <option value="walkover">انسحاب</option>
            </select>

            {/* Console filter */}
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={consoleFilter}
              onChange={(e) => setConsoleFilter(e.target.value)}
            >
              <option value="all">جميع الأجهزة (1 - {consolesCount})</option>
              {consoleOptions.map(c => (
                <option key={c} value={c}>جهاز {c}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '240px' }}>
            <input 
              type="text"
              className="form-input"
              style={{ paddingRight: '32px', fontSize: '0.85rem', padding: '6px 12px 6px 32px' }}
              placeholder="بحث باللاعب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', right: '10px', top: '10px' }} />
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="clean-card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <Calendar size={48} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
          <p>لا توجد مباريات تطابق شروط التصفية أو لم يتم إجراء القرعة بعد.</p>
        </div>
      ) : (
        <div className="matches-grid">
          {filteredMatches.map(match => {
            const p1 = participantsMap[match.player1Id];
            const p2 = participantsMap[match.player2Id];
            const isCompleted = match.status === 'completed' || match.status === 'walkover';
            const isLive = match.status === 'live';

            return (
              <div key={match.id} className={`match-card ${isLive ? 'live' : ''}`}>
                {/* Match Top Bar */}
                <div className="match-top-bar">
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    مباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : ''}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {match.consoleId && (
                      <span className="badge badge-gray" style={{ gap: '4px' }}>
                        <Monitor size={12} color="var(--ksu-green)" />
                        جهاز {match.consoleId}
                      </span>
                    )}

                    <span className={`badge ${
                      isCompleted ? 'badge-green' : (isLive ? 'badge-gold' : 'badge-gray')
                    }`}>
                      {isCompleted ? (match.status === 'walkover' ? 'انسحاب' : 'منتهية') : (isLive ? 'جارية بالصالة' : 'مجدولة')}
                    </span>
                  </div>
                </div>

                {/* Opponents & Score */}
                <div className="match-opponents">
                  {/* Player 1 */}
                  <div className="match-player p1">
                    <span className="player-name">{p1?.name || 'مشارك 1'}</span>
                    <span className="player-team">{p1?.team}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{p1?.room}</span>
                  </div>

                  {/* Score Badge */}
                  <div className="match-score-badge">
                    {match.score1 !== null && match.score2 !== null ? (
                      <span>{match.score1} : {match.score2}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>VS</span>
                    )}
                  </div>

                  {/* Player 2 */}
                  <div className="match-player p2">
                    <span className="player-name">{p2?.name || 'مشارك 2'}</span>
                    <span className="player-team">{p2?.team}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{p2?.room}</span>
                  </div>
                </div>

                {/* Match Footer Actions */}
                <div className="match-footer">
                  {/* Device Assign Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Monitor size={14} color="var(--text-muted)" />
                    <select 
                      className="form-select"
                      style={{ padding: '3px 8px', fontSize: '0.8rem', width: 'auto' }}
                      value={match.consoleId || ''}
                      onChange={(e) => handleAssignConsole(match.id, e.target.value)}
                    >
                      <option value="">تحديد جهاز...</option>
                      {consoleOptions.map(c => (
                        <option key={c} value={c}>جهاز {c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Score Button */}
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedMatch(match)}
                  >
                    {isCompleted ? 'تعديل النتيجة' : 'رصد النتيجة'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Score Entry Modal */}
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
