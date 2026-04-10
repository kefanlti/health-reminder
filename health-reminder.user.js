// ==UserScript==
// @name         健康提醒助手 - 护眼与久坐提醒
// @namespace    https://github.com/health-reminder
// @version      1.0.0
// @description  在工作时间定时提醒护眼和避免久坐，守护你的健康
// @author       Health Reminder
// @match        *://*/*
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ========== 配置 ==========
  const DEFAULT_CONFIG = {
    eyeCareInterval: 45,   // 护眼提醒间隔（分钟）
    standUpInterval: 45,   // 久坐提醒间隔（分钟）
    workStartHour: 9,      // 工作开始时间
    workEndHour: 18,       // 工作结束时间
    enabled: true,
  };

  function getConfig() {
    return {
      eyeCareInterval: GM_getValue('eyeCareInterval', DEFAULT_CONFIG.eyeCareInterval),
      standUpInterval: GM_getValue('standUpInterval', DEFAULT_CONFIG.standUpInterval),
      workStartHour: GM_getValue('workStartHour', DEFAULT_CONFIG.workStartHour),
      workEndHour: GM_getValue('workEndHour', DEFAULT_CONFIG.workEndHour),
      enabled: GM_getValue('enabled', DEFAULT_CONFIG.enabled),
    };
  }

  // ========== 提醒文案 ==========
  const EYE_CARE_TIPS = [
    '👀 护眼时间！请看向 6 米外的物体，持续 20 秒',
    '👀 该让眼睛休息了！闭眼 20 秒，或眺望远处',
    '👀 护眼提醒：缓慢眨眼 10 次，让眼睛放松一下',
    '👀 休息一下眼睛吧！转动眼球，上下左右各看几次',
  ];

  const STAND_UP_TIPS = [
    '🧍 久坐提醒！站起来走动一下，伸展身体',
    '🧍 该活动了！起身倒杯水，顺便伸个懒腰',
    '🧍 久坐不健康！站起来做几个简单的拉伸动作吧',
    '🧍 运动时间！走动 2 分钟，活动一下肩颈',
  ];

  function randomTip(tips) {
    return tips[Math.floor(Math.random() * tips.length)];
  }

  function isWorkingHour() {
    const { workStartHour, workEndHour } = getConfig();
    const hour = new Date().getHours();
    return hour >= workStartHour && hour < workEndHour;
  }

  // ========== 弹窗提醒 UI ==========
  function hideFloatingIcon() {
    const btn = document.getElementById('hr-float-btn');
    const panel = document.getElementById('hr-panel');
    if (btn) btn.style.display = 'none';
    if (panel) panel.style.display = 'none';
  }

  function showFloatingIcon() {
    const btn = document.getElementById('hr-float-btn');
    if (btn) btn.style.display = 'flex';
  }

  function dismissOverlay(overlay) {
    if (overlay.parentNode) overlay.remove();
    showFloatingIcon();
  }

  function showReminder(message, type) {
    // 浏览器通知
    try {
      GM_notification({
        text: message,
        title: type === 'eye' ? '护眼提醒' : '久坐提醒',
        timeout: 10000,
      });
    } catch (e) { /* 通知不可用时忽略 */ }

    // 弹窗出现时隐藏悬浮图标
    hideFloatingIcon();

    // 页面内弹窗
    const overlay = document.createElement('div');
    overlay.id = 'health-reminder-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: hrFadeIn 0.3s ease;
    `;

    const bgColor = type === 'eye' ? '#e8f5e9' : '#fff3e0';
    const borderColor = type === 'eye' ? '#4caf50' : '#ff9800';
    const icon = type === 'eye' ? '👀' : '🧍';

    const card = document.createElement('div');
    card.style.cssText = `
      background: ${bgColor}; border: 2px solid ${borderColor};
      border-radius: 16px; padding: 32px 40px; max-width: 420px;
      text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      animation: hrSlideUp 0.3s ease;
    `;
    card.innerHTML = `
      <div style="font-size:48px; margin-bottom:12px;">${icon}</div>
      <div style="font-size:18px; color:#333; line-height:1.6; margin-bottom:24px;">${message}</div>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button id="hr-ok-btn" style="
          padding:10px 24px; border:none; border-radius:8px;
          background:${borderColor}; color:white; font-size:15px;
          cursor:pointer; transition:opacity 0.2s;
        ">好的，马上休息</button>
        <button id="hr-later-btn" style="
          padding:10px 24px; border:1px solid #999; border-radius:8px;
          background:white; color:#666; font-size:15px;
          cursor:pointer; transition:opacity 0.2s;
        ">5 分钟后提醒</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // 添加动画样式
    if (!document.getElementById('hr-animations')) {
      const style = document.createElement('style');
      style.id = 'hr-animations';
      style.textContent = `
        @keyframes hrFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes hrSlideUp { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      `;
      document.head.appendChild(style);
    }

    overlay.querySelector('#hr-ok-btn').addEventListener('click', () => dismissOverlay(overlay));
    overlay.querySelector('#hr-later-btn').addEventListener('click', () => {
      dismissOverlay(overlay);
      const fn = type === 'eye' ? showEyeCareReminder : showStandUpReminder;
      setTimeout(fn, 5 * 60 * 1000);
    });

    // 30 秒后自动关闭并恢复图标
    setTimeout(() => dismissOverlay(overlay), 30000);
  }

  // 每个页面每种提醒只弹一次
  let eyeShown = false;
  let standShown = false;

  function showEyeCareReminder() {
    if (!getConfig().enabled || !isWorkingHour() || eyeShown) return;
    eyeShown = true;
    showReminder(randomTip(EYE_CARE_TIPS), 'eye');
  }

  function showStandUpReminder() {
    if (!getConfig().enabled || !isWorkingHour() || standShown) return;
    standShown = true;
    showReminder(randomTip(STAND_UP_TIPS), 'standup');
  }

  // ========== 计时器管理 ==========
  let eyeTimer = null;
  let standTimer = null;

  function startTimers() {
    clearTimers();
    const { eyeCareInterval, standUpInterval } = getConfig();
    eyeTimer = setInterval(showEyeCareReminder, eyeCareInterval * 60 * 1000);
    standTimer = setInterval(showStandUpReminder, standUpInterval * 60 * 1000);
  }

  function clearTimers() {
    if (eyeTimer) { clearInterval(eyeTimer); eyeTimer = null; }
    if (standTimer) { clearInterval(standTimer); standTimer = null; }
  }

  // ========== 油猴菜单 ==========
  GM_registerMenuCommand('⏯️ 开启/关闭提醒', () => {
    const current = GM_getValue('enabled', true);
    GM_setValue('enabled', !current);
    if (!current) { startTimers(); alert('✅ 健康提醒已开启'); }
    else { clearTimers(); alert('⏸️ 健康提醒已关闭'); }
  });

  GM_registerMenuCommand('⚙️ 设置护眼间隔', () => {
    const val = prompt('请输入护眼提醒间隔（分钟）：', GM_getValue('eyeCareInterval', 45));
    if (val && !isNaN(val)) { GM_setValue('eyeCareInterval', Number(val)); startTimers(); }
  });

  GM_registerMenuCommand('⚙️ 设置久坐间隔', () => {
    const val = prompt('请输入久坐提醒间隔（分钟）：', GM_getValue('standUpInterval', 45));
    if (val && !isNaN(val)) { GM_setValue('standUpInterval', Number(val)); startTimers(); }
  });

  GM_registerMenuCommand('⚙️ 设置工作时间', () => {
    const start = prompt('工作开始时间（小时，24小时制）：', GM_getValue('workStartHour', 9));
    const end = prompt('工作结束时间（小时，24小时制）：', GM_getValue('workEndHour', 18));
    if (start && end && !isNaN(start) && !isNaN(end)) {
      GM_setValue('workStartHour', Number(start));
      GM_setValue('workEndHour', Number(end));
      alert(`✅ 工作时间已设为 ${start}:00 - ${end}:00`);
    }
  });

  GM_registerMenuCommand('📊 查看当前状态', () => {
    const c = getConfig();
    const working = isWorkingHour() ? '是' : '否';
    alert(`状态：${c.enabled ? '已开启' : '已关闭'}\n护眼间隔：${c.eyeCareInterval} 分钟\n久坐间隔：${c.standUpInterval} 分钟\n工作时间：${c.workStartHour}:00 - ${c.workEndHour}:00\n当前在工作时间：${working}`);
  });

  GM_registerMenuCommand('🧪 测试护眼提醒', () => showReminder(randomTip(EYE_CARE_TIPS), 'eye'));
  GM_registerMenuCommand('🧪 测试久坐提醒', () => showReminder(randomTip(STAND_UP_TIPS), 'standup'));

  // ========== 悬浮图标 & 控制面板 ==========
  function createFloatingIcon() {
    // 只在顶层窗口创建，避免 iframe 重复
    if (window.self !== window.top) return;
    // 防止重复创建
    if (document.getElementById('hr-float-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'hr-float-btn';
    btn.innerHTML = '💚';
    btn.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 2147483646;
      width: 36px; height: 36px; border-radius: 50%;
      background: #4caf50; color: white; font-size: 18px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

    const panel = document.createElement('div');
    panel.id = 'hr-panel';
    panel.style.cssText = `
      position: fixed; bottom: 65px; left: 20px; z-index: 2147483646;
      width: 260px; background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2); padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px; color: #333; display: none;
      animation: hrSlideUp 0.2s ease;
    `;

    function renderPanel() {
      const c = getConfig();
      const statusText = c.enabled ? '✅ 已开启' : '⏸️ 已关闭';
      const statusColor = c.enabled ? '#4caf50' : '#999';
      const working = isWorkingHour() ? '工作时间中' : '非工作时间';
      btn.innerHTML = c.enabled ? '💚' : '🩶';
      btn.style.background = c.enabled ? '#4caf50' : '#999';

      panel.innerHTML = `
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;">
          健康提醒助手
          <span style="font-size:12px; color:${statusColor};">${statusText}</span>
        </div>
        <div style="font-size:12px; color:#888; margin-bottom:12px;">🕐 ${working} (${c.workStartHour}:00-${c.workEndHour}:00)</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>👀 护眼间隔</span><span style="color:#666;">${c.eyeCareInterval} 分钟</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>🧍 久坐间隔</span><span style="color:#666;">${c.standUpInterval} 分钟</span>
          </div>
        </div>
        <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="hr-panel-btn" data-action="toggle" style="
            padding:8px; border:none; border-radius:6px; cursor:pointer; font-size:13px;
            background:${c.enabled ? '#fff3e0' : '#e8f5e9'}; color:${c.enabled ? '#e65100' : '#2e7d32'};
          ">${c.enabled ? '⏸️ 暂停提醒' : '▶️ 开启提醒'}</button>
          <div style="display:flex; gap:6px;">
            <button class="hr-panel-btn" data-action="testEye" style="
              flex:1; padding:8px; border:none; border-radius:6px; cursor:pointer;
              font-size:12px; background:#e8f5e9; color:#2e7d32;
            ">🧪 测试护眼</button>
            <button class="hr-panel-btn" data-action="testStand" style="
              flex:1; padding:8px; border:none; border-radius:6px; cursor:pointer;
              font-size:12px; background:#fff3e0; color:#e65100;
            ">🧪 测试久坐</button>
          </div>
        </div>
      `;

      panel.querySelectorAll('.hr-panel-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const action = e.currentTarget.dataset.action;
          if (action === 'toggle') {
            const cur = GM_getValue('enabled', true);
            GM_setValue('enabled', !cur);
            if (!cur) startTimers(); else clearTimers();
            renderPanel();
          } else if (action === 'testEye') {
            showReminder(randomTip(EYE_CARE_TIPS), 'eye');
          } else if (action === 'testStand') {
            showReminder(randomTip(STAND_UP_TIPS), 'standup');
          }
        });
      });
    }

    btn.addEventListener('click', () => {
      if (panel.style.display === 'none') {
        renderPanel();
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = 'none';
      }
    });

    // 拖拽支持
    let isDragging = false, offsetX, offsetY;
    btn.addEventListener('mousedown', (e) => {
      isDragging = false;
      offsetX = e.clientX - btn.getBoundingClientRect().left;
      offsetY = e.clientY - btn.getBoundingClientRect().top;
      const onMove = (ev) => {
        isDragging = true;
        btn.style.left = (ev.clientX - offsetX) + 'px';
        btn.style.bottom = 'auto';
        btn.style.top = (ev.clientY - offsetY) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  // ========== 启动（仅顶层窗口）==========
  if (window.self !== window.top) return;
  if (getConfig().enabled) {
    startTimers();
    console.log('💚 健康提醒助手已启动');
  }
  createFloatingIcon();
})();
