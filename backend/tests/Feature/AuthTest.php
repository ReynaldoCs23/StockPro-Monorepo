<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials()
    {
        // Seed a test user
        $user = User::create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'namaLengkap' => 'Test User',
            'status' => 'aktif',
            'role' => 'admin',
        ]);

        // Send a POST request to the login endpoint
        $response = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'password123',
        ]);

        // Assert a 200 status and token presence
        $response->assertStatus(200)
                 ->assertJsonStructure(['token', 'user']);
    }

    public function test_user_cannot_login_with_invalid_credentials()
    {
        // Seed a test user
        $user = User::create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'namaLengkap' => 'Test User',
            'status' => 'aktif',
            'role' => 'admin',
        ]);

        // Send a POST request with invalid credentials
        $response = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'wrongpassword',
        ]);

        // Assert a 401 status
        $response->assertStatus(401);
    }

    public function test_user_can_logout()
    {
        // Seed a test user
        $user = User::create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'namaLengkap' => 'Test User',
            'status' => 'aktif',
            'role' => 'admin',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        // Send a POST request to logout
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/logout');

        // Assert success status
        $response->assertStatus(200);
    }
}
