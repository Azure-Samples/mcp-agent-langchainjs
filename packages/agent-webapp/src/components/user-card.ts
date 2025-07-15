import { LitElement, css, html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { customElement, state } from "lit/decorators.js";
import { getUserInfo } from "../auth.service.js";
import copySvg from "../../assets/icons/copy.svg?raw";
import burgerOutlineSvg from "../../assets/icons/burger-outline.svg?raw";
import cardSvg from "../../assets/icons/card.svg?raw";

@customElement("azc-user-card")
export class UserCard extends LitElement {
  @state() protected userId: string = "";
  @state() protected isLoading = false;
  @state() protected hasError = false;
  @state() protected username: string = "";
  @state() protected isOpen = false;

  constructor() {
    super();
    this.getUserId();
  }

  openModal() {
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.isOpen = false;
    document.body.style.overflow = '';
  }

  protected handleNavClick = () => {
    this.openModal();
  };

  protected handleOverlayClick = (e: Event) => {
    if (e.target === e.currentTarget) {
      this.closeModal();
    }
  };

  protected handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.closeModal();
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.body.style.overflow = '';
  }

  protected renderLoading = () => html`<p class="message">Loading...</p>`;

  protected copyUserIdToClipboard = async () => {
    if (this.userId) {
      try {
        await navigator.clipboard.writeText(this.userId);
        // Select the user-id text
        const pre = this.renderRoot.querySelector(".user-id");
        if (pre) {
          const range = document.createRange();
          range.selectNodeContents(pre);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch (err) {
        console.error("Failed to copy user ID:", err);
      }
    }
  };

  protected renderError = () => html`<p class="message error">
    An error during while loading your membership details. Please retry later.
  </p>`;

  protected renderRegistrationCard = () => html`
    <div class="card card-shine">
      <span class="burger">${unsafeSVG(burgerOutlineSvg)}</span>
      <div class="card-content">
        <h1>Contoso Burgers</h1>
        <h2>Membership Card</h2>
        <p>Card attributed to:</p>
        <div><pre>${this.username}</pre></div>
        <p>Unique user ID:</p>
        <div class="user-id-row">
          <pre class="user-id">${this.userId}</pre>
          <button
            class="copy-button"
            @click="${this.copyUserIdToClipboard}"
            title="Copy user ID to clipboard"
            aria-label="Copy user ID to clipboard"
          >
            <span class="visually-hidden">Copy</span>
            <span class="copy-icon">${unsafeSVG(copySvg)}</span>
          </button>
        </div>
        <div class="warning">
          This user ID is personal, do not share it with anyone!
        </div>
      </div>
    </div>
  `;

  protected getUserId = async () => {
    this.isLoading = true;
    this.hasError = false;
    try {
      const authDetails = await getUserInfo();
      if (!authDetails) return;
      this.username = authDetails.userDetails;

      const response = await fetch(`/api/me`);
      if (!response.ok) {
        throw new Error("An error occurred while fetching the user ID");
      }
      const { id } = await response.json();
      this.userId = id;
    } catch (error) {
      console.error("Error fetching user ID:", error);
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  };

  protected renderNavLink = () => html`
    <button @click="${this.handleNavClick}" class="member-card-link">
      <span class="card-icon">${unsafeSVG(cardSvg)}</span>
      Member card
    </button>
  `;

  protected renderModal = () => html`
    <div class="modal-overlay" @click="${this.handleOverlayClick}">
      <div class="modal-content">
        <button class="close-button" @click="${this.closeModal}" aria-label="Close modal">×</button>
        ${this.isLoading
          ? this.renderLoading()
          : !this.username || this.hasError
          ? this.renderError()
          : this.renderRegistrationCard()}
      </div>
    </div>
  `;

  protected override render() {
    return html`
      ${this.renderNavLink()}
      ${this.isOpen ? this.renderModal() : nothing}
    `;
  }

  static override styles = css`
    :host {
      --azc-primary: linear-gradient(135deg, #de471d 0%, #ff6b3d 100%);
      --azc-border-radius: 16px;
    }
    .member-card-link {
      background: none;
      border: none;
      color: #fff;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
    }
    .member-card-link:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .card-icon {
      display: inline-block;
      fill: currentColor;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
      box-sizing: border-box;
    }
    .modal-content {
      position: relative;
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      background: var(--azc-primary);
      border-radius: var(--azc-border-radius, 16px);
    }
    .close-button {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 2.5rem;
      height: 2.5rem;
      font-size: 1.5rem;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      color: #fff;
      transition: background 0.2s;
    }
    .close-button:hover {
      background: rgba(255, 255, 255, .4);
    }
    svg {
      fill: currentColor;
      width: 100%;
    }
    h1 {
      font-size: 2em;
      color: #fff;
      margin: 0;
      font-weight: 600;
      text-transform: uppercase;
    }
    h1, h2 {
      font-family: "Sofia Sans Condensed", sans-serif;
    }
    h1, h2, pre, .warning {
      text-shadow: 0 1px 0px rgba(0, 0, 0, 0.5);
    }
    .card {
      position: relative;
      background: var(--azc-primary);
      border-radius: var(--azc-border-radius);
      padding: 2rem;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2),
        -1px -1px 1px rgba(255, 255, 255, 0.3),
        2px 4px 8px rgba(0, 0, 0, 0.4);
      font-family: "Sofia Sans Condensed", sans-serif;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      color: #fff;
      font-size: 1.2rem;

      h2 {
        font-size: 1em;
        margin: 0;
        font-weight: 600;
        font-style: italic;
        text-transform: uppercase;
      }
      pre {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
        white-space: normal;
        line-break: anywhere;
      }
      p {
        margin: 1.5rem 0 0 0;
      }
    }
    .card-shine {
      --shine-deg: 45deg;
      position: relative;
      background-repeat: no-repeat;
      background-position: 0% 0, 0 0;
      background-image: linear-gradient(
        var(--shine-deg),
        transparent 20%,
        transparent 45%,
        #ffffff30 50%,
        #ffffff30 51%,
        transparent 56%,
        transparent 100%
      );
      background-size: 250% 250%, 100% 100%;
      transition: background-position 1.5s ease;
    }
    .card-shine:hover {
      background-position: 90% 0, 0 0;
    }
    .burger {
      z-index: 1;
      width: 10rem;
      height: 10rem;
      display: inline-block;
      vertical-align: middle;
      opacity: 0.4;
      position: absolute;
      right: -1rem;
      top: 3.5rem;
      pointer-events: none;
      clip-path: inset(0 1rem 0 0);
    }
    .user-id-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: 1px solid #ffffff;
      padding: 1rem;
      border-radius: calc(var(--azc-border-radius) / 2);
      margin: 0.5rem 0;
    }
    .copy-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.3rem;
      display: flex;
      align-items: center;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .copy-button:hover {
      background: #ffffff30;
    }
    .copy-icon {
      width: 1.5rem;
      height: 1.5rem;
      display: inline-block;
      vertical-align: middle;
      color: #fff;
    }
    .message {
      padding: 1em;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "azc-user-card": UserCard;
  }
}
