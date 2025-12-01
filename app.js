const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
require('dotenv').config();

const baseRoutes = require('./routes/base.routes');
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const adminRoutes = require('./routes/admin.routes');
const { attachUser } = require('./middleware/auth');

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create MongoDB session store
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ams-ai',
  collection: 'sessions',
  expires: 1000 * 60 * 60 * 24 * 7 // 7 days
});

// Catch errors from the session store
store.on('error', (error) => {
  console.error('Session store error:', error);
});

// MongoDB connection first
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ams-ai')
  .then(() => {
    console.log('MongoDB connected successfully');
    
    // Session configuration (after MongoDB connection)
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: store,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      }
    }));
    
    // Attach user data to all views
    app.use(attachUser);

    // Routes
    app.use('/', authRoutes);
    app.use('/', baseRoutes);
    app.use('/student', studentRoutes);
    app.use('/admin', adminRoutes);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} to view the application`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

