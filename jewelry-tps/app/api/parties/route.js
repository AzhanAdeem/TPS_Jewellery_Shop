    import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request) {
  const client = await pool.connect();

  try {
    const { party_type, name, contact, address } = await request.json();

    await client.query('BEGIN');

    // Step 1: Supertype (parties) mein entry kar ke naya token number (party_id) lena
    const partyRes = await client.query(
      'INSERT INTO parties (party_type) VALUES ($1) RETURNING party_id',
      [party_type]
    );
    const newPartyId = partyRes.rows[0].party_id;

    // Step 2: Subtype (customers ya shopkeepers) mein wahi party_id (PK/FK) use kar ke details dalna
    if (party_type === 'CUSTOMER') {
      await client.query(
        'INSERT INTO customers (customer_id, name, phone, address) VALUES ($1, $2, $3, $4)',
        [newPartyId, name, contact, address || '']
      );
    } else if (party_type === 'SHOPKEEPER') {
      await client.query(
        'INSERT INTO shopkeepers (shopkeeper_id, shop_name, contact, address) VALUES ($1, $2, $3, $4)',
        [newPartyId, name, contact, address || '']
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Naya ${party_type} (${name}) کامیابی se register ho gaya (ID: #${newPartyId})!`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}