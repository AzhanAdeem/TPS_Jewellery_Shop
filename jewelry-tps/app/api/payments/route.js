import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request) {
  const client = await pool.connect();

  try {
    const { transaction_id, party_id, installment_amount, payment_method } = await request.json();
    const numInstallment = parseFloat(installment_amount);

    if (!numInstallment || numInstallment <= 0) {
      return NextResponse.json({ success: false, error: 'Qist ki raqam 0 se zyada honi chahiye!' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Check karna ke is transaction par abhi kitna udhaar baaqi hai
    const lastPayRes = await client.query(
      'SELECT balance_remaining FROM payments WHERE transaction_id = $1 ORDER BY payment_id DESC LIMIT 1',
      [transaction_id]
    );

    if (lastPayRes.rows.length === 0) {
      throw new Error('Is transaction ka koi pichla record nahi mila!');
    }

    const currentRemaining = parseFloat(lastPayRes.rows[0].balance_remaining);
    if (numInstallment > currentRemaining) {
      throw new Error(`Baaqi udhaar sirf PKR ${currentRemaining} hai, aap PKR ${numInstallment} wasool nahi kar sakte!`);
    }

    const newRemaining = parseFloat((currentRemaining - numInstallment).toFixed(2));

    // 2. Payments table mein nayi wasooli ki parchi dalna
    await client.query(
      `INSERT INTO payments (transaction_id, amount_paid, balance_remaining, payment_method)
       VALUES ($1, $2, $3, $4)`,
      [transaction_id, numInstallment, newRemaining, payment_method || 'CASH']
    );

    // 3. Transaction ka status update karna (PAID ya PARTIAL)
    const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';
    await client.query(
      'UPDATE transactions SET payment_status = $1 WHERE transaction_id = $2',
      [newStatus, transaction_id]
    );

    // 4. Customer ya Shopkeeper ke running khate se udhaar kam karna
    const partyRes = await client.query('SELECT party_type FROM parties WHERE party_id = $1', [party_id]);
    const party_type = partyRes.rows[0]?.party_type;

    if (party_type === 'CUSTOMER') {
      await client.query(
        'UPDATE customers SET credit_balance = credit_balance - $1 WHERE customer_id = $2',
        [numInstallment, party_id]
      );
    } else if (party_type === 'SHOPKEEPER') {
      await client.query(
        'UPDATE shopkeepers SET net_balance = net_balance - $1 WHERE shopkeeper_id = $2',
        [numInstallment, party_id]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `PKR ${numInstallment} ki qist wasool ho gayi! Naya baaqi balance: PKR ${newRemaining}`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}