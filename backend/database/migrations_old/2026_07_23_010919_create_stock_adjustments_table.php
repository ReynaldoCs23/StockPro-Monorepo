<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number')->unique();
            $table->string('item_id');
            $table->foreignId('user_id')->constrained('users');
            $table->enum('adjustment_type', ['addition', 'subtraction']);
            $table->integer('quantity');
            $table->text('reason')->nullable();
            $table->timestamps();

            // Referencing string primary key in items table
            $table->foreign('item_id')->references('kodeBarang')->on('items')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
