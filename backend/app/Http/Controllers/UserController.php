<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Events\StokUpdated;
use App\Traits\HasSystemLogs;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    use HasSystemLogs;

    private const VALID_ROLES = ['Superadmin', 'Admin', 'Karyawan', 'Guest'];

    /**
     * GET /api/users
     */
    public function index()
    {
        $query = User::query();

        // Only hide superadmins if the current user is NOT a superadmin
        if (strtolower(auth()->user()->role ?? '') !== 'superadmin') {
            $query->where('role', '!=', 'Superadmin')->where('role', '!=', 'superadmin');
        }

        $users = $query->get()->map(fn ($user) => [
            'username' => $user->username,
            'namaLengkap' => $user->namaLengkap,
            'role' => $user->getRoleNames()->first(),
            'masaBerlaku' => $user->masaBerlaku,
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);

        return response()->json($users);
    }

    /**
     * GET /api/permissions
     */
    public function permissions()
    {
        $permissions = Permission::all()->pluck('name');

        $grouped = [];
        foreach ($permissions as $perm) {
            $parts = explode('_', $perm, 2);
            if (count($parts) === 2) {
                $grouped[$parts[1]][] = $parts[0];
            }
        }

        return response()->json($grouped);
    }

    /**
     * GET /api/users/{username}/permissions
     * Returns ALL permissions (role-inherited + direct overrides).
     */
    public function userPermissions($username)
    {
        $user = User::where('username', $username)->firstOrFail();
        return response()->json($user->getAllPermissions()->pluck('name'));
    }

    /**
     * GET /api/users/{username}/direct-permissions
     * Returns only direct user overrides (for the toggle grid in Edit modal).
     */
    public function userDirectPermissions($username)
    {
        $user = User::where('username', $username)->firstOrFail();
        return response()->json($user->getDirectPermissions()->pluck('name'));
    }

    /**
     * PUT /api/users/{username}/permissions
     */
    public function syncPermissions(Request $request, $username)
    {
        $user = User::where('username', $username)->firstOrFail();

        $validated = $request->validate([
            'permissions' => 'present|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        \Log::info("syncPermissions for [{$username}]: ", $validated['permissions']);

        $user->syncPermissions($validated['permissions']);

        return response()->json([
            'message' => 'Permissions updated successfully.',
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }

    /**
     * POST /api/users
     * Note: Password hashing is handled by User model cast ('password' => 'hashed')
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'namaLengkap' => 'required|string',
            'password' => 'required|string|min:8',
            'role' => 'required|in:' . implode(',', self::VALID_ROLES),
            'masaBerlaku' => 'nullable|date',
        ]);

        // Auto-generate username: MJD + 2-digit year + 3-digit sequence
        $prefix = 'MJDS' . date('y'); // e.g. MJD26
        $lastUser = User::where('username', 'like', $prefix . '%')
            ->orderBy('username', 'desc')
            ->first();

        $nextSeq = 1;
        if ($lastUser) {
            $nextSeq = (int) substr($lastUser->username, -3) + 1;
        }

        $validated['username'] = $prefix . str_pad($nextSeq, 3, '0', STR_PAD_LEFT);

        $user = User::create($validated);

        $role = Role::firstOrCreate(['name' => $validated['role'], 'guard_name' => 'web']);
        $user->assignRole($role);

        $this->writeLog($request->log_user ?? auth()->user()?->namaLengkap, 'CREATE', 'Users', "Berhasil menambahkan pengguna baru dengan username: {$validated['username']} sebagai {$validated['role']}");

        event(new StokUpdated("User baru ditambahkan: {$validated['username']}"));

        return response()->json(['status' => 'success', 'username' => $validated['username']]);
    }

    /**
     * PUT /api/users/{username}
     * Note: Password hashing is handled by User model cast ('password' => 'hashed')
     */
    public function update(Request $request, $username)
    {
        $user = User::where('username', $username)->firstOrFail();

        $validated = $request->validate([
            'namaLengkap' => 'sometimes|string',
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|in:' . implode(',', self::VALID_ROLES),
            'masaBerlaku' => 'nullable|date',
        ]);

        // Don't overwrite password with empty value
        if (!$request->filled('password')) {
            unset($validated['password']);
        }

        $user->fill($validated);
        $changes = $user->getDirty();
        $original = $user->getOriginal();
        $payloadJson = [];
        foreach($changes as $key => $newVal) {
            if ($key === 'updated_at' || $key === 'password') continue;
            $payloadJson[$key] = [
                'old' => $original[$key] ?? null,
                'new' => $newVal
            ];
        }
        $payloadStr = !empty($payloadJson) ? json_encode($payloadJson) : null;
        
        $user->save();

        if ($request->has('role')) {
            $role = Role::firstOrCreate(['name' => $validated['role'], 'guard_name' => 'web']);
            $user->syncRoles([$role]);
        }

        if ($request->has('permissions')) {
            $user->syncPermissions($request->permissions);
        }

        $this->writeLog($request->log_user ?? auth()->user()?->namaLengkap, 'UPDATE', 'Users', "Memperbarui data atau hak akses untuk username: {$username}", $payloadStr);

        event(new StokUpdated("Data user diperbarui: {$username}"));

        return response()->json(['status' => 'success']);
    }

    /**
     * DELETE /api/users/{username}
     */
    public function destroy(Request $request, $username)
    {
        $user = User::where('username', $username)->firstOrFail();
        $this->writeLog($request->log_user ?? auth()->user()?->namaLengkap, 'DELETE', 'Users', "Menghapus pengguna dengan username: {$username}");
        $user->delete();
        event(new StokUpdated("User dihapus: {$username}"));
        return response()->json(['status' => 'success']);
    }

    /**
     * PUT /api/change-password
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Password saat ini salah.'], 422);
        }

        $user->update(['password' => $request->new_password]);

        return response()->json(['status' => 'success', 'message' => 'Password berhasil diubah.']);
    }
}
