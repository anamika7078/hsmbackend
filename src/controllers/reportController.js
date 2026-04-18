const db = require('../config/database');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { society_id } = req.query;
    let stats = {};

    if (userRole === 'committee') {
      let societyFilter = '';
      let memberFilter = '';
      let queryParams = [];

      if (society_id) {
        societyFilter = 'WHERE society_id = $1';
        memberFilter = 'AND wings.society_id = $1';
        queryParams.push(society_id);
      }

      // Committee gets all statistics
      const [memberStats, visitorStats, billingStats, complaintStats] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(DISTINCT u.id) as total_members,
            COUNT(DISTINCT CASE WHEN u.is_verified = true THEN u.id END) as verified_members,
            COUNT(DISTINCT CASE WHEN u.is_active = true THEN u.id END) as active_members
          FROM users u
          LEFT JOIN member_flats mf ON u.id = mf.user_id
          LEFT JOIN flats ON mf.flat_id = flats.id
          LEFT JOIN wings ON flats.wing_id = wings.id
          WHERE u.role = 'member' ${memberFilter}
        `, queryParams),
        db.query(`
          SELECT 
            COUNT(*) as total_visitors,
            COUNT(CASE WHEN visitors.status = 'checked_in' THEN 1 END) as active_visitors,
            COUNT(CASE WHEN DATE(visitors.created_at) = CURRENT_DATE THEN 1 END) as today_visitors
          FROM visitors
          LEFT JOIN flats ON visitors.visiting_flat_id = flats.id
          LEFT JOIN wings ON flats.wing_id = wings.id
          ${society_id ? 'WHERE wings.society_id = $1' : ''}
        `, queryParams),
        db.query(`
          SELECT 
            COUNT(*) as total_bills,
            COUNT(CASE WHEN bills.status = 'unpaid' THEN 1 END) as unpaid_bills,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(SUM(CASE WHEN bills.status != 'paid' THEN amount ELSE 0 END), 0) as outstanding_amount
          FROM bills
          LEFT JOIN flats ON bills.flat_id = flats.id
          LEFT JOIN wings ON flats.wing_id = wings.id
          ${society_id ? ' WHERE wings.society_id = $1' : ''}
        `, queryParams),
        db.query(`
          SELECT 
            COUNT(*) as total_complaints,
            COUNT(CASE WHEN complaints.status = 'open' THEN 1 END) as open_complaints,
            COUNT(CASE WHEN complaints.status = 'in_progress' THEN 1 END) as in_progress_complaints
          FROM complaints
          LEFT JOIN flats ON complaints.flat_id = flats.id
          LEFT JOIN wings ON flats.wing_id = wings.id
          ${society_id ? 'WHERE wings.society_id = $1' : ''}
        `, queryParams)
      ]);

      stats = {
        members: memberStats.rows[0],
        visitors: visitorStats.rows[0],
        billing: billingStats.rows[0],
        complaints: complaintStats.rows[0]
      };
    } else if (userRole === 'member') {
      // Member gets their personal statistics
      const userId = req.user.id;
      const [memberBills, memberComplaints, memberVisitors] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(*) as total_bills,
            COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_bills,
            COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_bills,
            COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) as outstanding_amount
          FROM bills b
          LEFT JOIN member_flats mf ON b.flat_id = mf.flat_id
          WHERE mf.user_id = $1
        `, [userId]),
        db.query(`
          SELECT 
            COUNT(*) as total_complaints,
            COUNT(CASE WHEN status = 'open' THEN 1 END) as open_complaints,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_complaints
          FROM complaints WHERE complainant_id = $1
        `, [userId]),
        db.query(`
          SELECT 
            COUNT(*) as total_visitors,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_visitors,
            COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_visitors
          FROM visitors WHERE visiting_member_id = $1
        `, [userId])
      ]);

      stats = {
        billing: memberBills.rows[0],
        complaints: memberComplaints.rows[0],
        visitors: memberVisitors.rows[0]
      };
    } else if (userRole === 'security') {
      // Security gets visitor and guard statistics
      const [visitorStats, guardStats] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(*) as total_visitors,
            COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as active_visitors,
            COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_visitors
          FROM visitors
        `),
        db.query(`
          SELECT 
            COUNT(*) as total_guards,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_guards
          FROM guards
        `)
      ]);

      stats = {
        visitors: visitorStats.rows[0],
        guards: guardStats.rows[0]
      };
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

// Get monthly reports
const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const [visitorReport, billingReport, complaintReport] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) as total_visitors,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_visitors,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_visitors
        FROM visitors 
        WHERE DATE(created_at) BETWEEN $1 AND $2
      `, [startDate, endDate]),
      db.query(`
        SELECT 
          COUNT(*) as total_bills,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as collected_amount
        FROM bills 
        WHERE DATE(created_at) BETWEEN $1 AND $2
      `, [startDate, endDate]),
      db.query(`
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_complaints
        FROM complaints 
        WHERE DATE(created_at) BETWEEN $1 AND $2
      `, [startDate, endDate])
    ]);

    const report = {
      period: `${year}-${month}`,
      visitors: visitorReport.rows[0],
      billing: billingReport.rows[0],
      complaints: complaintReport.rows[0]
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in getMonthlyReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly report'
    });
  }
};

// Get visitor reports
const getVisitorReport = async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (start_date && end_date) {
      whereClause += ' AND DATE(v.created_at) BETWEEN $1 AND $2';
      queryParams.push(start_date, end_date);
    }

    if (status && status !== 'all') {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND v.status = $${paramIndex}`;
      queryParams.push(status);
    }

    const query = `
      SELECT 
        v.*,
        f.flat_number,
        w.name as wing_name,
        u.name as member_name
      FROM visitors v
      LEFT JOIN flats f ON v.visiting_flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN users u ON v.visiting_member_id = u.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT 1000
    `;

    const result = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getVisitorReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor report'
    });
  }
};

// Get billing reports
const getBillingReport = async (req, res) => {
  try {
    const { start_date, end_date, status, bill_type } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (start_date && end_date) {
      whereClause += ' AND DATE(b.created_at) BETWEEN $1 AND $2';
      queryParams.push(start_date, end_date);
    }

    if (status && status !== 'all') {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND b.status = $${paramIndex}`;
      queryParams.push(status);
    }

    if (bill_type && bill_type !== 'all') {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND b.bill_type = $${paramIndex}`;
      queryParams.push(bill_type);
    }

    const query = `
      SELECT 
        b.*,
        f.flat_number,
        w.name as wing_name,
        u.name as member_name,
        p.total_paid
      FROM bills b
      LEFT JOIN flats f ON b.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN member_flats mf ON b.flat_id = mf.flat_id
      LEFT JOIN users u ON mf.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM payments 
        WHERE bill_id = b.id AND status = 'completed'
      ) p ON true
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT 1000
    `;

    const result = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getBillingReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing report'
    });
  }
};

// Get complaint reports
const getComplaintReport = async (req, res) => {
  try {
    const { start_date, end_date, status, category } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (start_date && end_date) {
      whereClause += ' AND DATE(c.created_at) BETWEEN $1 AND $2';
      queryParams.push(start_date, end_date);
    }

    if (status && status !== 'all') {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND c.status = $${paramIndex}`;
      queryParams.push(status);
    }

    if (category && category !== 'all') {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND c.category = $${paramIndex}`;
      queryParams.push(category);
    }

    const query = `
      SELECT 
        c.*,
        uc.name as complainant_name,
        ua.name as assigned_to_name,
        f.flat_number,
        w.name as wing_name
      FROM complaints c
      LEFT JOIN users uc ON c.complainant_id = uc.id
      LEFT JOIN users ua ON c.assigned_to = ua.id
      LEFT JOIN flats f ON c.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT 1000
    `;

    const result = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getComplaintReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint report'
    });
  }
};

module.exports = {
  getDashboardStats,
  getMonthlyReport,
  getVisitorReport,
  getBillingReport,
  getComplaintReport
};
