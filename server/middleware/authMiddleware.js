const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Verify with the same secret used when signing
            const secret = process.env.JWT_SECRET || 'scribeai_jwt_dev_secret_key_123';
            const decoded = jwt.verify(token, secret);

            if (global.useMemoryStore) {
                // In-memory mode: no Mongoose, attach minimal user object from token payload
                req.user = { _id: decoded.id, id: decoded.id };
            } else {
                // MongoDB mode: fetch full user record
                const User = require('../models/User');
                req.user = await User.findById(decoded.id).select('-passwordHash');
                if (!req.user) {
                    return res.status(401).json({ message: 'Not authorized, user not found' });
                }
            }

            return next();
        } catch (error) {
            console.error('JWT Verification Error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    return res.status(401).json({ message: 'Not authorized, no token provided' });
};

module.exports = { protect };
