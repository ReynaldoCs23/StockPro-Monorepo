<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow; // Memaksa langsung dikirim
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// WAJIB implements ShouldBroadcastNow agar sinyal dikirim ke WebSocket
class StokUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $pesan;

    public function __construct($pesan = "Ada perubahan data")
    {
        $this->pesan = $pesan;
    }

    // Tentukan "Channel" (Gelombang Radio) tempat sinyal ini dipancarkan
    public function broadcastOn(): array
    {
        return [
            new Channel('inventory-channel'),
        ];
    }

    // Tentukan nama alias sinyalnya agar mudah ditangkap di React
    public function broadcastAs(): string
    {
        return 'stok.updated';
    }
}