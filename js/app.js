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
  const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQl_XxFv-5zt2_IAgiKoZHEyzFD3KKGv5WYoJqWqk6lCXkmJEe8ioTT4DD2EfPlQZWYgQ9n1ckVg6KT/pub?gid=0&single=true&output=csv';
  const TABLE_VII_DAILY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmNo6_kkbQy6pA-VjrYbhZpDuVCZRA76oFKQorBxnOSwiIg8GMbGS6E6phfzFDbhxu4ZXnRd_wVScN/pub?gid=0&single=true&output=csv';
  const TABLE_VII_WEEKLY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmNo6_kkbQy6pA-VjrYbhZpDuVCZRA76oFKQorBxnOSwiIg8GMbGS6E6phfzFDbhxu4ZXnRd_wVScN/pub?gid=199224610&single=true&output=csv';

  const searchInput = document.getElementById('searchInput');
  const phankhuSelect = document.getElementById('phankhuSelect');
  const trangThaiSelect = document.getElementById('trangThaiSelect');
  const ngayChuyenSelect = document.getElementById('ngayChuyenSelect');
  const datePickerInput = document.getElementById('datePickerInput');
  const ngayTraSelect = document.getElementById('ngayTraSelect');
  const datePickerTraInput = document.getElementById('datePickerTraInput');
  const resetFilterBtn = document.getElementById('resetFilterBtn');

  // Toolbar VII elements
  const searchInput7 = document.getElementById('searchInput7');
  const phankhuSelect7 = document.getElementById('phankhuSelect7');
  const trangThaiSelect7 = document.getElementById('trangThaiSelect7');
  const ngayChuyenSelect7 = document.getElementById('ngayChuyenSelect7');
  const datePickerInput7 = document.getElementById('datePickerInput7');
  const ngayTraSelect7 = document.getElementById('ngayTraSelect7');
  const datePickerTraInput7 = document.getElementById('datePickerTraInput7');
  const resetFilterBtn7 = document.getElementById('resetFilterBtn7');

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

  // Detect environment: GitHub Pages vs Local
  // Trên GitHub Pages, KHÔNG fetch trực tiếp từ Google Sheet (CORS/cache không ổn định).
  // Thay vào đó, chỉ tải lại js/data.js mỗi 5 phút (GitHub Actions đã sync sẵn).
  const IS_GITHUB_PAGES = !(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === ''
  );

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    startLiveClock();
    setupEventListeners();
    handleResetAll();
    populateDateDropdown();
    updateChipCounts();
    updateDashboard();

    if (IS_GITHUB_PAGES) {
      // Trên GitHub Pages: chỉ reload js/data.js mỗi 5 phút để lấy dữ liệu mới nhất từ GitHub Actions
      setInterval(() => reloadDataJs(), 5 * 60 * 1000);
      if (sheetSyncBadge) {
        sheetSyncBadge.className = 'sheet-sync-pill';
        sheetSyncBadge.innerHTML = `🟢 Dữ liệu đã đồng bộ (${(window.DOSSIER_DATA||[]).length.toLocaleString('vi-VN')} hồ sơ)`;
      }
    } else {
      // Trên Local: fetch live từ Google Sheet mỗi 20 giây
      fetchLiveDataFromSheet(false);
      setInterval(() => fetchLiveDataFromSheet(false), 20000);
    }
  });

  // Tải lại js/data.js mới nhất từ GitHub (dùng cho GitHub Pages)
  async function reloadDataJs() {
    try {
      const resp = await fetch(`js/data.js?t=${Date.now()}`, { cache: 'no-cache' });
      if (!resp.ok) return;
      const text = await resp.text();
      (new Function(text))();
      // Cập nhật lại allRecords từ DOSSIER_DATA mới
      const newRecords = window.DOSSIER_DATA || [];
      if (newRecords.length > 0 && newRecords.length >= allRecords.length * 0.9) {
        allRecords = newRecords;
        populateDateDropdown();
        updateChipCounts();
        handleFilterChange();
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        if (sheetSyncBadge) {
          sheetSyncBadge.className = 'sheet-sync-pill';
          sheetSyncBadge.innerHTML = `🟢 Auto-Sync (${newRecords.length.toLocaleString('vi-VN')} HS - ${timeStr})`;
        }
      }
    } catch(e) {
      console.warn('reloadDataJs warning:', e);
    }
  }

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

  function syncFilterControls(source) {
    if (source === 'toolbar7') {
      if (searchInput && searchInput7) searchInput.value = searchInput7.value;
      if (phankhuSelect && phankhuSelect7) phankhuSelect.value = phankhuSelect7.value;
      if (trangThaiSelect && trangThaiSelect7) trangThaiSelect.value = trangThaiSelect7.value;
      if (ngayChuyenSelect && ngayChuyenSelect7) ngayChuyenSelect.value = ngayChuyenSelect7.value;
      if (datePickerInput && datePickerInput7) datePickerInput.value = datePickerInput7.value;
      if (ngayTraSelect && ngayTraSelect7) ngayTraSelect.value = ngayTraSelect7.value;
      if (datePickerTraInput && datePickerTraInput7) datePickerTraInput.value = datePickerTraInput7.value;
    } else {
      if (searchInput && searchInput7) searchInput7.value = searchInput.value;
      if (phankhuSelect && phankhuSelect7) phankhuSelect7.value = phankhuSelect.value;
      if (trangThaiSelect && trangThaiSelect7) trangThaiSelect7.value = trangThaiSelect.value;
      if (ngayChuyenSelect && ngayChuyenSelect7) ngayChuyenSelect7.value = ngayChuyenSelect.value;
      if (datePickerInput && datePickerInput7) datePickerInput7.value = datePickerInput.value;
      if (ngayTraSelect && ngayTraSelect7) ngayTraSelect7.value = ngayTraSelect.value;
      if (datePickerTraInput && datePickerTraInput7) datePickerTraInput7.value = datePickerTraInput.value;
    }
  }

  // 3. Event Listeners & Quick Chips
  function setupEventListeners() {
    const triggerSyncAndFilter = (source) => {
      syncFilterControls(source);
      handleFilterChange();
    };

    // Toolbar VI Listeners
    if (searchInput) searchInput.addEventListener('input', () => triggerSyncAndFilter('toolbar6'));
    if (phankhuSelect) phankhuSelect.addEventListener('change', () => triggerSyncAndFilter('toolbar6'));
    if (trangThaiSelect) trangThaiSelect.addEventListener('change', () => triggerSyncAndFilter('toolbar6'));

    // Toolbar VII Listeners
    if (searchInput7) searchInput7.addEventListener('input', () => triggerSyncAndFilter('toolbar7'));
    if (phankhuSelect7) phankhuSelect7.addEventListener('change', () => triggerSyncAndFilter('toolbar7'));
    if (trangThaiSelect7) trangThaiSelect7.addEventListener('change', () => triggerSyncAndFilter('toolbar7'));

    // Date Dropdown Listeners
    const handleDateSelectChange = (sourceElem) => {
      const val = sourceElem.value;
      const isChuyen = sourceElem === ngayChuyenSelect || sourceElem === ngayChuyenSelect7;

      if (isChuyen && val !== 'ALL') {
        if (ngayTraSelect) ngayTraSelect.value = 'ALL';
        if (ngayTraSelect7) ngayTraSelect7.value = 'ALL';
        if (datePickerTraInput) datePickerTraInput.value = '';
        if (datePickerTraInput7) datePickerTraInput7.value = '';
      } else if (!isChuyen && val !== 'ALL') {
        if (ngayChuyenSelect) ngayChuyenSelect.value = 'ALL';
        if (ngayChuyenSelect7) ngayChuyenSelect7.value = 'ALL';
        if (datePickerInput) datePickerInput.value = '';
        if (datePickerInput7) datePickerInput7.value = '';
      }

      let targetPicker = null;
      if (sourceElem === ngayChuyenSelect) targetPicker = datePickerInput;
      else if (sourceElem === ngayChuyenSelect7) targetPicker = datePickerInput7;
      else if (sourceElem === ngayTraSelect) targetPicker = datePickerTraInput;
      else if (sourceElem === ngayTraSelect7) targetPicker = datePickerTraInput7;

      if (targetPicker) {
        if (val && val.includes('/')) {
          const parts = val.split('/');
          if (parts.length === 3) {
            targetPicker.value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (val === 'ALL') {
          targetPicker.value = '';
        }
      }
      syncFilterControls(sourceElem.id.includes('7') ? 'toolbar7' : 'toolbar6');
      updateDateFilterVisibility();
      handleFilterChange();
    };

    if (ngayChuyenSelect) ngayChuyenSelect.addEventListener('change', () => handleDateSelectChange(ngayChuyenSelect));
    if (ngayChuyenSelect7) ngayChuyenSelect7.addEventListener('change', () => handleDateSelectChange(ngayChuyenSelect7));

    if (ngayTraSelect) ngayTraSelect.addEventListener('change', () => handleDateSelectChange(ngayTraSelect));
    if (ngayTraSelect7) ngayTraSelect7.addEventListener('change', () => handleDateSelectChange(ngayTraSelect7));

    // Date Picker Listeners
    const handleDatePickerChange = (sourcePicker) => {
      const val = sourcePicker.value; // YYYY-MM-DD
      const isChuyenPicker = sourcePicker === datePickerInput || sourcePicker === datePickerInput7;

      if (isChuyenPicker && val) {
        if (ngayTraSelect) ngayTraSelect.value = 'ALL';
        if (ngayTraSelect7) ngayTraSelect7.value = 'ALL';
        if (datePickerTraInput) datePickerTraInput.value = '';
        if (datePickerTraInput7) datePickerTraInput7.value = '';
      } else if (!isChuyenPicker && val) {
        if (ngayChuyenSelect) ngayChuyenSelect.value = 'ALL';
        if (ngayChuyenSelect7) ngayChuyenSelect7.value = 'ALL';
        if (datePickerInput) datePickerInput.value = '';
        if (datePickerInput7) datePickerInput7.value = '';
      }

      let targetSelect = null;
      if (sourcePicker === datePickerInput) targetSelect = ngayChuyenSelect;
      else if (sourcePicker === datePickerInput7) targetSelect = ngayChuyenSelect7;
      else if (sourcePicker === datePickerTraInput) targetSelect = ngayTraSelect;
      else if (sourcePicker === datePickerTraInput7) targetSelect = ngayTraSelect7;

      if (!val) {
        if (targetSelect) targetSelect.value = 'ALL';
        syncFilterControls(sourcePicker.id.includes('7') ? 'toolbar7' : 'toolbar6');
        updateDateFilterVisibility();
        handleFilterChange();
        return;
      }

      const parts = val.split('-');
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
        
        if (activePeriodType !== 'date') {
          activePeriodType = 'date';
          document.querySelectorAll('#timePeriodTabs .tab-btn, #timePeriodTabs7 .tab-btn').forEach(t => {
            if (t.getAttribute('data-period') === 'date') t.classList.add('active');
            else t.classList.remove('active');
          });
          populateDateDropdown();
        }

        const updateSelectOption = (sel) => {
          if (!sel) return;
          const hasOption = Array.from(sel.options).some(o => o.value === formattedDate);
          if (hasOption) {
            sel.value = formattedDate;
          } else {
            const newOpt = document.createElement('option');
            newOpt.value = formattedDate;
            newOpt.textContent = `📅 ${formattedDate}`;
            sel.appendChild(newOpt);
            sel.value = formattedDate;
          }
        };

        if (sourcePicker === datePickerInput || sourcePicker === datePickerInput7) {
          updateSelectOption(ngayChuyenSelect);
          updateSelectOption(ngayChuyenSelect7);
        } else {
          updateSelectOption(ngayTraSelect);
          updateSelectOption(ngayTraSelect7);
        }

        syncFilterControls(sourcePicker.id.includes('7') ? 'toolbar7' : 'toolbar6');
        handleFilterChange();
      }
    };

    if (datePickerInput) datePickerInput.addEventListener('change', () => handleDatePickerChange(datePickerInput));
    if (datePickerInput7) datePickerInput7.addEventListener('change', () => handleDatePickerChange(datePickerInput7));

    if (datePickerTraInput) datePickerTraInput.addEventListener('change', () => handleDatePickerChange(datePickerTraInput));
    if (datePickerTraInput7) datePickerTraInput7.addEventListener('change', () => handleDatePickerChange(datePickerTraInput7));

    if (resetFilterBtn) resetFilterBtn.addEventListener('click', handleResetAll);
    if (resetFilterBtn7) resetFilterBtn7.addEventListener('click', handleResetAll);

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

    // Time Period Tabs for Master Section VI & VII
    const tabBtns = document.querySelectorAll('#timePeriodTabs .tab-btn, #timePeriodTabs7 .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        activePeriodType = target.getAttribute('data-period');
        
        // Sync active class across all tab groups
        document.querySelectorAll('#timePeriodTabs .tab-btn, #timePeriodTabs7 .tab-btn').forEach(t => {
          if (t.getAttribute('data-period') === activePeriodType) {
            t.classList.add('active');
          } else {
            t.classList.remove('active');
          }
        });

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

  let lastRecordsHash = '';

  // Real-time Google Sheet Sync & Parser Logic (Smart Data Preservation & Guard)
  async function fetchLiveDataFromSheet(isManual = false) {
    if (!sheetSyncBadge) return;

    if (isManual) {
      sheetSyncBadge.className = 'sheet-sync-pill syncing';
      sheetSyncBadge.innerHTML = '🔄 Đang đồng bộ Sheet...';
      if (syncSheetBtn) syncSheetBtn.classList.add('spinning');
    }

    try {
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`, {
        cache: 'no-cache'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const parsedRecords = parseSheetCSV(csvText);

      // Safeguard 1: Check if fetched dataset is valid and non-empty
      if (parsedRecords && parsedRecords.length > 0) {
        // Safeguard 2: If fetched record count is abnormally smaller than existing records (e.g. Google Sheet returned incomplete stream), preserve existing valid records!
        if (allRecords.length > 0 && parsedRecords.length < allRecords.length * 0.9) {
          console.warn(`Dữ liệu Google Sheet tải về (${parsedRecords.length} hồ sơ) ít hơn dữ liệu hiện tại (${allRecords.length} hồ sơ). Giữ nguyên dữ liệu an toàn.`);
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          sheetSyncBadge.className = 'sheet-sync-pill';
          sheetSyncBadge.innerHTML = `🟢 Giữ dữ liệu an toàn (${timeStr})`;
          return;
        }

        // Safeguard 3: Change Detection Hash
        const currentHash = `${parsedRecords.length}_${parsedRecords[0]?.stt}_${parsedRecords[parsedRecords.length - 1]?.stt}_${csvText.length}`;
        
        // If data is unchanged from previous sync, quietly update timestamp without re-rendering DOM
        if (currentHash === lastRecordsHash && !isManual && allRecords.length > 0) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          sheetSyncBadge.className = 'sheet-sync-pill';
          sheetSyncBadge.innerHTML = `🟢 Auto-Sync Live (${timeStr})`;
          return;
        }

        // Data changed or manual sync requested: Update state safely!
        lastRecordsHash = currentHash;
        allRecords = parsedRecords;
        window.DOSSIER_DATA = parsedRecords;
        
        // Also fetch latest js/data.js for pre-synced Base Workflow API counts
        try {
          const respDataJs = await fetch(`js/data.js?t=${Date.now()}`, { cache: 'no-cache' });
          if (respDataJs.ok) {
            const dataJsText = await respDataJs.text();
            (new Function(dataJsText))();
          }
        } catch (eJs) {
          console.warn('data.js reload warning:', eJs);
        }

        // Also fetch Table VII Google Sheet live
        try {
          const respVII = await fetch(`${TABLE_VII_DAILY_CSV_URL}&t=${Date.now()}`, { cache: 'no-cache' });
          if (respVII.ok) {
            const textVII = await respVII.text();
            const parsedVII = parseTableVIICSV(textVII);
            if (parsedVII && parsedVII.length > 0) {
              window.TABLE_VII_DATA_DAILY = parsedVII;
            }
          }
        } catch (eVII) {
          console.warn('Table VII Live Sync warning:', eVII);
        }

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
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      sheetSyncBadge.className = 'sheet-sync-pill';
      sheetSyncBadge.innerHTML = `🟢 Dữ liệu An toàn (${allRecords.length.toLocaleString('vi-VN')} hồ sơ - ${timeStr})`;
    } finally {
      if (syncSheetBtn) syncSheetBtn.classList.remove('spinning');
    }
  }

  function parseCSVToRows(csvText) {
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
    return lines;
  }

  function parseTableVIICSV(csvText) {
    const lines = parseCSVToRows(csvText);
    if (!lines || lines.length === 0) return [];

    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const r = lines[i];
      if (r && r.length > 0) {
        const firstCell = String(r[0]).toLowerCase();
        if (firstCell.includes('ngày') || firstCell.includes('ngay') || firstCell.includes('tuần') || firstCell.includes('tuan') || firstCell.includes('thời gian') || firstCell.includes('stt') || firstCell.includes('cán bộ') || firstCell.includes('khu phố')) {
          headerIndex = i;
          break;
        }
      }
    }
    if (headerIndex === -1) headerIndex = 0;

    const records = [];
    let currentTimeLabel = '';

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const r = lines[i];
      if (!r || r.length === 0) continue;

      const firstCell = r[0] ? r[0].trim() : '';
      if (firstCell) {
        currentTimeLabel = firstCell;
      }

      const khuPho = r[1] ? r[1].trim() : '';
      const canBo = r[2] ? r[2].trim() : '';
      const soDuyetStr = r[3] ? r[3].trim() : '';
      const soTraSuaStr = r[4] ? r[4].trim() : '';
      const ghiChu = r[5] ? r[5].trim() : '';

      if (!khuPho && !canBo && !soDuyetStr && !soTraSuaStr) continue;

      const soHsDuyet = parseInt(soDuyetStr, 10) || 0;
      const soHsTraSua = parseInt(soTraSuaStr, 10) || 0;

      records.push({
        timeKey: currentTimeLabel,
        khuPho: khuPho,
        canBo: canBo,
        soHsDuyet: soHsDuyet,
        soHsTraSua: soHsTraSua,
        tongHs: soHsDuyet + soHsTraSua,
        ghiChu: ghiChu
      });
    }

    return records;
  }

  function parseSheetCSV(csvText) {
    const lines = parseCSVToRows(csvText);
    if (!lines || lines.length === 0) return null;

    let headerIndex = -1;
    let headerRow = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] && lines[i].some(cell => cell.includes('STT'))) {
        headerIndex = i;
        headerRow = lines[i].map(c => c.trim());
        break;
      }
    }
    if (headerIndex === -1) return null;

    const colMap = {};
    headerRow.forEach((h, idx) => {
      const cleanH = h.toLowerCase().replace(/\n/g, ' ').trim();
      if (cleanH.includes('stt')) colMap.stt = idx;
      else if (cleanH.includes('cán bộ bbt') || cleanH.includes('bqlda') || cleanH.includes('thụ lý bqlda')) colMap.canBoBBT = idx;
      else if (cleanH.includes('chuyển về') || cleanH.includes('kthtđt chuyển về')) colMap.ngayKthtChuyenVe = idx;
      else if (cleanH.includes('ngày chuyển')) colMap.ngayChuyen = idx;
      else if ((cleanH.includes('cán bộ') && (cleanH.includes('ktht') || cleanH.includes('phòng ktht'))) || cleanH.includes('thụ lý phòng ktht') || cleanH.includes('thụ lý ktht')) colMap.canBoKTHT = idx;
      else if (cleanH.includes('tổ bồi thường')) colMap.toBoiThuong = idx;
      else if (cleanH.includes('mã hồ sơ') || cleanH.includes('mã hs')) colMap.maHoSo = idx;
      else if (cleanH.includes('họ và tên') || cleanH.includes('họ tên')) colMap.hoTen = idx;
      else if (cleanH.includes('địa chỉ')) colMap.diaChi = idx;
      else if (cleanH.includes('đường')) colMap.duong = idx;
      else if (cleanH.includes('phường')) colMap.phuong = idx;
      else if (cleanH.includes('tờ bản đồ')) colMap.toBanDo = idx;
      else if (cleanH.includes('thửa đất')) colMap.thuaDat = idx;
      else if (cleanH.includes('khu phố')) colMap.khuPho = idx;
      else if (cleanH.includes('một phần')) colMap.giaiToaMotPhan = idx;
      else if (cleanH.includes('toàn phần')) colMap.giaiToaToanPhan = idx;
      else if (cleanH.includes('trạng thái')) colMap.trangThai = idx;
      else if (cleanH.includes('ghi chú')) colMap.ghiChu = idx;
      else if (cleanH.includes('pháp chế')) colMap.phapChe = idx;
      else if (cleanH.includes('đo lường')) colMap.doLuong = idx;
      else if (cleanH.includes('trùng lặp')) colMap.trungLap = idx;
    });

    const records = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const r = lines[i];
      if (!r || r.length === 0) continue;

      const g = (key, def = '') => {
        const idx = colMap[key];
        return (idx !== undefined && idx < r.length) ? r[idx].trim() : def;
      };

      const sttVal = parseInt(g('stt'), 10);
      if (isNaN(sttVal)) continue;

      const maHoSoVal = g('maHoSo');
      const rec = {
        stt: sttVal,
        canBoBBT: g('canBoBBT'),
        canBoKTHT: g('canBoKTHT'),
        ngayChuyen: g('ngayChuyen'),
        ngayKthtChuyenVe: g('ngayKthtChuyenVe'),
        toBoiThuong: g('toBoiThuong'),
        maHoSo: maHoSoVal,
        hoTen: g('hoTen'),
        diaChi: g('diaChi'),
        duong: g('duong'),
        phuong: g('phuong'),
        toBanDo: g('toBanDo'),
        thuaDat: g('thuaDat'),
        khuPho: g('khuPho'),
        giaiToaMotPhan: g('giaiToaMotPhan'),
        giaiToaToanPhan: g('giaiToaToanPhan'),
        trangThai: g('trangThai'),
        ghiChu: g('ghiChu'),
        phapChe: g('phapChe'),
        doLuong: g('doLuong'),
        trungLap: g('trungLap')
      };

      if (window.BASE_JOBS_MAP && maHoSoVal) {
        const c = Analytics.removeVietnameseTones(maHoSoVal).replace(/[^A-Z0-9]/gi, '').toUpperCase();
        let foundJob = window.BASE_JOBS_MAP[c];
        if (!foundJob) {
          const m = c.match(/(\d+KP\d+)/);
          if (m) {
            const shortC = m[1];
            for (const [k, jobInfo] of Object.entries(window.BASE_JOBS_MAP)) {
              if (k.includes(shortC)) {
                foundJob = jobInfo;
                break;
              }
            }
          }
        }
        if (foundJob) {
          rec.baseJobId = foundJob.id;
          rec.baseJobName = foundJob.name;
          rec.baseStageId = foundJob.stageId;
          rec.baseStageName = foundJob.stageName;
          rec.baseOwners = foundJob.owners;
          rec.baseLink = foundJob.link;
        }
      }

      records.push(rec);
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

    const labelElems = document.querySelectorAll('label[for="ngayChuyenSelect"], label[for="ngayChuyenSelect7"]');
    let defaultText = 'Tất cả Ngày Chuyển';
    let labelText = '📅 Ngày Chuyển Đi';
    if (activePeriodType === 'week') {
      labelText = '🗓️ Tuần Chuyển Đi';
      defaultText = 'Tất cả các Tuần';
    } else if (activePeriodType === 'month') {
      labelText = '📆 Tháng Chuyển Đi';
      defaultText = 'Tất cả các Tháng';
    }
    labelElems.forEach(l => l.textContent = labelText);

    // 1. Map for ngayChuyen (Ngày chuyển đi sang KTHTĐT)
    const mapChuyen = {};
    allRecords.forEach(r => {
      if (!r.ngayChuyen || !r.ngayChuyen.trim()) return;
      let key = Analytics.normalizeDateStr(r.ngayChuyen);
      if (!key) return;
      if (activePeriodType === 'week') key = Analytics.getWeekLabel(r.ngayChuyen);
      else if (activePeriodType === 'month') key = Analytics.getMonthLabel(r.ngayChuyen);
      mapChuyen[key] = (mapChuyen[key] || 0) + 1;
    });

    if (window.TABLE_VII_DATA_DAILY && window.TABLE_VII_DATA_DAILY.length > 0) {
      window.TABLE_VII_DATA_DAILY.forEach(r => {
        if (!r.timeKey || !r.timeKey.trim()) return;
        let key = Analytics.normalizeDateStr(r.timeKey);
        if (activePeriodType === 'week') {
          key = Analytics.getWeekLabel(r.timeKey);
        } else if (activePeriodType === 'month') {
          key = Analytics.getMonthLabel(r.timeKey);
        }
        mapChuyen[key] = (mapChuyen[key] || 0) + 1;
      });
    }

    // 2. Map for ngayKthtChuyenVe (Ngày P.KTHTĐT chuyển về)
    const mapTra = {};
    allRecords.forEach(r => {
      if (!r.ngayKthtChuyenVe || !r.ngayKthtChuyenVe.trim()) return;
      let key = Analytics.normalizeDateStr(r.ngayKthtChuyenVe);
      if (!key) return;
      if (activePeriodType === 'week') key = Analytics.getWeekLabel(r.ngayKthtChuyenVe);
      else if (activePeriodType === 'month') key = Analytics.getMonthLabel(r.ngayKthtChuyenVe);
      mapTra[key] = (mapTra[key] || 0) + 1;
    });

    const sortKeys = (mapObj) => {
      let sorted = Object.keys(mapObj);
      if (activePeriodType === 'date') {
        sorted.sort((a, b) => {
          const dA = Analytics.parseDate(a);
          const dB = Analytics.parseDate(b);
          if (!dA) return 1;
          if (!dB) return -1;
          return dB - dA;
        });
      } else {
        sorted.sort((a, b) => b.localeCompare(a, 'vi'));
      }
      return sorted;
    };

    const defaultText = activePeriodType === 'week' ? 'Tất cả Tuần Chuyển' : (activePeriodType === 'month' ? 'Tất cả Tháng Chuyển' : 'Tất cả Ngày Chuyển');
    const defaultTraText = activePeriodType === 'week' ? 'Tất cả Tuần Trả' : (activePeriodType === 'month' ? 'Tất cả Tháng Trả' : 'Tất cả Ngày Trả');

    const labelChuyenText = activePeriodType === 'week' ? '🗓️ Tuần Chuyển Đi' : (activePeriodType === 'month' ? '📆 Tháng Chuyển Đi' : '📅 Ngày Chuyển Đi');
    const labelTraText = activePeriodType === 'week' ? '📤 Tuần Trả Về' : (activePeriodType === 'month' ? '📤 Tháng Trả Về' : '📤 Ngày Trả Về');

    // Dynamic Label Update for Chuyển Đi and Trả Về
    document.querySelectorAll('label[for="ngayChuyenSelect"], label[for="ngayChuyenSelect7"]').forEach(l => {
      l.textContent = labelChuyenText;
    });
    document.querySelectorAll('label[for="ngayTraSelect"], label[for="ngayTraSelect7"]').forEach(l => {
      l.textContent = labelTraText;
    });

    // Toggle Calendar Date Picker controls (only show calendar picker when mode is 'date')
    const showCalendarPicker = (activePeriodType === 'date');
    [datePickerInput, datePickerInput7, datePickerTraInput, datePickerTraInput7].forEach(picker => {
      if (picker) {
        const group = picker.closest('.filter-group');
        if (group) {
          group.style.display = showCalendarPicker ? '' : 'none';
        }
      }
    });

    // Options HTML for ngayChuyenSelect
    const optionsChuyenHtml = [`<option value="ALL">${defaultText}</option>`]
      .concat(sortKeys(mapChuyen).map(k => `<option value="${k}">${prefix}${k} (${mapChuyen[k]} hồ sơ)</option>`))
      .join('');

    // Options HTML for ngayTraSelect
    const optionsTraHtml = [`<option value="ALL">${defaultTraText}</option>`]
      .concat(sortKeys(mapTra).map(k => `<option value="${k}">${prefix}${k} (${mapTra[k]} hồ sơ)</option>`))
      .join('');

    const updateDropdown = (sel, html) => {
      if (!sel) return;
      const val = sel.value;
      sel.innerHTML = html;
      if (val && Array.from(sel.options).some(o => o.value === val)) {
        sel.value = val;
      } else {
        sel.value = 'ALL';
      }
    };

    updateDropdown(ngayChuyenSelect, optionsChuyenHtml);
    updateDropdown(ngayChuyenSelect7, optionsChuyenHtml);

    updateDropdown(ngayTraSelect, optionsTraHtml);
    updateDropdown(ngayTraSelect7, optionsTraHtml);

    updateDateFilterVisibility();
  }

  function handleResetAll() {
    if (searchInput) searchInput.value = '';
    if (phankhuSelect) phankhuSelect.value = 'ALL';
    if (trangThaiSelect) trangThaiSelect.value = 'ALL';
    if (ngayChuyenSelect) ngayChuyenSelect.value = 'ALL';
    if (datePickerInput) datePickerInput.value = '';
    if (ngayTraSelect) ngayTraSelect.value = 'ALL';
    if (datePickerTraInput) datePickerTraInput.value = '';

    if (searchInput7) searchInput7.value = '';
    if (phankhuSelect7) phankhuSelect7.value = 'ALL';
    if (trangThaiSelect7) trangThaiSelect7.value = 'ALL';
    if (ngayChuyenSelect7) ngayChuyenSelect7.value = 'ALL';
    if (datePickerInput7) datePickerInput7.value = '';
    if (ngayTraSelect7) ngayTraSelect7.value = 'ALL';
    if (datePickerTraInput7) datePickerTraInput7.value = '';

    document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
    const defaultChip = document.querySelector('.chip-btn[data-chip-val="ALL"]');
    if (defaultChip) defaultChip.classList.add('active');

    updateDateFilterVisibility();
    handleFilterChange();
  }

  function updateDateFilterVisibility() {
    const dtVal = (ngayChuyenSelect && ngayChuyenSelect.value !== 'ALL') ? ngayChuyenSelect.value : ((ngayChuyenSelect7 && ngayChuyenSelect7.value !== 'ALL') ? ngayChuyenSelect7.value : ((datePickerInput && datePickerInput.value) ? datePickerInput.value : ((datePickerInput7 && datePickerInput7.value) ? datePickerInput7.value : '')));
    const traVal = (ngayTraSelect && ngayTraSelect.value !== 'ALL') ? ngayTraSelect.value : ((ngayTraSelect7 && ngayTraSelect7.value !== 'ALL') ? ngayTraSelect7.value : ((datePickerTraInput && datePickerTraInput.value) ? datePickerTraInput.value : ((datePickerTraInput7 && datePickerTraInput7.value) ? datePickerTraInput7.value : '')));

    const isChuyenActive = Boolean(dtVal && dtVal !== 'ALL');
    const isTraActive = Boolean(traVal && traVal !== 'ALL');

    const showCalendar = (activePeriodType === 'date');

    // Chuyển Đi Filter Groups (Dropdown & Calendar Picker)
    const chuyenSelectGroups = [ngayChuyenSelect?.closest('.filter-group'), ngayChuyenSelect7?.closest('.filter-group')].filter(Boolean);
    const chuyenPickerGroups = [datePickerInput?.closest('.filter-group'), datePickerInput7?.closest('.filter-group')].filter(Boolean);

    // Trả Về Filter Groups (Dropdown & Calendar Picker)
    const traSelectGroups = [ngayTraSelect?.closest('.filter-group'), ngayTraSelect7?.closest('.filter-group')].filter(Boolean);
    const traPickerGroups = [datePickerTraInput?.closest('.filter-group'), datePickerTraInput7?.closest('.filter-group')].filter(Boolean);

    if (isChuyenActive) {
      // Chuyển Đi is ACTIVE -> Show Chuyển Đi, HIDE Trả Về
      chuyenSelectGroups.forEach(g => { g.style.display = ''; });
      chuyenPickerGroups.forEach(g => { g.style.display = showCalendar ? '' : 'none'; });

      traSelectGroups.forEach(g => { g.style.display = 'none'; });
      traPickerGroups.forEach(g => { g.style.display = 'none'; });
    } else if (isTraActive) {
      // Trả Về is ACTIVE -> Show Trả Về, HIDE Chuyển Đi
      traSelectGroups.forEach(g => { g.style.display = ''; });
      traPickerGroups.forEach(g => { g.style.display = showCalendar ? '' : 'none'; });

      chuyenSelectGroups.forEach(g => { g.style.display = 'none'; });
      chuyenPickerGroups.forEach(g => { g.style.display = 'none'; });
    } else {
      // Neither active -> Show BOTH Chuyển Đi and Trả Về
      chuyenSelectGroups.forEach(g => { g.style.display = ''; });
      traSelectGroups.forEach(g => { g.style.display = ''; });

      chuyenPickerGroups.forEach(g => { g.style.display = showCalendar ? '' : 'none'; });
      traPickerGroups.forEach(g => { g.style.display = showCalendar ? '' : 'none'; });
    }
  }

  function handleFilterChange() {
    updateDateFilterVisibility();
    const rawQuery = (searchInput ? searchInput.value : (searchInput7 ? searchInput7.value : '')).trim();
    const query = rawQuery.toLowerCase();
    const kpFilter = phankhuSelect ? phankhuSelect.value : 'ALL';
    const stFilter = trangThaiSelect ? trangThaiSelect.value : 'ALL';
    const dtFilter = ngayChuyenSelect ? ngayChuyenSelect.value : 'ALL';
    const traFilter = ngayTraSelect ? ngayTraSelect.value : 'ALL';

    filteredRecords = allRecords.filter(r => {
      // 1. Phân khu filter
      if (kpFilter !== 'ALL') {
        let rKp = '';
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        if (to === 'Tổ 1' || to.includes('1')) rKp = '17';
        else if (to === 'Tổ 2' || to.includes('2')) rKp = '18';
        else if (to === 'Tổ 3' || to.includes('3')) rKp = '19';
        else if (r.khuPho) {
          const raw = String(r.khuPho).trim();
          if (raw.includes('17')) rKp = '17';
          else if (raw.includes('18')) rKp = '18';
          else if (raw.includes('19')) rKp = '19';
          else rKp = raw;
        }

        if (rKp !== kpFilter && !rKp.includes(kpFilter)) return false;
      }

      // 2. Trạng thái filter
      if (stFilter !== 'ALL') {
        if (!r.trangThai || !r.trangThai.includes(stFilter.substring(0, 2))) return false;
      }

      // 3. Ngày / Tuần / Tháng chuyển đi sang KTHTĐT filter
      if (dtFilter !== 'ALL') {
        const normFilter = Analytics.normalizeDateStr(dtFilter);
        const d1 = Analytics.normalizeDateStr(r.ngayChuyen);

        if (activePeriodType === 'week') {
          const w1 = Analytics.getWeekLabel(r.ngayChuyen);
          if (w1 !== dtFilter && !w1.includes(dtFilter)) return false;
        } else if (activePeriodType === 'month') {
          const m1 = Analytics.getMonthLabel(r.ngayChuyen);
          if (m1 !== dtFilter && !m1.includes(dtFilter)) return false;
        } else {
          if (d1 !== normFilter && !d1.startsWith(normFilter)) return false;
        }
      }

      // 4. Lọc riêng NGÀY P.KTHTĐT CHUYỂN VỀ (Ngày Trả Về)
      if (traFilter !== 'ALL') {
        if (!r.ngayKthtChuyenVe || !r.ngayKthtChuyenVe.trim()) return false;
        const normTraFilter = Analytics.normalizeDateStr(traFilter);
        const d2 = Analytics.normalizeDateStr(r.ngayKthtChuyenVe);

        if (activePeriodType === 'week') {
          const w2 = Analytics.getWeekLabel(r.ngayKthtChuyenVe);
          if (w2 !== traFilter && !w2.includes(traFilter)) return false;
        } else if (activePeriodType === 'month') {
          const m2 = Analytics.getMonthLabel(r.ngayKthtChuyenVe);
          if (m2 !== traFilter && !m2.includes(traFilter)) return false;
        } else {
          if (d2 !== normTraFilter && !d2.startsWith(normTraFilter)) return false;
        }
      }

      // 5. Smart Multi-term Unaccented Search Filter
      if (query) {
        const qNoTone = Analytics.removeVietnameseTones(query);
        const terms = query.split(/\s+/).filter(Boolean);
        const termsNoTone = qNoTone.split(/\s+/).filter(Boolean);

        const rawText = [
          r.stt,
          `stt ${r.stt}`,
          `hs-${String(r.stt).padStart(4, '0')}`,
          r.maHoSo,
          r.baseJobId,
          r.baseJobName,
          r.baseStageName,
          r.canBoBBT,
          r.canBoKTHT,
          r.hoTen,
          r.diaChi,
          r.duong,
          r.phuong,
          r.toBanDo,
          `tờ ${r.toBanDo}`,
          `to ${r.toBanDo}`,
          r.thuaDat,
          `thửa ${r.thuaDat}`,
          `thua ${r.thuaDat}`,
          r.khuPho,
          `kp ${r.khuPho}`,
          `kp${r.khuPho}`,
          `khu phố ${r.khuPho}`,
          r.toBoiThuong,
          r.trangThai,
          r.ngayChuyen,
          r.ngayKthtChuyenVe,
          r.ghiChu,
          r.phapChe
        ].filter(Boolean).join(' ').toLowerCase();

        const noToneText = Analytics.removeVietnameseTones(rawText);

        const match = termsNoTone.every((term, idx) => {
          const rawTerm = terms[idx] || term;
          return rawText.includes(rawTerm) || noToneText.includes(term);
        });

        if (!match) return false;
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
    renderSection3();
    renderSection4();
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

    const labelMap = {
      'KP 17': 'Tổ 1 (KP 17)',
      'KP 18': 'Tổ 2 (KP 18)',
      'KP 19': 'Tổ 3 (KP 19)',
      'TỔNG CỘNG': 'TỔNG CỘNG'
    };

    const rows = ['KP 17', 'KP 18', 'KP 19', 'TỔNG CỘNG'];
    rows.forEach(key => {
      const item = data[key];
      const totGui = item.totalGui;
      const isTotal = key === 'TỔNG CỘNG';
      const tr = document.createElement('tr');
      if (isTotal) tr.classList.add('total-row');

      const pct = (val) => totGui > 0 ? `(${((val / totGui) * 100).toFixed(1)}%)` : '(0.0%)';

      tr.innerHTML = `
        <td><strong>${labelMap[key]}</strong></td>
        <td class="text-center" style="background: rgba(14, 165, 233, 0.08); font-size: 1rem; color: #0284c7;"><strong>${item.totalBase.toLocaleString('vi-VN')}</strong></td>
        <td class="text-center" style="background: rgba(16, 185, 129, 0.08); font-size: 1rem; color: #059669;"><strong>${totGui.toLocaleString('vi-VN')}</strong></td>
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
    if (!tbody) return;
    tbody.innerHTML = '';

    const countTag = document.getElementById('countOfficersTag');
    if (countTag) countTag.textContent = `${list.length} Cán bộ`;

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
    if (!tbody) return;
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
    if (!tbody) return;
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
    if (!tbody) return;
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
    const isDateFiltered = (ngayChuyenSelect && ngayChuyenSelect.value !== 'ALL') || (ngayTraSelect && ngayTraSelect.value !== 'ALL') || (datePickerInput && datePickerInput.value) || (datePickerTraInput && datePickerTraInput.value);
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

    const uniqueOfficers6 = new Set();
    let sum17 = 0, sum18 = 0, sum19 = 0;
    let sumBaseTotal = 0, sumTotal = 0, sumThongQua = 0, sumKthtGiu = 0, sumTraSua = 0;

    let overallBaseTotal = 0;
    if (window.BASE_WORKFLOW_COUNTS) {
      Object.keys(window.BASE_WORKFLOW_COUNTS).forEach(k => {
        if (!k.startsWith('_')) overallBaseTotal += (window.BASE_WORKFLOW_COUNTS[k] || 0);
      });
    }

    list.forEach((item, idx) => {
      sum17 += item.kp17;
      sum18 += item.kp18;
      sum19 += item.kp19;
      sumTotal += (item.totalChuyen || 0);
      sumThongQua += (item.thongQua || 0);
      sumKthtGiu += (item.kthtGiu || 0);
      sumTraSua += (item.traSua || 0);

      if (!uniqueOfficers6.has(item.cbtl)) {
        uniqueOfficers6.add(item.cbtl);
        sumBaseTotal += (item.baseTotal || 0);
      }

      const isZero = item.totalChuyen === 0;
      const tr = document.createElement('tr');
      if (isZero) {
        tr.style.opacity = '0.75';
        tr.style.background = 'rgba(239, 68, 68, 0.03)';
      }

      const timeTd = isDateFiltered ? `<td><span class="badge badge-neutral">📅 ${item.timeKey}</span></td>` : '';
      const baseTd = item.baseTotal > 0 
        ? `<span class="badge badge-info" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700; font-size:0.875rem;">📦 ${item.baseTotal.toLocaleString('vi-VN')}</span>` 
        : `<span class="badge badge-neutral">0</span>`;

      tr.innerHTML = `
        <td class="text-center"><strong>${idx + 1}</strong></td>
        ${timeTd}
        <td><strong>${item.cbtlFull || item.cbtl}</strong></td>
        <td class="text-center">${item.kp17}</td>
        <td class="text-center">${item.kp18}</td>
        <td class="text-center">${item.kp19}</td>
        <td class="text-center">${baseTd}</td>
        <td class="text-center">${isZero ? `<span class="badge badge-danger">⚠️ 0 (Chưa bàn giao)</span>` : `<span class="badge badge-neutral">${item.totalChuyen}</span>`}</td>
        <td class="text-center">${item.thongQua > 0 ? `<span class="badge badge-success">${item.thongQua}</span>` : '0'}</td>
        <td class="text-center">${item.kthtGiu > 0 ? `<span class="badge badge-warning">${item.kthtGiu}</span>` : '0'}</td>
        <td class="text-center">${item.traSua > 0 ? `<span class="badge badge-danger">${item.traSua}</span>` : '0'}</td>
      `;
      tbody.appendChild(tr);
    });

    const displayBaseTotal = overallBaseTotal > 0 ? overallBaseTotal : sumBaseTotal;
    const colspanVal = isDateFiltered ? 3 : 2;
    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td colspan="${colspanVal}" class="text-center"><strong>TỔNG CỘNG</strong></td>
      <td class="text-center">${sum17}</td>
      <td class="text-center">${sum18}</td>
      <td class="text-center">${sum19}</td>
      <td class="text-center"><strong style="color:#0369a1;">📦 ${displayBaseTotal.toLocaleString('vi-VN')}</strong></td>
      <td class="text-center">${sumTotal}</td>
      <td class="text-center">${sumThongQua}</td>
      <td class="text-center">${sumKthtGiu}</td>
      <td class="text-center">${sumTraSua}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // 12. Render Master Section VII (Khối lượng hồ sơ theo Cán bộ Pháp chế & Thụ lý KTHT)
  function renderSection7() {
    const isDateFiltered = (ngayChuyenSelect7 && ngayChuyenSelect7.value !== 'ALL') || (ngayChuyenSelect && ngayChuyenSelect.value !== 'ALL') || (ngayTraSelect7 && ngayTraSelect7.value !== 'ALL') || (ngayTraSelect && ngayTraSelect.value !== 'ALL') || (datePickerInput7 && datePickerInput7.value) || (datePickerTraInput7 && datePickerTraInput7.value);
    const isKhuPhoFiltered = (phankhuSelect7 && phankhuSelect7.value !== 'ALL') || (phankhuSelect && phankhuSelect.value !== 'ALL');
    const searchVal7 = searchInput7 ? searchInput7.value : '';
    const selectedDateVal7 = (ngayChuyenSelect7 && ngayChuyenSelect7.value !== 'ALL') ? ngayChuyenSelect7.value : ((ngayChuyenSelect && ngayChuyenSelect.value !== 'ALL') ? ngayChuyenSelect.value : ((ngayTraSelect7 && ngayTraSelect7.value !== 'ALL') ? ngayTraSelect7.value : (ngayTraSelect ? ngayTraSelect.value : '')));

    const thTimeKey7 = document.getElementById('thTimeKey7');
    if (thTimeKey7) {
      if (activePeriodType === 'week') thTimeKey7.textContent = 'TUẦN CHUYỂN';
      else if (activePeriodType === 'month') thTimeKey7.textContent = 'THÁNG CHUYỂN';
      else thTimeKey7.textContent = 'NGÀY CHUYỂN';

      thTimeKey7.style.display = isDateFiltered ? '' : 'none';
    }

    const list = Analytics.getDetailedPhapCheBreakdown(filteredRecords, activePeriodType, allRecords, isDateFiltered, isKhuPhoFiltered, searchVal7, selectedDateVal7);
    const tbody = document.getElementById('tbodySection7');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      const colspanTotal = isDateFiltered ? 10 : 9;
      tbody.innerHTML = `<tr><td colspan="${colspanTotal}" class="text-center" style="padding:20px;">Không tìm thấy dữ liệu phù hợp.</td></tr>`;
      return;
    }

    let sum17 = 0, sum18 = 0, sum19 = 0;
    let sumTotal = 0, sumThongQua = 0, sumTraSua = 0;

    list.forEach((item, idx) => {
      sum17 += item.kp17;
      sum18 += item.kp18;
      sum19 += item.kp19;
      sumTotal += item.totalChuyen;
      sumThongQua += item.thongQua;
      sumTraSua += item.traSua;

      const isZero = item.totalChuyen === 0;
      const tr = document.createElement('tr');
      if (isZero) {
        tr.style.opacity = '0.75';
        tr.style.background = 'rgba(239, 68, 68, 0.03)';
      }

      const timeTd = isDateFiltered ? `<td><span class="badge badge-neutral">📅 ${item.timeKey}</span></td>` : '';
      const ghiChuTd = `<td>${item.ghiChu ? `<span class="badge badge-neutral">${item.ghiChu}</span>` : '-'}</td>`;

      tr.innerHTML = `
        <td class="text-center"><strong>${idx + 1}</strong></td>
        ${timeTd}
        <td><strong>${item.cbtl}</strong></td>
        <td class="text-center">${item.kp17}</td>
        <td class="text-center">${item.kp18}</td>
        <td class="text-center">${item.kp19}</td>
        <td class="text-center">${isZero ? `<span class="badge badge-danger">⚠️ 0</span>` : `<span class="badge badge-neutral">${item.totalChuyen}</span>`}</td>
        <td class="text-center">${item.thongQua > 0 ? `<span class="badge badge-success">${item.thongQua}</span>` : '0'}</td>
        <td class="text-center">${item.traSua > 0 ? `<span class="badge badge-danger">${item.traSua}</span>` : '0'}</td>
        ${ghiChuTd}
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
      <td class="text-center">${sumTraSua}</td>
      <td class="text-center">-</td>
    `;
    tbody.appendChild(trTotal);
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

    const kp17 = progressData['KP 17'].totalBase;
    const kp18 = progressData['KP 18'].totalBase;
    const kp19 = progressData['KP 19'].totalBase;
    const totalBase = progressData['TỔNG CỘNG'].totalBase;

    khuphoChartInstance = new Chart(ctxKhupho, {
      type: 'doughnut',
      data: {
        labels: [
          `KP 17 (${kp17.toLocaleString('vi-VN')} HS)`,
          `KP 18 (${kp18.toLocaleString('vi-VN')} HS)`,
          `KP 19 (${kp19.toLocaleString('vi-VN')} HS)`
        ],
        datasets: [{
          data: [kp17, kp18, kp19],
          backgroundColor: ['#3b82f6', '#10b981', '#818cf8'],
          hoverOffset: 8,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed;
                const pct = totalBase > 0 ? ((val / totalBase) * 100).toFixed(1) : 0;
                return ` ${val.toLocaleString('vi-VN')} hồ sơ (${pct}%)`;
              }
            }
          }
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
