export type IntermediateStep = {
  type: 'tool' | 'llm';
  name: string;
  input?: string;
  output?: string;
}
