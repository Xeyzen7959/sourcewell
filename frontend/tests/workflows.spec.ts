import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name, exact: true }).click();
}

test("recorded answer, exact source, handoff, and persisted specialist review", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#ask");
  await expect(
    page.getByRole("heading", { name: /Good answers start/ }),
  ).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS && testInfo.project.name === "desktop") {
    await page.screenshot({
      path: "../docs/screenshots/workspace.png",
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("A first-time workspace subscription is eligible", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded example", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View source: Refund policy" })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("14 calendar days");
  await expect(dialog).toContainText("exact saved passage");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: `../docs/screenshots/answer-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Ask a specialist" }).click();
  await page
    .getByLabel("What needs a closer look?")
    .fill("Please confirm the refund eligibility.");
  await page.getByRole("button", { name: "Save handoff" }).click();
  await expect(
    page.getByText("Handoff saved in your session’s inbox."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open inbox" }).click();
  await page.locator(".ticket-row").first().click();
  await page
    .getByLabel("Internal review note")
    .fill("Reviewed the 14-day first-payment policy.");
  await page
    .getByLabel("Draft reply")
    .fill("Please share your invoice number through your authorized account.");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("resolved");
  await page.getByRole("button", { name: "Save ticket" }).click();
  await expect(page.getByText("Ticket updates saved.")).toBeVisible();
  await page.reload();
  await page.locator(".ticket-row").first().click();
  await expect(page.getByLabel("Internal review note")).toHaveValue(
    "Reviewed the 14-day first-payment policy.",
  );
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("resolved");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("knowledge search, preview, administration, and honest evaluation state", async ({
  page,
}) => {
  await page.goto("/#ask");
  await navigate(page, "Knowledge");
  await page.getByRole("textbox", { name: "Search documents" }).fill("refund");
  await expect(page.locator(".document-row")).toHaveCount(1);
  await page.locator(".document-row").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Renewals and prorated seat charges are non-refundable",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Administrator access" }).click();
  await page.getByLabel("Administrator token").fill("e2e-test-only");
  await page.getByRole("button", { name: "Save access" }).click();
  await page.getByRole("textbox", { name: "Search documents" }).fill("");
  await page.getByLabel("Upload document file").setInputFiles({
    name: "test-guide.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Test guide\n\nThis temporary guide exercises the real ingestion path.",
    ),
  });
  await expect(page.getByText("Document operation completed.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search documents" })
    .fill("test-guide");
  await expect(page.locator(".document-row")).toHaveCount(1);
  await page.locator(".document-row").click();
  await expect(page.getByRole("dialog")).toContainText("temporary guide");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("No matching documents")).toBeVisible();
  await navigate(page, "Evaluation lab");
  await expect(page.getByText("The benchmark has not been run.")).toBeVisible();
  await expect(
    page.getByText("AI-drafted · Human review required"),
  ).toBeVisible();
  await page.getByLabel("Dataset split").selectOption("held_out");
  await page.locator(".eval-cases button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Requires human review");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("conflicting evidence and missing personal data remain explicit", async ({
  page,
}) => {
  await page.goto("/#ask");
  await page
    .getByLabel("Support question")
    .selectOption(
      "Which retention period applies after cancellation: 30 or 60 days?",
    );
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("Sources disagree", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".source-link")).toHaveCount(2);
  await page
    .getByLabel("Support question")
    .selectOption("What was my personal invoice total last month?");
  await page
    .getByRole("button", { name: "Ask Sourcewell", exact: true })
    .click();
  await expect(
    page.getByText("More evidence needed", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".source-link")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Live AI/ })).toBeDisabled();
});
