/** Mobile menu, the jump rail and section tracking. */
import { $, $$ } from "../shared/dom.ts";

export function initHeader(): void {
  const header = $(".rh-header");
  const burger = $<HTMLButtonElement>(".rh-header__burger");
  if (header && burger) {
    const set = (open: boolean) => {
      header.dataset.menu = open ? "open" : "closed";
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", () => set(header.dataset.menu !== "open"));
    header.addEventListener("click", (event) => {
      if ((event.target as Element).closest(".rh-header__menu a")) set(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.dataset.menu === "open") {
        set(false);
        burger.focus();
      }
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", () => set(false));
  }

  const rail = $(".rh-jump");
  const railLinks = $$<HTMLAnchorElement>("[data-jump]");
  const navLinks = $$<HTMLAnchorElement>(".rh-navlink");
  const sections = railLinks.map((a) => document.getElementById(a.dataset.jump!)).filter((s): s is HTMLElement => !!s);
  if (!sections.length) return;

  let active = "";
  const mark = (id: string) => {
    if (id === active) return;
    active = id;
    for (const a of railLinks) a.toggleAttribute("aria-current", a.dataset.jump === id);
    for (const a of navLinks) {
      if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
    rail?.classList.toggle("is-visible", id !== "top");
  };

  // The current section is the last one whose top has crossed 40% of the viewport.
  let frame = 0;
  const update = () => {
    frame = 0;
    const line = window.innerHeight * 0.4;
    let id = sections[0].id;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = sections[sections.length - 1].id;
    mark(id);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}
