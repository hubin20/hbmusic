import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 优化图片 - 压缩并生成WebP格式
 * @param {string} inputPath - 输入图片路径
 * @returns {Promise<{jpg: string, webp: string} | null>} - 返回压缩后的JPG和WebP文件路径, 或null如果失败
 */
async function optimizeImage(inputPath) {
  try {
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath, path.extname(inputPath));

    // 如果文件名已包含 -compressed，则跳过，除非它是原始文件名（不太可能）
    if (filename.endsWith('-compressed')) {
      console.log(`跳过已压缩文件: ${path.basename(inputPath)}`);
      return null;
    }

    const outputJpgPath = path.join(dir, `${filename}-compressed.jpg`);
    const outputWebpPath = path.join(dir, `${filename}.webp`);

    // 压缩JPG图片
    await sharp(inputPath)
      .resize(1920, null, { withoutEnlargement: true }) // 最大宽度为1920像素，保持纵横比
      .jpeg({
        quality: 80,     // 质量80%
        progressive: true // 使用渐进式JPEG
      })
      .toFile(outputJpgPath);

    // 转换为WebP格式
    await sharp(inputPath)
      .resize(1920, null, { withoutEnlargement: true }) // 最大宽度为1920像素，保持纵横比
      .webp({
        quality: 80, // 质量80%
        effort: 6    // 压缩努力程度 (0-6)
      })
      .toFile(outputWebpPath);

    const originalSize = fs.statSync(inputPath).size;
    const jpgSize = fs.statSync(outputJpgPath).size;
    const webpSize = fs.statSync(outputWebpPath).size;

    console.log(`优化完成: ${path.basename(inputPath)}`);
    console.log(`  原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  JPG大小: ${(jpgSize / 1024 / 1024).toFixed(2)} MB (${((1 - jpgSize / originalSize) * 100).toFixed(2)}% 压缩率)`);
    console.log(`  WebP大小: ${(webpSize / 1024 / 1024).toFixed(2)} MB (${((1 - webpSize / originalSize) * 100).toFixed(2)}% 压缩率)`);

    return { jpg: outputJpgPath, webp: outputWebpPath };
  } catch (error) {
    console.error(`处理图片 ${inputPath} 失败:`, error);
    return null;
  }
}

/**
 * 批量处理图片
 */
async function processAllImages() {
  try {
    const imagesBaseDir = path.join(__dirname, 'src/assets/images');

    if (!fs.existsSync(imagesBaseDir)) {
      console.error('基础图片目录不存在:', imagesBaseDir);
      return;
    }

    // 查找所有jpg、jpeg和png图片，排除 *-compressed.jpg
    const imageFiles = await glob('**/*.{jpg,jpeg,png}', {
      cwd: imagesBaseDir,
      ignore: '**/*-compressed.jpg' // 忽略已压缩的JPG文件
    });

    if (imageFiles.length === 0) {
      console.log('未找到需要处理的图片');
      return;
    }

    console.log(`找到 ${imageFiles.length} 张图片需要处理:`);
    imageFiles.forEach(file => console.log(`  - ${file}`));

    for (const file of imageFiles) {
      const inputPath = path.join(imagesBaseDir, file);
      await optimizeImage(inputPath);
    }

    console.log('\n所有图片处理完成!');
  } catch (error) {
    console.error('处理图片时出错:', error);
  }
}

processAllImages(); 