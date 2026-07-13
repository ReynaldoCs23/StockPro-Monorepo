# Deployment Requirements & Infrastructure Architecture

## Section 1: Hardware Specifications (Spesifikasi Perangkat Keras)

To ensure the stability, performance, and scalability of the Laravel and React (Vite) application, the following hardware specifications must be provisioned on the target Virtual Private Server (VPS).

### Minimum Requirements
These specifications are strictly for baseline operational capacity. Lower specifications may result in Out-Of-Memory (OOM) errors during deployment operations such as `composer install` and `npm run build`.
*   **CPU:** 2 vCPU cores
*   **Memory (RAM):** 2 GB (A swap file of at least 2 GB is highly recommended to prevent process termination during build steps)
*   **Storage:** 25 GB SSD

### Recommended Requirements
These specifications are intended for optimal production performance, accommodating concurrent user traffic and background queue processing.
*   **CPU:** 4 vCPU cores (or higher)
*   **Memory (RAM):** 4 GB (or higher)
*   **Storage:** 50 GB NVMe SSD (for enhanced I/O performance on database queries)

## Section 2: Software & OS Specifications (Spesifikasi Perangkat Lunak)

The application architecture relies on a modern Full-Stack environment. The server must be configured with the following specific software versions.

### Operating System
*   **Linux Distribution:** Ubuntu 24.04 LTS (Noble Numbat) or Ubuntu 22.04 LTS (Jammy Jellyfish).

### PHP Requirements
*   **Version:** PHP 8.3 (Strictly enforced by system dependencies)
*   **Required Extensions:** `php-cli`, `php-fpm`, `php-bcmath`, `php-mysql` (or `php-sqlite3` / `php-pgsql` depending on DB choice), `php-xml`, `php-mbstring`, `php-curl`, `php-zip`, `php-gd`.

### Node.js & NPM Requirements
*   **Node.js Version:** v20.x LTS or v22.x LTS (Required for processing Vite v8.0+ and React v19+ dependencies)
*   **NPM Version:** v10.x or higher

### Web Server Stack
*   **Primary Web Server:** Nginx (Highly recommended over Apache for concurrent request handling and acting as a reverse proxy).
*   **Process Manager:** PHP-FPM (FastCGI Process Manager) coupled with Nginx.

### Database Engine
*   **Primary Database:** MySQL 8.0+ or MariaDB 10.6+ (PostgreSQL 15+ is also natively supported).
*   *(Note: While SQLite is configured by default in the local environment, a robust relational database like MySQL is mandatory for concurrent enterprise operations).*

## Section 3: Network & Security Configuration (Konfigurasi Jaringan)

Stringent network access controls must be implemented to secure the infrastructure against unauthorized access.

### Firewall Configuration (UFW)
The Uncomplicated Firewall (UFW) must be active, with a default deny policy for incoming traffic.

**Explicitly Required Inbound Ports:**
*   **Port 80 (HTTP):** Standard web traffic.
*   **Port 443 (HTTPS):** Secure web traffic.
*   **Port 22 (SSH):** Secure shell access (Consider restricting this port to specific whitelisted IP addresses).

### SSL/TLS Certificates
All HTTP traffic must be redirected to HTTPS. Transport Layer Security (TLS) must be established using an authorized Certificate Authority.
*   **Recommended Provider:** Let's Encrypt utilizing Certbot (`certbot --nginx`).

### Database Security
*   **Port Restriction:** Direct public access to the database port (e.g., Port 3306 for MySQL) must be strictly blocked. Database administration should exclusively be performed via an SSH tunnel or restricted to explicit internal IP whitelists.

## Section 4: Environment Variables (Daftar Variabel Lingkungan)

The following matrix defines the critical environment variables extracted from the environment configuration.

**CRITICAL WARNING:** In the production environment, `APP_ENV` **MUST** be set to `production` and `APP_DEBUG` **MUST** be set to `false`. Failure to adhere to this directive poses a severe security risk and may expose sensitive infrastructure data.

| Key Name | Description | Requirement Level |
| :--- | :--- | :--- |
| `APP_NAME` | The application identifier. | Mandatory |
| `APP_ENV` | Operational environment (`local`, `staging`, `production`). | Mandatory |
| `APP_KEY` | Cryptographic key utilized for session and payload encryption. | Mandatory |
| `APP_DEBUG` | Enables or disables debug mode stack traces. | Mandatory |
| `APP_URL` | Base URL of the application. | Mandatory |
| `LOG_CHANNEL` | Destination for application logs. | Recommended |
| `DB_CONNECTION` | Database driver (e.g., `mysql`, `sqlite`, `pgsql`). | Mandatory |
| `DB_HOST` | Database server hostname or IP address. | Mandatory |
| `DB_PORT` | Database server communication port. | Mandatory |
| `DB_DATABASE` | Name of the provisioned database. | Mandatory |
| `DB_USERNAME` | Authenticated database user. | Mandatory |
| `DB_PASSWORD` | Secure password for the database user. | Mandatory |
| `SESSION_DRIVER` | Storage driver for user sessions. | Mandatory |
| `QUEUE_CONNECTION` | Driver for asynchronous background jobs (e.g., `database`, `redis`). | Mandatory |
| `MAIL_MAILER` | SMTP configuration for outbound system emails. | Recommended |
| `AWS_ACCESS_KEY_ID` | Access key for AWS cloud services. | Optional |
| `REVERB_APP_ID` | Application ID for Reverb Websocket server. | Mandatory (if using WebSockets) |
| `REVERB_APP_KEY` | Public key for Reverb Websocket server. | Mandatory (if using WebSockets) |
| `REVERB_APP_SECRET` | Secret key for Reverb Websocket server. | Mandatory (if using WebSockets) |
| `VITE_APP_NAME` | Environment variable exposed to the Vite frontend. | Mandatory |
