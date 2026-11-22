import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { farmer, lateBlightResult, renderApp } from "../test/utils";

const lateBlight = {
  disease: lateBlightResult.disease,
  plant: "Tomato",
  pathogenType: "oomycete",
  pathogenTypeHe: "פטרייה מדומה (אואומיצט)",
  symptomsHe: "כתמים ספוגי-מים אפורים-ירקרקים שמכהים מהר.",
  preventionHe: "שתילים בריאים וזנים עמידים.",
  guidanceHe: "כימשון: לפנות למדריך מיד.",
  chemicalControl: true,
  treatments: lateBlightResult.treatments,
  sources: ["https://extension.umn.edu/disease-management/late-blight"],
};

const commonRust = {
  disease: {
    modelLabel: "Corn___Common_rust",
    plantHe: "תירס",
    nameHe: "חלדון מצוי",
    displayNameHe: "תירס – חלדון מצוי",
    nameEn: "Corn Common rust",
    scientificName: "Puccinia sorghi",
  },
  plant: "Corn",
  pathogenType: "fungus",
  pathogenTypeHe: "פטרייה",
  symptomsHe: "פצעונים אבקתיים בצבע קינמון.",
  preventionHe: "זנים עמידים.",
  guidanceHe: "בשדות רבים אין צורך בטיפול.",
  chemicalControl: true,
  treatments: [],
  sources: ["https://extension.umn.edu/corn-pest-management/common-rust-corn"],
};

const healthyTomato = {
  ...lateBlight,
  disease: { ...lateBlight.disease, modelLabel: "Tomato___Healthy", nameHe: "בריא", displayNameHe: "עגבנייה – בריא", scientificName: null },
  pathogenType: "healthy",
  pathogenTypeHe: "בריא",
  treatments: [],
};

const library = { entries: [lateBlight, commonRust, healthyTomato] };

const renderLibrary = () => renderApp("/library", { user: farmer, routes: [{ path: "/library", body: library }] });

describe("library page", () => {
  it("shows a card for every entry, with Hebrew, Latin and pathogen type", async () => {
    renderLibrary();
    const grid = await screen.findByRole("list", { name: "מחלות ומזיקים" });
    const cards = within(grid).getAllByRole("button");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("כימשון");
    expect(cards[0]).toHaveTextContent("Phytophthora infestans");
    expect(cards[0]).toHaveTextContent("פטרייה מדומה");
    expect(screen.getByText("3 מצבים")).toBeInTheDocument();
  });

  it("filters by crop, by pathogen type and by free text (Hebrew, English or Latin)", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("list", { name: "מחלות ומזיקים" });

    await user.selectOptions(screen.getByLabelText("גידול"), "Corn");
    expect(screen.getAllByRole("button", { name: /חלדון/ })).toHaveLength(1);
    expect(screen.getByText("נמצאו 1 מתוך 3")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("גידול"), "");
    await user.click(screen.getByLabelText("בריא"));
    expect(within(screen.getByRole("list", { name: "מחלות ומזיקים" })).getAllByRole("button")).toHaveLength(1);

    await user.click(screen.getByLabelText("הכול"));
    await user.type(screen.getByLabelText("חיפוש"), "puccinia");
    expect(within(screen.getByRole("list", { name: "מחלות ומזיקים" })).getAllByRole("button")).toHaveLength(1);

    await user.clear(screen.getByLabelText("חיפוש"));
    await user.type(screen.getByLabelText("חיפוש"), "אין כזה");
    expect(screen.getByText(/אין מצב שמתאים לחיפוש/)).toBeInTheDocument();
  });

  it("opens a dialog with symptoms, prevention, guidance and ILS prices, and closes it", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: /כימשון/ }));

    const dialog = screen.getByRole("dialog", { name: "כימשון" });
    expect(dialog).toHaveTextContent("כתמים ספוגי-מים");
    expect(dialog).toHaveTextContent("שתילים בריאים וזנים עמידים");
    expect(dialog).toHaveTextContent("לפנות למדריך מיד");
    expect(within(dialog).getByText(/₪110–180/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "extension.umn.edu" })).toHaveAttribute("target", "_blank");

    await user.click(within(dialog).getByRole("button", { name: "סגירה" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is reachable from the navigation", async () => {
    const user = userEvent.setup();
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }, { path: "/library", body: library }] });
    const nav = (await screen.findAllByRole("navigation", { name: "ניווט ראשי" }))[0];
    await user.click(within(nav).getByRole("link", { name: "ספרייה" }));
    expect(await screen.findByRole("heading", { level: 1, name: "ספריית מחלות ומזיקים" })).toBeInTheDocument();
  });
});
