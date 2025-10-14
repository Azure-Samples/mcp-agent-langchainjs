import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, property, state } from 'lit/decorators.js';
import { ParsedMessage } from '../message-parser.js';
import { AgentStep } from '../models.js';
import aiSvg from '../../assets/icons/ai.svg?raw';

@customElement('azc-debug')
export class DebugComponent extends LitElement {
  @property({ type: Object }) message: ParsedMessage | undefined;
  @state() protected isExpanded = false;
  @state() protected expandedSteps = new Set<number>();
  @state() protected expandedOutputs = new Set<string>();

  protected toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  protected toggleStepExpanded(index: number) {
    this.expandedSteps = this.expandedSteps.has(index)
      ? new Set([...this.expandedSteps].filter((index_) => index_ !== index))
      : new Set([...this.expandedSteps, index]);
  }

  protected toggleOutputExpanded(stepIndex: number, section: string) {
    const key = `${stepIndex}-${section}`;
    this.expandedOutputs = this.expandedOutputs.has(key)
      ? new Set([...this.expandedOutputs].filter((k) => k !== key))
      : new Set([...this.expandedOutputs, key]);
  }

  protected getStepType(step: AgentStep): 'tool' | 'llm' {
    return step.type;
  }

  protected getStepSummary(step: AgentStep): string {
    return step.type === 'tool' ? `Tool: ${step.name}` : `LLM: ${step.name}`;
  }

  protected truncateText(text: string, maxLength = 100): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength)) + '...';
  }

  protected renderDetailSection(
    title: string,
    content: string,
    stepIndex: number,
    section: string,
    isTruncated = false,
  ) {
    const key = `${stepIndex}-${section}`;
    const isExpanded = this.expandedOutputs.has(key);
    const displayContent = isTruncated && !isExpanded ? this.truncateText(content, 500) : content;

    return html`
      <div class="detail-section">
        <div class="detail-header">
          <h4>${title}</h4>
          ${isTruncated
            ? html`
                <div class="detail-actions">
                  <button
                    class="action-button expand-button"
                    @click=${() => {
                      this.toggleOutputExpanded(stepIndex, section);
                    }}
                    title=${isExpanded ? 'Show less' : 'Show full content'}
                  >
                    ${isExpanded ? 'Less' : 'More'}
                  </button>
                </div>
              `
            : nothing}
        </div>
        <pre class="detail-content">${displayContent}</pre>
      </div>
    `;
  }

  protected renderStep(step: AgentStep, index: number) {
    const stepType = this.getStepType(step);
    const isExpanded = this.expandedSteps.has(index);
    const summary = this.getStepSummary(step);

    return html`
      <div class="step ${stepType}">
        <div class="step-content">
          <button
            class="step-header"
            @click=${() => {
              this.toggleStepExpanded(index);
            }}
            aria-expanded=${isExpanded}
          >
            <div class="step-indicator ${stepType}">${stepType === 'tool' ? 'T' : 'L'}</div>
            <div class="step-summary">
              <span class="step-title">${summary}</span>
            </div>
            <div class="step-toggle ${isExpanded ? 'expanded' : ''}">▼</div>
          </button>

          ${isExpanded
            ? html`
                <div class="step-details">
                  ${step.input === undefined
                    ? nothing
                    : this.renderDetailSection('Input', step.input, index, 'input', step.input.length > 500)}
                  ${step.output === undefined
                    ? nothing
                    : this.renderDetailSection('Output', step.output, index, 'output', step.output.length > 500)}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  protected override render() {
    const intermediateSteps: AgentStep[] =
      (this.message?.context?.['intermediateSteps'] as AgentStep[] | undefined) ?? [];
    return intermediateSteps.length === 0
      ? nothing
      : html`
          <div class="debug-container">
            <button
              class="debug-toggle ${this.isExpanded ? 'expanded' : ''}"
              @click=${this.toggleExpanded}
              aria-expanded=${this.isExpanded}
            >
              <span class="toggle-icon"> ${unsafeSVG(aiSvg)} </span>
              ${this.isExpanded ? 'Hide intermediate steps' : 'Show intermediate steps'} (${intermediateSteps.length})
            </button>

            ${this.isExpanded
              ? html`
                  <div class="steps-timeline">
                    ${repeat(
                      intermediateSteps,
                      (_, index) => index,
                      (step, index) => this.renderStep(step, index),
                    )}
                  </div>
                `
              : nothing}
          </div>
        `;
  }

  static override styles = css`
    :host {
      /* Base properties */
      --primary: var(--azc-primary, #07f);
      --bg: var(--azc-bg, #eee);
      --error: var(--azc-error, #e30);
      --text-color: var(--azc-text-color, #000);
      --space-md: var(--azc-space-md, 12px);
      --space-xl: var(--azc-space-xl, calc(var(--space-md) * 2));
      --space-xs: var(--azc-space-xs, calc(var(--space-md) / 2));
      --space-xxs: var(--azc-space-xs, calc(var(--space-md) / 4));
      --border-radius: var(--azc-border-radius, 16px);
      --focus-outline: var(--azc-focus-outline, 2px solid);
      --overlay-color: var(--azc-overlay-color, rgba(0 0 0 / 40%));

      /* Component-specific properties */
      --card-bg: var(--azc-card-bg, #fff);
      --border-color: var(--azc-border-color, #ccc);

      display: contents;
    }

    *:focus-visible {
      outline: var(--focus-outline) var(--primary);
    }

    svg {
      fill: currentColor;
      width: 100%;
    }

    button {
      font-family: inherit;
      font-size: inherit;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: calc(var(--border-radius) / 2);
      outline: var(--focus-outline) transparent;
      transition: all 0.2s ease;
    }

    .debug-container {
      width: 100%;
    }

    .debug-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      padding: calc(var(--space-xs) / 2) var(--space-xs);
      background: color-mix(in srgb, var(--text-color), transparent 95%);
      border: none;
      border-radius: calc(var(--border-radius) / 4);
      color: color-mix(in srgb, var(--text-color), transparent 30%);
      font-size: 0.75rem;
      font-weight: 500;
      text-align: left;
      transition: all 0.2s ease;

      &:hover {
        background: color-mix(in srgb, var(--text-color), transparent 90%);
        color: var(--text-color);
      }

      &.expanded {
        color: var(--text-color);
      }
    }

    .toggle-icon {
      display: contents;
      svg {
        width: 1rem;
        height: 1rem;
      }
    }

    .toggle-arrow {
      transition: transform 0.2s ease;
      opacity: 0.6;
      font-size: 0.8rem;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    .steps-timeline {
      margin-top: var(--space-md);
      position: relative;
    }

    .step {
      position: relative;
      margin-bottom: var(--space-md);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .step-content {
      position: relative;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-xs) var(--space-md);
      background: color-mix(in srgb, var(--card-bg), var(--text-color) 2%);
      border: 1px solid var(--border-color);
      border-radius: calc(var(--border-radius) / 2);
      width: 100%;
      text-align: left;
      transition: background-color 0.2s ease;

      &:hover {
        background: color-mix(in srgb, var(--card-bg), var(--text-color) 4%);
      }

      &[aria-expanded='true'] {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom-color: transparent;
      }
    }

    .step-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;

      &.tool {
        background: var(--primary);
      }

      &.llm {
        background: oklch(from var(--primary) l c calc(h + 180));
      }
    }

    .step-summary {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .step-title {
      font-weight: 500;
      color: var(--text-color);
    }

    .step-toggle {
      transition: transform 0.2s ease;
      opacity: 0.6;
      font-size: 0.7rem;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    .step-details {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-top: none;
      border-radius: 0 0 calc(var(--border-radius) / 2) calc(var(--border-radius) / 2);
      padding: var(--space-md);
      margin-top: -1px;
    }

    .detail-section {
      margin-bottom: var(--space-md);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .detail-section h4 {
      margin: 0 0 var(--space-xs) 0;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-xs);
    }

    .detail-actions {
      display: flex;
      gap: var(--space-xs);
    }

    .action-button {
      padding: calc(var(--space-xs) / 2) var(--space-xs);
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary), transparent 90%);
      border: 1px solid color-mix(in srgb, var(--primary), transparent 70%);
      border-radius: calc(var(--border-radius) / 4);
      transition: all 0.2s ease;

      &:hover {
        background: color-mix(in srgb, var(--primary), transparent 80%);
        border-color: color-mix(in srgb, var(--primary), transparent 50%);
      }

      &:active {
        transform: translateY(1px);
      }
    }

    .detail-content {
      background: color-mix(in srgb, var(--card-bg), var(--text-color) 3%);
      border: 1px solid var(--border-color);
      border-radius: calc(var(--border-radius) / 4);
      padding: var(--space-xs);
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      font-size: 0.75rem;
      line-height: 1.4;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .loader-animation {
      position: absolute;
      width: 100%;
      height: 2px;
      overflow: hidden;
      background-color: var(--primary);
      transform: scaleX(0);
      transform-origin: center left;
      animation: cubic-bezier(0.85, 0, 0.15, 1) 2s infinite load-animation;
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

    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none;
        transition: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'azc-debug': DebugComponent;
  }
}
