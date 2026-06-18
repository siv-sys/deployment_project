# Deployment Playbook: React + Express + MySQL Multi-Server Setup

This is the **single complete deployment reference** for the Siv Inventory Management System.  
Nginx and PM2 configuration are embedded directly in this document; everything else comes from the source repository.

**Repository:** `https://github.com/siv-sys/deployment_project.git` (public, branch `master`)

> [!NOTE]
> **Starting fresh:** this version replaces the old manual SFTP drag-and-drop workflow with `git clone` on each server. If a server already has the repo from a previous attempt, run `git pull` inside it instead of cloning again.

---

## 🌐 Infrastructure Topology

```
User Browser
     │
     │  HTTP :80  →  pnc.frontend.siv.org
     ▼
Frontend Server ──────────────────── 172.16.16.159
  Nginx → /var/www/deployment_project/frontend/dist
     │
     │  API Requests :5000  →  pnc.backend.siv.org:5000
     ▼
Backend Server ───────────────────── 172.16.16.69
  Node.js / Express (PM2 Cluster) → /var/www/deployment_project/backend
     │
     │  MySQL :3306
     ▼
Database Server ──────────────────── 192.168.108.234
  MySQL  →  siv_db  →  products table
```

| Component | IP Address | Software | Port | Domain |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | `192.168.108.234` | MySQL Server | `3306` | — |
| **Backend API** | `172.16.16.69` | Node.js, Express, PM2 | `5000` | `pnc.backend.siv.org` |
| **Frontend** | `172.16.16.159` | Nginx, React (Vite) | `80` | `pnc.frontend.siv.org` |

---

## 🔗 Step 1: DNS Configuration (`siv.org` via ISPConfig)

Configure DNS **first** so that records propagate while you deploy the servers.

> [!NOTE]
> Your `siv.org` zone may already have `frontend` → `172.16.16.159` and `backend` → `172.16.16.69` records (these resolve to `frontend.siv.org` / `backend.siv.org`). Those can stay as-is. The steps below add the `pnc.*` subdomains this project actually uses — in ISPConfig, the **Name** field must include the `pnc.` prefix, since the zone itself is just `siv.org` and gets appended automatically.

### 1.1 Add A Records in ISPConfig
1. Log in to **ISPConfig** → **DNS** → **Zones** → click `siv.org`.
2. Open the **Records** tab.
3. Click **A** and add each record below:

| Type | Name | Data (IP) | TTL |
| :--- | :--- | :--- | :--- |
| `A` | `pnc.frontend` | `172.16.16.159` | `3600` |
| `A` | `pnc.backend` | `172.16.16.69` | `3600` |

> This makes:
> - `pnc.frontend.siv.org` → Frontend Server `172.16.16.159`
> - `pnc.backend.siv.org` → Backend Server `172.16.16.69`

### 1.2 Local Testing Override (Windows Hosts File)

> [!IMPORTANT]
> You must **edit the existing `hosts` file** — do NOT create a new `.txt` file.  
> The hosts file has **no file extension**.

1. Press **Win + S**, search for **Notepad**, right-click → **Run as administrator**.
2. In Notepad, go to **File** → **Open**.
3. In the file path bar, type exactly:
   ```
   C:\Windows\System32\drivers\etc\
   ```
4. In the bottom-right dropdown, change **Text Documents (\*.txt)** to **All Files (\*.\*)**.
5. You will now see the `hosts` file (no extension) — click it and click **Open**.
6. Scroll to the bottom of the file and add these two lines:
   ```
   172.16.16.159    pnc.frontend.siv.org
   172.16.16.69     pnc.backend.siv.org
   ```
7. Press **Ctrl+S** to save. Close Notepad.
8. Open your browser and navigate to `http://pnc.frontend.siv.org` — it should now resolve.

---

## 🛠️ Step 2: Database Server (`192.168.108.234`)

### 2.1 Connect via MobaXterm SSH

> [!WARNING]
> If `pnc@192.168.108.234` fails with `Permission denied (publickey,password)` while `pnc` works fine on the backend/frontend servers, the DB server most likely uses a different default username or only accepts key-based auth your client doesn't have loaded. Work through the fixes below in order.

1. Open **MobaXterm** → **Session** → **SSH**.
2. Set **Remote host** to `192.168.108.234`.
3. Check **Specify username** and enter `pnc`.
4. Click **OK** and enter the password when prompted.

**Fix A — Try a different username:**
```bash
ssh root@192.168.108.234
ssh ubuntu@192.168.108.234
ssh admin@192.168.108.234
```

**Fix B — SSH key not loaded in MobaXterm:**
1. In MobaXterm → **Session** → **SSH** → **Advanced SSH settings** tab.
2. Check **Use private key** and browse to your `.pem` or `id_rsa` private key file.
3. Click **OK** to reconnect.

**Fix C — Enable password authentication on the server** *(requires console/VNC access, since SSH itself is currently blocked)*:
```bash
sudo nano /etc/ssh/sshd_config
```
Set:
```ini
PasswordAuthentication yes
PubkeyAuthentication yes
```
Then restart SSH:
```bash
sudo systemctl restart ssh
```

### 2.2 Install MySQL Server
```bash
sudo apt update
sudo apt install -y mysql-server
```

### 2.3 Allow Remote Connections
```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```
Find and update:
```ini
bind-address = 0.0.0.0
```
Save (`Ctrl+O` → `Enter` → `Ctrl+X`), then restart:
```bash
sudo systemctl restart mysql
sudo systemctl enable mysql
```

### 2.4 Create Database and User
```bash
sudo mysql -u root
```
```sql
CREATE DATABASE IF NOT EXISTS `siv_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'siv_user'@'%' IDENTIFIED BY 'siv_password_2026';
GRANT ALL PRIVILEGES ON `siv_db`.* TO 'siv_user'@'%';
FLUSH PRIVILEGES;

-- Verify
SELECT user, host FROM mysql.user;
EXIT;
```

### 2.5 Clone the Repo and Import Schema

```bash
sudo apt install -y git
git clone https://github.com/siv-sys/deployment_project.git ~/deployment_project

mysql -u siv_user -p siv_db < ~/deployment_project/database/schema.sql
# Password: siv_password_2026
```

> [!NOTE]
> `schema.sql` inserts 8 sample products (`SKU-SIV-001` through `SKU-SIV-008`) using `ON DUPLICATE KEY UPDATE`, so re-running it is safe. If `products` previously showed fewer rows in phpMyAdmin, that was from an earlier partial import — this fresh import brings it to the full 8.

Verify in **phpMyAdmin** at `http://192.168.108.234/phpmyadmin` — `siv_db` → `products` table with 8 sample rows.

### 2.6 Firewall
```bash
sudo ufw allow from 172.16.16.69 to any port 3306 proto tcp
sudo ufw reload
sudo ufw status
```

---

## ⚙️ Step 3: Backend API Server (`172.16.16.69`)

### 3.1 Connect via MobaXterm SSH
Remote host: `172.16.16.69`, username: `pnc`.

### 3.2 Install Node.js v20 (LTS)
```bash
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 3.3 Install PM2 Process Manager
```bash
sudo npm install -g pm2
```

### 3.4 Clone the Repository
```bash
sudo mkdir -p /var/www/deployment_project
sudo chown -R $USER:$USER /var/www/deployment_project
sudo apt install -y git

git clone https://github.com/siv-sys/deployment_project.git /var/www/deployment_project
cd /var/www/deployment_project/backend
```

> [!NOTE]
> The repo also contains `deployment/pm2-backend.config.js`, but that file is just a deprecated placeholder pointing back to this README — don't use it. Create the real config below directly inside the `backend` folder.

### 3.5 Create PM2 Config on Server

> [!IMPORTANT]
> Use the **`.cjs`** extension, not `.js`. `backend/package.json` has `"type": "module"`, which makes Node treat every `.js` file as an ES Module — but this config uses CommonJS `module.exports`. Naming it `.cjs` avoids a `ReferenceError: module is not defined in ES module scope` error.

```bash
nano /var/www/deployment_project/backend/pm2-backend.config.cjs
```
Paste the following:
```js
// ============================================================================
// PM2 Configuration for Siv Backend
// Server IP:       172.16.16.69
// Target Location: /var/www/deployment_project/backend/pm2-backend.config.cjs
// Domain:          pnc.backend.siv.org
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'siv-backend',
      script: './server.js',
      cwd: '/var/www/deployment_project/backend',
      instances: 'max',         // Cluster mode — one process per CPU core
      exec_mode: 'cluster',
      autorestart: true,        // Auto-restart on crash
      watch: false,             // Never watch in production
      max_memory_restart: '1G', // Restart if memory exceeds 1 GB
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
```
Save and exit.

### 3.6 Create Environment File
```bash
nano /var/www/deployment_project/backend/.env
```
Paste:
```env
# Server
PORT=5000
NODE_ENV=production

# Database (192.168.108.234)
DB_HOST=192.168.108.234
DB_PORT=3306
DB_USER=siv_user
DB_PASSWORD=siv_password_2026
DB_NAME=siv_db

# CORS — allow requests from the frontend origin
CORS_ORIGIN=http://pnc.frontend.siv.org,http://172.16.16.159
```
Save and exit.

### 3.7 Install Dependencies and Launch
```bash
cd /var/www/deployment_project/backend
npm install --omit=dev

# Start with PM2
pm2 start pm2-backend.config.cjs

# Save process list and enable auto-start on reboot
pm2 save
pm2 startup
```
> Copy and paste the `sudo env PATH=...` command printed by `pm2 startup` to register boot startup.

### 3.8 Verify Backend
```bash
pm2 list
pm2 logs siv-backend --lines 20
curl http://localhost:5000/api/health
```
Expected: `{"status":"online","database":{"status":"connected",...}}`

### 3.9 Firewall
```bash
sudo ufw allow from 172.16.16.159 to any port 5000 proto tcp
sudo ufw reload
sudo ufw status
```

---

## 🖥️ Step 4: Frontend Server (`172.16.16.159`)

### 4.1 Connect via MobaXterm SSH
Remote host: `172.16.16.159`, username: `pnc`.

### 4.2 Install Nginx
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.3 Clone the Repository and Build
No more building on Windows and SFTP'ing the `dist/` folder — clone and build directly on the server:
```bash
sudo mkdir -p /var/www/deployment_project
sudo chown -R $USER:$USER /var/www/deployment_project
sudo apt install -y git

git clone https://github.com/siv-sys/deployment_project.git /var/www/deployment_project
cd /var/www/deployment_project/frontend

sudo apt install -y nodejs npm    # skip if Node is already installed
npm install
npm run build
```
Output: `/var/www/deployment_project/frontend/dist/` — contains `index.html` and `assets/`.

Verify:
```bash
ls /var/www/deployment_project/frontend/dist
# Expected: index.html  assets/
```

### 4.4 Create Nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/siv-frontend
```
Paste the following:
```nginx
# ============================================================================
# Nginx Configuration for Siv Frontend
# Server IP:       172.16.16.159
# Target Location: /etc/nginx/sites-available/siv-frontend
# Domain:          pnc.frontend.siv.org  (ISPConfig DNS A Record)
# Web Root:        /var/www/deployment_project/frontend/dist
# ============================================================================

server {
    listen 80;
    listen [::]:80;

    server_name pnc.frontend.siv.org 172.16.16.159;

    root /var/www/deployment_project/frontend/dist;
    index index.html;

    # Gzip compression for faster page loading
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/x-javascript application/xml;
    gzip_disable "MSIE [1-6]\.";

    # Cache static assets (CSS, JS, images, fonts) for 1 month
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|webm|mp4)$ {
        expires 1M;
        access_log off;
        add_header Cache-Control "public, no-transform";
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/siv-frontend-access.log;
    error_log  /var/log/nginx/siv-frontend-error.log;
}
```

> [!NOTE]
> The repo also contains `deployment/nginx-frontend.conf`, but like the PM2 file, it's a deprecated placeholder pointing back to this README — don't use it directly.

Save and exit.

### 4.5 Enable Site and Reload Nginx
```bash
sudo ln -sf /etc/nginx/sites-available/siv-frontend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 4.6 Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw reload
sudo ufw status
```

---

## 🔄 Updating After the Initial Clone

Once each server has the repo cloned, future updates are a pull + restart instead of a full re-clone:

```bash
# Backend
cd /var/www/deployment_project && git pull
cd backend && npm install --omit=dev && pm2 restart siv-backend

# Frontend
cd /var/www/deployment_project && git pull
cd frontend && npm install && npm run build
# Nginx serves the new dist/ automatically — no reload needed unless the config itself changed

# Database (only if schema.sql changed)
cd ~/deployment_project && git pull
mysql -u siv_user -p siv_db < database/schema.sql
```

---

## 🔍 Step 5: Verification Checklist

### Database (`192.168.108.234`)
- [ ] `sudo systemctl status mysql` → **active (running)**
- [ ] phpMyAdmin: `siv_db` → `products` table exists with 8 sample rows
- [ ] From backend server: `mysql -h 192.168.108.234 -u siv_user -p siv_db` → connects OK

### Backend (`172.16.16.69` / `pnc.backend.siv.org`)
- [ ] `pm2 list` → `siv-backend` status is **online**
- [ ] `curl http://localhost:5000/api/health` → `{"status":"online","database":{"status":"connected"}}`
- [ ] `curl http://localhost:5000/api/products` → returns JSON array of products

### Frontend (`172.16.16.159` / `pnc.frontend.siv.org`)
- [ ] `sudo systemctl status nginx` → **active (running)**
- [ ] `ls /var/www/deployment_project/frontend/dist` → shows `index.html` and `assets/`
- [ ] Browser: `http://172.16.16.159` → Siv Inventory UI loads

### End-to-End
- [ ] Browser: `http://pnc.frontend.siv.org` → UI loads correctly
- [ ] Click **Refresh** — product list loads without errors (Frontend → Backend ✅)
- [ ] Click **Add Product**, submit a test item — it appears in the list (Backend → MySQL ✅)
- [ ] phpMyAdmin → `siv_db` → `products` → new row is visible (MySQL write confirmed ✅)

---

## ⚠️ Common Issues & Fixes

| Problem | Likely Cause | Fix |
| :--- | :--- | :--- |
| Blank page on `pnc.frontend.siv.org` | Wrong Nginx `root` path or `dist/` not built | Verify `root /var/www/deployment_project/frontend/dist;` and run `ls` on that path |
| CORS error in browser console | `CORS_ORIGIN` missing `http://pnc.frontend.siv.org` | Edit `.env`, add the origin, then `pm2 restart siv-backend` |
| Backend can't reach MySQL | `bind-address` still `127.0.0.1` or UFW blocking | Set `bind-address = 0.0.0.0` in `mysqld.cnf`; allow port 3306 from `172.16.16.69` |
| PM2 not running after reboot | `pm2 startup` command not applied | Run `pm2 startup`, then run the printed `sudo env PATH=...` command |
| `nginx -t` fails | Syntax error in site config | Re-paste the Nginx block carefully; check for missing semicolons |
| `[PM2][ERROR] File ... malformated` / `module is not defined in ES module scope` | PM2 config saved as `.js` while `package.json` has `"type": "module"` | Rename to `pm2-backend.config.cjs` and run `pm2 start pm2-backend.config.cjs` |
| DNS not resolving | Propagation delay or wrong ISPConfig A record | Verify the A record Name is `pnc.frontend`/`pnc.backend` (not just `frontend`/`backend`); use hosts file for immediate local testing |
| `ssh pnc@<DB-IP>` → `Permission denied (publickey,password)` | DB server uses a different default user, or only allows key auth | See Step 2.1 — try `root`/`ubuntu`/`admin`, load the correct key, or enable password auth via console access |
| `git clone` fails / times out | Server has no outbound internet access, or `git` isn't installed | `sudo apt install -y git`; check outbound HTTPS is allowed (`curl -I https://github.com`) |

---

## 📁 Project File Reference

```
deployment_project/                    # ← cloned via git on each server
├── backend/
│   ├── server.js              # Express API (ES Module, port 5000)
│   ├── package.json           # type: module — pm2 config must be .cjs
│   └── (pm2-backend.config.cjs and .env are created manually — not in repo)
├── database/
│   └── schema.sql             # Creates siv_db, siv_user, products table + 8 sample rows
├── frontend/
│   ├── src/                   # React source files
│   ├── package.json           # Vite + React 18 (npm run build → dist/)
│   └── dist/                  # ← generated on the frontend server, not committed
└── deployment/
    ├── README.md               # Original repo README (superseded by this document)
    ├── pm2-backend.config.js   # Deprecated placeholder — do not use
    └── nginx-frontend.conf     # Deprecated placeholder — do not use
```
