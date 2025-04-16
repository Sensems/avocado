import { message } from 'antd';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { full as emoji } from 'markdown-it-emoji';
import katex from 'markdown-it-katex';
import linkAttributes from 'markdown-it-link-attributes';
import mark from 'markdown-it-mark';
import multimdTable from 'markdown-it-multimd-table';
import taskLists from 'markdown-it-task-lists';
import deflist from "markdown-it-deflist";
import abbr from "markdown-it-abbr";
import footnote from "markdown-it-footnote";
import ins from "markdown-it-ins";
import container from "markdown-it-container";
import toc from "markdown-it-toc-done-right";
import copy from "markdown-it-code-copy";

// 创建markdown解析器实例
const markdowmRender = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><span class="code-header">${lang}</span><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch (__) { }
    }
    return `<pre class="hljs"><code>${markdowmRender.utils.escapeHtml(str)}</code></pre>`;
  }
}).use(emoji)
  .use(katex)
  .use(linkAttributes, {
    matcher: (link: string): boolean => /^https?:\/\//.test(link),
    attrs: {
      target: '_blank',
      rel: 'noopener',
    },
  })
  .use(mark)
  .use(multimdTable)
  .use(taskLists)
  .use(deflist)
  .use(abbr)
  .use(footnote)
  .use(ins)
  .use(container, "spoiler", {
    render: function (tokens: any, idx: number): string {
      var token = tokens[idx];
      if (token.nesting === 1) {
        return '<details><summary>' + token.info.trim() + '</summary>\n';
      }
      return '</details>\n';
    }
  })
  .use(toc)
  .use(copy, {
    buttonClass: 'copy-button',
    element: '复制',
    iconStyle: 'font-size: 12px;color: #f1f1f1;',
    buttonStyle: 'border: none;background-color: transparent;position: absolute; top: 0px; right: 10px; cursor: pointer; outline: none',
    onSuccess: () => {
      message.info('复制成功');
    }
  });



export default markdowmRender;