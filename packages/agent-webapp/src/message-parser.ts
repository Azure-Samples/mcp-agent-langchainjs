import { type HTMLTemplateResult, html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { type AIChatMessage } from '@microsoft/ai-chat-protocol';

export type ParsedMessage = {
  content: string;
  html: HTMLTemplateResult;
  followupQuestions: string[];
  role: string;
  context?: object;
};

export function parseMessageIntoHtml(message: AIChatMessage, enableMarkdown = true): ParsedMessage {
  if (message.role === 'user') {
    return {
      content: message.content,
      html: html`${message.content}`,
      followupQuestions: [],
      role: message.role,
      context: message.context,
    };
  }

  const followupQuestions: string[] = [];

  // Extract any follow-up questions that might be in the message
  const text = message.content
    .replaceAll(/<<([^>]+)>>/g, (_match, content: string) => {
      followupQuestions.push(content);
      return '';
    })
    .split('<<')[0] // Truncate incomplete questions
    .trim();

  let result;
  if (enableMarkdown) {
    // Render markdown after sanitizing
    const md = marked.parse(text, { async: false, gfm: true }) as string;
    const safe = DOMPurify.sanitize(md, { USE_PROFILES: { html: true } });
    result = html`${unsafeHTML(safe)}`;
  } else {
    result =  html`${text}`;
  }

  return {
    content: text,
    html: result,
    followupQuestions,
    role: message.role,
    context: message.context,
  };
}
