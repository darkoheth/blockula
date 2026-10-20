import { createWallet, expect, test } from "./helpers";
import { addressOf } from "./mock-node";

test("program action prefills follow same-page history navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/programs/pool?do=link_github&handle=first&gist_id=11111111111111111111111111111111");
  const form = page.locator("details.action[open]");
  await expect(form.getByLabel("GitHub handle", { exact: true })).toHaveValue("first");

  // Next's native History API integration updates search params without remounting the page.
  await page.evaluate(() => window.history.pushState(null, "", "?do=link_github&handle=second&gist_id=22222222222222222222222222222222"));
  await expect(form.getByLabel("GitHub handle", { exact: true })).toHaveValue("second");
  await expect(form.getByLabel("Gist id", { exact: true })).toHaveValue("22222222222222222222222222222222");

  await page.goBack();
  await expect(form.getByLabel("GitHub handle", { exact: true })).toHaveValue("first");
  await expect(form.getByLabel("Gist id", { exact: true })).toHaveValue("11111111111111111111111111111111");

  await page.goForward();
  await expect(form.getByLabel("GitHub handle", { exact: true })).toHaveValue("second");
  await expect(form.getByLabel("Gist id", { exact: true })).toHaveValue("22222222222222222222222222222222");
});

test("opening a different action applies its prefill instead of its old empty state", async ({ page }) => {
  await page.goto("/programs/pool?do=link_github&handle=first");
  await expect(page.getByLabel("GitHub handle", { exact: true })).toHaveValue("first");
  await page.evaluate(() => window.history.pushState(null, "", "?do=submit_claim&repo=jackdishman/blockula&pr=49"));
  const form = page.locator("details.action[open]");
  await expect(form.getByLabel("Repository", { exact: true })).toHaveValue("jackdishman/blockula");
  await expect(form.getByLabel("PR number", { exact: true })).toHaveValue("49");

  await page.evaluate(() => window.history.pushState(null, "", "?do=submit_claim"));
  await expect(form.getByLabel("Repository", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("PR number", { exact: true })).toHaveValue("");
});

test("equivalent action links preserve edits when params are reordered or unrelated", async ({ page }) => {
  await page.goto("/programs/pool?do=link_github&handle=first&gist_id=11111111111111111111111111111111");
  const form = page.locator("details.action[open]");
  await form.getByLabel("GitHub handle", { exact: true }).fill("edited");
  await page.evaluate(() => window.history.pushState(null, "", "?gist_id=11111111111111111111111111111111&handle=first&do=link_github&unrelated=1"));
  await expect.poll(() => page.url()).toContain("unrelated=1");
  await expect(form.getByLabel("GitHub handle", { exact: true })).toHaveValue("edited");
});

test("a new payment action link clears the previous preview and leaves signing to the user", async ({ page, node }) => {
  const first = addressOf("a1".repeat(32));
  const second = addressOf("b2".repeat(32));
  await createWallet(page);
  await page.goto(`/programs/accounts?do=transfer&to=${first}&amount=1`);
  const form = page.locator("details.action[open]");
  await form.getByRole("button", { name: "Unlock to sign" }).click();
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(form.getByTestId("action-preview")).toBeVisible();
  const submitted = node.submitted.length;

  await page.evaluate((to) => window.history.pushState(null, "", `?do=transfer&to=${to}&amount=2`), second);
  await expect(form.getByTestId("action-preview")).toHaveCount(0);
  await expect(form.getByLabel("To", { exact: true })).toHaveValue(second);
  await expect(form.getByLabel("Amount", { exact: true })).toHaveValue("2");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(form.getByTestId("signs")).toContainText(second);
  expect(node.submitted).toHaveLength(submitted);
});
