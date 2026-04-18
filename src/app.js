const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const societyRoutes = require('./routes/society');
const guardRoutes = require('./routes/guards');
const visitorRoutes = require('./routes/visitors');
const billingRoutes = require('./routes/billing');
const noticeRoutes = require('./routes/notices');
const complaintRoutes = require('./routes/complaints');
const reportRoutes = require('./routes/reports');
const vehicleRoutes = require('./routes/vehicles');
const emergencyRoutes = require('./routes/emergency');
const staffRoutes = require('./routes/staff');

const app = express();

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use(limiter);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://hsmadmin.vercel.app',
        'https://housingsociety.vercel.app'
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/society', societyRoutes);
app.use('/api/guards', guardRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/bills', billingRoutes);
app.use('/api/payments', billingRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/staff', staffRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Society Management API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
