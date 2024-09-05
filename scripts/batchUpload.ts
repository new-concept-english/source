/*
 * 作用就是扫描assets目录下的资源文件，之后上传到图床
 */

import { glob } from 'glob';
import { createdMd5, createEStemplate, groupBy, runParallel } from './utils';
import path from 'node:path';
import { JSONFilePreset } from 'lowdb/node';
import axios, { AxiosError } from 'axios';
import { fileFromPath } from 'formdata-node/file-from-path';
import { createRequire } from 'node:module';
import fs from 'fs-extra';

const require = createRequire(import.meta.url);

/*
 * 缓存数据库
 */
export type Hashcatch = Record<string, Omit<Interface, 'base64'>>;

const hashcatchPath = path.join(process.cwd(), 'scripts/hashcatch.json');

const hashcatchDb = await JSONFilePreset<Hashcatch>(hashcatchPath, {});
const uid = `@new-concept-english/source`;

// const { name } = require('../package.json');

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
  // process.exit(0);
}

// 写入等待数组
const writeWaitingArray: unknown[] = [];

await runParallel(difference, {
  maxConcurrency: 4,
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

export interface Type {
  lrc: Base;
  mp3: Base;
}

type Additional = Pick<Base, 'md5'> & { lesson: number; title: string };

export interface Lesson {
  /* 英音 */
  tapeEnglish: Type;
  /* 美音 */
  tapeAmericanMusic: Type;
  /* 插图 */
  illustration: unknown;
  /* 课文 */
  text: Base;
  /*
   * 还需要包含一些附加信息
   */
  additional: Additional;
}

/*
 * 构建的时候清理之前文件
 */
await fs.remove(path.join(process.cwd(), 'output'));

await Promise.all(
  Object.entries(volumeAll).map(([key, value]) => {
    /*
     * 对课本也要进行分类，否则会出现太拥挤情况
     */
    const lesson = groupBy(value, (item) => item.lesson);
    /*
     * 对每一课也要进行分类，分为插图、音频、课文等
     */
    const content = Object.entries(lesson).reduce(
      (obj, [key, value]) => {
        const lessonNumber = +(key.match(/\d+/)?.[0] || 1);
        const c = value.reduce((o, v) => {
          const { dir, ext } = path.parse(v.path);
          switch (ext) {
            case '.json':
              o['text'] = v;
              o.additional = {
                md5: v.md5,
                lesson: lessonNumber,
                title: require(path.join(process.cwd(), v.path))?.title,
              };

              break;
            case '.mp3':
            case '.lrc': {
              const key: keyof Lesson = dir.endsWith(`tape-english`)
                ? 'tapeEnglish'
                : 'tapeAmericanMusic';

              const isMp3 = ext === '.mp3';
              o[key] = Object.assign({}, o[key], {
                [isMp3 ? 'mp3' : 'lrc']: v,
              });

              break;
            }
          }
          return o;
        }, {} as Lesson);
        obj[lessonNumber] = c;
        return obj;
      },
      {} as Record<string, Lesson>,
    );

    return fs.outputFile(
      path.join(process.cwd(), 'output', `${key}.ts`),
      createEStemplate(JSON.stringify(content, null, 2)),
    );
  }),
);
console.log(`写入课程完成`);

async function upload(file: Base) {
  const form = new FormData();
  form.append('fileName', file.fileName);
  form.append('file', await fileFromPath(file.path));
  form.append('uid', uid);
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
