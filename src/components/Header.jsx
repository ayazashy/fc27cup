import React from 'react';
import { Trophy, Users, CheckCircle, Cloud, RefreshCw, Tv, Wifi } from 'lucide-react';

export default function Header({ 
  participantsCount, 
  groupsCount, 
  completedMatchesCount, 
  totalMatchesCount,
  firestoreStatus,
  onSaveToCloud,
  isSaving
}) {
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
              // fallback if logo not found
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="brand-text">
            <h1>
              <Trophy size={22} className="text-trophy" style={{ color: 'var(--trophy-gold)' }} />
              كأس السكن: FC27
            </h1>
            <p>إدارة سكن الطلاب — الأنشطة الطلابية | جامعة الملك سعود</p>
          </div>
        </div>

        {/* Quick Tournament Metrics & Cloud Actions */}
        <div className="header-actions">
          <div className="stat-pill">
            <Users size={16} color="var(--ksu-green)" />
            <span>المسجلون:</span>
            <b>{participantsCount}</b>
          </div>

          <div className="stat-pill">
            <Trophy size={16} color="var(--trophy-gold)" />
            <span>المجموعات:</span>
            <b>{groupsCount}</b>
          </div>

          <div className="stat-pill">
            <CheckCircle size={16} color="#10B981" />
            <span>المباريات:</span>
            <b>{completedMatchesCount} / {totalMatchesCount}</b>
          </div>

          {/* Firestore Status Badge */}
          <div className="stat-pill" title={firestoreStatus.connected ? 'متصل بقاعدة بيانات Firestore السحابية' : 'يعمل بالذاكرة المحلية ومستعد للمزامنة'}>
            <Wifi size={16} color={firestoreStatus.connected ? '#10B981' : '#F59E0B'} />
            <span style={{ fontSize: '0.75rem' }}>
              {firestoreStatus.connected ? 'سحابة Firestore متصلة' : 'تخزين محلي'}
            </span>
          </div>

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
