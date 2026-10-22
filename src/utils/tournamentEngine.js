/**
 * Tournament Engine for KSU Housing FC27 Cup
 * Handles Group Generation, Automated Device Distribution with Round Fairness,
 * Dynamic Load Balancing, Estimated Match Time Calculations, and Connected Knockout Trees.
 */

export const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];

/**
 * Shuffle array randomly using Fisher-Yates
 */
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calculate Estimated Time Range for a queued match
 * Formats: hh:mm - hh:mm
 */
export function calculateEstimatedMatchTime(matchesAhead = 0, minDuration = 10, maxDuration = 15, baseDate = new Date()) {
  if (matchesAhead <= 0) {
    return {
      isNow: true,
      label: 'الآن (جارية)',
      rangeStr: 'جارية الآن'
    };
  }

  const waitMinMinutes = matchesAhead * minDuration;
  const waitMaxMinutes = matchesAhead * maxDuration;

  const minStartTime = new Date(baseDate.getTime() + waitMinMinutes * 60 * 1000);
  const maxStartTime = new Date(baseDate.getTime() + waitMaxMinutes * 60 * 1000);

  const formatTime = (d) => {
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const minStr = formatTime(minStartTime);
  const maxStr = formatTime(maxStartTime);

  return {
    isNow: false,
    matchesAhead,
    waitMinMinutes,
    waitMaxMinutes,
    minStr,
    maxStr,
    rangeStr: `${minStr} - ${maxStr}`
  };
}

/**
 * Format minutes-since-midnight to Arabic 12h time string
 */
export function formatMinsToTime12(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = Math.round(totalMins % 60);
  const ampm = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Parse "HH:MM" to total minutes since midnight
 */
export function parseTimeToMins(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  let str = String(timeStr).trim();
  const isPM = str.includes('م') || str.toLowerCase().includes('pm');
  const isAM = str.includes('ص') || str.toLowerCase().includes('am');
  str = str.replace(/[^\d:]/g, '');
  const [hStr, mStr] = str.split(':');
  let h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Calculate fixed scheduled time for every match in a day.
 * 
 * Algorithm:
 *   - Each console runs its matches sequentially (by orderOnConsole).
 *   - All consoles start at the same day-start time.
 *   - Matches are scheduled greedily: the match starts at max(dayStart + consoleTimeElapsed, breakEnd).
 *   - Break intervals apply globally: if a match's slot falls during a break it is pushed to the break's end.
 * 
 * @param {Array} dayMatches   All matches for a given day (each has consoleId, orderOnConsole)
 * @param {string} startTimeStr  "HH:MM" day start time
 * @param {number} matchDurationMins  Fixed duration per match in minutes
 * @param {Array} breaks  [{from:"HH:MM", to:"HH:MM"}]
 * @returns {Object} matchId -> { startMins, endMins, timeStr, endTimeStr }
 */
export function calculateFixedMatchSchedule(dayMatches, startTimeStr = '18:00', matchDurationMins = 12, breaks = []) {
  const startMins = parseTimeToMins(startTimeStr);
  const effectiveBreaks = (Array.isArray(breaks) && breaks.length > 0)
    ? breaks
    : [{ from: '19:00', to: '19:30' }];

  const parsedBreaks = effectiveBreaks
    .filter(b => b && b.from && b.to)
    .map(b => ({ from: parseTimeToMins(b.from), to: parseTimeToMins(b.to) }))
    .filter(b => b.to > b.from)
    .sort((a, b) => a.from - b.from);

  // Group matches per console, sorted by orderOnConsole
  const consoleQueues = {};
  dayMatches.forEach(m => {
    const cid = m.consoleId || 1;
    if (!consoleQueues[cid]) consoleQueues[cid] = [];
    consoleQueues[cid].push(m);
  });
  Object.values(consoleQueues).forEach(q => q.sort((a, b) => (a.orderOnConsole || 0) - (b.orderOnConsole || 0)));

  /**
   * Given a proposed start time (in minutes since midnight), push it past any breaks that overlap,
   * aligning to the tournament slot boundary so announced match times are strictly preserved.
   */
  const adjustForBreaks = (proposedStart) => {
    let adjusted = proposedStart;
    for (const brk of parsedBreaks) {
      if ((adjusted >= brk.from && adjusted < brk.to) || (adjusted < brk.from && adjusted + matchDurationMins > brk.from)) {
        adjusted = startMins + Math.ceil((brk.to - startMins) / matchDurationMins) * matchDurationMins;
      }
    }
    return adjusted;
  };

  const result = {};
  Object.entries(consoleQueues).forEach(([cid, queue]) => {
    // 1. Regular sequential matches (without customTime) run continuously without gaps or shifts
    const regularMatches = queue.filter(m => !m.customTime);
    let cursorMins = startMins;
    regularMatches.forEach(m => {
      const slotStart = adjustForBreaks(cursorMins);
      const slotEnd = slotStart + matchDurationMins;
      result[m.id] = {
        startMins: slotStart,
        endMins: slotEnd,
        timeStr: formatMinsToTime12(slotStart),
        endTimeStr: formatMinsToTime12(slotEnd),
        isCustom: false
      };
      cursorMins = slotEnd;
    });

    // 2. Custom-timed matches are pinned directly to their exact scheduled times
    queue.filter(m => m.customTime).forEach(m => {
      const customStart = parseTimeToMins(m.customTime);
      const slotEnd = customStart + matchDurationMins;
      result[m.id] = {
        startMins: customStart,
        endMins: slotEnd,
        timeStr: formatMinsToTime12(customStart),
        endTimeStr: formatMinsToTime12(slotEnd),
        isCustom: true
      };
    });
  });

  return result;
}



/**
 * Dynamic Load Balancing Across Consoles
 * If a device has finished all its matches or has significantly fewer queued matches,
 * it takes over remaining queued matches from overloaded devices so workload is equalized!
 */
/**
 * Dynamic Load Balancing Across Consoles
 * If a device has finished all its matches or has significantly fewer queued matches,
 * it takes over remaining queued matches from overloaded devices so workload is equalized!
 * Balanced independently per tournament day so Day 1 and Day 2 matches never intersect.
 */
export function rebalanceRemainingMatches(matches, consolesCount = 5, targetDay = null) {
  const activeMatches = matches.map(m => ({ ...m }));
  const distinctDays = [...new Set(activeMatches.map(m => m.dayNumber || 1))];
  const allRebalanced = [];

  distinctDays.forEach(day => {
    const dayMatches = activeMatches.filter(m => (m.dayNumber || 1) === day);
    if (targetDay !== null && day !== targetDay) {
      allRebalanced.push(...dayMatches);
      return;
    }

    const lockedMatches = dayMatches.filter(
      m => m.status === 'completed' || m.status === 'walkover' || m.status === 'live'
    );
    const queuedMatches = dayMatches.filter(m => m.status === 'scheduled');

    if (queuedMatches.length === 0) {
      allRebalanced.push(...dayMatches);
      return;
    }

    // Track players currently active in a live match to avoid scheduling them simultaneously
    const livePlayerIds = new Set();
    lockedMatches.filter(m => m.status === 'live').forEach(m => {
      if (m.player1Id) livePlayerIds.add(m.player1Id);
      if (m.player2Id) livePlayerIds.add(m.player2Id);
    });

    // Track queue per console of remaining scheduled matches for this day
    const queues = {};
    for (let c = 1; c <= consolesCount; c++) {
      const hasLive = lockedMatches.some(m => m.consoleId === c && m.status === 'live');
      queues[c] = {
        consoleId: c,
        hasLive,
        matches: queuedMatches.filter(m => m.consoleId === c).sort((a, b) => (a.orderOnConsole || 0) - (b.orderOnConsole || 0))
      };
    }

    // Iteratively balance queues: move from max queue to min queue if difference > 1
    let balanced = false;
    let iterations = 0;

    while (!balanced && iterations < 150) {
      iterations++;

      const queueWeights = Object.values(queues).map(q => ({
        consoleId: q.consoleId,
        weight: q.matches.length + (q.hasLive ? 1 : 0),
        matchesCount: q.matches.length
      }));

      queueWeights.sort((a, b) => b.weight - a.weight);

      const maxQueue = queueWeights[0];
      const minQueue = queueWeights[queueWeights.length - 1];

      if (maxQueue.weight - minQueue.weight > 1 && maxQueue.matchesCount > 0) {
        const sourceMatches = queues[maxQueue.consoleId].matches;

        let matchIdxToMove = -1;
        if (queues[minQueue.consoleId].matches.length === 0 && !queues[minQueue.consoleId].hasLive) {
          matchIdxToMove = sourceMatches.findIndex(
            m => !m.customTime && !livePlayerIds.has(m.player1Id) && !livePlayerIds.has(m.player2Id)
          );
        }

        if (matchIdxToMove === -1) {
          // Pick the last movable match that doesn't have an admin-customized time
          for (let i = sourceMatches.length - 1; i >= 0; i--) {
            if (!sourceMatches[i].customTime) {
              matchIdxToMove = i;
              break;
            }
          }
        }

        if (matchIdxToMove === -1) {
          // If all matches on source device have custom times, do not force move
          balanced = true;
          break;
        }

        const [matchToMove] = sourceMatches.splice(matchIdxToMove, 1);
        matchToMove.consoleId = minQueue.consoleId;
        queues[minQueue.consoleId].matches.push(matchToMove);
      } else {
        balanced = true;
      }
    }

    // Re-index orderOnConsole per console preserving round-by-round fairness for this day
    for (let c = 1; c <= consolesCount; c++) {
      const consoleLocked = lockedMatches
        .filter(m => m.consoleId === c)
        .sort((a, b) => (a.orderOnConsole || 0) - (b.orderOnConsole || 0));

      let orderCounter = 1;
      consoleLocked.forEach(m => { m.orderOnConsole = orderCounter++; });

      const consoleQueued = queues[c].matches.sort((a, b) => {
        if (a.roundNumber && b.roundNumber && a.roundNumber !== b.roundNumber) {
          return a.roundNumber - b.roundNumber;
        }
        return (a.matchNumber || 0) - (b.matchNumber || 0);
      });

      consoleQueued.forEach(m => { m.orderOnConsole = orderCounter++; });
    }

    // Re-combine all matches for this day
    for (let c = 1; c <= consolesCount; c++) {
      const cLocked = lockedMatches.filter(m => m.consoleId === c);
      const cQueued = queues[c].matches;
      allRebalanced.push(...cLocked, ...cQueued);
    }

    const otherDayMatches = dayMatches.filter(m => !m.consoleId);
    allRebalanced.push(...otherDayMatches);
  });

  return allRebalanced.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
}

export function generateGroupsAndMatches(participants, config) {
  const playersPerGroup = Number(config.playersPerGroup) || 4;
  const consolesCount = Number(config.consolesCount) || 5;
  const activePlayers = participants.filter(p => p.status === 'confirmed');
  
  if (activePlayers.length < 2) {
    return { groups: [], matches: [] };
  }

  const shuffled = shuffleArray(activePlayers);
  const numGroups = Math.ceil(shuffled.length / playersPerGroup);

  const groups = [];
  for (let g = 0; g < numGroups; g++) {
    const letter = ARABIC_LETTERS[g] || `${g + 1}`;
    groups.push({
      id: `group_${g + 1}`,
      index: g + 1,
      name: `المجموعة ${g + 1} (${letter})`,
      shortName: letter,
      playerIds: []
    });
  }

  shuffled.forEach((player, idx) => {
    const groupIdx = idx % numGroups;
    groups[groupIdx].playerIds.push(player.id);
  });

  const roundMatches = {
    round1: [],
    round2: [],
    round3: [],
    overflow: []
  };

  groups.forEach((grp) => {
    const pIds = grp.playerIds;
    const n = pIds.length;

    if (n === 4) {
      roundMatches.round1.push(
        { grp, p1: pIds[0], p2: pIds[1], roundNum: 1 },
        { grp, p1: pIds[2], p2: pIds[3], roundNum: 1 }
      );
      roundMatches.round2.push(
        { grp, p1: pIds[0], p2: pIds[2], roundNum: 2 },
        { grp, p1: pIds[1], p2: pIds[3], roundNum: 2 }
      );
      roundMatches.round3.push(
        { grp, p1: pIds[0], p2: pIds[3], roundNum: 3 },
        { grp, p1: pIds[1], p2: pIds[2], roundNum: 3 }
      );
    } else {
      let localRound = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const rKey = localRound === 1 ? 'round1' : (localRound === 2 ? 'round2' : 'round3');
          roundMatches[rKey].push({ grp, p1: pIds[i], p2: pIds[j], roundNum: localRound });
          localRound = (localRound % 3) + 1;
        }
      }
    }
  });

  const orderedList = [
    ...roundMatches.round1,
    ...roundMatches.round2,
    ...roundMatches.round3,
    ...roundMatches.overflow
  ];

  const consoleQueueCounters = {};
  for (let c = 1; c <= consolesCount; c++) {
    consoleQueueCounters[c] = 0;
  }

  const matches = [];
  let matchNumberCounter = 1;

  orderedList.forEach((item, idx) => {
    const assignedConsole = (idx % consolesCount) + 1;
    consoleQueueCounters[assignedConsole] += 1;
    const orderOnConsole = consoleQueueCounters[assignedConsole];

    matches.push({
      id: `m_${item.grp.id}_${matchNumberCounter}`,
      matchNumber: matchNumberCounter++,
      stage: 'group',
      groupId: item.grp.id,
      groupName: item.grp.name,
      roundNumber: item.roundNum,
      player1Id: item.p1,
      player2Id: item.p2,
      score1: null,
      score2: null,
      cards1: { yellow: 0, red: 0 },
      cards2: { yellow: 0, red: 0 },
      penalty1: null,
      penalty2: null,
      consoleId: assignedConsole,
      orderOnConsole: orderOnConsole,
      status: 'scheduled',
      walkoverWinnerId: null,
      winnerId: null,
      startedAt: null,
      completedAt: null
    });
  });

  // Automatically split matches into days based on configured tournament days (default: 2)
  const initialDays = Number(config.tournamentDays) || 2;
  const matchesWithDays = splitMatchesIntoDays(matches, activePlayers, initialDays, consolesCount);

  return { groups, matches: matchesWithDays };
}

/**
 * Add newly registered participants into incomplete groups (< 4 players) WITHOUT resetting the draw.
 * Preserves existing matches, completed scores, and standings. Only creates new matches for new participants.
 */
export function fillIncompleteGroupsAndAddMatches(currentGroups, currentMatches, allParticipants, config) {
  const targetGroupSize = Number(config.playersPerGroup) || 4;
  const consolesCount = Number(config.consolesCount) || 5;

  const assignedPlayerIds = new Set();
  currentGroups.forEach(g => (g.playerIds || []).forEach(id => assignedPlayerIds.add(id)));

  // Players not yet in any group
  const unassignedPlayers = allParticipants.filter(p => !assignedPlayerIds.has(p.id));

  if (unassignedPlayers.length === 0) {
    return {
      success: false,
      message: 'جميع المشاركين مدرجون بالفعل في المجموعات، لا يوجد لاعبون جدد.'
    };
  }

  const updatedGroups = currentGroups.map(g => ({ ...g, playerIds: [...g.playerIds] }));
  const updatedMatches = [...currentMatches];

  let maxMatchNum = updatedMatches.reduce((max, m) => Math.max(max, Number(m.matchNumber) || 0), 0);
  let addedPlayersCount = 0;
  const newMatchesList = [];

  const getRoundNumberForPair = (grp, p1, p2) => {
    const grpMatches = updatedMatches.concat(newMatchesList).filter(m => m.groupId === grp.id);
    const p1Matches = grpMatches.filter(m => m.player1Id === p1 || m.player2Id === p1);
    const p2Matches = grpMatches.filter(m => m.player1Id === p2 || m.player2Id === p2);
    const usedRounds = new Set([...p1Matches, ...p2Matches].map(m => m.roundNumber));
    for (let r = 1; r <= 3; r++) {
      if (!usedRounds.has(r)) return r;
    }
    return (grpMatches.length % 3) + 1;
  };

  // Step 1: Fill incomplete groups first
  updatedGroups.forEach(grp => {
    while (grp.playerIds.length < targetGroupSize && unassignedPlayers.length > 0) {
      const newPlayer = unassignedPlayers.shift();
      const existingMembers = [...grp.playerIds];
      grp.playerIds.push(newPlayer.id);
      addedPlayersCount++;

      // Create a match against each existing member
      existingMembers.forEach(otherId => {
        maxMatchNum++;
        const roundNum = getRoundNumberForPair(grp, otherId, newPlayer.id);
        newMatchesList.push({
          id: `m_${grp.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          matchNumber: maxMatchNum,
          stage: 'group',
          groupId: grp.id,
          groupName: grp.name,
          roundNumber: roundNum,
          player1Id: otherId,
          player2Id: newPlayer.id,
          consoleId: (newMatchesList.length % consolesCount) + 1,
          orderOnConsole: 1,
          status: 'scheduled',
          score1: null,
          score2: null,
          cards1: { yellow: 0, red: 0 },
          cards2: { yellow: 0, red: 0 },
          penalty1: null,
          penalty2: null,
          walkoverWinnerId: null,
          winnerId: null,
          startedAt: null,
          completedAt: null
        });
      });
    }
  });

  // Step 2: If there are still 2 or more unassigned players left, create new group(s)
  while (unassignedPlayers.length >= 2) {
    const newGroupIdx = updatedGroups.length + 1;
    const letter = ARABIC_LETTERS[newGroupIdx - 1] || `${newGroupIdx}`;
    const newGroup = {
      id: `group_${newGroupIdx}`,
      index: newGroupIdx,
      name: `المجموعة ${newGroupIdx} (${letter})`,
      shortName: letter,
      playerIds: []
    };

    while (newGroup.playerIds.length < targetGroupSize && unassignedPlayers.length > 0) {
      const newPlayer = unassignedPlayers.shift();
      newGroup.playerIds.push(newPlayer.id);
      addedPlayersCount++;
    }

    const n = newGroup.playerIds.length;
    let localRound = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        maxMatchNum++;
        newMatchesList.push({
          id: `m_${newGroup.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          matchNumber: maxMatchNum,
          stage: 'group',
          groupId: newGroup.id,
          groupName: newGroup.name,
          roundNumber: localRound,
          player1Id: newGroup.playerIds[i],
          player2Id: newGroup.playerIds[j],
          consoleId: (newMatchesList.length % consolesCount) + 1,
          orderOnConsole: 1,
          status: 'scheduled',
          score1: null,
          score2: null,
          cards1: { yellow: 0, red: 0 },
          cards2: { yellow: 0, red: 0 },
          penalty1: null,
          penalty2: null,
          walkoverWinnerId: null,
          winnerId: null,
          startedAt: null,
          completedAt: null
        });
        localRound = (localRound % 3) + 1;
      }
    }
    updatedGroups.push(newGroup);
  }

  // Combine and re-balance days
  const allUpdatedMatches = [...updatedMatches, ...newMatchesList];
  const tournamentDays = Number(config.tournamentDays) || 2;
  const balancedMatches = splitMatchesIntoDays(allUpdatedMatches, allParticipants, tournamentDays, consolesCount);

  return {
    success: true,
    groups: updatedGroups,
    matches: balancedMatches,
    addedCount: addedPlayersCount,
    newMatchesCount: newMatchesList.length,
    remainingUnassigned: unassignedPlayers.length
  };
}

/**
 * Automatically determine the Current (Now) and Next match on each console,
 * with queue positions and estimated start times
 */
export function getConsoleStatusMap(matches, consolesCount = 5, minDuration = 10, maxDuration = 15, isLiveActive = true, config = null) {
  const map = {};

  // Compute fixed schedule strictly from tournament start time (default 18:00) and break windows
  let fixedSchedule = {};
  if (matches.length > 0) {
    const dayNumber = matches[0]?.dayNumber || 1;
    const isKnockout = matches.some(m => m.stage && m.stage !== 'group' && !m.groupId);
    const dayKey = isKnockout ? 'knockout' : dayNumber;
    const startTime = config?.dayStartTimes?.[dayKey] || config?.dayStartTimes?.[1] || '18:00';
    const breaks = config?.dayBreaks?.[dayKey] || config?.dayBreaks?.[1] || [];
    const avgDuration = Math.round(((Number(config?.minMatchDuration) || minDuration) + (Number(config?.maxMatchDuration) || maxDuration)) / 2);
    fixedSchedule = calculateFixedMatchSchedule(matches, startTime, avgDuration, breaks);
  }

  for (let c = 1; c <= consolesCount; c++) {
    // Sort matches on this console strictly chronologically by scheduled start time!
    const consoleMatches = matches
      .filter(m => m.consoleId === c)
      .sort((a, b) => {
        const schedA = fixedSchedule[a.id];
        const schedB = fixedSchedule[b.id];
        const timeA = schedA?.startMins ?? (a.customTime ? parseTimeToMins(a.customTime) : (a.orderOnConsole || 0) * 12 + 1080);
        const timeB = schedB?.startMins ?? (b.customTime ? parseTimeToMins(b.customTime) : (b.orderOnConsole || 0) * 12 + 1080);
        if (timeA !== timeB) return timeA - timeB;
        return (a.orderOnConsole || 0) - (b.orderOnConsole || 0);
      });

    let current = null;
    let nextMatch = null;

    // Only activate Current (Green) and Next (Yellow) matches if this day is currently active / today!
    if (isLiveActive) {
      const liveMatch = consoleMatches.find(m => m.status === 'live');
      const firstUnfinished = consoleMatches.find(m => m.status !== 'completed' && m.status !== 'walkover');
      current = liveMatch || firstUnfinished || null;

      if (current) {
        const remaining = consoleMatches.filter(
          m => m.id !== current.id && m.status !== 'completed' && m.status !== 'walkover'
        );
        nextMatch = remaining[0] || null;
      }
    }

    // Attach STRICT FIXED times to all matches on this console (never depends on new Date() or drift)
    const enrichedMatches = consoleMatches.map((m, mIdx) => {
      const isDone = m.status === 'completed' || m.status === 'walkover';
      const isCur = current && current.id === m.id;
      const isNxt = nextMatch && nextMatch.id === m.id;
      
      // Fallback safe fixed time if sched is missing: start from 18:00 + (mIdx * 12 mins)
      let sched = fixedSchedule[m.id];
      if (!sched) {
        if (m.customTime) {
          const customStart = parseTimeToMins(m.customTime);
          const customEnd = customStart + 12;
          sched = {
            startMins: customStart,
            endMins: customEnd,
            timeStr: formatMinsToTime12(customStart),
            endTimeStr: formatMinsToTime12(customEnd),
            isCustom: true
          };
        } else {
          const fallbackStartMins = 18 * 60 + mIdx * 12;
          const fallbackEndMins = fallbackStartMins + 12;
          sched = {
            startMins: fallbackStartMins,
            endMins: fallbackEndMins,
            timeStr: formatMinsToTime12(fallbackStartMins),
            endTimeStr: formatMinsToTime12(fallbackEndMins)
          };
        }
      }

      if (isDone) {
        return { ...m, estimatedTime: null, fixedSchedule: sched };
      }

      const est = {
        isNow: isCur && isLiveActive,
        isNext: isNxt && isLiveActive,
        fixedTimeStr: sched.timeStr,
        fixedEndTimeStr: sched.endTimeStr,
        rangeStr: sched.timeStr,
        fullRangeStr: `${sched.timeStr} - ${sched.endTimeStr}`,
        label: `الموعد المقرر: ${sched.timeStr} - ${sched.endTimeStr}`
      };

      if (!isLiveActive) {
        est.isFutureDay = true;
        est.isNow = false;
        est.isNext = false;
        est.label = `مجدولة: ${sched.timeStr} - ${sched.endTimeStr}`;
      } else if (isCur) {
        est.label = 'الجارية الآن على الجهاز';
      } else if (isNxt) {
        est.label = `المباراة التالية: ${sched.timeStr}`;
      }

      return {
        ...m,
        fixedSchedule: sched,
        estimatedTime: est
      };
    });

    const enrichedCurrent = enrichedMatches.find(m => current && m.id === current.id) || null;
    const enrichedNext = enrichedMatches.find(m => nextMatch && m.id === nextMatch.id) || null;

    const completedCount = consoleMatches.filter(m => m.status === 'completed' || m.status === 'walkover').length;
    const queuedCount = consoleMatches.filter(m => m.status === 'scheduled').length;

    map[c] = {
      consoleId: c,
      matches: enrichedMatches,
      currentMatch: enrichedCurrent,
      nextMatch: enrichedNext,
      completedCount,
      queuedCount,
      totalCount: consoleMatches.length,
      isFinished: completedCount === consoleMatches.length && consoleMatches.length > 0,
      isLiveActive
    };
  }
  return map;
}

/**
 * Synchronize orderOnConsole across all matches to match strictly chronological queue time
 */
export function resequenceMatchesQueueOrder(matches, config = null) {
  if (!Array.isArray(matches) || matches.length === 0) return matches;

  const consolesCount = Number(config?.consolesCount) || 5;
  const minDuration = Number(config?.minMatchDuration) || 10;
  const maxDuration = Number(config?.maxMatchDuration) || 15;
  const avgDuration = Math.round((minDuration + maxDuration) / 2);

  // Group matches by day
  const distinctDays = [...new Set(matches.map(m => m.dayNumber || 1))];
  const fullSchedule = {};

  distinctDays.forEach(d => {
    const dayMatches = matches.filter(m => (m.dayNumber || 1) === d);
    const isKnockout = dayMatches.some(m => m.stage && m.stage !== 'group' && !m.groupId);
    const dayKey = isKnockout ? 'knockout' : d;
    const startTime = config?.dayStartTimes?.[dayKey] || config?.dayStartTimes?.[d] || '18:00';
    const breaks = config?.dayBreaks?.[dayKey] || config?.dayBreaks?.[d] || [];
    const sched = calculateFixedMatchSchedule(dayMatches, startTime, avgDuration, breaks);
    Object.assign(fullSchedule, sched);
  });

  // Re-number orderOnConsole chronologically per day and per console
  const resequenced = matches.map(m => ({ ...m }));

  distinctDays.forEach(d => {
    for (let c = 1; c <= consolesCount; c++) {
      const cMatches = resequenced.filter(m => (m.dayNumber || 1) === d && (m.consoleId || 1) === c);
      cMatches.sort((a, b) => {
        const timeA = fullSchedule[a.id]?.startMins ?? (a.customTime ? parseTimeToMins(a.customTime) : (a.orderOnConsole || 0) * 12 + 1080);
        const timeB = fullSchedule[b.id]?.startMins ?? (b.customTime ? parseTimeToMins(b.customTime) : (b.orderOnConsole || 0) * 12 + 1080);
        if (timeA !== timeB) return timeA - timeB;
        return (a.orderOnConsole || 0) - (b.orderOnConsole || 0);
      });

      cMatches.forEach((m, idx) => {
        m.orderOnConsole = idx + 1;
      });
    }
  });

  return resequenced;
}

export function calculateGroupStandings(group, allMatches, participantsMap, config) {
  const pointsWin = Number(config.pointsWin ?? 3);
  const pointsDraw = Number(config.pointsDraw ?? 1);
  const pointsLoss = Number(config.pointsLoss ?? 0);

  const statsMap = {};
  const groupPlayerIds = group.playerIds || group.participantIds || [];
  groupPlayerIds.forEach(pId => {
    const player = participantsMap[pId] || { name: 'مشارك', team: '—' };
    statsMap[pId] = {
      playerId: pId,
      name: player.name,
      team: player.team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      yellowCards: 0,
      redCards: 0
    };
  });

  const groupMatches = allMatches.filter(
    m => m.groupId === group.id && (m.status === 'completed' || m.status === 'walkover')
  );

  groupMatches.forEach(m => {
    const p1 = statsMap[m.player1Id];
    const p2 = statsMap[m.player2Id];
    if (!p1 || !p2) return;

    p1.played += 1;
    p2.played += 1;

    p1.yellowCards += (m.cards1?.yellow || 0);
    p1.redCards += (m.cards1?.red || 0);
    p2.yellowCards += (m.cards2?.yellow || 0);
    p2.redCards += (m.cards2?.red || 0);

    const s1 = Number(m.score1 || 0);
    const s2 = Number(m.score2 || 0);

    p1.gf += s1;
    p1.ga += s2;
    p2.gf += s2;
    p2.ga += s1;

    p1.gd = p1.gf - p1.ga;
    p2.gd = p2.gf - p2.ga;

    if (m.status === 'walkover') {
      if (m.isDoubleWalkover || m.walkoverWinnerId === 'double') {
        // Both players forfeit: 0-0 score, 0 points each, 1 loss each
        p1.lost += 1;
        p1.points += 0;
        p2.lost += 1;
        p2.points += 0;
      } else if (m.walkoverWinnerId === p1.playerId) {
        p1.won += 1;
        p1.points += pointsWin;
        p2.lost += 1;
        p2.points += pointsLoss;
      } else {
        p2.won += 1;
        p2.points += pointsWin;
        p1.lost += 1;
        p1.points += pointsLoss;
      }
    } else {
      if (s1 > s2) {
        p1.won += 1;
        p1.points += pointsWin;
        p2.lost += 1;
        p2.points += pointsLoss;
      } else if (s1 < s2) {
        p2.won += 1;
        p2.points += pointsWin;
        p1.lost += 1;
        p1.points += pointsLoss;
      } else {
        p1.drawn += 1;
        p2.drawn += 1;
        p1.points += pointsDraw;
        p2.points += pointsDraw;
      }
    }
  });

  const standingsList = Object.values(statsMap);

  standingsList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;

    // Head-to-Head
    const mutualMatch = groupMatches.find(
      m => (m.player1Id === a.playerId && m.player2Id === b.playerId) ||
           (m.player1Id === b.playerId && m.player2Id === a.playerId)
    );
    if (mutualMatch) {
      if (mutualMatch.status === 'walkover') {
        if (mutualMatch.walkoverWinnerId === a.playerId) return -1;
        if (mutualMatch.walkoverWinnerId === b.playerId) return 1;
      } else if (mutualMatch.score1 !== null && mutualMatch.score2 !== null) {
        const aScore = mutualMatch.player1Id === a.playerId ? mutualMatch.score1 : mutualMatch.score2;
        const bScore = mutualMatch.player1Id === b.playerId ? mutualMatch.score1 : mutualMatch.score2;
        if (aScore !== bScore) return bScore - aScore;
      }
    }

    // Fair Play
    const fairPlayA = (a.yellowCards * 1) + (a.redCards * 3);
    const fairPlayB = (b.yellowCards * 1) + (b.redCards * 3);
    if (fairPlayA !== fairPlayB) return fairPlayA - fairPlayB;

    return a.name.localeCompare(b.name, 'ar');
  });

  return standingsList;
}

/**
 * Check qualification guarantee status for a group
 * Qualification is guaranteed ONLY if:
 * 1. All matches in the group are finished (100% final standings), OR
 * 2. Mathematical threshold is reached where no remaining match results
 *    can cause the candidate to drop below the qualifying rank.
 */
export function checkGroupQualificationStatus(group, allMatches, participantsMap, config) {
  const qualifiersPerGroup = Number(config.qualifiersPerGroup) || 2;
  const pointsWin = Number(config.pointsWin ?? 3);
  const groupMatches = allMatches.filter(m => m.groupId === group.id);
  const standings = calculateGroupStandings(group, allMatches, participantsMap, config);

  const isGroupFinished = groupMatches.length > 0 && groupMatches.every(
    m => m.status === 'completed' || m.status === 'walkover'
  );

  // Calculate maximum potential points each participant can possibly reach
  const playerMaxPoints = {};
  standings.forEach(p => {
    const remMatches = groupMatches.filter(
      m => (m.player1Id === p.playerId || m.player2Id === p.playerId) &&
           m.status !== 'completed' && m.status !== 'walkover'
    ).length;
    playerMaxPoints[p.playerId] = p.points + (remMatches * pointsWin);
  });

  const rankResults = [];
  for (let r = 1; r <= qualifiersPerGroup; r++) {
    const idx = r - 1;
    let isGuaranteed = false;
    let guaranteedPlayerId = null;

    if (standings.length > idx) {
      if (isGroupFinished) {
        // Group completely finished -> 100% final standings
        isGuaranteed = true;
        guaranteedPlayerId = standings[idx].playerId;
      } else {
        // In-progress mathematical qualification guarantee:
        if (r === 1) {
          const cand = standings[0];
          // Candidate must have played matches and earned points
          if (cand.played > 0) {
            const othersMax = standings.slice(1).map(o => playerMaxPoints[o.playerId] ?? 0);
            const highestOtherMax = Math.max(...othersMax, -1);
            if (cand.points > highestOtherMax) {
              isGuaranteed = true;
              guaranteedPlayerId = cand.playerId;
            }
          }
        } else if (r === 2 && qualifiersPerGroup >= 2) {
          const cand1 = standings[0];
          const cand2 = standings[1];
          if (cand2.played > 0) {
            const rank1OthersMax = Math.max(...standings.slice(1).map(o => playerMaxPoints[o.playerId] ?? 0), -1);
            const isRank1Locked = cand1.points > rank1OthersMax;

            const belowCand2Max = Math.max(...standings.slice(2).map(o => playerMaxPoints[o.playerId] ?? 0), -1);
            if (isRank1Locked && cand2.points > belowCand2Max) {
              isGuaranteed = true;
              guaranteedPlayerId = cand2.playerId;
            }
          }
        }
      }
    }

    const placeholder = qualifiersPerGroup === 1 
      ? `المرشح من ${group.name}`
      : (r === 1 ? `متصدر ${group.name}` : `وصيف ${group.name}`);

    const shortPlaceholder = qualifiersPerGroup === 1
      ? `مرشح ${group.shortName || group.name}`
      : (r === 1 ? `متصدر ${group.shortName || group.name}` : `وصيف ${group.shortName || group.name}`);

    rankResults.push({
      groupId: group.id,
      groupName: group.name,
      shortName: group.shortName || group.name,
      rank: r,
      placeholder,
      shortPlaceholder,
      isGuaranteed,
      playerId: isGuaranteed ? guaranteedPlayerId : null,
      player: isGuaranteed && guaranteedPlayerId ? participantsMap[guaranteedPlayerId] : null
    });
  }

  return rankResults;
}

/**
 * Calculate Best Runners-up across all groups
 * Ranks all 2nd-place finishers across all groups using official criteria:
 * 1. Points (النقاط)
 * 2. Goal Difference (فارق الأهداف)
 * 3. Goals For / Scored (الأهداف المسجلة)
 * 4. Won matches (عدد الانتصارات)
 * 5. Fair Play / Cards (بطاقات صفراء وحمراء أقل)
 *
 * Dynamically computes spotsNeeded based on target bracket size (e.g. 32 bracket - 22 champions = 10 best runners-up)
 * or admin override.
 */
export function calculateBestRunnersUp(groups, allMatches, participantsMap, config = {}) {
  if (!groups || groups.length === 0) {
    return { runnersUp: [], spotsNeeded: 0, targetBracketSize: 16, totalGroups: 0 };
  }

  const allRunnersUp = [];

  groups.forEach(group => {
    const standings = calculateGroupStandings(group, allMatches, participantsMap, config);
    if (standings.length >= 2) {
      const runnerUp = standings[1];
      const groupMatches = allMatches.filter(m => m.groupId === group.id);
      const isGroupFinished = groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed' || m.status === 'walkover');
      
      const p = participantsMap[runnerUp.playerId] || {};

      allRunnersUp.push({
        playerId: runnerUp.playerId,
        playerName: p.name || 'لاعب غير معروف',
        phone: p.phone || '',
        team: p.team || '',
        groupId: group.id,
        groupName: group.name,
        shortName: group.shortName || group.name,
        played: runnerUp.played || 0,
        won: runnerUp.won || 0,
        drawn: runnerUp.drawn || 0,
        lost: runnerUp.lost || 0,
        goalsFor: runnerUp.goalsFor || 0,
        goalsAgainst: runnerUp.goalsAgainst || 0,
        goalDifference: runnerUp.goalDifference || 0,
        points: runnerUp.points || 0,
        cards: runnerUp.cards || { yellow: 0, red: 0 },
        isFinished: isGroupFinished,
        isGuaranteed: isGroupFinished
      });
    }
  });

  // Sort runners-up by official tournament tiebreakers
  allRunnersUp.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.won !== a.won) return b.won - a.won;
    const penaltyA = (a.cards.red || 0) * 3 + (a.cards.yellow || 0);
    const penaltyB = (b.cards.red || 0) * 3 + (b.cards.yellow || 0);
    if (penaltyA !== penaltyB) return penaltyA - penaltyB;
    return (a.playerName || '').localeCompare(b.playerName || '', 'ar');
  });

  // Target bracket size determination
  let targetBracketSize = 16;
  if (config.targetBracketSize && [8, 16, 32, 64].includes(Number(config.targetBracketSize))) {
    targetBracketSize = Number(config.targetBracketSize);
  } else {
    // Auto: smallest standard power of 2 >= groups.length
    targetBracketSize = 2;
    while (targetBracketSize < groups.length) {
      targetBracketSize *= 2;
    }
    targetBracketSize = Math.max(16, Math.min(targetBracketSize, 64));
  }

  // Calculate spots needed
  let spotsNeeded = 0;
  if (config.customBestRunnersUpCount !== undefined && config.customBestRunnersUpCount !== 'auto' && config.customBestRunnersUpCount !== '') {
    spotsNeeded = Math.max(0, Number(config.customBestRunnersUpCount) || 0);
  } else {
    // Auto: target bracket size - number of group champions (groups.length)
    spotsNeeded = Math.max(0, targetBracketSize - groups.length);
  }

  const enrichedRunnersUp = allRunnersUp.map((ru, idx) => ({
    ...ru,
    rank: idx + 1,
    isQualified: idx < spotsNeeded
  }));

  return {
    runnersUp: enrichedRunnersUp,
    spotsNeeded,
    targetBracketSize,
    totalGroups: groups.length
  };
}

/**
 * Generate Fully Connected Hierarchical Knockout Bracket Tree
 * Dynamically adjusts to ANY number of qualifiers (4, 8, 16, 32, 64)
 * Supports Champions + Best Runners-up when group count does not equal standard bracket size
 */
export function generateKnockoutTree(groups, allMatches, participantsMap, config = {}) {
  const qualifiersPerGroup = Number(config.qualifiersPerGroup) || 1;
  
  if (!groups || groups.length === 0) {
    return { bracketMatches: [], roundsConfig: [] };
  }

  // Collect qualification slots per group with guarantee checks
  const allSlots = [];
  groups.forEach(grp => {
    const slots = checkGroupQualificationStatus(grp, allMatches, participantsMap, config);
    allSlots.push(...slots);
  });

  const bestRunnersUpData = calculateBestRunnersUp(groups, allMatches, participantsMap, config);
  const targetBracketSize = bestRunnersUpData.targetBracketSize;
  const bracketSize = Math.min(targetBracketSize, 64);
  const numMatchesInR1 = bracketSize / 2;
  const round1Pairings = [];

  const rank1Slots = allSlots.filter(s => s.rank === 1);
  const qualifiedRunnersUp = bestRunnersUpData.runnersUp.filter(r => r.isQualified);

  if (qualifiedRunnersUp.length > 0 && rank1Slots.length + qualifiedRunnersUp.length === bracketSize) {
    // HYBRID TOURNAMENT SEEDING (Champions + Best Runners-up)
    // First, pair champions against best runners-up (avoiding same-group clashes)
    const availableChampions = [...rank1Slots];

    qualifiedRunnersUp.forEach((ru) => {
      let champIdx = availableChampions.findIndex(c => c.groupId !== ru.groupId);
      if (champIdx === -1) champIdx = 0;
      const [champ] = availableChampions.splice(champIdx, 1);

      const ruSlot = {
        groupId: ru.groupId,
        groupName: ru.groupName,
        shortName: ru.shortName,
        rank: 'best_runner_up',
        bestRunnerUpRank: ru.rank,
        isBestRunnerUp: true,
        placeholder: `أفضل وصيف #${ru.rank} (${ru.shortName})`,
        shortPlaceholder: `وصيف #${ru.rank}`,
        isGuaranteed: ru.isGuaranteed,
        playerId: ru.isGuaranteed ? ru.playerId : null,
        player: ru.isGuaranteed ? participantsMap[ru.playerId] : null
      };

      round1Pairings.push({ slot1: champ, slot2: ruSlot });
    });

    // Pair remaining champions against each other
    while (availableChampions.length >= 2) {
      const slot1 = availableChampions.shift();
      const slot2 = availableChampions.shift();
      round1Pairings.push({ slot1, slot2 });
    }
    if (availableChampions.length === 1) {
      round1Pairings.push({ slot1: availableChampions.shift(), slot2: null });
    }
  } else if (qualifiersPerGroup === 2 && groups.length * 2 === bracketSize) {
    // 2 qualifiers per group: 1st of Group i vs 2nd of Group j
    const firsts = allSlots.filter(s => s.rank === 1);
    const seconds = allSlots.filter(s => s.rank === 2);
    const gCount = groups.length;
    const shift = Math.max(1, Math.floor(gCount / 2));

    for (let m = 0; m < numMatchesInR1; m++) {
      const slot1 = firsts[m] || null;
      const targetSecondIdx = (m + shift) % gCount;
      const slot2 = seconds[targetSecondIdx] || null;
      round1Pairings.push({ slot1, slot2 });
    }
  } else {
    // Standard pairings
    for (let m = 0; m < numMatchesInR1; m++) {
      const slot1 = rank1Slots[m * 2] || null;
      const slot2 = rank1Slots[m * 2 + 1] || null;
      round1Pairings.push({ slot1, slot2 });
    }
  }

  const roundDefs = [
    { size: 64, key: 'r64', title: 'دور الـ 64' },
    { size: 32, key: 'r32', title: 'دور الـ 32' },
    { size: 16, key: 'r16', title: 'دور الـ 16' },
    { size: 8, key: 'qf', title: 'ربع النهائي' },
    { size: 4, key: 'sf', title: 'نصف النهائي' },
    { size: 2, key: 'final', title: 'المباراة النهائية 🏆' }
  ];

  const activeRounds = roundDefs.filter(r => r.size <= bracketSize);
  const bracketMatches = [];
  let matchNumberCounter = 200;
  let previousRoundMatches = [];
  const consolesCount = Math.max(1, Number(config.consolesCount) || 5);
  const daysCount = Math.max(1, Number(config.daysCount) || 2);
  const koDay = daysCount;

  const consoleCounters = {};
  for (let c = 1; c <= consolesCount; c++) {
    consoleCounters[c] = 0;
  }

  activeRounds.forEach((rDef, rIdx) => {
    const numMatchesInRound = rDef.size / 2;
    const currentRoundMatches = [];

    for (let m = 0; m < numMatchesInRound; m++) {
      const matchId = `ko_${rDef.key}_${m + 1}`;
      let p1Id = null;
      let p2Id = null;
      let p1Placeholder = rIdx === 0 ? 'بانتظار المتأهل' : 'بانتظار الفائز';
      let p2Placeholder = rIdx === 0 ? 'بانتظار المتأهل' : 'بانتظار الفائز';
      let isG1 = false;
      let isG2 = false;
      let g1Id = null;
      let g2Id = null;
      let r1 = null;
      let r2 = null;
      let isBru1 = false;
      let bruRank1 = null;
      let isBru2 = false;
      let bruRank2 = null;

      if (rIdx === 0) {
        const pair = round1Pairings[m] || { slot1: null, slot2: null };
        if (pair.slot1) {
          p1Id = pair.slot1.playerId;
          p1Placeholder = pair.slot1.placeholder;
          isG1 = pair.slot1.isGuaranteed;
          g1Id = pair.slot1.groupId;
          r1 = pair.slot1.rank;
          isBru1 = !!pair.slot1.isBestRunnerUp;
          bruRank1 = pair.slot1.bestRunnerUpRank || null;
        }
        if (pair.slot2) {
          p2Id = pair.slot2.playerId;
          p2Placeholder = pair.slot2.placeholder;
          isG2 = pair.slot2.isGuaranteed;
          g2Id = pair.slot2.groupId;
          r2 = pair.slot2.rank;
          isBru2 = !!pair.slot2.isBestRunnerUp;
          bruRank2 = pair.slot2.bestRunnerUpRank || null;
        }
      }

      // Distribute matches evenly across consoles 1 to consolesCount
      // The Grand Final is hosted on Console 1 (The Main Arena / المنصة الرئيسية)
      const assignedConsole = rDef.size === 2 ? 1 : ((m % consolesCount) + 1);
      consoleCounters[assignedConsole] = (consoleCounters[assignedConsole] || 0) + 1;
      const order = consoleCounters[assignedConsole];

      const matchObj = {
        id: matchId,
        matchNumber: matchNumberCounter++,
        stage: rDef.key,
        roundIndex: rIdx,
        matchIndexInRound: m,
        title: `${rDef.title} - مباراة ${m + 1}`,
        player1Id: p1Id,
        player2Id: p2Id,
        player1Placeholder: p1Placeholder,
        player2Placeholder: p2Placeholder,
        isGuaranteed1: isG1,
        isGuaranteed2: isG2,
        group1Id: g1Id,
        group2Id: g2Id,
        rank1: r1,
        rank2: r2,
        isBestRunnerUp1: isBru1,
        bestRunnerUpRank1: bruRank1,
        isBestRunnerUp2: isBru2,
        bestRunnerUpRank2: bruRank2,
        score1: null,
        score2: null,
        penalty1: null,
        penalty2: null,
        cards1: { yellow: 0, red: 0 },
        cards2: { yellow: 0, red: 0 },
        status: 'scheduled',
        walkoverWinnerId: null,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        consoleId: assignedConsole,
        orderOnConsole: order,
        dayNumber: koDay
      };

      currentRoundMatches.push(matchObj);
      bracketMatches.push(matchObj);
    }

    if (previousRoundMatches.length > 0) {
      previousRoundMatches.forEach((prevMatch, pIdx) => {
        const targetParentIdx = Math.floor(pIdx / 2);
        const targetSlot = (pIdx % 2) + 1;
        const parentMatch = currentRoundMatches[targetParentIdx];
        if (parentMatch) {
          prevMatch.nextMatchId = parentMatch.id;
          prevMatch.nextMatchSlot = targetSlot;
          if (targetSlot === 1) {
            parentMatch.player1Placeholder = `الفائز من مباراة #${prevMatch.matchNumber}`;
          } else {
            parentMatch.player2Placeholder = `الفائز من مباراة #${prevMatch.matchNumber}`;
          }
        }
      });
    }

    previousRoundMatches = currentRoundMatches;
  });

  return { bracketMatches, roundsConfig: activeRounds, bestRunnersUpData };
}

/**
 * Synchronize Existing Knockout Matches with Dynamic Group Qualification Guarantees
 */
export function syncKnockoutTreeWithGuarantees(matches, groups, participantsMap, config = {}) {
  if (!groups || groups.length === 0) return matches;
  const hasKnockout = matches.some(m => m.stage !== 'group');
  if (!hasKnockout) return matches;

  const groupStatusMap = {};
  groups.forEach(grp => {
    groupStatusMap[grp.id] = checkGroupQualificationStatus(grp, matches, participantsMap, config);
  });

  const bestRunnersUpData = calculateBestRunnersUp(groups, matches, participantsMap, config);
  const runnersUpList = bestRunnersUpData.runnersUp || [];

  // Determine first knockout stage dynamically (e.g. 'r32' or 'r16')
  const stageHierarchy = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];
  const presentStages = stageHierarchy.filter(st => matches.some(m => m.stage === st));
  const firstStage = presentStages[0] || 'r16';

  return matches.map(m => {
    if (m.stage === 'group' || m.stage !== firstStage) return m;

    let updatedP1 = m.player1Id;
    let updatedP2 = m.player2Id;
    let isG1 = m.isGuaranteed1;
    let isG2 = m.isGuaranteed2;
    let p1Placeholder = m.player1Placeholder;
    let p2Placeholder = m.player2Placeholder;

    // Slot 1: Best Runner Up vs Standard Group Rank
    if (m.isBestRunnerUp1 && m.bestRunnerUpRank1) {
      const ru = runnersUpList.find(r => r.rank === m.bestRunnerUpRank1);
      if (ru) {
        p1Placeholder = `أفضل وصيف #${ru.rank} (${ru.shortName})`;
        if (ru.isGuaranteed) {
          updatedP1 = ru.playerId;
          isG1 = true;
        } else {
          updatedP1 = null;
          isG1 = false;
        }
      }
    } else if (m.group1Id) {
      const gSlots = groupStatusMap[m.group1Id] || [];
      const slot1 = gSlots.find(s => s.rank === (m.rank1 || 1));
      if (slot1) {
        p1Placeholder = slot1.placeholder;
        if (slot1.isGuaranteed) {
          updatedP1 = slot1.playerId;
          isG1 = true;
        } else {
          updatedP1 = null;
          isG1 = false;
        }
      }
    }

    // Slot 2: Best Runner Up vs Standard Group Rank
    if (m.isBestRunnerUp2 && m.bestRunnerUpRank2) {
      const ru = runnersUpList.find(r => r.rank === m.bestRunnerUpRank2);
      if (ru) {
        p2Placeholder = `أفضل وصيف #${ru.rank} (${ru.shortName})`;
        if (ru.isGuaranteed) {
          updatedP2 = ru.playerId;
          isG2 = true;
        } else {
          updatedP2 = null;
          isG2 = false;
        }
      }
    } else if (m.group2Id) {
      const gSlots = groupStatusMap[m.group2Id] || [];
      const slot2 = gSlots.find(s => s.rank === (m.rank2 || 2));
      if (slot2) {
        p2Placeholder = slot2.placeholder;
        if (slot2.isGuaranteed) {
          updatedP2 = slot2.playerId;
          isG2 = true;
        } else {
          updatedP2 = null;
          isG2 = false;
        }
      }
    }

    return {
      ...m,
      player1Id: updatedP1,
      player2Id: updatedP2,
      player1Placeholder: p1Placeholder,
      player2Placeholder: p2Placeholder,
      isGuaranteed1: isG1,
      isGuaranteed2: isG2
    };
  });
}

/**
 * Propagate Winner of a Knockout Match to the Next Round in the Tree
 */
export function propagateWinnerInTree(matches, updatedMatch) {
  const winnerId = updatedMatch.winnerId;
  const nextMatchId = updatedMatch.nextMatchId;
  const nextSlot = updatedMatch.nextMatchSlot;

  if (!nextMatchId) return matches;

  return matches.map(m => {
    if (m.id === nextMatchId) {
      if (nextSlot === 1) {
        return { ...m, player1Id: winnerId };
      } else {
        return { ...m, player2Id: winnerId };
      }
    }
    return m;
  });
}


/**
 * Split Tournament Matches into X Days with Reverse Symmetry Fairness
 * 
 * Circle Definition:
 * In a round-robin group of p players, a "Circle" (دورة كاملة / جولة) is when all players play at least once.
 * Total circles = p - 1. (e.g. for p = 4, there are 3 circles).
 * 
 * 2-Day Split Principle (Reverse Symmetry):
 * - Day 1: Half of the participants play twice, and the other half play once.
 * - Day 2: The reverse! Players who played once on Day 1 play twice, and players who played twice on Day 1 play once.
 * At the end of Day 2, all players have completed exactly the same total matches (p - 1).
 */
export function splitMatchesIntoDays(matches, participants = [], daysCount = 2, consolesCount = 5) {
  const dCount = Math.max(1, Number(daysCount) || 2);
  const groupMatches = matches.filter(m => m.stage === 'group' || m.groupId);
  const koMatches = matches.filter(m => m.stage !== 'group' && !m.groupId);

  const circles = {};
  groupMatches.forEach(m => {
    const r = m.roundNumber || 1;
    if (!circles[r]) circles[r] = [];
    circles[r].push(m);
  });

  const matchDayMap = {};

  if (dCount === 1) {
    matches.forEach(m => { matchDayMap[m.id] = 1; });
  } else if (dCount === 2) {
    // 1. Circle 1 goes to Day 1
    (circles[1] || []).forEach(m => { matchDayMap[m.id] = 1; });

    // 2. Circle 2 is split in half per group to achieve exact reverse symmetry:
    // In each group: match 1 goes to Day 1, match 2 goes to Day 2
    const groupCircle2Counter = {};
    (circles[2] || []).forEach(m => {
      const gid = m.groupId || 'default';
      groupCircle2Counter[gid] = (groupCircle2Counter[gid] || 0) + 1;
      if (groupCircle2Counter[gid] % 2 === 1) {
        matchDayMap[m.id] = 1;
      } else {
        matchDayMap[m.id] = 2;
      }
    });

    // 3. Circle 3 goes to Day 2
    (circles[3] || []).forEach(m => { matchDayMap[m.id] = 2; });

    // Any extra circles (if p > 4):
    Object.keys(circles).forEach(rStr => {
      const r = Number(rStr);
      if (r > 3) {
        (circles[r] || []).forEach(m => { matchDayMap[m.id] = 2; });
      }
    });

    // Knockout matches go to Day 2
    koMatches.forEach(m => { matchDayMap[m.id] = 2; });
  } else if (dCount === 3) {
    (circles[1] || []).forEach(m => { matchDayMap[m.id] = 1; });
    (circles[2] || []).forEach(m => { matchDayMap[m.id] = 2; });
    (circles[3] || []).forEach(m => { matchDayMap[m.id] = 3; });
    Object.keys(circles).forEach(rStr => {
      const r = Number(rStr);
      if (r > 3) {
        (circles[r] || []).forEach(m => { matchDayMap[m.id] = 3; });
      }
    });
    koMatches.forEach(m => { matchDayMap[m.id] = 3; });
  } else if (dCount >= 4) {
    (circles[1] || []).forEach(m => { matchDayMap[m.id] = 1; });
    (circles[2] || []).forEach(m => { matchDayMap[m.id] = 2; });
    (circles[3] || []).forEach(m => { matchDayMap[m.id] = 3; });
    Object.keys(circles).forEach(rStr => {
      const r = Number(rStr);
      if (r > 3) {
        (circles[r] || []).forEach(m => { matchDayMap[m.id] = 3; });
      }
    });

    if (dCount === 4) {
      koMatches.forEach(m => { matchDayMap[m.id] = 4; });
    } else {
      koMatches.forEach(m => {
        if (m.stage === 'sf' || m.stage === 'final') {
          matchDayMap[m.id] = dCount;
        } else {
          matchDayMap[m.id] = 4;
        }
      });
    }
  }

  // Completely partition console queues per day so Day 1 and Day 2 do NOT intersect!
  const finalMatches = [];
  const cCount = Number(consolesCount) || 5;

  for (let d = 1; d <= dCount; d++) {
    const dayMatches = matches
      .filter(m => (matchDayMap[m.id] || 1) === d)
      .sort((a, b) => {
        // Group matches first by round, then knockout matches
        const aIsKo = a.stage !== 'group' && !a.groupId;
        const bIsKo = b.stage !== 'group' && !b.groupId;
        if (!aIsKo && bIsKo) return -1;
        if (aIsKo && !bIsKo) return 1;
        if (!aIsKo && !bIsKo) {
          if ((a.roundNumber || 1) !== (b.roundNumber || 1)) {
            return (a.roundNumber || 1) - (b.roundNumber || 1);
          }
        }
        return (a.matchNumber || 0) - (b.matchNumber || 0);
      });

    const consoleCounters = {};
    for (let c = 1; c <= cCount; c++) {
      consoleCounters[c] = 0;
    }

    dayMatches.forEach((m, idx) => {
      const assignedConsole = (idx % cCount) + 1;
      consoleCounters[assignedConsole] += 1;
      finalMatches.push({
        ...m,
        dayNumber: d,
        consoleId: assignedConsole,
        orderOnConsole: consoleCounters[assignedConsole]
      });
    });
  }

  // Preserve any unmatched items if any
  const matchedIds = new Set(finalMatches.map(m => m.id));
  matches.forEach(m => {
    if (!matchedIds.has(m.id)) {
      finalMatches.push({ ...m, dayNumber: 1 });
    }
  });

  return finalMatches.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
}

/**
 * Calculate per-player match workload per day
 */
export function calculatePlayerDayWorkload(matches, participants = [], daysCount = 2) {
  const dCount = Math.max(1, Number(daysCount) || 2);
  const workloadMap = {};

  participants.forEach(p => {
    workloadMap[p.id] = {
      playerId: p.id,
      name: p.name || 'مشارك',
      team: p.team || '—',
      phone: p.phone || '',
      days: {},
      totalMatches: 0,
      isReverseBalanced: false
    };
    for (let d = 1; d <= dCount; d++) {
      workloadMap[p.id].days[d] = 0;
    }
  });

  matches.forEach(m => {
    const d = m.dayNumber || 1;
    if (m.player1Id && workloadMap[m.player1Id]) {
      workloadMap[m.player1Id].days[d] = (workloadMap[m.player1Id].days[d] || 0) + 1;
      workloadMap[m.player1Id].totalMatches += 1;
    }
    if (m.player2Id && workloadMap[m.player2Id]) {
      workloadMap[m.player2Id].days[d] = (workloadMap[m.player2Id].days[d] || 0) + 1;
      workloadMap[m.player2Id].totalMatches += 1;
    }
  });

  Object.values(workloadMap).forEach(item => {
    const d1 = item.days[1] || 0;
    const d2 = item.days[2] || 0;
    item.isReverseBalanced = (d1 === 2 && d2 === 1) || (d1 === 1 && d2 === 2);
  });

  return Object.values(workloadMap);
}

/**
 * Get comprehensive breakdown statistics per day
 */
export function getDayBreakdownStats(matches, participants = [], daysCount = 2) {
  const dCount = Math.max(1, Number(daysCount) || 2);
  const workload = calculatePlayerDayWorkload(matches, participants, dCount);
  const days = [];

  for (let d = 1; d <= dCount; d++) {
    const dayMatches = matches.filter(m => (m.dayNumber || 1) === d);
    const completedCount = dayMatches.filter(m => m.status === 'completed' || m.status === 'walkover').length;
    const playersPlayingTwice = workload.filter(w => (w.days[d] || 0) === 2).length;
    const playersPlayingOnce = workload.filter(w => (w.days[d] || 0) === 1).length;
    const playersPlayingZero = workload.filter(w => (w.days[d] || 0) === 0).length;

    // Consoles distribution
    const consoleCounts = {};
    dayMatches.forEach(m => {
      const c = m.consoleId || 1;
      consoleCounts[c] = (consoleCounts[c] || 0) + 1;
    });

    days.push({
      dayNumber: d,
      matches: dayMatches,
      matchesCount: dayMatches.length,
      completedCount,
      playersPlayingTwice,
      playersPlayingOnce,
      playersPlayingZero,
      consoleCounts
    });
  }

  return days;
}
