import React, { useState } from 'react';
import { Settings, Check, Award, Shield, Monitor, Cloud, Copy, CheckCheck, AlertCircle, Clock, CalendarDays } from 'lucide-react';

export default function SettingsTab({ 
  config, 
  setConfig,
  onSaveConfig,
  onNotify
}) {
  const [copiedRules, setCopiedRules] = useState(false);

  const handleChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    onSaveConfig();
    onNotify('تم حفظ وتطبيق إعدادات البطولة بنجاح', 'success');
  };

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesText);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 3000);
    onNotify('تم نسخ قواعد حماية Firestore إلى الحافظة!', 'info');
  };

  return (
    <div className="tab-content" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div className="clean-card">
        <div className="card-header">
          <div className="card-title">
            <Settings size={20} color="var(--ksu-green)" />
            <span>قواعد وإعدادات نظام البطولة</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section: Groups Configuration */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--ksu-green)" />
              نظام المجموعات والتأهل
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  عدد اللاعبين في كل مجموعة:
                </label>
                <select 
                  className="form-select"
                  value={config.playersPerGroup}
                  onChange={(e) => handleChange('playersPerGroup', Number(e.target.value))}
                >
                  <option value={3}>3 لاعبين</option>
                  <option value={4}>4 لاعبين (الموصى به - النظام الرسمي لـ 128 لاعب)</option>
                  <option value={5}>5 لاعبين</option>
                  <option value={6}>6 لاعبين</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  يحدد توزيع المجموعات ديناميكياً أثناء إجراء القرعة
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  عدد المتأهلين من كل مجموعة:
                </label>
                <select 
                  className="form-select"
                  value={config.qualifiersPerGroup}
                  onChange={(e) => handleChange('qualifiersPerGroup', Number(e.target.value))}
                >
                  <option value={1}>المتصدر فقط (الأول)</option>
                  <option value={2}>المتصدر والوصيف (الأول والثاني - الموصى به)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  المتأهلون لشجرة خروج المغلوب الإقصائية
                </span>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Points System */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="var(--trophy-gold)" />
              نظام احتساب النقاط
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  نقاط الفوز:
                </label>
                <input 
                  type="number"
                  min="1"
                  max="10"
                  className="form-input numeric"
                  value={config.pointsWin}
                  onChange={(e) => handleChange('pointsWin', Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  نقاط التعادل:
                </label>
                <input 
                  type="number"
                  min="0"
                  max="5"
                  className="form-input numeric"
                  value={config.pointsDraw}
                  onChange={(e) => handleChange('pointsDraw', Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  نقاط الخسارة:
                </label>
                <input 
                  type="number"
                  min="0"
                  max="2"
                  className="form-input numeric"
                  value={config.pointsLoss}
                  onChange={(e) => handleChange('pointsLoss', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Hall Consoles Management */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={18} color="var(--ksu-green)" />
              أجهزة صالة التلفزيون
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                عدد أجهزة البلايستيشن الفعّالة بالقاعة:
              </label>
              <select 
                className="form-select"
                value={config.consolesCount}
                onChange={(e) => handleChange('consolesCount', Number(e.target.value))}
              >
                <option value={3}>3 أجهزة</option>
                <option value={4}>4 أجهزة</option>
                <option value={5}>5 أجهزة (المعتمد في محضر صالة التلفزيون)</option>
                <option value={6}>6 أجهزة</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                يتم توزيع وإسناد المباريات على هذه الأجهزة لمتابعة الصالة لحظة بلحظة
              </span>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Tournament Days Splitting */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={18} color="var(--ksu-green)" />
              جدولة وتقسيم أيام البطولة (X Days)
            </h3>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                عدد أيام إقامة البطولة:
              </label>
              <select 
                className="form-select"
                value={config.tournamentDays || 2}
                onChange={(e) => handleChange('tournamentDays', Number(e.target.value))}
              >
                <option value={1}>يوم واحد (بطولة اليوم الواحد المكثفة)</option>
                <option value={2}>يومان (نظام التناظر العكسي الذكي - الموصى به)</option>
                <option value={3}>3 أيام (جولة كاملة في كل يوم)</option>
                <option value={4}>4 أيام (3 أيام دور مجموعات + يوم نهائي إقصائيات)</option>
                <option value={5}>5 أيام (موزعة على مدار الأسبوع)</option>
              </select>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '10px 14px', fontSize: '0.8rem', color: '#166534', marginBottom: '16px' }}>
              💡 <b>مبدأ التناظر العكسي العادل (في نظام اليومين):</b> يقسم النظام المباريات بحيث يلعب 50% من الطلاب مباراتين باليوم الأول ومباراة باليوم الثاني، والـ 50% الآخرون العكس تماماً، ليصبح مجموع مباريات كل لاعب 3 مباريات بنهاية دور المجموعات بالتساوي التام.
            </div>

            {/* Sub-section: Day Dates */}
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
                🗓️ تحديد التواريخ الرسمية لأيام البطولة:
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    تاريخ اليوم الأول (Day 1):
                  </label>
                  <input 
                    type="date"
                    className="form-input numeric"
                    value={config.dayDates?.[1] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        dayDates: { ...(prev.dayDates || {}), 1: val }
                      }));
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    تاريخ اليوم الثاني (Day 2):
                  </label>
                  <input 
                    type="date"
                    className="form-input numeric"
                    value={config.dayDates?.[2] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        dayDates: { ...(prev.dayDates || {}), 2: val }
                      }));
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    تاريخ يوم الإقصائيات النهائي:
                  </label>
                  <input 
                    type="date"
                    className="form-input numeric"
                    value={config.dayDates?.knockout || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        dayDates: { ...(prev.dayDates || {}), knockout: val }
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Active Day Override selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  التحكم باليوم النشط للصالة (Active Day Override):
                </label>
                <select 
                  className="form-select"
                  value={config.activeDayOverride ?? 'auto'}
                  onChange={(e) => {
                    const val = e.target.value === 'auto' ? null : Number(e.target.value);
                    setConfig(prev => ({ ...prev, activeDayOverride: val }));
                  }}
                >
                  <option value="auto">تلقائي بحسب تاريخ اليوم الحالي (موصى به)</option>
                  <option value="1">تفعيل اليوم 1 يدوياً الآن</option>
                  <option value="2">تفعيل اليوم 2 يدوياً الآن</option>
                  <option value="3">تفعيل اليوم 3 يدوياً الآن</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  اليوم النشط تظهر مبارياته بالأخضر، بينما الأيام المستقبلية تظهر كمجدولة قيد الانتظار
                </span>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Match Duration & Estimated Times */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--ksu-green)" />
              حساب أوقات الانتظار والموعد المتوقع للمباريات
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  الحد الأدنى لمدة المباراة (بالدقائق):
                </label>
                <input 
                  type="number"
                  min="5"
                  max="30"
                  className="form-input numeric"
                  value={config.minMatchDuration || 10}
                  onChange={(e) => handleChange('minMatchDuration', Number(e.target.value))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  المدة المتوقعة في حال انتهاء الشوطين دون تمديد (افتراضي: 10 دقائق)
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                  الحد الأقصى لمدة المباراة (بالدقائق):
                </label>
                <input 
                  type="number"
                  min="8"
                  max="45"
                  className="form-input numeric"
                  value={config.maxMatchDuration || 15}
                  onChange={(e) => handleChange('maxMatchDuration', Number(e.target.value))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  يشمل وقت التبديلات والأشواط الإضافية أو ركلات الجزاء (افتراضي: 15 دقيقة)
                </span>
              </div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '10px 14px', fontSize: '0.8rem', color: '#166534' }}>
              💡 <b>المعادلة الذكية للموعد التقديري:</b> يتم ضرب ترتيب المباراة في طابور الجهاز الحالي بالحد الأدنى والأقصى لمدة المباراة وإضافتهما إلى التوقيت الفعلي الآن، فيظهر للطالب التوقيت التقديري المتوقع لوصول دوره بتنسيق <code>hh:mm - hh:mm</code> على الشاشة وهاتفه.
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Firebase Cloud Status & Rules */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={18} color="#2563EB" />
              إعدادات قاعدة بيانات Firebase Firestore
            </h3>

            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>قواعد الأمان (Firestore Security Rules):</span>
                <button className="btn btn-secondary btn-sm" onClick={handleCopyRules}>
                  {copiedRules ? <CheckCheck size={14} color="#10B981" /> : <Copy size={14} />}
                  <span>{copiedRules ? 'تم النسخ!' : 'نسخ القواعد'}</span>
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                إذا ظهر تنبيه نقص الصلاحيات (Missing permissions)، الصق هذا الكود في تبويب Rules بقنصل Firebase:
              </p>
              <pre style={{ direction: 'ltr', background: '#FFFFFF', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-strong)', overflowX: 'auto' }}>
                {firestoreRulesText}
              </pre>
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={18} />
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
