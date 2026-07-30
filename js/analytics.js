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

  const Analytics = {
    // 1. Section I: Tiến độ Pháp lý Chi tiết theo Từng Phân Khu
    getLegalProgressByKhuPho(records) {
      const result = {
        'KP 17': { total: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'KP 18': { total: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'KP 19': { total: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 },
        'TỔNG CỘNG': { total: 0, thongQua: 0, kthtGiu: 0, traSua: 0, chuyenSuaLai: 0 }
      };

      records.forEach(r => {
        const kp = r.khuPho ? `KP ${r.khuPho}` : null;
        if (!kp || !result[kp]) return;

        result[kp].total++;
        result['TỔNG CỘNG'].total++;

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

    // Section VIII: Thống kê chi tiết số lượng hồ sơ theo Cán bộ BBT (CBTL)
    getOfficerDetailedStats(records) {
      const map = {};
      records.forEach(r => {
        const cb = r.canBoBBT && r.canBoBBT.trim() ? r.canBoBBT.trim() : 'Khác / Chưa xếp';
        const kp = r.khuPho ? String(r.khuPho).trim() : '';

        if (!map[cb]) {
          map[cb] = {
            name: cb,
            kp17: 0,
            kp18: 0,
            kp19: 0,
            totalChuyen: 0,
            thongQua: 0,
            kthtGiu: 0,
            traSua: 0
          };
        }

        if (kp === '17') map[cb].kp17++;
        else if (kp === '18') map[cb].kp18++;
        else if (kp === '19') map[cb].kp19++;

        map[cb].totalChuyen++;

        const st = r.trangThai || '';
        if (st.includes('3.') || st.includes('thông qua')) {
          map[cb].thongQua++;
        } else if (st.includes('1.') || st.includes('Đã chuyển')) {
          map[cb].kthtGiu++;
        } else if (st.includes('2.1') || st.includes('Trả về')) {
          map[cb].traSua++;
        }
      });

      const list = Object.values(map);
      list.sort((a, b) => b.totalChuyen - a.totalChuyen || a.name.localeCompare(b.name, 'vi'));
      return list;
    }
  };

  window.Analytics = Analytics;
})(window);
