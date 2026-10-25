import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request) {
  // Pool se ek dedicated private line (client) lena zaroori hai ACID Transaction ke liye!
  const client = await pool.connect();

  try {
    const body = await request.json();
    const {
      txn_type,              // 'SALE', 'PURCHASE', 'B2B_SALE', 'B2B_PURCHASE'
      party_id,              // Customer ya Shopkeeper ki ID
      rate_id,               // Aaj ke metal_rates ki ID
      weight,                // Wazan (Tola ya Gram)
      applied_rate_per_unit, // Jis rate par sauda hua
      amount_paid,           // Kitna cash abhi diya/liya
      payment_method,        // 'CASH' ya 'BANK_TRANSFER'
      notes,                 // Parchi ki تفصیل
      simulate_failure       // VIVA DEMO FEATURE: True hone par jaan boojh kar crash karega!
    } = body;

    const numWeight = parseFloat(weight);
    const numRate = parseFloat(applied_rate_per_unit);
    const numPaid = parseFloat(amount_paid || 0);

    // Total raqam aur baaqi udhaar ka hisab
    const total_amount = parseFloat((numWeight * numRate).toFixed(2));
    const balance_remaining = parseFloat((total_amount - numPaid).toFixed(2));

    if (balance_remaining < 0) {
      return NextResponse.json(
        { success: false, error: 'Ada ki gayi raqam (Amount Paid) kul raqam (Total Amount) se zyada nahi ho sakti!' },
        { status: 400 }
      );
    }

    // Payment Status tay karna
    let payment_status = 'PAID';
    if (balance_remaining > 0 && numPaid > 0) payment_status = 'PARTIAL';
    if (numPaid === 0) payment_status = 'UNPAID';

    // =========================================================================
    // ACID TRANSACTION START (BEGIN)
    // =========================================================================
    await client.query('BEGIN');

    // STEP 1: Rate ID se pata lagana ke konsa Metal (GOLD/SILVER) aur Purity (24K/22K) hai
    const rateRes = await client.query(
      'SELECT metal_type, purity FROM metal_rates WHERE rate_id = $1',
      [rate_id]
    );
    if (rateRes.rows.length === 0) {
      throw new Error('Selected Metal Rate database mein maujood nahi hai!');
    }
    const { metal_type, purity } = rateRes.rows[0];

    // STEP 2: Transactions Register mein nayi parchi insert karna (RETURNING se nayi ID mil jayegi)
    const txnInsertRes = await client.query(
      `INSERT INTO transactions 
        (txn_type, party_id, rate_id, weight, applied_rate_per_unit, total_amount, payment_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING transaction_id`,
      [txn_type, party_id, rate_id, numWeight, numRate, total_amount, payment_status, notes || '']
    );
    const newTxnId = txnInsertRes.rows[0].transaction_id;

    // STEP 3: Payments Register mein cash aur remaining balance likhna
    await client.query(
      `INSERT INTO payments (transaction_id, amount_paid, balance_remaining, payment_method)
       VALUES ($1, $2, $3, $4)`,
      [newTxnId, numPaid, balance_remaining, payment_method || 'CASH']
    );

    // STEP 4: Agar Udhaar (balance_remaining > 0) hai, toh Customer ya Shopkeeper ke khate mein charhana
    if (balance_remaining > 0) {
      const partyRes = await client.query('SELECT party_type FROM parties WHERE party_id = $1', [party_id]);
      const party_type = partyRes.rows[0]?.party_type;

      if (party_type === 'CUSTOMER') {
        // Customer ka Udhaar barhana (Is par hamara Audit Trigger bhi khud chalega!)
        await client.query(
          'UPDATE customers SET credit_balance = credit_balance + $1 WHERE customer_id = $2',
          [balance_remaining, party_id]
        );
      } else if (party_type === 'SHOPKEEPER') {
        // Shopkeeper: Agar B2B_SALE hai toh humne paise lene hain (+), agar B2B_PURCHASE hai toh humne dene hain (-)
        const balanceChange = txn_type === 'B2B_SALE' ? balance_remaining : -balance_remaining;
        await client.query(
          'UPDATE shopkeepers SET net_balance = net_balance + $1 WHERE shopkeeper_id = $2',
          [balanceChange, party_id]
        );
      }
    }

    // =========================================================================
    // VIVA DEMO CHECK: Kya user ne "Simulate Failure" button dabaya hai?
    if (simulate_failure) {
      throw new Error(
        'SIMULATED SYSTEM CRASH! Step 1 (Transaction), Step 2 (Payment) aur Step 3 (Udhaar Khata) chal chuke thay, lekin Step 4 se pehle crash aa gaya. PostgreSQL ne sab ROLLBACK kar diya!'
      );
    }

    // STEP 5: Tijori (metal_inventory) mein wazan kam ya zyada karna
    // Sale par stock kam hoga (-), Purchase par stock barhega (+)
    const weightChange = (txn_type === 'SALE' || txn_type === 'B2B_SALE') ? -numWeight : numWeight;

    await client.query(
      `UPDATE metal_inventory 
       SET available_weight = available_weight + $1, last_updated = CURRENT_TIMESTAMP
       WHERE metal_type = $2 AND purity = $3`,
      [weightChange, metal_type, purity]
    );

    // =========================================================================
    // SAB STEPS KAMIYAB! Tijori mein pakka save kar do (COMMIT)
    // =========================================================================
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Transaction #${newTxnId} kamiyabi se COMMIT ho gayi!`,
      transaction_id: newTxnId
    });

  } catch (error) {

    // KOI BHI STEP FAIL HUA! Sab kuch wapis pehle jaisa kar do (ROLLBACK)
    await client.query('ROLLBACK');
    console.error('ACID Rollback Triggered:', error.message);

    return NextResponse.json(
      {
        success: false,
        rolledBack: true,
        error: `ACID ROLLBACK EXECUTED: ${error.message}`
      },
      { status: 400 }
    );
  } finally {
    // Telephone line wapis pool mein rakh do taake hang na ho
    client.release();
  }
}