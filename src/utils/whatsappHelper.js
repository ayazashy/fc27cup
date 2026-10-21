/**
 * WhatsApp Match Reminder Helper Utilities
 * Generates pre-filled reminders for participants with match number, opponent, and estimated time
 */

export function cleanWhatsAppPhone(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) clean = clean.substring(1);
  if (clean.startsWith('05')) clean = '966' + clean.substring(1);
  else if (clean.startsWith('5') && clean.length === 9) clean = '966' + clean;
  return clean.replace(/\D/g, '');
}

export function formatEstimatedTimeStr(match) {
  if (match.status === 'live') {
    return 'المباراة جارية الآن على الجهاز! يرجى الحضور فوراً 🟢';
  }
  if (match.fixedSchedule?.timeStr) {
    return `${match.fixedSchedule.timeStr} (الموعد المقرر)`;
  }
  if (match.estimatedTime && match.estimatedTime.rangeStr && match.estimatedTime.rangeStr !== 'مجدولة') {
    return `${match.estimatedTime.rangeStr} (تقريبياً)`;
  }
  return 'المباراة التالية في طابور الجهاز - يرجى التواجد بالصالة للاستعداد ⏳';
}

export function generateMatchReminderText({ player, opponent, match, customNote = '' }) {
  const pName = player?.name || 'البطل';
  const oppName = opponent?.name ? `${opponent.name} (${opponent.team || '—'})` : 'المنافس';
  const consoleNum = match?.consoleId || '—';
  const matchNum = match?.matchNumber || '—';
  const timeStr = formatEstimatedTimeStr(match);
  const dayStr = match?.dayNumber ? `اليوم ${match.dayNumber}` : '';
  const groupOrStage = match?.groupName || match?.title || 'مرحلة المجموعات';

  let msg = `السلام عليكم يا ${pName} 👋\n`;
  msg += `تذكير بمباراتك في كأس السكن FC27 🎮🏆\n\n`;
  msg += `📌 المباراة #${matchNum} (${groupOrStage}${dayStr ? ' • ' + dayStr : ''})\n`;
  msg += `⚔️ المنافس: ${oppName}\n`;
  msg += `🎮 الجهاز: جهاز ${consoleNum}\n`;
  msg += `⏰ الموعد المتوقع: ${timeStr}\n`;
  msg += `📍 صالة الأنشطة الطلابية\n`;

  if (customNote && customNote.trim()) {
    msg += `\n💬 ملاحظة: ${customNote.trim()}\n`;
  }

  msg += `\nيرجى التواجد قبل الموعد بـ 5 دقائق. بالتوفيق! ⚽🔥`;

  return msg;
}

/**
 * Strict Full URL Percent-Encoder (Encodes entire text including all Arabic, spaces, emojis, punctuation)
 * Produces 100% ASCII percent-encoded hex string like %D8%A7%20%3D%0A with zero direct non-ASCII chars
 */
export function encodeFullPercentUrl(str) {
  if (!str) return '';
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

export function buildWhatsAppUrl(phone, messageText) {
  const cleaned = cleanWhatsAppPhone(phone);
  const encodedText = encodeFullPercentUrl(messageText);
  return `https://wa.me/${cleaned}?text=${encodedText}`;
}

export function buildApiWhatsAppUrl(phone, messageText) {
  const cleaned = cleanWhatsAppPhone(phone);
  const encodedText = encodeFullPercentUrl(messageText);
  return `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodedText}`;
}
