import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import { jsPDF } from 'jspdf';
import { ResumeDocument, ResumeSectionKey } from '../types/career';
import {
  hexToDocxColor,
  hexToRgb,
  mapDocxFont,
  mapPdfFont,
  normalizeUrl,
  sanitizeFilename,
  triggerBlobDownload,
} from './exportHelpers';

function formatDateRange(start: string, end: string, isCurrent?: boolean): string {
  const s = start.trim();
  const e = isCurrent ? 'Present' : end.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

export async function buildResumeDocxBlob(resume: ResumeDocument): Promise<Blob> {
  const { formatting, personal, summary, workExperience, education, skills, projects, certifications, awards, volunteer, languages, publications, sections } = resume;
  const font = mapDocxFont(formatting.fontFamily);
  const bodySizeHalfPt = Math.round(formatting.fontSize * 2);
  const headingSizeHalfPt = Math.round(formatting.headingSize * 2);
  const nameSizeHalfPt = Math.round((formatting.headingSize + 8) * 2);
  const accentHex = hexToDocxColor(formatting.accentColor);
  const marginTwip = convertInchesToTwip(formatting.pageMargins);
  const contentWidthTwip = convertInchesToTwip(8.5 - formatting.pageMargins * 2);
  const lineSpacing = Math.round(formatting.lineSpacing * 240);
  const sectionSpaceBefore = Math.round(formatting.sectionSpacing * 12);
  const headerAlign = formatting.headerAlignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;

  const children: Paragraph[] = [];

  // Name
  children.push(
    new Paragraph({
      alignment: headerAlign,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: personal.fullName || 'Your Name',
          font,
          size: nameSizeHalfPt,
          bold: true,
          color: accentHex,
        }),
      ],
    })
  );

  // Title
  if (personal.title.trim()) {
    children.push(
      new Paragraph({
        alignment: headerAlign,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: personal.title,
            font,
            size: bodySizeHalfPt + 2,
            color: '57534E',
          }),
        ],
      })
    );
  }

  // Contact & Working Hyperlinks line
  const contactChildren: Array<TextRun | ExternalHyperlink> = [];
  const pushSep = () => {
    if (contactChildren.length > 0) {
      contactChildren.push(
        new TextRun({ text: '  ·  ', font, size: bodySizeHalfPt - 2, color: '78716C' })
      );
    }
  };

  if (personal.location.trim()) {
    contactChildren.push(
      new TextRun({ text: personal.location, font, size: bodySizeHalfPt - 2, color: '44403C' })
    );
  }
  if (personal.phone.trim()) {
    pushSep();
    contactChildren.push(
      new TextRun({ text: personal.phone, font, size: bodySizeHalfPt - 2, color: '44403C' })
    );
  }
  if (personal.email.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: `mailto:${personal.email.trim()}`,
        children: [
          new TextRun({
            text: personal.email.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (personal.linkedin.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: normalizeUrl(personal.linkedin),
        children: [
          new TextRun({
            text: personal.linkedin.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (personal.portfolio.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: normalizeUrl(personal.portfolio),
        children: [
          new TextRun({
            text: personal.portfolio.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }
  if (personal.website.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: normalizeUrl(personal.website),
        children: [
          new TextRun({
            text: personal.website.trim(),
            font,
            size: bodySizeHalfPt - 2,
            color: accentHex,
            underline: {},
          }),
        ],
      })
    );
  }

  if (contactChildren.length > 0) {
    children.push(
      new Paragraph({
        alignment: headerAlign,
        spacing: { after: 140 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D6D3D1', space: 8 },
        },
        children: contactChildren,
      })
    );
  }

  const addSectionHeader = (title: string) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
        spacing: { before: sectionSpaceBefore, after: 80 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E7E5E4', space: 4 },
        },
        children: [
          new TextRun({
            text: resume.template === 'technical' ? title.toUpperCase() : title,
            font,
            size: headingSizeHalfPt,
            bold: true,
            color: accentHex,
          }),
        ],
      })
    );
  };

  const renderSection = (key: ResumeSectionKey) => {
    switch (key) {
      case 'summary': {
        if (!summary.headline.trim() && !summary.summary.trim() && !summary.careerObjectives.trim()) {
          return;
        }
        addSectionHeader('Professional Summary');
        if (summary.headline.trim()) {
          children.push(
            new Paragraph({
              spacing: { after: 60, line: lineSpacing },
              children: [
                new TextRun({
                  text: summary.headline,
                  font,
                  size: bodySizeHalfPt,
                  bold: true,
                  color: '1C1917',
                }),
              ],
            })
          );
        }
        if (summary.summary.trim()) {
          children.push(
            new Paragraph({
              spacing: { after: 60, line: lineSpacing },
              children: [
                new TextRun({ text: summary.summary, font, size: bodySizeHalfPt, color: '292524' }),
              ],
            })
          );
        }
        if (summary.careerObjectives.trim()) {
          children.push(
            new Paragraph({
              spacing: { after: 80, line: lineSpacing },
              children: [
                new TextRun({
                  text: summary.careerObjectives,
                  font,
                  size: bodySizeHalfPt,
                  italics: true,
                  color: '44403C',
                }),
              ],
            })
          );
        }
        break;
      }

      case 'experience': {
        if (workExperience.length === 0) return;
        addSectionHeader('Work Experience');
        workExperience.forEach((exp) => {
          const dateRange = formatDateRange(exp.startDate, exp.endDate, exp.isCurrent);
          children.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: 80, after: 30 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({
                  text: exp.position || 'Role',
                  font,
                  size: bodySizeHalfPt + 1,
                  bold: true,
                  color: '1C1917',
                }),
                ...(dateRange
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({
                        text: dateRange,
                        font,
                        size: bodySizeHalfPt - 1,
                        color: '57534E',
                      }),
                    ]
                  : []),
              ],
            })
          );

          const subMeta = [exp.company, exp.employmentType, exp.location]
            .filter((x) => x && x.trim())
            .join(' · ');
          if (subMeta) {
            children.push(
              new Paragraph({
                keepNext: true,
                spacing: { after: 50 },
                children: [
                  new TextRun({
                    text: subMeta,
                    font,
                    size: bodySizeHalfPt - 1,
                    color: '57534E',
                  }),
                ],
              })
            );
          }

          exp.responsibilities
            .filter((r) => r.trim())
            .forEach((resp) => {
              children.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: { after: 30, line: lineSpacing },
                  children: [
                    new TextRun({ text: resp, font, size: bodySizeHalfPt, color: '292524' }),
                  ],
                })
              );
            });

          exp.achievements
            .filter((a) => a.trim())
            .forEach((ach) => {
              children.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: { after: 30, line: lineSpacing },
                  children: [
                    new TextRun({ text: ach, font, size: bodySizeHalfPt, color: '1C1917' }),
                  ],
                })
              );
            });

          if (exp.technologies.length > 0) {
            children.push(
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'Technologies: ',
                    font,
                    size: bodySizeHalfPt - 2,
                    bold: true,
                    color: '57534E',
                  }),
                  new TextRun({
                    text: exp.technologies.join(', '),
                    font,
                    size: bodySizeHalfPt - 2,
                    color: '57534E',
                  }),
                ],
              })
            );
          }
        });
        break;
      }

      case 'education': {
        if (education.length === 0) return;
        addSectionHeader('Education');
        education.forEach((edu) => {
          const dateRange = formatDateRange(edu.startDate, edu.graduationDate);
          const degreeLine = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ');
          children.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: 60, after: 20 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({
                  text: edu.institution || 'Institution',
                  font,
                  size: bodySizeHalfPt + 1,
                  bold: true,
                  color: '1C1917',
                }),
                ...(dateRange
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({
                        text: dateRange,
                        font,
                        size: bodySizeHalfPt - 1,
                        color: '57534E',
                      }),
                    ]
                  : []),
              ],
            })
          );
          if (degreeLine) {
            children.push(
              new Paragraph({
                spacing: { after: edu.details ? 30 : 60 },
                children: [
                  new TextRun({ text: degreeLine, font, size: bodySizeHalfPt, color: '44403C' }),
                ],
              })
            );
          }
          if (edu.details.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 60, line: lineSpacing },
                children: [
                  new TextRun({ text: edu.details, font, size: bodySizeHalfPt - 1, color: '57534E' }),
                ],
              })
            );
          }
        });
        break;
      }

      case 'skills': {
        const categories = [
          { label: 'Technical Skills', items: skills.technical },
          { label: 'Software & Tools', items: skills.software },
          { label: 'Professional Skills', items: skills.professional },
          { label: 'Industry Knowledge', items: skills.industry },
        ].filter((c) => c.items.length > 0);
        if (categories.length === 0) return;
        addSectionHeader('Skills');
        categories.forEach((cat) => {
          children.push(
            new Paragraph({
              spacing: { after: 45, line: lineSpacing },
              children: [
                new TextRun({
                  text: `${cat.label}: `,
                  font,
                  size: bodySizeHalfPt,
                  bold: true,
                  color: '1C1917',
                }),
                new TextRun({
                  text: cat.items.join(' · '),
                  font,
                  size: bodySizeHalfPt,
                  color: '292524',
                }),
              ],
            })
          );
        });
        break;
      }

      case 'projects': {
        if (projects.length === 0) return;
        addSectionHeader('Projects');
        projects.forEach((proj) => {
          const dateRange = formatDateRange(proj.startDate, proj.endDate);
          children.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: 60, after: 20 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({
                  text: proj.name + (proj.role ? ` — ${proj.role}` : ''),
                  font,
                  size: bodySizeHalfPt + 1,
                  bold: true,
                  color: '1C1917',
                }),
                ...(dateRange
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({
                        text: dateRange,
                        font,
                        size: bodySizeHalfPt - 1,
                        color: '57534E',
                      }),
                    ]
                  : []),
              ],
            })
          );
          if (proj.url.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new ExternalHyperlink({
                    link: normalizeUrl(proj.url),
                    children: [
                      new TextRun({
                        text: proj.url.trim(),
                        font,
                        size: bodySizeHalfPt - 2,
                        color: accentHex,
                        underline: {},
                      }),
                    ],
                  }),
                ],
              })
            );
          }
          if (proj.description.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 35, line: lineSpacing },
                children: [
                  new TextRun({ text: proj.description, font, size: bodySizeHalfPt, color: '292524' }),
                ],
              })
            );
          }
          if (proj.technologies.length > 0) {
            children.push(
              new Paragraph({
                spacing: { after: 55 },
                children: [
                  new TextRun({
                    text: `Stack: ${proj.technologies.join(', ')}`,
                    font,
                    size: bodySizeHalfPt - 2,
                    color: '57534E',
                  }),
                ],
              })
            );
          }
        });
        break;
      }

      case 'certifications': {
        if (certifications.length === 0) return;
        addSectionHeader('Certifications');
        certifications.forEach((cert) => {
          children.push(
            new Paragraph({
              spacing: { after: 45 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({ text: cert.name, font, size: bodySizeHalfPt, bold: true, color: '1C1917' }),
                ...(cert.issuer
                  ? [new TextRun({ text: ` · ${cert.issuer}`, font, size: bodySizeHalfPt, color: '44403C' })]
                  : []),
                ...(cert.credentialId
                  ? [new TextRun({ text: ` (${cert.credentialId})`, font, size: bodySizeHalfPt - 2, color: '78716C' })]
                  : []),
                ...(cert.date
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({ text: cert.date, font, size: bodySizeHalfPt - 1, color: '57534E' }),
                    ]
                  : []),
              ],
            })
          );
          if (cert.url.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new ExternalHyperlink({
                    link: normalizeUrl(cert.url),
                    children: [
                      new TextRun({
                        text: cert.url.trim(),
                        font,
                        size: bodySizeHalfPt - 2,
                        color: accentHex,
                        underline: {},
                      }),
                    ],
                  }),
                ],
              })
            );
          }
        });
        break;
      }

      case 'awards': {
        if (awards.length === 0) return;
        addSectionHeader('Awards & Honors');
        awards.forEach((aw) => {
          children.push(
            new Paragraph({
              spacing: { after: 30 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({ text: aw.title, font, size: bodySizeHalfPt, bold: true, color: '1C1917' }),
                ...(aw.issuer
                  ? [new TextRun({ text: ` · ${aw.issuer}`, font, size: bodySizeHalfPt, color: '44403C' })]
                  : []),
                ...(aw.date
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({ text: aw.date, font, size: bodySizeHalfPt - 1, color: '57534E' }),
                    ]
                  : []),
              ],
            })
          );
          if (aw.description.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 50, line: lineSpacing },
                children: [new TextRun({ text: aw.description, font, size: bodySizeHalfPt - 1, color: '57534E' })],
              })
            );
          }
        });
        break;
      }

      case 'volunteer': {
        if (volunteer.length === 0) return;
        addSectionHeader('Volunteer Experience');
        volunteer.forEach((vol) => {
          const dateRange = formatDateRange(vol.startDate, vol.endDate);
          children.push(
            new Paragraph({
              spacing: { after: 25 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({
                  text: `${vol.role} — ${vol.organization}`,
                  font,
                  size: bodySizeHalfPt,
                  bold: true,
                  color: '1C1917',
                }),
                ...(dateRange
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({ text: dateRange, font, size: bodySizeHalfPt - 1, color: '57534E' }),
                    ]
                  : []),
              ],
            })
          );
          if (vol.description.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 55, line: lineSpacing },
                children: [new TextRun({ text: vol.description, font, size: bodySizeHalfPt, color: '292524' })],
              })
            );
          }
        });
        break;
      }

      case 'languages': {
        if (languages.length === 0) return;
        addSectionHeader('Languages');
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: languages.map((l) => `${l.language} (${l.proficiency})`).join('  ·  '),
                font,
                size: bodySizeHalfPt,
                color: '292524',
              }),
            ],
          })
        );
        break;
      }

      case 'publications': {
        if (publications.length === 0) return;
        addSectionHeader('Publications');
        publications.forEach((pub) => {
          children.push(
            new Paragraph({
              spacing: { after: 25 },
              tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwip }],
              children: [
                new TextRun({ text: pub.title, font, size: bodySizeHalfPt, bold: true, color: '1C1917' }),
                ...(pub.publisher
                  ? [new TextRun({ text: ` · ${pub.publisher}`, font, size: bodySizeHalfPt, color: '44403C' })]
                  : []),
                ...(pub.date
                  ? [
                      new TextRun({ text: '\t', font }),
                      new TextRun({ text: pub.date, font, size: bodySizeHalfPt - 1, color: '57534E' }),
                    ]
                  : []),
              ],
            })
          );
          if (pub.url.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 25 },
                children: [
                  new ExternalHyperlink({
                    link: normalizeUrl(pub.url),
                    children: [
                      new TextRun({
                        text: pub.url.trim(),
                        font,
                        size: bodySizeHalfPt - 2,
                        color: accentHex,
                        underline: {},
                      }),
                    ],
                  }),
                ],
              })
            );
          }
          if (pub.summary.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 55, line: lineSpacing },
                children: [new TextRun({ text: pub.summary, font, size: bodySizeHalfPt - 1, color: '57534E' })],
              })
            );
          }
        });
        break;
      }
    }
  };

  sections.filter((s) => s.enabled).forEach((s) => renderSection(s.id));

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

  return Packer.toBlob(doc);
}

export async function exportResumeToDocx(resume: ResumeDocument): Promise<void> {
  const blob = await buildResumeDocxBlob(resume);
  triggerBlobDownload(blob, `${sanitizeFilename(resume.name, 'Resume')}.docx`);
}

function buildResumePdfDocument(resume: ResumeDocument): jsPDF {
  const { formatting, personal, summary, workExperience, education, skills, projects, certifications, awards, volunteer, languages, publications, sections } = resume;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = formatting.pageMargins * 72;
  const maxWidth = pageWidth - margin * 2;
  const pdfFont = mapPdfFont(formatting.fontFamily);
  const [ar, ag, ab] = hexToRgb(formatting.accentColor);
  const lineHeightFactor = formatting.lineSpacing;
  const bodyPt = formatting.fontSize;
  const headingPt = formatting.headingSize;

  let y = margin;

  const ensureSpace = (neededPt: number) => {
    if (y + neededPt > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawWrappedText = (
    text: string,
    x: number,
    width: number,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = [41, 37, 36]
  ) => {
    if (!text.trim()) return;
    doc.setFont(pdfFont, style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, width) as string[];
    const step = fontSize * lineHeightFactor;
    lines.forEach((line) => {
      ensureSpace(step);
      doc.text(line, x, y);
      y += step;
    });
  };

  // Header
  const namePt = headingPt + 8;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(namePt);
  doc.setTextColor(ar, ag, ab);
  const nameText = personal.fullName || 'Your Name';
  if (formatting.headerAlignment === 'center') {
    doc.text(nameText, pageWidth / 2, y, { align: 'center' });
  } else {
    doc.text(nameText, margin, y);
  }
  y += namePt * 1.15;

  if (personal.title.trim()) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(bodyPt + 1);
    doc.setTextColor(87, 83, 78);
    if (formatting.headerAlignment === 'center') {
      doc.text(personal.title, pageWidth / 2, y, { align: 'center' });
    } else {
      doc.text(personal.title, margin, y);
    }
    y += (bodyPt + 1) * 1.3;
  }

  const contactItems = [
    personal.location,
    personal.phone,
    personal.email,
    personal.linkedin,
    personal.portfolio,
    personal.website,
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  if (contactItems.length > 0) {
    const contactLine = contactItems.join('  ·  ');
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(Math.max(8.5, bodyPt - 1.5));
    doc.setTextColor(68, 64, 60);
    const wrapped = doc.splitTextToSize(contactLine, maxWidth) as string[];
    wrapped.forEach((line) => {
      ensureSpace(14);
      if (formatting.headerAlignment === 'center') {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text(line, margin, y);
      }
      y += 13;
    });
  }

  // Hairline divider
  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += formatting.sectionSpacing * 0.75;

  const drawSectionHeading = (title: string) => {
    y += formatting.sectionSpacing * 0.45;
    ensureSpace(headingPt + 24);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(headingPt);
    doc.setTextColor(ar, ag, ab);
    doc.text(resume.template === 'technical' ? title.toUpperCase() : title, margin, y);
    y += 5;
    doc.setDrawColor(231, 229, 228);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += headingPt * 0.95;
  };

  const drawTitleWithRightDate = (leftTitle: string, rightDate: string) => {
    const step = (bodyPt + 1) * 1.25;
    ensureSpace(step + 14);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(bodyPt + 0.5);
    doc.setTextColor(28, 25, 23);
    const maxLeftWidth = rightDate ? maxWidth - 135 : maxWidth;
    const leftLines = doc.splitTextToSize(leftTitle, maxLeftWidth) as string[];
    doc.text(leftLines[0] || '', margin, y);
    if (rightDate) {
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(bodyPt - 1);
      doc.setTextColor(87, 83, 78);
      doc.text(rightDate, pageWidth - margin, y, { align: 'right' });
    }
    y += step;
    for (let i = 1; i < leftLines.length; i++) {
      ensureSpace(step);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(bodyPt + 0.5);
      doc.setTextColor(28, 25, 23);
      doc.text(leftLines[i], margin, y);
      y += step;
    }
  };

  const drawBullet = (text: string) => {
    if (!text.trim()) return;
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(bodyPt);
    doc.setTextColor(41, 37, 36);
    const lines = doc.splitTextToSize(text, maxWidth - 14) as string[];
    const step = bodyPt * lineHeightFactor;
    lines.forEach((line, idx) => {
      ensureSpace(step);
      if (idx === 0) {
        doc.text('•', margin + 2, y);
      }
      doc.text(line, margin + 12, y);
      y += step;
    });
  };

  const renderSection = (key: ResumeSectionKey) => {
    switch (key) {
      case 'summary':
        if (!summary.headline && !summary.summary && !summary.careerObjectives) return;
        drawSectionHeading('Professional Summary');
        if (summary.headline) drawWrappedText(summary.headline, margin, maxWidth, bodyPt, 'bold', [28, 25, 23]);
        if (summary.summary) drawWrappedText(summary.summary, margin, maxWidth, bodyPt, 'normal', [41, 37, 36]);
        if (summary.careerObjectives) drawWrappedText(summary.careerObjectives, margin, maxWidth, bodyPt, 'italic', [68, 64, 60]);
        break;

      case 'experience':
        if (workExperience.length === 0) return;
        drawSectionHeading('Work Experience');
        workExperience.forEach((exp) => {
          drawTitleWithRightDate(
            exp.position || 'Role',
            formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)
          );
          const sub = [exp.company, exp.employmentType, exp.location].filter(Boolean).join(' · ');
          if (sub) {
            drawWrappedText(sub, margin, maxWidth, bodyPt - 1, 'normal', [87, 83, 78]);
          }
          exp.responsibilities.forEach(drawBullet);
          exp.achievements.forEach(drawBullet);
          if (exp.technologies.length > 0) {
            drawWrappedText(
              `Technologies: ${exp.technologies.join(', ')}`,
              margin,
              maxWidth,
              bodyPt - 1.5,
              'normal',
              [87, 83, 78]
            );
          }
          y += 5;
        });
        break;

      case 'education':
        if (education.length === 0) return;
        drawSectionHeading('Education');
        education.forEach((edu) => {
          drawTitleWithRightDate(
            edu.institution || 'Institution',
            formatDateRange(edu.startDate, edu.graduationDate)
          );
          const degreeLine = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ');
          if (degreeLine) drawWrappedText(degreeLine, margin, maxWidth, bodyPt, 'normal', [68, 64, 60]);
          if (edu.details) drawWrappedText(edu.details, margin, maxWidth, bodyPt - 1, 'normal', [87, 83, 78]);
          y += 4;
        });
        break;

      case 'skills': {
        const groups = [
          { label: 'Technical Skills', items: skills.technical },
          { label: 'Software & Tools', items: skills.software },
          { label: 'Professional Skills', items: skills.professional },
          { label: 'Industry Knowledge', items: skills.industry },
        ].filter((g) => g.items.length > 0);
        if (groups.length === 0) return;
        drawSectionHeading('Skills');
        groups.forEach((g) => {
          drawWrappedText(`${g.label}: ${g.items.join(' · ')}`, margin, maxWidth, bodyPt, 'normal', [41, 37, 36]);
        });
        break;
      }

      case 'projects':
        if (projects.length === 0) return;
        drawSectionHeading('Projects');
        projects.forEach((p) => {
          drawTitleWithRightDate(
            p.name + (p.role ? ` — ${p.role}` : ''),
            formatDateRange(p.startDate, p.endDate)
          );
          if (p.url) drawWrappedText(p.url, margin, maxWidth, bodyPt - 1.5, 'normal', [ar, ag, ab]);
          if (p.description) drawWrappedText(p.description, margin, maxWidth, bodyPt, 'normal', [41, 37, 36]);
          if (p.technologies.length > 0) {
            drawWrappedText(`Stack: ${p.technologies.join(', ')}`, margin, maxWidth, bodyPt - 1.5, 'normal', [87, 83, 78]);
          }
          y += 4;
        });
        break;

      case 'certifications':
        if (certifications.length === 0) return;
        drawSectionHeading('Certifications');
        certifications.forEach((c) => {
          const line = [c.name, c.issuer, c.credentialId ? `ID: ${c.credentialId}` : ''].filter(Boolean).join(' · ');
          drawTitleWithRightDate(line, c.date);
          if (c.url) drawWrappedText(c.url, margin, maxWidth, bodyPt - 1.5, 'normal', [ar, ag, ab]);
        });
        break;

      case 'awards':
        if (awards.length === 0) return;
        drawSectionHeading('Awards & Honors');
        awards.forEach((a) => {
          drawTitleWithRightDate([a.title, a.issuer].filter(Boolean).join(' · '), a.date);
          if (a.description) drawWrappedText(a.description, margin, maxWidth, bodyPt - 1, 'normal', [87, 83, 78]);
        });
        break;

      case 'volunteer':
        if (volunteer.length === 0) return;
        drawSectionHeading('Volunteer Experience');
        volunteer.forEach((v) => {
          drawTitleWithRightDate(`${v.role} — ${v.organization}`, formatDateRange(v.startDate, v.endDate));
          if (v.description) drawWrappedText(v.description, margin, maxWidth, bodyPt, 'normal', [41, 37, 36]);
        });
        break;

      case 'languages':
        if (languages.length === 0) return;
        drawSectionHeading('Languages');
        drawWrappedText(
          languages.map((l) => `${l.language} (${l.proficiency})`).join(' · '),
          margin,
          maxWidth,
          bodyPt,
          'normal',
          [41, 37, 36]
        );
        break;

      case 'publications':
        if (publications.length === 0) return;
        drawSectionHeading('Publications');
        publications.forEach((pub) => {
          drawTitleWithRightDate([pub.title, pub.publisher].filter(Boolean).join(' · '), pub.date);
          if (pub.url) drawWrappedText(pub.url, margin, maxWidth, bodyPt - 1.5, 'normal', [ar, ag, ab]);
          if (pub.summary) drawWrappedText(pub.summary, margin, maxWidth, bodyPt - 1, 'normal', [87, 83, 78]);
        });
        break;
    }
  };

  sections.filter((s) => s.enabled).forEach((s) => renderSection(s.id));

  return doc;
}

export function buildResumePdfBlob(resume: ResumeDocument): Blob {
  return buildResumePdfDocument(resume).output('blob');
}

export function exportResumeToPdf(resume: ResumeDocument): void {
  buildResumePdfDocument(resume).save(`${sanitizeFilename(resume.name, 'Resume')}.pdf`);
}
