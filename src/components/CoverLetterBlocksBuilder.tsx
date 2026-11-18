import { CoverLetterDocument } from '../types/career';
import { PreviewBlock } from './PaginatedPaperPreview';
import { mapCssFont } from '../services/exportHelpers';

export function buildCoverLetterPreviewBlocks(letter: CoverLetterDocument): {
  blocks: PreviewBlock[];
  paperColor: string;
} {
  const { applicant, employer, content, formatting, template } = letter;
  const fontFamilyCss = mapCssFont(formatting.fontFamily);
  const bodySizePx = formatting.fontSize * 1.333;
  const nameSizePx = (formatting.headingSize + 4) * 1.333;
  const accent = formatting.accentColor || '#1C1917';
  const paperColor = template === 'modern' ? '#FCFBF9' : '#FFFFFF';
  const headingFontCss =
    template === 'technical'
      ? '"JetBrains Mono", monospace'
      : template === 'modern' || template === 'traditional'
        ? '"Fraunces", "Source Serif 4", Georgia, serif'
        : fontFamilyCss;

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

  const blocks: PreviewBlock[] = [];

  // Header
  blocks.push({
    id: 'cl-header',
    node: (
      <div
        style={{
          fontFamily: fontFamilyCss,
          paddingBottom: '14px',
          marginBottom: '22px',
          borderBottom:
            template === 'minimal'
              ? '1px solid #E7E5E4'
              : template === 'creative'
                ? `2px solid ${accent}`
                : '1px solid #D6D3D1',
        }}
      >
        {template === 'creative' && (
          <div style={{ height: '4px', width: '48px', backgroundColor: accent, marginBottom: '10px' }} />
        )}
        <div
          style={{
            fontFamily: headingFontCss,
            fontSize: `${nameSizePx}px`,
            fontWeight: 600,
            color: accent,
            lineHeight: 1.2,
          }}
        >
          {applicant.fullName || 'Your Full Name'}
        </div>
        {contactItems.length > 0 && (
          <div
            style={{
              fontSize: `${Math.max(10.5, bodySizePx - 1.5)}px`,
              color: '#57534E',
              marginTop: '6px',
              lineHeight: 1.45,
            }}
          >
            {contactItems.join('  ·  ')}
          </div>
        )}
      </div>
    ),
  });

  // Date & Employer Recipient Block
  const recipientLines = [
    employer.hiringManager,
    employer.department,
    employer.companyName,
    employer.companyAddress,
  ].filter((x) => x && x.trim());

  blocks.push({
    id: 'cl-recipient',
    node: (
      <div
        style={{
          fontFamily: fontFamilyCss,
          fontSize: `${bodySizePx}px`,
          lineHeight: formatting.lineSpacing,
          marginBottom: `${formatting.paragraphSpacing + 6}px`,
        }}
      >
        {employer.applicationDate.trim() && (
          <div style={{ color: '#57534E', marginBottom: '12px' }}>{employer.applicationDate}</div>
        )}
        {recipientLines.map((line, i) => (
          <div
            key={i}
            style={{
              color: '#1C1917',
              fontWeight: line === employer.companyName ? 600 : 400,
            }}
          >
            {line}
          </div>
        ))}
        {employer.jobTitle.trim() && (
          <div
            style={{
              marginTop: '14px',
              fontWeight: 600,
              color: accent,
              textTransform: template === 'technical' ? 'uppercase' : 'none',
              letterSpacing: template === 'technical' ? '0.04em' : 'normal',
            }}
          >
            RE: Application for {employer.jobTitle}
          </div>
        )}
      </div>
    ),
  });

  // Salutation
  blocks.push({
    id: 'cl-salutation',
    node: (
      <div
        style={{
          fontFamily: fontFamilyCss,
          fontSize: `${bodySizePx}px`,
          lineHeight: formatting.lineSpacing,
          color: '#1C1917',
          marginBottom: `${formatting.paragraphSpacing}px`,
        }}
      >
        {content.salutation || 'Dear Hiring Team,'}
      </div>
    ),
  });

  // Body paragraphs
  content.paragraphs
    .filter((p) => p.text.trim())
    .forEach((p) => {
      blocks.push({
        id: `cl-para-${p.id}`,
        node: (
          <div
            style={{
              fontFamily: fontFamilyCss,
              fontSize: `${bodySizePx}px`,
              lineHeight: formatting.lineSpacing,
              color: '#292524',
              textAlign: formatting.textAlignment === 'justify' ? 'justify' : 'left',
              marginBottom: `${formatting.paragraphSpacing}px`,
            }}
          >
            {p.text}
          </div>
        ),
      });
    });

  // Sign-off
  blocks.push({
    id: 'cl-signoff',
    node: (
      <div
        style={{
          fontFamily: fontFamilyCss,
          fontSize: `${bodySizePx}px`,
          lineHeight: formatting.lineSpacing,
          marginTop: '10px',
        }}
      >
        <div style={{ color: '#1C1917', marginBottom: '22px' }}>
          {content.closingSignOff || 'Sincerely,'}
        </div>
        <div style={{ fontWeight: 600, color: accent }}>
          {content.signatureName || applicant.fullName || ''}
        </div>
      </div>
    ),
  });

  return { blocks, paperColor };
}
