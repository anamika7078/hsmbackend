# MySQL Setup Guide for Housing Society Management System

## Prerequisites
1. Install MySQL Server on your system
2. Start MySQL service
3. Create database and user

## Step 1: Install MySQL (if not already installed)

### Windows:
1. Download MySQL from https://dev.mysql.com/downloads/mysql/
2. Install MySQL Community Server
3. During installation, set root password (remember it!)

### Or use XAMPP/WAMP:
1. Install XAMPP from https://www.apachefriends.org/
2. Start MySQL from XAMPP Control Panel

## Step 2: Create Database

### Option 1: Using MySQL Command Line
```sql
-- Login to MySQL (use your root password)
mysql -u root -p

-- Create database
CREATE DATABASE society_management;

-- Create user (optional, you can use root)
CREATE USER 'society_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON society_management.* TO 'society_user'@'localhost';
FLUSH PRIVILEGES;
```

### Option 2: Using phpMyAdmin (if using XAMPP)
1. Open http://localhost/phpmyadmin
2. Click "New Database"
3. Enter name: `society_management`
4. Click "Create"

## Step 3: Update .env File

Update your `.env` file with correct credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=society_management
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
```

## Step 4: Run Database Schema

```bash
# Make sure you're in the Backend directory
cd Backend

# Import the schema
mysql -u root -p society_management < src/models/init.sql
```

## Step 5: Start the Server

```bash
npm run dev
```

## Troubleshooting

### Error: "Access denied for user 'root'@'localhost'"
- Check if MySQL password is correct
- Try connecting with: `mysql -u root -p`
- If password is empty, set `DB_PASSWORD=` in .env

### Error: "Can't connect to MySQL server"
- Make sure MySQL service is running
- Check if port 3306 is correct
- Verify DB_HOST is 'localhost'

### Error: "Unknown database 'society_management'"
- Run the schema import command first
- Check if database exists: `SHOW DATABASES;`

## Testing Connection

You can test the database connection with:

```bash
mysql -h localhost -P 3306 -u root -p society_management
```

If this connects successfully, your .env credentials are correct.
