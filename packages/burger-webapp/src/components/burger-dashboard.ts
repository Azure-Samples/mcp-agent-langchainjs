import { LitElement, css, html, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, state } from 'lit/decorators.js';
import { fetchOrders } from '../orders.service.js';
import type { BurgerOrder } from '../orders.service.js';
import burgerOutlineSvg from '../../assets/burger-outline.svg?raw';
import burgerSvg from '../../assets/burger.svg?raw';

export const apiBaseUrl: string = import.meta.env.VITE_BURGER_API_URL || '';

@customElement('burger-dashboard')
export class BurgerDashboard extends LitElement {
  @state() protected hasError = false;
  @state() protected inProgressOrders: BurgerOrder[] = [];
  @state() protected completedOrders: BurgerOrder[] = [];
  @state() protected refreshTimer: number | undefined = undefined;

  private prevInProgressOrders: BurgerOrder[] = [];
  private prevCompletedOrders: BurgerOrder[] = [];
  private leavingOrders: Map<string, BurgerOrder> = new Map();

  connectedCallback() {
    super.connectedCallback();
    this.loadOrders();
    this.refreshTimer = window.setInterval(() => this.loadOrders(), 10000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer);
    }
  }

  protected async loadOrders() {
    this.hasError = false;
    try {
      const orders = await fetchOrders({
        apiBaseUrl,
        lastMinutes: 10,
      });
      const completed = orders?.filter((order) => order.status === 'completed' || order.status === 'ready');
      const inProgress = orders?.filter((order) => order.status === 'pending' || order.status === 'in-preparation');
      if (inProgress === undefined || completed === undefined) {
        this.hasError = true;
        return;
      }
      // Sort latest first
      this.inProgressOrders = [...inProgress].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
      this.completedOrders = [...completed]
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        .slice(0, 50);
    } catch {
      this.hasError = true;
    }
  }

  protected updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    if (changedProps.has('inProgressOrders') || changedProps.has('completedOrders')) {
      this.handleOrderAnimations(this.inProgressOrders, this.prevInProgressOrders);
      this.handleOrderAnimations(this.completedOrders, this.prevCompletedOrders);
      this.prevInProgressOrders = [...this.inProgressOrders];
      this.prevCompletedOrders = [...this.completedOrders];
    }
  }

  private handleOrderAnimations(currentOrders: BurgerOrder[], prevOrders: BurgerOrder[]) {
    const currentIds = new Set(currentOrders.map((o) => o.id));
    // Animate new orders (fade-in)
    currentOrders.forEach((order) => {
      if (!prevOrders.some((o) => o.id === order.id)) {
        const node = this.renderRoot.querySelector(`[data-order-id='${order.id}']`);
        if (node) {
          node.classList.add('fade-in');
        }
      }
    });
    // Animate removed orders (fade-out only if not present in either column)
    prevOrders.forEach((order) => {
      const isNowInOtherColumn =
        this.inProgressOrders.some((o) => o.id === order.id) || this.completedOrders.some((o) => o.id === order.id);
      if (!currentIds.has(order.id) && !isNowInOtherColumn && !this.leavingOrders.has(order.id)) {
        this.leavingOrders.set(order.id, order);
        this.requestUpdate();
      }
    });
  }

  protected getOrderDisplayStatus(order: BurgerOrder): string {
    if (order.status === 'pending') return 'new';
    if (order.status === 'in-preparation') return 'in preparation';
    if (order.status === 'ready') return 'ready';
    if (order.status === 'completed') return 'completed';
    return order.status.replace(/-/g, ' ');
  }

  protected getOrderBoxClass(order: BurgerOrder): string {
    if (order.status === 'pending') return 'order-box status-new';
    if (order.status === 'in-preparation') return 'order-box status-inprep';
    if (order.status === 'ready') return 'order-box status-ready';
    if (order.status === 'completed') return 'order-box status-completed';
    return 'order-box';
  }

  protected getOrderBurgerCount(order: BurgerOrder): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  protected renderError = () => html`<p class="error">Error while loading orders. Please retry later.</p>`;

  protected renderOrder = (order: BurgerOrder, isLeaving = false) => {
    const animClass = isLeaving ? 'fade-out' : '';
    return html`
      <div
        data-order-id="${order.id}"
        class="order-anim ${animClass}"
        @animationend=${isLeaving ? () => this.handleFadeOutEnd(order.id) : undefined}
      >
        <div class="${this.getOrderBoxClass(order)}">
          <div class="order-id">#${order.id.slice(-6)}</div>
          <div class="order-status">
            <div class="order-status-inner">${this.getOrderDisplayStatus(order)}</div>
          </div>
          <div class="order-burger-count">
            ${this.getOrderBurgerCount(order)}
            <span class="burger">${unsafeSVG(burgerSvg)}</span>
          </div>
        </div>
      </div>
    `;
  };

  private handleFadeOutEnd(id: string) {
    this.leavingOrders.delete(id);
    this.requestUpdate();
  }

  protected getNewOrderCount() {
    return this.inProgressOrders.filter((order) => order.status === 'pending').length;
  }

  protected getInPreparationOrderCount() {
    return this.inProgressOrders.filter((order) => order.status === 'in-preparation').length;
  }

  protected getReadyOrderCount() {
    return this.completedOrders.filter((order) => order.status === 'ready').length;
  }

  protected renderDashboard = () => {
    // Merge current and leaving orders for each column
    const inProgressIds = new Set(this.inProgressOrders.map((o) => o.id));
    const completedIds = new Set(this.completedOrders.map((o) => o.id));
    const leavingInProgress = Array.from(this.leavingOrders.values()).filter(
      (o) => !inProgressIds.has(o.id) && (o.status === 'pending' || o.status === 'in-preparation'),
    );
    const leavingCompleted = Array.from(this.leavingOrders.values()).filter(
      (o) => !completedIds.has(o.id) && (o.status === 'completed' || o.status === 'ready'),
    );
    return html`
      <div class="container">
        <div class="dashboard-header">
          <h1>
            Contoso Burgers Orders
            <span class="slice">${unsafeSVG(burgerOutlineSvg)}</span>
          </h1>
          <span class="order-counts">
            <span class="order-count new">
              <span class="count">${this.getNewOrderCount()}</span>
              <span class="status">New</span>
            </span>
            <span class="order-count in-prep">
              <span class="count">${this.getInPreparationOrderCount()}</span>
              <span class="status">In Preparation</span>
            </span>
            <span class="order-count ready">
              <span class="count">${this.getReadyOrderCount()}</span>
              <span class="status">Ready</span>
            </span>
          </span>
        </div>
        <div class="dashboard-columns">
          <div class="orders-column in-progress">
            <div class="orders-column-container">
              <h2>In Progress</h2>
              ${this.inProgressOrders.length === 0 && leavingInProgress.length === 0
                ? nothing
                : repeat(
                    [...this.inProgressOrders, ...leavingInProgress],
                    (order) => order.id,
                    (order) => this.renderOrder(order, !!this.leavingOrders.get(order.id)),
                  )}
            </div>
          </div>
          <div class="orders-column completed">
            <div class="orders-column-container">
              <h2>Ready for Pickup</h2>
              ${this.completedOrders.length === 0 && leavingCompleted.length === 0
                ? nothing
                : repeat(
                    [...this.completedOrders, ...leavingCompleted],
                    (order) => order.id,
                    (order) => this.renderOrder(order, !!this.leavingOrders.get(order.id)),
                  )}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  protected override render() {
    return this.hasError ? this.renderError() : this.renderDashboard();
  }

  static styles = [
    css`
      :host {
        --burger-alt: hsl(from var(--burger-primary) calc(h + 25) s l);
        --burger-primary-bg: hsl(from var(--burger-primary) h s calc(l * 0.25));

        width: 100%;
        height: 100%;
        text-align: center;
        background: #555;
        background-image: radial-gradient(circle at center, #999 0%, #555 100%);
        font-family: 'Sofia Sans Condensed', sans-serif;

        * {
          box-sizing: border-box;
        }
      }
      svg {
        fill: currentColor;
        width: 100%;
      }
      .container {
        display: flex;
        flex-direction: column;
        padding: 2rem;
        height: 100%;
      }
      .dashboard-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2rem;

        h1 {
          background: var(--burger-primary);
          border-radius: 1.5rem;
          padding: 0.5rem 1.5rem;
          box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.15);
          font-size: 2.5rem;
          margin: 0;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
        }
      }
      h1,
      h2,
      p,
      span {
        text-shadow: 0 2px 1px rgba(0, 0, 0, 0.5);
      }
      .slice {
        width: 3rem;
        height: 3rem;
        display: inline-block;
        vertical-align: middle;
        margin-left: 1rem;
        filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.5));
      }
      .order-count {
        background: var(--burger-primary);
        color: #fff;
        font-weight: 700;
        border-radius: 1.5rem;
        padding: 0.5rem 1.5rem;
        font-size: 2.5rem;
        box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.15);
        text-transform: uppercase;
        margin-left: 1.5rem;
        line-height: 2;
        white-space: nowrap;

        .count {
          margin-right: 0.5rem;
        }
        .status {
          font-size: 2rem;
        }
        &.new {
          background: hsl(from var(--burger-primary) calc(h + 200) s l);
        }
        &.in-prep {
          background: hsl(from var(--burger-primary) calc(h + 20) s calc(l * 0.9));
        }
        &.ready {
          background: hsl(from var(--burger-primary) calc(h + 120) s calc(l * 0.7));
        }
      }
      .dashboard-columns {
        flex: 1;
        display: flex;
        gap: 2rem;
        justify-content: center;
        overflow: hidden;
      }
      .orders-column {
        position: relative;
        container: orders-column / inline-size;
        flex: 1 1 0;
        width: 100%;
        display: flex;
        background: var(--burger-primary-bg);
        border-radius: 1.5rem;
        border: 4px solid var(--burger-primary);

        &::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1.5rem;
          pointer-events: none;
          background: linear-gradient(to bottom, transparent, var(--burger-primary-bg) 66%);
          border-radius: 0 0 1.5rem 1.5rem;
          z-index: 2;
          overflow: hidden;
        }
      }
      .orders-column-container {
        padding: 1.5rem;
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.2rem;
        align-content: flex-start;
        overflow-y: auto;

        h2 {
          grid-column: 1 / -1;
          font-size: 2.5rem;
          margin: 0;
          color: var(--burger-alt);
          text-transform: uppercase;
        }
      }
      .order-box {
        background: #fff;
        color: #222;
        border-radius: 1rem;
        margin-bottom: 0;
        padding: 1rem 1.5rem;
        width: 100%;
        font-size: 1.5rem;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);
        opacity: 1;
        transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .status-new .order-status {
        background: hsl(from var(--burger-primary) calc(h + 200) s l);
      }
      .status-inprep .order-status {
        background: hsl(from var(--burger-primary) calc(h + 20) s calc(l * 0.9));
      }
      .status-ready .order-status {
        background: hsl(from var(--burger-primary) calc(h + 120) s calc(l * 0.7));
      }
      .status-completed {
        opacity: 0.5;
        & .order-status {
          background: #777;
        }
      }
      .order-id {
        flex: 1;
        color: var(--burger-alt);
        font-weight: 700;
        font-size: 1.1em;
        text-align: left;
      }
      .order-status {
        flex: 1;
        text-transform: capitalize;
        border-radius: 1rem;
        color: #fff;
        padding: 0.5rem 1rem;
        font-size: 0.8em;
        min-width: 0;
        transition: background 0.5s;
      }
      .order-status-inner {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        width: 100%;
      }
      .order-burger-count {
        flex: 0.75;
        color: #444;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        font-weight: 700;
        font-size: 1.1em;
      }
      .burger {
        width: 2.5rem;
        height: 2.5rem;
        display: inline-block;
        margin-left: 0.5rem;
        margin-top: -0.2rem;
      }
      .order-anim {
        display: flex;
        opacity: 1;
        transform: translateX(0);
        transition:
          opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .order-anim.fade-in {
        animation: fadeInOrder 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .order-anim.fade-out {
        animation: fadeOutOrder 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes fadeInOrder {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes fadeOutOrder {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(20px);
        }
      }
      @media (max-width: 900px) {
        .dashboard-columns {
          flex-direction: column;
        }
      }
      @media (max-width: 1200px) {
        .order-counts {
          display: none;
        }
      }
      @container orders-column (max-width: 600px) {
        .orders-column-container {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'burger-dashboard': BurgerDashboard;
  }
}
