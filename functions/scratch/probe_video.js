const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const videoPath = 'C:/AlfaKotlin/functions/scratch/input.mp4'; // Placeholder

ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
        console.error('PROBE_ERR:', err);
    } else {
        console.log('WIDTH:', metadata.streams[0].width);
    }
    process.exit(0);
});
