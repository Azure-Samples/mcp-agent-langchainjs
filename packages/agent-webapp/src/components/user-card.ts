import { LitElement, css, html } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { customElement, state } from "lit/decorators.js";
import { getUserInfo } from "../auth.service.js";
import copySvg from "../../assets/icons/copy.svg?raw";
import burgerOutlineSvg from "../../assets/icons/burger-outline.svg?raw";

export const apiBaseUrl: string =
  import.meta.env.VITE_REGISTRATION_API_URL || "";

@customElement("azc-user-card")
export class UserCard extends LitElement {
  @state() protected userId: string = "";
  @state() protected isLoading = false;
  @state() protected hasError = false;
  @state() protected username: string = "";

  constructor() {
    super();
    this.getUserId();
  }

  protected renderLoading = () => html`<p>Loading...</p>`;

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

  protected renderError = () => html`<p class="error">
    Error during while loading your membership details. Please retry later.
  </p>`;

  protected renderRegistrationCard = () => html`
    <div class="card card-shine">
      <span class="slice">${unsafeSVG(burgerOutlineSvg)}</span>
      <div class="card-content">
        <h1>Contoso Burgers Membership</h1>
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

      const response = await fetch(`${apiBaseUrl}/me`);
      if (!response.ok) {
        throw new Error("An error occurred while fetching the user ID");
      }
      const data = await response.json();
      this.userId = data.userId;
    } catch (error) {
      console.error("Error fetching user ID:", error);
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  };

  protected override render() {
    return this.isLoading
      ? this.renderLoading()
      : !this.username
      ? this.renderError()
      : this.renderRegistrationCard();
  }

  static override styles = css`
    :host {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem;
      text-align: center;
    }
    svg {
      fill: currentColor;
      width: 100%;
    }
    h1 {
      font-family: "Sofia Sans Condensed", sans-serif;
      font-size: 2.5em;
      color: #fff;
    }
    h1, p, pre, .warning {
      text-shadow: 0 1px 0px rgba(0, 0, 0, 0.5);
    }
    .card {
      position: relative;
      background-color: var(--reg-primary);
      border-radius: var(--reg-border-radius);
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2),
        -1px -1px 1px rgba(255, 255, 255, 0.3),
        2px 4px 8px rgba(0, 0, 0, 0.4);
      font-family: "Sofia Sans Condensed", sans-serif;
      text-align: left;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
      color: #fff;
      font-size: 1.2rem;

      h1 {
        font-size: 2.5rem;
        margin: 0;
        font-weight: 600;
        text-transform: uppercase;
      }
      h2 {
        margin: 0;
        font-weight: 600;
      }
      pre {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
        white-space: normal;
        word-wrap: break-word;
      }
      p {
        margin: 1.5rem 0 0 0;
      }
    }
    .card-shine {
      --shine-deg: 45deg;
      position: relative;
      overflow: hidden;
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
    .slice {
      z-index: 1;
      width: 10rem;
      height: 10rem;
      display: inline-block;
      vertical-align: middle;
      opacity: 0.4;
      position: absolute;
      right: -1rem;
      top: 2rem;
      pointer-events: none;
    }
    .user-id-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: 1px solid #ffffff;
      padding: 1rem;
      border-radius: calc(var(--reg-border-radius) / 2);
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
