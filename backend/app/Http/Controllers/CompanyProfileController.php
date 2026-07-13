<?php

namespace App\Http\Controllers;

use App\Models\CompanyProfile;
use Illuminate\Http\Request;
use App\Traits\HasSystemLogs;

class CompanyProfileController extends Controller
{
    use HasSystemLogs;

    public function show()
    {
        $profile = CompanyProfile::first();
        return response()->json($profile);
    }

    public function update(Request $request)
    {
        $request->validate([
            'nama' => 'required|string|max:255',
            'alamat' => 'nullable|string',
            'npwp' => 'nullable|string|max:50',
            'penanggung_jawab' => 'nullable|string|max:100',
        ]);

        $profile = CompanyProfile::first();
        if (!$profile) {
            $profile = new CompanyProfile();
        }

        $profile->fill($request->all());
        $profile->save();

        if ($request->log_user) {
            $this->writeLog($request->log_user, 'UPDATE', 'company_profiles', 'Update profil perusahaan');
        }

        return response()->json(['status' => 'success', 'data' => $profile]);
    }
}
