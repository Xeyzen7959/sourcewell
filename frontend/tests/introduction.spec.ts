import { expect, test } from "@playwright/test";

test("introduction offers a usable demo, actual screenshot, and honest pending results", async ({
  page,
}, testInfo) => {
  // Public test data stays unreviewed when the local review-form test runs.
  await page.goto("http://127.0.0.1:8002/");
  await expect(
    page.getByRole("heading", { name: /An answer is better/ }),
  ).toBeVisible();
  const image = page.getByAltText(/Actual Sourcewell workspace/);
  await expect(image).toBeVisible();
  expect(
    await image.evaluate(
      (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Inspect the results" }).click();
  await expect(
    page.getByText("Evaluation pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No live quality scores are available yet."),
  ).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: `../docs/screenshots/introduction-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Try the demo", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /Good answers start/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("Recorded example", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("local reviewer must inspect and attest before an annotation is saved", async ({
  page,
}) => {
  await page.goto("/#evaluation");
  await page.locator(".eval-cases button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Annotated evidence");
  await page
    .getByRole("button", { name: "Save human review" })
    .isDisabled()
    .then((value) => expect(value).toBe(true));
  await page
    .getByLabel("Reviewer name", { exact: true })
    .fill("Browser Test Reviewer — simulated input");
  await page
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("Automated UI test of human input; not real dataset validation.");
  await page
    .getByLabel("Administrator token", { exact: true })
    .fill("e2e-test-only");
  await page
    .getByLabel(
      "I personally checked these annotations against the source documents.",
    )
    .check();
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByText(/Human review saved/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export human reviews" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("reviews.json");
});

test("public demo exposes seed documents and disables all administration", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:8002/");
  await page
    .getByRole("button", { name: "Try the demo", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("Recorded example", { exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "Knowledge", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Administrator access" }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post("http://127.0.0.1:8002/api/index", {
        headers: { "X-Admin-Token": "must-not-grant-public-admin" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get("http://127.0.0.1:8002/api/reviews-export")
    ).status(),
  ).toBe(403);
  const docs = await page.request.get("http://127.0.0.1:8002/api/documents");
  expect(
    (await docs.json()).every((doc: { seeded: boolean }) =>
      Boolean(doc.seeded),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("exhausted budget offers a deliberate recorded-mode path", async ({
  page,
}) => {
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: {
        ...(await response.json()),
        live_available: true,
        live_status: "budget_exhausted",
      },
    });
  });
  await page.goto("/#ask");
  await expect(
    page.getByText("Daily limit reached", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Live AI/ })).toBeDisabled();
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("Recorded example", { exact: true }),
  ).toBeVisible();
});
