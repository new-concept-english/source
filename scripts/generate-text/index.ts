import { glob } from 'glob';
import path from 'node:path';
import fs from 'fs-extra';
import { generate } from './generate';
import { setTimeout } from 'node:timers/promises';

const cwd = path.join(process.cwd(), 'assets/program-data/1');

/*
 * 过滤掉全部处理过的文件
 */
const dirAll = (
  await glob('./*', {
    cwd,
  })
).filter((f) => {
  return !fs.existsSync(path.join(cwd, f, 'data.json'));
});

/*
 * 使用 kimi 来处理
 * 因为账号比较low，所以限制并发
 */
for (const lesson of dirAll) {
  const outputFile = path.join(cwd, lesson, 'data.json');
  const result = await generate({ series: 'one', curriculum: lesson });
  fs.outputFileSync(outputFile, result || `{}`);
  console.log(`生成 ${lesson} 成功。 path: ${outputFile}`);
  await setTimeout(1000 * 30);
}
