export interface BankTransferLine {
  employeeCode: string;
  fullName: string;
  bankAccountNumber: string;
  bankCode: string;
  bankName: string;
  branchName: string;
  amountVnd: number;
  transferNote: string;
}

export interface CostCenterJournalRow {
  costCenterCode: string;
  costCenterName: string;
  accountingRef: string;
  employeeCount: number;
  totalGross: number;
  totalEeInsurance: number;
  totalErInsurance: number;
  totalPit: number;
  totalNetPayable: number;
}

/**
 * Prevents CSV formula injection in Excel/Sheets by prefixing dangerous leading characters.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export class NeutralCsvBankAdapter {
  static export(lines: BankTransferLine[]): string {
    const header = [
      "STT",
      "Ma_NV",
      "Ho_Va_Ten",
      "So_Tai_Khoan",
      "Ma_Ngan_Hang",
      "Ten_Ngan_Hang",
      "Chi_Nhanh",
      "So_Tien_VND",
      "Noi_Dung_Chuyen_Khoan",
    ].join(",");

    const rows = lines.map((line, index) =>
      [
        index + 1,
        escapeCsvCell(line.employeeCode),
        escapeCsvCell(line.fullName),
        escapeCsvCell(line.bankAccountNumber),
        escapeCsvCell(line.bankCode),
        escapeCsvCell(line.bankName),
        escapeCsvCell(line.branchName),
        Math.round(line.amountVnd),
        escapeCsvCell(line.transferNote),
      ].join(",")
    );

    return `\uFEFF${[header, ...rows].join("\r\n")}`;
  }
}

export class CostCenterJournalAdapter {
  static export(rowsData: CostCenterJournalRow[]): string {
    const header = [
      "Ma_Cost_Center",
      "Ten_Bo_Phan_Chi_Phi",
      "Tai_Khoan_Hach_Toan",
      "So_Nhan_Su",
      "Tong_Gross_VND",
      "BHXH_NLD_VND",
      "BHXH_DN_VND",
      "Thue_TNCN_VND",
      "Thuc_Chi_Chuyen_Khoan_VND",
    ].join(",");

    const rows = rowsData.map((r) =>
      [
        escapeCsvCell(r.costCenterCode),
        escapeCsvCell(r.costCenterName),
        escapeCsvCell(r.accountingRef),
        r.employeeCount,
        Math.round(r.totalGross),
        Math.round(r.totalEeInsurance),
        Math.round(r.totalErInsurance),
        Math.round(r.totalPit),
        Math.round(r.totalNetPayable),
      ].join(",")
    );

    return `\uFEFF${[header, ...rows].join("\r\n")}`;
  }
}

