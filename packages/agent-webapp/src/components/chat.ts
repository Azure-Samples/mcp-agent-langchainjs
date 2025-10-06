import { LitElement, css, html, nothing } from 'lit';
import { map } from 'lit/directives/map.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, property, state, query } from 'lit/decorators.js';
import { type ChatRequestOptions, getCompletion } from '../services/api.service.js';
import { AgentStep, type AIChatMessage } from '../models.js';
import { type ParsedMessage, parseMessageIntoHtml } from '../message-parser.js';
import sendSvg from '../../assets/icons/send.svg?raw';
import questionSvg from '../../assets/icons/question.svg?raw';
import newChatSvg from '../../assets/icons/new-chat.svg?raw';
import './debug.js';

export type ChatComponentState = {
  hasError: boolean;
  isLoading: boolean;
  isStreaming: boolean;
};

export type ChatComponentOptions = ChatRequestOptions & {
  apiUrl?: string;
  promptSuggestions: string[];
  enablePromptSuggestions: boolean;
  enableMarkdown?: boolean;
  enableDebug?: boolean;
  minStepDisplayMs?: number;
  strings: {
    promptSuggestionsTitle: string;
    citationsTitle: string;
    followUpQuestionsTitle: string;
    chatInputPlaceholder: string;
    chatInputButtonLabel: string;
    assistant: string;
    user: string;
    errorMessage: string;
    newChatButton: string;
    retryButton: string;
    tools: Record<string, string>;
  };
};

export const chatDefaultOptions: ChatComponentOptions = {
  apiUrl: '',
  enablePromptSuggestions: true,
  enableMarkdown: true,
  enableDebug: true,
  minStepDisplayMs: 1000,
  promptSuggestions: [
    'What burgers do you have on the menu?',
    'What toppings are available?',
    'Order a vegan burger for me',
  ],
  messages: [],
  strings: {
    promptSuggestionsTitle: 'Ask about our burgers or try an example',
    citationsTitle: 'Citations:',
    followUpQuestionsTitle: 'Follow-up questions:',
    chatInputPlaceholder: 'Ask about our burgers, toppings, or place an order...',
    chatInputButtonLabel: 'Send question',
    assistant: 'Burger Assistant',
    user: 'You',
    errorMessage: 'We are currently experiencing an issue.',
    newChatButton: 'New chat',
    retryButton: 'Retry',
    tools: {
      get_burgers: 'Retrieving burgers list',
      get_burger_by_id: 'Retrieving burger details',
      get_toppings: 'Retrieving toppings list',
      get_topping_by_id: 'Retrieving topping details',
      get_topping_categories: 'Retrieving topping categories',
      get_orders: 'Retrieving orders list',
      get_order_by_id: 'Retrieving order details',
      place_order: 'Placing a new order',
      delete_order_by_id: 'Deleting order',
    },
  },
};

/**
 * A chat component that allows the user to ask questions and get answers from an API.
 * The component also displays default prompts that the user can click on to ask a question.
 * The component is built as a custom element that extends LitElement.
 *
 * Labels and other aspects are configurable via the `option` property.
 * @element azc-chat
 * @fires messagesUpdated - Fired when the message thread is updated
 * @fires stateChanged - Fired when the state of the component changes
 * */
@customElement('azc-chat')
export class ChatComponent extends LitElement {
  @property({
    type: Object,
    converter: (value) => ({ ...chatDefaultOptions, ...JSON.parse(value ?? '{}') }),
  })
  options: ChatComponentOptions = chatDefaultOptions;

  @property() question = '';
  @property({ type: Array }) messages: AIChatMessage[] = [];
  @property() userId = '';
  @property() sessionId = '';
  @state() protected hasError = false;
  @state() protected isLoading = false;
  @state() protected isStreaming = false;
  @state() protected currentStep: AgentStep | undefined;
  @query('.chat-container') protected chatContainerElement!: HTMLElement;
  @query('.messages') protected messagesElement!: HTMLElement;
  @query('.chat-input') protected chatInputElement!: HTMLElement;

  protected lastStepSetAt = 0;
  protected stepQueue: AgentStep[] = [];
  protected stepTimer: NodeJS.Timeout | undefined;

  async onSuggestionClicked(suggestion: string) {
    this.question = suggestion;
    await this.onSendClicked();
  }

  onNewChatClicked() {
    this.messages = [];
    this.sessionId = '';
    this.fireMessagesUpdatedEvent();
  }

  async onKeyPressed(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      await this.onSendClicked();
    }
  }

  async onSendClicked(isRetry = false) {
    if (this.isLoading) {
      return;
    }

    this.hasError = false;
    if (!isRetry) {
      this.messages = [
        ...this.messages,
        {
          content: this.question,
          role: 'user',
        },
      ];
    }

    this.question = '';
    this.isLoading = true;
    this.currentStep = undefined;
    this.stepQueue = [];
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = undefined;
    }
    this.scrollToLastMessage();
    try {
      const chunks = await getCompletion({
        ...this.options,
        messages: this.messages,
        context: {
          userId: this.userId,
          sessionId: this.sessionId,
        },
      });
      const { messages } = this;
      const message: AIChatMessage = {
        content: '',
        role: 'assistant',
        context: {
          intermediateSteps: [],
        },
      };
      for await (const chunk of chunks) {
        if (chunk.delta.content) {
          this.isStreaming = true;
          message.content += chunk.delta.content;
          this.messages = [...messages, message];
        } else if (chunk.delta.context?.intermediateSteps) {
          // Only add intermediate steps when there is no content,
          // otherwise they will be duplicated
          message.context!.intermediateSteps = [
            ...message.context!.intermediateSteps!,
            ...chunk.delta.context?.intermediateSteps,
          ];
        } else if (chunk.delta.context?.currentStep) {
          this.updateCurrentStep(chunk.delta.context.currentStep);
        }

        const sessionId = chunk.context?.sessionId;
        if (!this.sessionId && sessionId) {
          this.sessionId = sessionId;
        }
      }

      this.isLoading = false;
      this.isStreaming = false;
      this.fireMessagesUpdatedEvent();
    } catch (error) {
      this.hasError = true;
      this.isLoading = false;
      this.isStreaming = false;
      console.error(error);
    }
  }

  protected updateCurrentStep(step: AgentStep) {
    // Make sure the step is displayed for a minimum time
    // to avoid flickering
    const min = this.options.minStepDisplayMs ?? 500;
    const now = Date.now();
    const elapsed = now - this.lastStepSetAt;

    if (!this.currentStep || elapsed >= min) {
      this.currentStep = step;
      this.lastStepSetAt = now;
      return;
    }

    // Queue the step to be displayed later
    this.stepQueue.push(step);
    this.scheduleNextStep(min);
  }

  protected scheduleNextStep(min: number) {
    if (this.stepTimer || this.stepQueue.length === 0) {
      return;
    }
    const elapsed = Date.now() - this.lastStepSetAt;
    const waitTime = Math.max(0, min - elapsed);
    this.stepTimer = setTimeout(() => {
      this.stepTimer = undefined;
      if (this.stepQueue.length > 0) {
        const next = this.stepQueue.shift()!;
        this.currentStep = next;
        this.lastStepSetAt = Date.now();
      }
      if (this.stepQueue.length > 0) {
        this.scheduleNextStep(min);
      }
    }, waitTime);
  }

  override disconnectedCallback(): void {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = undefined;
    }
    this.stepQueue = [];
    super.disconnectedCallback();
  }

  override requestUpdate(name?: string, oldValue?: any) {
    if (name === 'messages') {
      this.scrollToLastMessage();
    } else if (name === 'hasError' || name === 'isLoading' || name === 'isStreaming') {
      const state = {
        hasError: this.hasError,
        isLoading: this.isLoading,
        isStreaming: this.isStreaming,
      };
      const stateUpdatedEvent = new CustomEvent('stateChanged', {
        detail: { state },
        bubbles: true,
      });
      this.dispatchEvent(stateUpdatedEvent);
    }

    super.requestUpdate(name, oldValue);
  }

  protected fireMessagesUpdatedEvent() {
    const messagesUpdatedEvent = new CustomEvent('messagesUpdated', {
      detail: { messages: this.messages },
      bubbles: true,
    });
    this.dispatchEvent(messagesUpdatedEvent);
  }

  protected scrollToLastMessage() {
    // Need to be delayed to run after the DOM refresh
    setTimeout(() => {
      const { bottom } = this.messagesElement.getBoundingClientRect();
      const { top } = this.chatInputElement.getBoundingClientRect();
      if (bottom > top) {
        this.chatContainerElement.scrollBy(0, bottom - top);
      }
    }, 0);
  }

  protected getCurrentStepTitle() {
    if (!this.currentStep) {
      return '';
    }
    switch (this.currentStep.type) {
      case 'llm':
        return `Thinking...`;
      case 'tool':
        // Map tool name to a user-friendly message
        return `${this.options.strings.tools[this.currentStep.name] ?? this.currentStep.name}...`;
      default:
        return '';
    }
  }

  protected renderSuggestions = (suggestions: string[]) => html`
    <section class="suggestions-container">
      <h2>${this.options.strings.promptSuggestionsTitle}</h2>
      <div class="suggestions">
        ${map(
          suggestions,
          (suggestion) => html`
            <button
              class="suggestion"
              @click=${async () => {
                await this.onSuggestionClicked(suggestion);
              }}
            >
              ${suggestion}
            </button>
          `,
        )}
      </div>
    </section>
  `;

  protected renderLoader = () =>
    this.isLoading && !this.isStreaming
      ? html`
          <div class="message assistant loader">
            <div class="message-body">
              ${this.currentStep ? html`<div class="current-step">${this.getCurrentStepTitle()}</div>` : nothing}
              <slot name="loader"><div class="loader-animation"></div></slot>
              <div class="message-role">${this.options.strings.assistant}</div>
            </div>
          </div>
        `
      : nothing;

  protected renderMessage = (message: ParsedMessage) => html`
    <div class="message ${message.role} animation">
      ${message.role === 'assistant' ? html`<slot name="message-header"></slot>` : nothing}
      <div class="message-body">
        ${message.role === 'assistant' && this.options.enableDebug
          ? html`<azc-debug .message=${message}></azc-debug>`
          : nothing}
        <div class="content ${this.isStreaming ? 'streaming' : ''}">${message.html}</div>
      </div>
      <div class="message-role">
        ${message.role === 'user' ? this.options.strings.user : this.options.strings.assistant}
      </div>
    </div>
  `;

  protected renderError = () => html`
    <div class="message assistant error">
      <div class="message-body">
        <span class="error-message">${this.options.strings.errorMessage}</span>
        <button @click=${async () => this.onSendClicked(true)}>${this.options.strings.retryButton}</button>
      </div>
    </div>
  `;

  protected renderFollowupQuestions = (questions: string[]) =>
    questions.length > 0
      ? html`
          <div class="questions">
            <span class="question-icon" title=${this.options.strings.followUpQuestionsTitle}>
              ${unsafeSVG(questionSvg)} </span
            >${map(
              questions,
              (question) => html`
                <button
                  class="question animation"
                  @click=${async () => {
                    await this.onSuggestionClicked(question);
                  }}
                >
                  ${question}
                </button>
              `,
            )}
          </div>
        `
      : nothing;

  protected renderChatInput = () => html`
    <div class="chat-input">
      <button
        class="button new-chat-button"
        @click=${() => {
          this.onNewChatClicked();
        }}
        title=${this.options.strings.newChatButton}
        .disabled=${this.messages?.length === 0 || this.isLoading || this.isStreaming}
      >
        ${unsafeSVG(newChatSvg)}
      </button>
      <form class="input-form">
        <textarea
          class="text-input"
          placeholder="${this.options.strings.chatInputPlaceholder}"
          .value=${this.question}
          autocomplete="off"
          @input=${(event) => {
            this.question = event.target.value;
          }}
          @keypress=${this.onKeyPressed}
          .disabled=${this.isLoading}
        ></textarea>
        <button
          class="submit-button"
          @click=${async () => this.onSendClicked()}
          title="${this.options.strings.chatInputButtonLabel}"
          .disabled=${this.isLoading || !this.question}
        >
          ${unsafeSVG(sendSvg)}
        </button>
      </form>
    </div>
  `;

  protected override render() {
    const parsedMessages = this.messages.map((message) => parseMessageIntoHtml(message, this.options.enableMarkdown));
    return html`
      <section class="chat-container">
        ${this.options.enablePromptSuggestions &&
        this.options.promptSuggestions.length > 0 &&
        this.messages.length === 0
          ? this.renderSuggestions(this.options.promptSuggestions)
          : nothing}
        <div class="messages">
          ${repeat(parsedMessages, (_, index) => index, this.renderMessage)} ${this.renderLoader()}
          ${this.hasError ? this.renderError() : nothing}
          ${this.renderFollowupQuestions(parsedMessages.at(-1)?.followupQuestions ?? [])}
        </div>
        ${this.renderChatInput()}
      </section>
    `;
  }

  static override styles = css`
    :host {
      /* Base properties */
      --primary: var(--azc-primary, #07f);
      --error: var(--azc-error, #e30);
      --text-color: var(--azc-text-color, #000);
      --text-invert-color: var(--azc--text-invert-color, #fff);
      --disabled-color: var(--azc-disabled-color, #ccc);
      --bg: var(--azc-bg, #eee);
      --border-color: var(--azc-border-color, #ccc);
      --card-bg: var(--azc-card-bg, #fff);
      --card-shadow: var(--azc-card-shadow, 0 0.3px 0.9px rgba(0 0 0 / 12%), 0 1.6px 3.6px rgba(0 0 0 / 16%));
      --space-md: var(--azc-space-md, 12px);
      --space-xl: var(--azc-space-xl, calc(var(--space-md) * 2));
      --space-xs: var(--azc-space-xs, calc(var(--space-md) / 2));
      --space-xxs: var(--azc-space-xs, calc(var(--space-md) / 4));
      --border-radius: var(--azc-border-radius, 16px);
      --focus-outline: var(--azc-focus-outline, 2px solid);
      --overlay-color: var(--azc-overlay-color, rgba(0 0 0 / 40%));

      /* Component-specific properties */
      --error-color: var(--azc-error-color, var(--error));
      --error-border: var(--azc-error-border, none);
      --error-bg: var(--azc-error-bg, var(--card-bg));
      --retry-button-color: var(--azc-retry-button-color, var(--text-color));
      --retry-button-bg: var(--azc-retry-button-bg, #f0f0f0);
      --retry-button-bg-hover: var(--azc-retry-button-bg, #e5e5e5);
      --retry-button-border: var(--azc-retry-button-border, none);
      --suggestion-color: var(--azc-suggestion-color, var(--text-color));
      --suggestion-border: var(--azc-suggestion-border, none);
      --suggestion-bg: var(--azc-suggestion-bg, var(--card-bg));
      --suggestion-shadow: var(--azc-suggestion-shadow, 0 6px 16px -1.5px rgba(141 141 141 / 30%));
      --user-message-color: var(--azc-user-message-color, var(--text-invert-color));
      --user-message-border: var(--azc-user-message-border, none);
      --user-message-bg: var(--azc-user-message-bg, var(--primary));
      --bot-message-color: var(--azc-bot-message-color, var(--text-color));
      --bot-message-border: var(--azc-bot-message-border, none);
      --citation-color: var(--azc-citation-color, var(--text-invert-color));
      --bot-message-bg: var(--azc-bot-message-bg, var(--card-bg));
      --citation-bg: var(--azc-citation-bg, var(--primary));
      --citation-bg-hover: var(--azc-citation-bg, color-mix(in srgb, var(--primary), #000 10%));
      --new-chat-button-color: var(--azc-button-color, var(--text-invert-color));
      --new-chat-button-bg: var(--azc-new-chat-button-bg, var(--primary));
      --new-chat-button-bg-hover: var(--azc-new-chat-button-bg, color-mix(in srgb, var(--primary), #000 10%));
      --chat-input-color: var(--azc-chat-input-color, var(--text-color));
      --chat-input-border: var(--azc-chat-input-border, none);
      --chat-input-bg: var(--azc-chat-input-bg, var(--card-bg));
      --submit-button-color: var(--azc-button-color, var(--primary));
      --submit-button-border: var(--azc-submit-button-border, none);
      --submit-button-bg: var(--azc-submit-button-bg, none);
      --submit-button-bg-hover: var(--azc-submit-button-color, #f0f0f0);

      container-type: size;
    }
    *:focus-visible {
      outline: var(--focus-outline) var(--primary);
    }
    .animation {
      animation: 0.3s ease;
    }
    svg {
      fill: currentColor;
      width: 100%;
    }
    button {
      font-size: 1rem;
      border-radius: calc(var(--border-radius) / 2);
      outline: var(--focus-outline) transparent;
      transition: outline 0.3s ease;

      &:not(:disabled) {
        cursor: pointer;
      }
    }
    .chat-container {
      height: 100cqh;
      overflow: auto;
      container-type: inline-size;
      position: relative;
      background: var(--bg);
      font-family:
        'Segoe UI',
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        'Helvetica Neue',
        sans-serif;
    }
    .suggestions-container {
      text-align: center;
      padding: var(--space-xl);
    }
    .suggestions {
      display: flex;
      gap: var(--space-md);
    }
    @container (width < 480px) {
      .suggestions {
        flex-direction: column;
      }
    }

    .suggestion {
      flex: 1 1 0;
      padding: var(--space-xl) var(--space-md);
      color: var(--sugestion-color);
      background: var(--suggestion-bg);
      border: var(--suggestion-border);
      border-radius: var(--border-radius);
      box-shadow: var(--suggestion-shadow);

      &:hover {
        outline: var(--focus-outline) var(--primary);
      }
    }
    .messages {
      padding: var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }
    .user {
      align-self: end;
      color: var(--user-message-color);
      background: var(--user-message-bg);
      border: var(--user-message-border);
    }
    .assistant {
      color: var(--bot-message-color);
      background: var(--bot-message-bg);
      border: var(--bot-message-border);
      box-shadow: var(--card-shadow);
    }
    .message {
      position: relative;
      width: auto;
      max-width: 70%;
      border-radius: var(--border-radius);
      padding: var(--space-xl);
      margin-bottom: var(--space-xl);

      &.user {
        animation-name: fade-in-up;
      }
    }
    .message-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      overflow-x: auto;
      padding: 0 var(--space-xl);
      margin: 0 calc(var(--space-xl) * -1);
    }
    .content {
      h1,
      h2,
      h3 {
        margin: 0 0 var(--space-md);
        line-height: 1.2;
      }
      p,
      ul,
      ol,
      pre,
      code,
      blockquote {
        margin: 0 0 var(--space-md);
        line-height: 1.4;
      }
      ul,
      ol {
        padding-left: 1.2em;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        background: color-mix(in srgb, var(--bot-message-bg), #000 5%);
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 0.95em;
      }
      pre code {
        display: block;
        padding: var(--space-md);
        overflow-x: auto;
        white-space: pre;
      }
      blockquote {
        border-left: 4px solid var(--primary);
        padding-top: var(--space-md);
        padding-left: var(--space-md);
        padding-bottom: var(--space-md);
        background: color-mix(in srgb, var(--bot-message-bg), #000 3%);
        & > :last-child {
          margin-bottom: 0;
        }
      }
      img {
        max-width: 100%;
        max-height: 300px;
        border-radius: calc(var(--border-radius) / 2);
      }
      table {
        width: 100%;
        margin-bottom: var(--space-md);
        border: none;
        border-bottom: 4px solid var(--primary);
        border-radius: calc(var(--border-radius) / 1.6) calc(var(--border-radius) / 1.6) 0 0;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        background: var(--bot-message-bg);
        box-shadow:
          0 3px 8px rgba(0 0 0 / 12%),
          0 1.5px 3px rgba(0 0 0 / 8%);

        img {
          max-height: 150px;
        }

        .streaming & {
          table-layout: fixed;
        }
      }
      thead tr {
        background: var(--primary);
        color: var(--text-invert-color);
      }
      th,
      td {
        padding: calc(var(--space-xs) + 2px) var(--space-md);
        text-align: left;
      }
      th {
        font-weight: 600;
        position: relative;

        &:first-child {
          border-top-left-radius: calc(var(--border-radius) / 1.6);
        }
        &:last-child {
          border-top-right-radius: calc(var(--border-radius) / 1.6);
        }
      }
      tr {
        background: var(--bot-message-bg);

        & + tr {
          border-top: 1px solid var(--border-color);
        }
        &:nth-child(even) {
          background: color-mix(in srgb, var(--bot-message-bg), #000 4%);
        }
      }
      hr {
        border: none;
        border-top: 1px solid var(--border-color);
        margin: var(--space-md) 0;
      }
      a {
        color: var(--primary);
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }
    }
    .message-role {
      position: absolute;
      right: var(--space-xl);
      bottom: -1.25em;
      color: var(--text-color);
      font-size: 0.85rem;
      opacity: 0.6;
    }
    .questions {
      margin: var(--space-md) 0;
      color: var(--primary);
      text-align: right;
    }
    .question-icon {
      vertical-align: middle;
      display: inline-block;
      height: 1.7rem;
      width: 1.7rem;
      margin-bottom: var(--space-xs);
      margin-left: var(--space-xs);
    }
    .question {
      position: relative;
      padding: var(--space-xs) var(--space-md);
      margin-bottom: var(--space-xs);
      margin-left: var(--space-xs);
      vertical-align: middle;
      color: var(--primary);
      background: var(--card-bg);
      border: 1px solid var(--primary);
      animation-name: fade-in-right;
      &:hover {
        background: color-mix(in srgb, var(--card-bg), var(--primary) 5%);
      }
    }
    .button,
    .submit-button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-xs);
      border: var(--button-border);
      background: var(--submit-button-bg);
      color: var(--submit-button-color);
      &:disabled {
        color: var(--disabled-color);
      }
      &:hover:not(:disabled) {
        background: var(--submit-button-bg-hover);
      }
    }
    .submit-button {
      flex: 0 0 auto;
      padding: var(--space-xs);
      width: 36px;
      align-self: flex-end;
    }
    .error {
      color: var(--error-color);
      background: var(--error-bg);
      outline: var(--focus-outline) var(--error);

      & .message-body {
        flex-direction: row;
        align-items: center;
      }

      & button {
        flex: 0;
        padding: var(--space-md);
        color: var(--retry-button-color);
        background: var(--retry-button-bg);
        border: var(--retry-button-border);

        &:hover {
          background: var(--retry-button-bg-hover);
        }
      }
    }
    .error-message {
      flex: 1;
    }
    .chat-input {
      position: sticky;
      bottom: 0;
      padding: var(--space-xl);
      padding-top: var(--space-md);
      background: var(--bg);
      box-shadow: 0 calc(-1 * var(--space-md)) var(--space-md) var(--bg);
      display: flex;
      gap: var(--space-md);
    }
    .new-chat-button {
      flex: 0 0 auto;
      width: 48px;
      height: 48px;
      padding: var(--space-md);
      border-radius: 50%;
      background: var(--new-chat-button-bg);
      color: var(--new-chat-button-color);
      font-size: 1.5rem;
      &:hover:not(:disabled) {
        background: var(--new-chat-button-bg-hover);
        color: var(--new-chat-button-color);
      }
    }
    .input-form {
      display: flex;
      flex: 1 auto;
      background: var(--chat-input-bg);
      border: var(--chat-input-border);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      box-shadow: var(--card-shadow);
      outline: var(--focus-outline) transparent;
      transition: outline 0.3s ease;
      overflow: hidden;

      &:has(.text-input:focus-visible) {
        outline: var(--focus-outline) var(--primary);
      }
    }
    .text-input {
      padding: var(--space-xs);
      font-family: inherit;
      font-size: 1rem;
      flex: 1 auto;
      height: 3rem;
      border: none;
      resize: none;
      background: none;
      &::placeholder {
        color: var(--text-color);
        opacity: 0.4;
      }
      &:focus {
        outline: none;
      }
      &:disabled {
        opacity: 0.7;
      }
    }
    .loader-animation {
      width: 100px;
      height: 4px;
      border-radius: var(--border-radius);
      overflow: hidden;
      background-color: var(--primary);
      transform: scaleX(0);
      transform-origin: center left;
      animation: cubic-bezier(0.85, 0, 0.15, 1) 2s infinite load-animation;
    }
    .current-step {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    @keyframes load-animation {
      0% {
        transform: scaleX(0);
        transform-origin: center left;
      }
      50% {
        transform: scaleX(1);
        transform-origin: center left;
      }
      51% {
        transform: scaleX(1);
        transform-origin: center right;
      }
      100% {
        transform: scaleX(0);
        transform-origin: center right;
      }
    }
    @keyframes fade-in-up {
      0% {
        opacity: 0.5;
        top: 100px;
      }
      100% {
        opacity: 1;
        top: 0px;
      }
    }
    @keyframes fade-in-right {
      0% {
        opacity: 0.5;
        right: -100px;
      }
      100% {
        opacity: 1;
        right: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .animation {
        animation: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'azc-chat': ChatComponent;
  }
}
