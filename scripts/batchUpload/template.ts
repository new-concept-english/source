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
export const generatedContent = (arr: Array<unknown>) => {
  return content.replace(ALTERNATIVE_IDENTIFIER, JSON.stringify(arr, null, 2));
};
