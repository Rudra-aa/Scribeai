const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');

dotenv.config({ path: '../.env' });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' })); // basic input sanitization limit

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'node-backend',
        dbMode: global.useMemoryStore ? 'in-memory' : 'mongodb'
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/jobs'));

// WebSockets
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('audioData', () => {
        // Reserved for future server-side transcription
    });

    socket.on('audioText', async (data) => {
        try {
            const { text, language, targetLanguage } = data;
            if (!text || !text.trim()) return;

            // Map targetLanguage code or full name to standard full name
            const languageNames = {
                'en': 'English', 'english': 'English',
                'hi': 'Hindi', 'hindi': 'Hindi',
                'es': 'Spanish', 'spanish': 'Spanish',
                'fr': 'French', 'french': 'French',
                'de': 'German', 'german': 'German',
                'ja': 'Japanese', 'japanese': 'Japanese',
                'zh': 'Chinese', 'chinese': 'Chinese',
                'ar': 'Arabic', 'arabic': 'Arabic'
            };

            let targetLang = null;
            if (targetLanguage) {
                targetLang = languageNames[targetLanguage.toLowerCase().trim()];
            }

            console.log(`[Socket] Received audioText event. Input: "${text}", Transcribe Lang: "${language}", Target Lang: "${targetLanguage}"`);

            // Fallback to automatic cross-translation if target is unspecified/invalid
            if (!targetLang) {
                targetLang = 'English';
                if (language === 'en') {
                    targetLang = 'Hindi';
                } else if (language === 'hi' || language === 'hinglish') {
                    targetLang = 'English';
                } else if (language === 'auto') {
                    const hasDevanagari = /[\u0900-\u097F]/.test(text);
                    targetLang = hasDevanagari ? 'English' : 'Hindi';
                }
                console.log(`[Socket] Target language unspecified/invalid, resolved fallback: "${targetLang}"`);
            } else {
                console.log(`[Socket] Resolved target language to: "${targetLang}"`);
            }


            // High-speed bypass: if source language matches target language, skip LLM translation completely
            const sourceLangName = languageNames[language] || (language === 'hinglish' ? 'Hindi' : null);
            if (sourceLangName && sourceLangName.toLowerCase() === targetLang.toLowerCase()) {
                socket.emit('transcription', {
                    original: text,
                    translated: text
                });
                return;
            }

            console.log(`[Socket] Translating speech: "${text}" (${language}) to ${targetLang}`);

            // Call Python AI Engine for high-speed translation
            const axios = require('axios');
            const response = await axios.post((process.env.AI_ENGINE_URL || 'http://localhost:8000') + '/ai/translate', {
                text: text,
                target_language: targetLang
            });

            const translation = response.data.translation;
            socket.emit('transcription', {
                original: text,
                translated: translation
            });
        } catch (err) {
            console.error('Socket translation error:', err.message);
            socket.emit('error', { message: 'Translation service unavailable' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

console.log('✅ Imports Successful! Node.js MERN Backend fully loaded.');

// Seed admin user in MongoDB
async function seedAdminMongo() {
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');

    const adminEmail = 'admin@scribeai.com';

    const existing = await User.findOne({
        email: adminEmail
    });

    if (!existing) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(
            'Password123',
            salt
        );

        await User.create({
            name: 'Developer Admin',
            email: adminEmail,
            passwordHash
        });

        console.log('Admin user created');
    }
}

// Startup
async function startServer() {
    const rawUri = (process.env.MONGO_URI || '').trim();

    if (rawUri.startsWith('mongodb')) {
        try {
            console.log('Attempting MongoDB connection...');

            await mongoose.connect(rawUri, {
                serverSelectionTimeoutMS: 5000
            });

            console.log('Connected to MongoDB');

            global.useMemoryStore = false;

            await seedAdminMongo();

            printCredentials();

            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });

            return;
        } catch (err) {
            console.log(
                'MongoDB unavailable:',
                err.message
            );

            console.log(
                'Starting in in-memory mode...'
            );
        }
    }

    // Fallback to memory mode
    global.useMemoryStore = true;

    const {
        seedAdminInMemory
    } = require('./controllers/memAuthController');

    await seedAdminInMemory();

    printCredentials();

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(
            'Mode: IN-MEMORY (data resets on restart)'
        );
    });
}

function printCredentials() {
    console.log('\nAdmin Test Credentials');
    console.log('Email: admin@scribeai.com');
    console.log('Password: Password123');
    console.log(
        'Login: http://localhost:5173/auth\n'
    );
}

startServer();