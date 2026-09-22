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
            $table->bigIncrements('id');
            $table->string('adjustment_number')->unique();
            $table->string('item_id')->index('stock_adjustments_item_id_foreign');
            $table->unsignedBigInteger('user_id')->index('stock_adjustments_user_id_foreign');
            $table->enum('adjustment_type', ['addition', 'subtraction']);
            $table->integer('quantity');
            $table->text('reason')->nullable();
            $table->timestamps();
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
