import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { jsPDF } from 'jspdf';
import { CoverLetterDocument } from '../types/career';
import {
  hexToDocxColor,
  hexToRgb,
  mapDocxFont,
  mapPdfFont,
  normalizeUrl,
  sanitizeFilename,
  triggerBlobDownload,
} from './exportHelpers';

export async function exportCoverLetterToDocx(letter: CoverLetterDocument): Promise<void> {
  const { applicant, employer, content, formatting, template } = letter;
  const font = mapDocxFont(formatting.fontFamily);
  const bodySizeHalfPt = Math.round(formatting.fontSize * 2);
  const nameSizeHalfPt = Math.round((formatting.headingSize + 4) * 2);
  const accentHex = hexToDocxColor(formatting.accentColor);
  const marginTwip = convertInchesToTwip(formatting.pageMargins);
  const lineSpacing = Math.round(formatting.lineSpacing * 240);
  const paraAfterTwip = Math.round(formatting.paragraphSpacing * 16);
  const bodyAlignment =
    formatting.textAlignment === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
  const headerAlign = template === 'minimal' ? AlignmentType.LEFT : AlignmentType.LEFT;

  const children: Paragraph[] = [];

  // Applicant Header
  children.push(
    new Paragraph({
      alignment: headerAlign,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: applicant.fullName || 'Your Name',
          font,
          size: nameSizeHalfPt,
          bold: true,
          color: accentHex,
        }),
      ],
    })
  );

  const contactParts: Array<TextRun | ExternalHyperlink> = [];
  const pushSep = () => {
    if (contactParts.length > 0) {
      contactParts.push(
        new TextRun({ text: '  ·  ', font, size: bodySizeHalfPt - 2, color: '78716C' })
      );
    }
  };

  if (applicant.location.trim()) {
    contactParts.push(
      new TextRun({ text: applicant.location, font, size: bodySizeHalfPt - 2, color: '44403C' })
    );
  }
  if (applicant.phone.trim()) {
    pushSep();
    contactParts.push(
      new TextRun({ text: applicant.phone, font, size: bodySizeHalfPt - 2, color: '44403C' })
    );
  }
  if (applicant.email.trim()) {
    pushSep();
    contactParts.push(
      new ExternalHyperlink({
        link: `mailto:${applicant.email.trim()}`,
        children: [
          new TextRun({
            text: applicant.email.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (applicant.linkedin.trim()) {
    pushSep();
    contactParts.push(
      new ExternalHyperlink({
        link: normalizeUrl(applicant.linkedin),
        children: [
          new TextRun({
            text: applicant.linkedin.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (applicant.portfolio.trim()) {
    pushSep();
    contactParts.push(
      new ExternalHyperlink({
        link: normalizeUrl(applicant.portfolio),
        children: [
          new TextRun({
            text: applicant.portfolio.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (applicant.website.trim()) {
    pushSep();
    contactParts.push(
      new ExternalHyperlink({
        link: normalizeUrl(applicant.website),
        children: [
          new TextRun({
            text: applicant.website.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 220 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D6D3D1', space: 10 },
        },
        children: contactParts,
      })
    );
  }

  // Date
  if (employer.applicationDate.trim()) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 140 },
        children: [
          new TextRun({
            text: employer.applicationDate,
            font,
            size: bodySizeHalfPt,
            color: '57534E',
          }),
        ],
      })
    );
  }

  // Employer recipient block
  const recipientLines = [
    employer.hiringManager,
    employer.department,
    employer.companyName,
    employer.companyAddress,
  ].filter((x) => x && x.trim());

  recipientLines.forEach((line, index) => {
    children.push(
      new Paragraph({
        spacing: { after: index === recipientLines.length - 1 ? 180 : 30 },
        children: [
          new TextRun({
            text: line,
            font,
            size: bodySizeHalfPt,
            bold: line === employer.companyName,
            color: '1C1917',
          }),
        ],
      })
    );
  });

  if (employer.jobTitle.trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `RE: Application for ${employer.jobTitle}`,
            font,
            size: bodySizeHalfPt,
            bold: true,
            color: accentHex,
          }),
        ],
      })
    );
  }

  // Salutation
  children.push(
    new Paragraph({
      spacing: { after: paraAfterTwip },
      children: [
        new TextRun({
          text: content.salutation || 'Dear Hiring Team,',
          font,
          size: bodySizeHalfPt,
          color: '1C1917',
        }),
      ],
    })
  );

  // Body paragraphs
  content.paragraphs
    .filter((p) => p.text.trim())
    .forEach((p) => {
      children.push(
        new Paragraph({
          alignment: bodyAlignment,
          spacing: { after: paraAfterTwip, line: lineSpacing },
          children: [
            new TextRun({
              text: p.text,
              font,
              size: bodySizeHalfPt,
              color: '292524',
            }),
          ],
        })
      );
    });

  // Closing
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 220 },
      children: [
        new TextRun({
          text: content.closingSignOff || 'Sincerely,',
          font,
          size: bodySizeHalfPt,
          color: '1C1917',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.signatureName || applicant.fullName || '',
          font,
          size: bodySizeHalfPt + 1,
          bold: true,
          color: accentHex,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            margin: {
              top: marginTwip,
              bottom: marginTwip,
              left: marginTwip,
              right: marginTwip,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${sanitizeFilename(letter.title, 'Cover_Letter')}.docx`);
}

export function exportCoverLetterToPdf(letter: CoverLetterDocument): void {
  const { applicant, employer, content, formatting } = letter;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = formatting.pageMargins * 72;
  const maxWidth = pageWidth - margin * 2;
  const pdfFont = mapPdfFont(formatting.fontFamily);
  const [ar, ag, ab] = hexToRgb(formatting.accentColor);
  const bodyPt = formatting.fontSize;
  const step = bodyPt * formatting.lineSpacing;

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Name
  const namePt = formatting.headingSize + 4;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(namePt);
  doc.setTextColor(ar, ag, ab);
  doc.text(applicant.fullName || 'Your Name', margin, y);
  y += namePt * 1.25;

  const contactItems = [
    applicant.location,
    applicant.phone,
    applicant.email,
    applicant.linkedin,
    applicant.portfolio,
    applicant.website,
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  if (contactItems.length > 0) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(Math.max(8.5, bodyPt - 1.5));
    doc.setTextColor(68, 64, 60);
    const wrapped = doc.splitTextToSize(contactItems.join('  ·  '), maxWidth) as string[];
    wrapped.forEach((line) => {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    });
  }

  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  if (employer.applicationDate.trim()) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(bodyPt);
    doc.setTextColor(87, 83, 78);
    doc.text(employer.applicationDate, margin, y);
    y += step + 8;
  }

  const recipientLines = [
    employer.hiringManager,
    employer.department,
    employer.companyName,
    employer.companyAddress,
  ].filter((x) => x && x.trim());

  recipientLines.forEach((line) => {
    ensureSpace(step);
    doc.setFont(pdfFont, line === employer.companyName ? 'bold' : 'normal');
    doc.setFontSize(bodyPt);
    doc.setTextColor(28, 25, 23);
    doc.text(line, margin, y);
    y += step;
  });

  if (recipientLines.length > 0) y += 10;

  if (employer.jobTitle.trim()) {
    ensureSpace(step + 8);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(bodyPt);
    doc.setTextColor(ar, ag, ab);
    doc.text(`RE: Application for ${employer.jobTitle}`, margin, y);
    y += step + 10;
  }

  // Salutation
  ensureSpace(step + 6);
  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(bodyPt);
  doc.setTextColor(28, 25, 23);
  doc.text(content.salutation || 'Dear Hiring Team,', margin, y);
  y += step + formatting.paragraphSpacing * 0.75;

  // Body paragraphs
  content.paragraphs
    .filter((p) => p.text.trim())
    .forEach((p) => {
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(41, 37, 36);
      const lines = doc.splitTextToSize(p.text, maxWidth) as string[];
      lines.forEach((line) => {
        ensureSpace(step);
        doc.text(line, margin, y, {
          align: formatting.textAlignment === 'justify' ? 'justify' : 'left',
          maxWidth,
        });
        y += step;
      });
      y += formatting.paragraphSpacing * 0.75;
    });

  // Closing
  ensureSpace(step * 3);
  y += 6;
  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(bodyPt);
  doc.setTextColor(28, 25, 23);
  doc.text(content.closingSignOff || 'Sincerely,', margin, y);
  y += step * 2.1;

  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(bodyPt + 0.5);
  doc.setTextColor(ar, ag, ab);
  doc.text(content.signatureName || applicant.fullName || '', margin, y);

  doc.save(`${sanitizeFilename(letter.title, 'Cover_Letter')}.pdf`);
}
