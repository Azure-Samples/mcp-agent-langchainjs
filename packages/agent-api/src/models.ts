export type AgentStep = {
  type: 'tool' | 'llm';
  name: string;
  input?: string;
  output?: string;
};

export type AIChatRole = 'user' | 'assistant' | 'system';

export type AIChatContext = {
  currentStep?: AgentStep;
  intermediateSteps?: AgentStep[];
};

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
  context?: AIChatContext;
};

export type AIChatMessageDelta = {
  role?: AIChatRole;
  content?: string;
  context?: AIChatContext;
};

export type AIChatCompletionDelta = {
  delta: AIChatMessageDelta;
  context?: {
    sessionId?: string;
  };
};

export type AIChatCompletionRequest = {
  messages: AIChatMessage[];
  context?: AIChatContext;
};
