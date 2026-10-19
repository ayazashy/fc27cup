/**
 * Tournament Engine for KSU Housing FC27 Cup
 * Handles Group Generation, Match Scheduling, Standings Calculation, and Knockout Brackets.
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
 * Generate Groups and Round-Robin Fixtures
 */
export function generateGroupsAndMatches(participants, config) {
  const playersPerGroup = Number(config.playersPerGroup) || 4;
  const activePlayers = participants.filter(p => p.status === 'confirmed');
  
  if (activePlayers.length < 2) {
    return { groups: [], matches: [] };
  }

  // Shuffle players randomly for fair draw
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

  // Generate round-robin matches for each group
  const matches = [];
  let matchCounter = 1;

  groups.forEach((grp) => {
    const pIds = grp.playerIds;
    // Round-robin pairings
    for (let i = 0; i < pIds.length; i++) {
      for (let j = i + 1; j < pIds.length; j++) {
        matches.push({
          id: `m_${grp.id}_${i}_${j}`,
          matchNumber: matchCounter++,
          stage: 'group',
          groupId: grp.id,
          groupName: grp.name,
          player1Id: pIds[i],
          player2Id: pIds[j],
          score1: null,
          score2: null,
          cards1: { yellow: 0, red: 0 },
          cards2: { yellow: 0, red: 0 },
          penalty1: null,
          penalty2: null,
          status: 'scheduled', // 'scheduled' | 'live' | 'completed' | 'walkover'
          walkoverWinnerId: null,
          consoleId: null, // assigned to Station 1..5
          startedAt: null,
          completedAt: null
        });
      }
    }
  });

  return { groups, matches };
}

/**
 * Calculate dynamic standings for a group
 */
export function calculateGroupStandings(group, allMatches, participantsMap, config) {
  const pointsWin = Number(config.pointsWin ?? 3);
  const pointsDraw = Number(config.pointsDraw ?? 1);
  const pointsLoss = Number(config.pointsLoss ?? 0);

  // Initialize table for all players in this group
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
      gf: 0, // Goals For
      ga: 0, // Goals Against
      gd: 0, // Goal Difference
      points: 0,
      yellowCards: 0,
      redCards: 0
    };
  });

  // Filter matches belonging to this group that are finished
  const groupMatches = allMatches.filter(m => m.groupId === group.id && (m.status === 'completed' || m.status === 'walkover'));

  groupMatches.forEach(m => {
    const p1 = statsMap[m.player1Id];
    const p2 = statsMap[m.player2Id];

    if (!p1 || !p2) return;

    p1.played += 1;
    p2.played += 1;

    // Card stats
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

  // Sort standings with tiebreakers
  const standingsList = Object.values(statsMap);

  standingsList.sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;

    // 2. Goal Difference
    if (b.gd !== a.gd) return b.gd - a.gd;

    // 3. Goals For
    if (b.gf !== a.gf) return b.gf - a.gf;

    // 4. Head-to-Head
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

    // 5. Fair Play (fewer penalty card points)
    const fairPlayA = (a.yellowCards * 1) + (a.redCards * 3);
    const fairPlayB = (b.yellowCards * 1) + (b.redCards * 3);
    if (fairPlayA !== fairPlayB) return fairPlayA - fairPlayB;

    return a.name.localeCompare(b.name, 'ar');
  });

  return standingsList;
}

/**
 * Generate Knockout Brackets from Group Qualifiers
 */
export function generateKnockoutBracket(groups, allMatches, participantsMap, config) {
  const qualifiersPerGroup = Number(config.qualifiersPerGroup) || 2;
  const qualifiers = [];

  groups.forEach((grp, idx) => {
    const standings = calculateGroupStandings(grp, allMatches, participantsMap, config);
    for (let q = 0; q < qualifiersPerGroup && q < standings.length; q++) {
      qualifiers.push({
        groupId: grp.id,
        groupName: grp.name,
        groupIndex: idx,
        rank: q + 1, // 1st or 2nd place
        playerId: standings[q].playerId,
        player: participantsMap[standings[q].playerId]
      });
    }
  });

  if (qualifiers.length < 2) {
    return { bracketMatches: [] };
  }

  // Determine stage size (next power of 2: e.g. 8, 16, 32, 64)
  let bracketSize = 2;
  while (bracketSize < qualifiers.length) {
    bracketSize *= 2;
  }
  // Cap at 64
  bracketSize = Math.min(bracketSize, 64);

  // Cross-seeding: 1st of Group A vs 2nd of Group B, etc.
  const seededPairings = [];
  const firsts = qualifiers.filter(q => q.rank === 1);
  const seconds = qualifiers.filter(q => q.rank === 2);

  for (let i = 0; i < firsts.length; i++) {
    const p1 = firsts[i];
    // Pick an opponent from 2nd places of another group
    const p2 = seconds[(i + 1) % (seconds.length || 1)] || null;
    seededPairings.push({ p1, p2 });
  }

  const stageName = bracketSize === 64 ? 'r64' 
    : bracketSize === 32 ? 'r32' 
    : bracketSize === 16 ? 'r16' 
    : bracketSize === 8 ? 'qf' 
    : bracketSize === 4 ? 'sf' : 'final';

  const bracketMatches = [];
  let matchIdCounter = 1;

  seededPairings.forEach((pair, idx) => {
    bracketMatches.push({
      id: `ko_${stageName}_${idx + 1}`,
      matchNumber: 100 + matchIdCounter++,
      stage: stageName,
      round: 1,
      player1Id: pair.p1 ? pair.p1.playerId : null,
      player2Id: pair.p2 ? pair.p2.playerId : null,
      score1: null,
      score2: null,
      penalty1: null,
      penalty2: null,
      cards1: { yellow: 0, red: 0 },
      cards2: { yellow: 0, red: 0 },
      status: 'scheduled',
      walkoverWinnerId: null,
      winnerId: null,
      consoleId: null,
      nextMatchId: null // link to subsequent round
    });
  });

  return { bracketMatches };
}
