/**
 * analytics.js - Engine calculating all 8 summary tables & dynamic filters
 */

(function (window) {
  'use strict';

  // Helper to parse date string DD/MM/YYYY into JS Date object
  function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  // Get ISO Week Number & Label (e.g. "Tuần 26 (23/06 - 29/06/2026)")
  function getWeekLabel(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return 'Khác';
    
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
    
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayNr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatShort = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    return `Tuần ${weekNumber} (${formatShort(monday)} - ${formatShort(sunday)})`;
  }

  function getMonthLabel(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return 'Khác';
    return `Tháng ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  function normalizeDateStr(dateStr) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    if (!s) return '';
    if (s.includes('-')) {
      const p = s.split('-');
      if (p.length === 3) {
        return `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`;
      }
    }
    if (s.includes('/')) {
      const p = s.split('/');
      if (p.length === 3) {
        return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
    }
    return s;
  }

  function removeVietnameseTones(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    s = s.replace(/đ/g, "d");
    return s;
  }

  const Analytics = {
    parseDate,
    normalizeDateStr,
    getWeekLabel,
    getMonthLabel,
    removeVietnameseTones,

    // 1. Section I: Tiến độ Pháp lý Chi tiết theo Từng Phân Khu
    getLegalProgressByKhuPho(records) {
      const result = {
        'KP 17': { totalBase: 0, totalGui: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'KP 18': { totalBase: 0, totalGui: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'KP 19': { totalBase: 0, totalGui: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'TỔNG CỘNG': { totalBase: 0, totalGui: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 }
      };

      records.forEach(r => {
        const kp = r.khuPho ? `KP ${r.khuPho}` : null;
        if (!kp || !result[kp]) return;

        result[kp].totalGui++;
        result['TỔNG CỘNG'].totalGui++;

        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          result[kp].thongQua++;
          result['TỔNG CỘNG'].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          result[kp].kthtGiu++;
          result['TỔNG CỘNG'].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('Trả về')) {
          result[kp].traSua++;
          result['TỔNG CỘNG'].traSua++;
        } else if (st.includes('4.') || st.includes('chuyển sửa')) {
          result[kp].chuyenSuaLai++;
          result['TỔNG CỘNG'].chuyenSuaLai++;
        }
      });

      // Mặc định totalBase = totalGui
      result['KP 17'].totalBase = result['KP 17'].totalGui;
      result['KP 18'].totalBase = result['KP 18'].totalGui;
      result['KP 19'].totalBase = result['KP 19'].totalGui;
      result['TỔNG CỘNG'].totalBase = result['TỔNG CỘNG'].totalGui;

      // Nếu có dữ liệu Base Workflow API (Tổng HS nắm giữ):
      let baseTotalSum = 0;
      if (window.BASE_WORKFLOW_COUNTS) {
        Object.keys(window.BASE_WORKFLOW_COUNTS).forEach(k => {
          if (!k.startsWith('_')) {
            baseTotalSum += (window.BASE_WORKFLOW_COUNTS[k] || 0);
          }
        });
      }

      const allRecs = (window.ALL_RECORDS && window.ALL_RECORDS.length > 0) ? window.ALL_RECORDS : records;
      let c17 = 0, c18 = 0, c19 = 0;
      allRecs.forEach(r => {
        const kp = String(r.khuPho || '').trim();
        if (kp === '17') c17++;
        else if (kp === '18') c18++;
        else if (kp === '19') c19++;
      });
      const totAll = c17 + c18 + c19;

      if (baseTotalSum > 0) {
        if (totAll > 0) {
          const b17 = Math.round(baseTotalSum * (c17 / totAll));
          const b18 = Math.round(baseTotalSum * (c18 / totAll));
          const b19 = baseTotalSum - b17 - b18;

          result['KP 17'].totalBase = b17;
          result['KP 18'].totalBase = b18;
          result['KP 19'].totalBase = b19;
        } else {
          const b17 = Math.round(baseTotalSum / 3);
          const b18 = Math.round(baseTotalSum / 3);
          const b19 = baseTotalSum - b17 - b18;
          result['KP 17'].totalBase = b17;
          result['KP 18'].totalBase = b18;
          result['KP 19'].totalBase = b19;
        }
        result['TỔNG CỘNG'].totalBase = baseTotalSum;
      } else {
        result['KP 17'].totalBase = c17;
        result['KP 18'].totalBase = c18;
        result['KP 19'].totalBase = c19;
        result['TỔNG CỘNG'].totalBase = totAll > 0 ? totAll : result['TỔNG CỘNG'].totalGui;
      }

      return result;
    },

    // 2. Section II: Khối lượng hồ sơ theo Cán bộ BBT x KP
    getVolumeByOfficer(records) {
      const map = {};
      records.forEach(r => {
        const cb = r.canBoBBT || 'Không xác định';
        const kp = r.khuPho ? `KP ${r.khuPho}` : 'Khác';
        if (!map[cb]) {
          map[cb] = { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
        }
        if (map[cb][kp] !== undefined) {
          map[cb][kp]++;
        }
        map[cb].total++;
      });

      const list = Object.keys(map).map(name => ({
        name,
        kp17: map[name]['KP 17'] || 0,
        kp18: map[name]['KP 18'] || 0,
        kp19: map[name]['KP 19'] || 0,
        total: map[name].total
      }));

      list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'));
      return list;
    },

    // 3. Section III: Chi tiết diễn biến trạng thái hồ sơ x KP
    getStatusDetail(records) {
      const statuses = [
        '3. Hồ sơ thông qua nhận định pháp lý',
        '1. Đã chuyển phòng KTHTĐT',
        '2.1. Trả về chỉnh sửa lần 1',
        '4. Hồ sơ chuyển sửa chỉnh lại'
      ];

      const map = {};
      statuses.forEach(s => {
        map[s] = { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
      });

      records.forEach(r => {
        const st = r.trangThai;
        const kp = r.khuPho ? `KP ${r.khuPho}` : null;
        if (map[st] && kp && map[st][kp] !== undefined) {
          map[st][kp]++;
          map[st].total++;
        }
      });

      return map;
    },

    // 4. Section IV: Thống kê diện tích / tỷ lệ giải tỏa x KP
    getClearanceStats(records) {
      const stats = {
        toanPhan: { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 },
        motPhan: { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 },
        dienTichToanPhan: { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 },
        dienTichMotPhan: { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 }
      };

      records.forEach(r => {
        const kp = r.khuPho ? `KP ${r.khuPho}` : null;
        if (!kp) return;

        const tpVal = r.giaiToaToanPhan ? parseFloat(r.giaiToaToanPhan.replace('.', '').replace(',', '.')) || 0 : 0;
        const mpVal = r.giaiToaMotPhan ? parseFloat(r.giaiToaMotPhan.replace('.', '').replace(',', '.')) || 0 : 0;

        if (r.giaiToaToanPhan && r.giaiToaToanPhan.trim() !== '') {
          stats.toanPhan[kp]++;
          stats.toanPhan.total++;
          stats.dienTichToanPhan[kp] += tpVal;
          stats.dienTichToanPhan.total += tpVal;
        }

        if (r.giaiToaMotPhan && r.giaiToaMotPhan.trim() !== '') {
          stats.motPhan[kp]++;
          stats.motPhan.total++;
          stats.dienTichMotPhan[kp] += mpVal;
          stats.dienTichMotPhan.total += mpVal;
        }
      });

      return stats;
    },

    // 5. Section V: Phân biệt điều hành theo Tổ Bồi Thường x KP
    getCompensationTeamStats(records) {
      const teams = ['Tổ 1', 'Tổ 2', 'Tổ 3'];
      const map = {};
      teams.forEach(t => {
        map[t] = { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
      });

      records.forEach(r => {
        const t = r.toBoiThuong;
        const kp = r.khuPho ? `KP ${r.khuPho}` : null;
        if (map[t] && kp && map[t][kp] !== undefined) {
          map[t][kp]++;
          map[t].total++;
        }
      });

      return map;
    },

    // 6. Section VI: Lượng hồ sơ chuyển về theo Ngày
    getVolumeByDate(records) {
      const map = {};
      records.forEach(r => {
        const dt = r.ngayChuyen || 'Chưa ngày';
        const kp = r.khuPho ? `KP ${r.khuPho}` : 'Khác';
        if (!map[dt]) {
          map[dt] = { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0 };
        }
        if (map[dt][kp] !== undefined) {
          map[dt][kp]++;
        }
        map[dt].total++;
      });

      const dates = Object.keys(map).sort((a, b) => {
        const dA = parseDate(a);
        const dB = parseDate(b);
        if (!dA) return 1;
        if (!dB) return -1;
        return dB - dA;
      });

      return dates.map(dt => ({
        date: dt,
        kp17: map[dt]['KP 17'] || 0,
        kp18: map[dt]['KP 18'] || 0,
        kp19: map[dt]['KP 19'] || 0,
        total: map[dt].total
      }));
    },

    // 7. Bổ sung 1 (Section VII): Khối lượng hồ sơ theo Pháp chế kiểm tra
    getVolumeByPhapChe(records) {
      const map = {};
      records.forEach(r => {
        const pc = r.phapChe && r.phapChe.trim() ? r.phapChe.trim() : 'Chưa phân công / Trống';
        const kp = r.khuPho ? `KP ${r.khuPho}` : 'Khác';
        if (!map[pc]) {
          map[pc] = { 'KP 17': 0, 'KP 18': 0, 'KP 19': 0, total: 0, thongQua: 0, kthtGiu: 0 };
        }
        if (map[pc][kp] !== undefined) {
          map[pc][kp]++;
        }
        map[pc].total++;

        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          map[pc].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          map[pc].kthtGiu++;
        }
      });

      const list = Object.keys(map).map(name => ({
        name,
        kp17: map[name]['KP 17'] || 0,
        kp18: map[name]['KP 18'] || 0,
        kp19: map[name]['KP 19'] || 0,
        thongQua: map[name].thongQua,
        kthtGiu: map[name].kthtGiu,
        total: map[name].total
      }));

      list.sort((a, b) => b.total - a.total);
      return list;
    },

    // Section VII Master: Thống kê chi tiết Khối lượng hồ sơ theo Cán bộ Pháp chế kiểm tra
    getDetailedPhapCheBreakdown(records, periodType = 'date', allRecords = [], isDateFiltered = false, isKhuPhoFiltered = false, searchVal = '', selectedDateVal = '') {
      // Prioritize dataset auto-synced from Google Sheet pubhtml for Table VII
      const tableVIIDaily = window.TABLE_VII_DATA_DAILY || [];
      const tableVIIWeekly = window.TABLE_VII_DATA_WEEKLY || [];

      if (tableVIIDaily.length > 0) {
        let sourceList = tableVIIDaily;
        if (periodType === 'week' && tableVIIWeekly.length > 0 && tableVIIWeekly.some(r => r.canBo || r.soHsDuyet || r.soHsTraSua)) {
          sourceList = tableVIIWeekly;
        }

        const selectedKp = document.getElementById('phankhuSelect7')?.value || document.getElementById('phankhuSelect')?.value;

        // Apply filters to Table VII Google Sheet records
        const filtered = sourceList.filter(r => {
          // Phân khu filter
          if (isKhuPhoFiltered && selectedKp && selectedKp !== 'ALL') {
            if (r.khuPho !== selectedKp && !r.khuPho.includes(selectedKp)) return false;
          }

          // Date / Period filter
          if (isDateFiltered && selectedDateVal && selectedDateVal !== 'ALL') {
            let matchDate = (r.timeKey === selectedDateVal || r.timeKey.includes(selectedDateVal));
            if (!matchDate) {
              if (periodType === 'week') {
                const wLabel = getWeekLabel(r.timeKey);
                if (wLabel === selectedDateVal || wLabel.includes(selectedDateVal)) matchDate = true;
              } else if (periodType === 'month') {
                const mLabel = getMonthLabel(r.timeKey);
                if (mLabel === selectedDateVal || mLabel.includes(selectedDateVal)) matchDate = true;
              }
            }
            if (!matchDate) return false;
          }

          // Search query filter
          if (searchVal && searchVal.trim()) {
            const q = searchVal.trim().toLowerCase();
            const text = `${r.canBo} ${r.timeKey} ${r.khuPho} ${r.ghiChu}`.toLowerCase();
            if (!text.includes(q)) return false;
          }

          return true;
        });

        // Group records
        const map = {};
        filtered.forEach(r => {
          const cb = (r.canBo && r.canBo.trim()) ? r.canBo.trim() : 'Chưa phân công / Trống';
          const cleanCb = cb.toLowerCase();
          if (cleanCb === 'thụ lý' || cleanCb === 'cán bộ' || cleanCb === 'cán bộ thụ lý' || cleanCb === 'thụ lý bqlda' || cleanCb === 'tên cán bộ') {
            return;
          }
          
          let tKey = '';
          if (isDateFiltered) {
            if (periodType === 'week') tKey = getWeekLabel(r.timeKey);
            else if (periodType === 'month') tKey = getMonthLabel(r.timeKey);
            else tKey = r.timeKey || '';
          }

          const mapKey = isDateFiltered ? `${tKey}___${cb}` : cb;

          if (!map[mapKey]) {
            map[mapKey] = {
              timeKey: tKey,
              cbtl: cb,
              kp17: 0,
              kp18: 0,
              kp19: 0,
              totalChuyen: 0,
              thongQua: 0,
              kthtGiu: 0,
              traSua: 0,
              ghiChuSet: new Set()
            };
          }

          const kp = String(r.khuPho).trim();
          const totalRowHs = (r.tongHs !== undefined) ? r.tongHs : ((r.soHsDuyet || 0) + (r.soHsTraSua || 0));
          const duyetRowHs = r.soHsDuyet || 0;
          const traSuaRowHs = r.soHsTraSua || 0;

          if (kp === '17' || kp.includes('17')) map[mapKey].kp17 += totalRowHs;
          else if (kp === '18' || kp.includes('18')) map[mapKey].kp18 += totalRowHs;
          else if (kp === '19' || kp.includes('19')) map[mapKey].kp19 += totalRowHs;
          else {
            map[mapKey].kp17 += totalRowHs;
          }

          map[mapKey].totalChuyen += totalRowHs;
          map[mapKey].thongQua += duyetRowHs;
          map[mapKey].traSua += traSuaRowHs;

          if (r.ghiChu && r.ghiChu.trim()) {
            map[mapKey].ghiChuSet.add(r.ghiChu.trim());
          }
        });

        let list = Object.values(map).map(item => ({
          ...item,
          ghiChu: Array.from(item.ghiChuSet).join('; ')
        }));

        list.sort((a, b) => {
          if (isDateFiltered && periodType === 'date') {
            const dA = parseDate(a.timeKey);
            const dB = parseDate(b.timeKey);
            if (dA && dB && dB.valueOf() !== dA.valueOf()) return dB - dA;
          }
          if (b.totalChuyen !== a.totalChuyen) return b.totalChuyen - a.totalChuyen;
          return a.cbtl.localeCompare(b.cbtl, 'vi');
        });

        return list;
      }

      const source = (allRecords && allRecords.length > 0) ? allRecords : records;

      // Tính tổng số liệu ĐÓ GIỜ cho tất cả Cán bộ Pháp chế từ source
      const allTimeMap = {};
      source.forEach(r => {
        const cb = (r.phapChe && r.phapChe.trim()) ? r.phapChe.trim() : ((r.canBoKTHT && r.canBoKTHT.trim()) ? r.canBoKTHT.trim() : 'Chưa phân công / Trống');
        if (!allTimeMap[cb]) {
          allTimeMap[cb] = { totalChuyen: 0, thongQua: 0, kthtGiu: 0, traSua: 0 };
        }
        allTimeMap[cb].totalChuyen++;
        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          allTimeMap[cb].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          allTimeMap[cb].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('4.') || st.includes('Trả về') || st.includes('chuyển sửa')) {
          allTimeMap[cb].traSua++;
        }
      });

      const allOfficers = new Set(Object.keys(allTimeMap));

      if (!isDateFiltered) {
        const map = {};
        allOfficers.forEach(cb => {
          map[cb] = {
            timeKey: '',
            cbtl: cb,
            kp17: 0,
            kp18: 0,
            kp19: 0,
            totalChuyen: allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0,
            thongQua: allTimeMap[cb] ? allTimeMap[cb].thongQua : 0,
            kthtGiu: allTimeMap[cb] ? allTimeMap[cb].kthtGiu : 0,
            traSua: allTimeMap[cb] ? allTimeMap[cb].traSua : 0,
            filteredTotal: 0
          };
        });

        records.forEach(r => {
          const cb = (r.phapChe && r.phapChe.trim()) ? r.phapChe.trim() : ((r.canBoKTHT && r.canBoKTHT.trim()) ? r.canBoKTHT.trim() : 'Chưa phân công / Trống');
          if (!map[cb]) {
            map[cb] = {
              timeKey: '',
              cbtl: cb,
              kp17: 0,
              kp18: 0,
              kp19: 0,
              totalChuyen: allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0,
              thongQua: allTimeMap[cb] ? allTimeMap[cb].thongQua : 0,
              kthtGiu: allTimeMap[cb] ? allTimeMap[cb].kthtGiu : 0,
              traSua: allTimeMap[cb] ? allTimeMap[cb].traSua : 0,
              filteredTotal: 0
            };
          }

          let kp = '';
          const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
          if (to === 'Tổ 1' || to.includes('1')) kp = '17';
          else if (to === 'Tổ 2' || to.includes('2')) kp = '18';
          else if (to === 'Tổ 3' || to.includes('3')) kp = '19';
          else kp = r.khuPho ? String(r.khuPho).trim() : '';

          if (kp === '17' || kp.includes('17')) map[cb].kp17++;
          else if (kp === '18' || kp.includes('18')) map[cb].kp18++;
          else if (kp === '19' || kp.includes('19')) map[cb].kp19++;

          map[cb].filteredTotal++;
        });

        let list = Object.values(map);
        if (isKhuPhoFiltered || (records && records.length < source.length)) {
          list = list.filter(item => item.filteredTotal > 0 || item.totalChuyen > 0);
        } else {
          list = list.filter(item => item.totalChuyen > 0);
        }

        list.sort((a, b) => b.totalChuyen - a.totalChuyen || a.cbtl.localeCompare(b.cbtl, 'vi'));
        return list;
      }

      // KHI CÓ LỌC NGÀY / TUẦN / THÁNG CỤ THỂ
      const map = {};
      records.forEach(r => {
        const cb = (r.phapChe && r.phapChe.trim()) ? r.phapChe.trim() : 'Chưa phân công / Trống';
        let timeKey = r.ngayChuyen && r.ngayChuyen.trim() ? r.ngayChuyen.trim() : 'Chưa có ngày';
        if (periodType === 'week') {
          timeKey = getWeekLabel(r.ngayChuyen);
        } else if (periodType === 'month') {
          timeKey = getMonthLabel(r.ngayChuyen);
        }

        const key = `${timeKey}___${cb}`;
        if (!map[key]) {
          map[key] = {
            timeKey: timeKey,
            cbtl: cb,
            kp17: 0,
            kp18: 0,
            kp19: 0,
            totalChuyen: 0,
            thongQua: 0,
            kthtGiu: 0,
            traSua: 0,
            filteredTotal: 0
          };
        }

        let kp = '';
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        if (to === 'Tổ 1' || to.includes('1')) kp = '17';
        else if (to === 'Tổ 2' || to.includes('2')) kp = '18';
        else if (to === 'Tổ 3' || to.includes('3')) kp = '19';
        else kp = r.khuPho ? String(r.khuPho).trim() : '';

        if (kp === '17' || kp.includes('17')) map[key].kp17++;
        else if (kp === '18' || kp.includes('18')) map[key].kp18++;
        else if (kp === '19' || kp.includes('19')) map[key].kp19++;

        map[key].totalChuyen++;

        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          map[key].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          map[key].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('4.') || st.includes('Trả') || st.includes('chuyển sửa')) {
          map[key].traSua++;
        }

        map[key].filteredTotal++;
      });

      let list = Object.values(map);
      list.sort((a, b) => {
        if (periodType === 'date') {
          const dA = parseDate(a.timeKey);
          const dB = parseDate(b.timeKey);
          if (dA && dB && dB.valueOf() !== dA.valueOf()) return dB - dA;
        }
        const timeCompare = b.timeKey.localeCompare(a.timeKey, 'vi');
        if (timeCompare !== 0) return timeCompare;
        if (b.totalChuyen !== a.totalChuyen) return b.totalChuyen - a.totalChuyen;
        return a.cbtl.localeCompare(b.cbtl, 'vi');
      });

      return list;
    },

    // 8. Bổ sung 2 (Section VIII): Thống kê Cán bộ đem hồ sơ qua theo Ngày / Tuần / Tháng
    getOfficerTransferTimeBreakdown(records, periodType = 'date') {
      const map = {};

      records.forEach(r => {
        const cb = r.canBoBBT || 'Không xác định';
        let key = r.ngayChuyen || 'Chưa ngày';
        if (periodType === 'week') {
          key = getWeekLabel(r.ngayChuyen);
        } else if (periodType === 'month') {
          key = getMonthLabel(r.ngayChuyen);
        }

        if (!map[key]) {
          map[key] = { officers: {}, total: 0 };
        }
        map[key].officers[cb] = (map[key].officers[cb] || 0) + 1;
        map[key].total++;
      });

      const timeKeys = Object.keys(map).sort((a, b) => {
        if (periodType === 'date') {
          const dA = parseDate(a);
          const dB = parseDate(b);
          if (!dA) return 1;
          if (!dB) return -1;
          return dB - dA;
        } else {
          return b.localeCompare(a, 'vi');
        }
      });

      return timeKeys.map(timeKey => ({
        timeKey,
        total: map[timeKey].total,
        officers: map[timeKey].officers
      }));
    },

    getCanonicalOfficerName(cbName) {
      if (!cbName) return 'Khác / Chưa xếp';
      const name = String(cbName).trim();

      if (window.BASE_HRM_NAMES && window.BASE_HRM_NAMES[name]) {
        return window.BASE_HRM_NAMES[name];
      }

      const map = {
        "thachhq": "Hồ Quốc Thạch", "Quốc Thạch": "Hồ Quốc Thạch",
        "minhth": "Trịnh Hoàng Minh", "Hoàng Minh": "Trịnh Hoàng Minh",
        "baotd": "Trần Duy Bảo", "Duy Bảo": "Trần Duy Bảo",
        "nhunt": "Nguyễn Thị Thiện Như", "Thiện Như": "Nguyễn Thị Thiện Như",
        "oanhdck": "Đặng Cao Kiều Oanh", "Kiều Oanh": "Đặng Cao Kiều Oanh",
        "khanhptv": "Phạm Thị Vân Khánh", "Vân Khánh": "Phạm Thị Vân Khánh",
        "thuonghh": "Hoàng Hoài Thương", "Hoài Thương": "Hoàng Hoài Thương",
        "phucvt": "Võ Trọng Phúc", "Trọng Phúc": "Võ Trọng Phúc",
        "lamdtt": "Đoàn Thị Tố Lam", "Tố Lam": "Đoàn Thị Tố Lam",
        "tanhv": "Huỳnh Văn Tân", "Văn Tân": "Huỳnh Văn Tân",
        "quyendtt": "Đỗ Thị Thúy Quyên", "Thúy Quyên": "Đỗ Thị Thúy Quyên",
        "baohlq": "Lê Quốc Bảo", "Quốc Bảo": "Lê Quốc Bảo",
        "thuongctm": "Cao Thị Mỹ Thương", "Mỹ Thương": "Cao Thị Mỹ Thương",
        "nhanvt": "Vương Trọng Nhân", "Trọng Nhân": "Vương Trọng Nhân",
        "quannm": "Nguyễn Minh Quân", "Minh Quân": "Nguyễn Minh Quân",
        "thinhpn": "Phạm Ngọc Thịnh", "Ngọc Thịnh": "Phạm Ngọc Thịnh",
        "tuyennt": "Nguyễn Thanh Tuyền", "Thanh Tuyền": "Nguyễn Thanh Tuyền",
        "trannn": "Nguyễn Ngọc Trân", "Ngọc Trân": "Nguyễn Ngọc Trân",
        "trailq": "Lê Quang Trãi", "Quang Trãi": "Lê Quang Trãi",
        "hainv": "Ngô Văn Hải", "Văn Hải": "Ngô Văn Hải",
        "trucplx": "Phạm Lê Xuân Trúc", "Xuân Trúc": "Phạm Lê Xuân Trúc",
        "hiennv": "Nguyễn Vinh Hiển", "Vinh Hiển": "Nguyễn Vinh Hiển",
        "chaundm": "Nguyễn Đoàn Minh Châu", "Minh Châu": "Nguyễn Đoàn Minh Châu",
        "vinhdhd": "Đặng Hải Đăng Vinh", "Đăng Vinh": "Đặng Hải Đăng Vinh",
        "nguyennnt": "Nguyễn Ngọc Thảo Nguyên", "Thảo Nguyên": "Nguyễn Ngọc Thảo Nguyên",
        "nganntt": "Nguyễn Thị Thiên Ngân", "Thiên Ngân": "Nguyễn Thị Thiên Ngân",
        "phuongll": "Lê Lan Phương", "Lan Phương": "Lê Lan Phương",
        "hattn": "Trần Thị Như Hà", "Như Hà": "Trần Thị Như Hà",
        "nganmnk": "Mai Ngọc Kim Ngân", "Kim Ngân": "Mai Ngọc Kim Ngân",
        "tuanla": "Lê Anh Tuấn", "Anh Tuấn": "Lê Anh Tuấn",
        "giangnpt": "Nguyễn Phạm Thành Giang", "Thành Giang": "Nguyễn Phạm Thành Giang",
        "quangpd": "Phạm Duy Quang", "Duy Quang": "Phạm Duy Quang",
        "nghiadt": "Đoàn Trí Nghĩa", "Trí Nghĩa": "Đoàn Trí Nghĩa",
        "nhutnu": "Tô Ngọc Uyên Như", "Uyên Như": "Tô Ngọc Uyên Như",
        "tungnt": "Nguyễn Thanh Tùng", "Thanh Tùng": "Nguyễn Thanh Tùng",
        "linhpta": "Phan Thị Ánh Linh", "Ánh Linh": "Phan Thị Ánh Linh",
        "haola": "Lý Anh Hào", "Anh Hào": "Lý Anh Hào",
        "vittb": "Trần Thị Bảo Vi", "Bảo Vi": "Trần Thị Bảo Vi",
        "thutna": "Trương Ngọc Anh Thư", "Anh Thư": "Trương Ngọc Anh Thư",
        "linhhk": "Hồ Khánh Linh", "Khánh Linh": "Hồ Khánh Linh",
        "anhvpm": "Hoàng Anh", "Hoàng Anh": "Hoàng Anh",
        "huyhbm": "Huỳnh Bá Minh Huy", "Minh Huy": "Huỳnh Bá Minh Huy"
      };

      if (map[name]) return map[name];
      if (name.includes('/')) {
        return name.split('/').map(p => this.getCanonicalOfficerName(p.trim())).join(' / ');
      }
      for (const [k, v] of Object.entries(map)) {
        if (name.toLowerCase() === k.toLowerCase()) {
          return v;
        }
      }
      return name;
    },

    getOfficerFullName(cbName) {
      return this.getCanonicalOfficerName(cbName);
    },

    getBaseCountForOfficer(cbName) {
      if (!window.BASE_WORKFLOW_COUNTS) return 0;
      const baseMap = window.BASE_WORKFLOW_COUNTS;
      const name = String(cbName || '').trim();

      if (!name || name.includes('Chưa') || name.includes('Khác')) return 0;
      
      const canon = this.getCanonicalOfficerName(name);
      if (baseMap[canon] !== undefined) return baseMap[canon];
      if (baseMap[name] !== undefined) return baseMap[name];

      if (name.includes('/')) {
        const parts = name.split('/');
        let sum = 0;
        parts.forEach(p => {
          sum += this.getBaseCountForOfficer(p.trim());
        });
        if (sum > 0) return sum;
      }

      let total = 0;
      let found = false;
      const lName = name.toLowerCase();

      Object.keys(baseMap).forEach(key => {
        if (key.startsWith('_')) return;
        const lKey = key.toLowerCase();
        if (lName.includes(lKey) || lKey.includes(lName)) {
          total += baseMap[key];
          found = true;
        }
      });

      return found ? total : 0;
    },

    // Section VI & VIII Unified: Thống kê chi tiết Lượng hồ sơ chuyển về theo Ngày/Tuần/Tháng x Cán bộ BBT
    getDetailedTransferBreakdown(records, periodType = 'date', allRecords = [], isDateFiltered = false, isKhuPhoFiltered = false) {
      const source = (allRecords && allRecords.length > 0) ? allRecords : records;

      // Tính tổng số liệu ĐÓ GIỜ (All-Time Overall Totals) cho tất cả Cán bộ BBT từ source
      const allTimeMap = {};
      source.forEach(r => {
        const rawCb = r.canBoBBT && r.canBoBBT.trim() ? r.canBoBBT.trim() : 'Khác / Chưa xếp';
        const cleanCb = rawCb.toLowerCase();
        if (cleanCb === 'thụ lý' || cleanCb === 'cán bộ' || cleanCb === 'cán bộ thụ lý' || cleanCb === 'thụ lý bqlda' || cleanCb === 'tên cán bộ' || cleanCb === 'stt' || cleanCb === 'khu phố') {
          return;
        }
        const cb = this.getCanonicalOfficerName(rawCb);
        if (!allTimeMap[cb]) {
          allTimeMap[cb] = { totalChuyen: 0, thongQua: 0, kthtGiu: 0, traSua: 0 };
        }
        allTimeMap[cb].totalChuyen++;
        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          allTimeMap[cb].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          allTimeMap[cb].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('Trả về')) {
          allTimeMap[cb].traSua++;
        }
      });

      const allOfficers = new Set(Object.keys(allTimeMap));

      // Include officers from Base Workflow counts into allOfficers set
      if (window.BASE_WORKFLOW_COUNTS) {
        Object.keys(window.BASE_WORKFLOW_COUNTS).forEach(key => {
          if (key.startsWith('_')) return;
          const canon = this.getCanonicalOfficerName(key);
          if (canon && !canon.includes('Chưa') && !canon.includes('Khác') && !canon.includes('Ban QLDA') && !canon.includes('Hoàng Anh') && !canon.includes('anhvpm') && canon !== 'Thụ lý' && canon !== 'Cán bộ') {
            if (window.BASE_HRM_DEPARTMENTS && window.BASE_HRM_DEPARTMENTS[canon]) {
              const dept = String(window.BASE_HRM_DEPARTMENTS[canon]).toLowerCase();
              if (dept.includes('pháp chế') || dept.includes('hành chính')) return;
            }
            allOfficers.add(canon);
          }
        });
      }

      // BÌNH THƯỜNG (KHI KHÔNG LỌC NGÀY CỤ THỂ): Bảng tổng thể 1 cán bộ = 1 dòng duy nhất!
      if (!isDateFiltered) {
        const map = {};
        allOfficers.forEach(cb => {
          const bCount = this.getBaseCountForOfficer(cb);
          const finalBase = bCount > 0 ? bCount : (allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0);

          map[cb] = {
            timeKey: '',
            cbtl: cb,
            cbtlFull: cb,
            kp17: 0,
            kp18: 0,
            kp19: 0,
            baseTotal: finalBase,
            totalChuyen: allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0,
            thongQua: allTimeMap[cb] ? allTimeMap[cb].thongQua : 0,
            kthtGiu: allTimeMap[cb] ? allTimeMap[cb].kthtGiu : 0,
            traSua: allTimeMap[cb] ? allTimeMap[cb].traSua : 0,
            filteredTotal: 0
          };
        });

        records.forEach(r => {
          const rawCb = r.canBoBBT && r.canBoBBT.trim() ? r.canBoBBT.trim() : 'Khác / Chưa xếp';
          const cleanCb = rawCb.toLowerCase();
          if (cleanCb === 'thụ lý' || cleanCb === 'cán bộ' || cleanCb === 'cán bộ thụ lý' || cleanCb === 'thụ lý bqlda' || cleanCb === 'tên cán bộ' || cleanCb === 'stt' || cleanCb === 'khu phố') {
            return;
          }
          const cb = this.getCanonicalOfficerName(rawCb);
          if (!map[cb]) {
            const bCount = this.getBaseCountForOfficer(cb);
            const finalBase = bCount > 0 ? bCount : (allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0);

            map[cb] = {
              timeKey: '',
              cbtl: cb,
              cbtlFull: cb,
              kp17: 0,
              kp18: 0,
              kp19: 0,
              baseTotal: finalBase,
              totalChuyen: allTimeMap[cb] ? allTimeMap[cb].totalChuyen : 0,
              thongQua: allTimeMap[cb] ? allTimeMap[cb].thongQua : 0,
              kthtGiu: allTimeMap[cb] ? allTimeMap[cb].kthtGiu : 0,
              traSua: allTimeMap[cb] ? allTimeMap[cb].traSua : 0,
              filteredTotal: 0
            };
          }

          let kp = '';
          const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
          if (to === 'Tổ 1' || to.includes('1')) kp = '17';
          else if (to === 'Tổ 2' || to.includes('2')) kp = '18';
          else if (to === 'Tổ 3' || to.includes('3')) kp = '19';
          else kp = r.khuPho ? String(r.khuPho).trim() : '';

          if (kp === '17' || kp.includes('17')) map[cb].kp17++;
          else if (kp === '18' || kp.includes('18')) map[cb].kp18++;
          else if (kp === '19' || kp.includes('19')) map[cb].kp19++;

          map[cb].filteredTotal++;
        });

        let list = Object.values(map);
        if (isKhuPhoFiltered) {
          list = list.filter(item => item.filteredTotal > 0);
        } else if (records && records.length < source.length) {
          list = list.filter(item => item.filteredTotal > 0);
        } else {
          list = list.filter(item => item.totalChuyen > 0 || item.baseTotal > 0);
        }

        list.sort((a, b) => (b.baseTotal || 0) - (a.baseTotal || 0) || (b.totalChuyen || 0) - (a.totalChuyen || 0) || a.cbtlFull.localeCompare(b.cbtlFull, 'vi'));
        return list;
      }

      // KHI CÓ LỌC NGÀY CỤ THỂ: Hiện chi tiết theo mốc Ngày + Cán bộ thuộc đợt lọc
      const timeKeys = new Set();
      records.forEach(r => {
        let timeKey = r.ngayChuyen && r.ngayChuyen.trim() ? r.ngayChuyen.trim() : 'Chưa có ngày';
        if (periodType === 'week') {
          timeKey = getWeekLabel(r.ngayChuyen);
        } else if (periodType === 'month') {
          timeKey = getMonthLabel(r.ngayChuyen);
        }
        timeKeys.add(timeKey);
      });

      const map = {};
      records.forEach(r => {
        const rawCb = r.canBoBBT && r.canBoBBT.trim() ? r.canBoBBT.trim() : 'Khác / Chưa xếp';
        const cleanCb = rawCb.toLowerCase();
        if (cleanCb === 'thụ lý' || cleanCb === 'cán bộ' || cleanCb === 'cán bộ thụ lý' || cleanCb === 'thụ lý bqlda' || cleanCb === 'tên cán bộ' || cleanCb === 'stt' || cleanCb === 'khu phố') {
          return;
        }
        const cb = this.getCanonicalOfficerName(rawCb);
        let timeKey = r.ngayChuyen && r.ngayChuyen.trim() ? r.ngayChuyen.trim() : 'Chưa có ngày';

        if (periodType === 'week') {
          timeKey = getWeekLabel(r.ngayChuyen);
        } else if (periodType === 'month') {
          timeKey = getMonthLabel(r.ngayChuyen);
        }

        const key = `${timeKey}___${cb}`;

        if (!map[key]) {
          map[key] = {
            timeKey: timeKey,
            cbtl: cb,
            cbtlFull: cb,
            kp17: 0,
            kp18: 0,
            kp19: 0,
            baseTotal: 0,
            totalChuyen: 0,
            thongQua: 0,
            kthtGiu: 0,
            traSua: 0,
            filteredTotal: 0
          };
        }

        let kp = '';
        const to = r.toBoiThuong ? String(r.toBoiThuong).trim() : '';
        if (to === 'Tổ 1' || to.includes('1')) kp = '17';
        else if (to === 'Tổ 2' || to.includes('2')) kp = '18';
        else if (to === 'Tổ 3' || to.includes('3')) kp = '19';
        else kp = r.khuPho ? String(r.khuPho).trim() : '';

        if (kp === '17' || kp.includes('17')) map[key].kp17++;
        else if (kp === '18' || kp.includes('18')) map[key].kp18++;
        else if (kp === '19' || kp.includes('19')) map[key].kp19++;

        map[key].totalChuyen++;

        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          map[key].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          map[key].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('4.') || st.includes('Trả') || st.includes('chuyển sửa')) {
          map[key].traSua++;
        }

        map[key].filteredTotal++;
      });

      let list = Object.values(map);

      list = list.filter(item => item.totalChuyen > 0);

      list.sort((a, b) => {
        if (periodType === 'date') {
          const dA = parseDate(a.timeKey);
          const dB = parseDate(b.timeKey);
          if (dA && dB && dB.valueOf() !== dA.valueOf()) return dB - dA;
        }
        const timeCompare = b.timeKey.localeCompare(a.timeKey, 'vi');
        if (timeCompare !== 0) return timeCompare;
        if (b.totalChuyen !== a.totalChuyen) return b.totalChuyen - a.totalChuyen;
        return a.cbtl.localeCompare(b.cbtl, 'vi');
      });

      return list;
    }
  };

  window.Analytics = Analytics;
})(window);
