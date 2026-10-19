/**
 * Tournament Engine for KSU Housing FC27 Cup
 * Handles Group Generation, Automated Device Distribution with Round-by-Round Fairness,
 * Standings Calculation, and Connected Knockout Trees.
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
 * Generate Groups and Automatically Schedule Matches across X Devices
 * Guarantees Round-by-Round fairness: ALL players play Round 1 before ANY player plays Round 2!
 */
export function generateGroupsAndMatches(participants, config) {
  const playersPerGroup = Number(config.playersPerGroup) || 4;
  const consolesCount = Number(config.consolesCount) || 5;
  const activePlayers = participants.filter(p => p.status === 'confirmed');
  
  if (activePlayers.length < 2) {
    return { groups: [], matches: [] };
  }

  // Shuffle players randomly
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

  // Distribute players round-robin into groups
  shuffled.forEach((player, idx) => {
    const groupIdx = idx % numGroups;
    groups[groupIdx].playerIds.push(player.id);
  });

  // Generate matches grouped by Round Number for each group
  // For standard 4 players [0, 1, 2, 3]:
  // Round 1: (0 vs 1), (2 vs 3)
  // Round 2: (0 vs 2), (1 vs 3)
  // Round 3: (0 vs 3), (1 vs 2)
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
      // Clean 3 rounds
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
      // General round robin for non-4 player groups
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

  // Ordered list of all matches: Round 1 first, then Round 2, then Round 3!
  const orderedList = [
    ...roundMatches.round1,
    ...roundMatches.round2,
    ...roundMatches.round3,
    ...roundMatches.overflow
  ];

  // Distribute sequentially across Consoles (1 to consolesCount)
  // Tracking queue order per console
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
      // First match on each console starts as scheduled
      status: 'scheduled',
      walkoverWinnerId: null,
      winnerId: null,
      startedAt: null,
      completedAt: null
    });
  });

  return { groups, matches };
}

/**
 * Automatically determine the Current (Now) and Next match on each console
 */
export function getConsoleStatusMap(matches, consolesCount = 5) {
  const map = {};
  for (let c = 1; c <= consolesCount; c++) {
    const consoleMatches = matches
      .filter(m => m.consoleId === c)
      .sort((a, b) => (a.orderOnConsole || 0) - (b.orderOnConsole || 0));

    // Current match: First in_progress / live match, or first non-completed match
    const liveMatch = consoleMatches.find(m => m.status === 'live');
    const firstUnfinished = consoleMatches.find(m => m.status !== 'completed' && m.status !== 'walkover');
    const current = liveMatch || firstUnfinished || null;

    // Next match: The one immediately after current that is not completed
    let nextMatch = null;
    if (current) {
      const remaining = consoleMatches.filter(
        m => m.id !== current.id && m.status !== 'completed' && m.status !== 'walkover'
      );
      nextMatch = remaining[0] || null;
    }

    map[c] = {
      consoleId: c,
      matches: consoleMatches,
      currentMatch: current,
      nextMatch: nextMatch,
      completedCount: consoleMatches.filter(m => m.status === 'completed' || m.status === 'walkover').length,
      totalCount: consoleMatches.length
    };
  }
  return map;
}

/**
 * Calculate dynamic standings for a group
 */
export function calculateGroupStandings(group, allMatches, participantsMap, config) {
  const pointsWin = Number(config.pointsWin ?? 3);
  const pointsDraw = Number(config.pointsDraw ?? 1);
  const pointsLoss = Number(config.pointsLoss ?? 0);

  const statsMap = {};
  group.playerIds.forEach(pId => {
    const player = participantsMap[pId] || { name: 'مشارك', team: '—' };
    statsMap[pId] = {
      playerId: pId,
      name: player.name,
      team: player.team,
      room: player.room,
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
      if (m.walkoverWinnerId === p1.playerId) {
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
 * Generate Fully Connected Hierarchical Knockout Bracket Tree
 * Dynamically adjusts to ANY number of qualifiers (4, 8, 16, 32, 64)
 */
export function generateKnockoutTree(groups, allMatches, participantsMap, config) {
  const qualifiersPerGroup = Number(config.qualifiersPerGroup) || 2;
  const qualifiers = [];

  groups.forEach((grp, idx) => {
    const standings = calculateGroupStandings(grp, allMatches, participantsMap, config);
    for (let q = 0; q < qualifiersPerGroup && q < standings.length; q++) {
      qualifiers.push({
        groupId: grp.id,
        groupName: grp.name,
        rank: q + 1,
        playerId: standings[q].playerId,
        player: participantsMap[standings[q].playerId]
      });
    }
  });

  if (qualifiers.length < 2) {
    return { bracketMatches: [], roundsConfig: [] };
  }

  // Calculate bracket power of 2 size
  let bracketSize = 2;
  while (bracketSize < qualifiers.length) {
    bracketSize *= 2;
  }
  bracketSize = Math.min(bracketSize, 64);

  // Cross-seeding: Group 1st places vs Group 2nd places
  const firsts = qualifiers.filter(q => q.rank === 1);
  const seconds = qualifiers.filter(q => q.rank === 2);
  const round1Pairings = [];

  for (let i = 0; i < bracketSize / 2; i++) {
    const p1 = firsts[i] ? firsts[i].playerId : (qualifiers[i * 2] ? qualifiers[i * 2].playerId : null);
    const p2 = seconds[i] ? seconds[i].playerId : (qualifiers[i * 2 + 1] ? qualifiers[i * 2 + 1].playerId : null);
    round1Pairings.push({ p1, p2 });
  }

  // Round Names hierarchy
  const roundDefs = [
    { size: 64, key: 'r64', title: 'دور الـ 64' },
    { size: 32, key: 'r32', title: 'دور الـ 32' },
    { size: 16, key: 'r16', title: 'دور الـ 16' },
    { size: 8, key: 'qf', title: 'ربع النهائي' },
    { size: 4, key: 'sf', title: 'نصف النهائي' },
    { size: 2, key: 'final', title: 'المباراة النهائية 🏆' }
  ];

  // Filter rounds relevant to this bracket size
  const activeRounds = roundDefs.filter(r => r.size <= bracketSize);
  const bracketMatches = [];
  let matchNumberCounter = 200;

  // Generate matches for each round and link child to parent
  let previousRoundMatches = [];

  activeRounds.forEach((rDef, rIdx) => {
    const numMatchesInRound = rDef.size / 2;
    const currentRoundMatches = [];

    for (let m = 0; m < numMatchesInRound; m++) {
      const matchId = `ko_${rDef.key}_${m + 1}`;
      let p1 = null;
      let p2 = null;

      if (rIdx === 0) {
        // First round gets direct qualifiers
        const pair = round1Pairings[m] || { p1: null, p2: null };
        p1 = pair.p1;
        p2 = pair.p2;
      }

      const matchObj = {
        id: matchId,
        matchNumber: matchNumberCounter++,
        stage: rDef.key,
        roundIndex: rIdx,
        matchIndexInRound: m,
        title: `${rDef.title} - مباراة ${m + 1}`,
        player1Id: p1,
        player2Id: p2,
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
        nextMatchSlot: null // 1 or 2
      };

      currentRoundMatches.push(matchObj);
      bracketMatches.push(matchObj);
    }

    // Link previous round to current round
    if (previousRoundMatches.length > 0) {
      previousRoundMatches.forEach((prevMatch, pIdx) => {
        const targetParentIdx = Math.floor(pIdx / 2);
        const targetSlot = (pIdx % 2) + 1; // 1 or 2
        const parentMatch = currentRoundMatches[targetParentIdx];
        if (parentMatch) {
          prevMatch.nextMatchId = parentMatch.id;
          prevMatch.nextMatchSlot = targetSlot;
        }
      });
    }

    previousRoundMatches = currentRoundMatches;
  });

  return { bracketMatches, roundsConfig: activeRounds };
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
