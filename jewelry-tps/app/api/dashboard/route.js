import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get () function:  & one after the other async
export async function GET() { 
  try {
    // 1. Tijori ka stock mangwana
    const inventoryRes = await pool.query('SELECT * FROM metal_inventory ORDER BY inventory_id ASC');
    
    // 2. Aaj ke Sarafa Rates mangwana
    const ratesRes = await pool.query('SELECT * FROM metal_rates ORDER BY rate_date DESC, rate_id ASC');
    
    // 3. Hamara View #1: Saare Customers aur Shopkeepers ki list
    const partiesRes = await pool.query('SELECT * FROM vw_party_directory ORDER BY party_id ASC');
    
    // 4. Hamara View #2: Roz ka Cashflow (FR-9)
    const cashflowRes = await pool.query('SELECT * FROM vw_daily_cashflow');

    // 5. Recent Transactions (Roznamcha)
    const txnsRes = await pool.query(`
      SELECT 
        t.*, 
        p.display_name AS party_name, 
        p.party_type,
        r.metal_type, 
        r.purity, 
        r.unit
      FROM transactions t
      JOIN vw_party_directory p ON t.party_id = p.party_id
      JOIN metal_rates r ON t.rate_id = r.rate_id
      ORDER BY t.txn_timestamp DESC
    `);

    // 6. CCTV Audit Logs (Trigger ka data!)
    const auditRes = await pool.query('SELECT * FROM audit_logs ORDER BY changed_at DESC LIMIT 10');

    // Sab kuch JSON bana kar Frontend ko bhej do 
    // To createa an array of 
    return NextResponse.json({
      success: true,
      inventory: inventoryRes.rows,
      rates: ratesRes.rows,
      parties: partiesRes.rows,
      dailyCashflow: cashflowRes.rows,
      transactions: txnsRes.rows,
      auditLogs: auditRes.rows,
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}