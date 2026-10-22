import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Award, Sparkles, X, Volume2, VolumeX, RotateCcw, ChevronLeft, ChevronRight, Share2, Flame, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import AutoFitName from './AutoFitName';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';
import { playCelebrationFanfare, playReactionPop } from '../utils/celebrationSound';

/**
 * Interactive Winning Celebration Modal with Corner-to-Corner Diagonal Motion
 * Swoops dynamically from Corner Top-Left to Center with bright glassmorphism,
 * dynamic moving backgrounds, interactive floating reactions, confetti cannons, and procedural audio.
 */
export default function WinningCelebrationModal({
  celebrationData,
  queueIndex = 0,
  queueTotal = 1,
  onNext,
  onPrev,
  onClose
}) {
  const [phase, setPhase] = useState('entering'); // 'entering' | 'hovering' | 'exiting'
  const [isMuted, setIsMuted] = useState(false);
  const [reactions, setReactions] = useState({
    claps: 12,
    fires: 18,
    trophies: 25,
    goals: 9
  });
  const [floatingParticles, setFloatingParticles] = useState([]);
  const [timeLeft, setTimeLeft] = useState(8); // 8-second auto advance
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);
  const nextParticleId = useRef(1);

  // Trigger Confetti Blast
  const triggerConfettiBlast = useCallback(() => {
    try {
      // Corner Top-Left burst
      confetti({
        particleCount: 40,
        angle: 315,
        spread: 60,
        origin: { x: 0.05, y: 0.05 },
        colors: ['#10B981', '#F59E0B', '#3B82F6', '#FFFFFF', '#EC4899']
      });
      // Center burst
      confetti({
        particleCount: 50,
        spread: 80,
        origin: { x: 0.5, y: 0.45 },
        colors: ['#047857', '#FBBF24', '#10B981', '#FEF08A', '#38BDF8']
      });
      // Corner Bottom-Right burst
      confetti({
        particleCount: 40,
        angle: 135,
        spread: 60,
        origin: { x: 0.95, y: 0.95 },
        colors: ['#F59E0B', '#10B981', '#6366F1', '#FFFFFF']
      });
    } catch (e) {}
  }, []);

  // On Mount or match change: start entrance animation, sound, and confetti
  useEffect(() => {
    setPhase('entering');
    setTimeLeft(8);

    if (!isMuted) {
      playCelebrationFanfare();
    }
    triggerConfettiBlast();

    const enterTimer = setTimeout(() => {
      setPhase('hovering');
    }, 650);

    return () => clearTimeout(enterTimer);
  }, [celebrationData?.id, triggerConfettiBlast, isMuted]);

  // Countdown timer for automatic advancement
  useEffect(() => {
    if (phase !== 'hovering' || isPaused) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTriggerExit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, isPaused]);

  // Handle diagonal exit to corner bottom-right
  const handleTriggerExit = (callback) => {
    setPhase('exiting');
    setTimeout(() => {
      if (typeof callback === 'function') {
        callback();
      } else if (onNext && queueIndex < queueTotal - 1) {
        onNext();
      } else if (onClose) {
        onClose();
      }
    }, 450);
  };

  // Replay Diagonal Motion
  const handleReplayMotion = () => {
    setPhase('entering');
    setTimeLeft(8);
    if (!isMuted) playCelebrationFanfare();
    triggerConfettiBlast();
    setTimeout(() => setPhase('hovering'), 650);
  };

  // Interactive Reaction Handler (Spawns floating emojis)
  const handleAddReaction = (type, emoji) => {
    setReactions(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));

    if (!isMuted) {
      playReactionPop(type);
    }

    // Spawn 5 floating particles with random trajectories
    const newItems = Array.from({ length: 5 }, () => ({
      id: nextParticleId.current++,
      emoji,
      left: Math.random() * 80 + 10, // 10% to 90%
      size: Math.random() * 14 + 20, // 20px to 34px
      duration: Math.random() * 0.8 + 1.2 // 1.2s to 2.0s
    }));

    setFloatingParticles(prev => [...prev.slice(-25), ...newItems]);

    // Clean up particles
    setTimeout(() => {
      setFloatingParticles(prev => prev.filter(p => !newItems.some(ni => ni.id === p.id)));
    }, 2200);
  };

  if (!celebrationData) return null;

  const {
    winner,
    loser,
    score1,
    score2,
    penalty1,
    penalty2,
    hasPenalties,
    isWalkover,
    stageLabel,
    matchNumber,
    consoleId
  } = celebrationData;

  const winnerLogo = getTeamLogoUrl(winner?.team);
  const loserLogo = getTeamLogoUrl(loser?.team);

  return (
    <div 
      className="celebration-backdrop-container"
      onClick={() => handleTriggerExit(onClose)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Dynamic Laser Trail Streaking from Corner Top-Left to Corner Bottom-Right */}
      <div className="celebration-diagonal-laser" />

      {/* Floating Interactive Emoji Layer */}
      <div className="celebration-floating-particles-layer" pointerEvents="none">
        {floatingParticles.map(p => (
          <span
            key={p.id}
            className="celebration-float-particle"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              animationDuration: `${p.duration}s`
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* The Main Celebration Card with Diagonal Keyframe Transitions */}
      <div 
        className={`celebration-card-wrapper phase-${phase}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shimmer Light Sweeping Diagonally across the card */}
        <div className="celebration-diagonal-shimmer" />

        {/* Top Control Bar: Mute, Replay, Queue indicators, and Close */}
        <div className="celebration-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="celebration-icon-btn"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
            >
              {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              className="celebration-icon-btn"
              onClick={handleReplayMotion}
              title="إعادة حركة الاحتفال القطرية"
            >
              <RotateCcw size={17} />
            </button>
            {queueTotal > 1 && (
              <span className="celebration-queue-badge">
                فائز {queueIndex + 1} من {queueTotal}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="celebration-stage-tag">
              🏆 {stageLabel || 'مباراة البطولة'} {matchNumber ? `• #${matchNumber}` : ''}
            </span>
            <button
              className="celebration-close-btn"
              onClick={() => handleTriggerExit(onClose)}
              title="إغلاق الاحتفال"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Header Spotlight */}
        <div className="celebration-spotlight-header">
          <div className="celebration-trophy-halo">
            <Trophy size={42} className="celebration-trophy-icon" />
          </div>
          <h2 className="celebration-main-title">
            مبروك الفوز والتأهل! 🎉
          </h2>
          <p className="celebration-sub-title">
            نتيجة معتمدة في بطولة كأس السكن FC27 {consoleId ? `• جهاز ${consoleId}` : ''}
          </p>
        </div>

        {/* The Winner Showcase Box (Bright & Glowing) */}
        <div className="celebration-winner-box">
          <div className="celebration-winner-glow-ring" />
          
          <div className="celebration-winner-content">
            {winnerLogo && (
              <div className="celebration-logo-wrapper">
                <img 
                  src={winnerLogo} 
                  alt={winner?.team || 'نادي الفائز'} 
                  className="celebration-team-logo"
                  onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
                />
              </div>
            )}
            
            <div className="celebration-winner-info">
              <span className="celebration-winner-badge">
                ★ الفائز بالمباراة ★
              </span>
              <div className="celebration-winner-name">
                <AutoFitName 
                  text={winner?.name || 'البطل'}
                  fontWeight={900}
                  color="#0F172A"
                  compact={false}
                />
              </div>
              <div className="celebration-winner-team">
                {winner?.team || 'النادي'}
              </div>
            </div>
          </div>
        </div>

        {/* Match Result & Score Arena */}
        <div className="celebration-score-arena">
          {/* Winner Score */}
          <div className="celebration-score-side winner-side">
            <span className="score-label">الفائز</span>
            <span className="score-val numeric">{winner?.score ?? 0}</span>
          </div>

          {/* Center Divider & Penalties Badge */}
          <div className="celebration-score-divider">
            <span className="score-vs">VS</span>
            {hasPenalties && (
              <span className="celebration-penalty-badge numeric">
                ركلات ترجيح ({penalty1} - {penalty2})
              </span>
            )}
            {isWalkover && (
              <span className="celebration-walkover-badge">
                انسحاب
              </span>
            )}
          </div>

          {/* Loser / Opponent Score */}
          <div className="celebration-score-side loser-side">
            <span className="score-label">الخصم</span>
            <span className="score-val numeric">{loser?.score ?? 0}</span>
          </div>
        </div>

        {/* Runner-up / Opponent Sub-Bar */}
        <div className="celebration-opponent-bar">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>منافسة قوية ضد:</span>
          {loserLogo && (
            <img 
              src={loserLogo} 
              alt={loser?.team || ''} 
              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
              onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
            />
          )}
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
            {loser?.name || 'الخصم'} ({loser?.team || 'النادي'})
          </span>
        </div>

        {/* Interactive Reactions Bar ("MUST BE HAVE A LOT OF INTERACTIVE POP UPS") */}
        <div className="celebration-interactive-section">
          <div className="celebration-section-title">
            <Sparkles size={15} color="#F59E0B" />
            <span>تفاعل واحتفل مع الفائز مباشرة:</span>
          </div>

          <div className="celebration-reactions-grid">
            <button 
              type="button"
              className="celebration-react-btn"
              onClick={() => handleAddReaction('claps', '👏')}
              title="تصفيق حار"
            >
              <span className="react-emoji">👏</span>
              <span className="react-name">تصفيق</span>
              <span className="react-count numeric">{reactions.claps}</span>
            </button>

            <button 
              type="button"
              className="celebration-react-btn"
              onClick={() => handleAddReaction('fires', '🔥')}
              title="حماس مشتعل"
            >
              <span className="react-emoji">🔥</span>
              <span className="react-name">حماس</span>
              <span className="react-count numeric">{reactions.fires}</span>
            </button>

            <button 
              type="button"
              className="celebration-react-btn"
              onClick={() => handleAddReaction('trophies', '🏆')}
              title="كأس البطولة"
            >
              <span className="react-emoji">🏆</span>
              <span className="react-name">بطولة</span>
              <span className="react-count numeric">{reactions.trophies}</span>
            </button>

            <button 
              type="button"
              className="celebration-react-btn"
              onClick={() => handleAddReaction('goals', '⚽')}
              title="هدف رائع"
            >
              <span className="react-emoji">⚽</span>
              <span className="react-name">هدف</span>
              <span className="react-count numeric">{reactions.goals}</span>
            </button>

            <button 
              type="button"
              className="celebration-react-btn confetti-btn"
              onClick={triggerConfettiBlast}
              title="إطلاق مفرقعات احتفالية إضافية"
            >
              <span className="react-emoji">🎊</span>
              <span className="react-name">مفرقعات</span>
            </button>
          </div>
        </div>

        {/* Navigation & Progress Bar */}
        <div className="celebration-bottom-actions">
          {queueTotal > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={queueIndex <= 0}
                onClick={onPrev}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronRight size={16} />
                <span>السابق</span>
              </button>

              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isPaused ? "موقوف مؤقتاً للتفاعل" : `التالي بعد ${timeLeft} ثوانٍ`}
              </span>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleTriggerExit(onNext)}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>{queueIndex < queueTotal - 1 ? 'الفائز التالي' : 'إنهاء الاحتفال'}</span>
                <ChevronLeft size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', maxWidth: '280px', fontWeight: 800, fontSize: '0.88rem' }}
                onClick={() => handleTriggerExit(onClose)}
              >
                متابعة مباريات البطولة ✓
              </button>
            </div>
          )}

          {/* Diagonal Countdown Line Indicator */}
          <div className="celebration-timer-track">
            <div 
              className="celebration-timer-fill" 
              style={{ width: `${Math.max(0, (timeLeft / 8) * 100)}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
