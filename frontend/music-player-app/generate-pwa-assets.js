/**
 * 生成PWA图标和资源
 * 这个脚本会根据favicon创建不同尺寸的图标，用于PWA
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径（ES模块中没有__dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 图标尺寸
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// 源图标和输出目录
const SOURCE_ICON = path.join(__dirname, 'public', 'favicon.ico');
const OUTPUT_DIR = path.join(__dirname, 'public', 'icons');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`创建目录: ${OUTPUT_DIR}`);
}

async function generateIcons() {
  try {
    // 读取源图标
    console.log(`读取源图标: ${SOURCE_ICON}`);

    // 生成不同尺寸的图标
    for (const size of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

      await sharp(SOURCE_ICON)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`生成图标: ${outputPath}`);
    }

    console.log('所有PWA图标生成完成!');
  } catch (error) {
    console.error('生成PWA图标时出错:', error);
    process.exit(1);
  }
}

generateIcons(); 