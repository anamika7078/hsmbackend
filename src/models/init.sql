-- Create database schema for Housing Society Management System (MySQL)

-- Users table (for authentication and basic user info)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role ENUM('committee', 'member', 'security') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Societies table
CREATE TABLE IF NOT EXISTS societies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    landmark VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    registration_number VARCHAR(100),
    total_flats INT DEFAULT 0,
    email VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Wings table
CREATE TABLE IF NOT EXISTS wings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    society_id INT,
    name VARCHAR(50) NOT NULL,
    floors INT DEFAULT 0,
    flats_per_floor INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- Flats table
CREATE TABLE IF NOT EXISTS flats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wing_id INT,
    flat_number VARCHAR(20) NOT NULL,
    floor_number INT NOT NULL,
    type ENUM('1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse'),
    area_sqft DECIMAL(10,2),
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wing_id) REFERENCES wings(id) ON DELETE CASCADE
);

-- Member flats mapping (many-to-many relationship)
CREATE TABLE IF NOT EXISTS member_flats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    flat_id INT,
    ownership_type ENUM('owner', 'tenant'),
    is_primary BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_flat (user_id, flat_id)
);

-- Guards table
CREATE TABLE IF NOT EXISTS guards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    shift ENUM('day', 'night'),
    is_active BOOLEAN DEFAULT TRUE,
    society_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- Guard logs table
CREATE TABLE IF NOT EXISTS guard_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guard_id INT,
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    shift_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE
);

-- Visitors table
CREATE TABLE IF NOT EXISTS visitors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    photo_url TEXT,
    visitor_type ENUM('GUEST', 'DELIVERY', 'MAID', 'SERVICE', 'guest', 'delivery', 'maid', 'service') DEFAULT 'GUEST',
    visit_frequency ENUM('one_time', 'regular') DEFAULT 'one_time',
    purpose VARCHAR(255),
    vehicle_number VARCHAR(20),
    visiting_flat_id INT,
    visiting_member_id INT,
    expected_arrival TIMESTAMP NULL,
    actual_arrival TIMESTAMP NULL,
    actual_departure TIMESTAMP NULL,
    status ENUM('pending', 'approved', 'rejected', 'checked_in', 'checked_out') DEFAULT 'pending',
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visiting_flat_id) REFERENCES flats(id),
    FOREIGN KEY (visiting_member_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type ENUM('car', 'bike', 'scooter', 'cycle'),
    make VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    parking_slot VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flat_id INT,
    bill_type ENUM('maintenance', 'water', 'electricity', 'parking', 'other'),
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    period_start DATE NULL,
    period_end DATE NULL,
    description TEXT,
    status ENUM('unpaid', 'paid', 'partial', 'overdue') DEFAULT 'unpaid',
    generated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (flat_id) REFERENCES flats(id),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT,
    payer_id INT,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'online', 'cheque', 'upi'),
    transaction_id VARCHAR(255),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notices table
CREATE TABLE IF NOT EXISTS notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    notice_type ENUM('general', 'emergency', 'maintenance', 'meeting', 'event'),
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    target_audience ENUM('all', 'committee', 'members', 'security'),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- In-app Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('notice', 'complaint', 'billing', 'visitor', 'general') DEFAULT 'notice',
    reference_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complainant_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('plumbing', 'electrical', 'civil', 'security', 'parking', 'other'),
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'resolved', 'closed', 'rejected') DEFAULT 'open',
    assigned_to INT,
    flat_id INT,
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (complainant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (flat_id) REFERENCES flats(id)
);

-- Gate passes table
CREATE TABLE IF NOT EXISTS gate_passes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resident_id INT,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_mobile VARCHAR(20) NOT NULL,
    purpose VARCHAR(255),
    expected_arrival TIMESTAMP NULL,
    actual_arrival TIMESTAMP NULL,
    actual_departure TIMESTAMP NULL,
    status ENUM('active', 'used', 'expired') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- OTP table for authentication
CREATE TABLE IF NOT EXISTS otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff table (helpers, maids, drivers, etc.)
CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100) NOT NULL, -- e.g., 'maid', 'driver', 'plumber', 'electrician'
    staff_type ENUM('regular', 'on_call') DEFAULT 'regular',
    photo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    id_proof_type ENUM('aadhar', 'pan', 'voter_id', 'driving_license', 'other'),
    id_proof_number VARCHAR(100),
    society_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- Staff logs table (for entry/exit tracking)
CREATE TABLE IF NOT EXISTS staff_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT,
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    entry_gate VARCHAR(100),
    exit_gate VARCHAR(100),
    notes TEXT,
    shift_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Staff-Flat mapping (for regular help)
CREATE TABLE IF NOT EXISTS staff_flats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT,
    flat_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE,
    UNIQUE KEY unique_staff_flat (staff_id, flat_id)
);

-- Create indexes for better performance
CREATE INDEX idx_staff_mobile ON staff(mobile);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_logs_date ON staff_logs(shift_date);
CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_member_flats_user_id ON member_flats(user_id);
CREATE INDEX idx_member_flats_flat_id ON member_flats(flat_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_flat_id ON visitors(visiting_flat_id);
CREATE INDEX idx_bills_flat_id ON bills(flat_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_notices_active ON notices(is_active);
CREATE INDEX idx_otps_mobile ON otps(mobile);
CREATE INDEX idx_otps_expires_at ON otps(expires_at);

-- Insert default admin user (email: admin@gmail.com, password: Admin@123)
INSERT INTO users (name, email, mobile, password_hash, role, is_verified) 
VALUES ('Admin', 'admin@gmail.com', '9999999999', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'committee', TRUE)
ON DUPLICATE KEY UPDATE id = id;

-- Insert default society
INSERT INTO societies (name, address, city, state, pincode) 
VALUES ('Sample Society', '123 Main Street', 'Mumbai', 'Maharashtra', '400001')
ON DUPLICATE KEY UPDATE id = id;
