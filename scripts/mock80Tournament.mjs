import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { generateKnockoutTree, splitMatchesIntoDays, propagateWinnerInTree } from '../src/utils/tournamentEngine.js';
import { resolveCloudSecretToken } from '../src/firebase.js';

// Decode Firebase config dynamically
const atob = str => Buffer.from(str, 'base64').toString('binary');
const _NET_DESC = "RB1eT1Z0WkYdBR8dfnZFXmxGe3FwZ1RefVgKfkVMU0p8DVh+dl1OCw50DlVyfRJXYG9MHRMfHV5KS1d7UFJeVlEdBR8dWVwNCFxKTxFZVk1aXV5MWl5PTxFcUFIdEx8dT01QVVpcS3ZbHQUfHVlcDQhcSk8dEx8dTEtQTV5YWn1KXFRaSx0FHx1ZXA0IXEpPEVlWTVpdXkxaTEtQTV5YWhFeT08dEx8dUlpMTF5YVlFYbFpRW1pNdlsdBR8dDQoICwwHBgcJDAwOHRMfHV5PT3ZbHQUfHQ4FDQoICwwHBgcJDAwOBUhaXQUJXgcHXV4PDFoPBwhcWggKCFxcWQhaHUI=";
const raw = atob(_NET_DESC);
let s = "";
for (let i = 0; i < raw.length; i++) s += String.fromCharCode(raw.charCodeAt(i) ^ 0x3F);
const firebaseConfig = JSON.parse(s);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 80 Authentic Arabic Student Names
const FIRST_NAMES = [
  'فيصل', 'عبدالرحمن', 'سلطان', 'محمد', 'خالد', 'عمر', 'تركي', 'فهد', 'ريان', 'نواف',
  'سعود', 'عبدالعزيز', 'أحمد', 'علي', 'إبراهيم', 'صالح', 'ماجد', 'نايف', 'مشاري', 'وليد',
  'بدر', 'سلمان', 'حمزة', 'عبدالله', 'معاذ', 'ياسر', 'هشام', 'طارق', 'حمد', 'عادل',
  'منصور', 'مازن', 'باسم', 'سامي', 'فراس', 'راكان', 'ناصر', 'بندر', 'جمال', 'حسان'
];

const FAMILY_NAMES = [
  'القحطاني', 'الشهري', 'العتيبي', 'الدوسري', 'الشمري', 'الغامدي', 'المطيري', 'الزهراني',
  'الحربي', 'السبيعي', 'الخالدي', 'العنزي', 'المالكي', 'البقمي', 'الشهراني', 'الرشيدي',
  'هزازي', 'الرويلي', 'الصالح', 'الجعيد', 'السليمان', 'القرني', 'الغامدي', 'الجهني',
  'العسيري', 'الخثعمي', 'العمري', 'الحارثي', 'الثبيتي', 'الخضير', 'الفيفي', 'المرواني'
];

const POPULAR_TEAMS = [
  'الهلال', 'النصر', 'الاتحاد', 'الأهلي السعودي', 'الشباب',
  'ريال مدريد', 'مانشستر سيتي', 'أرسنال', 'برشلونة', 'بايرن ميونخ',
  'ليفربول', 'باريس سان جيرمان', 'إنتر ميلان', 'باير ليفركوزن', 'تشيلسي',
  'أتلتيكو مدريد', 'يوفنتوس', 'ميلان', 'بوروسيا دورتموند', 'توتنهام'
];

const ARABIC_LETTERS = [
  'أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي',
  'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر'
];

console.log('🚀 Starting 80 Participants & 20 Groups Mock API Generator...');

// 1. Generate 80 Participants
const participants = [];
const participantsMap = {};

for (let i = 1; i <= 80; i++) {
  const firstName = FIRST_NAMES[(i * 3 + 7) % FIRST_NAMES.length];
  const familyName = FAMILY_NAMES[(i * 5 + 13) % FAMILY_NAMES.length];
  const fullName = `${firstName} ${familyName}`;
  const team = POPULAR_TEAMS[(i - 1) % POPULAR_TEAMS.length];
  const participant = {
    id: `p_${i}`,
    name: fullName,
    team: team,
    phone: `05${String(50000000 + i * 379).slice(0, 8)}`,
    status: 'active'
  };

  participants.push(participant);
  participantsMap[participant.id] = participant;
}

console.log(`✓ Generated ${participants.length} participants.`);

// 2. Generate 20 Groups (4 participants each)
const groups = [];
for (let g = 0; g < 20; g++) {
  const letter = ARABIC_LETTERS[g];
  const groupNumber = g + 1;
  const groupPIds = [
    `p_${g * 4 + 1}`,
    `p_${g * 4 + 2}`,
    `p_${g * 4 + 3}`,
    `p_${g * 4 + 4}`
  ];

  groups.push({
    id: `grp_${groupNumber}`,
    name: `المجموعة ${groupNumber} (${letter})`,
    shortName: `المجموعة ${letter}`,
    letter: letter,
    playerIds: groupPIds,
    participantIds: groupPIds
  });
}

console.log(`✓ Generated ${groups.length} groups with 4 participants each.`);

// 3. Generate 120 Group Matches with realistic scores
// Realistic score variations designed so group champions have 7-9 points and runners up have 4-7 points
const MATCH_SCORES_PRESETS = [
  // Presets of [score1, score2] for the 6 matches of a group:
  // Match 1: P1 vs P2, Match 2: P3 vs P4, Match 3: P1 vs P3, Match 4: P2 vs P4, Match 5: P1 vs P4, Match 6: P2 vs P3
  [[3, 1], [2, 0], [2, 0], [2, 1], [4, 1], [2, 2]], // P1: 9 pts, P2: 4 pts
  [[2, 1], [1, 1], [3, 0], [3, 1], [1, 0], [1, 2]], // P1: 9 pts, P2: 6 pts
  [[1, 1], [2, 1], [2, 0], [3, 0], [3, 1], [0, 1]], // P1: 7 pts, P2: 4 pts
  [[2, 0], [0, 0], [1, 0], [2, 1], [2, 1], [1, 1]], // P1: 9 pts, P2: 7 pts
  [[3, 2], [1, 0], [4, 1], [2, 0], [1, 1], [2, 1]], // P1: 7 pts, P2: 6 pts
  [[2, 1], [3, 1], [2, 0], [1, 0], [3, 0], [0, 2]], // P1: 9 pts, P2: 6 pts
  [[0, 1], [2, 2], [3, 1], [2, 1], [2, 0], [1, 1]], // P2: 7 pts, P1: 6 pts
  [[2, 0], [1, 2], [2, 1], [2, 0], [3, 0], [3, 2]], // P1: 9 pts, P2: 6 pts
  [[1, 0], [0, 2], [3, 1], [1, 1], [2, 2], [2, 0]], // P1: 7 pts, P2: 6 pts
  [[3, 1], [1, 0], [2, 0], [2, 1], [4, 0], [1, 1]], // P1: 9 pts, P2: 7 pts
];

const groupMatches = [];
let matchIdCounter = 1;

groups.forEach((grp, gIdx) => {
  const [p1, p2, p3, p4] = grp.participantIds;
  const preset = MATCH_SCORES_PRESETS[gIdx % MATCH_SCORES_PRESETS.length];

  // 6 Round-robin matches
  const roundConfigs = [
    { r: 1, pA: p1, pB: p2, s: preset[0] },
    { r: 1, pA: p3, pB: p4, s: preset[1] },
    { r: 2, pA: p1, pB: p3, s: preset[2] },
    { r: 2, pA: p2, pB: p4, s: preset[3] },
    { r: 3, pA: p1, pB: p4, s: preset[4] },
    { r: 3, pA: p2, pB: p3, s: preset[5] }
  ];

  roundConfigs.forEach(({ r, pA, pB, s }) => {
    const s1 = s[0];
    const s2 = s[1];
    let winnerId = null;
    if (s1 > s2) winnerId = pA;
    else if (s2 > s1) winnerId = pB;

    const yellow1 = (matchIdCounter * 3) % 3;
    const yellow2 = (matchIdCounter * 7) % 3;

    groupMatches.push({
      id: `m_${matchIdCounter}`,
      matchNumber: matchIdCounter,
      stage: 'group',
      groupId: grp.id,
      groupName: grp.name,
      roundNumber: r,
      player1Id: pA,
      player2Id: pB,
      score1: s1,
      score2: s2,
      penalty1: null,
      penalty2: null,
      cards1: { yellow: yellow1, red: 0 },
      cards2: { yellow: yellow2, red: 0 },
      status: 'completed',
      walkoverWinnerId: null,
      winnerId: winnerId,
      consoleId: ((matchIdCounter - 1) % 5) + 1,
      orderOnConsole: Math.floor((matchIdCounter - 1) / 5) + 1,
      dayNumber: r === 1 ? 1 : (r === 2 ? (gIdx % 2 === 0 ? 1 : 2) : 2)
    });

    matchIdCounter++;
  });
});

console.log(`✓ Generated ${groupMatches.length} completed group matches.`);

// 4. Generate Connected Knockout Tree (Target Bracket Size: 32)
// 20 group champions + 12 best runners-up = 32 qualifiers!
const tournamentConfig = {
  tournamentTitle: 'بطولة كأس السكن: FC27',
  qualifiersPerGroup: 1,
  targetBracketSize: 32,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  consolesCount: 5,
  daysCount: 2,
  matchDurationMinutes: 15
};

const { bracketMatches, roundsConfig, bestRunnersUpData } = generateKnockoutTree(
  groups,
  groupMatches,
  participantsMap,
  tournamentConfig
);

console.log(`✓ Generated Knockout Tree with ${bracketMatches.length} matches across ${roundsConfig.length} rounds.`);
roundsConfig.forEach(r => {
  const count = bracketMatches.filter(m => m.stage === r.key).length;
  console.log(`   - ${r.title} (${r.key}): ${count} matches`);
});

console.log(`✓ Qualified Best Runners-up (${bestRunnersUpData.spotsNeeded}):`);
bestRunnersUpData.runnersUp.filter(ru => ru.isQualified).forEach(ru => {
  console.log(`   #${ru.rank} ${ru.playerName} (${ru.shortName}) - ${ru.points} pts, GD: ${ru.goalDifference > 0 ? '+' : ''}${ru.goalDifference}`);
});

// Simulate completed r32 matches and 1 live match so Green, Yellow, Grey states are actively shown
let updatedBracketMatches = [...bracketMatches];

// Complete match 1 (Console 1)
const m1 = updatedBracketMatches.find(m => m.id === 'ko_r32_1');
if (m1 && m1.player1Id && m1.player2Id) {
  m1.score1 = 3;
  m1.score2 = 1;
  m1.status = 'completed';
  m1.winnerId = m1.player1Id;
  updatedBracketMatches = propagateWinnerInTree(updatedBracketMatches, m1);
}

// Complete match 2 (Console 2) - decided by penalty shootout!
const m2 = updatedBracketMatches.find(m => m.id === 'ko_r32_2');
if (m2 && m2.player1Id && m2.player2Id) {
  m2.score1 = 2;
  m2.score2 = 2; // draw in regular time!
  m2.penalty1 = 4;
  m2.penalty2 = 5; // player 2 wins 5-4 on penalties
  m2.status = 'completed';
  m2.winnerId = m2.player2Id;
  updatedBracketMatches = propagateWinnerInTree(updatedBracketMatches, m2);
}

// Set match 6 (Console 1) to Live 🟢
const m6 = updatedBracketMatches.find(m => m.id === 'ko_r32_6');
if (m6) {
  m6.status = 'live';
}

// Combine all tournament matches
const allTournamentMatches = [...groupMatches, ...updatedBracketMatches];

// 5. Upload Full State to Firestore
const fullTournamentData = {
  participants,
  groups,
  matches: allTournamentMatches,
  config: tournamentConfig,
  secretCode: resolveCloudSecretToken(),
  updatedAt: new Date().toISOString()
};

console.log('📡 Syncing mock tournament data to Firestore document tournaments/ksu_housing_fc27_main...');
await setDoc(doc(db, 'tournaments', 'ksu_housing_fc27_main'), fullTournamentData);
console.log('🎉 SUCCESSFULLY SAVED TO FIRESTORE!');
console.log(`Summary:`);
console.log(`- Participants: ${participants.length}`);
console.log(`- Groups: ${groups.length}`);
console.log(`- Group Matches: ${groupMatches.length} (100% completed)`);
console.log(`- Knockout Matches: ${bracketMatches.length}`);
console.log(`- Total Matches: ${allTournamentMatches.length}`);
process.exit(0);
