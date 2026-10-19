import React from 'react';
import { Settings, Check, Award, Shield, Monitor } from 'lucide-react';

export default function SettingsTab({ 
  config, 
  setConfig,
  onSaveConfig,
  onNotify
}) {
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

  return (
    <div className="tab-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
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
                  <option value={4}>4 لاعبين (الموصى به - النظام الرسمي)</option>
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
