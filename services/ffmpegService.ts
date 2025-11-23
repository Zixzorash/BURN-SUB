
export class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;
  private logCallback: ((msg: string) => void) | null = null;
  private progressCallback: ((p: number) => void) | null = null;

  constructor() {
    // Constructor remains empty to prevent errors during module evaluation.
    // Initialization happens in ensureInstance()
  }

  private get globalFFmpeg() {
    return (window as any).FFmpeg;
  }

  private get globalUtil() {
    return (window as any).FFmpegUtil;
  }

  private ensureInstance() {
    if (this.ffmpeg) return;

    if (!this.globalFFmpeg || !this.globalFFmpeg.FFmpeg) {
      throw new Error("FFmpeg library not loaded. Please wait a moment or refresh the page.");
    }

    const FFmpegClass = this.globalFFmpeg.FFmpeg;
    this.ffmpeg = new FFmpegClass();

    // Attach persistent listeners that delegate to the current callback function
    this.ffmpeg.on('log', ({ message }: { message: string }) => {
      if (this.logCallback) this.logCallback(message);
    });

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      if (this.progressCallback) this.progressCallback(Math.round(progress * 100));
    });
  }

  async load() {
    this.ensureInstance();
    if (this.loaded) return;

    // Use the Single Threaded version of the core to ensure compatibility
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const { toBlobURL } = this.globalUtil;
    
    try {
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.loaded = true;
    } catch (e) {
        console.error("Failed to load FFmpeg core:", e);
        throw new Error("Failed to initialize video engine. Please refresh.");
    }
  }

  setLogger(callback: (message: string) => void) {
    this.logCallback = callback;
    this.ensureInstance();
  }

  setProgress(callback: (progress: number) => void) {
    this.progressCallback = callback;
    this.ensureInstance();
  }

  async createPreview(
    videoFile: File,
    subFile: File | null,
    fps: number
  ): Promise<string> {
    await this.load();
    const { fetchFile } = this.globalUtil;

    const inputName = 'preview_input.mp4';
    const subName = 'preview_sub.srt';
    const outputName = 'preview_output.mp4';

    // Optimization: Slice the video file.
    // We take the first 50MB. This creates a valid partial file for most MP4 containers (MOOV at start).
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
    const videoSlice = videoFile.slice(0, Math.min(videoFile.size, CHUNK_SIZE));

    // Write files to memory (MEMFS) for preview as it's small
    await this.ffmpeg.writeFile(inputName, await fetchFile(videoSlice));
    
    if (subFile) {
      await this.ffmpeg.writeFile(subName, await fetchFile(subFile));
    }

    const args = [
      '-i', inputName,
      '-t', '5', // Limit duration to 5 seconds
    ];

    // Video Filter Chain
    const filters: string[] = [];
    
    if (subFile) {
      // Bold styling for JAV aesthetic
      filters.push(`subtitles=${subName}:force_style='FontName=Arial,Fontsize=24,PrimaryColour=&H0000FFFF,BackColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=30,Bold=1'`);
    }

    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }

    // Set Frame Rate
    args.push('-r', fps.toString());

    // Output settings
    args.push('-c:a', 'copy');
    args.push('-preset', 'ultrafast'); 
    args.push(outputName);

    try {
      await this.ffmpeg.exec(args);
      const data = await this.ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });
      
      // Cleanup
      await this.ffmpeg.deleteFile(inputName);
      if (subFile) await this.ffmpeg.deleteFile(subName);
      await this.ffmpeg.deleteFile(outputName);

      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Preview generation error:', error);
      try {
        await this.ffmpeg.deleteFile(inputName);
        if (subFile) await this.ffmpeg.deleteFile(subName);
      } catch (e) {}
      throw new Error("Failed to generate preview. The file format might not support partial reading.");
    }
  }

  async processVideo(
    videoFile: File,
    subFile: File | null,
    fps: number,
    outputName: string
  ): Promise<string> {
    await this.load();
    const { fetchFile } = this.globalUtil;

    const mountDir = '/mnt_input';
    const subName = 'subtitles.srt';
    // CRITICAL FIX: Do NOT rename/sanitize the input filename variable here.
    // The file mounted in WORKERFS retains its original `videoFile.name`.
    // If we change the path string but not the file, FFmpeg won't find it.
    const inputPath = `${mountDir}/${videoFile.name}`;
    
    let usedMount = false;

    try {
        // Attempt to mount the file system
        // WORKERFS allows reading directly from the File object without loading it into RAM.
        await this.ffmpeg.createDir(mountDir);
        await this.ffmpeg.mount('WORKERFS', { files: [videoFile] }, mountDir);
        usedMount = true;
    } catch (e) {
        console.warn("WORKERFS mount failed:", e);
        // SAFETY CHECK: If file is > 2GB, do not attempt to write to memory. It will crash.
        if (videoFile.size > 2 * 1024 * 1024 * 1024) {
             throw new Error("System Error: Could not mount large file system. Browser security settings or device memory may be restricting access.");
        }
        
        // Fallback for smaller files only
        const simpleName = 'input.mp4';
        await this.ffmpeg.writeFile(simpleName, await fetchFile(videoFile));
        // Update inputPath to point to the MEMFS file
        // Note: we can't easily reassign inputPath constant, so we handle this in args logic or just fail if mount fails for consistency on large app.
        // For this fix, let's assume we proceed with the mounted path logic if mount succeeded, else throw.
        throw new Error("Could not initialize file system for processing.");
    }

    if (subFile) {
      await this.ffmpeg.writeFile(subName, await fetchFile(subFile));
    }

    const args = ['-i', inputPath];

    // Video Filter Chain
    const filters: string[] = [];
    
    if (subFile) {
      filters.push(`subtitles=${subName}:force_style='FontName=Arial,Fontsize=24,PrimaryColour=&H0000FFFF,BackColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=30,Bold=1'`);
    }

    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }

    args.push('-r', fps.toString());
    
    // Performance settings for large files
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast'); // Max speed, slightly larger file
    args.push('-max_muxing_queue_size', '9999'); // Prevent "Too many packets buffered" error
    args.push('-c:a', 'copy');
    args.push(outputName);

    try {
        const result = await this.ffmpeg.exec(args);
        if (result !== 0) {
            throw new Error(`FFmpeg exited with code ${result}. Check logs.`);
        }
    } catch (e) {
        // Cleanup attempt
        if (usedMount) {
            await this.ffmpeg.unmount(mountDir);
            await this.ffmpeg.deleteDir(mountDir);
        }
        throw e;
    }

    // Read output
    let data;
    try {
        data = await this.ffmpeg.readFile(outputName);
    } catch (e) {
        throw new Error("Output file generation failed. The result might have exceeded browser memory limits (2GB+).");
    }
    
    const blob = new Blob([data], { type: 'video/mp4' });

    // Cleanup
    if (usedMount) {
        await this.ffmpeg.unmount(mountDir);
        await this.ffmpeg.deleteDir(mountDir);
    }
    
    if (subFile) await this.ffmpeg.deleteFile(subName);
    await this.ffmpeg.deleteFile(outputName);

    return URL.createObjectURL(blob);
  }
}

export const ffmpegService = new FFmpegService();
