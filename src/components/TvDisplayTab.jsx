import React, { useState, useEffect } from 'react';
import { Tv, Monitor, Maximize2, Minimize2, Trophy, Clock, Volume2, Award, Shield } from 'lucide-react';

export default function TvDisplayTab({ 
  matches, 
  groups, 
  participants, 
  config 
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleList = Array.from({ length: consolesCount }, (_, i) => i + 1);

  // Matches currently live on consoles
  const liveMatches = matches.filter(m => m.status === 'live');
  // Upcoming scheduled matches
  const upcomingMatches = matches.filter(m => m.status === 'scheduled').slice(0, 6);

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
    return Object.values(scoreMap).sort((a, b) => b.goals - a.goals).slice(0, 5);
  }, [matches, participantsMap]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="tab-content">
      {/* TV Header Bar */}
      <div className="clean-card" style={{ padding: '16px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src="/logo.png" 
              alt="شعار كأس السكن FC27" 
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
                شاشة العرض المباشرة — صالة التلفزيون
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                العرض الحي للجمهور واللاعبين لمتابعة الأجهزة وطابور المباريات القادمة
              </p>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span>{isFullscreen ? 'إنهاء ملء الشاشة' : 'وضع الشاشة الكاملة (بروجكتر)'}</span>
          </button>
        </div>
      </div>

      {/* 5 Gaming Stations Live Grid */}
      <div className="clean-card">
        <div className="card-header">
          <div className="card-title">
            <Monitor size={20} color="var(--ksu-green)" />
            <span>حالة محطات اللعب في الصالة (أجهزة 1 إلى {consolesCount})</span>
          </div>
          <span className="badge badge-green">محدث لحظياً</span>
        </div>

        <div className="tv-stations-bar">
          {consoleList.map(consoleId => {
            const currentMatch = liveMatches.find(m => m.consoleId === consoleId);
            const p1 = currentMatch ? participantsMap[currentMatch.player1Id] : null;
            const p2 = currentMatch ? participantsMap[currentMatch.player2Id] : null;

            return (
              <div key={consoleId} className={`tv-station-box ${currentMatch ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Monitor size={16} color="var(--ksu-green)" />
                    جهاز {consoleId}
                  </span>
                  <span className={`badge ${currentMatch ? 'badge-green' : 'badge-gray'}`}>
                    {currentMatch ? 'مباراة جارية' : 'متاح'}
                  </span>
                </div>

                {currentMatch ? (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      مباراة #{currentMatch.matchNumber} {currentMatch.groupName}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {p1?.name || 'مشارك 1'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      ({p1?.team})
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--ksu-green)', margin: '4px 0' }}>
                      {currentMatch.score1 !== null ? `${currentMatch.score1} - ${currentMatch.score2}` : 'ضد'}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {p2?.name || 'مشارك 2'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({p2?.team})
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    الجهاز جاهز لاستقبال المباراة التالية
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Upcoming Call Queue & Top Scorers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Next Up Call List */}
        <div className="clean-card">
          <div className="card-header">
            <div className="card-title">
              <Volume2 size={20} color="var(--trophy-gold)" />
              <span>نداء المباريات القادمة للاستعداد (Up Next)</span>
            </div>
            <span className="badge badge-gold">تنبيه الصالة</span>
          </div>

          {upcomingMatches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              لا توجد مباريات مجدولة تالية حالياً.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingMatches.map(m => {
                const p1 = participantsMap[m.player1Id];
                const p2 = participantsMap[m.player2Id];
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {p1?.name} ضد {p2?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        مباراة #{m.matchNumber} {m.groupName ? `(${m.groupName})` : ''}
                      </div>
                    </div>
                    <span className="badge badge-gray">يرجى الاستعداد</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Goalscorers */}
        <div className="clean-card">
          <div className="card-header">
            <div className="card-title">
              <Award size={20} color="var(--trophy-gold)" />
              <span>قائمة هدافي البطولة (Golden Boot)</span>
            </div>
            <span className="badge badge-gold">جائزة الهداف</span>
          </div>

          {topScorers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              سيتم عرض قائمة الهدافين فور تسجيل الأهداف في المباريات.
            </p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="clean-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>م</th>
                    <th>اللاعب</th>
                    <th>النادي</th>
                    <th style={{ textAlign: 'center', color: 'var(--ksu-green)' }}>الأهداف</th>
                  </tr>
                </thead>
                <tbody>
                  {topScorers.map((sc, idx) => (
                    <tr key={idx}>
                      <td className="numeric" style={{ fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{sc.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{sc.team}</td>
                      <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: 'var(--ksu-green)' }}>
                        {sc.goals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
