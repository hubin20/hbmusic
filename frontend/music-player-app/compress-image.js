import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 压缩图片并生成WebP格式
 */
async function compressImage() {
  try {
    const inputPath = path.join(__dirname, 'src/assets/images/bz1.jpg');
    const outputJpgPath = path.join(__dirname, 'src/assets/images/bz1-compressed.jpg');
    const outputWebpPath = path.join(__dirname, 'src/assets/images/bz1.webp');

    // 检查文件是否存在
    if (!fs.existsSync(inputPath)) {
      console.error('输入文件不存在:', inputPath);
      return;
    }

    console.log('开始压缩图片...');

    // 压缩JPG图片
    await sharp(inputPath)
      .resize(1920) // 最大宽度为1920像素
      .jpeg({
        quality: 80,     // 质量80%
        progressive: true // 使用渐进式JPEG
      })
      .toFile(outputJpgPath);

    console.log('JPG压缩完成:', outputJpgPath);

    // 转换为WebP格式
    await sharp(inputPath)
      .resize(1920) // 最大宽度为1920像素
      .webp({
        quality: 80, // 质量80%
        effort: 6    // 压缩努力程度 (0-6)
      })
      .toFile(outputWebpPath);

    console.log('WebP转换完成:', outputWebpPath);

    // 获取文件大小
    const originalSize = fs.statSync(inputPath).size;
    const jpgSize = fs.statSync(outputJpgPath).size;
    const webpSize = fs.statSync(outputWebpPath).size;

    console.log('原始文件大小:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('压缩JPG大小:', (jpgSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('WebP文件大小:', (webpSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('JPG压缩率:', ((1 - jpgSize / originalSize) * 100).toFixed(2), '%');
    console.log('WebP压缩率:', ((1 - webpSize / originalSize) * 100).toFixed(2), '%');

  } catch (error) {
    console.error('图片处理失败:', error);
  }
}

compressImage(); 