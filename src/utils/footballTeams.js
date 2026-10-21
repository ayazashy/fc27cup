/**
 * Official Football Teams & Logos Dictionary for FC27 Cup
 * Top 5 Saudi Clubs (الهلال، النصر، الاتحاد، الأهلي، الشباب) + Top Global Giants
 * All other / non-trend teams cleanly fall back to DEFAULT_UNKNOWN_LOGO
 */

// Elegant, lightweight SVG data URL for unknown / unselected / other teams
export const DEFAULT_UNKNOWN_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><path d="M24 4 L38 9 L38 23 C38 32.5 32 40 24 44 C16 40 10 32.5 10 23 L10 9 Z" fill="%23F8FAFC" stroke="%2394A3B8" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="23" r="10" fill="%23E2E8F0" stroke="%2364748B" stroke-width="1.8"/><path d="M24 17 L28 20 L26.5 25 L21.5 25 L20 20 Z" fill="%2364748B"/><line x1="24" y1="17" x2="24" y2="13" stroke="%2364748B" stroke-width="1.5"/><line x1="28" y1="20" x2="32" y2="18" stroke="%2364748B" stroke-width="1.5"/><line x1="26.5" y1="25" x2="30" y2="29" stroke="%2364748B" stroke-width="1.5"/><line x1="21.5" y1="25" x2="18" y2="29" stroke="%2364748B" stroke-width="1.5"/><line x1="20" y1="20" x2="16" y2="18" stroke="%2364748B" stroke-width="1.5"/></svg>';

export const POPULAR_TEAMS = [
  // --- TOP 5 SAUDI CLUBS (VERIFIED OFFICIAL LOGOS) ---
  {
    id: 'al_hilal',
    name: 'الهلال',
    enName: 'Al Hilal',
    aliases: ['نادي الهلال', 'الهلال السعودي', 'al-hilal', 'alhilal', 'hilal'],
    logo: 'https://media.api-sports.io/football/teams/2932.png',
    fallbackColor: '#002B49',
    country: 'السعودية'
  },
  {
    id: 'al_nassr',
    name: 'النصر',
    enName: 'Al Nassr',
    aliases: ['نادي النصر', 'النصر السعودي', 'al-nassr', 'alnassr', 'nassr'],
    logo: 'https://media.api-sports.io/football/teams/2939.png',
    fallbackColor: '#FDE100',
    country: 'السعودية'
  },
  {
    id: 'al_ittihad',
    name: 'الاتحاد',
    enName: 'Al Ittihad',
    aliases: ['نادي الاتحاد', 'الاتحاد جدة', 'al-ittihad', 'alittihad', 'ittihad'],
    logo: 'https://media.api-sports.io/football/teams/2938.png',
    fallbackColor: '#FECE00',
    country: 'السعودية'
  },
  {
    id: 'al_ahli',
    name: 'الأهلي السعودي',
    enName: 'Al Ahli',
    aliases: ['الاهلي', 'الأهلي', 'نادي الاهلي', 'نادي الأهلي', 'الاهلي السعودي', 'al-ahli', 'alahli', 'ahli'],
    logo: 'https://media.api-sports.io/football/teams/2929.png',
    fallbackColor: '#006432',
    country: 'السعودية'
  },
  {
    id: 'al_shabab',
    name: 'الشباب',
    enName: 'Al Shabab',
    aliases: ['نادي الشباب', 'الشباب السعودي', 'al-shabab', 'alshabab', 'shabab'],
    logo: 'https://media.api-sports.io/football/teams/2940.png',
    fallbackColor: '#1E293B',
    country: 'السعودية'
  },

  // --- TOP GLOBAL GIANTS ---
  {
    id: 'real_madrid',
    name: 'ريال مدريد',
    enName: 'Real Madrid',
    aliases: ['ريال', 'real madrid', 'realmadrid', 'madrid'],
    logo: 'https://media.api-sports.io/football/teams/541.png',
    fallbackColor: '#FFFFFF',
    country: 'إسبانيا'
  },
  {
    id: 'barcelona',
    name: 'برشلونة',
    enName: 'Barcelona',
    aliases: ['برشا', 'بارسا', 'barcelona', 'barca', 'fc barcelona'],
    logo: 'https://media.api-sports.io/football/teams/529.png',
    fallbackColor: '#004D98',
    country: 'إسبانيا'
  },
  {
    id: 'man_city',
    name: 'مانشستر سيتي',
    enName: 'Manchester City',
    aliases: ['السيتي', 'man city', 'mancity', 'city'],
    logo: 'https://media.api-sports.io/football/teams/50.png',
    fallbackColor: '#6CABDD',
    country: 'إنجلترا'
  },
  {
    id: 'arsenal',
    name: 'أرسنال',
    enName: 'Arsenal',
    aliases: ['ارسنال', 'arsenal'],
    logo: 'https://media.api-sports.io/football/teams/42.png',
    fallbackColor: '#EF0107',
    country: 'إنجلترا'
  },
  {
    id: 'liverpool',
    name: 'ليفربول',
    enName: 'Liverpool',
    aliases: ['liverpool', 'الريدز'],
    logo: 'https://media.api-sports.io/football/teams/40.png',
    fallbackColor: '#C8102E',
    country: 'إنجلترا'
  },
  {
    id: 'bayern_munich',
    name: 'بايرن ميونخ',
    enName: 'Bayern Munich',
    aliases: ['بايرن', 'bayern', 'bayern munich', 'bayern münchen'],
    logo: 'https://media.api-sports.io/football/teams/157.png',
    fallbackColor: '#DC052D',
    country: 'ألمانيا'
  },
  {
    id: 'psg',
    name: 'باريس سان جيرمان',
    enName: 'Paris Saint-Germain',
    aliases: ['باريس', 'psg', 'paris'],
    logo: 'https://media.api-sports.io/football/teams/85.png',
    fallbackColor: '#004170',
    country: 'فرنسا'
  },

  // --- DEFAULT / OTHER OPTION ---
  {
    id: 'other_team',
    name: 'فريق آخر',
    enName: 'Other / Custom',
    aliases: ['فريق اخر', 'أخرى', 'اخري', 'غير محدد', 'unknown'],
    logo: DEFAULT_UNKNOWN_LOGO,
    fallbackColor: '#64748B',
    country: 'أخرى'
  }
];

// Helper to normalize arabic string for matching
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\w\s\u0621-\u064A]/g, '')
    .trim();
}

/**
 * Find team by name (supports Arabic, English, or alias matching)
 */
export function findTeamByName(name) {
  if (!name) return null;
  const norm = normalizeText(name);
  if (!norm) return null;

  for (const t of POPULAR_TEAMS) {
    const tNorm = normalizeText(t.name);
    const enNorm = normalizeText(t.enName);
    if (tNorm === norm || enNorm === norm) return t;

    // Check custom aliases
    if (t.aliases && Array.isArray(t.aliases)) {
      for (const al of t.aliases) {
        if (normalizeText(al) === norm) return t;
      }
    }

    // Partial contains
    if (norm.length >= 3 && (norm.includes(tNorm) || tNorm.includes(norm))) {
      return t;
    }
  }

  return null;
}

/**
 * Get logo URL for team name.
 * Returns the club logo if matched in top teams, otherwise returns DEFAULT_UNKNOWN_LOGO.
 */
export function getTeamLogoUrl(teamName) {
  const team = findTeamByName(teamName);
  if (team && team.logo) {
    return team.logo;
  }
  return DEFAULT_UNKNOWN_LOGO;
}
