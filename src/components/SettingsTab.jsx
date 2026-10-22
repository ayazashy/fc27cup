import React, { useState } from 'react';
import { Settings, Check, Award, Shield, Monitor, Cloud, Copy, CheckCheck, AlertCircle, Clock, CalendarDays, RefreshCw } from 'lucide-react';
import { computeCoordHash } from '../utils/securityGate';
import { testFirestoreWriteAuthorization } from '../firebase';

export default function SettingsTab({ 
  config, 
  setConfig,
  onSaveConfig,
  onNotify
}) {
  const [copiedRules, setCopiedRules] = useState(false);
  const [isTestingAuth, setIsTestingAuth] = useState(false);
  const [authTestResult, setAuthTestResult] = useState(null);

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
    
    // 1. Strictly protect your secret document so NO ONE can read or change it online
    match /NYC1043/secret {
      allow read, write: if false;
    }

    // 2. Apply the verification check to all other collections in your database
    match /{document=**} {
      // Anyone can read your public data
      allow read: if true;
      
      // Only allow writes if the user sends the secret code matching the "s" field
      allow write: if request.resource.data.secretCode == get(/databases/$(database)/documents/NYC1043/secret).data.s;
    }
  }
}`;

  const handleTestCloudAuth = async () => {
    setIsTestingAuth(true);
    setAuthTestResult(null);
    try {
      const res = await testFirestoreWriteAuthorization();
      if (res.success) {
        setAuthTestResult({ success: true, message: 'تم التحقق بنجاح! كود التفويض مطابق تماماً لقواعد حماية Firestore ☁️✅' });
        onNotify('تم التحقق بنجاح من مطابقة كود الأمان مع قواعد Firestore السحابية!', 'success');
      } else {
        setAuthTestResult({ success: false, message: `فشل التحقق: ${res.error}` });
        onNotify(`تعذر التحقق: ${res.error}`, 'error');
      }
    } catch (err) {
      setAuthTestResult({ success: false, message: err.message });
      onNotify(`خطأ: ${err.message}`, 'error');
    } finally {
      setIsTestingAuth(false);
    }
  };

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
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      وقت انطلاق مباريات اليوم 1:
                    </label>
                    <input
                      type="time"
                      className="form-input numeric"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      value={config.dayStartTimes?.[1] || '18:00'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          dayStartTimes: { ...(prev.dayStartTimes || {}), 1: val }
                        }));
                      }}
                    />
                  </div>
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
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      وقت انطلاق مباريات اليوم 2:
                    </label>
                    <input
                      type="time"
                      className="form-input numeric"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      value={config.dayStartTimes?.[2] || '18:00'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          dayStartTimes: { ...(prev.dayStartTimes || {}), 2: val }
                        }));
                      }}
                    />
                  </div>
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
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      وقت انطلاق الإقصائيات:
                    </label>
                    <input
                      type="time"
                      className="form-input numeric"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      value={config.dayStartTimes?.knockout || '17:00'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          dayStartTimes: { ...(prev.dayStartTimes || {}), knockout: val }
                        }));
                      }}
                    />
                  </div>
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
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Public Users Auto-Update Refresh Rate */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} color="var(--ksu-green)" />
              معدل التحديث التلقائي لصفحة الجمهور (بالدقائق)
            </h3>

            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                    الفاصل الزمني لتحديث بيانات الجمهور:
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    يحدد عدد الدقائق بين كل عملية فحص وتحديث تلقائي لنتائج وجدول المباريات لدى الطلاب والزوار بدون إعادة تحميل الصفحة.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number"
                    min="1"
                    max="60"
                    className="form-input numeric"
                    style={{ width: '90px', padding: '6px 10px', fontSize: '1rem', fontWeight: 800, textAlign: 'center' }}
                    value={config.publicRefreshIntervalMinutes ?? 2}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                      handleChange('publicRefreshIntervalMinutes', val);
                    }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>دقيقة</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  خيارات سريعة جاهزة:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { mins: 1, label: '⚡ دقيقة واحدة (تحديث لحظي وسريع)' },
                    { mins: 2, label: '⏱️ دقيقتان (الافتراضي المتوازن)' },
                    { mins: 3, label: '🕒 3 دقائق' },
                    { mins: 5, label: '⏳ 5 دقائق (لتقليل استهلاك السيرفر)' },
                    { mins: 10, label: '⌛ 10 دقائق' }
                  ].map(preset => {
                    const isActive = (config.publicRefreshIntervalMinutes ?? 2) === preset.mins;
                    return (
                      <button
                        key={preset.mins}
                        type="button"
                        className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        onClick={() => handleChange('publicRefreshIntervalMinutes', preset.mins)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Status Preview Box */}
              <div style={{ 
                background: '#FFFFFF', 
                border: '1px solid #BBF7D0', 
                borderRadius: '8px', 
                padding: '10px 14px', 
                fontSize: '0.8rem', 
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '1rem' }}>ℹ️</span>
                <span>
                  <b>الحالة الحالية:</b> سيتم تنشيط التحديث التلقائي وعداد المزامنة لدى صفحة الجمهور كل <b>{(config.publicRefreshIntervalMinutes ?? 2) === 1 ? 'دقيقة واحدة' : (config.publicRefreshIntervalMinutes ?? 2) === 2 ? 'دقيقتين' : `${config.publicRefreshIntervalMinutes ?? 2} دقائق`}</b> (ما يعادل <b>{((config.publicRefreshIntervalMinutes ?? 2) * 60)} ثانية</b>).
                </span>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />

          {/* Section: Coordinator Role Security PIN */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--ksu-green)" />
              الرقم السري الخاص بمنظمي الصالات (Staff PIN)
            </h3>

            <div style={{ maxWidth: '380px', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                رمز دخول منظمي الصالات:
              </label>
              <input 
                type="password"
                className="form-input numeric"
                value={config.coordinatorPin || ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  handleChange('coordinatorPin', val);
                  if (val.trim()) {
                    const hashed = await computeCoordHash(val);
                    handleChange('coordinatorPinHash', hashed);
                  }
                }}
                placeholder="••••••••••••"
                style={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: '2px', fontSize: '1.1rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                هذا الرمز يُعطى لمنظمي الأجهزة في الصالة. يمنحهم فقط صلاحية إدارة الطابور ورصد النتائج والإحصائيات، مع إخفاء الهيدر وحجب صلاحية حذف المشاركين أو إعادة القرعة.
              </span>
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

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestCloudAuth}
                  disabled={isTestingAuth}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Cloud size={14} color="#2563EB" />
                  <span>{isTestingAuth ? 'جاري فحص الاتصال والتفويض...' : 'فحص صلاحيات الكتابة والمزامنة السحابية'}</span>
                </button>

                {authTestResult && (
                  <span style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: authTestResult.success ? '#059669' : '#DC2626' 
                  }}>
                    {authTestResult.message}
                  </span>
                )}
              </div>
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
