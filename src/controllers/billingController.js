const db = require('../config/database');

const getAllBills = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, f.flat_number, w.name AS wing_name
       FROM bills b
       LEFT JOIN flats f ON b.flat_id = f.id
       LEFT JOIN wings w ON f.wing_id = w.id
       ORDER BY b.created_at DESC`,
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bills' });
  }
};

const generateBills = async (req, res) => {
  try {
    console.log('Generating bills for body:', req.body);
    const { bill_type, amount, due_date, description, flat_ids } = req.body;
    if (!bill_type || !amount || !due_date || !Array.isArray(flat_ids) || flat_ids.length === 0) {
      console.log('Validation failed:', { bill_type, amount, due_date, flat_ids });
      return res.status(400).json({ success: false, message: 'bill_type, amount, due_date, flat_ids are required' });
    }

    const ids = [];
    for (const flatId of flat_ids) {
      const created = await db.query(
        'INSERT INTO bills (flat_id, bill_type, amount, due_date, description, generated_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [flatId, bill_type, amount, due_date, description || null, req.user.id, 'unpaid'],
      );
      ids.push(created.insertId);
    }

    res.status(201).json({ success: true, message: 'Bills generated successfully', data: { bill_ids: ids } });
  } catch (error) {
    console.error('Error in generateBills:', error);
    res.status(500).json({ success: false, message: 'Failed to generate bills', error: error.message });
  }
};

const getMyBills = async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT b.*, f.flat_number, w.name AS wing_name
       FROM bills b
       JOIN flats f ON b.flat_id = f.id
       JOIN member_flats mf ON mf.flat_id = f.id
       LEFT JOIN wings w ON f.wing_id = w.id
       WHERE mf.user_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id],
    );
    res.status(200).json({ success: true, data: rows.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch member bills' });
  }
};

const makePayment = async (req, res) => {
  try {
    const { bill_id, amount, payment_method, transaction_id, notes } = req.body;
    if (!bill_id || !amount || !payment_method) {
      return res.status(400).json({ success: false, message: 'bill_id, amount and payment_method are required' });
    }

    const bill = await db.query('SELECT id, amount FROM bills WHERE id = ?', [bill_id]);
    if (!bill.rows.length) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    await db.query(
      `INSERT INTO payments (bill_id, payer_id, amount, payment_method, transaction_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bill_id, req.user.id, amount, payment_method, transaction_id || null, 'completed', notes || null],
    );

    await db.query(
      'UPDATE bills SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['paid', bill_id],
    );

    res.status(200).json({ success: true, message: 'Payment successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.*, b.bill_type, b.due_date, f.flat_number
       FROM payments p
       JOIN bills b ON p.bill_id = b.id
       LEFT JOIN flats f ON b.flat_id = f.id
       WHERE p.payer_id = ?
       ORDER BY p.payment_date DESC`,
      [req.user.id],
    );
    res.status(200).json({ success: true, data: rows.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
  }
};

const getBillingStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) AS total_bills,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_bills,
        COUNT(CASE WHEN status = 'unpaid' THEN 1 END) AS unpaid_bills,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS overdue_bills,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS collected_amount
      FROM bills
    `);
    res.status(200).json({ success: true, data: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch billing stats' });
  }
};

const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { bill_type, amount, due_date, description, status } = req.body;

    const result = await db.query(
      `UPDATE bills 
       SET bill_type = COALESCE(?, bill_type), 
           amount = COALESCE(?, amount), 
           due_date = COALESCE(?, due_date), 
           description = COALESCE(?, description), 
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [bill_type, amount, due_date, description, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    res.status(200).json({ success: true, message: 'Bill updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bill' });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM bills WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    res.status(200).json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete bill' });
  }
};

module.exports = {
  getAllBills,
  generateBills,
  getMyBills,
  makePayment,
  getPaymentHistory,
  getBillingStats,
  updateBill,
  deleteBill,
};
