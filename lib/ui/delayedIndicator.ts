export const SEARCH_INDICATOR_DELAY_MS = 250;
export const SEARCH_INDICATOR_MIN_VISIBLE_MS = 400;

export class DelayedIndicator {
  visible = false;

  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt: number | null = null;

  constructor(
    private readonly onChange: (visible: boolean) => void,
    private readonly delayMs = SEARCH_INDICATOR_DELAY_MS,
    private readonly minVisibleMs = SEARCH_INDICATOR_MIN_VISIBLE_MS,
  ) {}

  setActive(active: boolean) {
    this.clearDelay();
    this.clearHide();

    if (active) {
      if (this.visible) {
        return;
      }
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.show();
      }, this.delayMs);
      return;
    }

    if (!this.visible) {
      return;
    }

    const elapsed =
      this.shownAt === null ? this.minVisibleMs : Date.now() - this.shownAt;
    const remaining = Math.max(0, this.minVisibleMs - elapsed);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hide();
    }, remaining);
  }

  dispose() {
    this.clearDelay();
    this.clearHide();
  }

  private show() {
    this.visible = true;
    this.shownAt = Date.now();
    this.onChange(true);
  }

  private hide() {
    this.visible = false;
    this.shownAt = null;
    this.onChange(false);
  }

  private clearDelay() {
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
  }

  private clearHide() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
