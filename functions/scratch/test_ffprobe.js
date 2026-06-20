const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Try to set ffprobe path if it exists in the same place
const path = require('path');
const ffprobePath = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe').replace('ffmpeg', 'ffprobe');
const fs = require('fs');

if (fs.existsSync(ffprobePath)) {
    console.log('ffprobe found at:', ffprobePath);
    ffmpeg.setFfprobePath(ffprobePath);
} else {
    console.log('ffprobe NOT found at:', ffprobePath);
}

const videoPath = 'C:/AlfaKotlin/functions/scratch/input.mp4'; // Placeholder

if (fs.existsSync(videoPath)) {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
            console.error('Probe error:', err);
        } else {
            console.log('Metadata:', JSON.stringify(metadata, null, 2));
        }
        process.exit(0);
    });
} else {
    console.log('Video not found for probe test');
    process.exit(0);
}
