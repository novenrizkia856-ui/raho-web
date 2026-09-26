import "./migration.css";
import "./reference-refinements.css";
import { chainConfig, tokenDisplay, contractsReady } from "../config/index.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, $$, reducedMotion } from "../shared/dom.ts";

const still = reducedMotion();

function initMenu(): void {
  const header = $("header[data-menu]");
  const toggle = $<HTMLButtonElement>("[data-menu-toggle]");
  if (!header || !toggle) return;
  const set = (open: boolean) => {
    header.dataset.menu = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => set(header.dataset.menu !== "open"));
  header.addEventListener("click", (event) => { if ((event.target as Element).closest(".raho-menu a")) set(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") set(false); });
}

function initReveal(): void {
  if (still || !("IntersectionObserver" in window)) return;
  const finals = ["opacity:1;filter:blur(0px);transform:none", "opacity:1;filter:none;transform:none"];
  const items = $$("[style]").filter((el) => finals.includes(el.getAttribute("style") ?? "") && !el.closest("#top"));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";
      el.style.transform = "none";
      observer.unobserve(el);
    }
  }, { rootMargin: "0px 0px -10% 0px", threshold: .1 });
  items.forEach((el, index) => {
    el.style.transition = `opacity .8s ease ${(index % 4) * 90}ms, filter .8s ease ${(index % 4) * 90}ms, transform .8s cubic-bezier(.2,.7,.2,1) ${(index % 4) * 90}ms`;
    el.style.opacity = "0";
    el.style.filter = "blur(10px)";
    el.style.transform = "translateY(20px)";
    observer.observe(el);
  });
}

const stages = [
  ["Account", "Current authentication enters Raho."], ["Detect", "Authentication scheme is identified."],
  ["Prepare Key", "A post quantum key path is prepared."], ["Compatibility", "The migration path is checked."],
  ["Build", "The migration payload is constructed."], ["Execute", "The account transition is requested."],
  ["Verify", "The new account state is checked."], ["Activate", "Post quantum authentication becomes active."],
] as const;

function initPipeline(): void {
  const pipe = $("[data-migration-pipeline]");
  const steps = $$<HTMLButtonElement>("[data-migration-step]");
  if (!pipe || !steps.length) return;
  let current = 0;
  let visible = false;
  const render = () => {
    steps.forEach((step, index) => {
      step.classList.toggle("is-current", index === current);
      step.classList.toggle("is-done", index < current);
      step.setAttribute("aria-pressed", String(index === current));
    });
    $("[data-pipeline-number]")!.textContent = `${String(current + 1).padStart(2, "0")} / 08`;
    $("[data-pipeline-title]")!.textContent = stages[current][0];
    $("[data-pipeline-detail]")!.textContent = stages[current][1];
    const line = $(".raho-pipeline__line span")!;
    line.style.width = `${(current / (stages.length - 1)) * 100}%`;
  };
  steps.forEach((step, index) => step.addEventListener("click", () => { current = index; render(); }));
  render();
  if (still) return;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .2 }).observe(pipe);
  window.setInterval(() => { if (visible) { current = (current + 1) % stages.length; render(); } }, 2700);
}

function initHeroStatus(): void {
  const status = $("[data-hero-verdict]");
  const outcome = $("[data-hero-outcome]");
  if (!status || !outcome) return;
  const labels = [["Detect", "auth.detect()"], ["Prepare", "key.prepare()"], ["Migrate", "raho.migrate()"], ["Verify", "auth.verify()"]];
  let index = 0;
  const render = () => { status.textContent = labels[index][0]; outcome.textContent = labels[index][1]; };
  render();
  if (!still) window.setInterval(() => { index = (index + 1) % labels.length; render(); }, 2600);
}

function initTokenAddress(): void {
  const box = $("[data-token-address]");
  if (!box) return;
  const token = tokenDisplay();
  $("[data-ca-value]", box)!.textContent = token.label;
  const button = $<HTMLButtonElement>("[data-ca-copy]", box)!;
  const toast = $("[data-ca-toast]", box)!;
  const message = $("[data-ca-message]", box)!;
  button.setAttribute("aria-label", token.live ? "Copy token contract address" : "Token contract not deployed yet");
  let timer = 0;
  button.addEventListener("click", async () => {
    message.textContent = token.live ? ((await copyText(token.copyValue)) ? "Copied" : "Copy failed") : "Not deployed yet";
    toast.classList.add("is-shown");
    clearTimeout(timer);
    timer = window.setTimeout(() => toast.classList.remove("is-shown"), 1800);
  });
}

function initDeployment(): void {
  if (!contractsReady()) return;
  const status = $("[data-deploy-status]");
  if (status) status.textContent = `Contracts live on ${chainConfig.chainName}`;
}

initMenu();
initReveal();
initPipeline();
initHeroStatus();
initTokenAddress();
initDeployment();
