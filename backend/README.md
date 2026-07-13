# StockPro Inventory Management System

## Project Description (Deskripsi Proyek)

The StockPro Inventory Management System is a comprehensive enterprise resource planning and inventory control application developed specifically for PT Mara Jaya Dewi Sakti. Designed with a robust Full-Stack architecture utilizing the Laravel framework for the backend and React with Vite for the frontend, the system facilitates high-performance data processing and seamless user interactions.

This application systematically resolves complex operational challenges associated with supply chain and warehouse management. Core functionalities include meticulous tracking of inbound and outbound transactions, batch management, bill of materials (BOM) processing, and makloon (subcontracting) order administration. Furthermore, the system provides precise management of product returns and dynamically calculates net profit, thereby ensuring accurate financial oversight and maintaining optimal inventory levels across multiple storage locations. The architectural pattern strictly follows the Model-View-Controller (MVC) paradigm integrated with a Single Page Application (SPA) approach, ensuring scalability, maintainability, and enterprise-grade security.

## Prerequisites (Prasyarat Sistem)

Prior to deploying or developing the application, the environment must strictly meet the following minimum system requirements:

*   **PHP:** Version 8.3 or higher.
*   **Composer:** Required for PHP dependency management.
*   **Node.js & NPM:** Node.js environment (v18.x or higher recommended) to process React and Vite frontend dependencies.
*   **Database Engine:** SQLite (configured as default in the environment file) or a compatible relational database management system such as MySQL or PostgreSQL.

## Quick Installation Guide (Panduan Instalasi Cepat)

Follow the procedural instructions below to configure and instantiate the application within a local development environment.

1.  **Archive Extraction (Ekstraksi File):**
    Extract the provided `.zip` application file to your preferred local directory. Open your terminal or command prompt, and navigate into the root of the extracted project folder (ensure you are in the same directory as the `artisan` file):
    ```bash
    cd <extracted_directory_name>
    ```

2.  **Backend Dependency Installation:**
    ```bash
    composer install
    ```

3.  **Frontend Dependency Installation:**
    ```bash
    npm install
    ```

4.  **Environment Setup:**
    ```bash
    cp .env.example .env
    php artisan key:generate
    ```

5.  **Database Migration and Seeding:**
    ```bash
    php artisan migrate:fresh --seed
    ```

6.  **Booting the Application:**
    Execute the following commands in separate terminal instances to initiate the frontend and backend servers concurrently.
    
    Terminal 1 (Backend Server):
    ```bash
    php artisan serve
    ```
    
    Terminal 2 (Frontend Server):
    ```bash
    npm run dev
    ```

    Terminal 3 :
    ```bash
    php artisan reverb:start --port=8090
    ```
    
    Terminal 4:
    ```bash
    php artisan queue:listen
    ```
## Contributors & License (Kontributor & Lisensi)

### Contributors
*   **Reynaldo Christianto Sarungallo** – Primary Full-Stack Engineer and System Architect

### License
**Proprietary Software / Closed Source**

This repository and its contents are the exclusive intellectual property of PT Mara Jaya Dewi Sakti. The source code is strictly restricted for internal corporate use. Unauthorized copying, distribution, modification, or public exposure of this software, via any medium, is strictly prohibited unless explicit written permission is granted by the legal representatives of PT Mara Jaya Dewi Sakti.
