import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { scanVideos } from './utils/scanVideos';

const app = express();
const PORT = 4000;
const VIDEO_DIR = path.resolve('G:\\Cpp\\bin');

app.use(cors());
app.use('/thumbnails', express.static(path.join(__dirname, '../thumbnails')));


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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

