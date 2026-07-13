<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Traits\HasSystemLogs;

class AuthController extends Controller
{
    use HasSystemLogs;

    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Username atau password salah.'], 401);
        }

        if ($user->masaBerlaku) {
            if (now()->greaterThan(\Carbon\Carbon::parse($user->masaBerlaku)->endOfDay())) {
                if ($user->status !== 'nonaktif') {
                    $user->update(['status' => 'nonaktif']);
                }
                return response()->json([
                    'message' => 'Akun Anda telah melewati masa berlaku (Expired). Silakan hubungi Administrator.'
                ], 403);
            } elseif ($user->status === 'nonaktif') {
                $user->update(['status' => 'aktif']);
            }
        }

        if ($user->status !== 'aktif') {
            return response()->json([
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.'
            ], 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        $this->writeLog($user->namaLengkap, 'LOGIN', 'System', sprintf("User [%s] logged in successfully.", $user->namaLengkap));

        return response()->json([
            'token' => $token,
            'user' => [
                'username' => $user->username,
                'namaLengkap' => $user->namaLengkap,
                'role' => $user->getRoleNames()->first(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $this->writeLog($user->namaLengkap, 'LOGOUT', 'System', sprintf("User [%s] logged out.", $user->namaLengkap));
        }
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'username' => $user->username,
            'namaLengkap' => $user->namaLengkap,
            'role' => $user->getRoleNames()->first(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }
}
