import { Build, Component, Element, Host, Prop, State, Watch, h } from '@stencil/core';
import { getSvgContent, ioniconContent } from './request';
import { getName, getUrl, inheritAttributes } from './utils';

@Component({
  tag: 'ion-icon',
  assetsDirs: ['svg'],
  styleUrl: 'icon.css',
  shadow: true,
})
export class Icon {
  private documentDirectionObserver?: MutationObserver;
  private io?: IntersectionObserver;
  private iconName: string | null = null;
  private inheritedAttributes: { [k: string]: any } = {};

  @Element() el!: HTMLElement;

  @State() private svgContent?: string;
  @State() private isVisible = false;
  @State() private ariaLabel?: string;
  @State() private direction?: string;

  /**
   * The mode determines which platform styles to use.
   */
  @Prop({ mutable: true }) mode = getIonMode();

  /**
   * The color to use for the background of the item.
   */
  @Prop() color?: string;

  /**
   * Specifies which icon to use on `ios` mode.
   */
  @Prop() ios?: string;

  /**
   * Specifies which icon to use on `md` mode.
   */
  @Prop() md?: string;

  /**
   * Specifies whether the icon should horizontally flip when `dir` is `"rtl"`.
   */
  @Prop() flipRtl?: boolean;

  /**
   * Specifies which icon to use from the built-in set of icons.
   */
  @Prop({ reflect: true }) name?: string;

  /**
   * Specifies the exact `src` of an SVG file to use.
   */
  @Prop() src?: string;

  /**
   * A combination of both `name` and `src`. If a `src` url is detected
   * it will set the `src` property. Otherwise it assumes it's a built-in named
   * SVG and set the `name` property.
   */
  @Prop() icon?: any;

  /**
   * The size of the icon.
   * Available options are: `"small"` and `"large"`.
   */
  @Prop() size?: string;

  /**
   * If enabled, ion-icon will be loaded lazily when it's visible in the viewport.
   * Default, `false`.
   */
  @Prop() lazy = false;

  /**
   * When set to `false`, SVG content that is HTTP fetched will not be checked
   * if the response SVG content has any `<script>` elements, or any attributes
   * that start with `on`, such as `onclick`.
   * @default true
   */
  @Prop() sanitize = true;
  
  componentWillLoad() {
    this.inheritedAttributes = inheritAttributes(this.el, ['aria-label']);
  }

  connectedCallback() {
    // purposely do not return the promise here because loading
    // the svg file should not hold up loading the app
    // only load the svg if it's visible
    this.waitUntilVisible(this.el, '50px', () => {
      this.isVisible = true;
      this.loadIcon();
    });
    this.observeDocumentDirection(() => {
      this.direction = (this.el.ownerDocument as Document).dir;
    });
  }

  disconnectedCallback() {
    if (this.io) {
      this.io.disconnect();
      this.io = undefined;
    }
    if (this.documentDirectionObserver) {
      this.documentDirectionObserver.disconnect();
      this.documentDirectionObserver = undefined;
    }
  }

  private observeDocumentDirection(cb: () => void) {
    if (Build.isBrowser && typeof window !== 'undefined' && (window as any).MutationObserver) {
      this.documentDirectionObserver = new MutationObserver(() => {
        this.direction = (this.el.ownerDocument as Document).dir;
      });
      this.documentDirectionObserver.observe((this.el.ownerDocument as Document).documentElement, {
        attributes: true,
        attributeFilter: ['dir'],
      });
    } else {
      // browser doesn't support MutationObserver
      // so just fallback to always show it
      cb();
    }
  }

  private waitUntilVisible(el: HTMLElement, rootMargin: string, cb: () => void) {
    if (Build.isBrowser && this.lazy && typeof window !== 'undefined' && (window as any).IntersectionObserver) {
      const io = (this.io = new (window as any).IntersectionObserver(
        (data: IntersectionObserverEntry[]) => {
          if (data[0].isIntersecting) {
            io.disconnect();
            this.io = undefined;
            cb();
          }
        },
        { rootMargin },
      ));

      io.observe(el);
    } else {
      // browser doesn't support IntersectionObserver
      // so just fallback to always show it
      cb();
    }
  }
  
  private hasAriaHidden = () => {
    const { el } = this;
    
    return el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true';
  }

  @Watch('name')
  @Watch('src')
  @Watch('icon')
  loadIcon() {
    if (Build.isBrowser && this.isVisible) {
      const url = getUrl(this);
      if (url) {
        if (ioniconContent.has(url)) {
          // sync if it's already loaded
          this.svgContent = ioniconContent.get(url);
        } else {
          // async if it hasn't been loaded
          getSvgContent(url, this.sanitize).then(() => (this.svgContent = ioniconContent.get(url)));
        }
      }
    }

    const label = this.iconName = getName(this.name, this.icon, this.mode, this.ios, this.md);

    /**
     * Come up with a default label
     * in case user does not provide their own.
     */
    if (label) {
      this.ariaLabel = label.replace(/\-/g, ' ');
    }
  }

  render() {
    const { iconName, ariaLabel, inheritedAttributes } = this;
    const mode = this.mode || 'md';
    const flipRtl =
      this.flipRtl ||
      (iconName &&
        (iconName.indexOf('arrow') > -1 || iconName.indexOf('chevron') > -1) &&
        this.flipRtl !== false);

    /**
     * Only set the aria-label if a) we have generated
     * one for the icon and if aria-hidden is not set to "true".
     * If developer wants to set their own aria-label, then
     * inheritedAttributes down below will override whatever
     * default label we have set.
     */
    return (
      <Host
        aria-label={ariaLabel !== undefined && !this.hasAriaHidden() ? ariaLabel : null}
        role="img"
        class={{
          [mode]: true,
          ...createColorClasses(this.color),
          [`icon-${this.size}`]: !!this.size,
          'flip-rtl': !!flipRtl && this.direction === 'rtl',
        }}
        {...inheritedAttributes}
      >
        {Build.isBrowser && this.svgContent ? (
          <div class="icon-inner" innerHTML={this.svgContent}></div>
        ) : (
          <div class="icon-inner"></div>
        )}
      </Host>
    );
  }
}

const getIonMode = () =>
  (Build.isBrowser && typeof document !== 'undefined' && document.documentElement.getAttribute('mode')) || 'md';

const createColorClasses = (color: string | undefined) => {
  return color
    ? {
        'ion-color': true,
        [`ion-color-${color}`]: true,
      }
    : null;
};
