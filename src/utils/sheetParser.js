/**
 * Smart Google Sheet Parser for KSU Housing FC27 Cup
 * Handles raw clipboard data copied from Google Sheets / Excel / Form responses.
 */

export function parseGoogleSheetData(rawText) {
  if (!rawText || !rawText.trim()) return [];

  // Split lines
  const lines = rawText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine separator (usually \t from Google Sheets copy-paste, or comma for CSV)
  const firstLine = lines[0];
  const separator = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : '\t');

  // Parse lines into raw cell matrix
  const matrix = lines.map(line => {
    if (separator === ',') {
      // Basic CSV split
      return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    return line.split('\t').map(c => c.trim());
  });

  // Check if first row contains headers
  const headerKeywords = ['اسم', 'name', 'رقم', 'جامعي', 'id', 'جوال', 'phone', 'عمارة', 'غرفة', 'فريق', 'club', 'team'];
  const firstRowString = matrix[0].join(' ').toLowerCase();
  const hasHeader = headerKeywords.some(kw => firstRowString.includes(kw));

  let headers = [];
  let dataRows = [];

  if (hasHeader) {
    headers = matrix[0];
    dataRows = matrix.slice(1);
  } else {
    dataRows = matrix;
  }

  // Find column indices
  let colIndex = {
    name: -1,
    studentId: -1,
    phone: -1,
    room: -1,
    team: -1,
    experience: -1
  };

  if (headers.length > 0) {
    headers.forEach((h, idx) => {
      const col = h.toLowerCase();
      if ((col.includes('اسم') || col.includes('name')) && colIndex.name === -1) colIndex.name = idx;
      else if ((col.includes('جامع') || col.includes('id') || col.includes('أكاديم')) && colIndex.studentId === -1) colIndex.studentId = idx;
      else if ((col.includes('جوال') || col.includes('هاتف') || col.includes('phone') || col.includes('واتس')) && colIndex.phone === -1) colIndex.phone = idx;
      else if ((col.includes('عمار') || col.includes('غرف') || col.includes('سكن') || col.includes('room')) && colIndex.room === -1) colIndex.room = idx;
      else if ((col.includes('فريق') || col.includes('نادي') || col.includes('team') || col.includes('دوري')) && colIndex.team === -1) colIndex.team = idx;
      else if ((col.includes('خبر') || col.includes('مستو') || col.includes('exp')) && colIndex.experience === -1) colIndex.experience = idx;
    });
  }

  const parsedParticipants = [];

  dataRows.forEach((row, rowIndex) => {
    if (row.length === 0 || row.every(cell => !cell)) return;

    let name = '';
    let studentId = '';
    let phone = '';
    let room = '';
    let team = '';
    let experience = 'متوسط';

    if (hasHeader && colIndex.name !== -1) {
      name = row[colIndex.name] || '';
      studentId = colIndex.studentId !== -1 ? row[colIndex.studentId] : '';
      phone = colIndex.phone !== -1 ? row[colIndex.phone] : '';
      room = colIndex.room !== -1 ? row[colIndex.room] : '';
      team = colIndex.team !== -1 ? row[colIndex.team] : '';
      experience = colIndex.experience !== -1 ? row[colIndex.experience] : 'متوسط';
    } else {
      // Heuristic detection based on value formats
      row.forEach((val, i) => {
        const clean = val.trim();
        // Check phone (starts with 05 or 9665 or +966)
        if (/^(05|\+?9665)\d{7,8}$/.test(clean.replace(/\s+/g, '')) && !phone) {
          phone = clean;
        }
        // Check student id (numeric string usually 8-10 digits, e.g. 441012345)
        else if (/^\d{8,10}$/.test(clean) && !studentId) {
          studentId = clean;
        }
        // Check room/housing (e.g. contains عمارة or 3-digit room)
        else if ((clean.includes('عمارة') || clean.includes('غرفة') || /^\d{1,2}-\d{3}$/.test(clean)) && !room) {
          room = clean;
        }
        // Check name (first long text with spaces)
        else if (!name && clean.length > 3 && !/^\d+$/.test(clean)) {
          name = clean;
        }
        // Check team (known teams or remaining text)
        else if (!team && clean.length > 2) {
          team = clean;
        }
      });
    }

    // Fallbacks if heuristic couldn't find
    if (!name && row[0]) name = row[0];
    if (!studentId && row[1] && /^\d+$/.test(row[1])) studentId = row[1];

    if (!name.trim()) return;

    // Clean phone number for WhatsApp
    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('+966')) {
      cleanPhone = cleanPhone.substring(1);
    }

    parsedParticipants.push({
      id: `p_${Date.now()}_${rowIndex}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      studentId: studentId.trim() || `44${Math.floor(1000000 + Math.random() * 9000000)}`,
      phone: cleanPhone || '966500000000',
      displayPhone: phone.trim() || '—',
      room: room.trim() || 'سكن الطلاب',
      team: team.trim() || 'ريال مدريد',
      experience: experience.trim() || 'متوسط',
      status: 'confirmed',
      registeredAt: new Date().toISOString()
    });
  });

  return parsedParticipants;
}

/**
 * High quality realistic sample data generator based on KSU Student Housing context
 */
export function generateSampleKsuParticipants(count = 32) {
  const firstNames = ['عبدالله', 'محمد', 'سعود', 'فيصل', 'خالد', 'عبدالرحمن', 'فهد', 'عمر', 'سلطان', 'يزيد', 'بندر', 'مشاري', 'نواف', 'تركي', 'سلمان', 'حمد', 'أنس', 'ريان', 'زياد', 'إبراهيم'];
  const lastNames = ['القحطاني', 'الدوسري', 'العتيبي', 'الشمري', 'المطيري', 'الغامدي', 'الشهري', 'العنزي', 'الحربي', 'الزهراني', 'السبيعي', 'المالكي', 'السعيد', 'السهلي', 'القرني'];
  const teams = ['الهلال', 'النصر', 'الاتحاد', 'الأهلي السعودي', 'الشباب', 'ريال مدريد', 'مانشستر سيتي', 'برشلونة', 'بايرن ميونخ', 'أرسنال', 'ليفربول', 'باريس سان جيرمان'];
  const experiences = ['محترف (Div 1-2)', 'ممتاز (Div 3-4)', 'متوسط', 'عادي'];

  const sampleList = [];
  for (let i = 0; i < count; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const building = Math.floor(1 + Math.random() * 25);
    const room = Math.floor(101 + Math.random() * 320);
    const phoneDigit = Math.floor(1000000 + Math.random() * 9000000);
    const studentNum = `44${Math.floor(1000000 + Math.random() * 9000000)}`;

    sampleList.push({
      id: `sample_p_${i + 1}`,
      name: `${fn} ${ln}`,
      studentId: studentNum,
      phone: `9665${phoneDigit}`,
      displayPhone: `05${phoneDigit}`,
      room: `عمارة ${building} - غرفة ${room}`,
      team: teams[i % teams.length],
      experience: experiences[i % experiences.length],
      status: 'confirmed',
      registeredAt: new Date().toISOString()
    });
  }

  return sampleList;
}
