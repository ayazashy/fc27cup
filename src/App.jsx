import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ParticipantsTab from './components/ParticipantsTab';
import GroupsTab from './components/GroupsTab';
import MatchesTab from './components/MatchesTab';
import KnockoutTab from './components/KnockoutTab';
import TvDisplayTab from './components/TvDisplayTab';
import StatisticsTab from './components/StatisticsTab';
import SettingsTab from './components/SettingsTab';
import ScheduleDaysTab from './components/ScheduleDaysTab';
import { 
  Users, 
  Shuffle, 
  Calendar, 
  CalendarDays, 
  Trophy, 
  Tv, 
  BarChart3,
  Settings, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Share2
} from 'lucide-react';
import { 
  saveTournamentToFirestore, 
  loadTournamentFromFirestore, 
  subscribeToTournament,
  atomicUpdateTournamentInFirestore,
  atomicUpdateMatchesInFirestore
} from './firebase';
import AdminLockScreen from './components/AdminLockScreen';
import SyncLoadingOverlay from './components/SyncLoadingOverlay';
import logoUrl from './utils/logo';
import { 
  isKsuStaffRoute, 
  getStoredAdminKey, 
  clearAdminKey, 
  verifyAndDecodeKey, 
  ADMIN_ROUTE_PATH 
} from './utils/securityGate';

const STORAGE_KEY = 'ksu_fc27_tournament_state_v1';

const todayIso = new Date().toISOString().slice(0, 10);
const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dayAfterIso = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);

const DEFAULT_CONFIG = {
  playersPerGroup: 4,
  qualifiersPerGroup: 2,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  consolesCount: 5,
  tournamentDays: 2,
  dayDates: {
    1: todayIso,
    2: tomorrowIso,
    3: dayAfterIso,
    knockout: tomorrowIso
  },
  activeDayOverride: null, // null = auto by current date, or 1, 2, etc.
  minMatchDuration: 10,
  maxMatchDuration: 15,
  forfeitScoreWinner: 3,
  forfeitScoreLoser: 0
};

export default function App() {
  const [activeTab, setActiveTab] = useState('participants');
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [matches, setMatches] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [firestoreStatus, setFirestoreStatus] = useState({ connected: false, error: null });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Multi-Admin Concurrency & Loading Overlay State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('جاري مزامنة وتحديث البيانات سحابياً...');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Route & Security Gate State
  const [isAdminRoute, setIsAdminRoute] = useState(isKsuStaffRoute());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminSecretCode, setAdminSecretCode] = useState(null);
  const [isCheckingStoredKey, setIsCheckingStoredKey] = useState(true);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Initial Load: Check stored key, load local cache, and subscribe to Firestore
  useEffect(() => {
    // Check if key is already saved in localStorage and can decode successfully
    const checkStoredKey = async () => {
      try {
        const stored = getStoredAdminKey();
        if (stored) {
          const result = await verifyAndDecodeKey(stored);
          if (result.success && result.payload) {
            setIsUnlocked(true);
            setAdminSecretCode(result.payload.secretCode);
          }
        }
      } catch (err) {
        console.warn('Auto-unlock error:', err);
      } finally {
        setIsCheckingStoredKey(false);
      }
    };
    checkStoredKey();

    // Listen to URL navigation (back/forward or pushState)
    const handleLocationChange = () => {
      setIsAdminRoute(isKsuStaffRoute());
    };
    window.addEventListener('popstate', handleLocationChange);

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.participants) setParticipants(parsed.participants);
        if (parsed.groups) setGroups(parsed.groups);
        if (parsed.matches) setMatches(parsed.matches);
        if (parsed.config) setConfig(parsed.config);
      }
    } catch (e) {
      console.warn('Local cache read error:', e);
    }

    // Subscribe to Firestore updates
    const unsubscribe = subscribeToTournament(
      (data) => {
        if (data) {
          if (data.participants) setParticipants(data.participants);
          if (data.groups) setGroups(data.groups);
          if (data.matches) setMatches(data.matches);
          if (data.config) setConfig(data.config);
          setFirestoreStatus({ connected: true, error: null });
        }
        setIsInitialLoading(false);
      },
      (err) => {
        setFirestoreStatus({ connected: false, error: err?.message || 'Firestore connection issue' });
        setIsInitialLoading(false);
      }
    );

    // Fallback timer so loading overlay doesn't hang if offline
    const initialLoadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 2. Persist to local storage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        participants,
        groups,
        matches,
        config
      }));
    } catch (e) {
      console.warn('Local cache save error:', e);
    }
  }, [participants, groups, matches, config]);

  // Navigation Handlers
  const handleNavigateToAdmin = () => {
    window.history.pushState({}, '', ADMIN_ROUTE_PATH);
    setIsAdminRoute(true);
  };

  const handleNavigateToPublic = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
  };

  const handleLockDashboard = () => {
    clearAdminKey();
    setIsUnlocked(false);
    setAdminSecretCode(null);
    showNotification('تم قفل لوحة الإدارة بنجاح 🔒', 'info');
  };

  // 3. Multi-Admin Concurrency-Safe Atomic Match Update (Prevents race conditions)
  const handleAtomicMatchUpdate = async (updatedMatchesOrList, actionMessage = 'جاري مزامنة وحفظ التعديل سحابياً...') => {
    setIsSyncing(true);
    setSyncMessage(actionMessage);

    try {
      let changedList = updatedMatchesOrList;
      if (Array.isArray(updatedMatchesOrList) && updatedMatchesOrList.length === matches.length) {
        const diffs = updatedMatchesOrList.filter(m => {
          const old = matches.find(om => om.id === m.id);
          return !old || JSON.stringify(old) !== JSON.stringify(m);
        });
        if (diffs.length > 0) {
          changedList = diffs;
        }
      }

      const res = await atomicUpdateMatchesInFirestore(changedList, adminSecretCode);
      if (res.success) {
        setFirestoreStatus({ connected: true, error: null });
      } else {
        console.warn('Atomic sync warning:', res.error);
      }
    } catch (err) {
      console.error('Atomic match update exception:', err);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 400);
    }
  };

  const handleAtomicTournamentUpdate = async (patchOrFn, actionMessage = 'جاري مزامنة وتأمين حفظ البيانات...') => {
    setIsSyncing(true);
    setSyncMessage(actionMessage);
    try {
      const res = await atomicUpdateTournamentInFirestore(patchOrFn, adminSecretCode);
      if (res.success) {
        setFirestoreStatus({ connected: true, error: null });
      }
    } catch (err) {
      console.error('Atomic tournament update error:', err);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 400);
    }
  };

  const handleRefreshData = async () => {
    setIsSyncing(true);
    setSyncMessage('جاري تنزيل أحدث بيانات البطولة من السحابة...');
    try {
      const data = await loadTournamentFromFirestore();
      if (data) {
        if (data.participants) setParticipants(data.participants);
        if (data.groups) setGroups(data.groups);
        if (data.matches) setMatches(data.matches);
        if (data.config) setConfig(data.config);
        setFirestoreStatus({ connected: true, error: null });
        showNotification('تم تحديث وتحميل أحدث البيانات من السحابة بنجاح! ⚡', 'success');
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // 4. Save to Firebase Firestore
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setIsSyncing(true);
    setSyncMessage('جاري مزامنة وحفظ جميع بيانات البطولة في Google Firestore...');
    const result = await saveTournamentToFirestore({
      name: 'كأس السكن: FC27',
      participants,
      groups,
      matches,
      config
    }, adminSecretCode);
    setIsSaving(false);
    setTimeout(() => setIsSyncing(false), 450);

    if (result.success) {
      setFirestoreStatus({ connected: true, error: null });
      showNotification('تمت مزامنة وحفظ جميع بيانات البطولة في Google Firestore بنجاح! ☁️', 'success');
    } else {
      showNotification(`تعذر الاتصال بالسحابة (${result.error}). البيانات محفوظة محلياً.`, 'error');
    }
  };

  // 4. Export JSON Backup File
  const handleExportBackup = () => {
    const backupData = {
      name: 'كأس السكن: FC27',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      participants,
      groups,
      matches,
      config
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_بطولة_FC27_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('تم تنزيل النسخة الاحتياطية بنجاح!', 'success');
  };

  // 5. Import JSON Backup File
  const handleImportBackup = (importedData) => {
    if (!importedData || (!importedData.participants && !importedData.groups)) {
      showNotification('ملف النسخة الاحتياطية غير صالح', 'error');
      return;
    }
    if (importedData.participants) setParticipants(importedData.participants);
    if (importedData.groups) setGroups(importedData.groups);
    if (importedData.matches) setMatches(importedData.matches);
    if (importedData.config) setConfig(importedData.config);
    showNotification('تم استرجاع بيانات النسخة الاحتياطية بنجاح!', 'success');
  };

  const completedMatchesCount = matches.filter(m => m.status === 'completed' || m.status === 'walkover').length;

  // 6. IF NOT ON ADMIN ROUTE (/KSUHTSTAFF): Render dedicated student spectator portal
  if (!isAdminRoute) {
    return (
      <div className="app-layout" style={{ background: '#F8FAFC' }}>
        {/* Public Top Bar */}
        <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-light)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={logoUrl} alt="شعار كأس السكن FC27" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ksu-green)' }}>
                بوابة متابعة مباريات كأس السكن FC27 — سكن طلاب KSU
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                بث مباشر لجداول الصالة والأجهزة والنتائج المحدثة لحظياً
              </p>
            </div>
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleNavigateToAdmin}
            style={{ fontWeight: 700 }}
          >
            لوحة الإدارة والتحكم (/KSUHTSTAFF)
          </button>
        </header>

        <main className="main-content" style={{ padding: '20px' }}>
          <TvDisplayTab
            matches={matches}
            groups={groups}
            participants={participants}
            config={config}
            isPublicMode={true}
            onNotify={showNotification}
            onRefreshData={handleRefreshData}
            isLoading={isSyncing || (isInitialLoading && matches.length === 0)}
          />
        </main>

        {/* Public Circular Loading Overlay with Competition Logo */}
        <SyncLoadingOverlay 
          show={isSyncing || (isInitialLoading && matches.length === 0)}
          message={isInitialLoading && matches.length === 0 ? "جاري تنزيل وتحميل بيانات البث المباشر..." : syncMessage}
          subtext="بث حي ومباشر — كأس السكن FC27 | جامعة الملك سعود"
        />
      </div>
    );
  }

  // 7. ADMIN ROUTE (/KSUHTSTAFF): If still checking stored key, show loading splash
  if (isCheckingStoredKey) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#FFFFFF'
      }}>
        <img src={logoUrl} alt="شعار البطولة" style={{ height: '72px', marginBottom: '16px' }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #38BDF8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          <span>جاري التحقق من مفتاح فك التشفير...</span>
        </div>
      </div>
    );
  }

  // 8. ADMIN ROUTE (/KSUHTSTAFF): If not yet unlocked with correct key, render Locked Screen with single password box & logo
  if (!isUnlocked) {
    return (
      <AdminLockScreen
        onUnlockSuccess={(payload, key) => {
          setIsUnlocked(true);
          setAdminSecretCode(payload.secretCode);
          showNotification('تم فك تشفير لوحة الإدارة والتحقق بنجاح! 🔓', 'success');
        }}
        onGoToPublic={handleNavigateToPublic}
      />
    );
  }

  // 9. ADMIN MODE (Unlocked & Decoded)
  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 9999,
          background: notification.type === 'error' ? '#DC2626' : (notification.type === 'success' ? '#047857' : '#1E293B'),
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Header with Logo, Backup, Live Sync, Public Switch & Lock Button */}
      <Header
        participantsCount={participants.length}
        groupsCount={groups.length}
        completedMatchesCount={completedMatchesCount}
        totalMatchesCount={matches.length}
        firestoreStatus={firestoreStatus}
        onSaveToCloud={handleSaveToCloud}
        isSaving={isSaving}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onViewPublic={handleNavigateToPublic}
        onLockDashboard={handleLockDashboard}
      />

      {/* Modern Navigation Tabs */}
      <nav className="nav-tabs">
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            <Users size={18} />
            <span>المشاركون والاستيراد</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <Shuffle size={18} />
            <span>القرعة والمجموعات</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Calendar size={18} />
            <span>إدارة المباريات والصالة</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'days' ? 'active' : ''}`}
            onClick={() => setActiveTab('days')}
          >
            <CalendarDays size={18} />
            <span>جدولة الأيام (X Days)</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'knockout' ? 'active' : ''}`}
            onClick={() => setActiveTab('knockout')}
          >
            <Trophy size={18} />
            <span>أدوار خروج المغلوب</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'tv' ? 'active' : ''}`}
            onClick={() => setActiveTab('tv')}
          >
            <Tv size={18} />
            <span>شاشة صالة التلفزيون</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={18} />
            <span>الإحصائيات والجوائز</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>إعدادات البطولة</span>
          </button>
        </div>
      </nav>

      {/* Main Tab Content */}
      <main className="main-content">
        {activeTab === 'participants' && (
          <ParticipantsTab
            participants={participants}
            setParticipants={setParticipants}
            onNotify={showNotification}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsTab
            groups={groups}
            setGroups={setGroups}
            matches={matches}
            setMatches={setMatches}
            participants={participants}
            config={config}
            onNotify={showNotification}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesTab
            matches={matches}
            setMatches={setMatches}
            participants={participants}
            groups={groups}
            config={config}
            setConfig={setConfig}
            onNotify={showNotification}
            onAtomicMatchUpdate={handleAtomicMatchUpdate}
          />
        )}

        {activeTab === 'days' && (
          <ScheduleDaysTab
            matches={matches}
            setMatches={setMatches}
            participants={participants}
            groups={groups}
            config={config}
            setConfig={setConfig}
            onNotify={showNotification}
          />
        )}

        {activeTab === 'knockout' && (
          <KnockoutTab
            groups={groups}
            matches={matches}
            setMatches={setMatches}
            participants={participants}
            config={config}
            onNotify={showNotification}
            onAtomicMatchUpdate={handleAtomicMatchUpdate}
          />
        )}

        {activeTab === 'tv' && (
          <TvDisplayTab
            matches={matches}
            groups={groups}
            participants={participants}
            config={config}
            isPublicMode={false}
            onNotify={showNotification}
            onRefreshData={handleRefreshData}
            isLoading={isSyncing}
          />
        )}

        {activeTab === 'stats' && (
          <StatisticsTab
            matches={matches}
            participants={participants}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            setConfig={setConfig}
            onSaveConfig={handleSaveToCloud}
            onNotify={showNotification}
          />
        )}
      </main>

      {/* Centered Circular Loading Overlay with Blurred Background & Competition Logo */}
      <SyncLoadingOverlay 
        show={isSyncing}
        message={syncMessage}
        subtext="حماية فورية لمنع تداخل وتعارض تعديلات المشرفين"
      />
    </div>
  );
}
