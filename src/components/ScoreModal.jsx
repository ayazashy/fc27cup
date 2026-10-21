import React, { useState } from 'react';
import { X, Trophy, AlertTriangle, ShieldCheck, Check, Plus, Minus } from 'lucide-react';

export default function ScoreModal({ 
  match, 
  p1, 
  p2, 
  onClose, 
  onSaveScore 
}) {
  // Default scores to 0 if not previously recorded so 0 - 0 is immediately ready & valid
  const [score1, setScore1] = useState(match.score1 !== null && match.score1 !== undefined ? match.score1 : 0);
  const [score2, setScore2] = useState(match.score2 !== null && match.score2 !== undefined ? match.score2 : 0);
  const [penalty1, setPenalty1] = useState(match.penalty1 !== null && match.penalty1 !== undefined ? match.penalty1 : '');
  const [penalty2, setPenalty2] = useState(match.penalty2 !== null && match.penalty2 !== undefined ? match.penalty2 : '');
  const [yellow1, setYellow1] = useState(match.cards1?.yellow ?? 0);
  const [red1, setRed1] = useState(match.cards1?.red ?? 0);
  const [yellow2, setYellow2] = useState(match.cards2?.yellow ?? 0);
  const [red2, setRed2] = useState(match.cards2?.red ?? 0);
  const [isWalkover, setIsWalkover] = useState(match.status === 'walkover');
  const [walkoverWinnerId, setWalkoverWinnerId] = useState(match.walkoverWinnerId ?? (p1?.id || ''));

  // A match is knockout ONLY if it has no groupId and belongs to a knockout round
  const isKnockout = Boolean(!match.groupId && (
    ['r64', 'r32', 'r16', 'qf', 'sf', 'final'].includes(match.stage) || 
    match.id?.startsWith('ko_') || 
    match.stage === 'knockout'
  ));

  const s1 = (score1 === '' || score1 === null || isNaN(Number(score1))) ? 0 : Math.max(0, parseInt(score1, 10));
  const s2 = (score2 === '' || score2 === null || isNaN(Number(score2))) ? 0 : Math.max(0, parseInt(score2, 10));
  const isTied = s1 === s2;

  const handleSave = () => {
    if (isWalkover) {
      if (!walkoverWinnerId) {
        alert('يرجى تحديد نوع الانسحاب');
        return;
      }
      const isDouble = walkoverWinnerId === 'double';
      onSaveScore({
        ...match,
        status: 'walkover',
        isDoubleWalkover: isDouble,
        walkoverWinnerId: isDouble ? 'double' : walkoverWinnerId,
        score1: isDouble ? 0 : (walkoverWinnerId === p1?.id ? 3 : 0),
        score2: isDouble ? 0 : (walkoverWinnerId === p2?.id ? 3 : 0),
        cards1: { yellow: yellow1, red: red1 },
        cards2: { yellow: yellow2, red: red2 },
        penalty1: null,
        penalty2: null,
        winnerId: isDouble ? null : walkoverWinnerId,
        completedAt: new Date().toISOString()
      });
      onClose();
      return;
    }

    // In Knockout stage only, a tie requires penalty resolution to advance the tree
    let winnerId = null;
    let pen1 = null;
    let pen2 = null;

    if (isKnockout) {
      if (s1 > s2) {
        winnerId = p1?.id;
      } else if (s2 > s1) {
        winnerId = p2?.id;
      } else {
        // Tied in knockout -> check penalties
        if (penalty1 === '' || penalty2 === '' || Number(penalty1) === Number(penalty2)) {
          alert('في الأدوار الإقصائية، عند التعادل (مثل 0-0) يجب تحديد الفائز بركلات الترجيح بدون تعادل!');
          return;
        }
        pen1 = Number(penalty1);
        pen2 = Number(penalty2);
        winnerId = pen1 > pen2 ? p1?.id : p2?.id;
      }
    }

    // Group stage: 0-0 or any tie is 100% valid draw without winnerId!
    onSaveScore({
      ...match,
      score1: s1,
      score2: s2,
      penalty1: pen1,
      penalty2: pen2,
      cards1: { yellow: yellow1, red: red1 },
      cards2: { yellow: yellow2, red: red2 },
      status: 'completed',
      winnerId,
      walkoverWinnerId: null,
      completedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} color="var(--ksu-green)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              رصد نتيجة المباراة #{match.matchNumber} {match.groupName ? `— ${match.groupName}` : (match.title ? `— ${match.title}` : '')}
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
                نوع الانسحاب والنتيجة:
              </label>
              <select 
                className="form-select"
                value={walkoverWinnerId}
                onChange={(e) => setWalkoverWinnerId(e.target.value)}
              >
                <option value={p1?.id}>فوز {p1?.name} (3 - 0) بسبب انسحاب {p2?.name}</option>
                <option value={p2?.id}>فوز {p2?.name} (3 - 0) بسبب انسحاب {p1?.name}</option>
                <option value="double">⚠️ انسحاب كلا الطرفين (0 - 0) — كلاهما يحصل على 0 نقطة</option>
              </select>
              {walkoverWinnerId === 'double' && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#B91C1C', background: '#FEF2F2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #FECACA' }}>
                  تنبيه: سيتم تسجيل النتيجة 0 - 0 مع احتساب هزيمة لكلا اللاعبين و 0 نقطة لكل منهما في ترتيب المجموعة.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Score Input Row */}
              <div className="score-entry-row" style={{ alignItems: 'center' }}>
                {/* Player 1 Box */}
                <div className="score-box" style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{p1?.name || 'مشارك 1'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{p1?.team}</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <button 
                      type="button"
                      className="card-btn"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setScore1(Math.max(0, s1 - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <input 
                      type="number"
                      min="0"
                      max="50"
                      className="score-input numeric"
                      style={{ width: '70px', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800 }}
                      value={score1}
                      onChange={(e) => setScore1(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                    <button 
                      type="button"
                      className="card-btn"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setScore1(s1 + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-dim)', padding: '0 12px' }}>:</div>

                {/* Player 2 Box */}
                <div className="score-box" style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{p2?.name || 'مشارك 2'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{p2?.team}</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <button 
                      type="button"
                      className="card-btn"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setScore2(Math.max(0, s2 - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <input 
                      type="number"
                      min="0"
                      max="50"
                      className="score-input numeric"
                      style={{ width: '70px', textAlign: 'center', fontSize: '1.75rem', fontWeight: 800 }}
                      value={score2}
                      onChange={(e) => setScore2(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                    <button 
                      type="button"
                      className="card-btn"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setScore2(s2 + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div style={{ textAlign: 'center', margin: '4px 0 10px 0' }}>
                {isTied ? (
                  <span className="badge badge-gold" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    {isKnockout ? 'تعادل — يلزم حسم ركلات الترجيح' : 'تعادل (0-0 أو أهداف متساوية) — نقطة لكل لاعب ✓'}
                  </span>
                ) : (
                  <span className="badge badge-green" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    فوز {s1 > s2 ? p1?.name : p2?.name} ({Math.max(s1, s2)} - {Math.min(s1, s2)})
                  </span>
                )}
              </div>

              {/* Penalty Shootout (only if knockout and tied) */}
              {isKnockout && isTied && (
                <div style={{ padding: '12px', background: '#FEF3C7', border: '1.5px solid #FCD34D', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#92400E', marginBottom: '8px', textAlign: 'center' }}>
                    ⚽ نتيجة ركلات الترجيح (حسم التأهل للأدوار الإقصائية)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#78350F' }}>{p1?.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        className="form-input numeric"
                        style={{ width: '65px', textAlign: 'center', marginTop: '4px', fontWeight: 800 }}
                        placeholder="0"
                        value={penalty1}
                        onChange={(e) => setPenalty1(e.target.value)}
                      />
                    </div>
                    <span style={{ fontWeight: 900, color: '#92400E' }}>-</span>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#78350F' }}>{p2?.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        className="form-input numeric"
                        style={{ width: '65px', textAlign: 'center', marginTop: '4px', fontWeight: 800 }}
                        placeholder="0"
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
                        <button type="button" className="card-btn" onClick={() => setYellow1(Math.max(0, yellow1 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{yellow1}</span>
                        <button type="button" className="card-btn" onClick={() => setYellow1(yellow1 + 1)}>+</button>
                      </div>

                      <div className="card-counter" title="كروت حمراء">
                        <span style={{ fontSize: '0.8rem' }}>🟥</span>
                        <button type="button" className="card-btn" onClick={() => setRed1(Math.max(0, red1 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{red1}</span>
                        <button type="button" className="card-btn" onClick={() => setRed1(red1 + 1)}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* P2 Cards */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>{p2?.name}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div className="card-counter" title="كروت صفراء">
                        <span style={{ fontSize: '0.8rem' }}>🟨</span>
                        <button type="button" className="card-btn" onClick={() => setYellow2(Math.max(0, yellow2 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{yellow2}</span>
                        <button type="button" className="card-btn" onClick={() => setYellow2(yellow2 + 1)}>+</button>
                      </div>

                      <div className="card-counter" title="كروت حمراء">
                        <span style={{ fontSize: '0.8rem' }}>🟥</span>
                        <button type="button" className="card-btn" onClick={() => setRed2(Math.max(0, red2 - 1))}>-</button>
                        <span className="numeric" style={{ fontWeight: 700 }}>{red2}</span>
                        <button type="button" className="card-btn" onClick={() => setRed2(red2 + 1)}>+</button>
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
