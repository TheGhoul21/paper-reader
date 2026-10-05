import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("home searches real aliases and identifiers without downloading paper content", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Libreria", exact: true })).toBeVisible();
  await expect(page.locator(".home-paper-grid .library-card")).toHaveCount(4);
  await expect(page.locator(".home-concepts > li")).toHaveCount(8);
  expect(
    requests.some((url) =>
      /\/(?:meta|paragraphs|concepts|structure)\.json|source\/paper\.pdf/.test(url),
    ),
  ).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${info.project.name}-homepage.png`, fullPage: true });
  await page.getByRole("searchbox").fill("taglio dei circuiti");
  await page.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog\?q=/);
  await expect(page.getByRole("heading", { name: /^DAScut:/ })).toBeVisible();
  await page.getByRole("searchbox").fill("https://doi.org/10.1103/6xlb-l92j");
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(1);
  await expect(page.locator(".library-identifier")).toHaveText("10.1103/6xlb-l92j");
  await page.getByRole("searchbox").fill("https://arxiv.org/abs/2501.14020");
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(1);
  await expect(page.locator(".library-identifier")).toHaveText("2501.14020");
  await page.screenshot({ path: `test-results/${info.project.name}-catalog.png`, fullPage: true });
  await page.getByRole("button", { name: "Cancella ricerca", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(page.getByRole("searchbox")).toHaveValue("");
});

test("concept links, filters, direct reload and source comparison retain the catalog query", async ({
  page,
}) => {
  await page.goto("./");
  const concept = page.locator(".home-concepts a").first();
  const href = await concept.getAttribute("href");
  await concept.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByRole("button", { name: /^Rimuovi filtro/ }).first()).toBeVisible();
  await page.goto("catalog?concept=circuit-cutting&level=beginner&q=DAScut");
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("DAScut");
  await page.locator(".library-card-link").click();
  await expect(page.getByRole("combobox", { name: "Livello di spiegazione" })).toHaveValue(
    "it-beginner",
  );
  await page.getByRole("link", { name: "Torna alla libreria" }).click();
  await expect(page).toHaveURL(/\/catalog\?concept=circuit-cutting&level=beginner&q=DAScut/);
  await expect(page.getByRole("searchbox")).toHaveValue("DAScut");
  await page.getByRole("link", { name: "PDF originale ↗" }).click();
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await page.getByRole("link", { name: "Torna alla libreria" }).click();
  await expect(page).toHaveURL(/\/catalog\?concept=circuit-cutting&level=beginner&q=DAScut/);
  await page.getByRole("button", { name: "Rimuovi filtro Base", exact: true }).click();
  await expect(page).not.toHaveURL(/level=/);
  await expect(page.getByRole("searchbox")).toHaveValue("DAScut");
  await page.getByRole("searchbox").fill("nessun-risultato-esistente");
  await expect(page.getByText("Nessun paper trovato.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mostra tutti i paper" }).click();
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(
    JSON.parse(readFileSync("papers/index.json", "utf8")).length,
  );
});

test("thousands of catalog entries keep results and pagination bounded", async ({ page }, info) => {
  const catalog = JSON.parse(readFileSync("papers/catalog-index.json", "utf8"));
  const template = catalog.papers[0];
  catalog.papers = Array.from({ length: 1000 }, (_, index) => ({
    ...template,
    slug: `fixture-${String(index).padStart(4, "0")}`,
    title: `Paper ${String(index).padStart(4, "0")}`,
  }));
  await page.route("**/papers/catalog-index.json", (route) => route.fulfill({ json: catalog }));
  await page.goto("catalog?sort=title&page=25");
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(20);
  await expect(page.getByRole("status")).toHaveText("1000 paper · 481–500");
  await expect(page.locator(".library-page-btn[aria-current='page']")).toHaveText("25");
  await expect(page.locator(".library-pagination button")).toHaveCount(7);
  await expect(page.locator(".library-page-gap")).toHaveCount(2);
  if (info.project.name === "mobile") {
    await expect(page.locator(".catalog-filter-panel")).not.toHaveAttribute("open");
    await page.locator(".catalog-filter-panel > summary").click();
  }
  await page.getByRole("button", { name: "Base", exact: true }).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(
    page.getByRole("button", { name: "Rimuovi filtro Base", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pagina 50", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("1000 paper · 981–1000");
  await expect(page.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-catalog-thousands.png`,
    fullPage: true,
  });
  await page.goto("./?q=Paper+0999&sort=title");
  await expect(page).toHaveURL(/\/catalog\?q=Paper\+0999&sort=title/);
  await expect(page.locator(".catalog-results .library-card")).toHaveCount(1);
});
