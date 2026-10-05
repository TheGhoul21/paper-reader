import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("figure 7 follows each logical block and distinguishes QFT ordering from column transport", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "paper/optimizing-atom-transport-gate-count-and-depth-with?stage=read&step=twine-optimistic-qft-2&v=it-intermediate",
  );
  const figure = page.getByRole("figure", { name: "Figura 7 · pagina 11", exact: true });
  await expect(figure).toBeVisible();
  await expect(figure).toHaveCount(1);
  // The full caption is represented once, even when its first reference precedes it.
  await expect(page.locator("#guided-p-p0127 > p")).toHaveCount(0);
  await figure.getByRole("button", { name: "Blocco B", exact: true }).click();
  await expect(figure.locator(".oqft-selected-state")).toContainText("6 · 8 · 5 · 7");
  const timeline = figure.getByRole("slider", { name: "Passaggio del riordino" });
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".figure-operation")).toHaveText("Ordine logico · QFT");
  await expect(figure.locator(".oqft-selected-state")).toContainText("7 · 5 · 8 · 6");
  await expect(figure.locator(".oqft-block.is-transported")).toHaveCount(0);
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".oqft-selected-state")).toContainText("6 · 8 · 5 · 7");
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".figure-operation")).toHaveText("Spostamento fisico di una colonna");
  await expect(figure.locator(".oqft-block.is-transported")).toHaveCount(2);
  await expect(figure.locator(".oqft-selected-state")).toContainText("6 · 8 · 5 · 7");
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".oqft-final-order")).toContainText(
    "B–A nella prima riga, D–C nella seconda",
  );
  await expect(figure.locator(".oqft-block.is-transported")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await figure.getByRole("button", { name: "Indietro", exact: true }).click();
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".oqft-block-A")).toHaveCSS("transition-duration", "0s");
  await figure.screenshot({ path: `test-results/${info.project.name}-figure7-blocks.png` });
  await figure.locator(".reading-figure-source > summary").click();
  await expect
    .poll(() =>
      figure
        .locator(".reading-figure-original img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThanOrEqual(1200);
  await figure.getByRole("link", { name: "Apri figura nel PDF ↗" }).click();
  await expect(page).toHaveURL(/p=p0127/);
  await expect(page.getByRole("textbox", { name: "Pagina del PDF" })).toHaveValue("11");
  await expect(page.locator(".paragraph-badge-pdf.is-active").first()).toBeVisible();
  await page.getByRole("link", { name: "← Torna al percorso" }).click();
  await expect(figure).toBeVisible();
  expect(new URL(page.url()).searchParams.get("step")).toBe("twine-optimistic-qft-2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("figure 8 contrasts CZ and CZSWAP transport, counters and original source", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "paper/optimizing-atom-transport-gate-count-and-depth-with?stage=read&step=twine-entangling-2&v=it-intermediate",
  );
  const figure = page.getByRole("figure", { name: "Figura 8 · pagina 16", exact: true });
  await expect(figure).toBeVisible();
  await expect(figure.getByRole("button", { name: "(a) CZ", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".transport-atom-A")).toHaveClass(/is-mobile/);
  const timeline = figure.getByRole("slider", { name: "Passaggio del trasporto" });
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".transport-counts dd")).toHaveText(["1", "2", "2", "0", "24 µm"]);
  await expect(figure.locator(".transport-final-state")).toContainText(
    "A nella zona di A, B nella zona di B",
  );
  await figure.getByRole("button", { name: "(b) CZSWAP", exact: true }).click();
  await expect(timeline).toHaveValue("0");
  await figure.getByRole("button", { name: "Riproduci", exact: true }).click();
  await expect(timeline).not.toHaveValue("0");
  await figure.getByRole("button", { name: "Pausa", exact: true }).click();
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".transport-counts dd")).toHaveText(["1", "4", "2", "4", "32 µm"]);
  await expect(figure.locator(".transport-final-state")).toContainText(
    "B nella zona di A, A nella zona di B",
  );
  await expect(figure.locator(".transport-atom.is-mobile")).toHaveCount(0);
  // Rewind the last drop and transport: B passes beside A, using the schematic lane.
  await figure.getByRole("button", { name: "Indietro", exact: true }).click();
  await figure.getByRole("button", { name: "Indietro", exact: true }).click();
  await expect(figure.locator(".transport-atom-B")).toHaveClass(/is-moving/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".transport-atom-B")).toHaveCSS("animation-name", "none");
  await timeline.focus();
  await timeline.press("End");
  await figure.locator(".figure-model-details > summary").click();
  await expect(figure.locator(".figure-model-details")).toContainText("48 µm");
  await figure.screenshot({
    path: `test-results/${info.project.name}-figure8-transport.png`,
    animations: "disabled",
  });
  await figure.locator(".reading-figure-source > summary").click();
  await figure.getByRole("button", { name: "Ingrandisci figura originale" }).click();
  await expect(figure.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(figure.getByRole("button", { name: "Ingrandisci figura originale" })).toBeFocused();
  await figure.getByRole("link", { name: "Apri figura nel PDF ↗" }).click();
  await expect(page).toHaveURL(/p=p0227/);
  await expect(page.getByRole("textbox", { name: "Pagina del PDF" })).toHaveValue("16");
  await expect(page.locator(".paragraph-badge-pdf.is-active").first()).toBeVisible();
  await page.getByRole("link", { name: "← Torna al percorso" }).click();
  expect(new URL(page.url()).searchParams.get("step")).toBe("twine-entangling-2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(
    "paper/optimizing-atom-transport-gate-count-and-depth-with?stage=read&step=twine-appendices-1&v=it-expert",
  );
  await expect(figure).toBeVisible();
  await expect(figure.getByRole("button", { name: "(a) CZ", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

test("figure 2 exposes the actual parity changes, original image and source return", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "paper/optimizing-atom-transport-gate-count-and-depth-with?stage=read&step=logical-interactions&v=it-intermediate",
  );
  const figure = page.getByRole("figure", { name: "Figura 2 · pagina 2", exact: true });
  await expect(figure).toHaveCount(1);
  const timeline = figure.getByRole("slider", { name: "Passaggio del circuito" });
  await expect(timeline).toHaveValue("0");
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".twine-labels dd")).toHaveText([
    "ℓ₁ℓ₂",
    "ℓ₂",
    "ℓ₃",
    "ℓ₄",
    "ℓ₅",
    "ℓ₆",
  ]);
  await figure.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(figure.locator(".twine-labels dd")).toHaveText([
    "ℓ₁ℓ₂",
    "ℓ₁",
    "ℓ₃",
    "ℓ₄",
    "ℓ₅",
    "ℓ₆",
  ]);
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".twine-labels dd")).toHaveText(["ℓ₆", "ℓ₅", "ℓ₄", "ℓ₃", "ℓ₂", "ℓ₁"]);
  await figure.getByRole("button", { name: "(b) Quadrato", exact: true }).click();
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".twine-labels dd")).toHaveText(["ℓ₁", "ℓ₄", "ℓ₃", "ℓ₆", "ℓ₅", "ℓ₂"]);
  await expect(figure.locator(".twine-pair-count")).toHaveText("Coppie comparse: 15 / 15");
  await figure.getByRole("button", { name: "(c) Scala", exact: true }).click();
  await figure.getByRole("button", { name: "Riproduci", exact: true }).click();
  await expect(timeline).not.toHaveValue("0");
  await figure.getByRole("button", { name: "Pausa", exact: true }).click();
  await timeline.focus();
  await timeline.press("End");
  await expect(figure.locator(".twine-labels dd")).toHaveText(["ℓ₆", "ℓ₅", "ℓ₄", "ℓ₃", "ℓ₂", "ℓ₁"]);
  await expect(figure.locator(".twine-pair-count")).toHaveText("Coppie comparse: 15 / 15");
  await figure.screenshot({ path: `test-results/${info.project.name}-figure2-animation.png` });
  await expect(figure.locator(".twine-gate.is-active")).toHaveClass(/twine-role-decoder/);
  if (info.project.name === "mobile")
    expect(
      await figure.locator(".twine-circuit-scroll").evaluate((el) => el.scrollLeft),
    ).toBeGreaterThan(0);
  await figure.locator(".reading-figure-source > summary").click();
  await expect
    .poll(() =>
      figure
        .locator(".reading-figure-original img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThanOrEqual(1200);
  const enlarge = figure.getByRole("button", { name: "Ingrandisci figura originale" });
  await enlarge.click();
  await expect(figure.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(enlarge).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await figure.getByRole("link", { name: "Apri figura nel PDF ↗" }).click();
  await expect(page).toHaveURL(/p=p0018/);
  await expect(page.locator(".paragraph-badge-pdf.is-active").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pagina del PDF" })).toHaveValue("2");
  await page.getByRole("link", { name: "← Torna al percorso" }).click();
  expect(new URL(page.url()).searchParams.get("step")).toBe("logical-interactions");
  await page.goto(
    "paper/optimizing-atom-transport-gate-count-and-depth-with?stage=read&step=ladder-layout&v=it-expert",
  );
  await expect(figure.getByRole("button", { name: "(c) Scala", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

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
