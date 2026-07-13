import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Load Configuration
export const options = {
    stages: [
        { duration: '15s', target: 50 }, // Ramp-up to 50 concurrent users
        { duration: '1m', target: 50 },  // Hold the peak load for 1 minute
        { duration: '15s', target: 0 },  // Ramp-down gracefully
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
    },
};

export default function () {
    const baseUrl = 'http://127.0.0.1:8000';
    
    // 2. Login Scenario
    const loginPayload = JSON.stringify({
        username: 'MJDS-SuperAdmin', 
        password: 'Mjds@123',
    });

    const params = { 
        headers: { 
            'Content-Type': 'application/json', 
            'Accept': 'application/json' 
        } 
    };
    
    const loginRes = http.post(`${baseUrl}/api/login`, loginPayload, params);
    
    const checkRes = check(loginRes, {
        'status is 200': (r) => r.status === 200,
        'has token': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.token !== undefined || body.success === true;
            } catch (e) {
                return false;
            }
        }
    });

    if (!checkRes) {
        console.error(`Execution failed with status: ${loginRes.status}. Response body: ${loginRes.body}`);
    }

    // 3. Extract Token
    let token = null;
    try {
        token = loginRes.json('token');
    } catch (e) {
        // Silently catch in production to avoid I/O logging overhead
    }

    // 4. Authenticated Request Scenario (Dashboard)
    if (token) {
        const authParams = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        };

        const dashboardRes = http.get(`${baseUrl}/api/dashboard`, authParams);

        check(dashboardRes, {
            'Akses Dashboard sukses (Status 200)': (r) => r.status === 200,
        });
    }

    // 5. Think Time: Simulate human interaction and prevent unnatural DDOS
    sleep(1);
}