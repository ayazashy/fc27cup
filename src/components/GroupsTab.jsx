import React from 'react';
import { Shuffle, RefreshCw, Trophy, Shield, Printer, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateGroupsAndMatches, calculateGroupStandings } from '../utils/tournamentEngine';

export default function GroupsTab({ 
  groups, 
  setGroups, 
  matches, 
  setMatches, 
  participants, 
  config,
  onNotify
}) {
  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const handlePerformDraw = () => {
    const confirmedPlayers = participants.filter(p => p.status === 'confirmed');
    if (confirmedPlayers.length < 2) {
      onNotify('يجب توفر لاعبين مؤكدين اثنين على الأقل لإجراء القرعة', 'error');
      return;
    }

    if (groups.length > 0) {
      if (!window.confirm('تم إجراء القرعة مسبقاً. هل تود بالتأكيد إعادة توليد المجموعات والمباريات من جديد؟ سيتم مسح أي نتائج سابقة.')) {
        return;
      }
    }

    const { groups: newGroups, matches: newMatches } = generateGroupsAndMatches(participants, config);
    setGroups(newGroups);
    setMatches(newMatches);

    // Fire celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore if confetti fails
    }

    onNotify(`تم بنجاح إجراء القرعة وتوزيع ${confirmedPlayers.length} مشارك على ${newGroups.length} مجموعات!`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tab-content">
      {/* Draw Action Header Bar */}
      <div className="clean-card">
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <div>
            <div className="card-title">
              <Shuffle size={20} color="var(--ksu-green)" />
              <span>قرعة البطولة والمجموعات</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              توزيع عشوائي عادل ومباشر مع حساب لحظي للترتيب وفارق الأهداف والمواجهات المباشرة واللعب النظيف
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handlePerformDraw}>
              <Shuffle size={18} />
              {groups.length === 0 ? 'إجراء القرعة العشوائية' : 'إعادة توزيع القرعة'}
            </button>
            {groups.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                <Printer size={16} />
                طباعة الجداول
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="clean-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Shield size={48} color="var(--border-strong)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            لم يتم إجراء قرعة المجموعات بعد
          </h3>
          <p style={{ maxWidth: '500px', margin: '0 auto 16px auto', fontSize: '0.9rem' }}>
            تأكد من تأكيد حضور المشاركين في تبويب المشاركين، ثم اضغط على زر إجراء القرعة العشوائية ليتم توزيع اللاعبين تلقائياً.
          </p>
          <button className="btn btn-primary" onClick={handlePerformDraw}>
            <Shuffle size={18} />
            إجراء القرعة الآن
          </button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => {
            const standings = calculateGroupStandings(group, matches, participantsMap, config);
            const qualifiersCount = Number(config.qualifiersPerGroup) || 2;

            return (
              <div key={group.id} className="group-card">
                <div className="group-header">
                  <h3>{group.name}</h3>
                  <span className="badge badge-gray">{group.playerIds.length} لاعبين</span>
                </div>

                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="clean-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '28px', textAlign: 'center' }}>م</th>
                        <th>اللاعب</th>
                        <th title="لعب">ل</th>
                        <th title="فوز">ف</th>
                        <th title="تعادل">ت</th>
                        <th title="خسارة">خ</th>
                        <th title="له">له</th>
                        <th title="عليه">عليه</th>
                        <th title="فارق الأهداف">+/-</th>
                        <th title="البطاقات الملونة">🟨/🟥</th>
                        <th title="النقاط" style={{ textAlign: 'center', color: 'var(--ksu-green)' }}>ن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((st, sIdx) => {
                        const isQualified = sIdx < qualifiersCount;
                        return (
                          <tr key={st.playerId} className={isQualified ? 'qualifier-row' : ''}>
                            <td className="numeric" style={{ textAlign: 'center', fontWeight: isQualified ? 800 : 500 }}>
                              {sIdx + 1}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{st.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{st.team}</div>
                            </td>
                            <td className="numeric">{st.played}</td>
                            <td className="numeric">{st.won}</td>
                            <td className="numeric">{st.drawn}</td>
                            <td className="numeric">{st.lost}</td>
                            <td className="numeric">{st.gf}</td>
                            <td className="numeric">{st.ga}</td>
                            <td className="numeric" style={{ fontWeight: 700, color: st.gd > 0 ? '#059669' : (st.gd < 0 ? '#DC2626' : 'inherit') }}>
                              {st.gd > 0 ? `+${st.gd}` : st.gd}
                            </td>
                            <td className="numeric" style={{ fontSize: '0.75rem' }}>
                              {st.yellowCards > 0 && <span style={{ color: '#CA8A04' }}>{st.yellowCards}🟨</span>}
                              {st.redCards > 0 && <span style={{ color: '#DC2626', marginRight: '4px' }}>{st.redCards}🟥</span>}
                              {st.yellowCards === 0 && st.redCards === 0 && '—'}
                            </td>
                            <td className="numeric" style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: 'var(--ksu-green)' }}>
                              {st.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <CheckCircle size={14} color="#10B981" />
                  <span>الصف الأخضر: مقعد التأهل للأدوار الإقصائية (أول {qualifiersCount})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
