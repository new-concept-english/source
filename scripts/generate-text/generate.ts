/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { setTimeout } from 'node:timers/promises';
import { JSONFilePreset } from 'lowdb/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(__filename, '../');

const addBook = (name: string) => {
  return path.join(process.cwd(), `assets/books/${name}`);
};

const books = {
  one: addBook(`新概念英语1 英语初阶.docx`),
  two: addBook(`新概念英语2 实践与进步.docx`),
  three: addBook(`新概念英语3 培养技能.docx`),
  four: addBook(`新概念英语4 流利英语.docx`),
};

interface FileCatchsValues {
  content: string;
  catch: {
    role: string;
    content: string;
  }[];
}

type FileCatchs = Partial<Record<bookKeys, FileCatchsValues>>;

const fileCatchs = await JSONFilePreset<FileCatchs>(
  path.join(__dirname, '.catch.json'),
  {},
);

type bookKeys = keyof typeof books;

const modelEssay = fs.readFileSync(
  path.join(process.cwd(), 'scripts/generate-text/content.txt'),
  'utf-8',
);

interface CatchProps {
  name: string;
  content: string;
}
/*
 * 创建catch tag，防止重复上传文件
 */
export const createCacheTag = async ({ name, content }: CatchProps) => {
  // 当启用缓存（即 cache_tag 有值时），我们通过 HTTP 接口创建缓存，缓存的内容则是前文中通过文件上传
  // 和抽取接口生成的 messages 内容，我们为这些缓存设置一个默认的有效期 300 秒（通过 ttl 字段），并
  // 为这个缓存打上标记，标记值为 cache_tag（通过 tags 字段）。

  const resetTtl = 60000000;
  const r = await axios.post(
    `${client.baseURL}/caching`,
    {
      model: 'moonshot-v1',
      messages: [
        {
          role: 'system',
          content: content,
        },
      ],
      ttl: resetTtl,
      tags: [name],
    },
    {
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
      },
    },
  );

  if (r.status != 200) {
    throw new Error(r.data);
  }

  return [
    {
      role: 'cache' as const,
      content: `tag=${name};reset_ttl=${resetTtl}`,
    },
  ];
};

const client = new OpenAI({
  apiKey: 'sk-g3TokrnhyusCMRMpA9Lt9GQqd5GE8H29OdMEEmbgjGFfB5Th',
  baseURL: 'https://api.moonshot.cn/v1',
});

interface Props {
  /*
   * 系列
   */
  series: bookKeys;
  /*
   * 课程
   */
  curriculum: string;
}
export async function generate({ series, curriculum }: Props) {
  // 如果不存在，上传
  if (!fileCatchs.data[series]?.content) {
    const fileObject = await client.files.create({
      file: fs.createReadStream(books[series]),
      purpose: 'file-extract' as any,
    });
    const fileContent = await (
      await client.files.content(fileObject.id)
    ).text();
    await fileCatchs.update((data) => {
      data[series] = {
        catch: [],
        ...data[series],
        content: fileContent,
      };
    });
  }
  const prohibitUploading = true;
  // if (!fileCatchs.data[series]?.catch.length) {
  //   const content = fileCatchs.data[series]?.content || '';

  //   try {
  //     const r = await createCacheTag({
  //       name: `新概念${series}`,
  //       content,
  //     });

  //     await fileCatchs.update((data) => {
  //       data[series] = {
  //         ...data[series]!,
  //         catch: r,
  //       };
  //     });
  //   } catch (e) {
  //     if (
  //       e instanceof AxiosError &&
  //       e.response?.data?.error?.type === 'permission_denied_error'
  //     ) {
  //       prohibitUploading = true;
  //     }
  //   }
  // }

  let fileMessages = fileCatchs.data[series]?.catch || [];
  /*
   * 如果禁止使用缓存的话就直接调用正常形式
   */
  if (prohibitUploading) {
    fileMessages = [
      {
        role: 'system',
        content: fileCatchs.data[series]?.content || '',
      },
    ];
  }

  const chat = async (retryCount = 0) => {
    try {
      const completion = await client.chat.completions.create({
        model: 'moonshot-v1-auto',
        messages: [
          ...(fileMessages as any[]),
          {
            role: 'system',
            content:
              '你是 su是人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。',
          },
          {
            role: 'system',
            content: modelEssay,
          },

          {
            role: 'user',
            content: `现在帮我处理${curriculum}课内容`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      const result = completion.choices[0].message.content;

      return result;
    } catch (e: any) {
      if (retryCount >= 5) {
        console.error(`已达到最高重试次数`);
        throw e;
      }

      if (e.status === 429) {
        console.log(
          `出现错误，当前准备重试，重试次数为 ${retryCount}，status：${e.status}`,
        );
        // 60s后重试
        await setTimeout(1000 * 60);
        return chat(retryCount + 1);
      }
      throw e;
    }
  };

  return await chat();
}
