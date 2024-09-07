import fs from 'node:fs';
import crypto from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

/**
 * 根据文件内容生成唯一的hash
 * @param filePath
 * @returns
 */
export const createdMd5 = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

interface RunParallelProps<T, U> {
  maxConcurrency: number;
  iteratorFn: (item: T, index: number, total: number) => U;
  // 等待时间
  waitingTime?: number;
}

export async function runParallel<T, U>(
  source: T[],
  options: RunParallelProps<T, U>,
) {
  const total = source.length;
  let index = 0;
  const { maxConcurrency, iteratorFn, waitingTime = 0 } = options;

  const ret: Promise<U>[] = [];

  const executing: unknown[] = [];
  for (const item of source) {
    const p = Promise.resolve()
      .then(() => {
        return iteratorFn(item, index++, total);
      })
      .then(async (res) => {
        await setTimeout(waitingTime);
        return res;
      });

    ret.push(p);

    if (maxConcurrency <= source.length) {
      const e = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

export function groupBy<T, K extends T[keyof T] & (string | number | symbol)>(
  array: T[],
  keyGetter: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (result, item) => {
      const key = keyGetter(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    },
    {} as Record<K, T[]>,
  );
}
