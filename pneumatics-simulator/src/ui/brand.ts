import compactUrl from "@/kit/assets/brand/wordmark-compact.svg";
import headerUrl from "@/kit/assets/brand/header-lockup.svg";

/** Illustrated pixel header (UI_DESIGN_BIBLE §5). Compact wordmark below 700px. */
export function mountBrand(host: HTMLElement): void {
  host.innerHTML = `
    <picture>
      <source media="(max-width: 700px)" srcset="${compactUrl}" />
      <img class="header-lockup" src="${headerUrl}"
        alt="Pneumatic Simulator — learn, build, simulate, explore" />
    </picture>`;
}
