const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const Job = require('../models/Job');
const { protect } = require('../middleware/authMiddleware');

// In-memory jobs store for global.useMemoryStore mode
const memJobs = new Map();

// Setup multer for uploading files locally
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = crypto.randomBytes(8).toString('hex');
        cb(null, `${name}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Helper to convert DB rows to React-friendly response
const formatJob = (job) => {
    return {
        id: job.id,
        uid: job.uid,
        status: job.status,
        progress: job.progress,
        fileName: job.file_name,
        fileSize: job.file_size,
        language: job.language,
        targetLanguage: job.target_lang,
        filePath: job.file_path,
        retryCount: job.retry_count,
        lastProgress: job.last_progress,
        lastProgressAt: job.last_progress_at,
        logs: job.logs || [],
        notes: job.notes,
        transcript: job.transcript,
        srtText: job.srt_text,
        vttText: job.vtt_text,
        error: job.error,
        sourceUrl: job.source_url,
        duration: job.duration,
        segments: job.segments,
        audioSummaryPath: job.audio_summary_path,
        subtitledVideoPath: job.subtitled_video_path,
        languageConfidence: job.language_confidence,
        transcriptConfidence: job.transcript_confidence,
        qualityStatus: job.quality_status,
        rejectionReason: job.rejection_reason,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    };
};

// 1. List all jobs for current user
router.get('/jobs', protect, async (req, res) => {
    try {
        if (global.useMemoryStore) {
            const userJobs = Array.from(memJobs.values())
                .filter(j => j.uid === req.user._id.toString())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const strippedJobs = userJobs.map(j => {
                const formatted = { ...j };
                delete formatted.notes;
                delete formatted.transcript;
                delete formatted.srtText;
                delete formatted.vttText;
                return formatted;
            });
            return res.json(strippedJobs);
        }

        const jobs = await Job.find({ uid: req.user._id.toString() }).sort({ createdAt: -1 });
        // Strip heavy fields like notes/transcript for the list view
        const strippedJobs = jobs.map(j => {
            const formatted = formatJob(j);
            delete formatted.notes;
            delete formatted.transcript;
            delete formatted.srtText;
            delete formatted.vttText;
            return formatted;
        });
        res.json(strippedJobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ message: 'Error fetching jobs', error: error.message });
    }
});

// 2. Get specific job status and notes
router.get('/status/:jobId', protect, async (req, res) => {
    try {
        if (global.useMemoryStore) {
            const job = memJobs.get(req.params.jobId);
            if (!job) {
                return res.status(404).json({ message: 'Job not found' });
            }
            if (job.uid !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
            return res.json(job);
        }

        const job = await Job.findOne({ id: req.params.jobId });
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }
        if (job.uid !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }
        res.json(formatJob(job));
    } catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ message: 'Error fetching job status', error: error.message });
    }
});

// 3. Delete a job/note
router.delete('/job/:jobId', protect, async (req, res) => {
    try {
        if (global.useMemoryStore) {
            const job = memJobs.get(req.params.jobId);
            if (!job) {
                return res.status(404).json({ message: 'Job not found' });
            }
            if (job.uid !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }

            // Clean up physical files if they exist
            if (job.audioSummaryPath && fs.existsSync(job.audioSummaryPath)) {
                fs.unlinkSync(job.audioSummaryPath);
            }
            if (job.subtitledVideoPath && fs.existsSync(job.subtitledVideoPath)) {
                fs.unlinkSync(job.subtitledVideoPath);
            }
            if (job.filePath && fs.existsSync(job.filePath)) {
                fs.unlinkSync(job.filePath);
            }

            memJobs.delete(req.params.jobId);
            return res.json({ message: 'Job and associated notes deleted successfully' });
        }

        const job = await Job.findOne({ id: req.params.jobId });
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }
        if (job.uid !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Clean up physical files if they exist
        if (job.audio_summary_path && fs.existsSync(job.audio_summary_path)) {
            fs.unlinkSync(job.audio_summary_path);
        }
        if (job.subtitled_video_path && fs.existsSync(job.subtitled_video_path)) {
            fs.unlinkSync(job.subtitled_video_path);
        }
        if (job.file_path && fs.existsSync(job.file_path)) {
            fs.unlinkSync(job.file_path);
        }

        await Job.deleteOne({ id: req.params.jobId });
        res.json({ message: 'Job and associated notes deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ message: 'Error deleting job', error: error.message });
    }
});

// 4. File upload route
router.post('/upload', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const jobId = crypto.randomUUID();
        const filename = req.file.originalname;
        const language = req.body.language || 'en';
        const targetLanguage = req.body.target_language || null;

        if (global.useMemoryStore) {
            // Create in-memory job
            const now = new Date().toISOString();
            memJobs.set(jobId, {
                id: jobId,
                uid: req.user._id.toString(),
                status: 'processing',
                progress: 5,
                fileName: filename,
                fileSize: req.file.size,
                language,
                targetLanguage,
                filePath: req.file.path,
                retryCount: 0,
                lastProgress: 5,
                lastProgressAt: now,
                logs: [],
                notes: '',
                transcript: '',
                srtText: '',
                vttText: '',
                error: '',
                languageConfidence: 1.0,
                transcriptConfidence: 1.0,
                qualityStatus: 'processing',
                rejectionReason: '',
                createdAt: now,
                updatedAt: now
            });
        } else {
            // Create Job in MongoDB
            await Job.create({
                id: jobId,
                uid: req.user._id.toString(),
                status: 'processing',
                progress: 5,
                file_name: filename,
                file_size: req.file.size,
                language,
                target_lang: targetLanguage,
                file_path: req.file.path,
                retry_count: 0,
                last_progress: 5,
                last_progress_at: new Date(),
                logs: []
            });
        }

        // Notify Python AI Engine in background
        const aiUrl = (process.env.AI_ENGINE_URL || 'http://localhost:8000') + '/ai/process';
        const aiPayload = {
            job_id: jobId,
            uid: req.user._id.toString(),
            file_path: req.file.path,
            file_name: filename,
            language,
            target_language: targetLanguage
        };
        console.log(`[AI Engine] Sending request to ${aiUrl} with body:`, aiPayload);
        axios.post(aiUrl, aiPayload).then(response => {
            console.log(`[AI Engine] Received response from ${aiUrl}:`, response.data);
        }).catch(async err => {
            console.error('Error calling Python AI engine:', err.message);
            if (global.useMemoryStore) {
                const memJob = memJobs.get(jobId);
                if (memJob) {
                    memJob.status = 'error';
                    memJob.error = 'AI Engine unavailable: ' + err.message;
                    memJobs.set(jobId, memJob);
                }
            } else {
                await Job.updateOne({ id: jobId }, { $set: { status: 'error', error: 'AI Engine unavailable: ' + err.message } });
            }
        });

        res.status(202).json({ job_id: jobId, status: 'processing' });
    } catch (error) {
        console.error('Upload handler error:', error);
        res.status(500).json({ message: 'Error processing upload', error: error.message });
    }
});

// 5. YouTube URL process route
router.post('/process-youtube', protect, async (req, res) => {
    try {
        const { youtube_url, language = 'en', target_language = null } = req.body;
        if (!youtube_url) {
            return res.status(400).json({ message: 'YouTube URL is required' });
        }

        const jobId = crypto.randomUUID();
        const filename = `YouTube: ${youtube_url.substring(0, 50)}`;

        if (global.useMemoryStore) {
            const now = new Date().toISOString();
            memJobs.set(jobId, {
                id: jobId,
                uid: req.user._id.toString(),
                status: 'processing',
                progress: 5,
                fileName: filename,
                fileSize: 0,
                language,
                targetLanguage: target_language,
                sourceUrl: youtube_url,
                filePath: '',
                retryCount: 0,
                lastProgress: 5,
                lastProgressAt: now,
                logs: [],
                sourceUrl: youtube_url,
                notes: '',
                transcript: '',
                srtText: '',
                vttText: '',
                error: '',
                languageConfidence: 1.0,
                transcriptConfidence: 1.0,
                qualityStatus: 'processing',
                rejectionReason: '',
                createdAt: now,
                updatedAt: now
            });
        } else {
            // Create Job in MongoDB
            await Job.create({
                id: jobId,
                uid: req.user._id.toString(),
                status: 'processing',
                progress: 5,
                file_name: filename,
                file_size: 0,
                language,
                target_lang: target_language,
                file_path: '',
                retry_count: 0,
                last_progress: 5,
                last_progress_at: new Date(),
                logs: [],
                source_url: youtube_url
            });
        }

        // Notify Python AI Engine
        const aiUrl = (process.env.AI_ENGINE_URL || 'http://localhost:8000') + '/ai/process';
        const aiPayload = {
            job_id: jobId,
            uid: req.user._id.toString(),
            youtube_url,
            file_name: filename,
            language,
            target_language
        };
        console.log(`[AI Engine] Sending request to ${aiUrl} with body:`, aiPayload);
        axios.post(aiUrl, aiPayload).then(response => {
            console.log(`[AI Engine] Received response from ${aiUrl}:`, response.data);
        }).catch(async err => {
            console.error('Error calling Python AI engine for YouTube:', err.message);
            if (global.useMemoryStore) {
                const memJob = memJobs.get(jobId);
                if (memJob) {
                    memJob.status = 'error';
                    memJob.error = 'AI Engine unavailable: ' + err.message;
                    memJobs.set(jobId, memJob);
                }
            } else {
                await Job.updateOne({ id: jobId }, { $set: { status: 'error', error: 'AI Engine unavailable: ' + err.message } });
            }
        });

        res.status(202).json({ job_id: jobId, status: 'processing' });
    } catch (error) {
        console.error('YouTube handler error:', error);
        res.status(500).json({ message: 'Error processing YouTube URL', error: error.message });
    }
});

// 6. Download formats
router.get('/download/:jobId/:fmt', async (req, res) => {
    try {
        const { jobId, fmt } = req.params;
        
        // Extract token from header or query param
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.query && req.query.token) {
            token = req.query.token;
        }

        // Bulletproof manual fallback query parsing
        if (!token && req.url) {
            const urlParts = req.url.split('?');
            if (urlParts.length > 1) {
                const searchParams = new URLSearchParams(urlParts[1]);
                token = searchParams.get('token');
            }
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token provided' });
        }

        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.id;

        let job;

        if (global.useMemoryStore) {
            job = memJobs.get(jobId);
        } else {
            const dbJob = await Job.findOne({ id: jobId });
            if (dbJob) job = formatJob(dbJob);
        }

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }
        if (job.uid !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (job.status !== 'done') {
            return res.status(400).json({ message: 'Job is not complete yet' });
        }

        const safeName = job.fileName.replace(/\.[^/.]+$/, '').replace(/[^\w-]/g, '_');

        if (fmt === 'md') {
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`);
            return res.send(job.notes);
        } else if (fmt === 'srt') {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.srt"`);
            return res.send(job.srtText);
        } else if (fmt === 'vtt') {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.vtt"`);
            return res.send(job.vttText);
        } else if (fmt === 'audio') {
            if (!job.audioSummaryPath || !fs.existsSync(job.audioSummaryPath)) {
                return res.status(404).json({ message: 'Audio summary file not found' });
            }
            return res.download(job.audioSummaryPath, `${safeName}_summary.mp3`);
        } else if (fmt === 'video') {
            if (!job.subtitledVideoPath || !fs.existsSync(job.subtitledVideoPath)) {
                return res.status(404).json({ message: 'Subtitled video file not found' });
            }
            return res.download(job.subtitledVideoPath, `${safeName}_subtitled.mp4`);
        } else {
            return res.status(400).json({ message: 'Invalid format. Supported: md, srt, vtt, audio, video' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error processing download', error: error.message });
    }
});

// 7. Token-authenticated direct streaming for audio/video tag
router.get('/download/:jobId/audio', async (req, res) => {
    try {
        const { jobId } = req.params;
        let token;
        if (req.query && req.query.token) {
            token = req.query.token;
        }

        // Bulletproof manual fallback query parsing
        if (!token && req.url) {
            const urlParts = req.url.split('?');
            if (urlParts.length > 1) {
                const searchParams = new URLSearchParams(urlParts[1]);
                token = searchParams.get('token');
            }
        }

        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        let job;

        if (global.useMemoryStore) {
            job = memJobs.get(jobId);
        } else {
            const dbJob = await Job.findOne({ id: jobId });
            if (dbJob) job = formatJob(dbJob);
        }

        if (!job) return res.status(404).json({ message: 'Job not found' });
        if (job.uid !== decoded.id) return res.status(403).json({ message: 'Access denied' });

        if (!job.audioSummaryPath || !fs.existsSync(job.audioSummaryPath)) {
            return res.status(404).json({ message: 'Audio summary file not found' });
        }

        res.sendFile(path.resolve(job.audioSummaryPath));
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

router.get('/download/:jobId/video', async (req, res) => {
    try {
        const { jobId } = req.params;
        let token;
        if (req.query && req.query.token) {
            token = req.query.token;
        }

        // Bulletproof manual fallback query parsing
        if (!token && req.url) {
            const urlParts = req.url.split('?');
            if (urlParts.length > 1) {
                const searchParams = new URLSearchParams(urlParts[1]);
                token = searchParams.get('token');
            }
        }

        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        let job;

        if (global.useMemoryStore) {
            job = memJobs.get(jobId);
        } else {
            const dbJob = await Job.findOne({ id: jobId });
            if (dbJob) job = formatJob(dbJob);
        }

        if (!job) return res.status(404).json({ message: 'Job not found' });
        if (job.uid !== decoded.id) return res.status(403).json({ message: 'Access denied' });

        if (!job.subtitledVideoPath || !fs.existsSync(job.subtitledVideoPath)) {
            return res.status(404).json({ message: 'Subtitled video file not found' });
        }

        res.sendFile(path.resolve(job.subtitledVideoPath));
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

router.get('/download/:jobId/vtt', async (req, res) => {
    try {
        const { jobId } = req.params;
        let token;
        if (req.query && req.query.token) {
            token = req.query.token;
        }

        // Bulletproof manual fallback query parsing
        if (!token && req.url) {
            const urlParts = req.url.split('?');
            if (urlParts.length > 1) {
                const searchParams = new URLSearchParams(urlParts[1]);
                token = searchParams.get('token');
            }
        }

        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        let job;

        if (global.useMemoryStore) {
            job = memJobs.get(jobId);
        } else {
            const dbJob = await Job.findOne({ id: jobId });
            if (dbJob) job = formatJob(dbJob);
        }

        if (!job) return res.status(404).json({ message: 'Job not found' });
        if (job.uid !== decoded.id) return res.status(403).json({ message: 'Access denied' });

        res.setHeader('Content-Type', 'text/vtt');
        res.send(job.vttText);
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

// 8. HTTP Callback endpoint for Python AI Engine to update job status
router.post('/callback/job/:jobId', async (req, res) => {
    try {
        const secret = process.env.CALLBACK_SECRET || 'scribeai_callback_dev_secret_123';
        const providedSecret = req.headers['x-callback-secret'];
        if (providedSecret !== secret) {
            return res.status(401).json({ message: 'Unauthorized callback' });
        }

        const { jobId } = req.params;
        const updates = req.body;
        console.log(`[Callback] Job ${jobId} updated:`, updates.status, `(Progress: ${updates.progress}%)`);

        // Check in-memory store
        const memJob = memJobs.get(jobId);
        if (memJob) {
            const isProgressChanged = updates.progress !== undefined && updates.progress !== memJob.progress;
            
            const newLogs = memJob.logs ? [...memJob.logs] : [];
            if (updates.log_message) {
                newLogs.push({ message: updates.log_message, timestamp: new Date().toISOString() });
            }

            const updated = {
                ...memJob,
                status: updates.status !== undefined ? updates.status : memJob.status,
                progress: updates.progress !== undefined ? updates.progress : memJob.progress,
                lastProgress: isProgressChanged ? updates.progress : memJob.lastProgress,
                lastProgressAt: isProgressChanged ? new Date().toISOString() : memJob.lastProgressAt,
                logs: newLogs,
                notes: updates.notes !== undefined ? updates.notes : memJob.notes,
                transcript: updates.transcript !== undefined ? updates.transcript : memJob.transcript,
                srtText: updates.srt_text !== undefined ? updates.srt_text : memJob.srtText,
                vttText: updates.vtt_text !== undefined ? updates.vtt_text : memJob.vttText,
                duration: updates.duration !== undefined ? updates.duration : memJob.duration,
                segments: updates.segments !== undefined ? updates.segments : memJob.segments,
                audioSummaryPath: updates.audio_summary_path !== undefined ? updates.audio_summary_path : memJob.audioSummaryPath,
                subtitledVideoPath: updates.subtitled_video_path !== undefined ? updates.subtitled_video_path : memJob.subtitledVideoPath,
                error: updates.error !== undefined ? updates.error : memJob.error,
                languageConfidence: updates.language_confidence !== undefined ? updates.language_confidence : memJob.languageConfidence,
                transcriptConfidence: updates.transcript_confidence !== undefined ? updates.transcript_confidence : memJob.transcriptConfidence,
                qualityStatus: updates.quality_status !== undefined ? updates.quality_status : memJob.qualityStatus,
                rejectionReason: updates.rejection_reason !== undefined ? updates.rejection_reason : memJob.rejectionReason,
                updatedAt: new Date().toISOString()
            };
            memJobs.set(jobId, updated);
        }

        // Also update MongoDB if we are NOT in-memory mode
        if (!global.useMemoryStore) {
            const updateOps = {};
            
            if (updates.log_message) {
                updateOps.$push = { logs: { message: updates.log_message, timestamp: new Date() } };
                delete updates.log_message;
            }
            
            if (updates.progress !== undefined) {
                updates.last_progress = updates.progress;
                updates.last_progress_at = new Date();
            }
            
            if (Object.keys(updates).length > 0) {
                updateOps.$set = updates;
            }
            
            if (Object.keys(updateOps).length > 0) {
                await Job.updateOne({ id: jobId }, updateOps);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Callback error:', err.message);
        res.status(500).json({ message: 'Error processing callback', error: err.message });
    }
});

// 9. Retry Job Endpoint
router.post('/job/:jobId/retry', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        let job;

        if (global.useMemoryStore) {
            job = memJobs.get(jobId);
            if (!job) return res.status(404).json({ message: 'Job not found' });
            if (job.uid !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });

            const now = new Date().toISOString();
            job.status = 'processing';
            job.progress = 0;
            job.lastProgress = 0;
            job.lastProgressAt = now;
            job.retryCount = (job.retryCount || 0) + 1;
            job.error = '';
            job.logs = [{ message: 'RETRYING', timestamp: now }];
            memJobs.set(jobId, job);
        } else {
            job = await Job.findOne({ id: jobId });
            if (!job) return res.status(404).json({ message: 'Job not found' });
            if (job.uid !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });

            await Job.updateOne({ id: jobId }, {
                $set: {
                    status: 'processing',
                    progress: 0,
                    last_progress: 0,
                    last_progress_at: new Date(),
                    error: '',
                    logs: [{ message: 'RETRYING', timestamp: new Date() }]
                },
                $inc: { retry_count: 1 }
            });
        }

        // Trigger AI engine
        const aiUrl = (process.env.AI_ENGINE_URL || 'http://localhost:8000') + '/ai/process';
        const aiPayload = {
            job_id: jobId,
            uid: req.user._id.toString(),
            file_path: job.filePath || job.file_path,
            youtube_url: job.sourceUrl || job.source_url,
            file_name: job.fileName || job.file_name,
            language: job.language,
            target_language: job.targetLanguage || job.target_lang
        };
        console.log(`[AI Engine] Sending request to ${aiUrl} with body:`, aiPayload);
        axios.post(aiUrl, aiPayload).then(response => {
             console.log(`[AI Engine] Received response from ${aiUrl}:`, response.data);
        }).catch(async err => {
            console.error('Error calling Python AI engine on retry:', err.message);
        });

        res.json({ message: 'Retry initiated', status: 'processing' });
    } catch (err) {
        console.error('Retry error:', err.message);
        res.status(500).json({ message: 'Error retrying job', error: err.message });
    }
});

module.exports = router;
