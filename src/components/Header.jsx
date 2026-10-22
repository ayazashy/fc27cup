import React from 'react';
import { Trophy, Users, CheckCircle, Cloud, Download, Upload, Wifi, BarChart3, Tv, Lock, Clock } from 'lucide-react';
import logoUrl from '../utils/logo';

export default function Header({ 
  participantsCount, 
  groupsCount, 
  completedMatchesCount, 
  totalMatchesCount,
  firestoreStatus,
  onSaveToCloud,
  isSaving,
  onExportBackup,
  onImportBackup,
  onViewPublic,
  onLockDashboard,
  onOpenAdjustMatch
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
      <div className="header-inner" style={{ flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '14px 20px' }}>
        {/* Brand Section with Official Tournament Logo (Centered & Large) */}
        <div className="brand-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <img 
            src={logoUrl} 
            alt="شعار بطولة كأس السكن FC27" 
            className="brand-logo" 
            style={{ height: '96px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.06))' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Quick Tournament Metrics & Cloud Actions */}
        <div className="header-actions" style={{ justifyContent: 'center', width: '100%' }}>
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

          {/* Adjust Match Schedule Modal Trigger */}
          {onOpenAdjustMatch && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onOpenAdjustMatch}
              title="تعديل موعد ويوم مباراة بالرقم ID"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Clock size={15} color="var(--ksu-green)" />
              <span>تعديل موعد مباراة ⏰</span>
            </button>
          )}

          {/* View Public Portal */}
          {onViewPublic && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onViewPublic}
              title="الانتقال إلى بوابة العرض العامة للمشاهدين"
            >
              <Tv size={15} color="var(--ksu-green)" />
              البوابة العامة
            </button>
          )}

          {/* Lock Dashboard */}
          {onLockDashboard && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onLockDashboard}
              style={{ borderColor: '#FCA5A5', color: '#991B1B' }}
              title="قفل لوحة الإدارة والخروج"
            >
              <Lock size={15} color="#DC2626" />
              قفل الإدارة
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
