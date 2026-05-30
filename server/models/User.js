const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    preferences: {
        defaultLanguage: { type: String, default: 'en' }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
