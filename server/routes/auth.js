const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Dynamically use real MongoDB controller or in-memory fallback
// global.useMemoryStore is set to true in index.js when MongoDB is unavailable
const getController = () => {
    if (global.useMemoryStore) {
        return require('../controllers/memAuthController');
    }
    return require('../controllers/authController');
};

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { message: 'Too many authentication attempts from this IP, please try again after 15 minutes.' }
});

router.post('/register', authLimiter, (req, res) => getController().registerUser(req, res));
router.post('/login', authLimiter, (req, res) => getController().loginUser(req, res));

module.exports = router;
