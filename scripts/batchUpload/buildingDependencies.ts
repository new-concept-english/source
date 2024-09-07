export { default as volume1 } from '../../output/1';
export { default as volume2 } from '../../output/2';
export { default as volume3 } from '../../output/3';
export { default as volume4 } from '../../output/4';
export { version } from '../../package.json';

/**
 * 每节课的正文部分结构
 *
 * @export
 * @interface Text
 */
export interface Text {
  /**
   * 第几课
   *
   * @type {string}
   * @memberof Text
   */
  lesson: string;
  /**
   * 标题
   *
   * @type {string}
   * @memberof Text
   */
  title: string;
  /**
   * 描述，包含中文和英语，固定为[英语，中文]的顺序
   *
   * @type {string[]}
   * @memberof Text
   */
  introduction: string[];
  /**
   * 正文 + 翻译结合
   *
   * @type {TextAndTranslation[]}
   * @memberof Text
   */
  text_and_translation: TextAndTranslation[];
  /**
   * 课文注解，对于每节课会出一些额外提示
   *
   * @type {Note[]}
   * @memberof Text
   */
  notes: Note[];
  /**
   * 每节课的新词
   *
   * @type {Vocabulary[]}
   * @memberof Text
   */
  vocabulary: Vocabulary[];
}

export interface TextAndTranslation {
  text: string;
  translation: string;
}

export interface Note {
  title: string;
  describe: string;
}

export interface Vocabulary {
  word: string;
  pronunciation: string;
  type: string;
  definition: string;
}
