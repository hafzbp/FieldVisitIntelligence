export const REASON_DETAIL_OPTIONS = {
  recoverable_today:[['YES','Ya, masih mungkin order hari ini'],['NO','Tidak, sudah tidak ada chance hari ini'],['UNKNOWN','Belum tahu']],
  preferred_recovery_channel:[['WA','WhatsApp'],['PHONE','Telepon'],['REVISIT','Revisit'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu'],['NONE','Tidak ada follow-up']],
  pic_status:[['TEMPORARY','PIC sementara tidak tersedia'],['REMOTE_ORDERABLE','PIC tidak ada, tapi bisa order remote'],['UNREACHABLE','PIC tidak ada & belum bisa dihubungi'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu']],
  closed_status:[['OPEN_LATER_TODAY','Buka lebih siang hari ini'],['REMOTE_ORDERABLE','Tutup, tapi masih bisa order remote'],['EVENT_CLOSURE','Tutup karena event/kondisi khusus'],['CLOSED_ALL_DAY','Tutup seharian'],['PERMANENT','Tutup permanen/indikasi outlet mati'],['UNKNOWN','Belum tahu']],
  financial_status:[['TEMPORARY','Cash issue sementara'],['STRUCTURAL','Masalah kemampuan bisnis/struktural'],['UNKNOWN','Belum tahu']],
  partial_order_possible:[['YES','Ya'],['NO','Tidak'],['UNKNOWN','Belum tahu']],
  refusal_driver:[['STOCK_CYCLE','Belum masuk siklus order'],['PRICE','Harga'],['PRODUCT','Produk/SKU'],['SPACE','Space/display'],['LOW_DEMAND','Demand rendah'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu']],
  external_supplier_driver:[['PRICE','Harga'],['TOP','TOP/term pembayaran'],['AVAILABILITY','Ketersediaan barang'],['MIN_ORDER','Minimum order'],['DELIVERY','Delivery/kecepatan kirim'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu']],
  price_issue_type:[['RRP_TOO_HIGH','Harga jual dianggap terlalu tinggi'],['MARGIN_LOW','Margin toko terlalu kecil'],['COMPETITOR_CHEAPER','Kompetitor lebih murah'],['PROMO_GAP','Promo/discount kurang kompetitif'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu']],
  product_issue_type:[['QUALITY','Quality/complaint'],['ASSORTMENT','Assortment/SKU tidak sesuai'],['SLOW_MOVING','Slow moving'],['EXPIRED_RISK','Risiko expired'],['PACK_SIZE','Pack size'],['DAMAGED','Barang rusak'],['OTHER','Lainnya'],['UNKNOWN','Belum tahu']],
  salesman_bombing_claim:[['YES','Ya'],['NO','Tidak'],['UNKNOWN','Tidak tahu']]
};

export const REASON_DETAIL_SCHEMA = {
  pic:{
    title:'Detail PIC Tidak Tersedia',
    fields:['pic_status','pic_expected_return','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:false
  },
  closed:{
    title:'Detail Toko Tutup',
    fields:['closed_status','closed_expected_open','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:true,
    photoType:'STOREFRONT'
  },
  stock:{
    title:'Detail Barang Masih Ada (BMA)',
    fields:['normal_buying_cycle','last_order_date','last_delivery_date','salesman_bombing_claim','salesman_bombing_reason','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    stockItems:true,
    photoRecommended:true,
    photoType:'STOCK'
  },
  financial:{
    title:'Detail Financial',
    fields:['financial_status','cash_available_when','partial_order_possible','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:false
  },
  refusal:{
    title:'Detail Belum Butuh / Menolak',
    fields:['refusal_driver','normal_buying_cycle','expected_next_order','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:false
  },
  competitor:{
    title:'Detail Supplier / Grosir Lain',
    fields:['external_supplier_name','external_supplier_driver','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:false
  },
  other:{
    title:'Detail Alasan Lainnya',
    fields:['recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],
    photoRecommended:true,
    photoType:'OTHER'
  },
  price:{title:'Detail Harga',fields:['price_issue_type','price_detail','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],photoRecommended:false},
  product:{title:'Detail Kendala Produk',fields:['product_issue_type','affected_products','recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],photoRecommended:true,photoType:'OTHER'},
  unclear:{title:'Detail Tidak Jelas',fields:['recoverable_today','preferred_recovery_channel','best_followup_time','detail_notes'],photoRecommended:false}
};

export const FIELD_META = {
  recoverable_today:{label:'Masih bisa order hari ini?',type:'select'},
  preferred_recovery_channel:{label:'Recovery paling mungkin lewat',type:'select'},
  best_followup_time:{label:'Waktu terbaik follow-up',type:'text',placeholder:'Contoh: jam 13:00 / sore / setelah PIC kembali'},
  pic_status:{label:'Kondisi PIC',type:'select'},
  pic_expected_return:{label:'Estimasi PIC kembali',type:'text',placeholder:'Contoh: sekitar jam 14:00'},
  closed_status:{label:'Jenis toko tutup',type:'select'},
  closed_expected_open:{label:'Estimasi buka',type:'text',placeholder:'Contoh: buka jam 10:00 / besok'},
  financial_status:{label:'Jenis kendala cash',type:'select'},
  cash_available_when:{label:'Kapan kemungkinan ada cash?',type:'text'},
  partial_order_possible:{label:'Masih mungkin order sebagian?',type:'select'},
  refusal_driver:{label:'Penyebab utama belum butuh/menolak',type:'select'},
  expected_next_order:{label:'Perkiraan order berikutnya',type:'text',placeholder:'Contoh: Sabtu / minggu depan / awal bulan'},
  external_supplier_name:{label:'Supplier / grosir yang dipakai',type:'text'},
  price_issue_type:{label:'Masalah harga yang terjadi',type:'select'},
  price_detail:{label:'Detail harga / margin / promo',type:'text',placeholder:'Contoh: margin kecil / harga kompetitor / promo'},
  product_issue_type:{label:'Jenis kendala produk',type:'select'},
  affected_products:{label:'Produk/SKU yang terdampak',type:'text',placeholder:'Sebutkan produk/SKU jika diketahui'},
  external_supplier_driver:{label:'Kenapa ambil dari luar?',type:'select'},
  normal_buying_cycle:{label:'Normal buying cycle',type:'text',placeholder:'Contoh: 7 hari / 2 minggu / bulanan / irregular'},
  last_order_date:{label:'Tanggal order terakhir (jika diketahui)',type:'date'},
  last_delivery_date:{label:'Tanggal delivery terakhir (jika diketahui)',type:'date'},
  salesman_bombing_claim:{label:'Menurut salesman, stok masih ada karena order sebelumnya terlalu besar?',type:'select'},
  salesman_bombing_reason:{label:'Penjelasan salesman soal order sebelumnya',type:'text',placeholder:'Contoh: push IPT / promo / permintaan toko / tidak tahu'},
  detail_notes:{label:'Catatan detail tambahan',type:'textarea'}
};

export function emptyReasonDetail(callId,userId){
  return {call_id:callId,jovis_user_id:userId,recoverable_today:null,preferred_recovery_channel:null,best_followup_time:'',pic_status:null,pic_expected_return:'',closed_status:null,closed_expected_open:'',financial_status:null,cash_available_when:'',partial_order_possible:null,refusal_driver:null,expected_next_order:'',price_issue_type:null,price_detail:'',product_issue_type:null,affected_products:'',external_supplier_name:'',external_supplier_driver:null,normal_buying_cycle:'',last_order_date:null,last_delivery_date:null,salesman_bombing_claim:null,salesman_bombing_reason:'',detail_notes:'',source_version:'0.4.0'};
}

export function reasonDetailSchema(code){return REASON_DETAIL_SCHEMA[code]||REASON_DETAIL_SCHEMA.unclear}
export function optionRows(field){return REASON_DETAIL_OPTIONS[field]||[]}
