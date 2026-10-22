import React from 'react';
import { Award, Trophy, Shield, HeartHandshake, Flame, BarChart3 } from 'lucide-react';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';

export default function StatisticsTab({ 
  matches, 
  participants 
}) {
  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const completedMatches = matches.filter(m => m.status === 'completed' || m.status === 'walkover');

  // Calculate player aggregated stats
  const playerStats = React.useMemo(() => {
    const stats = {};
    participants.forEach(p => {
      stats[p.id] = {
        player: p,
        played: 0,
        won: 0,
        gf: 0,
        ga: 0,
        yellowCards: 0,
        redCards: 0
      };
    });

    completedMatches.forEach(m => {
      const p1 = stats[m.player1Id];
      const p2 = stats[m.player2Id];
      if (!p1 || !p2) return;

      p1.played += 1;
      p2.played += 1;

      p1.yellowCards += (m.cards1?.yellow || 0);
      p1.redCards += (m.cards1?.red || 0);
      p2.yellowCards += (m.cards2?.yellow || 0);
      p2.redCards += (m.cards2?.red || 0);

      const s1 = Number(m.score1 || 0);
      const s2 = Number(m.score2 || 0);

      p1.gf += s1;
      p1.ga += s2;
      p2.gf += s2;
      p2.ga += s1;

      if (m.status === 'walkover') {
        if (m.walkoverWinnerId === p1.player.id) p1.won += 1;
        else p2.won += 1;
      } else {
        if (s1 > s2) p1.won += 1;
        else if (s2 > s1) p2.won += 1;
      }
    });

    return Object.values(stats);
  }, [participants, completedMatches]);

  // Total Tournament Metrics
  const totalGoals = completedMatches.reduce((acc, m) => acc + Number(m.score1 || 0) + Number(m.score2 || 0), 0);
  const avgGoalsPerMatch = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(1) : '0';
  const totalYellowCards = completedMatches.reduce((acc, m) => acc + (m.cards1?.yellow || 0) + (m.cards2?.yellow || 0), 0);
  const totalRedCards = completedMatches.reduce((acc, m) => acc + (m.cards1?.red || 0) + (m.cards2?.red || 0), 0);

  // Top Scorers
  const topScorers = [...playerStats].filter(p => p.gf > 0).sort((a, b) => b.gf - a.gf).slice(0, 5);

  // Best Defense (Min 2 matches played, sorted by ga ascending)
  const bestDefense = [...playerStats].filter(p => p.played >= 2).sort((a, b) => a.ga - b.ga).slice(0, 5);

  // Fair Play (Lowest card penalty points: Yellow = 1, Red = 3, Min 2 matches)
  const fairPlay = [...playerStats].filter(p => p.played >= 2).sort((a, b) => {
    const penaltyA = (a.yellowCards * 1) + (a.redCards * 3);
    const penaltyB = (b.yellowCards * 1) + (b.redCards * 3);
    return penaltyA - penaltyB;
  }).slice(0, 5);

  return (
    <div className="tab-content">
      {/* Overview Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="clean-card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
          <Flame size={24} color="#EA580C" style={{ margin: '0 auto 8px auto' }} />
          <div className="stat-number numeric" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalGoals}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>إجمالي أهداف البطولة</div>
        </div>

        <div className="clean-card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
          <BarChart3 size={24} color="var(--ksu-green)" style={{ margin: '0 auto 8px auto' }} />
          <div className="stat-number numeric" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
            {avgGoalsPerMatch}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>معدل الأهداف / مباراة</div>
        </div>

        <div className="clean-card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
          <Trophy size={24} color="var(--trophy-gold)" style={{ margin: '0 auto 8px auto' }} />
          <div className="stat-number numeric" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--trophy-gold)' }}>
            {completedMatches.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>المباريات المكتملة</div>
        </div>

        <div className="clean-card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
          <Shield size={24} color="#DC2626" style={{ margin: '0 auto 8px auto' }} />
          <div className="stat-number numeric" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalYellowCards}🟨 / {totalRedCards}🟥
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>البطاقات الملونة</div>
        </div>
      </div>

      {/* 3 Awards Grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* 1. Golden Boot (Top Scorer) */}
        <div className="clean-card">
          <div className="card-header">
            <div className="card-title">
              <Award size={20} color="var(--trophy-gold)" />
              <span>جائزة الحذاء الذهبي (هداف البطولة)</span>
            </div>
            <span className="badge badge-gold">الأعلى تهديفاً</span>
          </div>

          {topScorers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              لا توجد أهداف مسجلة بعد.
            </p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="clean-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>م</th>
                    <th>اللاعب</th>
                    <th>النادي</th>
                    <th style={{ textAlign: 'center', color: 'var(--ksu-green)' }}>الأهداف</th>
                  </tr>
                </thead>
                <tbody>
                  {topScorers.map((st, i) => (
                    <tr key={st.player.id}>
                      <td className="numeric" style={{ fontWeight: 800 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{st.player.name}</td>
                      <td>
                        {(() => {
                          const logo = getTeamLogoUrl(st.player.team);
                          const hasKnown = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {logo && (
                                <img 
                                  src={logo} 
                                  alt={st.player.team || ''} 
                                  title={st.player.team || ''} 
                                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                                  onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                                />
                              )}
                              {(!hasKnown && st.player.team) && (
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{st.player.team}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: 'var(--ksu-green)' }}>
                        {st.gf}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. Best Defense (Golden Glove) */}
        <div className="clean-card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={20} color="var(--ksu-green)" />
              <span>جائزة القفاز الذهبي (أفضل دفاع)</span>
            </div>
            <span className="badge badge-green">الأقل استقبالاً</span>
          </div>

          {bestDefense.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              تظهر بعد لعب مباراتين على الأقل.
            </p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="clean-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>م</th>
                    <th>اللاعب</th>
                    <th>لعب</th>
                    <th style={{ textAlign: 'center', color: '#DC2626' }}>الأهداف المستقبلة</th>
                  </tr>
                </thead>
                <tbody>
                  {bestDefense.map((st, i) => (
                    <tr key={st.player.id}>
                      <td className="numeric" style={{ fontWeight: 800 }}>{i + 1}</td>
                      <td>
                        {(() => {
                          const logo = getTeamLogoUrl(st.player.team);
                          const hasKnown = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {logo && (
                                <img 
                                  src={logo} 
                                  alt={st.player.team || ''} 
                                  title={st.player.team || ''} 
                                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                  onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                                />
                              )}
                              <div>
                                <span style={{ fontWeight: 700 }}>{st.player.name}</span>
                                {(!hasKnown && st.player.team) && (
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>{st.player.team}</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="numeric">{st.played}</td>
                      <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#DC2626' }}>
                        {st.ga}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. Fair Play Award */}
        <div className="clean-card">
          <div className="card-header">
            <div className="card-title">
              <HeartHandshake size={20} color="#2563EB" />
              <span>جائزة الروح الرياضية (اللعب النظيف)</span>
            </div>
            <span className="badge badge-gray">الأقل بطاقات</span>
          </div>

          {fairPlay.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              تظهر بعد لعب مباراتين على الأقل.
            </p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="clean-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>م</th>
                    <th>اللاعب</th>
                    <th>لعب</th>
                    <th style={{ textAlign: 'center' }}>البطاقات</th>
                  </tr>
                </thead>
                <tbody>
                  {fairPlay.map((st, i) => (
                    <tr key={st.player.id}>
                      <td className="numeric" style={{ fontWeight: 800 }}>{i + 1}</td>
                      <td>
                        {(() => {
                          const logo = getTeamLogoUrl(st.player.team);
                          const hasKnown = !!logo && logo !== DEFAULT_UNKNOWN_LOGO;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {logo && (
                                <img 
                                  src={logo} 
                                  alt={st.player.team || ''} 
                                  title={st.player.team || ''} 
                                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                  onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                                />
                              )}
                              <div>
                                <span style={{ fontWeight: 700 }}>{st.player.name}</span>
                                {(!hasKnown && st.player.team) && (
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>{st.player.team}</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="numeric">{st.played}</td>
                      <td className="numeric" style={{ textAlign: 'center' }}>
                        {st.yellowCards}🟨 {st.redCards > 0 ? `${st.redCards}🟥` : ''}
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
