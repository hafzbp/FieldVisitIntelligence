export const APP_VERSION = '0.3.2';
export const APP_NAME = 'Field Visit Intelligence';
export const DB_NAME = 'fvi_v030';
export const DB_VERSION = 1;

export const FEATURE_FLAGS = {
  adminAutoRefresh: true,
  adminAutoRefreshSeconds: 60,
  localJsonBackup: true,
  taxonomyDiscovery: true,
  recoveryTracking: false,
  aiAnalysis: false
};

export const DEFAULT_REASONS = [
  { code:'pic', id:'PIC Tidak Tersedia', en:'PIC Availability', type:'both' },
  { code:'stock', id:'Stok Masih Tersedia', en:'Stock Still Available', type:'both' },
  { code:'financial', id:'Kendala Keuangan / Cash', en:'Financial / Cash', type:'both' },
  { code:'closed', id:'Toko Tutup', en:'Store Closed', type:'both' },
  { code:'price', id:'Harga', en:'Price', type:'both' },
  { code:'refusal', id:'Belum Butuh / Menolak', en:'No Need / Refusal', type:'both' },
  { code:'competitor', id:'Kompetitor', en:'Competitor', type:'both' },
  { code:'product', id:'Kendala Produk', en:'Product Issue', type:'both' },
  { code:'other', id:'Lainnya', en:'Other', type:'both' },
  { code:'unclear', id:'Tidak Jelas', en:'Unclear', type:'both' }
];

export const FOLLOWUP_OPTIONS = [
  ['D1','D+1'],['D2','D+2'],['D3','D+3'],['WEEK','Dalam 1 Minggu'],
  ['NEXT_JKS','JKS Berikutnya'],['WA_PHONE','WA / Telepon'],['NONE','Tidak Ada Follow-up'],['UNKNOWN','Tidak Tahu']
];

export const I18N = {
  id: {
    login:'Masuk', email:'Email', password:'Password', logout:'Keluar',
    connectRequired:'Supabase belum terhubung', connectHelp:'Isi Project URL dan Publishable Key di src/config/supabase-config.js, lalu deploy ulang.',
    startVisit:'Mulai Field Visit', resume:'Lanjutkan Visit', home:'Home', field:'Field', analysis:'Analisis', admin:'Admin', settings:'Pengaturan',
    depot:'Area / Depot', salesman:'Salesman', salesmanId:'Salesman ID', notes:'Catatan', date:'Tanggal',
    outlet:'Outlet', outletId:'Outlet ID', route:'Route', result:'Hasil', omzet:'Omzet EC (Rp)',
    observedReason:'Alasan Non-EC Aktual', customReason:'Sebutkan alasan riil', factor:'Faktor Pendukung', evidence:'Bukti / Kondisi yang Diamati',
    sfaReason:'Reason Non-EC di SFA', revisit:'Rencana Kunjungan Ulang', earlier:'Bisa Dikunjungi Lebih Cepat?', timing:'Alasan Menentukan Waktu Follow-up',
    saveNext:'Simpan & Call Berikutnya', endVisit:'Selesaikan Field Visit', edit:'Edit', delete:'Hapus', synced:'Tersinkron', pending:'menunggu sinkronisasi', offline:'Offline', syncing:'Sinkronisasi', syncError:'Sync Error',
    adminOverview:'Admin Command Center', refresh:'Refresh Data', allVisits:'Semua Visit', myVisits:'Visit Saya',
    sc:'SC', ec:'EC', nonEc:'Non-EC', ecsc:'EC/SC', revenue:'Total Omzet', mismatch:'Mismatch', match:'Match', partial:'Partial', unclear:'Unclear',
    taxonomyDiscovery:'Reason Taxonomy Discovery', unmapped:'Alasan Riil Baru / Belum Dipetakan', exportDetail:'Export Detail untuk Analisis',
    noData:'Belum ada data.', roleAdmin:'ADMIN', roleJovis:'JOVIS', completed:'Selesai', active:'Aktif',
    requiredOmzet:'Omzet wajib diisi untuk EC.', oneActive:'Satu akun hanya boleh memiliki satu visit aktif.',
    customOtherRequired:'Kalau pilih Lainnya, alasan riil wajib ditulis.',
    editCompleted:'Visit yang sudah selesai tetap bisa diedit; perubahan tersimpan dengan audit trail di Supabase.'
  },
  en: {
    login:'Sign In', email:'Email', password:'Password', logout:'Sign Out',
    connectRequired:'Supabase is not connected', connectHelp:'Fill the Project URL and Publishable Key in src/config/supabase-config.js, then redeploy.',
    startVisit:'Start Field Visit', resume:'Resume Visit', home:'Home', field:'Field', analysis:'Analysis', admin:'Admin', settings:'Settings',
    depot:'Area / Depot', salesman:'Salesman', salesmanId:'Salesman ID', notes:'Notes', date:'Date',
    outlet:'Outlet', outletId:'Outlet ID', route:'Route', result:'Result', omzet:'EC Revenue (IDR)',
    observedReason:'Actual Non-EC Reason', customReason:'Specify actual reason', factor:'Contributing Factor', evidence:'Evidence / Observed Condition',
    sfaReason:'SFA Non-EC Reason', revisit:'Planned Revisit', earlier:'Can Revisit Earlier?', timing:'Reason Determining Follow-up Timing',
    saveNext:'Save & Next Call', endVisit:'End Field Visit', edit:'Edit', delete:'Delete', synced:'Synced', pending:'pending sync', offline:'Offline', syncing:'Syncing', syncError:'Sync Error',
    adminOverview:'Admin Command Center', refresh:'Refresh Data', allVisits:'All Visits', myVisits:'My Visits',
    sc:'SC', ec:'EC', nonEc:'Non-EC', ecsc:'EC/SC', revenue:'Total Revenue', mismatch:'Mismatch', match:'Match', partial:'Partial', unclear:'Unclear',
    taxonomyDiscovery:'Reason Taxonomy Discovery', unmapped:'New / Unmapped Actual Reasons', exportDetail:'Export Detailed Analysis',
    noData:'No data yet.', roleAdmin:'ADMIN', roleJovis:'JOVIS', completed:'Completed', active:'Active',
    requiredOmzet:'Revenue is mandatory for EC.', oneActive:'One account may only have one active visit.',
    customOtherRequired:'When Other is selected, the actual reason is required.',
    editCompleted:'Completed visits remain editable; changes are preserved in Supabase audit history.'
  }
};
