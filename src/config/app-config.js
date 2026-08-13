export const APP_VERSION = '0.4.5';
export const APP_NAME = 'Field Visit Intelligence';
export const DB_NAME = 'fvi_v030';
export const DB_VERSION = 2;

export const FEATURE_FLAGS = {
  adminAutoRefresh: true,
  adminAutoRefreshSeconds: 60,
  backgroundPullSeconds: 60,
  localJsonBackup: true,
  taxonomyDiscovery: true,
  recoveryTracking: true,
  richReasonEvidence: true,
  pureWhatsappEc: true,
  photoEvidence: true,
  adminIntelligence: true,
  aiAnalysis: false
};

// Observed/actual taxonomy is intentionally separate from the exact E-Work/SFA options.
// The SFA labels below match the wording shown in the production SFA screen supplied by the Product Owner.
export const DEFAULT_REASONS = [
  { code:'pic', id:'PIC Tidak Tersedia', en:'PIC Availability', type:'observed', sort:10 },
  { code:'stock', id:'Stok Masih Tersedia', en:'Stock Still Available', type:'observed', sort:20 },
  { code:'financial', id:'Kendala Keuangan / Cash', en:'Financial / Cash', type:'observed', sort:30 },
  { code:'closed', id:'Toko Tutup', en:'Store Closed', type:'observed', sort:40 },
  { code:'price', id:'Harga', en:'Price', type:'observed', sort:50 },
  { code:'refusal', id:'Belum Butuh / Menolak', en:'No Need / Refusal', type:'observed', sort:60 },
  { code:'competitor', id:'Kompetitor', en:'Competitor', type:'observed', sort:70 },
  { code:'product', id:'Kendala Produk', en:'Product Issue', type:'observed', sort:80 },
  { code:'other', id:'Lainnya', en:'Other', type:'observed', sort:90 },
  { code:'unclear', id:'Tidak Jelas', en:'Unclear', type:'observed', sort:100 },

  { code:'sfa_owner_absent', id:'Pemilik tidak ada ditempat', en:'Owner not present', type:'sfa', sort:210 },
  { code:'sfa_call_later', id:'Nanti ditelpon saja', en:'Call later', type:'sfa', sort:220 },
  { code:'sfa_stock_available', id:'Barang masih ada', en:'Stock still available', type:'sfa', sort:230 },
  { code:'sfa_no_cash', id:'Toko tidak ada uang', en:'Store has no cash', type:'sfa', sort:240 },
  { code:'sfa_store_closed', id:'Toko Tutup', en:'Store closed', type:'sfa', sort:250 },
  { code:'sfa_other_supplier', id:'Ambil dari supplier lain', en:'Buy from another supplier', type:'sfa', sort:260 },
  { code:'sfa_other', id:'Lainnya', en:'Other', type:'sfa', sort:270 }
];

export const EXACT_SFA_CODES = new Set([
  'sfa_owner_absent','sfa_call_later','sfa_stock_available','sfa_no_cash',
  'sfa_store_closed','sfa_other_supplier','sfa_other'
]);

// Only causal one-to-one SFA options participate in reason accuracy.
// "Nanti ditelpon saja" is a disposition/follow-up option, while "Lainnya" is a taxonomy-gap channel.
export const SFA_TO_OBSERVED_REASON = {
  sfa_owner_absent:'pic',
  sfa_stock_available:'stock',
  sfa_no_cash:'financial',
  sfa_store_closed:'closed'
};

// Safe legacy reconstruction is deliberately conservative. PIC, Other, Unclear,
// Price, Refusal, Product and Competitor are not auto-mapped because the exact SFA choice
// cannot be recovered reliably from the old app category alone.
export const SAFE_LEGACY_SFA_MAP = {
  stock:'sfa_stock_available',
  financial:'sfa_no_cash',
  closed:'sfa_store_closed'
};

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
    outlet:'Nama Toko', outletId:'Kode Toko', route:'Route', result:'Hasil', omzet:'Omzet EC (Rp)',
    observedReason:'Alasan Non-EC Aktual', customReason:'Sebutkan alasan riil', factor:'Faktor Pendukung', evidence:'Bukti / Kondisi yang Diamati',
    sfaReason:'Reason Non-EC di SFA / E-Work', revisit:'Rencana Kunjungan Ulang', earlier:'Bisa Dikunjungi Lebih Cepat?', timing:'Alasan Menentukan Waktu Follow-up',
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
    outlet:'Store Name', outletId:'Store Code', route:'Route', result:'Result', omzet:'EC Revenue (IDR)',
    observedReason:'Actual Non-EC Reason', customReason:'Specify actual reason', factor:'Contributing Factor', evidence:'Evidence / Observed Condition',
    sfaReason:'SFA / E-Work Non-EC Reason', revisit:'Planned Revisit', earlier:'Can Revisit Earlier?', timing:'Reason Determining Follow-up Timing',
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
