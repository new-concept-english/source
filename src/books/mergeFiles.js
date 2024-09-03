/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const marker = '// new lesson kimi\n';

async function processFiles(targetDir) {
  const outputFile = path.join(targetDir, 'output.txt');
  // 读取当前目录下的所有文件
  const files = fs
    .readdirSync(targetDir)
    .filter((file) => /\.txt/i.test(path.extname(file)) && file !== outputFile)
    .sort((a, b) => {
      return Number.parseFloat(a) - Number.parseFloat(b);
    });

  // 清空或创建输出文件
  fs.writeFileSync(outputFile, '', 'utf8');

  files.forEach((file, index) => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const isEnd = index === files.length - 1;
    // 添加标识符并追加到输出文件
    fs.appendFileSync(
      outputFile,
      content + (isEnd ? '' : `${marker + '\n\n'}`),
      'utf8',
    );
  });

  console.log(`处理完成，内容已输出到 ${outputFile}`);
}

Promise.all(
  ['1', '2', '3', '4']
    .map((f) => path.join(__dirname, f))
    .map((f) => processFiles(f)),
);
