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

  // Bộ lọc dùng chung — đồng bộ giữa 3 thanh (Global / Bảng IV / Bảng V).
  // Mọi hàm render đọc từ đây thay vì tự đọc lại DOM, tránh lệch nguồn.
  let currentFilter = { query: '', kpFilter: 'ALL', stFilter: 'ALL', fromD: null, toD: null, fromDateVal: '', toDateVal: '' };

  // Debounce: hoãn thao tác nặng (lọc + vẽ lại toàn dashboard) khi đang gõ nhanh.
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Lấy mã trạng thái ở đầu chuỗi: "2.1. Trả về..." -> "2.1", "1. Đã chuyển..." -> "1".
  // Dùng để khớp trạng thái chính xác, tránh "1." dính nhầm vào "2.1.".
  function statusCode(s) {
    const m = String(s || '').trim().match(/^(\d+(?:\.\d+)?)/);
    return m ? m[1] : '';
  }

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

  // Global Toolbar elements
  const searchInputGlobal = document.getElementById('searchInputGlobal');
  const phankhuSelectGlobal = document.getElementById('phankhuSelectGlobal');
  const trangThaiSelectGlobal = document.getElementById('trangThaiSelectGlobal');
  const datePickerFromInputGlobal = document.getElementById('datePickerFromInputGlobal');
  const datePickerToInputGlobal = document.getElementById('datePickerToInputGlobal');
  const resetFilterBtnGlobal = document.getElementById('resetFilterBtnGlobal');
  const activeFilterBannerGlobal = document.getElementById('activeFilterBannerGlobal');
  const activeFilterBannerTextGlobal = document.getElementById('activeFilterBannerTextGlobal');
  const clearActiveFilterBtnGlobal = document.getElementById('clearActiveFilterBtnGlobal');

  // Toolbar IV elements
  const searchInput = document.getElementById('searchInput');
  const phankhuSelect = document.getElementById('phankhuSelect');
  const trangThaiSelect = document.getElementById('trangThaiSelect');
  const datePickerFromInput = document.getElementById('datePickerFromInput');
  const datePickerToInput = document.getElementById('datePickerToInput');
  const resetFilterBtn = document.getElementById('resetFilterBtn');

  // Toolbar V elements
  const searchInput7 = document.getElementById('searchInput7');
  const phankhuSelect7 = document.getElementById('phankhuSelect7');
  const trangThaiSelect7 = document.getElementById('trangThaiSelect7');
  const datePickerFromInput7 = document.getElementById('datePickerFromInput7');
  const datePickerToInput7 = document.getElementById('datePickerToInput7');
  const resetFilterBtn7 = document.getElementById('resetFilterBtn7');

  // Shared UI elements
  const sheetSyncBadge = document.getElementById('sheetSyncBadge');
  const activeFilterBanner = document.getElementById('activeFilterBanner');
  const activeFilterBannerText = document.getElementById('activeFilterBannerText');
  const clearActiveFilterBtn = document.getElementById('clearActiveFilterBtn');

  // Toolbar V banner elements
  const activeFilterBanner7 = document.getElementById('activeFilterBanner7');
  const activeFilterBannerText7 = document.getElementById('activeFilterBannerText7');
  const clearActiveFilterBtn7 = document.getElementById('clearActiveFilterBtn7');

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

  // Sync filter values between Global ↔ Toolbar IV ↔ Toolbar V (3-way sync)
  function syncFilterControls(source) {
    let src = { search: searchInputGlobal, pk: phankhuSelectGlobal, st: trangThaiSelectGlobal, from: datePickerFromInputGlobal, to: datePickerToInputGlobal };

    if (source === 'toolbar6') {
      src = { search: searchInput, pk: phankhuSelect, st: trangThaiSelect, from: datePickerFromInput, to: datePickerToInput };
    } else if (source === 'toolbar7') {
      src = { search: searchInput7, pk: phankhuSelect7, st: trangThaiSelect7, from: datePickerFromInput7, to: datePickerToInput7 };
    }

    const allToolbars = [
      { search: searchInputGlobal, pk: phankhuSelectGlobal, st: trangThaiSelectGlobal, from: datePickerFromInputGlobal, to: datePickerToInputGlobal },
      { search: searchInput, pk: phankhuSelect, st: trangThaiSelect, from: datePickerFromInput, to: datePickerToInput },
      { search: searchInput7, pk: phankhuSelect7, st: trangThaiSelect7, from: datePickerFromInput7, to: datePickerToInput7 }
    ];

    allToolbars.forEach(t => {
      if (t.search && src.search && t.search !== src.search) t.search.value = src.search.value;
      if (t.pk && src.pk && t.pk !== src.pk) t.pk.value = src.pk.value;
      if (t.st && src.st && t.st !== src.st) t.st.value = src.st.value;
      if (t.from && src.from && t.from !== src.from) t.from.value = src.from.value;
      if (t.to && src.to && t.to !== src.to) t.to.value = src.to.value;
    });
  }

  // 3. Event Listeners
  function setupEventListeners() {
    const triggerSyncAndFilter = (source) => {
      syncFilterControls(source);
      handleFilterChange();
    };

    // Hiện/ẩn nút xóa (×) theo từng ô tìm kiếm dựa trên nội dung của chính ô đó
    const updateClearButtons = () => {
      document.querySelectorAll('.search-box__clear').forEach(btn => {
        const inp = document.getElementById(btn.getAttribute('data-target'));
        if (inp && inp.value) btn.classList.add('visible');
        else btn.classList.remove('visible');
      });
    };

    // Khi gõ: đồng bộ 3 thanh + hiện nút xóa NGAY, nhưng hoãn (debounce) việc lọc + vẽ lại
    const debouncedFilter = debounce(() => handleFilterChange(), 220);
    const triggerSearchInput = (source) => {
      syncFilterControls(source);
      updateClearButtons();
      debouncedFilter();
    };

    // Search Clear Buttons
    document.querySelectorAll('.search-box__clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        if (targetInput) targetInput.value = '';
        [searchInputGlobal, searchInput, searchInput7].forEach(el => { if (el) el.value = ''; });
        document.querySelectorAll('.search-box__clear').forEach(b => b.classList.remove('visible'));
        handleFilterChange();
      });
    });

    // Global Toolbar Listeners (ô tìm dùng debounce; select đổi thì lọc ngay)
    if (searchInputGlobal) searchInputGlobal.addEventListener('input', () => triggerSearchInput('global'));
    if (phankhuSelectGlobal) phankhuSelectGlobal.addEventListener('change', () => triggerSyncAndFilter('global'));
    if (trangThaiSelectGlobal) trangThaiSelectGlobal.addEventListener('change', () => triggerSyncAndFilter('global'));

    // Section IV Listeners
    if (searchInput) searchInput.addEventListener('input', () => triggerSearchInput('toolbar6'));
    if (phankhuSelect) phankhuSelect.addEventListener('change', () => triggerSyncAndFilter('toolbar6'));
    if (trangThaiSelect) trangThaiSelect.addEventListener('change', () => triggerSyncAndFilter('toolbar6'));

    // Section V Listeners
    if (searchInput7) searchInput7.addEventListener('input', () => triggerSearchInput('toolbar7'));
    if (phankhuSelect7) phankhuSelect7.addEventListener('change', () => triggerSyncAndFilter('toolbar7'));
    if (trangThaiSelect7) trangThaiSelect7.addEventListener('change', () => triggerSyncAndFilter('toolbar7'));

    // Date Picker Listeners (sync between toolbars)
    [datePickerFromInputGlobal, datePickerToInputGlobal].forEach(picker => {
      if (picker) picker.addEventListener('change', () => triggerSyncAndFilter('global'));
    });
    [datePickerFromInput, datePickerToInput].forEach(picker => {
      if (picker) picker.addEventListener('change', () => triggerSyncAndFilter('toolbar6'));
    });
    [datePickerFromInput7, datePickerToInput7].forEach(picker => {
      if (picker) picker.addEventListener('change', () => triggerSyncAndFilter('toolbar7'));
    });

    // Quick Chip Buttons
    const chips = document.querySelectorAll('.chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const chipType = target.getAttribute('data-chip-type');
        const chipVal = target.getAttribute('data-chip-val');

        chips.forEach(c => {
          if (c.getAttribute('data-chip-type') === chipType) {
            if (c.getAttribute('data-chip-val') === chipVal) c.classList.add('active');
            else c.classList.remove('active');
          }
        });

        if (chipType === 'kp') {
          if (phankhuSelectGlobal) phankhuSelectGlobal.value = chipVal;
          if (phankhuSelect) phankhuSelect.value = chipVal;
          if (phankhuSelect7) phankhuSelect7.value = chipVal;
        } else if (chipType === 'st') {
          const mappedSt = chipVal === 'ALL' ? 'ALL' : (chipVal === '3.' ? '3. Hồ sơ thông qua nhận định pháp lý' : (chipVal === '1.' ? '1. Đã chuyển phòng KTHTĐT' : '2.1. Trả về chỉnh sửa lần 1'));
          if (trangThaiSelectGlobal) trangThaiSelectGlobal.value = mappedSt;
          if (trangThaiSelect) trangThaiSelect.value = mappedSt;
          if (trangThaiSelect7) trangThaiSelect7.value = mappedSt;
        }

        handleFilterChange();
      });
    });

    // Reset Buttons
    if (resetFilterBtnGlobal) resetFilterBtnGlobal.addEventListener('click', handleResetAll);
    if (resetFilterBtn) resetFilterBtn.addEventListener('click', handleResetAll);
    if (resetFilterBtn7) resetFilterBtn7.addEventListener('click', handleResetAll);
    if (clearActiveFilterBtnGlobal) clearActiveFilterBtnGlobal.addEventListener('click', handleResetAll);
    if (clearActiveFilterBtn) clearActiveFilterBtn.addEventListener('click', handleResetAll);
    if (clearActiveFilterBtn7) clearActiveFilterBtn7.addEventListener('click', handleResetAll);

    // Time Period Tabs for Master Sections
    const tabBtns = document.querySelectorAll('#timePeriodTabsGlobal .tab-btn, #timePeriodTabs .tab-btn, #timePeriodTabs7 .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        activePeriodType = target.getAttribute('data-period');
        
        // Sync active class across all tab groups
        tabBtns.forEach(t => {
          if (t.getAttribute('data-period') === activePeriodType) {
            t.classList.add('active');
          } else {
            t.classList.remove('active');
          }
        });

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
      const cleanCanBo = canBo.toLowerCase();
      if (cleanCanBo === 'thụ lý' || cleanCanBo === 'cán bộ' || cleanCanBo === 'cán bộ thụ lý' || cleanCanBo === 'thụ lý bqlda' || cleanCanBo === 'tên cán bộ' || cleanCanBo === 'người thụ lý') {
        continue;
      }
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

  function handleResetAll() {
    [searchInputGlobal, searchInput, searchInput7].forEach(el => { if (el) el.value = ''; });
    [phankhuSelectGlobal, phankhuSelect, phankhuSelect7].forEach(el => { if (el) el.value = 'ALL'; });
    [trangThaiSelectGlobal, trangThaiSelect, trangThaiSelect7].forEach(el => { if (el) el.value = 'ALL'; });
    [datePickerFromInputGlobal, datePickerFromInput, datePickerFromInput7].forEach(el => { if (el) el.value = ''; });
    [datePickerToInputGlobal, datePickerToInput, datePickerToInput7].forEach(el => { if (el) el.value = ''; });

    document.querySelectorAll('.search-box__clear').forEach(b => b.classList.remove('visible'));
    document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
    const defaultChips = document.querySelectorAll('.chip-btn[data-chip-val="ALL"]');
    defaultChips.forEach(c => c.classList.add('active'));

    handleFilterChange();
  }

  function parseVietDateObj(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().split(' ')[0];
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
      }
    } else if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
      }
    }
    return null;
  }

  function handleFilterChange(e) {
    if (e && e.target) {
      const tId = e.target.id;
      let srcKey = 'global';
      if (tId.includes('toolbar6') || tId === 'searchInput' || tId === 'phankhuSelect' || tId === 'trangThaiSelect') srcKey = 'toolbar6';
      else if (tId.includes('7')) srcKey = 'toolbar7';
      syncFilterControls(srcKey);
    }

    const rawQuery = (searchInputGlobal && searchInputGlobal.value) ? searchInputGlobal.value : ((searchInput && searchInput.value) ? searchInput.value : ((searchInput7 && searchInput7.value) ? searchInput7.value : ''));
    const query = rawQuery.trim().toLowerCase();

    const kpFilter = (phankhuSelectGlobal && phankhuSelectGlobal.value !== 'ALL') ? phankhuSelectGlobal.value : ((phankhuSelect && phankhuSelect.value !== 'ALL') ? phankhuSelect.value : ((phankhuSelect7 && phankhuSelect7.value !== 'ALL') ? phankhuSelect7.value : 'ALL'));
    const stFilter = (trangThaiSelectGlobal && trangThaiSelectGlobal.value !== 'ALL') ? trangThaiSelectGlobal.value : ((trangThaiSelect && trangThaiSelect.value !== 'ALL') ? trangThaiSelect.value : ((trangThaiSelect7 && trangThaiSelect7.value !== 'ALL') ? trangThaiSelect7.value : 'ALL'));

    const fromDateVal = (datePickerFromInputGlobal && datePickerFromInputGlobal.value) ? datePickerFromInputGlobal.value : ((datePickerFromInput && datePickerFromInput.value) ? datePickerFromInput.value : ((datePickerFromInput7 && datePickerFromInput7.value) ? datePickerFromInput7.value : ''));
    const toDateVal = (datePickerToInputGlobal && datePickerToInputGlobal.value) ? datePickerToInputGlobal.value : ((datePickerToInput && datePickerToInput.value) ? datePickerToInput.value : ((datePickerToInput7 && datePickerToInput7.value) ? datePickerToInput7.value : ''));

    let fromD = fromDateVal ? parseVietDateObj(fromDateVal) : null;
    let toD = toDateVal ? parseVietDateObj(toDateVal) : null;
    if (toD) toD.setHours(23, 59, 59, 999);

    window.IS_DATE_FILTERED = Boolean(fromD || toD);

    // Lưu trạng thái lọc dùng chung để mọi hàm render đọc lại (không tự đọc DOM rời rạc)
    currentFilter = { query, kpFilter, stFilter, fromD, toD, fromDateVal, toDateVal };

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

      // 2. Trạng thái filter (khớp theo mã chính xác: chọn "1." KHÔNG dính "2.1.")
      if (stFilter !== 'ALL') {
        const fc = statusCode(stFilter);
        if (fc) {
          if (statusCode(r.trangThai) !== fc) return false;
        } else if (!r.trangThai || !r.trangThai.includes(stFilter)) {
          return false;
        }
      }

      // 3. Khoảng Ngày (Lọc khớp với Ngày chuyển HOẶC Ngày trả về)
      if (fromD || toD) {
        const rChuyenD = r.ngayChuyen ? parseVietDateObj(r.ngayChuyen) : null;
        const rTraD = r.ngayKthtChuyenVe ? parseVietDateObj(r.ngayKthtChuyenVe) : null;

        const matchChuyen = rChuyenD && (!fromD || rChuyenD >= fromD) && (!toD || rChuyenD <= toD);
        const matchTra = rTraD && (!fromD || rTraD >= fromD) && (!toD || rTraD <= toD);

        if (!matchChuyen && !matchTra) return false;
      }

      // 4. Smart Multi-term Unaccented Search Filter
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

    // Toggle Search Clear Buttons Visibility (theo nội dung từng ô)
    document.querySelectorAll('.search-box__clear').forEach(btn => {
      const inp = document.getElementById(btn.getAttribute('data-target'));
      if (inp && inp.value) btn.classList.add('visible');
      else btn.classList.remove('visible');
    });

    // Update Result Count Badges on Global, Table IV & V Filter Headers
    const badgeGlobal = document.getElementById('filterResultCountBadgeGlobal');
    const badge4 = document.getElementById('filterResultCountBadge4');
    const badge5 = document.getElementById('filterResultCountBadge5');
    const badgeText = `${filteredRecords.length.toLocaleString('vi-VN')} / ${allRecords.length.toLocaleString('vi-VN')} HS`;
    if (badgeGlobal) badgeGlobal.textContent = badgeText;
    if (badge4) badge4.textContent = badgeText;
    if (badge5) badge5.textContent = badgeText;

    // Update Active Filter Summary Banners
    const banners = [
      { banner: activeFilterBannerGlobal, textEl: activeFilterBannerTextGlobal },
      { banner: activeFilterBanner, textEl: activeFilterBannerText },
      { banner: activeFilterBanner7, textEl: activeFilterBannerText7 }
    ];

    const badges = [];
    if (query) badges.push(`🔍 Tìm kiếm: "<strong>${query}</strong>"`);
    if (kpFilter !== 'ALL') badges.push(`📍 Phân khu: <strong>KP ${kpFilter}</strong>`);
    if (stFilter !== 'ALL') badges.push(`📌 Trạng thái: <strong>${stFilter.substring(0, 15)}...</strong>`);
    if (fromDateVal || toDateVal) {
      badges.push(`📆 Khoảng ngày: <strong>${fromDateVal || '...'} ➜ ${toDateVal || '...'}</strong>`);
    }

    banners.forEach(item => {
      if (item.banner && item.textEl) {
        if (badges.length > 0) {
          item.textEl.innerHTML = `<span>🎯 <strong>Đang lọc (${filteredRecords.length.toLocaleString('vi-VN')} / ${allRecords.length.toLocaleString('vi-VN')} hồ sơ):</strong> ${badges.join(' <span style="opacity:0.4;">|</span> ')}</span>`;
          item.banner.style.display = 'flex';
        } else {
          item.banner.style.display = 'none';
        }
      }
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
    const isDateFiltered = Boolean(window.IS_DATE_FILTERED);
    const isKhuPhoFiltered = currentFilter.kpFilter !== 'ALL';

    const tableElement = document.getElementById('tableSection6');
    if (tableElement) {
      const thead = tableElement.querySelector('thead');
      if (thead) {
        thead.innerHTML = `
          <tr>
            <th class="text-center" style="width: 50px;">STT</th>
            <th>CBTL (CÁN BỘ BBT)</th>
            <th class="text-center">TỔ BỒI THƯỜNG<br><small style="font-weight:normal; opacity:0.85;">(Phân khu)</small></th>
            <th class="text-center" style="background: rgba(14, 165, 233, 0.1); border-color: #38bdf8;">TỔNG HS NẮM GIỮ<br><small style="font-weight:normal; opacity:0.85;">(trên Base Workflow)</small></th>
            <th class="text-center" style="background: rgba(16, 185, 129, 0.09); border-color: #34d399;">TỔNG HS ĐÃ CHUYỂN P.KTHT<br><small style="font-weight:normal; opacity:0.85;">(luỹ kế đó giờ - từ sheet)</small></th>
            <th class="text-center" style="background: rgba(16, 185, 129, 0.09); border-color: #34d399;">TỔNG HS ĐÃ THÔNG QUA<br><small style="font-weight:normal; opacity:0.85;">(luỹ kế đó giờ - từ sheet)</small></th>
            <th class="text-center">TỔNG HS<br><small style="font-weight:normal; opacity:0.85;">(đã chuyển P.KTHT - trong kỳ lọc)</small></th>
            <th class="text-center">TỔNG HS<br><small style="font-weight:normal; opacity:0.85;">(đã được P.KTHT thông qua - trong kỳ lọc)</small></th>
            <th class="text-center">TỔNG HS<br><small style="font-weight:normal; opacity:0.85;">(P.KTHT còn giữ - tất cả ngày)</small></th>
            <th class="text-center">HS P.KTHT<br><small style="font-weight:normal; opacity:0.85;">trả sửa</small></th>
          </tr>
        `;
      }
    }

    const list = Analytics.getDetailedTransferBreakdown(filteredRecords, activePeriodType, allRecords, isDateFiltered, isKhuPhoFiltered);
    const tbody = document.getElementById('tbodySection6');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:20px;">Không tìm thấy dữ liệu phù hợp.</td></tr>`;
      return;
    }

    const uniqueOfficers6 = new Set();
    let sum17 = 0, sum18 = 0, sum19 = 0;
    let sumBaseTotal = 0, sumTotal = 0, sumThongQua = 0, sumKthtGiu = 0, sumTraSua = 0;
    let sumAllTimeChuyen = 0, sumAllTimeThongQua = 0;

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
      sumAllTimeChuyen += (item.allTimeChuyen || 0);
      sumAllTimeThongQua += (item.allTimeThongQua || 0);

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

      tr.setAttribute('data-cbtl', item.cbtl);

      const baseTd = item.baseTotal > 0 
        ? `<span class="badge badge-info" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700; font-size:0.875rem;">📦 ${item.baseTotal.toLocaleString('vi-VN')}</span>` 
        : `<span class="badge badge-neutral">0</span>`;

      const toList = [];
      if (item.kp17 > 0) toList.push('<span class="badge badge-neutral">Tổ 1 (KP 17)</span>');
      if (item.kp18 > 0) toList.push('<span class="badge badge-neutral">Tổ 2 (KP 18)</span>');
      if (item.kp19 > 0) toList.push('<span class="badge badge-neutral">Tổ 3 (KP 19)</span>');
      const toTd = toList.length > 0 ? toList.join(' ') : '<span class="badge badge-neutral">-</span>';

      tr.innerHTML = `
        <td class="text-center"><strong>${idx + 1}</strong></td>
        <td><strong>${item.cbtlFull || item.cbtl}</strong></td>
        <td class="text-center">${toTd}</td>
        <td class="text-center">${baseTd}</td>
        <td class="text-center" style="background: rgba(16,185,129,0.05);"><strong>${(item.allTimeChuyen || 0).toLocaleString('vi-VN')}</strong></td>
        <td class="text-center" style="background: rgba(16,185,129,0.05);"><strong style="color:#059669;">${(item.allTimeThongQua || 0).toLocaleString('vi-VN')}</strong></td>
        <td class="text-center cell-clickable" data-action="totalChuyen" style="cursor:pointer;" title="Bấm để xem danh sách tất cả hồ sơ đã chuyển của cán bộ này">${isZero ? `<span class="badge badge-danger">⚠️ 0</span>` : `<span class="badge badge-info hover-badge" style="cursor:pointer; text-decoration:underline; font-weight:700;">${item.totalChuyen}</span>`}</td>
        <td class="text-center cell-clickable" data-action="thongQua" style="cursor:pointer;" title="Bấm để xem danh sách hồ sơ đã được Thông Qua">${item.thongQua > 0 ? `<span class="badge badge-success hover-badge" style="cursor:pointer; text-decoration:underline;">${item.thongQua}</span>` : '0'}</td>
        <td class="text-center cell-clickable" data-action="kthtGiu" style="cursor:pointer;" title="Bấm để xem danh sách hồ sơ KTHT đang giữ (tất cả các ngày trên hệ thống)">${item.kthtGiu > 0 ? `<span class="badge badge-warning hover-badge" style="cursor:pointer; text-decoration:underline; font-weight:700;">${item.kthtGiu}</span>` : '0'}</td>
        <td class="text-center cell-clickable" data-action="traSua" style="cursor:pointer;" title="Bấm để xem danh sách hồ sơ bị trả sửa">${item.traSua > 0 ? `<span class="badge badge-danger hover-badge" style="cursor:pointer; text-decoration:underline;">${item.traSua}</span>` : '0'}</td>
      `;
      tbody.appendChild(tr);
    });

    if (!tbody.dataset.hasListener) {
      tbody.dataset.hasListener = 'true';
      tbody.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell-clickable');
        if (!cell) return;
        const tr = cell.closest('tr');
        if (!tr) return;
        const cbtl = tr.getAttribute('data-cbtl');
        const action = cell.getAttribute('data-action');
        if (cbtl && action) {
          showDossierListForOfficer(cbtl, action);
        }
      });
    }

    const displayBaseTotal = overallBaseTotal > 0 ? overallBaseTotal : sumBaseTotal;
    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td colspan="2" class="text-center"><strong>TỔNG CỘNG</strong></td>
      <td class="text-center">
        <span style="font-size:0.8125rem; font-weight:600;">KP17: ${sum17} | KP18: ${sum18} | KP19: ${sum19}</span>
      </td>
      <td class="text-center"><strong style="color:#0369a1;">📦 ${displayBaseTotal.toLocaleString('vi-VN')}</strong></td>
      <td class="text-center" style="background: rgba(16,185,129,0.06);"><strong>${sumAllTimeChuyen.toLocaleString('vi-VN')}</strong></td>
      <td class="text-center" style="background: rgba(16,185,129,0.06);"><strong style="color:#059669;">${sumAllTimeThongQua.toLocaleString('vi-VN')}</strong></td>
      <td class="text-center"><strong>${sumTotal}</strong></td>
      <td class="text-center"><strong>${sumThongQua}</strong></td>
      <td class="text-center"><strong>${sumKthtGiu}</strong></td>
      <td class="text-center"><strong>${sumTraSua}</strong></td>
    `;
    tbody.appendChild(trTotal);
  }

  function showDossierListForOfficer(officerName, category, dateKey = '') {
    const canonName = Analytics.getCanonicalOfficerName(officerName);

    // Filter from allRecords for kthtGiu (all-time held), or filteredRecords for period categories
    const sourcePool = (category === 'kthtGiu')
      ? allRecords
      : ((filteredRecords && filteredRecords.length > 0) ? filteredRecords : allRecords);

    let records = sourcePool.filter(r => {
      const rawCb = r.canBoBBT && r.canBoBBT.trim() ? r.canBoBBT.trim() : 'Khác / Chưa xếp';
      const cb = Analytics.getCanonicalOfficerName(rawCb);
      if (cb !== canonName && !cb.includes(canonName) && !canonName.includes(cb)) return false;

      if (category !== 'kthtGiu' && dateKey && dateKey !== '' && dateKey !== 'Chưa có ngày') {
        let rDateKey = r.ngayChuyen && r.ngayChuyen.trim() ? Analytics.normalizeDateStr(r.ngayChuyen) : '';
        let rTraKey = r.ngayKthtChuyenVe && r.ngayKthtChuyenVe.trim() ? Analytics.normalizeDateStr(r.ngayKthtChuyenVe) : '';

        if (activePeriodType === 'week') {
          rDateKey = Analytics.getWeekLabel(r.ngayChuyen);
          rTraKey = Analytics.getWeekLabel(r.ngayKthtChuyenVe);
        } else if (activePeriodType === 'month') {
          rDateKey = Analytics.getMonthLabel(r.ngayChuyen);
          rTraKey = Analytics.getMonthLabel(r.ngayKthtChuyenVe);
        }

        const matchChuyen = rDateKey && (rDateKey === dateKey || rDateKey.includes(dateKey));
        const matchTra = rTraKey && (rTraKey === dateKey || rTraKey.includes(dateKey));

        if (!matchChuyen && !matchTra) return false;
      }

      if (category === 'KP17') {
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        const kp = r.khuPho ? String(r.khuPho).trim() : '';
        return to.includes('1') || kp.includes('17');
      } else if (category === 'KP18') {
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        const kp = r.khuPho ? String(r.khuPho).trim() : '';
        return to.includes('2') || kp.includes('18');
      } else if (category === 'KP19') {
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        const kp = r.khuPho ? String(r.khuPho).trim() : '';
        return to.includes('3') || kp.includes('19');
      } else if (category === 'thongQua') {
        const st = r.trangThai || '';
        return st.includes('3.') || st.includes('thông qua');
      } else if (category === 'kthtGiu') {
        const st = r.trangThai || '';
        return st.includes('1.') || st.includes('Đã chuyển');
      } else if (category === 'traSua') {
        const st = r.trangThai || '';
        return st.includes('2.1') || st.includes('4.') || st.includes('Trả') || st.includes('chuyển sửa');
      }

      return true;
    });

    openDossierBatchModal(officerName, category, dateKey, records);
  }

  function openDossierBatchModal(officerName, category, dateKey, records) {
    const modal = document.getElementById('recordDetailModal');
    const modalDetailContent = document.getElementById('modalDetailContent');
    if (!modal || !modalDetailContent) return;

    let categoryLabel = 'Tất cả hồ sơ đã chuyển';
    if (category === 'KP17') categoryLabel = 'Hồ sơ Tổ 1 (Khu Phố 17)';
    else if (category === 'KP18') categoryLabel = 'Hồ sơ Tổ 2 (Khu Phố 18)';
    else if (category === 'KP19') categoryLabel = 'Hồ sơ Tổ 3 (Khu Phố 19)';
    else if (category === 'thongQua') categoryLabel = 'Hồ sơ đã được P.KTHTĐT Thông Qua';
    else if (category === 'kthtGiu') categoryLabel = 'Hồ sơ P.KTHTĐT đang giữ thụ lý';
    else if (category === 'traSua') categoryLabel = 'Hồ sơ P.KTHTĐT trả về chỉnh sửa';

    const dateSubtitle = dateKey ? ` | 📅 ${dateKey}` : '';

    if (!records || records.length === 0) {
      modalDetailContent.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <h3 style="color: var(--primary-blue); margin-bottom: 8px;">📋 Cán Bộ: ${officerName}</h3>
          <p style="color: var(--text-muted);">Không tìm thấy hồ sơ chi tiết phù hợp với mục ${categoryLabel}.</p>
        </div>
      `;
      modal.classList.add('active');
      return;
    }

    const rowsHtml = records.map((r, i) => {
      const maHS = r.maHoSo || `STT ${r.stt}`;
      const hoTen = r.hoTen || 'Không tên';
      const diaChi = `${r.duong ? r.duong + ', ' : ''}${r.phuong ? r.phuong : ''} (Thửa: ${r.thuaDat || '-'}, Tờ: ${r.toBanDo || '-'})`;
      const kp = r.khuPho ? `KP ${r.khuPho}` : (r.toBoiThuong || '-');
      const ngayChuyen = r.ngayChuyen || '-';

      let stBadge = `<span class="badge badge-neutral">${r.trangThai || 'Khác'}</span>`;
      if (r.trangThai && (r.trangThai.includes('3.') || r.trangThai.includes('thông qua'))) {
        stBadge = `<span class="badge badge-success">3. Thông qua</span>`;
      } else if (r.trangThai && (r.trangThai.includes('1.') || r.trangThai.includes('Đã chuyển'))) {
        stBadge = `<span class="badge badge-warning">1. KTHT giữ</span>`;
      } else if (r.trangThai && (r.trangThai.includes('2.1') || r.trangThai.includes('4.') || r.trangThai.includes('Trả'))) {
        stBadge = `<span class="badge badge-danger">Trả sửa</span>`;
      }

      let baseLinkUrl = r.baseLink;
      if (!baseLinkUrl) {
        if (r.baseJobId) {
          baseLinkUrl = `https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da?job=${r.baseJobId}`;
        } else if (r.maHoSo) {
          baseLinkUrl = `https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da?q=${encodeURIComponent(r.maHoSo)}`;
        } else {
          baseLinkUrl = `https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da`;
        }
      }

      return `
        <tr>
          <td class="text-center" style="font-weight: 700;">${i + 1}</td>
          <td><span class="badge badge-info" style="font-weight: 700;">${maHS}</span></td>
          <td><strong>${hoTen}</strong><br><small style="opacity: 0.75;">${diaChi}</small></td>
          <td class="text-center"><span class="badge badge-neutral">${kp}</span></td>
          <td class="text-center">${stBadge}</td>
          <td class="text-center" style="white-space: nowrap;">📅 ${ngayChuyen}</td>
          <td class="text-center">
            <a href="${baseLinkUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 0.775rem; box-shadow: 0 2px 6px rgba(37,99,235,0.25); transition: all 0.2s ease;">
              🚀 Mở Base ↗
            </a>
          </td>
        </tr>
      `;
    }).join('');

    modalDetailContent.innerHTML = `
      <div style="margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h3 style="color: var(--primary-blue); font-size: 1.15rem; margin-bottom: 4px;">
          📋 Danh Sách Hồ Sơ: <strong>${officerName}</strong>
        </h3>
        <div style="font-size: 0.875rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span>Phân loại: <strong style="color: var(--primary-dark);">${categoryLabel}</strong> ${dateSubtitle}</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 0.8rem;">
            Tổng số: ${records.length} hồ sơ
          </span>
        </div>
      </div>
      <div style="overflow-x: auto; max-height: 520px; border: 1px solid var(--border-color); border-radius: 8px;">
        <table class="data-table" style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: var(--card-bg, #ffffff); z-index: 10;">
            <tr>
              <th class="text-center" style="width: 40px;">STT</th>
              <th>MÃ HỒ SƠ</th>
              <th>CHỦ HỘ & ĐỊA CHỈ</th>
              <th class="text-center">PHÂN KHU</th>
              <th class="text-center">TRẠNG THÁI</th>
              <th class="text-center">NGÀY CHUYỂN</th>
              <th class="text-center" style="width: 130px;">BASE WORKFLOW</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 12px; font-size: 0.8rem; font-style: italic; color: var(--text-muted); text-align: right;">
        * Nhấn "🚀 Mở Base ↗" để mở trực tiếp hồ sơ công việc tương ứng trên hệ thống Base.vn
      </div>
    `;

    modal.classList.add('active');
  }

  // 12. Render Master Section VII (Khối lượng hồ sơ theo Cán bộ Pháp chế & Thụ lý KTHT)
  function renderSection7() {
    const isDateFiltered = Boolean(window.IS_DATE_FILTERED);
    const isKhuPhoFiltered = currentFilter.kpFilter !== 'ALL';
    const searchVal7 = currentFilter.query || '';
    const dateRange7 = { from: currentFilter.fromD || null, to: currentFilter.toD || null };

    const tableElement7 = document.getElementById('tableSection7');
    if (tableElement7) {
      const thead7 = tableElement7.querySelector('thead');
      if (thead7) {
        const timeHeaderTitle7 = activePeriodType === 'week' ? 'TUẦN CHUYỂN' : (activePeriodType === 'month' ? 'THÁNG CHUYỂN' : 'NGÀY CHUYỂN');
        if (isDateFiltered) {
          thead7.innerHTML = `
            <tr>
              <th class="text-center" style="width: 50px;">STT</th>
              <th class="text-center" style="min-width: 130px;">${timeHeaderTitle7}</th>
              <th>CÁN BỘ THỤ LÝ / PHÁP CHẾ</th>
              <th class="text-center">PHÂN KHU</th>
              <th class="text-center">TỔNG HS XỬ LÝ</th>
              <th class="text-center">SỐ HS DUYỆT</th>
              <th class="text-center">HS TRẢ SỬA</th>
              <th>GHI CHÚ</th>
            </tr>
          `;
        } else {
          thead7.innerHTML = `
            <tr>
              <th class="text-center" style="width: 50px;">STT</th>
              <th>CÁN BỘ THỤ LÝ / PHÁP CHẾ</th>
              <th class="text-center">PHÂN KHU</th>
              <th class="text-center">TỔNG HS XỬ LÝ</th>
              <th class="text-center">SỐ HS DUYỆT</th>
              <th class="text-center">HS TRẢ SỬA</th>
              <th>GHI CHÚ</th>
            </tr>
          `;
        }
      }
    }

    const list = Analytics.getDetailedPhapCheBreakdown(filteredRecords, activePeriodType, allRecords, isDateFiltered, isKhuPhoFiltered, searchVal7, dateRange7);
    const tbody = document.getElementById('tbodySection7');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      const colspanTotal = isDateFiltered ? 8 : 7;
      const hint = (searchVal7 && searchVal7.trim())
        ? `Không có dòng nào ở Bảng V khớp từ khóa "<strong>${searchVal7.trim()}</strong>".<br><small style="opacity:0.75;">Bảng V chỉ tìm theo Cán bộ pháp chế, Thời gian, Phân khu, Ghi chú.</small>`
        : 'Không tìm thấy dữ liệu phù hợp.';
      tbody.innerHTML = `<tr><td colspan="${colspanTotal}" class="text-center" style="padding:20px;">${hint}</td></tr>`;
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

      const kpList = [];
      if (item.kp17 > 0) kpList.push('<span class="badge badge-neutral">KP 17</span>');
      if (item.kp18 > 0) kpList.push('<span class="badge badge-neutral">KP 18</span>');
      if (item.kp19 > 0) kpList.push('<span class="badge badge-neutral">KP 19</span>');
      if (kpList.length === 0 && item.khuPho) {
        kpList.push(`<span class="badge badge-neutral">${item.khuPho}</span>`);
      }
      const kpTd = kpList.length > 0 ? kpList.join(' ') : '<span class="badge badge-neutral">-</span>';

      tr.innerHTML = `
        <td class="text-center"><strong>${idx + 1}</strong></td>
        ${timeTd}
        <td><strong>${item.cbtl}</strong></td>
        <td class="text-center">${kpTd}</td>
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
      <td class="text-center">
        <span style="font-size:0.8125rem; font-weight:600;">KP17: ${sum17} | KP18: ${sum18} | KP19: ${sum19}</span>
      </td>
      <td class="text-center"><strong>${sumTotal}</strong></td>
      <td class="text-center"><strong>${sumThongQua}</strong></td>
      <td class="text-center"><strong>${sumTraSua}</strong></td>
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
