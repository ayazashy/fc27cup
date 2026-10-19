import React, { useState, useEffect } from 'react';
import { Tv, Monitor, Maximize2, Minimize2, Trophy, Clock, Volume2, Award, Shield, Play, Pause, Bell } from 'lucide-react';
import { calculateGroupStandings } from '../utils/tournamentEngine';

export default function TvDisplayTab({ 
  matches, 
  groups, 
  participants, 
  config 
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0); // 0: Stations, 1: Standings, 2: Top Scorers
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [announcement, setAnnouncement] = useState('أهلاً بكم في بطولة كأس السكن FC27 — يرجى من اللاعبين الحضور قبل موعد المباراة بـ 5 دقائق');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [tempNotice, setTempNotice] = useState(announcement);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const consolesCount = Number(config.consolesCount) || 5;
  const consoleList = Array.from({ length: consolesCount }, (_, i) => i + 1);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'scheduled').slice(0, 6);

  // Auto-rotate slides every 15 seconds
  useEffect(() => {
    if (!isAutoRotate) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 3);
    }, 15000);
    return () => clearInterval(timer);
  }, [isAutoRotate]);

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
    return Object.values(scoreMap).sort((a, b) => b.goals - a.goals).slice(0, 6);
  }, [matches, participantsMap]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="tab-content" style={{ maxWidth: '100%' }}>
      {/* TV Header Bar with Slide Controls */}
      <div className="clean-card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src="/logo.png" 
              alt="شعار كأس السكن FC27" 
              style={{ height: '46px', width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
                شاشة العرض المباشرة — صالة التلفزيون
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                عرض البث المباشر للجمهور واللاعبين في القاعة
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Slide Select Buttons */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px' }}>
              <button 
                className={`btn btn-sm ${activeSlide === 0 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setActiveSlide(0)}
              >
                الأجهزة والمباريات
              </button>
              <button 
                className={`btn btn-sm ${activeSlide === 1 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setActiveSlide(1)}
              >
                جداول المجموعات
              </button>
              <button 
                className={`btn btn-sm ${activeSlide === 2 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', border: 'none' }}
                onClick={() => setActiveSlide(2)}
              >
                الهدافون والجوائز
              </button>
            </div>

            {/* Auto-rotate Toggle */}
            <button 
              className={`btn btn-sm ${isAutoRotate ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              title="دوران تلقائي للشاشات كل 15 ثانية للبروجكتر"
            >
              {isAutoRotate ? <Pause size={14} /> : <Play size={14} />}
              <span>{isAutoRotate ? 'إيقاف الدوران' : 'دوران تلقائي'}</span>
            </button>

            {/* Fullscreen Button */}
            <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide 0: Stations & Upcoming Call Queue */}
      {activeSlide === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

          {/* Up Next Call List */}
          <div className="clean-card">
            <div className="card-header">
              <div className="card-title">
                <Volume2 size={20} color="var(--trophy-gold)" />
                <span>نداء المباريات القادمة للاستعداد في صالة التلفزيون (Up Next)</span>
              </div>
              <span className="badge badge-gold">تنبيه فوري</span>
            </div>

            {upcomingMatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
                لا توجد مباريات مجدولة تالية حالياً.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {upcomingMatches.map(m => {
                  const p1 = participantsMap[m.player1Id];
                  const p2 = participantsMap[m.player2Id];
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
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
        </div>
      )}

      {/* Slide 1: Groups Standings */}
      {activeSlide === 1 && (
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

      {/* Slide 2: Top Scorers */}
      {activeSlide === 2 && (
        <div className="clean-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-header">
            <div className="card-title">
              <Award size={22} color="var(--trophy-gold)" />
              <span>قائمة هدافي البطولة (الحذاء الذهبي)</span>
            </div>
            <span className="badge badge-gold">أفضل الهدافين</span>
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

      {/* Live Announcement Ticker at Bottom */}
      <div style={{ marginTop: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <Bell size={18} color="var(--ksu-green)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ksu-green)', whiteSpace: 'nowrap' }}>إعلان الصالة:</span>
          {isEditingNotice ? (
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
      </div>
    </div>
  );
}
