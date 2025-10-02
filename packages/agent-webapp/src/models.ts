export type AIChatRole = "user" | "assistant" | "system";

export type AIChatContext = Record<string, any>;

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
  context?: AIChatContext;
}

export type AIChatMessageDelta = {
  role?: AIChatRole;
  content?: string;
  context?: AIChatContext;
}

export type AIChatCompletion = {
  message: AIChatMessage;
  context?: AIChatContext;
}

export type AIChatCompletionDelta = {
  delta: AIChatMessageDelta;
  context?: AIChatContext;
}
