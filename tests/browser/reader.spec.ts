import { expect, test } from "@playwright/test";

const slug = "neutral-atom-compilation";
test("real PDF, panel navigation, editing and reading recovery under the production base path", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`paper/${slug}?view=pdf`);
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  if (await page.locator(".notes-pane").evaluate((el) => el.classList.contains("is-sheet"))) {
    const bar = page.locator(".notes-sheet-bar");
    const contents = await bar.getAttribute("aria-controls");
    await expect(page.locator(`[id="${contents}"]`)).toBeHidden();
  }
  await page.getByRole("button", { name: "Spiegazioni", exact: true }).click();
  // Mobile starts collapsed, desktop starts expanded: explicitly reveal the panel.
  if (!(await page.getByRole("tab", { name: "Mappa", exact: true }).isVisible()))
    await page.getByRole("button", { name: "Spiegazioni", exact: true }).click();
  await page.getByRole("tab", { name: "Mappa", exact: true }).click();
  await page.locator(".paragraph-overlay button").first().click();
  await expect(page.getByRole("tab", { name: "Spiegazioni", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.locator(".toolbar-menu > summary").click();
  await page.getByRole("button", { name: "Nota", exact: true }).click();
  await page.locator(".toolbar-menu > summary").click();
  await page
    .locator(".annotation-layer")
    .first()
    .click({ position: { x: 120, y: 160 }, force: true });
  const editor = page.getByRole("textbox", { name: "Testo della mia nota" });
  await editor.fill("Nota di verifica");
  await page.locator(".toolbar-menu > summary").click();
  await page.getByRole("button", { name: "Aumenta zoom" }).click();
  await page.locator(".toolbar-menu > summary").click();
  await expect(editor).toHaveValue("Nota di verifica");
  await page.getByRole("button", { name: "Fine", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  const savedNote = page.locator(".annotation-note").filter({ hasText: "Nota di verifica" });
  await expect(savedNote).toBeVisible();
  await expect(savedNote).toHaveCSS("color", "rgb(33, 21, 18)");
  await page.screenshot({ path: `test-results/${info.project.name}-reader.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("library keeps the level preference and has no horizontal overflow", async ({
  page,
}, info) => {
  await page.goto("./?sort=__proto__&page=1.5");
  await expect(page.locator(".library-card-link").first()).toBeVisible();
  await page.goto("./");
  await page.getByRole("button", { name: "Base", exact: true }).click();
  await page.locator(".library-card-link").first().click();
  await expect(page.getByRole("combobox", { name: "Livello di spiegazione" })).toHaveValue(
    /beginner/,
  );
  await page.getByRole("link", { name: "Torna alla libreria" }).click();
  await expect(page.getByRole("button", { name: "Base", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `test-results/${info.project.name}-library.png`, fullPage: true });
});

test("keyboard glossary stays readable and returns focus, and search reports its state", async ({
  page,
}) => {
  await page.goto(`paper/${slug}?view=pdf`);
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await page.locator(".paragraph-overlay button").first().click();
  const term = page.locator(".explanation-note.is-active .concept-term").first();
  await term.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => el.dispatchEvent(new Event("scroll")));
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(term).toBeFocused();
  await page.getByRole("button", { name: "Cerca nel PDF", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Testo da cercare nel PDF" })
    .fill("xyz-impossible-result");
  await expect(page.locator(".toolbar-search-count")).toHaveText("Nessun risultato");
});

test("a mistaken review grade and removal can be undone", async ({ page }, info) => {
  await page.goto("./");
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const id = "neutral-atom-compilation:paragraph:p0002";
    localStorage.setItem(
      "paper-reader:user-data",
      JSON.stringify({
        version: 2,
        annotations: {},
        review: {
          [id]: {
            id,
            slug: "neutral-atom-compilation",
            kind: "paragraph",
            refId: "p0002",
            variant: "it-expert",
            addedAt: now,
            updatedAt: now,
            due: now,
            interval: 0,
            ease: 2.5,
            reps: 0,
            lapses: 0,
          },
        },
      }),
    );
  });
  await page.goto("review");
  // Use an actual available passage ID, taken from the paper when necessary.
  if (await page.getByText("Questa card non è più disponibile", { exact: false }).isVisible())
    throw new Error("Review fixture points to a missing passage");
  await page.getByRole("button", { name: /Mostra risposta/ }).click();
  await page.getByRole("button", { name: /La sapevo/ }).click();
  await expect(page.getByText("Valutazione registrata")).toBeVisible();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.getByRole("button", { name: /Mostra risposta/ })).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi dal ripasso", exact: true }).click();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.getByRole("button", { name: /Mostra risposta/ })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-review.png`, fullPage: true });
});

test("page navigation resumes the page without a stale selected passage overriding it", async ({
  page,
}) => {
  await page.goto(`paper/${slug}?view=pdf`);
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await page.locator(".paragraph-overlay button").first().click();
  const number = page.getByRole("textbox", { name: "Pagina del PDF" });
  await number.fill("2");
  await number.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("paper-reader:user-data") ?? "{}").reading?.[
            "neutral-atom-compilation"
          ]?.page,
      ),
    )
    .toBe(2);
  await page.reload();
  await expect(number).toHaveValue("2");
});

test("a long paper supports expanded context and fit controls", async ({ page }, info) => {
  await page.goto("paper/prresearch-6xlb-l92j?view=pdf");
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await page.locator(".paragraph-overlay button").first().click();
  await page.locator(".explanation-note.is-active .reading-context > summary").click();
  await expect(page.locator(".explanation-note.is-active .reading-context[open]")).toBeVisible();
  await page.locator(".toolbar-menu > summary").click();
  await page.getByRole("button", { name: "Adatta larghezza", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adatta larghezza", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const fontSize = page.getByRole("slider", { name: "Dimensione testo spiegazioni" });
  await fontSize.focus();
  await fontSize.press("End");
  await expect(page.locator(".explanation-note.is-active")).toHaveCSS("font-size", "24px");
  await page.locator(".toolbar-menu > summary").click();
  const select = await page.getByRole("combobox", { name: "Livello di spiegazione" }).boundingBox();
  expect(select!.width).toBeGreaterThan(100);
  if (await page.getByRole("button", { name: "Espandi pannello spiegazioni" }).isVisible()) {
    const header = await page.locator(".notes-sheet-header").boundingBox();
    const button = await page
      .getByRole("button", { name: "Espandi pannello spiegazioni" })
      .boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(header!.y);
    expect(button!.y + button!.height).toBeLessThanOrEqual(header!.y + header!.height);
    await page.getByRole("button", { name: "Espandi pannello spiegazioni" }).click();
    await expect(page.locator(".notes-pane")).toHaveClass(/is-full/);
    await expect(page.locator(".pdf-viewer")).toBeHidden();
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-long-reader.png`,
    fullPage: true,
  });
  if (await page.getByRole("button", { name: "Riduci pannello spiegazioni" }).isVisible()) {
    const pageNumber = page.getByRole("textbox", { name: "Pagina del PDF" });
    await pageNumber.fill("2");
    await pageNumber.press("Enter");
    await page.getByRole("button", { name: "Riduci pannello spiegazioni" }).click();
    await expect
      .poll(() => page.locator(".pdf-viewer").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);
    await expect(pageNumber).toHaveValue("2");
  }
});
