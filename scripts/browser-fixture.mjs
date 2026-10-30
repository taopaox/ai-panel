// Deterministic desktop acceptance pages. Bind loopback only; no real accounts.
import { createServer } from 'node:http';
const port = 17853;
createServer((request, response) => {
  const path = new URL(request.url, `http://localhost:${port}`).pathname;
  const article = path.startsWith('/article');
  const login = path === '/login';
  const title = login ? '登录回跳测试' : article ? `浏览文章 ${path.split('/').pop()}` : '浏览验收首页';
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${title}</title>
  <style>body{font:18px system-ui;padding:32px;line-height:1.8}a{display:block}input{font:inherit;width:80%}</style>
  <h1>${title}</h1><p>查找样本：星河。第二处星河。跨元素：<b>星</b><span>河</span>。</p>
  <p hidden>星河隐藏文本不应命中</p>
  <label>保留输入 <input placeholder="输入后打开文章，返回检查内容" /></label>
  <a href="http://127.0.0.1:${port}/article/one">外链：文章一（普通链接）</a>
  <a target="_blank" href="http://127.0.0.1:${port}/article/two">新标签：文章二</a>
  <a target="_blank" href="http://localhost:${port}/article/child">新标签：来源链子文章</a>
  <a target="_blank" href="http://localhost:${port}/login">模拟登录（当前页）</a>
  <a href="/next">站内导航</a><a href="/">返回首页</a>
  ${Array.from({length:8},(_,i)=>`<a target="_blank" href="http://127.0.0.1:${port}/article/limit-${i}">满额测试 ${i+1}</a>`).join('')}
  </html>`);
}).listen(port, '0.0.0.0', () => {
  console.log(`在 AiPanel 添加测试服务：http://localhost:${port}`);
});
