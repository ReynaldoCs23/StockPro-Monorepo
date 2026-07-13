export const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Tunnel-Skip-AntiPhishing-Page': 'true',
            'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = { method, headers };
        
        if (body) options.body = JSON.stringify(body);

        const API_BASE_URL = 'http://127.0.0.1:8000/api';
        const res = await fetch(`${API_BASE_URL}${endpoint}`, options);

        // 1. Cek apakah HTTP Status gagal (misal: 404, 500)
        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('auth_token');
                return { isGuest: true, status: 401 };
            }

            // Coba ambil pesan error dari Laravel jika ada
            const errData = await res.json().catch(() => ({ message: `HTTP Error ${res.status}` }));
            const error = new Error(errData.message || 'Terjadi kerusakan fatal di server Laravel.');
            error.status = res.status;
            throw error;
        }

        const data = await res.json();
        
        // 2. Cek apakah Laravel membalas status: 'error' (dari try-catch Controller)
        if (data.status === 'error') {
            throw new Error(data.message || 'Operasi ditolak oleh sistem.');
        }

        return data;
        
    } catch (error) {
        if (error.status !== 401) {
            console.error("API Call Failed:", error);
        }
        throw error; // Lempar error ini agar ditangkap oleh block catch di komponen React
    }
};