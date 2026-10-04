import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a guided journey keeps doubts, reflection and resume after the final step", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("paper/dascut");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/DAScut/);
  await expect(page.locator(".guided-coverage")).toContainText("6 pagine");
  await page.screenshot({
    path: `test-results/${info.project.name}-guided-arrival.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Inizia dal quadro generale" }).click();
  const firstId = new URL(page.url()).searchParams.get("step")!;
  const term = page.locator(".guided-passage .guided-term").first();
  await term.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(term).toBeFocused();
  await page.getByRole("button", { name: "Da rivedere · continua", exact: true }).click();
  await expect(page.locator(".guided-lesson-location")).toContainText("Tappa 2");
  await page.reload();
  await expect(page.locator(".guided-lesson-location")).toContainText("Tappa 2");
  for (let step = 2; step <= 8; step++) {
    await page
      .getByRole("button", {
        name: step === 8 ? "Mi è chiaro · vai alla sintesi" : "Mi è chiaro · continua",
        exact: true,
      })
      .click();
  }
  await expect(page.getByRole("heading", { name: "Sintesi del paper" })).toBeVisible();
  await expect(page.locator(".guided-finish > .guided-lead")).toContainText(
    "8 di 8 tappe esplorate",
  );
  const reflection = page.getByRole("textbox", { name: "La mia sintesi del paper" });
  await reflection.fill(
    "Il metodo collega taglio, scelta del dispositivo e riuso. Voglio rivedere le prove.",
  );
  await page.reload();
  await expect(reflection).toHaveValue(/Voglio rivedere le prove/);
  await page.getByRole("link", { name: "Torna alla libreria" }).click();
  await page.getByRole("link", { name: "Riprendi il percorso →", exact: true }).click();
  await expect(reflection).toHaveValue(/Voglio rivedere le prove/);
  await page.screenshot({
    path: `test-results/${info.project.name}-guided-summary.png`,
    fullPage: true,
  });
  await page.locator(".guided-revisit").first().click();
  expect(new URL(page.url()).searchParams.get("step")).toBe(firstId);
  await page.getByRole("button", { name: "Mi è chiaro · continua", exact: true }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("paper-reader:user-data")!).journeys.dascut,
  );
  expect(saved.explored).toHaveLength(8);
  expect(saved.doubts).toEqual([]);
  expect(saved.reflection).toContain("Voglio rivedere le prove");
  expect(errors).toEqual([]);
});

test("comparing the original returns to the same guided step and reading position", async ({
  page,
}, info) => {
  await page.goto("paper/phase-gadget-synthesis");
  await page.getByRole("button", { name: "Inizia dal quadro generale" }).click();
  const stepId = new URL(page.url()).searchParams.get("step");
  const source = page.locator(".guided-source").first();
  await source.locator("summary").click();
  await source.getByRole("link").click();
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await expect(page.locator(".paragraph-badge-pdf.is-active").first()).toBeVisible();
  const savedY = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("paper-reader:user-data")!).journeys["phase-gadget-synthesis"]
        .scrollY,
  );
  expect(savedY).toBeGreaterThan(100);
  await page.getByRole("link", { name: "← Torna al percorso" }).click();
  expect(new URL(page.url()).searchParams.get("step")).toBe(stepId);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.locator(".guided-options > summary").click();
  const font = page.getByRole("slider", { name: "Dimensione testo spiegazioni" });
  await font.focus();
  await font.press("End");
  await expect(page.locator(".guided-passage").first()).toHaveCSS("font-size", "24px");
  await page.keyboard.press("Escape");
  await expect(page.locator(".guided-options")).not.toHaveAttribute("open");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-guided-reading.png`,
    fullPage: true,
  });
});

test("a direct link reveals a passage in a long step and all sections remain reachable", async ({
  page,
}, info) => {
  const response = await page.request.get("papers/prresearch-6xlb-l92j/paragraphs.json");
  const paragraphs = await response.json();
  const id = paragraphs[paragraphs.length - 1].id;
  await page.goto(`paper/prresearch-6xlb-l92j?view=guide&p=${id}&v=it-intermediate`);
  const passage = page.locator(`#guided-p-${id}`);
  await expect(passage).toBeVisible();
  await expect(passage).toBeFocused();
  if (await page.locator(".guided-extra-passages").count())
    await expect(page.locator(".guided-extra-passages")).toHaveAttribute("open");
  if (await page.locator(".guided-mobile-route").isVisible()) {
    await page.locator(".guided-mobile-route > summary").click();
    await page.locator(".guided-mobile-route .guided-chapters button").first().click();
  } else await page.locator(".guided-reading-route .guided-chapters button").first().click();
  await expect(page.locator(".guided-lesson-location")).toContainText("Tappa 1");
  await expect(page.locator("[data-guided-heading]")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-guided-long-paper.png`,
    fullPage: true,
  });
});

test("unreadable previous data stays untouched while new guided work can be recovered", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("paper-reader:user-data", "unreadable-old-data"),
  );
  await page.goto("paper/dascut");
  await page.getByRole("button", { name: "Inizia dal quadro generale" }).click();
  await page.getByRole("button", { name: "Da rivedere · continua", exact: true }).click();
  await page
    .locator(".guided-header")
    .getByRole("button", { name: /Sintesi/ })
    .click();
  await page
    .getByRole("textbox", { name: "La mia sintesi del paper" })
    .fill("La sintesi da recuperare");
  await page.locator(".guided-header .guided-options > summary").click();
  await page.getByRole("link", { name: "Apri il lettore PDF ↗", exact: true }).click();
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await page.getByRole("link", { name: "← Torna al percorso" }).click();
  await expect(page.getByRole("textbox", { name: "La mia sintesi del paper" })).toHaveValue(
    "La sintesi da recuperare",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica il nuovo percorso" }).click();
  const downloaded = await pending;
  const path = await downloaded.path();
  const backup = JSON.parse(await readFile(path!, "utf8"));
  expect(backup.version).toBe(1);
  expect(backup.journeys.dascut.reflection).toBe("La sintesi da recuperare");
  expect(backup.journeys.dascut.doubts).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("paper-reader:user-data"))).toBe(
    "unreadable-old-data",
  );
  const recoveredContext = await page
    .context()
    .browser()!
    .newContext({ viewport: page.viewportSize() });
  try {
    const recovered = await recoveredContext.newPage();
    await recovered.goto(new URL("../review", page.url()).href);
    await recovered.locator('.review-backup input[type="file"]').setInputFiles(path!);
    await expect(recovered.getByText(/Backup importato: 1 percorso/)).toBeVisible();
    await recovered.goto(new URL("../", page.url()).href);
    await recovered.getByRole("link", { name: "Riprendi il percorso →", exact: true }).click();
    await expect(recovered.getByRole("textbox", { name: "La mia sintesi del paper" })).toHaveValue(
      "La sintesi da recuperare",
    );
  } finally {
    await recoveredContext.close();
  }
});
