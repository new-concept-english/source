/*
 * 作用就是扫描assets目录下的资源文件，之后上传到图床
 */

import { glob } from 'glob';
import { createdMd5, groupBy, runParallel } from './utils';
import path from 'node:path';
import { JSONFilePreset } from 'lowdb/node';
import axios, { AxiosError } from 'axios';
import { fileFromPath } from 'formdata-node/file-from-path';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

/*
 * 缓存数据库
 */
export type Hashcatch = Record<string, Omit<Interface, 'base64'>>;

const hashcatchPath = path.join(process.cwd(), 'scripts/hashcatch.json');

const hashcatchDb = await JSONFilePreset<Hashcatch>(hashcatchPath, {});

const require = createRequire(import.meta.url);

const { name } = require('../package.json');

const dir = './assets';

const files = await glob('**/*', {
  ignore: ['pdf/**/*', 'books/**/*'],
  cwd: dir,
  nodir: true,
});

export interface Base {
  path: string;
  fileName: string;
  abbreviatedPath: string;
  md5: string;
  volume: string;
  lesson: string;
  interface?: Interface;
}

const md5 = await Promise.all(
  files.map(async (f): Promise<Base> => {
    const p = path.join(dir, f);
    const md5 = await createdMd5(p);
    const nameFile = path.relative(path.join(dir, 'program-data'), p);
    const [volume, lesson] = nameFile.split(path.sep);

    return {
      path: p,
      abbreviatedPath: nameFile,
      md5,
      fileName: path.parse(p).base,
      volume,
      lesson,
      interface: hashcatchDb.data[md5],
    };
  }),
);

export interface Interface {
  id: number;
  fileName: string;
  time: string;
  url: string;
  uid: string;
  base64?: string;
  contentType: string;
  shareCode: null | string;
  shareExpireDate: null | string;
  size: string;
}

/*
 * 找出差异性数据，然后进行文件上传
 */

const difference = md5.filter((current) => !hashcatchDb.data[current.md5]);

if (!difference.length) {
  console.warn(`无新变更文件。`);
  process.exit(0);
}

// 写入等待数组
const writeWaitingArray: unknown[] = [];

await runParallel(difference, {
  maxConcurrency: 5,
  waitingTime: 1000,
  iteratorFn(item, index, total) {
    return upload(item).then((res) => {
      console.log(`执行任务进度： ${index}/${total}`);
      writeWaitingArray.push(
        hashcatchDb.update((data) => {
          // 不要包含base64，文件太大了。
          delete res.base64;
          data[item.md5] = res;
        }),
      );
      return res;
    });
  },
});

await Promise.all(writeWaitingArray);

/*
 * 找出所有课程系列
 */

const volumeAll = groupBy(md5, (item) => item.volume);

await Promise.all(
  Object.entries(volumeAll).map(([key, value]) => {
    return writeFile(
      path.join(process.cwd(), 'output', `${key}.json`),
      JSON.stringify(value, null, 2),
    );
  }),
);
console.log(`写入课程完成`);

async function upload(file: Base) {
  const form = new FormData();
  form.append('fileName', file.fileName);
  form.append('file', await fileFromPath(file.path));
  form.append('uid', name);

  try {
    const { data } = await axios.post<Interface>(
      `https://playground.z.wiki/img/upload`,
      form,
    );

    return data;
  } catch (e) {
    if (e instanceof AxiosError) {
      throw {
        message: e.message,
        data: e.response?.data,
        status: e.response?.status,
        statusText: e.response?.statusText,
        config: e.config,
      };
    }
    throw e;
  }
}
