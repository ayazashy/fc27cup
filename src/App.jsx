import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from './components/Header';
import ParticipantsTab from './components/ParticipantsTab';
import GroupsTab from './components/GroupsTab';
import MatchesTab from './components/MatchesTab';
import KnockoutTab from './components/KnockoutTab';
import TvDisplayTab from './components/TvDisplayTab';
import StatisticsTab from './components/StatisticsTab';
import SettingsTab from './components/SettingsTab';
import ScheduleDaysTab from './components/ScheduleDaysTab';
import AdminAdjustMatchModal from './components/AdminAdjustMatchModal';
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
import WinningCelebrationModal from './components/WinningCelebrationModal';
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
import { resequenceMatchesQueueOrder } from './utils/tournamentEngine';

const STORAGE_KEY = 'ksu_fc27_tournament_state_v1';
const STORAGE_NEXT_REFRESH_KEY = 'fc27_public_next_refresh_at';
const STORAGE_LAST_REFRESH_KEY = 'fc27_public_last_refresh_at';

// Helper: Calculate public refresh interval in seconds based on admin config
function getPublicRefreshIntervalSecs(cfg) {
  const mins = Math.max(1, Number(cfg?.publicRefreshIntervalMinutes) || 2);
  return mins * 60;
}

// Helper: Human-readable Arabic label for public refresh interval (e.g. دقيقتين، 5 دقائق)
function getPublicRefreshMinutesLabel(cfg) {
  const mins = Math.max(1, Number(cfg?.publicRefreshIntervalMinutes) || 2);
  if (mins === 1) return 'دقيقة واحدة';
  if (mins === 2) return 'دقيقتين';
  if (mins <= 10) return `${mins} دقائق`;
  return `${mins} دقيقة`;
}

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
    1: [{ from: '19:00', to: '19:30' }],
    2: [{ from: '19:00', to: '19:30' }],
    3: [{ from: '19:00', to: '19:30' }],
    knockout: [{ from: '19:00', to: '19:30' }]
  },
  activeDayOverride: null, // null = auto by current date, or 1, 2, etc.
  minMatchDuration: 10,
  maxMatchDuration: 15,
  publicRefreshIntervalMinutes: 2, // Admin-configurable public auto-refresh rate in minutes
  forfeitScoreWinner: 3,
  forfeitScoreLoser: 0,
  coordinatorPinHash: 'e60d420bdb50f4a29ee9489a96a3aa94bfa4b37c0c52a822564abb3a2213564b'
};

// Helper: Ensure break intervals (7:00 PM - 7:30 PM) exist across all tournament days
export function sanitizeConfigWithBreaks(loadedConfig) {
  const merged = { ...DEFAULT_CONFIG, ...(loadedConfig || {}) };
  delete merged.coordinatorPin;
  if (!merged.dayBreaks || typeof merged.dayBreaks !== 'object') {
    merged.dayBreaks = { ...DEFAULT_CONFIG.dayBreaks };
  } else {
    [1, 2, 3, 'knockout'].forEach(k => {
      if (!Array.isArray(merged.dayBreaks[k]) || merged.dayBreaks[k].length === 0) {
        merged.dayBreaks[k] = [{ from: '19:00', to: '19:30' }];
      }
    });
  }
  return merged;
}

// Helper: Read tournament cache synchronously from localStorage on initial load
function getInitialTournamentData() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        const loadedConfig = sanitizeConfigWithBreaks(parsed.config);
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
        if (remaining > 0) {
          return remaining;
        }
      }
    }
  } catch (e) {}
  return 120;
}

/**
 * Resolves match winner and loser celebration package with team logos and scores
 */
export function resolveCelebrationData(match, participantsMap = {}) {
  if (!match) return null;
  const p1 = participantsMap[match.player1Id] || { name: match.player1Placeholder || 'اللاعب 1', team: '—' };
  const p2 = participantsMap[match.player2Id] || { name: match.player2Placeholder || 'اللاعب 2', team: '—' };

  const s1 = match.score1 !== null && match.score1 !== undefined ? Number(match.score1) : null;
  const s2 = match.score2 !== null && match.score2 !== undefined ? Number(match.score2) : null;
  const pen1 = match.penalty1 !== null && match.penalty1 !== undefined ? Number(match.penalty1) : null;
  const pen2 = match.penalty2 !== null && match.penalty2 !== undefined ? Number(match.penalty2) : null;
  const hasPenalties = pen1 !== null && pen2 !== null;
  const isWalkover = match.status === 'walkover';

  let winnerId = match.winnerId || match.walkoverWinnerId;
  if (!winnerId && s1 !== null && s2 !== null) {
    if (s1 > s2) winnerId = match.player1Id;
    else if (s2 > s1) winnerId = match.player2Id;
    else if (hasPenalties) {
      if (pen1 > pen2) winnerId = match.player1Id;
      else if (pen2 > pen1) winnerId = match.player2Id;
    }
  }

  // If there is no winner, celebration is not applicable
  if (!winnerId) return null;

  const isP1Winner = winnerId === match.player1Id;
  const winner = isP1Winner ? p1 : p2;
  const loser = isP1Winner ? p2 : p1;

  const stageTitles = {
    group: 'دور المجموعات',
    r64: 'دور الـ 64',
    r32: 'دور الـ 32',
    r16: 'دور الـ 16',
    qf: 'ربع النهائي',
    sf: 'نصف النهائي',
    final: 'المباراة النهائية 🏆'
  };

  return {
    id: match.id,
    match,
    winner: {
      id: winnerId,
      name: winner.name,
      team: winner.team,
      score: isP1Winner ? s1 : s2,
      penalty: isP1Winner ? pen1 : pen2
    },
    loser: {
      id: isP1Winner ? match.player2Id : match.player1Id,
      name: loser.name,
      team: loser.team,
      score: isP1Winner ? s2 : s1,
      penalty: isP1Winner ? pen2 : pen1
    },
    score1: isP1Winner ? s1 : s2,
    score2: isP1Winner ? s2 : s1,
    penalty1: isP1Winner ? pen1 : pen2,
    penalty2: isP1Winner ? pen2 : pen1,
    hasPenalties,
    isWalkover,
    stageLabel: stageTitles[match.stage] || match.stage || 'مباراة البطولة',
    matchNumber: match.matchNumber,
    consoleId: match.consoleId
  };
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
  // Celebration Queue & Interactive Pop-up State
  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [celebrationIndex, setCelebrationIndex] = useState(0);
  const prevMatchesMapRef = useRef(new Map());
  const isInitialLoadCompletedRef = useRef(false);

  // Main Admin Match Time & Day Adjust Modal State
  const [showAdjustMatchModal, setShowAdjustMatchModal] = useState(false);

  const participantsMap = React.useMemo(() => {
    const map = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const handleLaunchCelebration = (matchOrData) => {
    if (isAdminRoute) return; // Never show celebration pop-up to admin / organizers
    if (!matchOrData) return;
    const cel = matchOrData.winner ? matchOrData : resolveCelebrationData(matchOrData, participantsMap);
    if (cel) {
      setCelebrationQueue([cel]);
      setCelebrationIndex(0);
    } else {
      showNotification('لا توجد نتيجة فوز محددة لهذه المباراة لعرض الاحتفال', 'info');
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Automatic Pop-Up for New Users on First Entry to Website
  const hasTriggeredWelcomeCelebrationRef = useRef(false);
  useEffect(() => {
    // Only trigger for public spectators when initial loading is done and matches are ready
    if (isAdminRoute || isInitialLoading || matches.length === 0 || hasTriggeredWelcomeCelebrationRef.current) return;

    const welcomeKey = 'fc27_welcome_celebration_seen_v2';
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(welcomeKey);
    } catch (e) {}

    if (!alreadySeen) {
      hasTriggeredWelcomeCelebrationRef.current = true;
      try {
        sessionStorage.setItem(welcomeKey, 'true');
      } catch (e) {}

      // Find the most prestigious completed match (Final -> Semifinals -> Latest Knockout -> Latest Group)
      const pMap = participantsMap;
      const finalMatch = matches.find(m => m.stage === 'final' && (m.status === 'completed' || m.status === 'walkover'));
      const sfMatch = matches.find(m => m.stage === 'sf' && (m.status === 'completed' || m.status === 'walkover'));
      const latestCompleted = [...matches].reverse().find(m => 
        (m.status === 'completed' || m.status === 'walkover') && 
        (m.score1 !== m.score2 || m.winnerId || m.penalty1 !== m.penalty2)
      );

      const targetMatch = finalMatch || sfMatch || latestCompleted;
      if (targetMatch) {
        const cel = resolveCelebrationData(targetMatch, pMap);
        if (cel) {
          const timer = setTimeout(() => {
            setCelebrationQueue([cel]);
            setCelebrationIndex(0);
          }, 700);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [isAdminRoute, isInitialLoading, matches, participantsMap]);

  // If switched to admin route, immediately clear any active celebration queue
  useEffect(() => {
    if (isAdminRoute) {
      setCelebrationQueue([]);
    }
  }, [isAdminRoute]);

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
      // ADMIN ROUTE: Live realtime Firestore subscription (Strictly data only, no disruptive popups)
      unsubscribe = subscribeToTournament(
        (data) => {
          if (data) {
            if (Array.isArray(data.participants)) setParticipants(data.participants);
            if (Array.isArray(data.groups)) setGroups(data.groups);
            if (Array.isArray(data.matches)) {
              const map = new Map();
              data.matches.forEach(m => map.set(m.id, { ...m }));
              prevMatchesMapRef.current = map;
              isInitialLoadCompletedRef.current = true;
              setMatches(data.matches);
            }
            if (data.config && typeof data.config === 'object') setConfig(sanitizeConfigWithBreaks(data.config));
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
            if (Array.isArray(data.matches)) {
              // Detect newly completed matches with winners on feed update
              if (isInitialLoadCompletedRef.current && prevMatchesMapRef.current.size > 0) {
                const pMap = {};
                (data.participants || participants).forEach(p => { pMap[p.id] = p; });
                const newWinners = [];
                data.matches.forEach(m => {
                  const isCompletedNow = m.status === 'completed' || m.status === 'walkover';
                  const prev = prevMatchesMapRef.current.get(m.id);
                  const wasCompletedBefore = prev && (prev.status === 'completed' || prev.status === 'walkover');
                  const isScoreChanged = prev && (
                    prev.score1 !== m.score1 || 
                    prev.score2 !== m.score2 || 
                    prev.winnerId !== m.winnerId || 
                    prev.penalty1 !== m.penalty1 || 
                    prev.penalty2 !== m.penalty2 ||
                    prev.status !== m.status
                  );
                  if ((isCompletedNow && !wasCompletedBefore) || (isCompletedNow && wasCompletedBefore && isScoreChanged)) {
                    const cel = resolveCelebrationData(m, pMap);
                    if (cel) newWinners.push(cel);
                  }
                });
                if (newWinners.length > 0) {
                  setCelebrationQueue(newWinners);
                  setCelebrationIndex(0);
                }
              }
              const map = new Map();
              data.matches.forEach(m => map.set(m.id, { ...m }));
              prevMatchesMapRef.current = map;
              isInitialLoadCompletedRef.current = true;
              setMatches(data.matches);
            }
            if (data.config && typeof data.config === 'object') setConfig(sanitizeConfigWithBreaks(data.config));
            setFirestoreStatus({ connected: true, error: null });
          }
        } catch (err) {
          console.warn('Initial public fetch error:', err);
        } finally {
          setIsInitialLoading(false);
        }
      };

      const currentIntervalSecs = getPublicRefreshIntervalSecs(config);

      if (isExpired) {
        // Cooldown expired or first visit: fetch fresh data & reset cycle
        performPublicFetch();
        const newNext = now + (currentIntervalSecs * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(now));
        setPublicTimerSeconds(currentIntervalSecs);
      } else {
        // Within cooldown: DO NOT make a network request! Instant render from local cache
        setIsInitialLoading(false);
        const remainingSecs = Math.max(1, Math.ceil((nextTime - now) / 1000));
        setPublicTimerSeconds(Math.min(remainingSecs, currentIntervalSecs));
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

  // Public Countdown Interval with Auto-Refresh & LocalStorage Tracking
  useEffect(() => {
    if (isAdminRoute) return;

    const intervalSecs = getPublicRefreshIntervalSecs(config);

    const interval = setInterval(() => {
      const now = Date.now();
      const storedNext = localStorage.getItem(STORAGE_NEXT_REFRESH_KEY);
      let nextTime = storedNext ? Number(storedNext) : 0;

      // Initialize next refresh timestamp if not present or if nextTime exceeds current interval
      if (!nextTime || isNaN(nextTime) || (nextTime - now > intervalSecs * 1000)) {
        nextTime = now + (intervalSecs * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(nextTime));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(now));
      }

      const remaining = Math.ceil((nextTime - now) / 1000);

      if (remaining <= 0) {
        // Timer reached 0! Advance cycle and trigger background update
        const newNext = Date.now() + (intervalSecs * 1000);
        localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
        localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(Date.now()));
        setPublicTimerSeconds(intervalSecs);
        handleRefreshData(true); // silent auto-refresh
      } else {
        setPublicTimerSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAdminRoute, config?.publicRefreshIntervalMinutes]);

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

  // Main Admin direct match schedule (time & day) updater
  const handleAdminUpdateMatchSchedule = async (updatedMatch) => {
    // 1. Incorporate updated match into list
    const nextMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    // 2. Resequence orderOnConsole chronologically according to scheduled match times
    const syncedMatches = resequenceMatchesQueueOrder(nextMatches, config);
    setMatches(syncedMatches);

    // 3. Identify all matches that had time, console, day, or orderOnConsole changed
    const changedMatches = syncedMatches.filter(m => {
      const orig = matches.find(old => old.id === m.id);
      if (!orig) return true;
      return orig.customTime !== m.customTime || 
             orig.consoleId !== m.consoleId || 
             orig.dayNumber !== m.dayNumber || 
             orig.orderOnConsole !== m.orderOnConsole;
    });

    await handleAtomicMatchUpdate(
      changedMatches.length > 0 ? changedMatches : [updatedMatch],
      `جاري مزامنة تعديل موعد وترتيب طابور المباراة #${updatedMatch.matchNumber} سحابياً...`
    );
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
        if (Array.isArray(data.matches)) {
          // Detect newly completed matches with winners on public feed update only (Never for Admin)
          if (!isAdminRoute && prevMatchesMapRef.current.size > 0) {
            const pMap = {};
            (data.participants || participants).forEach(p => { pMap[p.id] = p; });
            const newWinners = [];
            data.matches.forEach(m => {
              const isCompletedNow = m.status === 'completed' || m.status === 'walkover';
              const prev = prevMatchesMapRef.current.get(m.id);
              const wasCompletedBefore = prev && (prev.status === 'completed' || prev.status === 'walkover');
              const isScoreChanged = prev && (
                prev.score1 !== m.score1 || 
                prev.score2 !== m.score2 || 
                prev.winnerId !== m.winnerId || 
                prev.penalty1 !== m.penalty1 || 
                prev.penalty2 !== m.penalty2 ||
                prev.status !== m.status
              );
              if ((isCompletedNow && !wasCompletedBefore) || (isCompletedNow && wasCompletedBefore && isScoreChanged)) {
                const cel = resolveCelebrationData(m, pMap);
                if (cel) newWinners.push(cel);
              }
            });
            if (newWinners.length > 0) {
              setCelebrationQueue(newWinners);
              setCelebrationIndex(0);
            }
          }
          const map = new Map();
          data.matches.forEach(m => map.set(m.id, { ...m }));
          prevMatchesMapRef.current = map;
          isInitialLoadCompletedRef.current = true;
          setMatches(data.matches);
        }
        if (data.config && typeof data.config === 'object') setConfig(sanitizeConfigWithBreaks(data.config));
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
    const intervalSecs = getPublicRefreshIntervalSecs(config);
    const minutesLabel = getPublicRefreshMinutesLabel(config);

    if (publicTimerSeconds > 0) {
      showNotification(`التحديث التلقائي يعمل كل ${minutesLabel} (المتبقي: ${formatTimerSecs(publicTimerSeconds)})`, 'info');
      return;
    }
    const newNext = Date.now() + (intervalSecs * 1000);
    localStorage.setItem(STORAGE_NEXT_REFRESH_KEY, String(newNext));
    localStorage.setItem(STORAGE_LAST_REFRESH_KEY, String(Date.now()));
    setPublicTimerSeconds(intervalSecs);
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
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Centered & Large Official Competition Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <img 
              src={logoUrl} 
              alt="شعار كأس السكن FC27" 
              className="brand-logo"
              style={{ height: '100px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.06))' }} 
            />
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
            {/* Rate-Limited Update Timer Button */}
            <button
              className="btn btn-secondary btn-sm public-refresh-btn"
              onClick={handlePublicRefreshClick}
              disabled={isSyncing}
              title={`تحديث تلقائي كل ${getPublicRefreshMinutesLabel(config)} (المتبقي: ${formatTimerSecs(publicTimerSeconds)})`}
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

            {/* Interactive Celebration Launcher Button */}
            {completedMatchesCount > 0 && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const completedWithWinner = [...matches]
                    .reverse()
                    .find(m => (m.status === 'completed' || m.status === 'walkover') && (m.score1 !== m.score2 || m.winnerId || m.penalty1 !== m.penalty2));
                  if (completedWithWinner) {
                    handleLaunchCelebration(completedWithWinner);
                  } else {
                    showNotification('لا توجد مباريات منتهية بفوز لعرض الاحتفال حالياً', 'info');
                  }
                }}
                title="مشاهدة احتفال الفوز التفاعلي بأحدث المباريات"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  background: '#FEF9C3',
                  borderColor: '#FDE047',
                  color: '#854D0E',
                  boxShadow: '0 1px 3px rgba(202, 138, 4, 0.12)'
                }}
              >
                <Trophy size={14} color="#D97706" />
                <span>احتفال الفوز 🎉</span>
              </button>
            )}
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
            onShowCelebration={handleLaunchCelebration}
            isLoading={isSyncing || (isInitialLoading && matches.length === 0)}
          />
        </main>

        {/* Interactive Winning Celebration Modal with Corner-to-Corner Diagonal Motion */}
        {celebrationQueue.length > 0 && celebrationQueue[celebrationIndex] && (
          <WinningCelebrationModal
            celebrationData={celebrationQueue[celebrationIndex]}
            queueIndex={celebrationIndex}
            queueTotal={celebrationQueue.length}
            onNext={() => {
              if (celebrationIndex < celebrationQueue.length - 1) {
                setCelebrationIndex(prev => prev + 1);
              } else {
                setCelebrationQueue([]);
                setCelebrationIndex(0);
              }
            }}
            onPrev={() => {
              if (celebrationIndex > 0) {
                setCelebrationIndex(prev => prev - 1);
              }
            }}
            onClose={() => {
              setCelebrationQueue([]);
              setCelebrationIndex(0);
            }}
          />
        )}

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
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Centered Large Official Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <img 
              src={logoUrl} 
              alt="شعار البطولة" 
              className="brand-logo"
              style={{ height: '96px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.06))' }} 
            />
          </div>

          {/* Subheader Information & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1200px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--ksu-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎮 بوابة منظم الصالة والمباريات</span>
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>منظم معتمد</span>
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
          onOpenAdjustMatch={() => setShowAdjustMatchModal(true)}
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
            userRole={userRole}
            onOpenAdjustMatch={() => setShowAdjustMatchModal(true)}
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
            onOpenAdjustMatch={() => setShowAdjustMatchModal(true)}
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

      {/* Main Admin Only: Adjust Match Time & Day Modal */}
      {userRole !== 'coordinator' && (
        <AdminAdjustMatchModal
          isOpen={showAdjustMatchModal}
          onClose={() => setShowAdjustMatchModal(false)}
          matches={matches}
          participants={participants}
          groups={groups}
          config={config}
          onUpdateMatch={handleAdminUpdateMatchSchedule}
          onNotify={showNotification}
        />
      )}
    </div>
  );
}
