const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Note: ensure axios is installed or use native fetch

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // For now, we simulate the connection to Python FastAPI AI engine.
        // In a real scenario, we would stream the file to the python process or pass the file path.
        
        // Simulating the Python engine processing time
        setTimeout(() => {
            res.json({
                message: 'File processed successfully by AI Engine',
                summary: 'This is an AI generated summary of the media file. Key points discussed include the transition to microservices and replacing Firebase with MongoDB.',
                actionItems: [
                    'Review API routing',
                    'Test local Whisper transcription accuracy',
                    'Verify JWT tokens'
                ],
                filename: req.file.filename
            });
        }, 2000);

        /*
        // Actual implementation to connect to Python FastAPI:
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));

        const aiResponse = await axios.post((process.env.AI_ENGINE_URL || 'http://localhost:8000') + '/ai/transcribe', formData, {
            headers: formData.getHeaders()
        });
        res.json(aiResponse.data);
        */
        
    } catch (error) {
        res.status(500).json({ message: 'Error processing file', error: error.message });
    }
});

module.exports = router;
