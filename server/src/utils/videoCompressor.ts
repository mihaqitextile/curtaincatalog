import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * 压缩视频文件
 * @param inputPath 输入视频路径
 * @param outputPath 输出视频路径
 * @param options 压缩选项
 * @returns Promise<string> 压缩后的视频路径
 */
export const compressVideo = (
  inputPath: string,
  outputPath: string,
  options: {
    width?: number;
    height?: number;
    bitrate?: string;
    fps?: number;
    format?: string;
  } = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 默认压缩选项
    const defaultOptions = {
      width: 1280,
      height: 720,
      bitrate: "1000k",
      fps: 30,
      format: "mp4",
    };

    const finalOptions = { ...defaultOptions, ...options };

    // 构建ffmpeg命令
    let command = ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${finalOptions.width}:${finalOptions.height}`,
        `-b:v ${finalOptions.bitrate}`,
        `-r ${finalOptions.fps}`,
        "-c:v libx264", // 使用H.264编码
        "-preset medium", // 压缩速度和质量的平衡
        "-c:a aac", // 音频编码
        "-b:a 128k", // 音频比特率
        "-movflags +faststart", // 优化网络播放
      ])
      .output(outputPath);

    // 执行压缩
    command
      .on("end", () => {
        console.log(`视频压缩完成: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("视频压缩失败:", err);
        reject(err);
      })
      .run();
  });
};

/**
 * 获取视频信息
 * @param videoPath 视频文件路径
 * @returns Promise<{width: number, height: number, duration: number, size: number}>
 */
export const getVideoInfo = (
  videoPath: string
): Promise<{
  width: number;
  height: number;
  duration: number;
  size: number;
}> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );

      if (!videoStream) {
        reject(new Error("未找到视频流"));
        return;
      }

      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: metadata.format.duration || 0,
        size: metadata.format.size || 0,
      });
    });
  });
};
