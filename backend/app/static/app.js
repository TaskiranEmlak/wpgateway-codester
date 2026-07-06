// WPGateway v2 — Frontend Application
// ===================================

let API_URL = window.location.origin;
if (!API_URL || API_URL.startsWith('file://') || API_URL === 'null') {
  API_URL = 'http://localhost:8000';
}

// ====== APPLICATION STATE ======
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  devices: [],
  campaigns: [],
  qrIntervalId: null,
  activeQrDeviceId: null,
  campaignChart: null,
  refreshIntervalId: null,
};

// ====== TRANSLATIONS ======
const translations = {
  tr: {
    sidebar_dashboard: "Kontrol Paneli",
    sidebar_devices: "Cihazlar",
    sidebar_campaigns: "Kampanyalar",
    sidebar_otp: "OTP Gönderimi",
    sidebar_settings: "Ayarlar",
    credits: "Kredi",
    auth_subtitle: "WhatsApp Toplu Mesaj Yönetim Paneli",
    auth_login: "Giriş Yap",
    auth_register: "Kayıt Ol",
    label_username: "Kullanıcı Adı",
    label_password: "Şifre",
    label_email: "E-posta",
    placeholder_username: "Kullanıcı adınız",
    placeholder_password: "Şifreniz",
    placeholder_password_reg: "Min 6 karakter",
    placeholder_email: "E-posta adresiniz",
    btn_login: "Giriş Yap",
    btn_register: "Kayıt Ol",
    dash_header: "Kontrol Paneli",
    dash_credits: "Toplam Kredi",
    dash_sent: "Gönderilen",
    dash_failed: "Başarısız",
    dash_active_dev: "Aktif Cihaz",
    dash_chart_title: "Kampanya İstatistikleri",
    dash_pool_title: "Bağlı Cihazlar",
    dash_no_dev: "Cihaz bulunamadı. 'Cihazlar' sekmesinden bağlayın.",
    dev_header: "Cihaz Yönetimi",
    dev_add_btn: "+ Yeni Cihaz",
    modal_add_title: "Yeni WhatsApp Bağlantısı",
    modal_label_name: "Bağlantı Adı",
    modal_label_proxy: "Proxy (Opsiyonel)",
    modal_desc_proxy: "Ban riskini azaltmak için her hat için ayrı proxy kullanılması önerilir.",
    btn_cancel: "İptal",
    btn_init: "Bağlantıyı Başlat",
    modal_qr_title: "WhatsApp'ı Bağla",
    modal_qr_desc: "Telefonunuzdan Bağlı Cihazlar → QR Tara",
    qr_desc: "Kod otomatik yenilenir. Ekranı açık tutun.",
    qr_close_btn: "Kapat",
    qr_success_connected: "Bağlandı!",
    camp_header: "Kampanya Yönetimi",
    camp_create_title: "Yeni Kampanya",
    camp_label_name: "Kampanya Adı",
    camp_label_pool: "Gönderici Cihazları",
    camp_no_dev: "Bağlı cihaz yok.",
    camp_label_recipients: "Alıcı Numaraları",
    camp_label_msg: "Mesaj İçeriği",
    camp_desc_msg: "Spintax: {Seçenek1|Seçenek2} — Değişken: {İsim}, {Kod}",
    camp_preview: "Önizleme:",
    camp_label_media: "Medya URL (Opsiyonel)",
    camp_label_media_type: "Medya Türü",
    camp_label_min_delay: "Min Gecikme (sn)",
    camp_label_max_delay: "Max Gecikme (sn)",
    camp_label_schedule: "Zamanlama (Opsiyonel)",
    camp_launch_btn: "Kampanyayı Başlat",
    camp_history_title: "Kampanya Geçmişi",
    camp_no_history: "Henüz kampanya yok.",
    otp_header: "OTP Gönderimi",
    otp_send_title: "OTP Gönder",
    otp_desc: "OTP mesajları kuyruğu atlar, anında gönderilir.",
    otp_label_num: "Telefon Numarası",
    otp_label_msg: "Doğrulama Mesajı",
    otp_btn: "Anında Gönder",
    otp_logs_title: "Son OTP Kayıtları",
    otp_table_rec: "Alıcı",
    otp_table_msg: "Mesaj",
    otp_table_status: "Durum",
    otp_no_logs: "OTP kaydı yok.",
    settings_header: "Ayarlar & API",
    settings_auth_title: "API Anahtarı",
    settings_label_key: "REST API Key (X-API-Key)",
    settings_btn_show: "Göster",
    settings_btn_hide: "Gizle",
    settings_webhook_title: "Webhook URL",
    settings_webhook_desc: "Durum güncellemeleri bu URL'ye POST edilir.",
    settings_webhook_label: "Webhook URL",
    settings_webhook_btn: "Kaydet",
    settings_billing_title: "Kredi Yükleme (Simülasyon)",
    settings_billing_desc: "Her mesaj 1 kredi düşer.",
    settings_billing_label: "Miktar",
    settings_billing_btn: "Yükle",
    settings_api_docs_title: "OTP API Örneği:",
    resp_modal_title: "Otomatik Yanıtlayıcılar",
    resp_label_keyword: "Tetikleyici Kelime",
    resp_label_reply: "Yanıt Mesajı",
    resp_label_wildcard: "Kısmi eşleşme (kelimeyi içerirse)",
    resp_btn_add: "Kural Ekle",
    resp_header_active: "Aktif Kurallar",
    resp_no_rules: "Henüz kural eklenmedi.",
    resp_placeholder_keyword: "örn: fiyat",
    resp_placeholder_reply: "Otomatik yanıt...",
    btn_close: "Kapat",
    drop_click: "Dosya seçin",
    drop_or_drag: "veya sürükleyip bırakın",
    dev_phone: "Tel:",
    dev_not_connected: "Bağlı değil",
    dev_proxy: "Proxy:",
    dev_direct: "Doğrudan",
    dev_ai_agent: "Yapay Zeka:",
    dev_active: "Aktif ✅",
    dev_disabled: "Kapalı",
    dev_enable_ai: "Yapay Zeka Yanıtı",
    dev_ai_instructions: "Yapay zeka talimatları...",
    dev_btn_save_prompt: "Kaydet",
    dev_btn_scan_qr: "QR Tara",
    dev_btn_disconnect: "Kes",
    dev_btn_auto_replies: "Oto Yanıt",
    dev_no_devices: "Henüz cihaz eklenmedi. '+ Yeni Cihaz' ile başlayın.",
    dev_loading: "Cihazlar yükleniyor...",
    camp_progress: "İlerleme:",
    camp_stats_msg: "Başarılı: <strong>{sent}</strong> / Hatalı: <strong>{failed}</strong> (Toplam: {total})",
    camp_btn_pause: "Duraklat",
    camp_btn_resume: "Devam",
    status_connected: "Bağlı",
    status_connecting: "Bağlanıyor",
    status_banned: "Engelli",
    status_disconnected: "Bağlı Değil",
    status_queued: "Kuyrukta",
    status_processing: "Gönderiliyor",
    status_completed: "Tamamlandı",
    status_paused: "Duraklatıldı",
    status_failed: "Başarısız",
    status_sent: "Gönderildi",
    status_delivered: "İletildi",
    status_read: "Okundu",
    status_pending: "Bekliyor",
    chart_label_sent: "Başarılı",
    chart_label_failed: "Başarısız",
    confirm_disconnect: "Bu oturumu kapatmak istediğinize emin misiniz?",
    confirm_delete_device: "Bu cihazı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    toast_ai_saved: "Yapay zeka talimatları kaydedildi.",
    toast_register_ok: "Kayıt başarılı! Giriş yapabilirsiniz.",
    toast_login_fail: "Kullanıcı adı veya şifre hatalı.",
    toast_net_error: "Sunucuya bağlanılamadı.",
    toast_campaign_ok: "Kampanya başarıyla başlatıldı!",
    toast_otp_ok: "OTP başarıyla kuyruğa alındı!",
    toast_webhook_ok: "Webhook kaydedildi.",
    toast_credits_ok: "{amount} kredi yüklendi!",
    toast_file_ok: "{count} numara başarıyla yüklendi!",
    toast_file_empty: "Dosyada geçerli numara bulunamadı.",
    toast_select_device: "En az bir bağlı cihaz seçin.",
    toast_device_fail: "Cihaz kaydedilemedi.",
    dash_no_devices_created: "Cihaz yok. 'Cihazlar' sekmesinden bağlayın.",
    resp_rule_keyword: "Kelime:",
    resp_rule_reply: "Yanıt:",
    resp_btn_delete: "Sil",
    modal_ai_gen_title: "Yapay Zeka Metin Yazarı",
    modal_ai_gen_desc: "Yazmak istediğiniz kampanya konusunu kısaca belirtin, Groq AI sizin için profesyonel bir mesaj hazırlasın.",
    modal_label_ai_prompt: "Kampanya Konusu / Detayları",
    btn_generate: "Oluştur",
    modal_qr_tab: "QR Kod",
    modal_pair_tab: "Eşleştirme Kodu",
    modal_pair_desc: "Telefon numaranızı girerek 8 haneli bir bağlantı kodu oluşturun.",
    modal_pair_label_phone: "Telefon Numarası (Ülke koduyla)",
    placeholder_pair_phone: "905551234567",
    modal_pair_btn_generate: "Kod Üret",
    modal_pair_instructions: "Telefondan <strong>Bağlı Cihazlar</strong> → <strong>Cihaz Bağla</strong> kısmına gidin. <br>Ardından <strong>\"Telefon numarası ile bağla\"</strong> seçeneğine tıklayıp bu kodu girin.",
    placeholder_ai_prompt: "örn: Yeni emlak projemiz için Ramazan indirim duyurusu, değişkenleri kullansın.",
    placeholder_camp_name: "Örn: Yaz Kampanyası 2026",
    placeholder_camp_recipients: "905551234567\n447700900077\n...",
    placeholder_camp_msg: "{Selam|Merhaba} {İsim}, bugüne özel fırsat!",
    camp_placeholder_preview_msg: "Mesaj yazın...",
    camp_label_media: "Medya Dosyası (URL veya Yükle)",
    btn_choose_file: "📁 Dosya Seç",
    placeholder_camp_media_url: "https://... veya dosya yükleyin",
    media_type_image: "Görsel",
    media_type_video: "Video",
    media_type_document: "Belge / PDF",
    media_type_audio: "Ses",
    placeholder_otp_recipient: "905551234567",
    placeholder_otp_msg: "Kodunuz: 629851",
    placeholder_webhook: "https://domain.com/webhook",
    credits_amount_500: "500 Kredi",
    credits_amount_2000: "2.000 Kredi",
    credits_amount_10000: "10.000 Kredi",
    btn_write_with_ai: "✨ AI ile Yaz",
  },
  en: {
    sidebar_dashboard: "Dashboard",
    sidebar_devices: "Devices",
    sidebar_campaigns: "Campaigns",
    sidebar_otp: "OTP Dispatch",
    sidebar_settings: "Settings",
    credits: "Credits",
    auth_subtitle: "WhatsApp Bulk Messaging Panel",
    auth_login: "Login",
    auth_register: "Register",
    label_username: "Username",
    label_password: "Password",
    label_email: "Email",
    placeholder_username: "Your username",
    placeholder_password: "Your password",
    placeholder_password_reg: "Min 6 characters",
    placeholder_email: "Your email",
    btn_login: "Log In",
    btn_register: "Register",
    dash_header: "Dashboard",
    dash_credits: "Total Credits",
    dash_sent: "Sent",
    dash_failed: "Failed",
    dash_active_dev: "Active Devices",
    dash_chart_title: "Campaign Statistics",
    dash_pool_title: "Connected Devices",
    dash_no_dev: "No devices found. Connect from 'Devices' tab.",
    dev_header: "Device Management",
    dev_add_btn: "+ New Device",
    modal_add_title: "New WhatsApp Connection",
    modal_label_name: "Connection Name",
    modal_label_proxy: "Proxy (Optional)",
    modal_desc_proxy: "Using separate proxy per line reduces ban risk.",
    btn_cancel: "Cancel",
    btn_init: "Start Connection",
    modal_qr_title: "Link WhatsApp",
    modal_qr_desc: "Open Linked Devices on your phone → Scan QR",
    qr_desc: "Code refreshes automatically. Keep screen active.",
    qr_close_btn: "Close",
    qr_success_connected: "Connected!",
    camp_header: "Campaign Manager",
    camp_create_title: "New Campaign",
    camp_label_name: "Campaign Name",
    camp_label_pool: "Sender Devices",
    camp_no_dev: "No connected devices.",
    camp_label_recipients: "Recipient Numbers",
    camp_label_msg: "Message Content",
    camp_desc_msg: "Spintax: {Option1|Option2} — Variables: {İsim}, {Kod}",
    camp_preview: "Preview:",
    camp_label_media: "Media URL (Optional)",
    camp_label_media_type: "Media Type",
    camp_label_min_delay: "Min Delay (sec)",
    camp_label_max_delay: "Max Delay (sec)",
    camp_label_schedule: "Schedule (Optional)",
    camp_launch_btn: "Launch Campaign",
    camp_history_title: "Campaign History",
    camp_no_history: "No campaigns yet.",
    otp_header: "OTP Dispatch",
    otp_send_title: "Send OTP",
    otp_desc: "OTP messages skip queues and are sent instantly.",
    otp_label_num: "Phone Number",
    otp_label_msg: "Verification Message",
    otp_btn: "Send Instantly",
    otp_logs_title: "Recent OTP Logs",
    otp_table_rec: "Recipient",
    otp_table_msg: "Message",
    otp_table_status: "Status",
    otp_no_logs: "No OTP logs.",
    settings_header: "Settings & API",
    settings_auth_title: "API Key",
    settings_label_key: "REST API Key (X-API-Key)",
    settings_btn_show: "Show",
    settings_btn_hide: "Hide",
    settings_webhook_title: "Webhook URL",
    settings_webhook_desc: "Status updates will be POSTed to this URL.",
    settings_webhook_label: "Webhook URL",
    settings_webhook_btn: "Save",
    settings_billing_title: "Credit Top Up (Simulation)",
    settings_billing_desc: "Each message costs 1 credit.",
    settings_billing_label: "Amount",
    settings_billing_btn: "Top Up",
    settings_api_docs_title: "OTP API Example:",
    resp_modal_title: "Auto Responders",
    resp_label_keyword: "Trigger Keyword",
    resp_label_reply: "Reply Message",
    resp_label_wildcard: "Wildcard match (contains keyword)",
    resp_btn_add: "Add Rule",
    resp_header_active: "Active Rules",
    resp_no_rules: "No rules set yet.",
    resp_placeholder_keyword: "e.g. price",
    resp_placeholder_reply: "Auto reply message...",
    btn_close: "Close",
    drop_click: "Choose file",
    drop_or_drag: "or drag and drop",
    dev_phone: "Phone:",
    dev_not_connected: "Not connected",
    dev_proxy: "Proxy:",
    dev_direct: "Direct",
    dev_ai_agent: "AI Agent:",
    dev_active: "Active ✅",
    dev_disabled: "Off",
    dev_enable_ai: "AI Auto Reply",
    dev_ai_instructions: "AI instructions...",
    dev_btn_save_prompt: "Save",
    dev_btn_scan_qr: "Scan QR",
    dev_btn_disconnect: "Disconnect",
    dev_btn_auto_replies: "Auto Reply",
    dev_no_devices: "No devices added. Click '+ New Device' to start.",
    dev_loading: "Loading devices...",
    camp_progress: "Progress:",
    camp_stats_msg: "Success: <strong>{sent}</strong> / Failed: <strong>{failed}</strong> (Total: {total})",
    camp_btn_pause: "Pause",
    camp_btn_resume: "Resume",
    status_connected: "Connected",
    status_connecting: "Connecting",
    status_banned: "Banned",
    status_disconnected: "Disconnected",
    status_queued: "Queued",
    status_processing: "Processing",
    status_completed: "Completed",
    status_paused: "Paused",
    status_failed: "Failed",
    status_sent: "Sent",
    status_delivered: "Delivered",
    status_read: "Read",
    status_pending: "Pending",
    chart_label_sent: "Sent",
    chart_label_failed: "Failed",
    confirm_disconnect: "Disconnect this WhatsApp session?",
    confirm_delete_device: "Delete this device permanently? This cannot be undone.",
    toast_ai_saved: "AI instructions saved.",
    toast_register_ok: "Registration successful! Please log in.",
    toast_login_fail: "Invalid username or password.",
    toast_net_error: "Cannot connect to server.",
    toast_campaign_ok: "Campaign launched successfully!",
    toast_otp_ok: "OTP message enqueued!",
    toast_webhook_ok: "Webhook saved.",
    toast_credits_ok: "{amount} credits added!",
    toast_file_ok: "{count} numbers imported!",
    toast_file_empty: "No valid numbers found in file.",
    toast_select_device: "Select at least one connected device.",
    toast_device_fail: "Failed to register device.",
    dash_no_devices_created: "No devices. Connect one in Devices tab.",
    resp_rule_keyword: "Keyword:",
    resp_rule_reply: "Reply:",
    resp_btn_delete: "Delete",
    modal_ai_gen_title: "AI Message Writer",
    modal_ai_gen_desc: "Briefly specify the topic of the campaign, and Groq AI will write a professional message for you.",
    modal_label_ai_prompt: "Campaign Topic / Details",
    btn_generate: "Generate",
    modal_qr_tab: "QR Code",
    modal_pair_tab: "Pairing Code",
    modal_pair_desc: "Enter your phone number to generate an 8-digit connection code.",
    modal_pair_label_phone: "Phone Number (With country code)",
    placeholder_pair_phone: "905551234567",
    modal_pair_btn_generate: "Generate Code",
    modal_pair_instructions: "Go to <strong>Linked Devices</strong> → <strong>Link a Device</strong> on your phone. <br>Then select <strong>\"Link with phone number instead\"</strong> and enter this code.",
    placeholder_ai_prompt: "e.g. Ramadan discount announcement for our new real estate project, using variables.",
    placeholder_camp_name: "e.g. Summer Campaign 2026",
    placeholder_camp_recipients: "905551234567\n447700900077\n...",
    placeholder_camp_msg: "{Hi|Hello} {Name}, special offer for today!",
    camp_placeholder_preview_msg: "Write a message...",
    camp_label_media: "Media File (URL or Upload)",
    btn_choose_file: "📁 Choose File",
    placeholder_camp_media_url: "https://... or upload a file",
    media_type_image: "Image",
    media_type_video: "Video",
    media_type_document: "Document / PDF",
    media_type_audio: "Audio",
    placeholder_otp_recipient: "905551234567",
    placeholder_otp_msg: "Your code: 629851",
    placeholder_webhook: "https://domain.com/webhook",
    credits_amount_500: "500 Credits",
    credits_amount_2000: "2,000 Credits",
    credits_amount_10000: "10,000 Credits",
    btn_write_with_ai: "✨ Write with AI",
  }
};

// ====== TRANSLATOR ======
function t(key, vars = {}) {
  const lang = localStorage.getItem('lang') || 'en';
  let text = (translations[lang] && translations[lang][key]) || (translations['en'] && translations['en'][key]) || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function toggleLanguage() {
  const curr = localStorage.getItem('lang') || 'en';
  const next = curr === 'tr' ? 'en' : 'tr';
  localStorage.setItem('lang', next);
  updatePageLanguage();
  if (state.token) { refreshActiveTab(); fetchUserData(); }
}

function updatePageLanguage() {
  const lang = localStorage.getItem('lang') || 'en';
  const btn = document.getElementById('btn-lang-toggle');
  if (btn) btn.textContent = lang === 'tr' ? 'EN' : 'TR';
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = translations[lang] && translations[lang][key];
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const val = translations[lang] && translations[lang][key];
    if (val) el.placeholder = val;
  });
}

// ====== TOAST NOTIFICATION SYSTEM ======
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ====== STARTUP ======
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupDragDrop();
  updatePageLanguage();
  if (state.token) {
    showDashboard();
  } else {
    showAuthOverlay();
  }
});

// ====== AUTH & NAV ======
function showAuthOverlay() {
  document.getElementById('auth-modal').classList.add('active');
}

function hideAuthOverlay() {
  document.getElementById('auth-modal').classList.remove('active');
}

function showDashboard() {
  hideAuthOverlay();
  fetchUserData();
  fetchDashboardOverview();

  if (state.refreshIntervalId) clearInterval(state.refreshIntervalId);
  state.refreshIntervalId = setInterval(() => {
    if (state.token) { fetchUserData(); refreshActiveTab(); }
  }, 12000);
}

function refreshActiveTab() {
  const active = document.querySelector('.nav-item.active');
  if (!active) return;
  const tab = active.dataset.tab;
  if (tab === 'dashboard') fetchDashboardOverview();
  else if (tab === 'devices') fetchDevices();
  else if (tab === 'campaigns') fetchCampaigns();
  else if (tab === 'otp') fetchOtpLogs();
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tabName));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));

  if (tabName === 'dashboard') fetchDashboardOverview();
  else if (tabName === 'devices') fetchDevices();
  else if (tabName === 'campaigns') { fetchCampaigns(); populateCampaignDevicePool(); }
  else if (tabName === 'otp') fetchOtpLogs();
  else if (tabName === 'settings') populateSettingsPage();
}

function getHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` };
}

// ====== USER DATA ======
async function fetchUserData() {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, { headers: getHeaders() });
    if (res.status === 401) { handleLogout(); return; }
    const data = await res.json();
    state.user = data;
    document.getElementById('user-display-name').textContent = data.username;
    document.getElementById('user-display-credits').textContent = data.credits.toLocaleString();
    document.getElementById('stat-credits').textContent = data.credits.toLocaleString();
  } catch (err) {
    console.error('User data error:', err);
  }
}

// ====== DASHBOARD ======
async function fetchDashboardOverview() {
  try {
    const devRes = await fetch(`${API_URL}/api/v1/devices`, { headers: getHeaders() });
    const devices = await devRes.json();
    state.devices = devices;
    document.getElementById('stat-devices').textContent = devices.filter(d => d.status === 'connected').length;

    const miniList = document.getElementById('mini-devices-list');
    if (devices.length === 0) {
      miniList.innerHTML = `<div class="no-data">${t('dash_no_devices_created')}</div>`;
    } else {
      miniList.innerHTML = devices.map(d => `
        <div class="mini-device-item">
          <span><strong>${escapeHtml(d.name)}</strong> (${d.phone_number || t('dev_not_connected')})</span>
          <span class="status-indicator">
            <span class="status-dot dot-${getDotColor(d.status)}"></span>
            ${t('status_' + d.status)}
          </span>
        </div>
      `).join('');
    }

    const campRes = await fetch(`${API_URL}/api/v1/campaigns`, { headers: getHeaders() });
    const campaigns = await campRes.json();
    state.campaigns = campaigns;

    let totalSent = 0, totalFailed = 0;
    campaigns.forEach(c => { totalSent += c.sent_messages; totalFailed += c.failed_messages; });
    document.getElementById('stat-sent').textContent = totalSent.toLocaleString();
    document.getElementById('stat-failed').textContent = totalFailed.toLocaleString();

    renderCampaignChart(campaigns);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderCampaignChart(campaigns) {
  const canvas = document.getElementById('campaignChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (state.campaignChart) state.campaignChart.destroy();

  const last = [...campaigns].reverse().slice(-7);
  const labels = last.map(c => c.name.length > 10 ? c.name.slice(0, 10) + '..' : c.name);

  state.campaignChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: t('chart_label_sent'),
          data: last.map(c => c.sent_messages),
          backgroundColor: 'rgba(0, 168, 132, 0.5)',
          borderColor: '#00a884',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: t('chart_label_failed'),
          data: last.map(c => c.failed_messages),
          backgroundColor: 'rgba(234, 67, 53, 0.5)',
          borderColor: '#ea4335',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8696a0', font: { family: 'Inter' } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8696a0', font: { family: 'Inter' } }, beginAtZero: true }
      },
      plugins: {
        legend: { labels: { color: '#e9edef', font: { family: 'Inter', size: 11 } } }
      }
    }
  });
}

// ====== DEVICES ======
async function fetchDevices() {
  try {
    const res = await fetch(`${API_URL}/api/v1/devices`, { headers: getHeaders() });
    const devices = await res.json();
    state.devices = devices;
    renderDevicesGrid(devices);
  } catch (err) {
    console.error('Devices error:', err);
  }
}

function renderDevicesGrid(devices) {
  const container = document.getElementById('devices-list');
  if (devices.length === 0) {
    container.innerHTML = `<div class="no-data">${t('dev_no_devices')}</div>`;
    return;
  }

  container.innerHTML = devices.map(device => {
    const sc = device.status === 'connected' ? 'connected' :
               device.status === 'connecting' ? 'connecting' :
               device.status === 'banned' ? 'banned' : 'disconnected';
    return `
      <div class="device-card">
        <div class="device-header">
          <div class="device-title">${escapeHtml(device.name)}</div>
          <span class="badge badge-${sc}">${t('status_' + device.status)}</span>
        </div>
        <div class="device-info-row"><strong>${t('dev_phone')}</strong> <span>${device.phone_number || t('dev_not_connected')}</span></div>
        <div class="device-info-row"><strong>${t('dev_proxy')}</strong> <span>${escapeHtml(device.proxy_url) || t('dev_direct')}</span></div>
        <div class="device-info-row"><strong>${t('dev_ai_agent')}</strong> <span>${device.ai_enabled ? t('dev_active') : t('dev_disabled')}</span></div>

        <div class="device-ai-controls">
          <div class="checkbox-group" style="margin-bottom:6px;">
            <input type="checkbox" id="ai-chk-${device.id}" ${device.ai_enabled ? 'checked' : ''} onchange="toggleDeviceAi('${device.id}', this.checked)">
            <label for="ai-chk-${device.id}" style="font-size:0.75rem;">${t('dev_enable_ai')}</label>
          </div>
          <div id="ai-prompt-area-${device.id}" style="display:${device.ai_enabled ? 'block' : 'none'};">
            <textarea id="ai-prompt-${device.id}" rows="2" placeholder="${t('dev_ai_instructions')}">${escapeHtml(device.ai_prompt || '')}</textarea>
            <button class="btn btn-secondary btn-sm" style="margin-top:4px;" onclick="saveDevicePrompt('${device.id}')">${t('dev_btn_save_prompt')}</button>
          </div>
        </div>

        <div class="device-actions">
          ${device.status !== 'connected' ?
            `<button class="btn btn-primary" onclick="startDeviceSession('${device.id}')">${t('dev_btn_scan_qr')}</button>` :
            `<button class="btn btn-secondary" onclick="stopDeviceSession('${device.id}')">${t('dev_btn_disconnect')}</button>`
          }
          <button class="btn btn-secondary" onclick="openAutoResponderModal('${device.id}')">${t('dev_btn_auto_replies')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.id}')">
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function startDeviceSession(deviceId) {
  showModal('modal-qr');
  const qrImg = document.getElementById('qr-img');
  const spinner = document.getElementById('qr-spinner');
  const box = document.getElementById('qr-box');
  qrImg.style.display = 'none';
  spinner.style.display = 'block';
  box.classList.remove('has-qr');
  document.getElementById('qr-connected-status').classList.remove('active');
  state.activeQrDeviceId = deviceId;

  // Reset pairing code state
  switchLinkMode('qr');
  const phoneInput = document.getElementById('link-pair-phone');
  if (phoneInput) phoneInput.value = '';
  const pairingDisplay = document.getElementById('pairing-code-display');
  if (pairingDisplay) pairingDisplay.style.display = 'none';
  const pairCodeText = document.getElementById('pair-code-text');
  if (pairCodeText) pairCodeText.innerText = 'ABCD-EFGH';
  const pairConnectedStatus = document.getElementById('pair-connected-status');
  if (pairConnectedStatus) pairConnectedStatus.classList.remove('active');

  try {
    await fetch(`${API_URL}/api/v1/devices/${deviceId}/start`, { method: 'POST', headers: getHeaders() });
    pollQrCode();
  } catch (err) {
    console.error('Start device error:', err);
    closeModal('modal-qr');
    showToast(t('toast_net_error'), 'error');
  }
}

async function pollQrCode() {
  if (state.qrIntervalId) clearInterval(state.qrIntervalId);
  const deviceId = state.activeQrDeviceId;

  state.qrIntervalId = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/devices/${deviceId}/qr`, { headers: getHeaders() });
      const data = await res.json();
      const spinner = document.getElementById('qr-spinner');
      const qrImg = document.getElementById('qr-img');
      const box = document.getElementById('qr-box');
      const successOverlay = document.getElementById('qr-connected-status');
      const pairConnectedStatus = document.getElementById('pair-connected-status');

      if (data.qr) {
        spinner.style.display = 'none';
        qrImg.src = data.qr;
        qrImg.style.display = 'block';
        box.classList.add('has-qr');
      }

      // Check connection status
      const statusRes = await fetch(`${API_URL}/api/v1/devices`, { headers: getHeaders() });
      const devices = await statusRes.json();
      const dev = devices.find(d => d.id === deviceId);

      if (dev && dev.status === 'connected') {
        spinner.style.display = 'none';
        qrImg.style.display = 'none';
        box.classList.remove('has-qr');
        successOverlay.classList.add('active');
        if (pairConnectedStatus) {
          pairConnectedStatus.classList.add('active');
        }
        clearInterval(state.qrIntervalId);
        state.qrIntervalId = null;
        setTimeout(() => { closeModal('modal-qr'); fetchDevices(); }, 1500);
      }
    } catch (e) {
      console.error('QR poll error:', e);
    }
  }, 2500);
}

function switchLinkMode(mode) {
  const qrTabBtn = document.getElementById('tab-qr-btn');
  const pairTabBtn = document.getElementById('tab-pair-btn');
  const qrPane = document.getElementById('link-mode-qr');
  const pairPane = document.getElementById('link-mode-pair');

  if (mode === 'qr') {
    if (qrTabBtn) qrTabBtn.classList.add('active');
    if (pairTabBtn) pairTabBtn.classList.remove('active');
    if (qrPane) qrPane.style.display = 'block';
    if (pairPane) pairPane.style.display = 'none';
  } else {
    if (qrTabBtn) qrTabBtn.classList.remove('active');
    if (pairTabBtn) pairTabBtn.classList.add('active');
    if (qrPane) qrPane.style.display = 'none';
    if (pairPane) pairPane.style.display = 'block';
  }
}

async function generatePairingCode() {
  const deviceId = state.activeQrDeviceId;
  const phoneInput = document.getElementById('link-pair-phone');
  const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
  
  if (!phoneNumber) {
    showToast('Lütfen telefon numarasını girin.', 'error');
    return;
  }
  
  const displayContainer = document.getElementById('pairing-code-display');
  const spinner = document.getElementById('pair-spinner');
  const codeText = document.getElementById('pair-code-text');
  const pairConnectedStatus = document.getElementById('pair-connected-status');
  const btn = document.getElementById('btn-get-pair-code');
  
  if (displayContainer) displayContainer.style.display = 'flex';
  if (spinner) spinner.style.display = 'block';
  if (codeText) codeText.style.display = 'none';
  if (pairConnectedStatus) pairConnectedStatus.classList.remove('active');
  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch(`${API_URL}/api/v1/devices/${deviceId}/pair`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone_number: phoneNumber })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Eşleştirme kodu alınamadı.');
    }
    
    const data = await res.json();
    if (spinner) spinner.style.display = 'none';
    if (codeText) {
      codeText.innerText = data.pairing_code || 'HATA';
      codeText.style.display = 'block';
    }
    
    // Ensure status polling is active to catch the success event
    pollQrCode();
  } catch (err) {
    console.error('Pairing code generation error:', err);
    if (spinner) spinner.style.display = 'none';
    if (codeText) {
      codeText.innerText = 'HATA';
      codeText.style.display = 'block';
    }
    showToast(err.message || 'Eşleştirme kodu alınırken hata oluştu.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function stopQrPolling() {
  if (state.qrIntervalId) { clearInterval(state.qrIntervalId); state.qrIntervalId = null; }
  closeModal('modal-qr');
  fetchDevices();
}

async function stopDeviceSession(deviceId) {
  if (!confirm(t('confirm_disconnect'))) return;
  try {
    await fetch(`${API_URL}/api/v1/devices/${deviceId}/stop`, { method: 'POST', headers: getHeaders() });
    fetchDevices();
  } catch (err) { console.error(err); }
}

async function deleteDevice(deviceId) {
  if (!confirm(t('confirm_delete_device'))) return;
  try {
    await fetch(`${API_URL}/api/v1/devices/${deviceId}`, { method: 'DELETE', headers: getHeaders() });
    fetchDevices();
  } catch (err) { console.error(err); }
}

async function toggleDeviceAi(deviceId, isEnabled) {
  const area = document.getElementById(`ai-prompt-area-${deviceId}`);
  if (area) area.style.display = isEnabled ? 'block' : 'none';
  try {
    await fetch(`${API_URL}/api/v1/devices/${deviceId}`, {
      method: 'PUT', headers: getHeaders(),
      body: JSON.stringify({ ai_enabled: isEnabled })
    });
  } catch (err) { console.error(err); }
}

async function saveDevicePrompt(deviceId) {
  const el = document.getElementById(`ai-prompt-${deviceId}`);
  if (!el) return;
  try {
    await fetch(`${API_URL}/api/v1/devices/${deviceId}`, {
      method: 'PUT', headers: getHeaders(),
      body: JSON.stringify({ ai_prompt: el.value })
    });
    showToast(t('toast_ai_saved'), 'success');
  } catch (err) { console.error(err); }
}

// ====== AUTO RESPONDERS ======
let activeResponderDeviceId = null;

async function openAutoResponderModal(deviceId) {
  activeResponderDeviceId = deviceId;
  showModal('modal-responder');
  fetchAutoResponders(deviceId);
}

async function fetchAutoResponders(deviceId) {
  try {
    const res = await fetch(`${API_URL}/api/v1/devices/${deviceId}/auto-responders`, { headers: getHeaders() });
    const rules = await res.json();
    const container = document.getElementById('responders-list');
    if (rules.length === 0) {
      container.innerHTML = `<div class="no-data">${t('resp_no_rules')}</div>`;
      return;
    }
    container.innerHTML = rules.map(r => `
      <div class="responder-item">
        <div class="responder-item-info">
          <strong>${t('resp_rule_keyword')} ${escapeHtml(r.trigger_keyword)}</strong>
          <span>${t('resp_rule_reply')} ${escapeHtml(r.reply_text)}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteResponderRule('${r.id}')">${t('resp_btn_delete')}</button>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

async function deleteResponderRule(ruleId) {
  try {
    await fetch(`${API_URL}/api/v1/auto-responders/${ruleId}`, { method: 'DELETE', headers: getHeaders() });
    fetchAutoResponders(activeResponderDeviceId);
  } catch (err) { console.error(err); }
}

// ====== CAMPAIGNS ======
async function fetchCampaigns() {
  try {
    const res = await fetch(`${API_URL}/api/v1/campaigns`, { headers: getHeaders() });
    const campaigns = await res.json();
    state.campaigns = campaigns;
    renderCampaignsHistory(campaigns);
  } catch (err) { console.error(err); }
}

function renderCampaignsHistory(campaigns) {
  const container = document.getElementById('campaigns-history');
  if (campaigns.length === 0) {
    container.innerHTML = `<div class="no-data">${t('camp_no_history')}</div>`;
    return;
  }
  container.innerHTML = campaigns.map(c => {
    let pct = 0;
    if (c.total_messages > 0) pct = Math.round(((c.sent_messages + c.failed_messages) / c.total_messages) * 100);
    return `
      <div class="campaign-card">
        <div class="campaign-card-header">
          <span class="campaign-name">${escapeHtml(c.name)}</span>
          <span class="badge ${c.status === 'completed' ? 'badge-connected' : 'badge-connecting'}">${t('status_' + c.status)}</span>
        </div>
        <div class="campaign-progress-bar-bg"><div class="campaign-progress-bar" style="width:${pct}%"></div></div>
        <div class="campaign-stats-row">
          <span>${t('camp_progress')} <strong>${pct}%</strong></span>
          <span>${t('camp_stats_msg', { sent: c.sent_messages, failed: c.failed_messages, total: c.total_messages })}</span>
        </div>
        <div class="campaign-actions">
          ${c.status === 'processing' ? `<button class="btn btn-secondary btn-sm" onclick="pauseCampaign('${c.id}')">${t('camp_btn_pause')}</button>` : ''}
          ${c.status === 'paused' ? `<button class="btn btn-primary btn-sm" onclick="resumeCampaign('${c.id}')">${t('camp_btn_resume')}</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function pauseCampaign(id) {
  try { await fetch(`${API_URL}/api/v1/campaigns/${id}/pause`, { method: 'POST', headers: getHeaders() }); fetchCampaigns(); } catch (e) { console.error(e); }
}

async function resumeCampaign(id) {
  try { await fetch(`${API_URL}/api/v1/campaigns/${id}/resume`, { method: 'POST', headers: getHeaders() }); fetchCampaigns(); } catch (e) { console.error(e); }
}

async function populateCampaignDevicePool() {
  try {
    const res = await fetch(`${API_URL}/api/v1/devices`, { headers: getHeaders() });
    const devices = await res.json();
    const container = document.getElementById('camp-devices-pool');
    const active = devices.filter(d => d.status === 'connected');
    if (active.length === 0) {
      container.innerHTML = `<div class="no-data" style="padding:8px 0; font-size:0.75rem; color:var(--danger);">${t('camp_no_dev')}</div>`;
      return;
    }
    container.innerHTML = active.map(d => `
      <label class="checklist-item">
        <input type="checkbox" name="campaign_device_ids" value="${d.id}" checked>
        <span>${escapeHtml(d.name)} (${d.phone_number || '?'})</span>
      </label>
    `).join('');
  } catch (err) { console.error(err); }
}

// ====== SPINTAX PREVIEW ======
function previewSpintax() {
  const text = document.getElementById('camp-message').value;
  const preview = document.getElementById('spintax-preview-text');
  if (!text) { preview.textContent = 'Mesaj yazın...'; return; }
  let parsed = text;
  const pat = /\{([^{}]*\|[^{}]*)\}/g;
  let m;
  while ((m = pat.exec(parsed)) !== null) {
    parsed = parsed.replace(m[0], m[1].split('|')[0]);
    pat.lastIndex = 0;
  }
  parsed = parsed.replace(/{İsim}/g, 'Ahmet').replace(/{Kod}/g, '120593');
  preview.textContent = parsed;
}

// ====== FILE IMPORT (.txt, .csv) ======
function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const numbers = parseNumbersFromText(content);
    if (numbers.length > 0) {
      const existing = document.getElementById('camp-recipients').value.trim();
      const sep = existing ? '\n' : '';
      document.getElementById('camp-recipients').value = existing + sep + numbers.join('\n');
      showToast(t('toast_file_ok', { count: numbers.length }), 'success');
    } else {
      showToast(t('toast_file_empty'), 'warning');
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be re-imported
  input.value = '';
}

function parseNumbersFromText(text) {
  const numbers = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Split by common delimiters: comma, semicolon, tab, pipe
    const parts = trimmed.split(/[,;\t|]+/);
    for (const part of parts) {
      const cleaned = part.trim().replace(/[^\d+]/g, '');
      // Accept numbers 7+ digits (international phone numbers)
      if (cleaned.length >= 7) {
        numbers.push(cleaned);
      }
    }
  }
  return numbers;
}

// Drag & Drop setup
function setupDragDrop() {
  const zone = document.getElementById('file-drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'csv'].includes(ext)) {
      showToast('Desteklenmeyen dosya formatı. .txt veya .csv kullanın.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
      const numbers = parseNumbersFromText(ev.target.result);
      if (numbers.length > 0) {
        const existing = document.getElementById('camp-recipients').value.trim();
        document.getElementById('camp-recipients').value = (existing ? existing + '\n' : '') + numbers.join('\n');
        showToast(t('toast_file_ok', { count: numbers.length }), 'success');
      } else {
        showToast(t('toast_file_empty'), 'warning');
      }
    };
    reader.readAsText(file);
  });
}

// ====== OTP LOGS ======
async function fetchOtpLogs() {
  try {
    const res = await fetch(`${API_URL}/api/v1/message-logs?type=otp&limit=30`, { headers: getHeaders() });
    if (!res.ok) return;
    const logs = await res.json();
    const tbody = document.getElementById('otp-logs-list');
    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="no-data">${t('otp_no_logs')}</td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${escapeHtml(l.recipient)}</td>
        <td>${escapeHtml(l.message_text ? l.message_text.substring(0, 40) : '')}</td>
        <td><span class="status-indicator"><span class="status-dot dot-${getDotColor(l.status === 'sent' ? 'connected' : l.status === 'failed' ? 'banned' : 'connecting')}"></span>${t('status_' + l.status)}</span></td>
      </tr>
    `).join('');
  } catch (err) { console.error('OTP logs error:', err); }
}

// ====== SETTINGS ======
function populateSettingsPage() {
  if (state.user) {
    document.getElementById('settings-api-key').value = state.user.api_key || '';
    document.getElementById('settings-webhook-url').value = state.user.webhook_url || '';
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('settings-api-key');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  // Update the button text from the clicked button
  const btn = event.target.closest('button');
  if (btn) btn.textContent = isHidden ? t('settings_btn_hide') : t('settings_btn_show');
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
  // Sidebar tabs
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => { e.preventDefault(); switchTab(item.dataset.tab); });
  });

  // Login
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        state.token = data.access_token;
        localStorage.setItem('token', data.access_token);
        showDashboard();
      } else {
        showToast(extractError(data, 'toast_login_fail'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Register
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(t('toast_register_ok'), 'success');
        document.getElementById('tab-login-btn').click();
      } else {
        showToast(extractError(data, 'toast_net_error'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Auth tabs
  document.getElementById('tab-login-btn').addEventListener('click', () => {
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('tab-register-btn').classList.remove('active');
    document.getElementById('form-login').classList.add('active');
    document.getElementById('form-register').classList.remove('active');
  });
  document.getElementById('tab-register-btn').addEventListener('click', () => {
    document.getElementById('tab-register-btn').classList.add('active');
    document.getElementById('tab-login-btn').classList.remove('active');
    document.getElementById('form-register').classList.add('active');
    document.getElementById('form-login').classList.remove('active');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Add Device
  document.getElementById('btn-add-device').addEventListener('click', () => showModal('modal-device'));

  document.getElementById('form-device').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('device-name').value;
    const proxy_url = document.getElementById('device-proxy').value || null;
    try {
      const res = await fetch(`${API_URL}/api/v1/devices`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name, proxy_url })
      });
      if (res.ok) {
        closeModal('modal-device');
        document.getElementById('form-device').reset();
        fetchDevices();
      } else {
        const data = await res.json();
        showToast(extractError(data, 'toast_device_fail'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Auto Responder
  document.getElementById('form-responder').addEventListener('submit', async (e) => {
    e.preventDefault();
    const trigger_keyword = document.getElementById('resp-keyword').value;
    const reply_text = document.getElementById('resp-reply').value;
    const is_wildcard = document.getElementById('resp-wildcard').checked;
    try {
      const res = await fetch(`${API_URL}/api/v1/devices/${activeResponderDeviceId}/auto-responders`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ trigger_keyword, reply_text, is_wildcard })
      });
      if (res.ok) {
        document.getElementById('form-responder').reset();
        document.getElementById('resp-wildcard').checked = true;
        fetchAutoResponders(activeResponderDeviceId);
      } else {
        const data = await res.json();
        showToast(extractError(data, 'Kural eklenemedi.'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Campaign
  document.getElementById('form-campaign').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('camp-name').value;
    const deviceIds = [];
    document.querySelectorAll('input[name="campaign_device_ids"]:checked').forEach(cb => deviceIds.push(cb.value));
    if (deviceIds.length === 0) { showToast(t('toast_select_device'), 'warning'); return; }

    const recipientsStr = document.getElementById('camp-recipients').value;
    const recipients = recipientsStr.split(/[\n,;]+/).map(r => r.trim().replace(/\D/g, '')).filter(r => r.length >= 7);
    if (recipients.length === 0) { showToast('Geçerli numara girilmedi.', 'warning'); return; }

    const message_text = document.getElementById('camp-message').value;
    const media_url = document.getElementById('camp-media-url').value || null;
    const media_type = document.getElementById('camp-media-type').value;
    const min_delay = parseInt(document.getElementById('camp-min-delay').value);
    const max_delay = parseInt(document.getElementById('camp-max-delay').value);
    const sched = document.getElementById('camp-schedule').value;
    const scheduled_for = sched ? new Date(sched).toISOString() : null;

    try {
      const res = await fetch(`${API_URL}/api/v1/send-bulk`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name, device_ids: deviceIds, recipients, message_text, media_url, media_type, min_delay, max_delay, scheduled_for })
      });
      const data = await res.json();
      if (res.status === 202) {
        showToast(t('toast_campaign_ok'), 'success');
        document.getElementById('form-campaign').reset();
        fetchCampaigns();
        fetchUserData();
      } else {
        showToast(extractError(data, 'Kampanya başlatılamadı.'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // OTP
  document.getElementById('form-otp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipient = document.getElementById('otp-recipient').value;
    const message_text = document.getElementById('otp-message').value;
    try {
      const res = await fetch(`${API_URL}/api/v1/send-otp`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ recipient, message_text })
      });
      const data = await res.json();
      if (res.status === 202) {
        showToast(t('toast_otp_ok'), 'success');
        document.getElementById('form-otp').reset();
        fetchOtpLogs();
        fetchUserData();
      } else {
        showToast(extractError(data, 'OTP gönderilemedi.'), 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Webhook
  document.getElementById('form-webhook').addEventListener('submit', async (e) => {
    e.preventDefault();
    const webhook_url = document.getElementById('settings-webhook-url').value;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/webhook`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ webhook_url })
      });
      if (res.ok) { showToast(t('toast_webhook_ok'), 'success'); fetchUserData(); }
      else showToast('Webhook kaydedilemedi.', 'error');
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });

  // Credits
  document.getElementById('form-credits').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('credits-amount').value);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/credits`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ amount })
      });
      if (res.ok) {
        showToast(t('toast_credits_ok', { amount: amount.toLocaleString() }), 'success');
        fetchUserData();
      } else {
        showToast('Kredi yüklenemedi.', 'error');
      }
    } catch (err) {
      showToast(t('toast_net_error'), 'error');
    }
  });
}

// ====== HELPERS ======
function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  if (state.qrIntervalId) { clearInterval(state.qrIntervalId); state.qrIntervalId = null; }
  if (state.refreshIntervalId) { clearInterval(state.refreshIntervalId); state.refreshIntervalId = null; }
  showAuthOverlay();
  document.getElementById('form-login').reset();
  document.getElementById('form-register').reset();
}

function showModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getDotColor(status) {
  if (status === 'connected') return 'green';
  if (status === 'connecting') return 'orange';
  if (status === 'banned') return 'red';
  return 'gray';
}

function extractError(data, fallbackKey) {
  const fallback = t(fallbackKey) || fallbackKey;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data instanceof Error) return data.message || fallback;
  if (data.detail) {
    if (Array.isArray(data.detail)) {
      return data.detail.map(err => {
        const loc = Array.isArray(err.loc) ? err.loc.filter(l => l !== 'body').join('.') : '';
        return `${loc ? loc + ': ' : ''}${err.msg || JSON.stringify(err)}`;
      }).join('\n');
    }
    if (typeof data.detail === 'string') return data.detail;
    return JSON.stringify(data.detail);
  }
  if (data.message) return data.message;
  if (data.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  try { return JSON.stringify(data); } catch (e) { return fallback; }
}

// ====== AI MESSAGE GENERATOR & FILE UPLOAD FUNCTIONS ======

function showAiGeneratorModal() {
  document.getElementById('ai-generator-prompt').value = '';
  showModal('modal-ai-generator');
}

async function generateCampaignMessageWithAi() {
  const promptText = document.getElementById('ai-generator-prompt').value.trim();
  if (!promptText) {
    showToast(t('toast_enter_prompt') || 'Lütfen kampanya konusunu girin.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-generate-ai');
  const spinner = document.getElementById('ai-gen-spinner');
  const txt = document.getElementById('ai-gen-text');

  btn.disabled = true;
  spinner.style.display = 'inline-block';
  txt.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/api/v1/generate-message`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt: promptText })
    });
    
    const data = await res.json();
    if (res.ok) {
      document.getElementById('camp-message').value = data.message;
      previewSpintax();
      closeModal('modal-ai-generator');
      showToast(t('toast_ai_message_ok') || 'Mesaj başarıyla oluşturuldu!', 'success');
    } else {
      console.error('AI error:', data);
      showToast(extractError(data, 'toast_net_error'), 'error');
    }
  } catch (err) {
    console.error('AI generation request failed:', err);
    showToast(t('toast_net_error'), 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    txt.style.display = 'inline-block';
  }
}

async function uploadLocalMedia(input) {
  const file = input.files[0];
  if (!file) return;

  const mime = file.type || '';
  let type = 'image';
  if (mime.startsWith('video/')) type = 'video';
  else if (mime.startsWith('audio/')) type = 'audio';
  else if (mime.startsWith('application/') || mime.includes('pdf')) type = 'document';

  document.getElementById('camp-media-type').value = type;
  showToast(t('toast_uploading') || 'Medya yükleniyor...', 'info');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_URL}/api/v1/upload-media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      const finalUrl = data.media_url.startsWith('http') ? data.media_url : `${API_URL}${data.media_url}`;
      document.getElementById('camp-media-url').value = finalUrl;
      showToast(t('toast_upload_ok') || 'Medya yüklendi!', 'success');
    } else {
      console.error('Upload error:', data);
      showToast(extractError(data, 'toast_net_error'), 'error');
    }
  } catch (err) {
    console.error('Media upload request failed:', err);
    showToast(t('toast_net_error'), 'error');
  } finally {
    input.value = '';
  }
}

function switchDocLang(lang) {
  document.querySelectorAll('.docs-tabs .btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`doc-btn-${lang}`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.doc-code-pane').forEach(pane => {
    pane.style.display = 'none';
    pane.classList.remove('active');
  });
  const activePane = document.getElementById(`doc-code-${lang}`);
  if (activePane) {
    activePane.style.display = 'block';
    activePane.classList.add('active');
  }
}
