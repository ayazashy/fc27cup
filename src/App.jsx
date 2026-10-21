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
  Share2,
  RefreshCw,
  Lock
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
  getStoredAdminRole,
  storeAdminRole,
  clearAdminRole,
  verifyAndDecodeKey, 
  ADMIN_ROUTE_PATH,
  getAdminNavigationUrl,
  getPublicNavigationUrl
} from './utils/securityGate';

const STORAGE_KEY = 'ksu_fc27_tournament_state_v1';
const PUBLIC_REFRESH_INTERVAL_SECS = 120; // 2 minutes rate limit
const STORAGE_NEXT_REFRESH_KEY = 'fc27_public_next_refresh_at';
const STORAGE_LAST_REFRESH_KEY = 'fc27_public_last_refresh_at';

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
  // Admin-configurable fixed start time per day (HH:MM in 24h format)
  dayStartTimes: {
    1: '18:00',
    2: '18:00',
    3: '18:00',
    knockout: '17:00'
  },
  // Break intervals per day: [{from:"HH:MM", to:"HH:MM"}]
  dayBreaks: {
    1: [],
    2: [],
    3: [],
    knockout: []
  },
  activeDayOverride: null, // null = auto by current date, or 1, 2, etc.
  minMatchDuration: 10,
  maxMatchDuration: 15,
  forfeitScoreWinner: 3,
  forfeitScoreLoser: 0,
  coordinatorPinHash: 'e60d420bdb50f4a29ee9489a96a3aa94bfa4b37c0c52a822564abb3a2213564b'
};

// Helper: Read tournament cache synchronously from localStorage on initial load
function getInitialTournamentData() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        const loadedConfig = (parsed.config && typeof parsed.config === 'object')
          ? { ...DEFAULT_CONFIG, ...parsed.config }
          : DEFAULT_CONFIG;
        delete loadedConfig.coordinatorPin;
        return {
          participants: Array.isArray(parsed.participants) ? parsed.participants : [],
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          matches: Array.isArray(parsed.matches) ? parsed.matches : [],
          config: loadedConfig
        };
      }
    }
  } catch (e) {
    console.warn('Initial localStorage tournament cache read error:', e);
  }
  return {
    participants: [],
    groups: [],
    matches: [],
    config: DEFAULT_CONFIG
  };
}

// Helper: Read remaining countdown seconds synchronously from localStorage
function getInitialTimerRemaining() {
  try {
    const storedNext = localStorage.getItem(STORAGE_NEXT_REFRESH_KEY);
    if (storedNext) {
      const nextTime = Number(storedNext);
      if (!isNaN(nextTime)) {
        const remaining = Math.ceil((nextTime - Date.now()) / 1000);
        if (remaining > 0 && remaining <= PUBLIC_REFRESH_INTERVAL_SECS) {
          return remaining;
        }
      }
    }
  } catch (e) {}
  return PUBLIC_REFRESH_INTERVAL_SECS;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('participants');

  // Synchronous lazy state initialization from localStorage (prevents empty array wipe on reload)
  const initialTournamentData = React.useMemo(() => getInitialTournamentData(), []);
  const [participants, setParticipants] = useState(() => initialTournamentData.participants);
  const [groups, setGroups] = useState(() => initialTournamentData.groups);
  const [matches, setMatches] = useState(() => initialTournamentData.matches);
  const [config, setConfig] = useState(() => initialTournamentData.config);

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
  const [userRole, setUserRole] = useState(() => getStoredAdminRole() || 'master_admin');
  const [adminSecretCode, setAdminSecretCode] = useState(null);
  const [isCheckingStoredKey, setIsCheckingStoredKey] = useState(true);

  // Public Rate Limit Timer & Share state (persisted across reloads)
  const [publicTimerSeconds, setPublicTimerSeconds] = useState(getInitialTimerRemaining);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Initial Load: Check stored key, handle rate-limited public sync vs admin subscription
  useEffect(() => {
    // Check if key is already saved in localStorage and can decode successfully
    const checkStoredKey = async () => {
      try {
        const stored = getStoredAdminKey();
        if (stored) {
          const result = await verifyAndDecodeKey(stored, config);
          if (result.success && result.payload) {
            setIsUnlocked(true);
            const role = result.role || getStoredAdminRole() || 'master_admin';
            setUserRole(role);
            if (role === 'coordinator') {
              setActiveTab('matches');
            }
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

    // If accessed via path /KSUHTSTAFF, normalize immediately to query ?KSUHTSTAFF
    // to preserve /fc27cup/ base directory on GitHub Pages and localhost
    if (window.location.pathname.toUpperCase().includes('KSUHTSTAFF')) {
      window.history.replaceState({}, '', getAdminNavigationUrl());
    }

    let unsubscribe = null;

    if (isAdminRoute) {
      // ADMIN ROUTE: Live realtime Firestore subscription
      unsubscribe = subscribeToTournament(
        (data) => {
          if (data) {
            if (Array.isArray(data.participants)) setParticipants(data.participants);
            if (Array.isArray(data.groups)) setGroups(data.groups);
            if (Array.isArray(data.matches)) setMatches(data.matches);
            if (data.config && typeof data.config === 'object') setConfig(data.config);
            setFirestoreStatus({ connected: true, error: null });
          }
          setIsInitialLoading(false);
        },
        (err) => {
          setFirestoreStatus({ connected: false, error: err?.message || 'Firestore connection issue' });
          setIsInitialLoading(false);
        }
      );
    } else {
      // PUBLIC ROUTE: Rate-limited reads using 2-minute cooldown in localStorage
      const now = Date.now();
      const storedNext = localStorage.getItem(STORAGE_NEXT_REFRESH_KEY);
      const nextTime = storedNext ? Number(storedNext) : 0;
      const isExpired = !storedNext || isNaN(nextTime) || now >= nextTime;

      const performPublicFetch = async () => {
        try {
          const data = await loadTournamentFromFirestore();
          if (data) {
            if (Array.isArray(data.participants)) setParticipants(data.participants);
            if (Array.isArray(data.groups)) setGroups(data.groups);
            if (Array.isArray(data.matches)) setMatches(data.matches);
            if (data.config && typeof data.config === 'object') setConfig(data.config);
            setFirestoreStatus({ connected: true, error: null });
          }
        } catch (err) {
          console.warn('Initial public fetch error:', err);
        } finally {
          setIsInitialLoading(false);
        }
      };

      if (isExpired) {
        // Cooldown expired or first visit: fetch fresh data & reset 2-minute cycle
        performPublicFetch();
        const newNext = now + (PUBLIC_REFRESH_INTERVAL_SECS * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(now));
        setPublicTimerSeconds(PUBLIC_REFRESH_INTERVAL_SECS);
      } else {
        // Within cooldown: DO NOT make a network request! Instant render from local cache
        setIsInitialLoading(false);
        const remainingSecs = Math.max(1, Math.ceil((nextTime - now) / 1000));
        setPublicTimerSeconds(remainingSecs);
      }
    }

    // Fallback timer so loading overlay doesn't hang if offline
    const initialLoadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      if (typeof unsubscribe === 'function') unsubscribe();
      clearTimeout(initialLoadingTimer);
    };
  }, [isAdminRoute]);

  // Public 2-minute Countdown Interval with Auto-Refresh & LocalStorage Tracking
  useEffect(() => {
    if (isAdminRoute) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const storedNext = localStorage.getItem(STORAGE_NEXT_REFRESH_KEY);
      let nextTime = storedNext ? Number(storedNext) : 0;

      // Initialize next refresh timestamp if not present
      if (!nextTime || isNaN(nextTime)) {
        nextTime = now + (PUBLIC_REFRESH_INTERVAL_SECS * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(nextTime));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(now));
      }

      const remaining = Math.ceil((nextTime - now) / 1000);

      if (remaining <= 0) {
        // Timer reached 0! Advance 2-minute cycle and trigger background update
        const newNext = Date.now() + (PUBLIC_REFRESH_INTERVAL_SECS * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(Date.now()));
        setPublicTimerSeconds(PUBLIC_REFRESH_INTERVAL_SECS);
        handleRefreshData(true); // silent auto-refresh
      } else {
        setPublicTimerSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAdminRoute]);

  // 2. Persist to local storage on changes (guarded against empty overwrite on initial mount)
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
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

  // Navigation Handlers (Preserves base path & repository name)
  const handleNavigateToAdmin = () => {
    window.history.pushState({}, '', getAdminNavigationUrl());
    setIsAdminRoute(true);
  };

  const handleNavigateToPublic = () => {
    window.history.pushState({}, '', getPublicNavigationUrl());
    setIsAdminRoute(false);
  };

  const handleLockDashboard = () => {
    clearAdminKey();
    clearAdminRole();
    setIsUnlocked(false);
    setUserRole('master_admin');
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

  const handleRefreshData = async (isSilent = false) => {
    setIsSyncing(true);
    setSyncMessage('جاري تنزيل أحدث بيانات البطولة...');
    try {
      const data = await loadTournamentFromFirestore();
      if (data) {
        if (Array.isArray(data.participants)) setParticipants(data.participants);
        if (Array.isArray(data.groups)) setGroups(data.groups);
        if (Array.isArray(data.matches)) setMatches(data.matches);
        if (data.config && typeof data.config === 'object') setConfig(data.config);
        setFirestoreStatus({ connected: true, error: null });
        if (!isSilent) {
          showNotification('تم تحديث البيانات بنجاح! ⚡', 'success');
        }
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 450);
    }
  };

  const formatTimerSecs = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePublicRefreshClick = () => {
    if (publicTimerSeconds > 0) {
      showNotification(`التحديث التلقائي يعمل كل دقيقتين (المتبقي: ${formatTimerSecs(publicTimerSeconds)})`, 'info');
      return;
    }
    const newNext = Date.now() + (PUBLIC_REFRESH_INTERVAL_SECS * 1000);
    localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
    localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(Date.now()));
    setPublicTimerSeconds(PUBLIC_REFRESH_INTERVAL_SECS);
    handleRefreshData(false);
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

  // 6. IF NOT ON ADMIN ROUTE (/KSUHTSTAFF): Render dedicated student spectator portal with single unified header
  if (!isAdminRoute) {
    return (
      <div className="app-layout" style={{ background: '#F8FAFC' }}>
        {/* Single Unified Public Header */}
        <header className="public-header" style={{
          background: '#FFFFFF',
          borderBottom: '1px solid var(--border-light)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src={logoUrl} 
              alt="شعار كأس السكن FC27" 
              style={{ height: '42px', width: 'auto', objectFit: 'contain' }} 
            />
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ksu-green)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={18} style={{ color: 'var(--trophy-gold)' }} />
                كأس السكن: FC27
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                سكن الطلاب — جامعة الملك سعود
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* 2-Minute Rate-Limited Update Timer Button */}
            <button
              className="btn btn-secondary btn-sm public-refresh-btn"
              onClick={handlePublicRefreshClick}
              disabled={isSyncing}
              title={`تحديث تلقائي كل دقيقتين (المتبقي: ${formatTimerSecs(publicTimerSeconds)})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '0.8rem',
                borderColor: publicTimerSeconds <= 10 ? '#10B981' : 'var(--border-light)',
                background: publicTimerSeconds <= 10 ? '#ECFDF5' : '#FFFFFF',
                color: publicTimerSeconds <= 10 ? '#065F46' : 'var(--text-main)',
                transition: 'all 0.2s ease'
              }}
            >
              <RefreshCw 
                size={14} 
                style={{ 
                  animation: isSyncing ? 'spinOverlayRing 0.8s linear infinite' : 'none',
                  color: isSyncing ? 'var(--ksu-green)' : 'currentColor'
                }} 
              />
              {isSyncing ? (
                <span>جاري التحديث...</span>
              ) : (
                <span>تحديث بعد {formatTimerSecs(publicTimerSeconds)}</span>
              )}
            </button>

            {/* Share Public Link */}
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                navigator.clipboard.writeText(url);
                setCopiedShareLink(true);
                setTimeout(() => setCopiedShareLink(false), 2500);
                showNotification('تم نسخ رابط البطولة لمشاركته!', 'success');
              }}
              title="مشاركة رابط البطولة"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copiedShareLink ? <CheckCircle2 size={14} color="#10B981" /> : <Share2 size={14} />}
              <span className="hide-on-mobile">{copiedShareLink ? 'تم النسخ!' : 'مشاركة'}</span>
            </button>

            {/* Admin Entry Button */}
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleNavigateToAdmin}
              style={{ fontWeight: 600, fontSize: '0.78rem' }}
              title="لوحة الإدارة للمنظمين"
            >
              لوحة الإدارة 🔒
            </button>
          </div>
        </header>

        <main className="main-content" style={{ padding: '16px' }}>
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
          message={isInitialLoading && matches.length === 0 ? "جاري تنزيل بيانات البطولة..." : syncMessage}
          subtext=""
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
        config={config}
        onUnlockSuccess={(payload, key, role) => {
          setIsUnlocked(true);
          setUserRole(role);
          setAdminSecretCode(payload.secretCode);
          if (role === 'coordinator') {
            setActiveTab('matches');
            showNotification('مرحباً بك في بوابة منظم الصالة والمباريات! 🎮', 'success');
          } else {
            showNotification('تم فك تشفير لوحة الإدارة والتحقق بنجاح! 🔓', 'success');
          }
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

      {/* Top Bar for Coordinators (Header completely removed as requested) vs Full Header for Master Admin */}
      {userRole === 'coordinator' ? (
        <header style={{
          background: '#FFFFFF',
          borderBottom: '1px solid var(--border-light)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logoUrl} alt="شعار البطولة" style={{ height: '36px', width: 'auto' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--ksu-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎮 بوابة منظم الصالة والمباريات</span>
                <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>منظم معتمد</span>
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                كأس السكن: FC27 • إدارة الطوابير، رصد النتائج، وشجرة الإقصائيات
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gray numeric" style={{ fontSize: '0.75rem' }}>
              {completedMatchesCount} / {matches.length} منتهية
            </span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleLockDashboard}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Lock size={13} />
              <span>قفل اللوحة</span>
            </button>
          </div>
        </header>
      ) : (
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
      )}

      {/* Modern Navigation Tabs (Restricted for Coordinator, Full for Master Admin) */}
      <nav className="nav-tabs">
        <div className="tabs-container">
          {userRole !== 'coordinator' && (
            <>
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
            </>
          )}

          <button 
            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Calendar size={18} />
            <span>إدارة المباريات والصالة</span>
          </button>

          {userRole !== 'coordinator' && (
            <button 
              className={`tab-btn ${activeTab === 'days' ? 'active' : ''}`}
              onClick={() => setActiveTab('days')}
            >
              <CalendarDays size={18} />
              <span>جدول الأيام</span>
            </button>
          )}

          <button 
            className={`tab-btn ${activeTab === 'knockout' ? 'active' : ''}`}
            onClick={() => setActiveTab('knockout')}
          >
            <Trophy size={18} />
            <span>أدوار خروج المغلوب</span>
          </button>

          {userRole !== 'coordinator' && (
            <button 
              className={`tab-btn ${activeTab === 'tv' ? 'active' : ''}`}
              onClick={() => setActiveTab('tv')}
            >
              <Tv size={18} />
              <span>شاشة الصالة</span>
            </button>
          )}

          <button 
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={18} />
            <span>الإحصائيات والجوائز</span>
          </button>

          {userRole !== 'coordinator' && (
            <button 
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} />
              <span>إعدادات البطولة</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Tab Content */}
      <main className="main-content">
        {userRole !== 'coordinator' && activeTab === 'participants' && (
          <ParticipantsTab
            participants={participants}
            setParticipants={setParticipants}
            onNotify={showNotification}
          />
        )}

        {userRole !== 'coordinator' && activeTab === 'groups' && (
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

        {userRole !== 'coordinator' && activeTab === 'days' && (
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
            setConfig={setConfig}
            onNotify={showNotification}
            onAtomicMatchUpdate={handleAtomicMatchUpdate}
          />
        )}

        {userRole !== 'coordinator' && activeTab === 'tv' && (
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

        {userRole !== 'coordinator' && activeTab === 'settings' && (
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
        subtext=""
      />
    </div>
  );
}
