import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request) {
  try {
    const { metal_type, purity, unit, rate_per_unit } = await request.json();

    // UPSERT: Agar aaj ki tareekh mein yeh metal+purity pehle se hai toh rate update kar do, warna naya daal do!
    const res = await pool.query(
      `INSERT INTO metal_rates (rate_date, metal_type, purity, unit, rate_per_unit)
       VALUES (CURRENT_DATE, $1, $2, $3, $4)
       ON CONFLICT (rate_date, metal_type, purity) 
       DO UPDATE SET rate_per_unit = EXCLUDED.rate_per_unit
       RETURNING *`,
      [metal_type, purity, unit, parseFloat(rate_per_unit)]
    );

    return NextResponse.json({
      success: true,
      message: `${metal_type} (${purity}) ka aaj ka Sarafa Rate PKR ${rate_per_unit} update ho gaya!`,
      rate: res.rows[0]
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}