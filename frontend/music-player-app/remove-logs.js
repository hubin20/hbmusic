import fs from 'fs';
const filePath = './src/stores/player.js';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/console\.log\(`\[PlayerStore\] _formatFallbackApiSong: 使用API返回的直接URL.*?\);/g, '');
content = content.replace(/console\.log\(`\[PlayerStore\] _fetchKwSongDetailsByRid: 使用API返回的直接URL.*?\);/g, '');
fs.writeFileSync(filePath, content, 'utf8');
console.log('日志删除完成');