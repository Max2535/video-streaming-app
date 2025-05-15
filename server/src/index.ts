import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { scanVideos } from './utils/scanVideos';
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
const HLS_DIR = path.resolve(__dirname, 'hls_output');
const SUBTITLE_TEMP_DIR = path.resolve(__dirname, 'subtitle_output');



const app = express();
const PORT = 4000;
const VIDEO_DIR = path.resolve('G:\\Cpp\\bin');
const SUB_DIR = path.resolve('G:\\Cpp\\subtitles');

app.use(cors());
app.use('/thumbnails', express.static(path.join(__dirname, '../thumbnails')));
app.use('/hls', express.static(HLS_DIR));

app.get('/api/videos', async (req, res) => {
  try {
    const videos = await scanVideos(VIDEO_DIR);

    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to scan videos' });
  }
});

app.get('/video/:filename', (req, res) => {
  const decodedPath = decodeURIComponent(req.params.filename);
  const videoPath = path.join(VIDEO_DIR, decodedPath);
  const range = req.headers.range;

  if (!range) {
    res.status(400).send("Requires Range header");
    return;
  }

  const videoSize = fs.statSync(videoPath).size;
  const CHUNK_SIZE = 10 ** 6; // 1MB

  const match = range.match(/bytes=(\d+)-(\d+)?/);
  const start = match ? parseInt(match[1], 10) : 0;
  const end = match && match[2] ? parseInt(match[2], 10) : Math.min(start + CHUNK_SIZE, videoSize - 1);

  const contentLength = end - start + 1;
  const headers = {
    'Content-Range': `bytes ${start}-${end}/${videoSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': 'video/mp4',
  };

  res.writeHead(206, headers);
  fs.createReadStream(videoPath, { start, end }).pipe(res);
});


app.get('/stream/:filename', (req, res) => {
  const decodedFilename = decodeURIComponent(req.params.filename);
  const videoPath = path.join(VIDEO_DIR, decodedFilename);

  if (!fs.existsSync(videoPath)) {
    res.status(404).send('Video not found');
  } else {
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const outputDir = path.join(HLS_DIR, baseName);
    const outputPlaylist = path.join(outputDir, `${baseName}.m3u8`);
    const subtitlePath = path.join(SUB_DIR, `${baseName}.srt`);
    const hasSrt = fs.existsSync(subtitlePath);
    const hasEmbedded = hasSubtitleStream(videoPath, 0); // ตรวจ subtitle ฝัง

    // ถ้ามี playlist อยู่แล้ว → ไม่ต้องแปลงใหม่
    if (fs.existsSync(outputPlaylist)) {
      console.log(`✅ Using cached HLS: ${outputPlaylist}`);
      return res.redirect(`/hls/${baseName}/${baseName}.m3u8`);
    }

    console.log(`🔄 Generating HLS for: ${videoPath}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const safeSubtitlePath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const segmentPattern = path.join(outputDir, `${baseName}_%03d.ts`);

    let ffmpegArgs: string[];

    if (hasSrt) {
      console.log(`✅ External subtitle: ${subtitlePath}`);
      ffmpegArgs = [
        '-i', videoPath,
        '-vf', `subtitles='${safeSubtitlePath}'`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '10',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPattern,
        outputPlaylist,
      ];
    } else if (hasEmbedded) {
      console.log(`✅ Embedded subtitle found in ${videoPath}`);
      ffmpegArgs = [
        '-i', videoPath,
        '-vf', `subtitles='${videoPath.replace(/\\/g, '/')}'`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '10',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPattern,
        outputPlaylist,
      ];
    } else {
      console.warn(`⚠️ No subtitles found for ${videoPath}`);
      ffmpegArgs = [
        '-i', videoPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '10',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPattern,
        outputPlaylist,
      ];
    }

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    const killTimeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        console.warn('⏰ Killing ffmpeg (timeout)');
        ffmpeg.kill('SIGKILL');
      }
    }, 5 * 60 * 1000);

    let responseSent = false;

    ffmpeg.stderr.on('data', (data) => {
      console.error(`[ffmpeg] ${data.toString()}`);
    });

    ffmpeg.on('error', (err) => {
      if (!responseSent && !res.headersSent) {
        res.status(500).send('FFmpeg failed');
        responseSent = true;
      }
      console.error('❌ FFmpeg failed to start:', err);
    });

    req.on('close', () => {
      if (!ffmpeg.killed) {
        console.warn('❌ Client disconnected (req.close)');
        ffmpeg.stdout.destroy();
        ffmpeg.kill('SIGKILL');
      }
    });

    res.on('close', () => {
      if (!ffmpeg.killed) {
        console.warn('📡 Response closed (res.close)');
        ffmpeg.stdout.destroy();
        ffmpeg.kill('SIGKILL');
      }
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(killTimeout);

      if (res.headersSent || res.writableEnded) {
        console.warn('⚠️ Response already sent or closed');
        return;
      }

      if (code === 0) {
        console.log(`✅ HLS generated: ${outputPlaylist}`);
        res.redirect(`/hls/${baseName}/${baseName}.m3u8`);
      } else {
        console.error(`❌ FFmpeg exited with code ${code}`);
        res.status(500).send('Failed to generate HLS stream');
      }
    });
  }
});


app.get('/subtitle/:filename/:index.vtt', (req, res) => {
  const video = decodeURIComponent(req.params.filename);
  const index = Number(req.params.index);
  const inputPath = path.join(VIDEO_DIR, video);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Video not found: ${inputPath}`);
    res.status(404).send('Video not found');
  } else {
    const outputVtt = path.join(SUBTITLE_TEMP_DIR, `${video}-sub${index}.vtt`);
    console.log(`🔄 Extracting subtitle from: ${inputPath} (index: ${index})`);
    if (fs.existsSync(outputVtt)) {
      return res.sendFile(outputVtt);
    }

    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-map', `0:s:${index}`,
      '-f', 'webvtt',
      outputVtt
    ]);

    ffmpeg.on('close', code => {
      if (code === 0) {
        res.sendFile(outputVtt);
      } else {
        res.status(500).send('Failed to extract subtitle');
      }
    });
  }

});

function hasSubtitleStream(videoPath: string, index: number): boolean {
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', `s:${index}`,
    '-show_entries', 'stream=index',
    '-of', 'json',
    videoPath
  ], { encoding: 'utf8' });

  try {
    const output = JSON.parse(probe.stdout);
    return output.streams && output.streams.length > 0;
  } catch {
    return false;
  }
}


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

