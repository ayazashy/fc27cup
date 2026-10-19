import React, { useState } from 'react';
import { Users, FileSpreadsheet, Trash2, Search, ExternalLink, UserCheck, UserX, Plus, Printer, Download, X } from 'lucide-react';
import { parseGoogleSheetData, generateSampleKsuParticipants } from '../utils/sheetParser';

export default function ParticipantsTab({ 
  participants, 
  setParticipants,
  onNotify
}) {
  const [pasteText, setPasteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Participant Form State (Strictly useful fields only!)
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    studentId: '',
    phone: '',
    room: '',
    team: 'ريال مدريد',
    experience: 'متوسط'
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
    setNewPlayer({ name: '', studentId: '', phone: '', room: '', team: 'ريال مدريد', experience: 'متوسط' });
    onNotify(`تمت إضافة اللاعب ${created.name} بنجاح!`, 'success');
  };

  const toggleStatus = (id) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'confirmed' ? 'waiting' : 'confirmed';
        return { ...p, status: nextStatus };
      }
      return p;
    }));
  };

  const removeParticipant = (id) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
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
            <span>استيراد المشاركين من Google Sheet</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
              تحميل بيانات تجريبية (32 لاعب)
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              إضافة لاعب يدوياً
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

        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          انسخ الأعمدة والصفوف مباشرة من ملف Google Sheet أو ردود استبانة Google Form والصقها هنا:
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
                  <th>السكن (العمارة والغرفة)</th>
                  <th>النادي المفضل</th>
                  <th>المستوى</th>
                  <th>الحالة</th>
                  <th style={{ textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="numeric" style={{ color: 'var(--text-dim)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
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
                    <td>{p.room}</td>
                    <td>
                      <span className="badge badge-gold">{p.team}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.experience}</td>
                    <td>
                      <button 
                        onClick={() => toggleStatus(p.id)}
                        className={`badge ${p.status === 'confirmed' ? 'badge-green' : 'badge-gray'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="اضغط للتحويل بين مؤكد واحتياط"
                      >
                        {p.status === 'confirmed' ? <UserCheck size={12} /> : <UserX size={12} />}
                        {p.status === 'confirmed' ? 'مؤكد' : 'احتياط'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px' }}
                        onClick={() => removeParticipant(p.id)}
                        title="حذف المشارك"
                      >
                        <Trash2 size={14} />
                      </button>
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
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>إضافة لاعب جديد يدوياً</span>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>السكن (العمارة والغرفة):</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="عمارة 15 - غرفة 204"
                      value={newPlayer.room}
                      onChange={(e) => setNewPlayer({ ...newPlayer, room: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>النادي المفضل:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="ريال مدريد / الهلال..."
                      value={newPlayer.team}
                      onChange={(e) => setNewPlayer({ ...newPlayer, team: e.target.value })}
                    />
                  </div>
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
    </div>
  );
}
