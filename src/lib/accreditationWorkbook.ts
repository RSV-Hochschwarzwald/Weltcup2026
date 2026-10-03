import ExcelJS from "exceljs";
import type { AccreditationHelper } from "@/lib/accreditation";

const BLANK_ROWS_AT_END = 5;
const THIN_BLACK = { style: "thin", color: { argb: "FF000000" } } as const;
const BORDER = { top: THIN_BLACK, left: THIN_BLACK, bottom: THIN_BLACK, right: THIN_BLACK };

/**
 * Baut die Akkreditierungsliste im Layout der FIS-Vorlage:
 * Titelzeile, "Name Ressort:" / "Verein:", danach die Tabelle
 * Vorname | Name | Funktion | Bild mit hohen, umrandeten Zeilen.
 */
export async function buildAccreditationWorkbook(
  helpers: AccreditationHelper[],
  options: { title: string; verein: string; funktion: string }
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.verein;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Akkreditierung");
  sheet.columns = [{ width: 21 }, { width: 25 }, { width: 67 }, { width: 22 }];

  sheet.getCell("A1").value = options.title;
  sheet.getCell("A1").font = { bold: true, size: 13 };
  sheet.getCell("A2").value = "Name Ressort:";
  sheet.getCell("A2").font = { bold: true, size: 12 };
  sheet.getCell("A3").value = "Verein:";
  sheet.getCell("A3").font = { bold: true, size: 12 };
  sheet.getCell("B3").value = options.verein;

  const headerRow = sheet.getRow(5);
  ["Vorname", "Name", "Funktion", "Bild"].forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 12 };
    cell.border = BORDER;
  });
  headerRow.height = 22;

  let rowNumber = 6;
  const addRow = (values: [string, string, string, string]) => {
    const row = sheet.getRow(rowNumber++);
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.border = BORDER;
      cell.alignment = { vertical: "bottom", wrapText: true };
    });
    row.height = 100;
  };

  for (const h of helpers) {
    addRow([h.firstName, h.lastName, options.funktion, h.hasPhoto ? h.photoFileName : ""]);
  }
  // Leere, umrandete Zeilen zum Nachtragen weiterer Personen von Hand.
  for (let i = 0; i < BLANK_ROWS_AT_END; i++) addRow(["", "", "", ""]);

  sheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return workbook.xlsx.writeBuffer();
}
