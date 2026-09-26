/**
 * Token Contract Address field. The value always comes from src/config.
 * While there is no token it reads "Coming Soon" and copies nothing.
 */
import { tokenDisplay } from "../config/index.ts";
import { copyText } from "./clipboard.ts";
import { $, $$ } from "./dom.ts";

export function initContractAddress(): void {
  for (const root of $$("[data-contract-address]")) {
    const token = tokenDisplay();
    const value = $("[data-ca-value]", root);
    const button = $<HTMLButtonElement>("[data-ca-copy]", root);
    const status = $(".rh-ca__status", root);
    if (!value || !button || !status) continue;

    value.textContent = token.label;
    value.title = token.live ? token.label : "";
    root.dataset.live = String(token.live);
    button.setAttribute("aria-label", token.live ? "Copy token contract address" : "Copy token contract address. Not available yet");

    let timer = 0;
    const say = (text: string) => {
      status.textContent = text;
      status.classList.add("is-shown");
      clearTimeout(timer);
      timer = window.setTimeout(() => status.classList.remove("is-shown"), 1800);
    };

    button.addEventListener("click", async () => {
      if (!token.live) return say("Not available yet");
      say((await copyText(token.copyValue)) ? "Copied" : "Copy failed");
    });
  }
}
