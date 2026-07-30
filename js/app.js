/**
 * app.js - Main Application Logic, Dynamic Interactivity & Executive Features
 */

(function () {
  'use strict';

  // State Management
  let allRecords = window.DOSSIER_DATA || [];
  let filteredRecords = [...allRecords];
  let currentPage = 1;
  const pageSize = 20;
  let activePeriodType = 'date'; // 'date', 'week', 'month' for Section VIII

  let timelineChartInstance = null;
  let khuphoChartInstance = null;

  // DOM Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const printReportBtn = document.getElementById('printReportBtn');
  const liveClockDisplay = document.getElementById('liveClockDisplay');

  // Real-time Sheet Sync Elements
  const syncSheetBtn = document.getElementById('syncSheetBtn');
  const syncSheetText = document.getElementById('syncSheetText');
  const sheetSyncBadge = document.getElementById('sheetSyncBadge');
  const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQl_XxFv-5zt2_IAgiKoZHEyzFD3KKGv5WYoJqWqk6lCXkmJEe8ioTT4DD2EfPlQZWYgQ9n1ckVg6KT/pub?gid=0&single=true&output=csv';

  const searchInput = document.getElementById('searchInput');
  const phankhuSelect = document.getElementById('phankhuSelect');
  const trangThaiSelect = document.getElementById('trangThaiSelect');
  const ngayChuyenSelect = document.getElementById('ngayChuyenSelect');
  const resetFilterBtn = document.getElementById('resetFilterBtn');

  // KPI elements
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiApproved = document.getElementById('kpiApproved');
  const kpiApprovedPct = document.getElementById('kpiApprovedPct');
  const kpiApprovedBar = document.getElementById('kpiApprovedBar');
  
  const kpiHolding = document.getElementById('kpiHolding');
  const kpiHoldingPct = document.getElementById('kpiHoldingPct');
  const kpiHoldingBar = document.getElementById('kpiHoldingBar');

  const kpiReturned = document.getElementById('kpiReturned');
  const kpiReturnedPct = document.getElementById('kpiReturnedPct');
  const kpiReturnedBar = document.getElementById('kpiReturnedBar');

  // Modal elements
  const recordDetailModal = document.getElementById('recordDetailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDetailContent = document.getElementById('modalDetailContent');

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    startLiveClock();
    setupEventListeners();
    populateDateDropdown();
    updateChipCounts();
    updateDashboard();

    // Auto load live data from Google Sheet & set 5s real-time auto-refresh
    fetchLiveDataFromSheet(false);
    setInterval(() => fetchLiveDataFromSheet(false), 5000);
  });

  // 1. Live Clock Widget
  function startLiveClock() {
    function updateClock() {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      if (liveClockDisplay) {
        liveClockDisplay.textContent = `📅 ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // 2. Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('dossier_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
  }

  function updateThemeUI(theme) {
    if (theme === 'dark') {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Chế độ Sáng';
    } else {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Chế độ Tối';
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dossier_theme', next);
    updateThemeUI(next);
  });

  // 3. Event Listeners & Quick Chips
  function setupEventListeners() {
    searchInput.addEventListener('input', handleFilterChange);
    phankhuSelect.addEventListener('change', handleFilterChange);
    trangThaiSelect.addEventListener('change', handleFilterChange);

    if (ngayChuyenSelect) {
      ngayChuyenSelect.addEventListener('change', handleFilterChange);
    }

    resetFilterBtn.addEventListener('click', () => {
      searchInput.value = '';
      phankhuSelect.value = 'ALL';
      trangThaiSelect.value = 'ALL';
      if (ngayChuyenSelect) ngayChuyenSelect.value = 'ALL';
      
      // Reset chips UI
      document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
      const defaultChip = document.querySelector('.chip-btn[data-chip-val="ALL"]');
      if (defaultChip) defaultChip.classList.add('active');

      handleFilterChange();
    });

    // Quick Chip Buttons
    const chips = document.querySelectorAll('.chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');

        const chipType = target.getAttribute('data-chip-type');
        const chipVal = target.getAttribute('data-chip-val');

        if (chipType === 'kp') {
          phankhuSelect.value = chipVal;
          trangThaiSelect.value = 'ALL';
        } else if (chipType === 'st') {
          phankhuSelect.value = 'ALL';
          trangThaiSelect.value = chipVal === 'ALL' ? 'ALL' : (chipVal === '3.' ? '3. Hồ sơ thông qua nhận định pháp lý' : (chipVal === '1.' ? '1. Đã chuyển phòng KTHTĐT' : '2.1. Trả về chỉnh sửa lần 1'));
        }

        handleFilterChange();
      });
    });

    // Time Period Tabs for Master Section VI
    const tabs = document.querySelectorAll('#timePeriodTabs .tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        activePeriodType = target.getAttribute('data-period');
        
        // Update date/week/month dropdown & refresh filtering
        populateDateDropdown();
        if (ngayChuyenSelect) ngayChuyenSelect.value = 'ALL';
        handleFilterChange();
      });
    });

    exportCsvBtn.addEventListener('click', exportToCSV);
    if (printReportBtn) {
      printReportBtn.addEventListener('click', () => window.print());
    }
    if (syncSheetBtn) {
      syncSheetBtn.addEventListener('click', () => fetchLiveDataFromSheet(true));
    }

    // Modal Close Events
    modalCloseBtn.addEventListener('click', closeModal);
    recordDetailModal.addEventListener('click', (e) => {
      if (e.target === recordDetailModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Real-time Google Sheet Sync & Parser Logic
  async function fetchLiveDataFromSheet(isManual = false) {
    if (!sheetSyncBadge) return;

    sheetSyncBadge.className = 'sheet-sync-pill syncing';
    sheetSyncBadge.innerHTML = '🔄 Đang đồng bộ Sheet...';
    if (syncSheetBtn) syncSheetBtn.classList.add('spinning');

    try {
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`, {
        cache: 'no-cache'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const parsedRecords = parseSheetCSV(csvText);

      if (parsedRecords && parsedRecords.length > 0) {
        allRecords = parsedRecords;
        window.DOSSIER_DATA = parsedRecords;
        
        populateDateDropdown();
        updateChipCounts();
        handleFilterChange();

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        sheetSyncBadge.className = 'sheet-sync-pill';
        sheetSyncBadge.innerHTML = `🟢 Auto-Sync Live (${timeStr})`;
        
        if (isManual) {
          showNotification(`Đã đồng bộ ${parsedRecords.length.toLocaleString('vi-VN')} hồ sơ mới nhất từ Google Sheet!`);
        }
      } else {
        throw new Error('Dữ liệu CSV không hợp lệ');
      }
    } catch (err) {
      console.warn('Google Sheet Live Sync warning:', err);
      sheetSyncBadge.className = 'sheet-sync-pill offline';
      sheetSyncBadge.innerHTML = `🔴 Dữ liệu Offline (${allRecords.length.toLocaleString('vi-VN')} hồ sơ)`;
      populateDateDropdown();
      updateChipCounts();
    } finally {
      if (syncSheetBtn) syncSheetBtn.classList.remove('spinning');
    }
  }

  function parseSheetCSV(csvText) {
    const lines = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(current.trim());
        if (row.some(f => f !== '')) lines.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
    if (current !== '' || row.length > 0) {
      row.push(current.trim());
      if (row.some(f => f !== '')) lines.push(row);
    }

    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i][0] === 'STT' || lines[i].includes('STT')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) return null;

    const records = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const r = lines[i];
      if (!r || r.length === 0) continue;
      const sttVal = parseInt(r[0], 10);
      if (isNaN(sttVal)) continue;

      records.push({
        stt: sttVal,
        canBoBBT: r[1] || '',
        canBoKTHT: r[2] || '',
        ngayChuyen: r[3] || '',
        toBoiThuong: r[4] || '',
        hoTen: r[5] || '',
        diaChi: r[6] || '',
        duong: r[7] || '',
        phuong: r[8] || '',
        toBanDo: r[9] || '',
        thuaDat: r[10] || '',
        khuPho: r[11] || '',
        giaiToaMotPhan: r[12] || '',
        giaiToaToanPhan: r[13] || '',
        trangThai: r[14] || '',
        ghiChu: r[15] || '',
        phapChe: r[16] || '',
        doLuong: r[17] || '',
        trungLap: r[18] || ''
      });
    }
    return records;
  }

  function updateChipCounts() {
    const total = allRecords.length;
    const kp17 = allRecords.filter(r => r.khuPho === '17').length;
    const kp18 = allRecords.filter(r => r.khuPho === '18').length;
    const kp19 = allRecords.filter(r => r.khuPho === '19').length;
    const approved = allRecords.filter(r => r.trangThai && r.trangThai.includes('3.')).length;
    const holding = allRecords.filter(r => r.trangThai && r.trangThai.includes('1.')).length;
    const returned = allRecords.filter(r => r.trangThai && r.trangThai.includes('2.1')).length;

    const chipAll = document.querySelector('.chip-btn[data-chip-type="kp"][data-chip-val="ALL"]');
    const chip17 = document.querySelector('.chip-btn[data-chip-type="kp"][data-chip-val="17"]');
    const chip18 = document.querySelector('.chip-btn[data-chip-type="kp"][data-chip-val="18"]');
    const chip19 = document.querySelector('.chip-btn[data-chip-type="kp"][data-chip-val="19"]');
    const chipApproved = document.querySelector('.chip-btn[data-chip-type="st"][data-chip-val="3."]');
    const chipHolding = document.querySelector('.chip-btn[data-chip-type="st"][data-chip-val="1."]');
    const chipReturned = document.querySelector('.chip-btn[data-chip-type="st"][data-chip-val="2.1"]');

    if (chipAll) chipAll.textContent = `Tất cả (${total.toLocaleString('vi-VN')})`;
    if (chip17) chip17.textContent = `Khu Phố 17 (${kp17.toLocaleString('vi-VN')})`;
    if (chip18) chip18.textContent = `Khu Phố 18 (${kp18.toLocaleString('vi-VN')})`;
    if (chip19) chip19.textContent = `Khu Phố 19 (${kp19.toLocaleString('vi-VN')})`;
    if (chipApproved) chipApproved.textContent = `✅ Đã thông qua (${approved.toLocaleString('vi-VN')})`;
    if (chipHolding) chipHolding.textContent = `⏳ KTHT đang giữ (${holding.toLocaleString('vi-VN')})`;
    if (chipReturned) chipReturned.textContent = `⚠️ Trả sửa (${returned.toLocaleString('vi-VN')})`;
  }

  function showNotification(msg) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotification';
      toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: 600; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999; transition: all 0.3s ease; opacity: 0; transform: translateY(20px);';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 3500);
  }

  function populateDateDropdown() {
    if (!allRecords || allRecords.length === 0) return;

    const labelElem = document.querySelector('label[for="ngayChuyenSelect"]');
    let defaultText = 'Tất cả các Ngày';
    if (activePeriodType === 'week') {
      if (labelElem) labelElem.textContent = '🗓️ Tuần Chuyển';
      defaultText = 'Tất cả các Tuần';
    } else if (activePeriodType === 'month') {
      if (labelElem) labelElem.textContent = '📆 Tháng Chuyển';
      defaultText = 'Tất cả các Tháng';
    } else {
      if (labelElem) labelElem.textContent = '📅 Ngày Chuyển';
      defaultText = 'Tất cả các Ngày';
    }

    const map = {};
    allRecords.forEach(r => {
      if (!r.ngayChuyen || !r.ngayChuyen.trim()) return;
      let key = r.ngayChuyen.trim();
      if (activePeriodType === 'week') {
        key = Analytics.getWeekLabel(r.ngayChuyen);
      } else if (activePeriodType === 'month') {
        key = Analytics.getMonthLabel(r.ngayChuyen);
      }
      map[key] = (map[key] || 0) + 1;
    });

    let sortedKeys = Object.keys(map);
    if (activePeriodType === 'date') {
      sortedKeys.sort((a, b) => {
        const dA = Analytics.parseDate(a);
        const dB = Analytics.parseDate(b);
        if (!dA) return 1;
        if (!dB) return -1;
        return dB - dA;
      });
    } else {
      sortedKeys.sort((a, b) => b.localeCompare(a, 'vi'));
    }

    const prefix = activePeriodType === 'week' ? '🗓️ ' : (activePeriodType === 'month' ? '📆 ' : '📅 ');
    const optionsHtml = [`<option value="ALL">${defaultText}</option>`]
      .concat(sortedKeys.map(k => `<option value="${k}">${prefix}${k} (${map[k]} hồ sơ)</option>`))
      .join('');

    if (ngayChuyenSelect) {
      const val = ngayChuyenSelect.value;
      ngayChuyenSelect.innerHTML = optionsHtml;
      if (val && Array.from(ngayChuyenSelect.options).some(o => o.value === val)) {
        ngayChuyenSelect.value = val;
      } else {
        ngayChuyenSelect.value = 'ALL';
      }
    }
  }

  function handleFilterChange() {
    const query = searchInput.value.toLowerCase().trim();
    const kpFilter = phankhuSelect.value;
    const stFilter = trangThaiSelect.value;
    const dtFilter = ngayChuyenSelect ? ngayChuyenSelect.value : 'ALL';

    filteredRecords = allRecords.filter(r => {
      // 1. Phân khu filter
      if (kpFilter !== 'ALL' && String(r.khuPho).trim() !== kpFilter) return false;

      // 2. Trạng thái filter
      if (stFilter !== 'ALL') {
        if (!r.trangThai || !r.trangThai.includes(stFilter.substring(0, 2))) return false;
      }

      // 3. Ngày / Tuần / Tháng chuyển filter
      if (dtFilter !== 'ALL') {
        const rDate = r.ngayChuyen ? r.ngayChuyen.trim() : '';
        if (activePeriodType === 'week') {
          const wLabel = Analytics.getWeekLabel(rDate);
          if (wLabel !== dtFilter) return false;
        } else if (activePeriodType === 'month') {
          const mLabel = Analytics.getMonthLabel(rDate);
          if (mLabel !== dtFilter) return false;
        } else {
          if (rDate !== dtFilter && !rDate.startsWith(dtFilter)) return false;
        }
      }

      // 4. Search query filter
      if (query) {
        const text = `${r.stt} ${r.canBoBBT} ${r.canBoKTHT} ${r.hoTen} ${r.diaChi} ${r.duong} ${r.toBanDo} ${r.thuaDat} ${r.ghiChu}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });

    currentPage = 1;
    updateDashboard();
  }

  // 4. Main Dashboard Render Function
  function updateDashboard() {
    renderKPIs();
    renderCharts();
    renderSection1();
    renderSection2();
    renderSection3();
    renderSection4();
    renderSection5();
    renderSection6();
    renderSection7();
  }

  // 5. Render KPIs
  function renderKPIs() {
    const total = filteredRecords.length;
    let approved = 0;
    let holding = 0;
    let returned = 0;

    filteredRecords.forEach(r => {
      const st = r.trangThai || '';
      if (st.includes('3.') || st.includes('thông qua')) approved++;
      else if (st.includes('1.') || st.includes('Đã chuyển')) holding++;
      else if (st.includes('2.1') || st.includes('4.') || st.includes('Trả') || st.includes('chuyển sửa')) returned++;
    });

    kpiTotal.textContent = total.toLocaleString('vi-VN');
    kpiApproved.textContent = approved.toLocaleString('vi-VN');
    kpiHolding.textContent = holding.toLocaleString('vi-VN');
    kpiReturned.textContent = returned.toLocaleString('vi-VN');

    const appPct = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';
    const holdPct = total > 0 ? ((holding / total) * 100).toFixed(1) : '0.0';
    const retPct = total > 0 ? ((returned / total) * 100).toFixed(1) : '0.0';

    kpiApprovedPct.textContent = `${appPct}%`;
    kpiApprovedBar.style.width = `${appPct}%`;

    kpiHoldingPct.textContent = `${holdPct}%`;
    kpiHoldingBar.style.width = `${holdPct}%`;

    kpiReturnedPct.textContent = `${retPct}%`;
    kpiReturnedBar.style.width = `${retPct}%`;
  }

  // 6. Render Section I
  function renderSection1() {
    const data = Analytics.getLegalProgressByKhuPho(filteredRecords);
    const tbody = document.getElementById('tbodySection1');
    tbody.innerHTML = '';

    const rows = ['KP 17', 'KP 18', 'KP 19', 'TỔNG CỘNG'];
    rows.forEach(key => {
      const item = data[key];
      const tot = item.total;
      const isTotal = key === 'TỔNG CỘNG';
      const tr = document.createElement('tr');
      if (isTotal) tr.classList.add('total-row');

      const pct = (val) => tot > 0 ? `(${((val / tot) * 100).toFixed(1)}%)` : '(0.0%)';

      tr.innerHTML = `
        <td><strong>${key}</strong></td>
        <td class="text-center"><strong>${tot}</strong></td>
        <td class="text-center">${item.thongQua} <span class="pct-pill">${pct(item.thongQua)}</span></td>
        <td class="text-center">${item.kthtGiu} <span class="pct-pill">${pct(item.kthtGiu)}</span></td>
        <td class="text-center">${item.traSua} <span class="pct-pill">${pct(item.traSua)}</span></td>
        <td class="text-center">${item.chuyenSuaLai} <span class="pct-pill">${pct(item.chuyenSuaLai)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 7. Render Section II (Cán bộ BBT)
  function renderSection2() {
    const list = Analytics.getVolumeByOfficer(filteredRecords);
    const tbody = document.getElementById('tbodySection2');
    tbody.innerHTML = '';

    document.getElementById('countOfficersTag').textContent = `${list.length} Cán bộ`;

    let totalKP17 = 0, totalKP18 = 0, totalKP19 = 0, grandTotal = 0;

    list.forEach(item => {
      totalKP17 += item.kp17;
      totalKP18 += item.kp18;
      totalKP19 += item.kp19;
      grandTotal += item.total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td class="text-center">${item.kp17 || 0}</td>
        <td class="text-center">${item.kp18 || 0}</td>
        <td class="text-center">${item.kp19 || 0}</td>
        <td class="text-center"><strong>${item.total}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td>TỔNG CỘNG</td>
      <td class="text-center">${totalKP17}</td>
      <td class="text-center">${totalKP18}</td>
      <td class="text-center">${totalKP19}</td>
      <td class="text-center">${grandTotal}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // 8. Render Section III (Trạng thái)
  function renderSection3() {
    const map = Analytics.getStatusDetail(filteredRecords);
    const tbody = document.getElementById('tbodySection3');
    tbody.innerHTML = '';

    const keys = [
      '3. Hồ sơ thông qua nhận định pháp lý',
      '1. Đã chuyển phòng KTHTĐT',
      '2.1. Trả về chỉnh sửa lần 1',
      '4. Hồ sơ chuyển sửa chỉnh lại'
    ];

    let t17 = 0, t18 = 0, t19 = 0, grand = 0;

    keys.forEach(key => {
      const item = map[key] || { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
      t17 += item['KP 17'];
      t18 += item['KP 18'];
      t19 += item['KP 19'];
      grand += item.total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${key}</td>
        <td class="text-center">${item['KP 17']}</td>
        <td class="text-center">${item['KP 18']}</td>
        <td class="text-center">${item['KP 19']}</td>
        <td class="text-center"><strong>${item.total}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td>TỔNG CỘNG</td>
      <td class="text-center">${t17}</td>
      <td class="text-center">${t18}</td>
      <td class="text-center">${t19}</td>
      <td class="text-center">${grand}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // 9. Render Section IV (Giải tỏa)
  function renderSection4() {
    const stats = Analytics.getClearanceStats(filteredRecords);
    const tbody = document.getElementById('tbodySection4');
    tbody.innerHTML = '';

    const rows = [
      { label: 'Giải tỏa toàn phần (số HS)', data: stats.toanPhan },
      { label: 'Giải tỏa một phần (số HS)', data: stats.motPhan }
    ];

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.label}</td>
        <td class="text-center">${r.data['KP 17']}</td>
        <td class="text-center">${r.data['KP 18']}</td>
        <td class="text-center">${r.data['KP 19']}</td>
        <td class="text-center"><strong>${r.data.total}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 10. Render Section V (Tổ bồi thường)
  function renderSection5() {
    const map = Analytics.getCompensationTeamStats(filteredRecords);
    const tbody = document.getElementById('tbodySection5');
    tbody.innerHTML = '';

    const teams = ['Tổ 1', 'Tổ 2', 'Tổ 3'];
    let t17 = 0, t18 = 0, t19 = 0, grand = 0;

    teams.forEach(t => {
      const item = map[t] || { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
      t17 += item['KP 17'];
      t18 += item['KP 18'];
      t19 += item['KP 19'];
      grand += item.total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t}</strong></td>
        <td class="text-center">${item['KP 17']}</td>
        <td class="text-center">${item['KP 18']}</td>
        <td class="text-center">${item['KP 19']}</td>
        <td class="text-center"><strong>${item.total}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td>TỔNG CỘNG</td>
      <td class="text-center">${t17}</td>
      <td class="text-center">${t18}</td>
      <td class="text-center">${t19}</td>
      <td class="text-center">${grand}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // 11. Render Master Section VI (Thống kê chi tiết Lượng hồ sơ chuyển về theo Ngày/Tuần/Tháng x Cán bộ BBT)
  function renderSection6() {
    const isDateFiltered = ngayChuyenSelect && ngayChuyenSelect.value !== 'ALL';
    const isKhuPhoFiltered = phankhuSelect && phankhuSelect.value !== 'ALL';
    const thTimeKey = document.getElementById('thTimeKey');
    if (thTimeKey) {
      if (activePeriodType === 'week') thTimeKey.textContent = 'TUẦN CHUYỂN';
      else if (activePeriodType === 'month') thTimeKey.textContent = 'THÁNG CHUYỂN';
      else thTimeKey.textContent = 'NGÀY CHUYỂN';

      thTimeKey.style.display = isDateFiltered ? '' : 'none';
    }

    const list = Analytics.getDetailedTransferBreakdown(filteredRecords, activePeriodType, allRecords, isDateFiltered, isKhuPhoFiltered);
    const tbody = document.getElementById('tbodySection6');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      const colspanTotal = isDateFiltered ? 10 : 9;
      tbody.innerHTML = `<tr><td colspan="${colspanTotal}" class="text-center" style="padding:20px;">Không tìm thấy dữ liệu phù hợp.</td></tr>`;
      return;
    }

    let sum17 = 0, sum18 = 0, sum19 = 0;
    let sumTotal = 0, sumThongQua = 0, sumKthtGiu = 0, sumTraSua = 0;

    list.forEach((item, idx) => {
      sum17 += item.kp17;
      sum18 += item.kp18;
      sum19 += item.kp19;
      sumTotal += item.totalChuyen;
      sumThongQua += item.thongQua;
      sumKthtGiu += item.kthtGiu;
      sumTraSua += item.traSua;

      const isZero = item.totalChuyen === 0;
      const tr = document.createElement('tr');
      if (isZero) {
        tr.style.opacity = '0.75';
        tr.style.background = 'rgba(239, 68, 68, 0.03)';
      }

      const timeTd = isDateFiltered ? `<td><span class="badge badge-neutral">📅 ${item.timeKey}</span></td>` : '';

      tr.innerHTML = `
        <td class="text-center"><strong>${idx + 1}</strong></td>
        ${timeTd}
        <td><strong>${item.cbtl}</strong></td>
        <td class="text-center">${item.kp17}</td>
        <td class="text-center">${item.kp18}</td>
        <td class="text-center">${item.kp19}</td>
        <td class="text-center">${isZero ? `<span class="badge badge-danger">⚠️ 0 (Chưa bàn giao)</span>` : `<span class="badge badge-neutral">${item.totalChuyen}</span>`}</td>
        <td class="text-center">${item.thongQua > 0 ? `<span class="badge badge-success">${item.thongQua}</span>` : '0'}</td>
        <td class="text-center">${item.kthtGiu > 0 ? `<span class="badge badge-warning">${item.kthtGiu}</span>` : '0'}</td>
        <td class="text-center">${item.traSua > 0 ? `<span class="badge badge-danger">${item.traSua}</span>` : '0'}</td>
      `;
      tbody.appendChild(tr);
    });

    const colspanVal = isDateFiltered ? 3 : 2;
    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td colspan="${colspanVal}" class="text-center"><strong>TỔNG CỘNG</strong></td>
      <td class="text-center">${sum17}</td>
      <td class="text-center">${sum18}</td>
      <td class="text-center">${sum19}</td>
      <td class="text-center">${sumTotal}</td>
      <td class="text-center">${sumThongQua}</td>
      <td class="text-center">${sumKthtGiu}</td>
      <td class="text-center">${sumTraSua}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // 12. Render Section VII (Pháp chế kiểm tra)
  function renderSection7() {
    const list = Analytics.getVolumeByPhapChe(filteredRecords);
    const tbody = document.getElementById('tbodySection7');
    if (!tbody) return;
    tbody.innerHTML = '';

    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td class="text-center"><span class="badge badge-success">${item.thongQua}</span></td>
        <td class="text-center"><span class="badge badge-warning">${item.kthtGiu}</span></td>
        <td class="text-center"><strong>${item.total}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 15. Detail Modal Control
  function openModal(r) {
    let badgeClass = 'badge-neutral';
    const st = r.trangThai || '';
    if (st.includes('3.')) badgeClass = 'badge-success';
    else if (st.includes('1.')) badgeClass = 'badge-warning';
    else if (st.includes('2.1') || st.includes('4.')) badgeClass = 'badge-danger';

    modalDetailContent.innerHTML = `
      <div class="modal-field">
        <label>MÃ HỒ SƠ (STT)</label>
        <p>HS-${String(r.stt).padStart(4, '0')} (STT ${r.stt})</p>
      </div>
      <div class="modal-field">
        <label>TRẠNG THÁI PHÁP LÝ</label>
        <p><span class="badge ${badgeClass}">${r.trangThai}</span></p>
      </div>
      <div class="modal-field full-width">
        <label>HỌ VÀ TÊN CHỦ HỘ / SỬ DỤNG ĐẤT</label>
        <p style="font-size:1.1rem; color:var(--primary-blue);">${r.hoTen}</p>
      </div>
      <div class="modal-field">
        <label>CÁN BỘ BAN BỒI THƯỜNG</label>
        <p>${r.canBoBBT}</p>
      </div>
      <div class="modal-field">
        <label>CÁN BỘ THỤ LÝ KTHT</label>
        <p>${r.canBoKTHT || 'Chưa thụ lý'}</p>
      </div>
      <div class="modal-field">
        <label>NGÀY CHUYỂN KTHTĐT</label>
        <p>${r.ngayChuyen}</p>
      </div>
      <div class="modal-field">
        <label>TỔ BỒI THƯỜNG / PHÂN KHU</label>
        <p>${r.toBoiThuong} - Khu Phố ${r.khuPho}</p>
      </div>
      <div class="modal-field">
        <label>TỜ BẢN ĐỒ / THỬA ĐẤT</label>
        <p>Tờ số ${r.toBanDo} | Thửa số ${r.thuaDat}</p>
      </div>
      <div class="modal-field">
        <label>PHƯỜNG / ĐƯỜNG</label>
        <p>${r.phuong} - ${r.duong}</p>
      </div>
      <div class="modal-field full-width">
        <label>ĐỊA CHỈ THỰC TẾ CĂN NHÀ</label>
        <p>${r.diaChi || 'Không số'}</p>
      </div>
      <div class="modal-field">
        <label>GIẢI TỎA TOÀN PHẦN</label>
        <p>${r.giaiToaToanPhan ? r.giaiToaToanPhan + ' m²' : 'Không'}</p>
      </div>
      <div class="modal-field">
        <label>GIẢI TỎA MỘT PHẦN</label>
        <p>${r.giaiToaMotPhan ? r.giaiToaMotPhan + ' m²' : 'Không'}</p>
      </div>
      <div class="modal-field full-width">
        <label>GHI CHÚ VÀ DIỄN BIẾN HỒ SƠ</label>
        <p style="background:var(--bg-input); padding:10px; border-radius:6px; font-weight:500;">${r.ghiChu || 'Không có ghi chú thêm.'}</p>
      </div>
    `;

    recordDetailModal.classList.add('active');
  }

  function closeModal() {
    recordDetailModal.classList.remove('active');
  }

  // 16. Render Charts (Timeline & Doughnut)
  function renderCharts() {
    const list = Analytics.getVolumeByDate(filteredRecords);

    const sortedList = [...list].reverse();
    const labels = sortedList.map(item => item.date);
    const dataKP17 = sortedList.map(item => item.kp17);
    const dataKP18 = sortedList.map(item => item.kp18);
    const dataKP19 = sortedList.map(item => item.kp19);

    const ctxTimeline = document.getElementById('timelineChart').getContext('2d');
    if (timelineChartInstance) timelineChartInstance.destroy();

    timelineChartInstance = new Chart(ctxTimeline, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'KP 17', data: dataKP17, backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'KP 18', data: dataKP18, backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'KP 19', data: dataKP19, backgroundColor: '#818cf8', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true }
        }
      }
    });

    const progressData = Analytics.getLegalProgressByKhuPho(filteredRecords);
    const ctxKhupho = document.getElementById('khuphoChart').getContext('2d');
    if (khuphoChartInstance) khuphoChartInstance.destroy();

    khuphoChartInstance = new Chart(ctxKhupho, {
      type: 'doughnut',
      data: {
        labels: ['KP 17 (323 HS)', 'KP 18 (295 HS)', 'KP 19 (523 HS)'],
        datasets: [{
          data: [progressData['KP 17'].total, progressData['KP 18'].total, progressData['KP 19'].total],
          backgroundColor: ['#3b82f6', '#10b981', '#818cf8'],
          hoverOffset: 8,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // 17. Export CSV
  function exportToCSV() {
    if (filteredRecords.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    const headers = [
      'STT', 'Cán bộ BBT', 'Cán bộ KTHT', 'Ngày chuyển', 'Tổ bồi thường',
      'Họ và tên', 'Địa chỉ', 'Đường', 'Phường', 'Tờ bản đồ', 'Thửa đất',
      'Khu phố', 'Giải tỏa một phần (m2)', 'Giải tỏa toàn phần (m2)', 'Trạng Thái', 'Ghi chú'
    ];

    let csvContent = '\uFEFF' + headers.join(',') + '\n';

    filteredRecords.forEach(r => {
      const row = [
        r.stt,
        `"${(r.canBoBBT || '').replace(/"/g, '""')}"`,
        `"${(r.canBoKTHT || '').replace(/"/g, '""')}"`,
        `"${(r.ngayChuyen || '').replace(/"/g, '""')}"`,
        `"${(r.toBoiThuong || '').replace(/"/g, '""')}"`,
        `"${(r.hoTen || '').replace(/"/g, '""')}"`,
        `"${(r.diaChi || '').replace(/"/g, '""')}"`,
        `"${(r.duong || '').replace(/"/g, '""')}"`,
        `"${(r.phuong || '').replace(/"/g, '""')}"`,
        `"${(r.toBanDo || '').replace(/"/g, '""')}"`,
        `"${(r.thuaDat || '').replace(/"/g, '""')}"`,
        `"${(r.khuPho || '').replace(/"/g, '""')}"`,
        `"${(r.giaiToaMotPhan || '').replace(/"/g, '""')}"`,
        `"${(r.giaiToaToanPhan || '').replace(/"/g, '""')}"`,
        `"${(r.trangThai || '').replace(/"/g, '""')}"`,
        `"${(r.ghiChu || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Tien_Do_Phap_Ly_Binh_Quoi_Thanh_Da_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();
