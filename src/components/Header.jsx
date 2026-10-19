import React from 'react';
import { Trophy, Users, CheckCircle, Cloud, Download, Upload, Wifi, BarChart3 } from 'lucide-react';

export default function Header({ 
  participantsCount, 
  groupsCount, 
  completedMatchesCount, 
  totalMatchesCount,
  firestoreStatus,
  onSaveToCloud,
  isSaving,
  onExportBackup,
  onImportBackup
}) {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          onImportBackup(data);
        } catch (err) {
          alert('خطأ في قراءة ملف النسخة الاحتياطية');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand Section with Official Tournament Logo */}
        <div className="brand-section">
          <img 
            src="/logo.png" 
            alt="شعار بطولة كأس السكن FC27" 
            className="brand-logo" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="brand-text">
            <h1>
              <Trophy size={22} style={{ color: 'var(--trophy-gold)' }} />
              كأس السكن: FC27
            </h1>
            <p>إدارة سكن الطلاب — الأنشطة الطلابية | جامعة الملك سعود</p>
          </div>
        </div>

        {/* Quick Tournament Metrics & Cloud Actions */}
        <div className="header-actions">
          <div className="stat-pill" title="عدد اللاعبين المسجلين">
            <Users size={16} color="var(--ksu-green)" />
            <span>المسجلون:</span>
            <b>{participantsCount}</b>
          </div>

          <div className="stat-pill" title="عدد مجموعات البطولة">
            <Trophy size={16} color="var(--trophy-gold)" />
            <span>المجموعات:</span>
            <b>{groupsCount}</b>
          </div>

          <div className="stat-pill" title="المباريات المكتملة من الإجمالي">
            <CheckCircle size={16} color="#10B981" />
            <span>المباريات:</span>
            <b>{completedMatchesCount} / {totalMatchesCount}</b>
          </div>

          {/* Firestore Status Badge */}
          <div className="stat-pill" title={firestoreStatus.connected ? 'متصل بقاعدة بيانات Firestore السحابية' : (firestoreStatus.error ? `تنبيه السحابة: ${firestoreStatus.error}` : 'تخزين محلي')}>
            <Wifi size={16} color={firestoreStatus.connected ? '#10B981' : '#F59E0B'} />
            <span style={{ fontSize: '0.75rem' }}>
              {firestoreStatus.connected ? 'Firestore متصل' : 'تخزين محلي'}
            </span>
          </div>

          {/* Backup / Export Button */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onExportBackup}
            title="تصدير وتحميل نسخة احتياطية كاملة JSON"
          >
            <Download size={15} />
            نسخة احتياطية
          </button>

          {/* Import Backup File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".json"
            onChange={handleFileChange} 
          />
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="استيراد واسترجاع بيانات سابقة من ملف JSON"
          >
            <Upload size={15} />
            استرجاع
          </button>

          {/* Save to Cloud Button */}
          <button 
            className="btn btn-primary btn-sm" 
            onClick={onSaveToCloud}
            disabled={isSaving}
            title="مزامنة وحفظ فوري لجميع البيانات في Firebase Firestore"
          >
            <Cloud size={16} />
            {isSaving ? 'جاري المزامنة...' : 'مزامنة السحابة'}
          </button>
        </div>
      </div>
    </header>
  );
}
