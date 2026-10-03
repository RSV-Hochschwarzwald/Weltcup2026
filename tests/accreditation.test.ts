import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildPhotoFileNames,
  collectAccreditationHelpers,
  sanitizeNamePart,
} from "@/lib/accreditation";
import { buildAccreditationWorkbook } from "@/lib/accreditationWorkbook";

function helper(id: string, first: string, last: string, photo: string | null = null) {
  return { id, first_name: first, last_name: last, photo_path: photo };
}

describe("Dateinamen für Fotos", () => {
  it("transliteriert Umlaute und entfernt Sonderzeichen", () => {
    expect(sanitizeNamePart("Müller")).toBe("Mueller");
    expect(sanitizeNamePart("Groß")).toBe("Gross");
    expect(sanitizeNamePart("Anne Marie")).toBe("Anne_Marie");
    expect(sanitizeNamePart("O'Brien")).toBe("OBrien");
  });

  it("vergibt bei gleichen Namen eindeutige Dateinamen", () => {
    const names = buildPhotoFileNames([
      { id: "a", firstName: "Max", lastName: "Mustermann" },
      { id: "b", firstName: "Max", lastName: "Mustermann" },
      { id: "c", firstName: "Anna", lastName: "Müller" },
    ]);
    expect(names.get("a")).toBe("Max_Mustermann.jpg");
    expect(names.get("b")).toBe("Max_Mustermann_2.jpg");
    expect(names.get("c")).toBe("Anna_Mueller.jpg");
  });
});

describe("Akkreditierte Helfer", () => {
  it("zählt jede Person nur einmal, nur mit aktiver Schicht, sortiert nach Nachname", () => {
    const max = helper("1", "Max", "Mustermann", "1.jpg");
    const anna = helper("2", "Anna", "Beispiel");
    const cancelled = helper("3", "Karl", "Abgesagt");
    const list = collectAccreditationHelpers([
      { registrations: [{ status: "active", helper: max }, { status: "cancelled", helper: cancelled }] },
      { registrations: [{ status: "active", helper: max }, { status: "active", helper: anna }, { status: "waitlist", helper: cancelled }] },
    ]);

    expect(list.map((h) => h.lastName)).toEqual(["Beispiel", "Mustermann"]);
    expect(list.find((h) => h.id === "1")?.hasPhoto).toBe(true);
    expect(list.find((h) => h.id === "2")?.hasPhoto).toBe(false);
  });
});

describe("Akkreditierungsliste (Excel)", () => {
  it("entspricht dem Layout der Vorlage", async () => {
    const buffer = await buildAccreditationWorkbook(
      [
        { id: "1", firstName: "Max", lastName: "Mustermann", hasPhoto: true, photoFileName: "Max_Mustermann.jpg" },
        { id: "2", firstName: "Anna", lastName: "Beispiel", hasPhoto: false, photoFileName: "Anna_Beispiel.jpg" },
      ],
      { title: "FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026", verein: "RSV Hochschwarzwald e.V.", funktion: "Arbeitseinsatz" }
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]!;

    expect(ws.getCell("A1").value).toBe("FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026");
    expect(ws.getCell("A2").value).toBe("Name Ressort:");
    expect(ws.getCell("A3").value).toBe("Verein:");
    expect(ws.getCell("B3").value).toBe("RSV Hochschwarzwald e.V.");
    expect([1, 2, 3, 4].map((c) => ws.getRow(5).getCell(c).value)).toEqual(["Vorname", "Name", "Funktion", "Bild"]);

    expect([1, 2, 3, 4].map((c) => ws.getRow(6).getCell(c).value)).toEqual([
      "Max", "Mustermann", "Arbeitseinsatz", "Max_Mustermann.jpg",
    ]);
    // Ohne Foto bleibt die Bild-Spalte leer (es gibt keine Datei, die man nennen könnte).
    expect(ws.getRow(7).getCell(4).value ?? "").toBe("");
    expect(ws.getRow(6).height).toBe(100);
    // Umrandete Leerzeilen zum händischen Ergänzen.
    expect(ws.getRow(12).getCell(1).border?.top?.style).toBe("thin");
  });
});
