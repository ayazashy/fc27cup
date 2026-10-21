import React, { useState } from 'react';
import { Users, FileSpreadsheet, Trash2, Search, ExternalLink, Plus, Printer, Download, X, Edit2, Shield, Check } from 'lucide-react';
import { parseGoogleSheetData, generateSampleKsuParticipants } from '../utils/sheetParser';
import { POPULAR_TEAMS, getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';

export default function ParticipantsTab({ 
  participants, 
  setParticipants,
  onNotify
}) {
  const [pasteText, setPasteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // New Participant Form State
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    studentId: '',
    phone: '',
    team: 'الهلال'
  });

  const handleParseAndImport = () => {
    if (!pasteText.trim()) {
      onNotify('يرجى لصق بيانات من Google Sheet أولاً', 'error');
      return;
    }
    const parsed = parseGoogleSheetData(pasteText);
    if (parsed.length === 0) {
      onNotify('لم يتم التعرف على أي سجلات صالحة في النص الملصوق', 'error');
      return;
    }
    setParticipants(prev => [...prev, ...parsed]);
    setPasteText('');
    onNotify(`تم بنجاح استيراد ${parsed.length} مشارك من جدول البيانات!`, 'success');
  };

  const handleLoadSample = () => {
    const samples = generateSampleKsuParticipants(32);
    setParticipants(samples);
    onNotify('تم تحميل 32 مشارك تجريبي من سكن طلاب جامعة الملك سعود', 'success');
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع المشاركين المسجلين؟')) {
      setParticipants([]);
      onNotify('تم مسح جميع المشاركين', 'info');
    }
  };

  const handleAddManualPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name.trim()) {
      alert('يرجى إدخال اسم اللاعب');
      return;
    }
    const id = `p_manual_${Date.now()}`;
    let cleanPhone = newPlayer.phone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.substring(1);

    const created = {
      id,
      name: newPlayer.name.trim(),
      studentId: newPlayer.studentId.trim() || `44${Math.floor(1000000 + Math.random() * 9000000)}`,
      phone: cleanPhone || '966500000000',
      displayPhone: newPlayer.phone.trim() || '—',
      room: newPlayer.room.trim() || 'سكن الطلاب',
      team: newPlayer.team.trim() || 'ريال مدريد',
      experience: newPlayer.experience || 'متوسط',
      status: 'confirmed',
      registeredAt: new Date().toISOString()
    };

    setParticipants(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewPlayer({ name: '', studentId: '', phone: '', team: 'ريال مدريد' });
    onNotify(`تمت إضافة اللاعب ${created.name} بنجاح!`, 'success');
  };

  const handleSaveEditPlayer = (e) => {
    e.preventDefault();
    if (!editingPlayer || !editingPlayer.name.trim()) {
      alert('يرجى إدخال اسم اللاعب');
      return;
    }

    let cleanPhone = (editingPlayer.phone || '').replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.substring(1);

    setParticipants(prev => prev.map(p => {
      if (p.id === editingPlayer.id) {
        return {
          ...p,
          name: editingPlayer.name.trim(),
          studentId: editingPlayer.studentId.trim() || p.studentId,
          phone: cleanPhone || p.phone,
          displayPhone: editingPlayer.displayPhone || editingPlayer.phone || p.displayPhone,
          team: editingPlayer.team || p.team
        };
      }
      return p;
    }));

    onNotify(`تم تحديث بيانات اللاعب ${editingPlayer.name} بنجاح!`, 'success');
    setEditingPlayer(null);
  };

  const removeParticipant = (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المشارك؟')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      onNotify('تم حذف المشارك بنجاح', 'info');
    }
  };

  const handleExportCSV = () => {
    if (participants.length === 0) return;
    const headers = ['الرقم', 'الاسم', 'الرقم الجامعي', 'الجوال', 'السكن', 'الفريق', 'الخبرة', 'الحالة'];
    const rows = participants.map((p, i) => [
      i + 1,
      `"${p.name}"`,
      `"${p.studentId}"`,
      `"${p.displayPhone || p.phone}"`,
      `"${p.room}"`,
      `"${p.team}"`,
      `"${p.experience}"`,
      `"${p.status === 'confirmed' ? 'مؤكد' : 'احتياط'}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كأس_السكن_FC27_المشاركون_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredParticipants = participants.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.studentId?.includes(q) ||
      p.room?.toLowerCase().includes(q) ||
      p.team?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="tab-content">
      {/* Smart Sheet Importer Box */}
      <div className="clean-card">
        <div className="card-header">
          <div className="card-title">
            <FileSpreadsheet size={20} color="var(--ksu-green)" />
            <span>قائمة واستيراد المشاركين</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
              بيانات تجريبية
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              إضافة لاعب
            </button>
            {participants.length > 0 && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="تصدير ملف CSV">
                  <Download size={14} />
                  تصدير CSV
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="طباعة كشف الحضور">
                  <Printer size={14} />
                  طباعة الكشف
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
                  <Trash2 size={14} />
                  مسح الكل
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          الصق بيانات المشاركين من Google Sheet أو أضفهم يدوياً:
        </p>

        <textarea
          className="form-textarea"
          placeholder="الصق البيانات المنسوخة هنا (الاسم، الرقم الجامعي، رقم الجوال، العمارة والغرفة، الفريق المفضل...)"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" onClick={handleParseAndImport}>
            <FileSpreadsheet size={18} />
            معالجة واستيراد البيانات
          </button>
        </div>
      </div>

      {/* Participants List & Filter */}
      <div className="clean-card">
        <div className="card-header">
          <div className="card-title">
            <Users size={20} color="var(--ksu-green)" />
            <span>قائمة المشاركين المقبولين ({filteredParticipants.length} من {participants.length})</span>
          </div>

          {/* Search Box - Strictly Useful Filter */}
          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingRight: '36px', fontSize: '0.875rem' }}
              placeholder="بحث بالاسم، الرقم الجامعي، أو الغرفة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          </div>
        </div>

        {filteredParticipants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Users size={48} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
            <p>لا يوجد مشاركون حالياً. يمكنك لصق البيانات أعلاه أو الضغط على زر تحميل بيانات تجريبية.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="clean-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>اسم المشارك</th>
                  <th>الرقم الجامعي</th>
                  <th>الجوال / واتساب</th>
                  <th>النادي المختار</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="numeric" style={{ color: 'var(--text-dim)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 800 }}>{p.name}</td>
                    <td className="numeric">{p.studentId}</td>
                    <td>
                      <a
                        href={`https://wa.me/${p.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="badge badge-green"
                        style={{ textDecoration: 'none' }}
                        title="محادثة واتساب سريعة مع اللاعب"
                      >
                        <ExternalLink size={12} />
                        <span className="numeric">{p.displayPhone || p.phone}</span>
                      </a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={getTeamLogoUrl(p.team)} 
                          alt={p.team} 
                          style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                          onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                        />
                        <span className="badge badge-gray" style={{ fontWeight: 700 }}>{p.team || 'فريق آخر'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', color: 'var(--ksu-green)' }}
                          onClick={() => setEditingPlayer({ ...p })}
                          title="تعديل بيانات المشارك"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          onClick={() => removeParticipant(p.id)}
                          title="حذف المشارك"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Single Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>إضافة لاعب جديد</span>
              <button 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddManualPlayer}>
              <div className="modal-body">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>اسم اللاعب الكامل: *</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    placeholder="مثال: فيصل القحطاني"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>الرقم الجامعي:</label>
                    <input 
                      type="text" 
                      className="form-input numeric" 
                      placeholder="441012345"
                      value={newPlayer.studentId}
                      onChange={(e) => setNewPlayer({ ...newPlayer, studentId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>رقم الجوال:</label>
                    <input 
                      type="text" 
                      className="form-input numeric" 
                      placeholder="0501234567"
                      value={newPlayer.phone}
                      onChange={(e) => setNewPlayer({ ...newPlayer, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>النادي المختار:</label>
                  <select 
                    className="form-select"
                    value={newPlayer.team}
                    onChange={(e) => setNewPlayer({ ...newPlayer, team: e.target.value })}
                  >
                    {POPULAR_TEAMS.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.enName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary">إضافة اللاعب للقائمة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="modal-overlay" onClick={() => setEditingPlayer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--ksu-green)" />
                <span>تعديل بيانات اللاعب</span>
              </span>
              <button 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setEditingPlayer(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditPlayer}>
              <div className="modal-body">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>اسم اللاعب الكامل: *</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    value={editingPlayer.name}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>الرقم الجامعي:</label>
                    <input 
                      type="text" 
                      className="form-input numeric" 
                      value={editingPlayer.studentId}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, studentId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>رقم الجوال:</label>
                    <input 
                      type="text" 
                      className="form-input numeric" 
                      value={editingPlayer.displayPhone || editingPlayer.phone}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, phone: e.target.value, displayPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>النادي المختار:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img 
                      src={getTeamLogoUrl(editingPlayer.team)} 
                      alt={editingPlayer.team} 
                      style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                      onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                    />
                    <select 
                      className="form-select"
                      style={{ flex: 1 }}
                      value={editingPlayer.team}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, team: e.target.value })}
                    >
                      {POPULAR_TEAMS.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.enName})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPlayer(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
