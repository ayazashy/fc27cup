import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ParticipantsTab from './components/ParticipantsTab';
import GroupsTab from './components/GroupsTab';
import MatchesTab from './components/MatchesTab';
import KnockoutTab from './components/KnockoutTab';
import TvDisplayTab from './components/TvDisplayTab';
import SettingsTab from './components/SettingsTab';
import { 
  Users, 
  Shuffle, 
  Calendar, 
  Trophy, 
  Tv, 
  Settings, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { 
  saveTournamentToFirestore, 
  loadTournamentFromFirestore, 
  subscribeToTournament 
} from './firebase';

const STORAGE_KEY = 'ksu_fc27_tournament_state_v1';

const DEFAULT_CONFIG = {
  playersPerGroup: 4,
  qualifiersPerGroup: 2,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  consolesCount: 5,
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

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Initial Load: Load local storage first, then subscribe to Firestore
  useEffect(() => {
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
      },
      (err) => {
        setFirestoreStatus({ connected: false, error: err?.message || 'Firestore connection issue' });
      }
    );

    return () => {
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

  // 3. Save to Firebase Firestore
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    const result = await saveTournamentToFirestore({
      name: 'كأس السكن: FC27',
      participants,
      groups,
      matches,
      config
    });
    setIsSaving(false);

    if (result.success) {
      setFirestoreStatus({ connected: true, error: null });
      showNotification('تمت مزامنة وحفظ جميع بيانات البطولة في Google Firestore بنجاح! ☁️', 'success');
    } else {
      showNotification(`تعذر الاتصال بالسحابة (${result.error}). البيانات محفوظة محلياً.`, 'error');
    }
  };

  const completedMatchesCount = matches.filter(m => m.status === 'completed' || m.status === 'walkover').length;

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

      {/* Main Header with Logo & Live Sync */}
      <Header
        participantsCount={participants.length}
        groupsCount={groups.length}
        completedMatchesCount={completedMatchesCount}
        totalMatchesCount={matches.length}
        firestoreStatus={firestoreStatus}
        onSaveToCloud={handleSaveToCloud}
        isSaving={isSaving}
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
            config={config}
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
          />
        )}

        {activeTab === 'tv' && (
          <TvDisplayTab
            matches={matches}
            groups={groups}
            participants={participants}
            config={config}
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
    </div>
  );
}
