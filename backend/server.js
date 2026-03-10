require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();


// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/proximity', require('./routes/proximity'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/classes', require('./routes/classes'));


// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date()
  });
});


// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {

    console.log('✅ MongoDB connected');

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  })
  .catch(err => {

    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);

  });