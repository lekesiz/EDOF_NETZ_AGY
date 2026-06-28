/**
 * EDOF — Client Google Sheets (compte de service)
 */
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_TAB = 'Feuille 1';
const RANGE_ALL = `${SHEET_TAB}!A:P`;
const RANGE_KEYS = `${SHEET_TAB}!A:A`;

let _sheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non défini');
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON invalide (JSON malformé)');
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SUIVI_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_SUIVI_ID non défini');
  return id;
}

export type SuiviRow = [
  string, string, string, string, string, string, string, string,
  string, string, string, string, string, string, string, string
];

export async function getExistingExternalIds(): Promise<Set<string>> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: RANGE_KEYS,
  });
  const values = res.data.values || [];
  const set = new Set<string>();
  for (const row of values) {
    const v = (row[0] ?? '').toString().trim();
    if (v) set.add(v);
  }
  return set;
}

export async function appendSuiviRows(rows: SuiviRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE_ALL,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  return rows.length;
}
