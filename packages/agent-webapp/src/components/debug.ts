import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, property, state } from 'lit/decorators.js';
import { ParsedMessage } from '../message-parser';
import deleteSvg from '../../assets/icons/delete.svg?raw';

@customElement('azc-debug')
export class DebugComponent extends LitElement {
  @property({ type: Object }) message: ParsedMessage | undefined;
  @state() protected hasError = false;
  @state() protected isLoading = false;

  protected renderLoader = () =>
    this.isLoading ? html`<slot name="loader"><div class="loader-animation"></div></slot>` : nothing;

  protected override render() {
    return html`
        <div class="debug">
          show intermediateSteps >>
          ${JSON.stringify(this.message?.['intermediateSteps'] ?? {}, null, 2)}
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
      --panel-bg: var(--azc-panel-bg, #fff);
      --panel-width: var(--azc-panel-width, 300px);
      --panel-shadow: var(--azc-panel-shadow, 0 0 10px rgba(0, 0, 0, 0.1));
      --error-color: var(--azc-error-color, var(--error));
      --error-border: var(--azc-error-border, none);
      --error-bg: var(--azc-error-bg, var(--card-bg));
      --icon-button-color: var(--azc-icon-button-color, var(--text-color));
      --icon-button-bg: var(--azc-icon-button-bg, none);
      --icon-button-bg-hover: var(--azc-icon-button-bg, rgba(0, 0, 0, 0.07));
      --panel-button-color: var(--azc-panel-button-color, var(--text-color));
      --panel-button-bg: var(--azc-panel-button-bg, var(--bg));
      --panel-button-bg-hover: var(--azc-panel-button-bg, hsl(from var(--panel-button-bg) h s calc(l - 6)));
      --chat-entry-bg: var(--azc-chat-entry-bg, none);
      --chat-entry-bg-hover: var(--azc-chat-entry-bg-hover, #f0f0f0);

      width: 0;
      transition: width 0.3s ease;
      overflow: hidden;
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
    h2 {
      margin: var(--space-md) 0 0 0;
      padding: var(--space-xs) var(--space-md);
      font-size: 0.9rem;
      font-weight: 600;
    }
    .buttons {
      display: flex;
      justify-content: space-between;
      padding: var(--space-xs);
      position: sticky;
      top: 0;
      background: var(--panel-bg);
      box-shadow: 0 var(--space-xs) var(--space-xs) var(--panel-bg);
    }
    .chats-panel {
      width: var(--panel-width);
      height: 100%;
      background: var(--panel-bg);
      font-family:
        'Segoe UI',
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        'Helvetica Neue',
        sans-serif;
      overflow: auto;
    }
    .chats {
      margin: 0;
      padding: 0;
      font-size: 0.9rem;
    }
    .chat-title {
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    .chat-entry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-xxs) var(--space-xxs) var(--space-xxs) var(--space-xs);
      margin: 0 var(--space-xs);
      border-radius: calc(var(--border-radius) / 2);
      color: var(--text-color);
      text-decoration: none;
      background: var(--chat-entry-bg);

      & .icon-button {
        flex: 0 0 auto;
        padding: var(--space-xxs);
        width: 28px;
        height: 28px;
      }

      &:hover {
        background: var(--chat-entry-bg-hover);
      }

      &:not(:focus):not(:hover) .icon-button:not(:focus) {
        opacity: 0;
      }
    }
    .message {
      padding: var(--space-xs) var(--space-md);
    }
    .error {
      color: var(--error-color);
    }
    .icon-button {
      width: 36px;
      height: 36px;
      padding: var(--space-xs);
      background: none;
      border: none;
      background: var(--icon-button-bg);
      color: var(--icon-button-color);
      font-size: 1.5rem;
      &:hover:not(:disabled) {
        background: var(--icon-button-bg-hover);
        color: var(--icon-button-color);
      }
    }
    .loader-animation {
      position: absolute;
      width: var(--panel-width);
      height: 2px;
      overflow: hidden;
      background-color: var(--primary);
      transform: scaleX(0);
      transform-origin: center left;
      animation: cubic-bezier(0.85, 0, 0.15, 1) 2s infinite load-animation;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'azc-debug': DebugComponent;
  }
}
