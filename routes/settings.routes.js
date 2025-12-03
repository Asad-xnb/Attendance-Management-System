const router = require('express').Router();
const Settings = require('../models/Settings');

// Get current settings for logged in user
router.get('/api/settings', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only admin and teacher can access settings
    if (req.session.role !== 'admin' && req.session.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userModel = req.session.role === 'admin' ? 'Admin' : 'Teacher';
    
    let settings = await Settings.findOne({ 
      userId: req.session.userId,
      userModel: userModel
    });
    
    // Create default settings if none exist for this user
    if (!settings) {
      settings = await Settings.create({ 
        userId: req.session.userId,
        userModel: userModel
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings for logged in user
router.post('/api/settings', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only admin and teacher can update settings
    if (req.session.role !== 'admin' && req.session.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userModel = req.session.role === 'admin' ? 'Admin' : 'Teacher';
    
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.userId;
    delete updateData.userModel;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    
    let settings = await Settings.findOneAndUpdate(
      { userId: req.session.userId, userModel: userModel },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Reset to defaults for logged in user
router.post('/api/settings/reset', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only admin and teacher can reset settings
    if (req.session.role !== 'admin' && req.session.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userModel = req.session.role === 'admin' ? 'Admin' : 'Teacher';
    
    await Settings.deleteOne({ userId: req.session.userId, userModel: userModel });
    const settings = await Settings.create({ 
      userId: req.session.userId,
      userModel: userModel
    });
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

module.exports = router;
