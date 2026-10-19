import React, { useState } from 'react';
import { X, Trophy, AlertTriangle, ShieldCheck, Check } from 'lucide-react';

export default function ScoreModal({ 
  match, 
  p1, 
  p2, 
  onClose, 
  onSaveScore 
}) {
  const [score1, setScore1] = useState(match.score1 ?? '');
  const [score2, setScore2] = useState(match.score2 ?? '');
  const [penalty1, setPenalty1] = useState(match.penalty1 ?? '');
  const [penalty2, setPenalty2] = useState(match.penalty2 ?? '');
  const [yellow1, setYellow1] = useState(match.cards1?.yellow ?? 0);
  const [red1, setRed1] = useState(match.cards1?.red ?? 0);
  const [yellow2, setYellow2] = useState(match.cards2?.yellow ?? 0);
  const [red2, setRed2] = useState(match.cards2?.red ?? 0);
  const [isWalkover, setIsWalkover] = useState(match.status === 'walkover');
  const [walkoverWinnerId, setWalkoverWinnerId] = useState(match.walkoverWinnerId ?? (p1?.id || ''));

  const handleSave = () => {
    if (isWalkover) {
      if (!walkoverWinnerId) {
        alert('يرجى تحديد اللاعب الفائز بالانسحاب');
        return;
      }
      onSaveScore({
        ...match,
        status: 'walkover',
        walkoverWinnerId,
        score1: walkoverWinnerId === p1?.id ? 3 : 0,
        score2: walkoverWinnerId === p2?.id ? 3 : 0,
        cards1: { yellow: yellow1, red: red1 },
        cards2: { yellow: yellow2, red: red2 },
        penalty1: null,
        penalty2: null,
        completedAt: new Date().toISOString()
      });
      onClose();
      return;
    }

    if (score1 === '' || score2 === '') {
      alert('يرجى إدخال أهداف كلا اللاعبين');
      return;
    }

    const s1 = Number(score1);
    const s2 = Number(score2);

    // If knockout and tied, check penalty
    if (match.stage !== 'group' && s1 === s2) {
      if (penalty1 === '' || penalty2 === '' || Number(penalty1) === Number(penalty2)) {
        alert('في الأدوار الإقصائية، عند التعادل يجب حسم المباراة بركلات الترجيح بدون تعادل!');
        return;
      }
    }

    const winnerId = match.stage !== 'group' ? (
      s1 > s2 ? p1?.id : (s2 > s1 ? p2?.id : (Number(penalty1) > Number(penalty2) ? p1?.id : p2?.id))
    ) : null;

    onSaveScore({
      ...match,
      score1: s1,
      score2: s2,
      penalty1: penalty1 !== '' ? Number(penalty1) : null,
      penalty2: penalty2 !== '' ? Number(penalty2) : null,
      cards1: { yellow: yellow1, red: red1 },
      cards2: { yellow: yellow2, red: red2 },
      status: 'completed',
      winnerId,
      walkoverWinnerId: null,
      completedAt: new Date().toISOString()
    });
    onClose();
  };

  const isKnockoutTied = match.stage !== 'group' && score1 !== '' && score2 !== '' && Number(score1) === Number(score2);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} color="var(--ksu-green)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              رصد نتيجة المباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : ''}
            </span>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Walkover Toggle */}
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#991B1B' }}>
              <input 
                type="checkbox"
                checked={isWalkover}
                onChange={(e) => setIsWalkover(e.target.checked)}
              />
              تسجيل انسحاب / تخلف عن الحضور (3 - 0 تلقائي)
            </label>
          </div>

          {isWalkover ? (
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>
                حدد اللاعب الحاضر (الفائز بنتيجة 3 - 0):
              </label>
              <select 
                className="form-select"
                value={walkoverWinnerId}
                onChange={(e) => setWalkoverWinnerId(e.target.value)}
              >
                <option value={p1?.id}>{p1?.name} ({p1?.team})</option>
                <option value={p2?.id}>{p2?.name} ({p2?.team})</option>
              </select>
            </div>
          ) : (
            <>
              {/* Score Input Row */}
              <div className="score-entry-row">
                {/* Player 1 Box */}
                <div className="score-box">
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{p1?.name || 'مشارك 1'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p1?.team}</div>
                  <input 
                    type="number"
                    min="0"
                    max="50"
                    className="score-input numeric"
                    placeholder="0"
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                  />
                </div>

                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dim)' }}>:</div>

                {/* Player 2 Box */}
                <div className="score-box">
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{p2?.name || 'مشارك 2'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p2?.team}</div>
                  <input 
                    type="number"
                    min="0"
                    max="50"
                    className="score-input numeric"
                    placeholder="0"
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                  />
                </div>
              </div>

              {/* Penalty Shootout (only if knockout and tied) */}
              {isKnockoutTied && (
                <div style={{ padding: '12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400E', marginBottom: '8px', textAlign: 'center' }}>
                    ⚽ نتيجة ركلات الترجيح (لحسم المتأهل)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p1?.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        className="form-input numeric"
                        style={{ width: '60px', textAlign: 'center', marginTop: '4px' }}
                        value={penalty1}
                        onChange={(e) => setPenalty1(e.target.value)}
                      />
                    </div>
                    <span style={{ fontWeight: 800 }}>-</span>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p2?.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        className="form-input numeric"
                        style={{ width: '60px', textAlign: 'center', marginTop: '4px' }}
                        value={penalty2}
                        onChange={(e) => setPenalty2(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Discipline Cards Row */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
                  سجل البطاقات الملونة (اللعب النظيف)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* P1 Cards */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>{p1?.name}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div className="card-counter" title="كروت صفراء">
                        <span style={{ fontSize: '0.8rem' }}>🟨</span>
                        <button className="card-btn" onClick={() => setYellow1(Math.max(0, yellow1 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{yellow1}</span>
                        <button className="card-btn" onClick={() => setYellow1(yellow1 + 1)}>+</button>
                      </div>

                      <div className="card-counter" title="كروت حمراء">
                        <span style={{ fontSize: '0.8rem' }}>🟥</span>
                        <button className="card-btn" onClick={() => setRed1(Math.max(0, red1 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{red1}</span>
                        <button className="card-btn" onClick={() => setRed1(red1 + 1)}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* P2 Cards */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>{p2?.name}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div className="card-counter" title="كروت صفراء">
                        <span style={{ fontSize: '0.8rem' }}>🟨</span>
                        <button className="card-btn" onClick={() => setYellow2(Math.max(0, yellow2 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{yellow2}</span>
                        <button className="card-btn" onClick={() => setYellow2(yellow2 + 1)}>+</button>
                      </div>

                      <div className="card-counter" title="كروت حمراء">
                        <span style={{ fontSize: '0.8rem' }}>🟥</span>
                        <button className="card-btn" onClick={() => setRed2(Math.max(0, red2 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{red2}</span>
                        <button className="card-btn" onClick={() => setRed2(red2 + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} />
            اعتماد وحفظ النتيجة
          </button>
        </div>
      </div>
    </div>
  );
}
