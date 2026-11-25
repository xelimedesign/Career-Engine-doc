import { ResumeDocument, ResumeSectionKey } from '../types/career';
import { PreviewBlock } from './PaginatedPaperPreview';
import { mapCssFont } from '../services/exportHelpers';

function safeTrim(val?: string | null): string {
  return typeof val === 'string' ? val.trim() : '';
}

function formatDateRange(start?: string | null, end?: string | null, isCurrent?: boolean): string {
  const s = safeTrim(start);
  const e = isCurrent ? 'Present' : safeTrim(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

export function buildResumePreviewBlocks(resume: ResumeDocument): {
  blocks: PreviewBlock[];
  paperColor: string;
} {
  const personal = resume.personal || ({} as ResumeDocument['personal']);
  const summary = resume.summary || ({} as ResumeDocument['summary']);
  const workExperience = Array.isArray(resume.workExperience) ? resume.workExperience : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const skills = resume.skills || { technical: [], software: [], professional: [], industry: [] };
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const certifications = Array.isArray(resume.certifications) ? resume.certifications : [];
  const awards = Array.isArray(resume.awards) ? resume.awards : [];
  const volunteer = Array.isArray(resume.volunteer) ? resume.volunteer : [];
  const languages = Array.isArray(resume.languages) ? resume.languages : [];
  const publications = Array.isArray(resume.publications) ? resume.publications : [];
  const sections = Array.isArray(resume.sections) ? resume.sections : [];
  const { template, formatting } = resume;

  const fontFamilyCss = mapCssFont(formatting.fontFamily);
  const bodySizePx = formatting.fontSize * 1.333;
  const headingSizePx = formatting.headingSize * 1.333;
  const nameSizePx = (formatting.headingSize + 8) * 1.333;
  const accent = formatting.accentColor || '#1C1917';
  const paperColor = template === 'modern' ? '#FCFBF9' : '#FFFFFF';
  const isCentered = formatting.headerAlignment === 'center';

  const headingFontCss =
    template === 'technical'
      ? '"JetBrains Mono", monospace'
      : template === 'modern' || template === 'professional'
        ? '"Fraunces", "Source Serif 4", Georgia, serif'
        : fontFamilyCss;

  const blocks: PreviewBlock[] = [];

  const contactItems = [
    personal.location,
    personal.phone,
    personal.email,
    personal.linkedin,
    personal.portfolio,
    personal.website,
  ]
    .map(safeTrim)
    .filter(Boolean);

  // Header Block
  blocks.push({
    id: 'header',
    node: (
      <div
        style={{
          fontFamily: fontFamilyCss,
          textAlign: isCentered ? 'center' : 'left',
          paddingBottom: `${Math.max(10, formatting.sectionSpacing * 0.75)}px`,
          marginBottom: `${formatting.sectionSpacing * 0.65}px`,
          borderBottom:
            template === 'minimal'
              ? '1px solid #E7E5E4'
              : template === 'creative'
                ? `2px solid ${accent}`
                : '1px solid #D6D3D1',
        }}
      >
        {template === 'creative' && (
          <div
            style={{
              height: '4px',
              width: isCentered ? '64px' : '48px',
              backgroundColor: accent,
              margin: isCentered ? '0 auto 10px auto' : '0 0 10px 0',
            }}
          />
        )}
        <div
          style={{
            fontFamily: headingFontCss,
            fontSize: `${nameSizePx}px`,
            fontWeight: 600,
            lineHeight: 1.15,
            color: accent,
            letterSpacing: '-0.01em',
          }}
        >
          {personal.fullName || 'Your Full Name'}
        </div>
        {safeTrim(personal.title) && (
          <div
            style={{
              fontSize: `${bodySizePx + 1.5}px`,
              color: '#57534E',
              marginTop: '3px',
              fontWeight: 500,
            }}
          >
            {personal.title}
          </div>
        )}
        {contactItems.length > 0 && (
          <div
            style={{
              fontSize: `${Math.max(10.5, bodySizePx - 1.5)}px`,
              color: '#44403C',
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

  const makeSectionHeader = (key: string, title: string) => (
    <div
      key={`sec-hdr-${key}`}
      style={{
        fontFamily: headingFontCss,
        fontSize: `${headingSizePx}px`,
        fontWeight: 600,
        color: accent,
        marginTop: `${formatting.sectionSpacing}px`,
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: template === 'minimal' ? 'none' : '1px solid #E7E5E4',
        textTransform: template === 'technical' ? 'uppercase' : 'none',
        letterSpacing: template === 'technical' ? '0.06em' : '-0.01em',
      }}
    >
      {title}
    </div>
  );

  const renderSection = (key: ResumeSectionKey) => {
    switch (key) {
      case 'summary': {
        if (!safeTrim(summary.headline) && !safeTrim(summary.summary) && !safeTrim(summary.careerObjectives)) {
          return;
        }
        blocks.push({
          id: 'summary',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('summary', template === 'modern' ? 'About' : 'Professional Summary')}
              {safeTrim(summary.headline) && (
                <div style={{ fontWeight: 600, color: '#1C1917', marginBottom: '4px' }}>
                  {summary.headline}
                </div>
              )}
              {safeTrim(summary.summary) && (
                <div style={{ color: '#292524', marginBottom: safeTrim(summary.careerObjectives) ? '4px' : '0' }}>
                  {summary.summary}
                </div>
              )}
              {safeTrim(summary.careerObjectives) && (
                <div style={{ color: '#57534E', fontStyle: 'italic' }}>{summary.careerObjectives}</div>
              )}
            </div>
          ),
        });
        break;
      }

      case 'experience': {
        if (workExperience.length === 0) return;
        workExperience.forEach((exp, idx) => {
          const dateRange = formatDateRange(exp.startDate, exp.endDate, exp.isCurrent);
          const subMeta = [exp.company, exp.employmentType, exp.location].map(safeTrim).filter(Boolean).join(' · ');
          const bullets = [...(exp.responsibilities || []), ...(exp.achievements || [])].map(safeTrim).filter(Boolean);

          blocks.push({
            id: `exp-${exp.id}`,
            node: (
              <div
                style={{
                  fontFamily: fontFamilyCss,
                  fontSize: `${bodySizePx}px`,
                  lineHeight: formatting.lineSpacing,
                  marginBottom: '10px',
                }}
              >
                {idx === 0 && makeSectionHeader('experience', 'Experience')}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1C1917', fontSize: `${bodySizePx + 0.5}px` }}>
                    {exp.position || 'Position Title'}
                  </div>
                  {dateRange && (
                    <div
                      style={{
                        fontSize: `${Math.max(10, bodySizePx - 1)}px`,
                        color: '#78716C',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dateRange}
                    </div>
                  )}
                </div>
                {subMeta && (
                  <div style={{ color: '#57534E', fontSize: `${Math.max(10.5, bodySizePx - 1)}px`, marginBottom: '4px' }}>
                    {subMeta}
                  </div>
                )}
                {bullets.length > 0 && (
                  <ul style={{ margin: '3px 0 0 0', paddingLeft: '16px', color: '#292524', listStyleType: 'disc' }}>
                    {bullets.map((b, bIdx) => (
                      <li key={bIdx} style={{ marginBottom: '2px' }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {Array.isArray(exp.technologies) && exp.technologies.length > 0 && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: `${Math.max(10, bodySizePx - 1.5)}px`,
                      color: '#57534E',
                    }}
                  >
                    <strong style={{ fontWeight: 600 }}>Technologies:</strong> {exp.technologies.join(', ')}
                  </div>
                )}
              </div>
            ),
          });
        });
        break;
      }

      case 'education': {
        if (education.length === 0) return;
        education.forEach((edu, idx) => {
          const dateRange = formatDateRange(edu.startDate, edu.graduationDate);
          const degreeLine = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ');
          blocks.push({
            id: `edu-${edu.id}`,
            node: (
              <div
                style={{
                  fontFamily: fontFamilyCss,
                  fontSize: `${bodySizePx}px`,
                  lineHeight: formatting.lineSpacing,
                  marginBottom: '8px',
                }}
              >
                {idx === 0 && makeSectionHeader('education', 'Education')}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#1C1917' }}>{edu.institution || 'Institution'}</div>
                  {dateRange && (
                    <div
                      style={{
                        fontSize: `${Math.max(10, bodySizePx - 1)}px`,
                        color: '#78716C',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dateRange}
                    </div>
                  )}
                </div>
                {degreeLine && <div style={{ color: '#44403C' }}>{degreeLine}</div>}
                {safeTrim(edu.details) && (
                  <div style={{ color: '#57534E', fontSize: `${Math.max(10.5, bodySizePx - 1)}px`, marginTop: '2px' }}>
                    {edu.details}
                  </div>
                )}
              </div>
            ),
          });
        });
        break;
      }

      case 'skills': {
        const categories = [
          { label: 'Technical', items: skills?.technical || [] },
          { label: 'Software & Tools', items: skills?.software || [] },
          { label: 'Professional', items: skills?.professional || [] },
          { label: 'Industry', items: skills?.industry || [] },
        ].filter((c) => c.items && c.items.length > 0);
        if (categories.length === 0) return;

        blocks.push({
          id: 'skills',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('skills', 'Skills')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {categories.map((cat) => (
                  <div key={cat.label} style={{ color: '#292524' }}>
                    <strong style={{ fontWeight: 600, color: '#1C1917' }}>{cat.label}: </strong>
                    <span>{cat.items.join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ),
        });
        break;
      }

      case 'projects': {
        if (projects.length === 0) return;
        projects.forEach((proj, idx) => {
          const dateRange = formatDateRange((proj as any).startDate, (proj as any).endDate);
          blocks.push({
            id: `proj-${proj.id}`,
            node: (
              <div
                style={{
                  fontFamily: fontFamilyCss,
                  fontSize: `${bodySizePx}px`,
                  lineHeight: formatting.lineSpacing,
                  marginBottom: '8px',
                }}
              >
                {idx === 0 && makeSectionHeader('projects', 'Projects')}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#1C1917' }}>
                    {proj.name}
                    {(proj as any).role ? ` — ${(proj as any).role}` : ''}
                  </div>
                  {dateRange && (
                    <div
                      style={{
                        fontSize: `${Math.max(10, bodySizePx - 1)}px`,
                        color: '#78716C',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dateRange}
                    </div>
                  )}
                </div>
                {safeTrim(proj.url) && (
                  <div style={{ fontSize: `${Math.max(10, bodySizePx - 1.5)}px`, color: accent }}>{proj.url}</div>
                )}
                {safeTrim(proj.description) && <div style={{ color: '#292524', marginTop: '2px' }}>{proj.description}</div>}
                {proj.technologies && proj.technologies.length > 0 && (
                  <div style={{ fontSize: `${Math.max(10, bodySizePx - 1.5)}px`, color: '#57534E', marginTop: '2px' }}>
                    Stack: {proj.technologies.join(', ')}
                  </div>
                )}
              </div>
            ),
          });
        });
        break;
      }

      case 'certifications': {
        if (certifications.length === 0) return;
        blocks.push({
          id: 'certifications',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('certifications', 'Certifications')}
              {certifications.map((cert) => (
                <div
                  key={cert.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}
                >
                  <div>
                    <strong style={{ fontWeight: 600, color: '#1C1917' }}>{cert.name}</strong>
                    {cert.issuer ? ` · ${cert.issuer}` : ''}
                    {cert.credentialId ? ` (${cert.credentialId})` : ''}
                  </div>
                  {cert.date && (
                    <div style={{ fontSize: `${Math.max(10, bodySizePx - 1)}px`, color: '#78716C', whiteSpace: 'nowrap' }}>
                      {cert.date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ),
        });
        break;
      }

      case 'awards': {
        if (awards.length === 0) return;
        blocks.push({
          id: 'awards',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('awards', 'Awards & Honors')}
              {awards.map((aw) => (
                <div key={aw.id} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                    <div>
                      <strong style={{ fontWeight: 600, color: '#1C1917' }}>{aw.title}</strong>
                      {aw.issuer ? ` · ${aw.issuer}` : ''}
                    </div>
                    {aw.date && (
                      <div style={{ fontSize: `${Math.max(10, bodySizePx - 1)}px`, color: '#78716C', whiteSpace: 'nowrap' }}>
                        {aw.date}
                      </div>
                    )}
                  </div>
                  {safeTrim(aw.description) && <div style={{ color: '#57534E' }}>{aw.description}</div>}
                </div>
              ))}
            </div>
          ),
        });
        break;
      }

      case 'volunteer': {
        if (volunteer.length === 0) return;
        blocks.push({
          id: 'volunteer',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('volunteer', 'Volunteer Experience')}
              {volunteer.map((v) => {
                const dr = formatDateRange(v.startDate, v.endDate);
                return (
                  <div key={v.id} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#1C1917' }}>
                        {v.role} — {v.organization}
                      </div>
                      {dr && (
                        <div style={{ fontSize: `${Math.max(10, bodySizePx - 1)}px`, color: '#78716C', whiteSpace: 'nowrap' }}>
                          {dr}
                        </div>
                      )}
                    </div>
                    {safeTrim(v.description) && <div style={{ color: '#292524' }}>{v.description}</div>}
                  </div>
                );
              })}
            </div>
          ),
        });
        break;
      }

      case 'languages': {
        if (languages.length === 0) return;
        blocks.push({
          id: 'languages',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('languages', 'Languages')}
              <div style={{ color: '#292524' }}>
                {languages.map((l) => `${l.language} (${l.proficiency})`).join('  ·  ')}
              </div>
            </div>
          ),
        });
        break;
      }

      case 'publications': {
        if (publications.length === 0) return;
        blocks.push({
          id: 'publications',
          node: (
            <div style={{ fontFamily: fontFamilyCss, fontSize: `${bodySizePx}px`, lineHeight: formatting.lineSpacing }}>
              {makeSectionHeader('publications', 'Publications')}
              {publications.map((pub) => (
                <div key={pub.id} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                    <div>
                      <strong style={{ fontWeight: 600, color: '#1C1917' }}>{pub.title}</strong>
                      {pub.publisher ? ` · ${pub.publisher}` : ''}
                    </div>
                    {pub.date && (
                      <div style={{ fontSize: `${Math.max(10, bodySizePx - 1)}px`, color: '#78716C', whiteSpace: 'nowrap' }}>
                        {pub.date}
                      </div>
                    )}
                  </div>
                  {safeTrim(pub.url) && (
                    <div style={{ fontSize: `${Math.max(10, bodySizePx - 1.5)}px`, color: accent }}>{pub.url}</div>
                  )}
                  {safeTrim(pub.summary) && <div style={{ color: '#57534E' }}>{pub.summary}</div>}
                </div>
              ))}
            </div>
          ),
        });
        break;
      }
    }
  };

  sections.filter((s) => s.enabled).forEach((s) => renderSection(s.id));

  return { blocks, paperColor };
}
