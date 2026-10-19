import React, { useState } from 'react';
import { Settings, Check, Award, Shield, Monitor, Cloud, Copy, CheckCheck, AlertCircle } from 'lucide-react';

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
