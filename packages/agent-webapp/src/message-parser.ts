import { type HTMLTemplateResult, html } from 'lit';
import { AIChatMessage } from '@microsoft/ai-chat-protocol';

export type ParsedMessage = {
  html: HTMLTemplateResult;
  citations: string[];
  followupQuestions: string[];
  role: string;
  context?: object;
};

export function parseMessageIntoHtml(message: AIChatMessage): ParsedMessage {
  if (message.role === 'user') {
    return {
      html: html`${message.content}`,
      citations: [],
      followupQuestions: [],
      role: message.role,
      context: message.context,
    };
  }

  const citations: string[] = [];
  const followupQuestions: string[] = [];

  // Extract any follow-up questions that might be in the message
  const text = message.content
    .replaceAll(/<<([^>]+)>>/g, (_match, content: string) => {
      followupQuestions.push(content);
      return '';
    })
    .split('<<')[0] // Truncate incomplete questions
    .trim();

  // Extract any citations that might be in the message
  const result = html`${text}`;

  return {
    html: result,
    citations,
    followupQuestions,
    role: message.role,
    context: message.context,
  };
}
