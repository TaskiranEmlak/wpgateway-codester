# WPGateway — Enterprise WhatsApp Bulk Messaging Panel
Welcome to **WPGateway**, a high-performance, containerized WhatsApp Gateway and Marketing automation panel. This application allows users to connect multiple WhatsApp accounts, run bulk messaging campaigns with smart spintax and randomized delays, configure auto-responders, dispatch instant OTP messages via REST API, and generate high-conversion marketing copies using Llama-3 AI.

---

## 🇹🇷 Türkçe Kurulum ve Çalıştırma Kılavuzu

### 1. Sistem Gereksinimleri
* **Docker & Docker Desktop** (Tavsiye edilen en kolay kurulum yöntemi)
* **Python 3.10+ ve Node.js 18+** (Docker kullanmadan el ile kurmak isterseniz)

### 2. Docker ile Kolay Kurulum (Lokal Bilgisayar - PC)
1. **Docker Desktop** uygulamasının bilgisayarınızda kurulu ve çalışır durumda olduğundan emin olun.
2. Proje klasöründeki **`start.bat`** dosyasını çift tıklayarak çalıştırın.
3. Açılan menüden **`[1] Sistemi Başlat`** seçeneğini seçin (Klavyeden `1` tuşuna basın).
4. Docker servisleri arka planda kurulacaktır. Kurulum tamamlandığında tarayıcınızdan şu adrese girin:
   👉 **`http://localhost:8000`**
5. İlk açılışta **Kayıt Ol (Register)** sekmesinden kullanıcı adı ve şifre oluşturup giriş yapabilirsiniz.

---

### 3. Linux/Unix Sunucuya Kurulum (VPS / Ubuntu Server)
Sunucunuza sistemi Docker kullanarak kurmak için aşağıdaki komutları sırasıyla çalıştırın:

```bash
# 1. Docker ve Git kurulu değilse kurun
sudo apt update
sudo apt install docker.io docker-compose git -y

# 2. Proje dosyalarını sunucuya aktarın
cd /var/www
# (Proje dosyalarınızı buraya yükleyin veya kopyalayın)

# 3. Docker Compose ile sistemi arka planda başlatın
docker-compose up -d --build
```
Sistem sunucuda da `8000` portundan yayına girecektir. Dış dünyaya açmak için Nginx veya Caddy reverse proxy kullanılması tavsiye edilir.

#### Nginx Reverse Proxy Örneği:
`/etc/nginx/sites-available/wpgateway` dosyası oluşturun:
```nginx
server {
    listen 80;
    server_name panel.alanadiniz.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Ardından sembolik bağlantı oluşturup Nginx'i yeniden başlatın ve Let's Encrypt ile SSL (HTTPS) kurun:
```bash
sudo ln -s /etc/nginx/sites-available/wpgateway /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d panel.alanadiniz.com
```

---

### 4. Docker Olmadan El ile Kurulum (Manual Installation)
Eğer sistemi Docker olmadan bilgisayarınızda veya sunucunuzda çalıştırmak isterseniz:

#### A. Veritabanı ve Redis Kurulumu
1. Bilgisayarınıza **PostgreSQL** kurun. `wpgateway_db` adında boş bir veritabanı oluşturun ve `db_schema.sql` dosyasındaki tabloları import edin.
2. Bilgisayarınıza veya sunucunuza **Redis** sunucusunu kurup başlatın.

#### B. Backend (Python/FastAPI) Kurulumu
```bash
cd backend
# Virtual environment oluşturun
python -m venv .venv
source .venv/bin/activate  # Windows için: .venv\Scripts\activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Çevre değişkenlerini ayarlayın (veya app/core/config.py dosyasından düzenleyin)
export DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/wpgateway_db"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="super_secret_key"
export WHATSAPP_SERVICE_URL="http://localhost:3000"

# FastAPI backend uygulamasını başlatın
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### C. WhatsApp Engine (Node.js/Express) Kurulumu
```bash
cd whatsapp-service
# Bağımlılıkları yükleyin
npm install

# Çevre değişkenlerini ayarlayın
export PORT=3000
export DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/wpgateway_db"
export REDIS_URL="redis://localhost:6379/0"

# Node.js servisini başlatın
npm start
```

#### D. Celery Kuyruk İşçisini Başlatma (Kampanyalar için)
```bash
cd backend
source .venv/bin/activate
celery -A app.tasks.campaign.celery_app worker --loglevel=info
```

#### E. Status Worker İşçisini Başlatma (Mesaj durum takibi için)
```bash
cd backend
source .venv/bin/activate
python -m app.tasks.status_worker
```

---
---

## 🇺🇸 English Installation & Setup Guide

### 1. Requirements
* **Docker & Docker Desktop** (Highly recommended)
* **Python 3.10+ and Node.js 18+** (If running manually without containers)

### 2. Quick Start with Docker (Local PC)
1. Ensure **Docker Desktop** is open and running on your system.
2. Double-click the **`start.bat`** file in the project folder.
3. Select option **`[1] Sistemi Başlat`** (Press `1` on your keyboard).
4. Docker will download and set up all services. Once finished, access the panel in your browser:
   👉 **`http://localhost:8000`**
5. Register a new user on the authentication screen to log in.

---

### 3. Production Server Deployment (VPS / Ubuntu Server)
To run WPGateway on a Linux server using Docker, run these commands:

```bash
# 1. Update and install Docker + Compose
sudo apt update
sudo apt install docker.io docker-compose git -y

# 2. Transfer the project folder to the server directory
cd /var/www/wpgateway

# 3. Build and launch services in detached mode
docker-compose up -d --build
```
Your gateway is now listening on port `8000`. Set up an Nginx reverse proxy to connect your domain and configure SSL.

#### Nginx Reverse Proxy Block:
Create `/etc/nginx/sites-available/wpgateway`:
```nginx
server {
    listen 80;
    server_name portal.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Link and enable the configuration, restart Nginx, and secure it with Let's Encrypt SSL:
```bash
sudo ln -s /etc/nginx/sites-available/wpgateway /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d portal.yourdomain.com
```

---

### 4. Manual Installation (Without Docker)
If you wish to run the stack natively on your host OS:

#### A. Database & Redis Setup
1. Install **PostgreSQL** on your system. Create a database called `wpgateway_db` and import the schema using `db_schema.sql`.
2. Install and launch the **Redis** server.

#### B. Backend Setup (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Configure environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/wpgateway_db"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="super_secret_key"
export WHATSAPP_SERVICE_URL="http://localhost:3000"

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### C. WhatsApp Engine Setup (Node.js)
```bash
cd whatsapp-service
npm install

# Configure environment variables
export PORT=3000
export DATABASE_URL="postgresql://user:pass@localhost:5432/wpgateway_db"
export REDIS_URL="redis://localhost:6379/0"

npm start
```

#### D. Start Celery Worker (Campaign queue handler)
```bash
cd backend
source .venv/bin/activate
celery -A app.tasks.campaign.celery_app worker --loglevel=info
```

#### E. Start Status Worker (Message delivery updates)
```bash
cd backend
source .venv/bin/activate
python -m app.tasks.status_worker
```

---

## ⚡ Main Features
* **Multi-Device Sync**: Connect multiple WhatsApp channels using either QR code scan or 8-digit pairing codes.
* **Smart Campaigning**: Randomized delays, variable personalization (`{İsim}`, `{Kod}`), and spintax formatting.
* **Auto-Responder**: Define automatic replies for custom trigger keywords.
* **AI Message Writer**: Ask the built-in Llama-3 AI agent to write engaging sales copies for your campaigns.
* **REST API**: Use HTTP POST requests to trigger automated OTP messages from external applications (PHP, Python, Curl, Node.js).

---

## ☁️ Render.com Ücretsiz Demo Kurulum Kılavuzu

Eğer Codester veya başka bir platformda satış yapmak üzere **tamamen ücretsiz** çalışan bir demo (live preview) oluşturmak istiyorsanız aşağıdaki adımları sırasıyla uygulayabilirsiniz:

### 1. GitHub Deposu Oluşturun
Proje kodlarını kendi GitHub hesabınıza (gizli veya açık olarak) yükleyin.

### 2. Kalıcı Veritabanı Açın (Önerilen)
Render.com'un ücretsiz PostgreSQL veritabanı **90 gün** sonra silinir. Demolarınızın kalıcı olması için:
1. [Neon.tech](https://neon.tech/) veya [Supabase](https://supabase.com/) adresine giderek ücretsiz bir PostgreSQL veritabanı oluşturun.
2. Size verilen **Connection String (postgresql://...)** adresini bir yere kopyalayın.

### 3. Render.com'da Web Service Oluşturun
1. [Render.com](https://render.com/) adresine giriş yapın ve **New + -> Web Service** butonuna tıklayın.
2. GitHub deponuzu bağlayın.
3. Ayarları şu şekilde yapılandırın:
   * **Name:** `wpgateway-demo` (istediğiniz bir ismi verebilirsiniz)
   * **Region:** Sunucuya en yakın lokasyonu seçin (örn: Frankfurt)
   * **Language:** `Docker`
   * **Dockerfile Path:** `Dockerfile.render` *(Burası çok önemlidir! Varsayılan Dockerfile yerine tek konteynerde tüm servisleri çalıştıran bu dosyayı göstermeliyiz)*
   * **Instance Type:** `Free`

### 4. Çevre Değişkenlerini (Environment Variables) Tanımlayın
Aynı sayfada yer alan **Environment Variables** bölümüne giderek şu anahtarları ekleyin:
* `DATABASE_URL` = *2. adımda Neon.tech veya Supabase'den aldığınız veritabanı bağlantı linki*
* `JWT_SECRET` = *rastgele güvenli bir kelime (örn: wpgateway_demo_secret_key_99)*
* `JWT_ALGORITHM` = `HS256`
* `ACCESS_TOKEN_EXPIRE_MINUTES` = `1440`
* `OPENAI_API_KEY` = *Groq veya OpenAI API anahtarınız (Llama-3 ile yapay zeka mesaj yazarı özelliğinin demoda çalışmasını istiyorsanız ekleyin)*

### 5. Yayına Alın (Deploy)
* En alttaki **Create Web Service** butonuna tıklayın.
* Render projenizi derlemeye (build) başlayacaktır. Derleme süreci 5-10 dakika sürebilir.
* Loglarda `[SYSTEM] Starting FastAPI Backend on port 8000...` yazısını gördüğünüzde demo siteniz yayındadır.
* Render ekranında sağ üstte verilen URL adresine (örn: `https://wpgateway-demo.onrender.com`) tıklayarak demo paneline ulaşabilirsiniz.

> [!WARNING]
> **Render Free Planının Özellikleri:**
> 1. Web sitesine 15 dakika boyunca giriş yapılmazsa sunucu uyku moduna geçer. Bir müşteri tıkladığında uyanması **50 saniye** kadar sürer.
> 2. Kalıcı disk ücretsiz planda desteklenmediği için sunucu her yeniden başladığında (en az günde bir kere) bağlı olan test WhatsApp hesaplarının oturumu sonlanır (tekrar QR okutulması gerekir).

