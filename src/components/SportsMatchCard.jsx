import React from 'react';
import { MessageCircle } from 'lucide-react';
import AutoFitName from './AutoFitName';
import { getTeamLogoUrl, DEFAULT_UNKNOWN_LOGO } from '../utils/footballTeams';

/**
 * 365scores / Sofascore Style Sports Match Card
 * Clean layout: [Competitor 1 + Logo 24px] [Centered Time/Score/Status] [Logo 24px + Competitor 2]
 * Uses AutoFitName to auto-minimize participant name size without changing screen ratio.
 */
export default function SportsMatchCard({ 
  match, 
  p1, 
  p2, 
  isCurrent = false, 
  isNext = false, 
  isDone = false, 
  onSelectMatch, 
  onRemindMatch,
  compact = false,
  isPublicMode = false
}) {
  const p1Logo = getTeamLogoUrl(p1?.team);
  const p2Logo = getTeamLogoUrl(p2?.team);

  const isCompleted = isDone || match.status === 'completed' || match.status === 'walkover';

  let centerContent = null;
  if (isCompleted) {
    centerContent = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <span className="numeric" style={{ fontSize: compact ? '0.98rem' : '1.2rem', fontWeight: 900, color: '#0F172A' }}>
            {match.score1 ?? 0}
          </span>
          <span style={{ color: '#94A3B8', fontWeight: 800 }}>-</span>
          <span className="numeric" style={{ fontSize: compact ? '0.98rem' : '1.2rem', fontWeight: 900, color: '#0F172A' }}>
            {match.score2 ?? 0}
          </span>
        </div>
        <span style={{ fontSize: '0.62rem', color: '#059669', fontWeight: 800 }}>منتهية ✓</span>
      </div>
    );
  } else if (isCurrent) {
    centerContent = (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="badge badge-green" style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px' }}>
          الآن 🟢
        </span>
        {match.estimatedTime?.rangeStr ? (
          <span className="numeric" style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap' }}>
            {match.estimatedTime.rangeStr}
          </span>
        ) : null}
      </div>
    );
  } else if (isNext) {
    centerContent = (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="badge badge-gold" style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px' }}>
          التالية ⏳
        </span>
        {match.estimatedTime?.rangeStr ? (
          <span className="numeric" style={{ fontSize: '0.7rem', color: '#854D0E', fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap' }}>
            {match.estimatedTime.rangeStr}
          </span>
        ) : null}
      </div>
    );
  } else {
    centerContent = (
      <div style={{ textAlign: 'center' }}>
        <span className="numeric" style={{ 
          fontSize: '0.72rem', 
          fontWeight: 700, 
          color: '#334155', 
          background: '#F1F5F9', 
          padding: '2px 7px', 
          borderRadius: '4px', 
          border: '1px solid #E2E8F0',
          display: 'inline-block',
          whiteSpace: 'nowrap'
        }}>
          {match.estimatedTime?.rangeStr ? `🕒 ${match.estimatedTime.rangeStr}` : 'مجدولة'}
        </span>
      </div>
    );
  }

  const isClickable = !isPublicMode && typeof onSelectMatch === 'function';

  return (
    <div 
      onClick={isClickable ? () => onSelectMatch(match) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '7px 10px' : '10px 14px',
        background: isCurrent ? '#ECFDF5' : (isNext ? '#FEF9C3' : (isCompleted ? '#F8FAFC' : '#FFFFFF')),
        border: `1.5px solid ${isCurrent ? '#059669' : (isNext ? '#CA8A04' : (isCompleted ? '#CBD5E1' : 'var(--border-light)'))}`,
        borderRadius: '8px',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box'
      }}
      title={isClickable ? "اضغط لرصد أو تعديل نتيجة المباراة" : undefined}
    >
      {/* Competitor 1 (Right side in Arabic RTL): Logo + AutoFit Name + Team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, justifyContent: 'flex-start' }}>
        {p1Logo ? (
          <img 
            src={p1Logo} 
            alt={p1?.team || 'فريق 1'} 
            style={{ 
              width: compact ? '22px' : '26px', 
              height: compact ? '22px' : '26px', 
              objectFit: 'contain', 
              flexShrink: 0 
            }} 
            onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
          />
        ) : (
          <div style={{ 
            width: compact ? '22px' : '26px', 
            height: compact ? '22px' : '26px', 
            borderRadius: '50%', 
            background: '#E2E8F0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '0.7rem', 
            flexShrink: 0 
          }}>
            🎮
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <AutoFitName 
            text={p1?.name || match.player1Placeholder || 'اللاعب 1'}
            compact={compact}
            color={isCurrent ? '#065F46' : 'var(--text-main)'}
            fontWeight={800}
            align="right"
          />
          {p1?.team && (
            <div style={{ 
              fontSize: '0.68rem', 
              color: 'var(--text-muted)', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              textAlign: 'right',
              marginTop: '1px'
            }}>
              {p1.team}
            </div>
          )}
        </div>
      </div>

      {/* Center: Score / Time / Status Badge */}
      <div style={{ flexShrink: 0, padding: '0 4px', minWidth: '68px', textAlign: 'center' }}>
        {centerContent}
      </div>

      {/* Competitor 2 (Left side in Arabic RTL): AutoFit Name + Team + Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, justifyContent: 'flex-end', textAlign: 'left' }}>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <AutoFitName 
            text={p2?.name || match.player2Placeholder || 'اللاعب 2'}
            compact={compact}
            color={isCurrent ? '#065F46' : 'var(--text-main)'}
            fontWeight={800}
            align="left"
          />
          {p2?.team && (
            <div style={{ 
              fontSize: '0.68rem', 
              color: 'var(--text-muted)', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              textAlign: 'left',
              marginTop: '1px'
            }}>
              {p2.team}
            </div>
          )}
        </div>
        {p2Logo ? (
          <img 
            src={p2Logo} 
            alt={p2?.team || 'فريق 2'} 
            style={{ 
              width: compact ? '22px' : '26px', 
              height: compact ? '22px' : '26px', 
              objectFit: 'contain', 
              flexShrink: 0 
            }} 
            onError={(e) => { e.target.src = DEFAULT_UNKNOWN_LOGO; }}
          />
        ) : (
          <div style={{ 
            width: compact ? '22px' : '26px', 
            height: compact ? '22px' : '26px', 
            borderRadius: '50%', 
            background: '#E2E8F0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '0.7rem', 
            flexShrink: 0 
          }}>
            🎮
          </div>
        )}
      </div>

      {/* Quick WhatsApp Reminder Action (Only for Organizers when match is not done) */}
      {!isCompleted && !isPublicMode && onRemindMatch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemindMatch(match);
          }}
          title="إرسال تذكير واتساب بالموعد"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#25D366',
            padding: '3px',
            cursor: 'pointer',
            borderRadius: '4px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <MessageCircle size={15} />
        </button>
      )}
    </div>
  );
}
