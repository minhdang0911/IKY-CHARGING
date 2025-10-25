// utils/buildRevenueWorkbookPro.js
import * as XLSX from 'xlsx';

// ===== Helpers =====
function parseMYLoose(s=''){
  const map={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const t=String(s).trim();
  let m,y;
  let mm=t.match(/^(\d{1,2})[-/](\d{2,4})$/);
  if(mm){m=+mm[1];y=+mm[2];return{m,y:y<100?2000+y:y}}
  mm=t.match(/^([A-Za-z]{3})[-/](\d{2})$/);
  if(mm){m=map[mm[1].toLowerCase()]||1;y=2000+(+mm[2]);return{m,y}}
  mm=t.match(/^(\d{4})[-/](\d{1,2})$/);
  if(mm)return{y:+mm[1],m:+mm[2]};
  return{m:1,y:1970}
}
function fmtMYvi({m,y}) {
  const mm=m<10?`0${m}`:String(m);
  return `${mm}/${y}`;
}

// ===== Main builder =====
export function buildRevenueWorkbookPro({
  revenueData = [],
  maxMin = null,
  compareA = null,
  compareB = null,
  m1 = '',
  m2 = '',
  agentInfo = {},
  companyName = 'IKY Charging',
}) {
  const totalRevenue = revenueData.reduce((acc, r) => acc + Number(r.revenue || 0), 0);
  const monthCount = revenueData.length;
  const avgRevenue = monthCount ? Math.round(totalRevenue / monthCount) : 0;

  const now = new Date();
  const exportedAt = now.toLocaleString('vi-VN');

  const highMonth = maxMin?.max?.month || '—';
  const highValue = maxMin?.max?.revenue || 0;
  const lowMonth  = maxMin?.min?.month || '—';
  const lowValue  = maxMin?.min?.revenue || 0;

  // ==== Sheet 1: Tổng quan ====
  const wsOverview = XLSX.utils.aoa_to_sheet([
    ['BÁO CÁO DOANH THU TỔNG HỢP'],
    [companyName],
    [''],
    ['Thời điểm xuất báo cáo', exportedAt],
    // ['Đơn vị / Đại lý', agentInfo?.name || '—'],
    // ['Email', agentInfo?.email || '—'],
    ['Số tháng có doanh thu', monthCount],
    ['Tổng doanh thu (VND)', totalRevenue],
    ['Doanh thu TB / tháng (VND)', avgRevenue],
    ['Tháng cao nhất', `${highMonth} (${highValue.toLocaleString('vi-VN')}đ)`],
    ['Tháng thấp nhất', `${lowMonth} (${lowValue.toLocaleString('vi-VN')}đ)`],
    [''],
    ['Ghi chú', 'Báo cáo tự động từ IKY Charging – Phục vụ đối soát và phân tích vận hành.'],
  ]);
  wsOverview['!cols'] = [{ wch: 30 }, { wch: 50 }];
  wsOverview['!merges'] = [
    { s: {r:0,c:0}, e: {r:0,c:1} },
    { s: {r:1,c:0}, e: {r:1,c:1} },
  ];

  // ==== Sheet 2: Theo tháng ====
  const sortedRows = [...revenueData].sort((a,b)=>{
    const pa=parseMYLoose(a.month); const pb=parseMYLoose(b.month);
    if(pa.y!==pb.y) return pa.y-pb.y;
    return pa.m-pb.m;
  });

  const detailRows = sortedRows.map((r,idx)=>({
    'STT': idx+1,
    'Tháng': r.month,
    'Doanh thu (VND)': Number(r.revenue||0),
    'Ghi chú': r.month===highMonth ? 'Cao nhất' : r.month===lowMonth ? 'Thấp nhất' : ''
  }));
  detailRows.push({});
  detailRows.push({
    'STT': '',
    'Tháng': 'Tổng cộng',
    'Doanh thu (VND)': totalRevenue,
    'Ghi chú': ''
  });
  detailRows.push({
    'STT': '',
    'Tháng': 'Trung bình / tháng',
    'Doanh thu (VND)': avgRevenue,
    'Ghi chú': ''
  });

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [{ wch:6 },{ wch:14 },{ wch:20 },{ wch:14 }];

  // ==== Sheet 3: So sánh 2 tháng (nếu có) ====
  let wsCompare = null;
  if (compareA && compareB && m1 && m2) {
    const aVal = Number(compareA.revenue || 0);
    const bVal = Number(compareB.revenue || 0);
    const diff = bVal - aVal;
    const pct = aVal ? Math.round((diff / aVal) * 100) : 0;

    const status = diff > 0 ? 'Tăng' : diff < 0 ? 'Giảm' : 'Không đổi';
    const color = diff > 0 ? '' : diff < 0 ? '' : '';

    const compareAOA = [
      ['SO SÁNH DOANH THU 2 THÁNG'],
      ['Thời điểm xuất', exportedAt],
      ['Đại lý', agentInfo?.name || '—'],
      [''],
      ['Tháng A', m1],
      ['Doanh thu A (VND)', aVal],
      ['Tháng B', m2],
      ['Doanh thu B (VND)', bVal],
      ['Chênh lệch (VND)', diff],
      ['Tỉ lệ (%)', pct + '%'],
      ['Kết luận', `${status} (${color})`],
    ];

    wsCompare = XLSX.utils.aoa_to_sheet(compareAOA);
    wsCompare['!cols'] = [{ wch: 26 }, { wch: 30 }];
    wsCompare['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:1} }];
  }

  // ==== Build workbook ====
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_quan_doanh_thu');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Toan_bo_doanh_thu');
  if (wsCompare) XLSX.utils.book_append_sheet(wb, wsCompare, 'So_sanh_2_thang');

  return wb;
}
