import type { Lesson } from './index';

const ALTERNATIVE_IDENTIFIER = `ALTERNATIVE_CONTENT`;

const content = `
const list = ${ALTERNATIVE_IDENTIFIER};

export default list.reduce(
  (obj, next) => {
    obj[next.additional.lesson] = next;
    return obj;
  },
  {} as Record<string, (typeof list)[number]>,
);
`;
/**
 * 这样大费周章的原因是ts对生成的{a:XX}结构会占用大量的d.ts文件
 * 没有办法只能通过这种写法规避一下，最终再生成对象
 * https://github.com/microsoft/TypeScript/issues/44044
 * @param str
 * @returns
 */
export const generatedContent = (obj: Record<string, Lesson>) => {
  return content.replace(
    ALTERNATIVE_IDENTIFIER,
    JSON.stringify(
      Object.values(obj).sort((a, b) => {
        return a.additional.lesson - b.additional.lesson;
      }),
      null,
      2,
    ),
  );
};
