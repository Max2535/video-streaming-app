import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov'];
const THUMBNAIL_DIR = path.resolve(__dirname, '../../thumbnails');

// ✅ ฟังก์ชันสร้าง thumbnail
function generateThumbnail(videoPath: string, outDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const filename = path.basename(videoPath, path.extname(videoPath)) + '.jpg';
    const outputPath = path.join(outDir, filename);

    // ถ้ามี thumbnail อยู่แล้ว → ข้าม
    if (fs.existsSync(outputPath)) {
      return resolve(outputPath);
    }

    ffmpeg(videoPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .screenshots({
        count: 1,
        filename,
        folder: outDir,
        size: '320x?',
      });
  });
}

export async function scanVideos(baseDir: string): Promise<any[]> {
  const results: any[] = [];

  const resolvedPath = path.resolve(baseDir);
  console.log(`📁 Scanning directory: ${resolvedPath}`);

  if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
  }

  const dirProc = spawn('cmd.exe', ['/c', 'dir', '/b', '/s', resolvedPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const rl = readline.createInterface({
    input: dirProc.stdout!,
    crlfDelay: Infinity,
  });

  const stderrLines: string[] = [];

  dirProc.stderr?.on('data', (data) => {
    const msg = data.toString();
    stderrLines.push(msg);
    console.error(`❗ STDERR: ${msg}`);
  });

  dirProc.on('error', (err) => {
    console.error(`❌ spawn error:`, err.message);
  });

  let found = false;

  for await (const line of rl) {
    const fullPath = line.trim();
    if (!fullPath) continue;

    const ext = path.extname(fullPath).toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(ext)) continue;

    try {
      const stat = fs.statSync(fullPath);
      const thumbnailPath = await generateThumbnail(fullPath, THUMBNAIL_DIR);

      results.push({
        title: path.parse(fullPath).name,
        filename: path.basename(fullPath),
        fullPath,
        relativePath: path.relative(resolvedPath, fullPath),
        extension: ext,
        size: stat.size,
        lastModified: stat.mtime,
        thumbnail: path.relative(process.cwd(), thumbnailPath).replace(/\\/g, '/'), // ใช้ path แบบ web
      });

      console.log(`🎬 Found: ${fullPath}`);
      found = true;
    } catch (err) {
      console.warn(`⚠️ Cannot process video: ${fullPath}`, (err as Error).message);
    }
  }

  return new Promise((resolve, reject) => {
    dirProc.on('close', (code) => {
      if (!found && stderrLines.length === 0) {
        console.warn('📭 No video files found.');
      }

      if (code !== 0 && stderrLines.length > 0) {
        reject(new Error(`dir exited with code ${code}: ${stderrLines.join('\n')}`));
      } else {
        resolve(results);
      }
    });
  });
}
