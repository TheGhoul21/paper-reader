import { expect, test } from "@playwright/test";

test("development boots React Refresh and serves the real paper data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator(".app-logo")).toBeVisible();
  await page.locator(".library-card-link").first().click();
  await expect(page.getByRole("button", { name: "Inizia dal quadro generale" })).toBeVisible();
  await page.getByRole("link", { name: "Lettore PDF ↗", exact: true }).click();
  await expect(page.locator(".pdf-page canvas").first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Livello di spiegazione" })).toBeVisible();
  expect(errors).toEqual([]);
});
