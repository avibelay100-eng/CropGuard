import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { healthyResult, lateBlightResult } from "../test/utils";
import { DiagnosisResult } from "./DiagnosisResult";

describe("DiagnosisResult", () => {
  it("shows the disease in Hebrew, English and as a scientific name", () => {
    render(<DiagnosisResult result={lateBlightResult} />);

    expect(screen.getByRole("heading", { level: 2, name: "כימשון" })).toBeInTheDocument();
    expect(screen.getByText("עגבנייה")).toBeInTheDocument();
    expect(screen.getByText("Tomato Late blight")).toHaveAttribute("dir", "ltr");
    const scientific = screen.getByText("Phytophthora infestans");
    expect(scientific).toHaveAttribute("lang", "la");
    expect(scientific).toHaveClass("italic");
    expect(screen.getByText("⚠ נגוע", { exact: false })).toBeInTheDocument();
  });

  it("shows the confidence as a meter and a percentage", () => {
    render(<DiagnosisResult result={lateBlightResult} />);
    const meter = screen.getByRole("meter", { name: "ודאות המודל" });
    expect(meter).toHaveAttribute("value", "89.95");
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("lists active ingredients with the first marked as recommended, and ILS price ranges", () => {
    render(<DiagnosisResult result={lateBlightResult} />);
    const section = screen.getByRole("region", { name: "חומרים פעילים ומחירים" });

    expect(within(section).getByText("מטלקסיל-M + מנקוזב")).toBeInTheDocument();
    expect(within(section).getByText("חומר פעיל מומלץ")).toBeInTheDocument();
    expect(within(section).getByText("Ridomil Gold MZ")).toBeInTheDocument();
    expect(within(section).getByText(/₪110–180/)).toBeInTheDocument();
    expect(within(section).getByText(/₪300–480/)).toBeInTheDocument();
    expect(within(section).getByText(/מחיר משוער שעדיין לא אומת/)).toBeInTheDocument();
  });

  it("shows the treatment guidance, warnings and disclaimer in Hebrew", () => {
    render(<DiagnosisResult result={lateBlightResult} />);
    expect(screen.getByRole("region", { name: "הנחיית טיפול" })).toHaveTextContent("לפנות למדריך מיד");
    expect(screen.getByRole("list", { name: "אזהרות" })).toHaveTextContent("לא אומתו");
    expect(screen.getByText(/אינו מחליף בדיקה של מדריך/)).toBeInTheDocument();
  });

  it("shows a healthy leaf without treatments or a scientific name", () => {
    render(<DiagnosisResult result={healthyResult} />);
    expect(screen.getByText("✓ בריא", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "חומרים פעילים ומחירים" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Phytophthora/)).not.toBeInTheDocument();
    expect(screen.queryByText(/אין טיפול כימי/)).not.toBeInTheDocument();
  });

  it("explains when a disease has no chemical treatment", () => {
    render(
      <DiagnosisResult
        result={{ ...lateBlightResult, chemicalControl: false, treatments: [], warningsHe: [], guidanceHe: "אין ריפוי." }}
      />,
    );
    expect(screen.getByText(/אין טיפול כימי שמרפא את המחלה הזו/)).toBeInTheDocument();
  });

  it("warns when the model is uncertain", () => {
    render(
      <DiagnosisResult
        result={{ ...lateBlightResult, uncertain: true, confidencePercent: 42, warningsHe: ["הוודאות של האבחון נמוכה."] }}
      />,
    );
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "42% - ודאות נמוכה");
    expect(screen.getByText("הוודאות של האבחון נמוכה.")).toBeInTheDocument();
  });
});
