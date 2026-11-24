import {
  CompanyResearch,
  CoverLetterDocument,
  DriveExportFormat,
  JobApplication,
  ResumeDocument,
} from '../types/career';
import { buildCoverLetterDocxBlob, buildCoverLetterPdfBlob } from './coverLetterExport';
import {
  buildCompanyReportPdfBlob,
  buildCompanyReportTextBlob,
  sanitizeFilename,
} from './exportHelpers';
import { buildResumeDocxBlob, buildResumePdfBlob } from './resumeExport';

export const CAREER_ENGINE_DRIVE_FOLDER_NAME = 'Career Engine DOC';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_MIME_TYPE = 'text/plain; charset=utf-8';

export class DriveAuthExpiredError extends Error {
  status: number;

  constructor(message = 'Google Drive permission expired or not granted.', status = 401) {
    super(message);
    this.name = 'DriveAuthExpiredError';
    this.status = status;
  }
}

export class DriveApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
  }
}

export interface DriveFolderRef {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId: string;
  folderName: string;
  folderWebViewLink?: string;
  exportedAt: string;
}

export function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function buildDriveJobSubfolderName(job?: JobApplication): string | undefined {
  if (!job) return undefined;
  const company = job.company.trim();
  const title = job.jobTitle.trim();
  const raw = [company, title].filter(Boolean).join(' - ');
  if (!raw) return undefined;
  return raw.replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function buildDriveExportFilename(params: {
  title: string;
  fallback: string;
  version?: number;
  format: DriveExportFormat;
  isResearch?: boolean;
}): string {
  const base = sanitizeFilename(params.title, params.fallback);
  const versionSuffix =
    typeof params.version === 'number' && params.version > 0 ? `_v${params.version}` : '';
  const stem = `${base}${versionSuffix}`;

  if (params.format === 'google_doc') {
    return stem;
  }
  if (params.isResearch) {
    return params.format === 'pdf' ? `${stem}.pdf` : `${stem}.txt`;
  }
  return params.format === 'pdf' ? `${stem}.pdf` : `${stem}.docx`;
}

async function parseDriveErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `Google Drive request failed (HTTP ${res.status}).`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json?.error?.message) {
        return json.error.message;
      }
    } catch {
      // Plain text error
    }
    return text.slice(0, 240);
  } catch {
    return `Google Drive request failed (HTTP ${res.status}).`;
  }
}

async function assertDriveOk(res: Response): Promise<void> {
  if (res.ok) return;
  const msg = await parseDriveErrorMessage(res);
  if (res.status === 401) {
    throw new DriveAuthExpiredError(
      'Google Drive session expired. Reconnect Google Drive to continue.',
      401
    );
  }
  if (
    res.status === 403 &&
    /insufficient|permission|scope|auth|unauthorized|credentials/i.test(msg)
  ) {
    throw new DriveAuthExpiredError(
      'Google Drive permission is missing or expired. Reconnect Google Drive to grant access.',
      403
    );
  }
  throw new DriveApiError(msg, res.status);
}

export async function findOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderRef> {
  const escaped = escapeDriveQueryLiteral(folderName);
  const parentClause = parentId
    ? ` and '${escapeDriveQueryLiteral(parentId)}' in parents`
    : ` and 'root' in parents`;
  const q = `name = '${escaped}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false${parentClause}`;

  const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&pageSize=5&spaces=drive`;

  const listRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  await assertDriveOk(listRes);

  const listData = (await listRes.json()) as {
    files?: Array<{ id?: string; name?: string; webViewLink?: string }>;
  };
  const existing = listData.files?.find((f) => Boolean(f.id));
  if (existing?.id) {
    return {
      id: existing.id,
      name: existing.name || folderName,
      webViewLink:
        existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }

  const createPayload: Record<string, unknown> = {
    name: folderName,
    mimeType: FOLDER_MIME_TYPE,
  };
  if (parentId) {
    createPayload.parents = [parentId];
  }

  const createRes = await fetch(`${DRIVE_FILES_ENDPOINT}?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });
  await assertDriveOk(createRes);

  const created = (await createRes.json()) as {
    id?: string;
    name?: string;
    webViewLink?: string;
  };
  if (!created.id) {
    throw new DriveApiError('Google Drive did not return an ID for the created folder.');
  }

  return {
    id: created.id,
    name: created.name || folderName,
    webViewLink:
      created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

export async function findOrCreateCareerEngineFolder(
  accessToken: string
): Promise<DriveFolderRef> {
  return findOrCreateDriveFolder(accessToken, CAREER_ENGINE_DRIVE_FOLDER_NAME);
}

function buildMultipartBody(params: {
  metadata: Record<string, unknown>;
  blob: Blob;
  sourceMimeType: string;
}): { body: Blob; contentType: string } {
  const boundary = `ce_drive_${crypto.randomUUID().replace(/-/g, '')}`;
  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(params.metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${params.sourceMimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  return {
    body: new Blob([preamble, params.blob, closing], {
      type: `multipart/related; boundary=${boundary}`,
    }),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

export async function uploadDocumentToDrive(params: {
  accessToken: string;
  blob: Blob;
  filename: string;
  sourceMimeType: string;
  targetMimeType?: string;
  subfolderName?: string;
  existingFileIdToReplace?: string;
}): Promise<DriveUploadResult> {
  const rootFolder = await findOrCreateCareerEngineFolder(params.accessToken);
  let targetFolder = rootFolder;

  if (params.subfolderName && params.subfolderName.trim()) {
    targetFolder = await findOrCreateDriveFolder(
      params.accessToken,
      params.subfolderName.trim(),
      rootFolder.id
    );
  }

  const isReplacing = Boolean(params.existingFileIdToReplace);
  const metadata: Record<string, unknown> = {
    name: params.filename,
  };
  if (!isReplacing) {
    metadata.parents = [targetFolder.id];
  }
  if (params.targetMimeType) {
    metadata.mimeType = params.targetMimeType;
  }

  const { body, contentType } = buildMultipartBody({
    metadata,
    blob: params.blob,
    sourceMimeType: params.sourceMimeType,
  });

  const url = isReplacing
    ? `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(
        params.existingFileIdToReplace!
      )}?uploadType=multipart&fields=id,name,webViewLink,mimeType`
    : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,webViewLink,mimeType`;

  const uploadRes = await fetch(url, {
    method: isReplacing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': contentType,
    },
    body,
  });
  await assertDriveOk(uploadRes);

  const uploaded = (await uploadRes.json()) as {
    id?: string;
    name?: string;
    webViewLink?: string;
  };
  if (!uploaded.id) {
    throw new DriveApiError('Google Drive upload succeeded without returning a file ID.');
  }

  return {
    fileId: uploaded.id,
    fileName: uploaded.name || params.filename,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    folderId: rootFolder.id,
    folderName: targetFolder.id === rootFolder.id ? rootFolder.name : `${rootFolder.name} / ${targetFolder.name}`,
    folderWebViewLink: rootFolder.webViewLink,
    exportedAt: new Date().toISOString(),
  };
}

export async function exportResumeToGoogleDrive(params: {
  accessToken: string;
  resume: ResumeDocument;
  format: DriveExportFormat;
  linkedJob?: JobApplication;
  organizeByJobFolder?: boolean;
  existingFileIdToReplace?: string;
}): Promise<DriveUploadResult> {
  const filename = buildDriveExportFilename({
    title: params.resume.name,
    fallback: 'Resume',
    version: params.resume.version,
    format: params.format,
  });

  const subfolderName = params.organizeByJobFolder
    ? buildDriveJobSubfolderName(params.linkedJob)
    : undefined;

  if (params.format === 'pdf') {
    const blob = buildResumePdfBlob(params.resume);
    return uploadDocumentToDrive({
      accessToken: params.accessToken,
      blob,
      filename,
      sourceMimeType: PDF_MIME_TYPE,
      subfolderName,
      existingFileIdToReplace: params.existingFileIdToReplace,
    });
  }

  const docxBlob = await buildResumeDocxBlob(params.resume);
  return uploadDocumentToDrive({
    accessToken: params.accessToken,
    blob: docxBlob,
    filename,
    sourceMimeType: DOCX_MIME_TYPE,
    targetMimeType: params.format === 'google_doc' ? GOOGLE_DOC_MIME_TYPE : undefined,
    subfolderName,
    existingFileIdToReplace: params.existingFileIdToReplace,
  });
}

export async function exportCoverLetterToGoogleDrive(params: {
  accessToken: string;
  letter: CoverLetterDocument;
  format: DriveExportFormat;
  linkedJob?: JobApplication;
  organizeByJobFolder?: boolean;
  existingFileIdToReplace?: string;
}): Promise<DriveUploadResult> {
  const filename = buildDriveExportFilename({
    title: params.letter.title,
    fallback: 'Cover_Letter',
    version: params.letter.version,
    format: params.format,
  });

  const subfolderName = params.organizeByJobFolder
    ? buildDriveJobSubfolderName(params.linkedJob)
    : undefined;

  if (params.format === 'pdf') {
    const blob = buildCoverLetterPdfBlob(params.letter);
    return uploadDocumentToDrive({
      accessToken: params.accessToken,
      blob,
      filename,
      sourceMimeType: PDF_MIME_TYPE,
      subfolderName,
      existingFileIdToReplace: params.existingFileIdToReplace,
    });
  }

  const docxBlob = await buildCoverLetterDocxBlob(params.letter);
  return uploadDocumentToDrive({
    accessToken: params.accessToken,
    blob: docxBlob,
    filename,
    sourceMimeType: DOCX_MIME_TYPE,
    targetMimeType: params.format === 'google_doc' ? GOOGLE_DOC_MIME_TYPE : undefined,
    subfolderName,
    existingFileIdToReplace: params.existingFileIdToReplace,
  });
}

export async function exportCompanyResearchToGoogleDrive(params: {
  accessToken: string;
  research: CompanyResearch;
  format: DriveExportFormat;
  linkedJob?: JobApplication;
  organizeByJobFolder?: boolean;
  existingFileIdToReplace?: string;
}): Promise<DriveUploadResult> {
  const filename = buildDriveExportFilename({
    title: `${params.research.companyName}_Company_Intelligence`,
    fallback: 'Company_Intelligence',
    format: params.format,
    isResearch: true,
  });

  const subfolderName = params.organizeByJobFolder
    ? buildDriveJobSubfolderName(params.linkedJob)
    : undefined;

  if (params.format === 'pdf') {
    const pdfBlob = buildCompanyReportPdfBlob(params.research);
    return uploadDocumentToDrive({
      accessToken: params.accessToken,
      blob: pdfBlob,
      filename,
      sourceMimeType: PDF_MIME_TYPE,
      subfolderName,
      existingFileIdToReplace: params.existingFileIdToReplace,
    });
  }

  const textBlob = buildCompanyReportTextBlob(params.research);
  return uploadDocumentToDrive({
    accessToken: params.accessToken,
    blob: textBlob,
    filename,
    sourceMimeType: TEXT_MIME_TYPE,
    targetMimeType: params.format === 'google_doc' ? GOOGLE_DOC_MIME_TYPE : undefined,
    subfolderName,
    existingFileIdToReplace: params.existingFileIdToReplace,
  });
}
