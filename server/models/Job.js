const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // UUID string
    uid: { type: String, required: true }, // User ID (MongoDB Object ID string or reference)
    status: { type: String, default: 'processing' },
    progress: { type: Number, default: 0 },
    file_name: { type: String, default: 'Untitled' },
    file_size: { type: Number, default: 0 },
    language: { type: String, default: 'en' },
    target_lang: { type: String, default: null },
    file_path: { type: String, default: '' },
    retry_count: { type: Number, default: 0 },
    last_progress: { type: Number, default: 0 },
    last_progress_at: { type: Date, default: Date.now },
    logs: { type: [{ message: String, timestamp: Date }], default: [] },
    notes: { type: String, default: '' },
    transcript: { type: String, default: '' },
    srt_text: { type: String, default: '' },
    vtt_text: { type: String, default: '' },
    error: { type: String, default: '' },
    source_url: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    segments: { type: Number, default: 0 },
    audio_summary_path: { type: String, default: '' },
    subtitled_video_path: { type: String, default: '' },
    language_confidence: { type: Number, default: 1.0 },
    transcript_confidence: { type: Number, default: 1.0 },
    quality_status: { type: String, default: 'good' },
    rejection_reason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
