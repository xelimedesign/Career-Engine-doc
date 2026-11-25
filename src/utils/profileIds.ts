import { CareerProfile, SkillCategoryKey, SkillEntry } from '../types/career';

function ensureItemId<T extends { id?: string }>(item: T, prefix: string, index: number): T & { id: string } {
  const existing = typeof item.id === 'string' ? item.id.trim() : '';
  return {
    ...item,
    id: existing || `${prefix}-${index + 1}`,
  };
}

const SKILL_CATEGORIES: SkillCategoryKey[] = ['technical', 'software', 'professional', 'industry'];

/**
 * Ensures every workExperience, education, project, certification, award, volunteer,
 * language, publication, and skill entry on CareerProfile has a persistent, stable ID.
 */
export function ensureStableProfileIds(profile: CareerProfile): CareerProfile {
  const existingMap = new Map<string, SkillEntry>();
  if (Array.isArray(profile.skillEntries)) {
    for (const entry of profile.skillEntries) {
      if (entry && entry.id && entry.name) {
        const key = `${entry.category}:${entry.name.trim().toLowerCase()}`;
        if (!existingMap.has(key)) {
          existingMap.set(key, entry);
        }
      }
    }
  }

  const nextSkillEntries: SkillEntry[] = [];
  const usedSkillIds = new Set<string>();

  for (const cat of SKILL_CATEGORIES) {
    const list = Array.isArray(profile.skills?.[cat]) ? profile.skills[cat] : [];
    list.forEach((rawName, idx) => {
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (!name) return;
      const lookupKey = `${cat}:${name.toLowerCase()}`;
      const matched = existingMap.get(lookupKey);
      let id = matched?.id?.trim();
      if (!id || usedSkillIds.has(id)) {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 24);
        id = `skill-${cat}-${slug || idx + 1}`;
        let counter = 2;
        while (usedSkillIds.has(id)) {
          id = `skill-${cat}-${slug || idx + 1}-${counter++}`;
        }
      }
      usedSkillIds.add(id);
      nextSkillEntries.push({ id, category: cat, name });
    });
  }

  return {
    ...profile,
    personal: {
      fullName: profile.personal?.fullName || '',
      title: profile.personal?.title || '',
      email: profile.personal?.email || '',
      phone: profile.personal?.phone || '',
      location: profile.personal?.location || '',
      linkedin: profile.personal?.linkedin || '',
      portfolio: profile.personal?.portfolio || '',
      website: profile.personal?.website || '',
    },
    summary: {
      headline: profile.summary?.headline || '',
      summary: profile.summary?.summary || '',
      careerObjectives: profile.summary?.careerObjectives || '',
    },
    workExperience: (profile.workExperience || []).map((item, idx) => ({
      ...ensureItemId(item, 'exp', idx),
      company: item.company || '',
      position: item.position || '',
      location: item.location || '',
      employmentType: item.employmentType || 'Full-time',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      isCurrent: Boolean(item.isCurrent ?? (item as any).current),
      responsibilities: Array.isArray(item.responsibilities) ? item.responsibilities : [],
      achievements: Array.isArray(item.achievements) ? item.achievements : [],
      technologies: Array.isArray(item.technologies) ? item.technologies : [],
    })),
    education: (profile.education || []).map((item, idx) => ({
      ...ensureItemId(item, 'edu', idx),
      institution: item.institution || '',
      degree: item.degree || '',
      fieldOfStudy: item.fieldOfStudy || '',
      startDate: item.startDate || '',
      graduationDate: item.graduationDate || '',
      details: item.details || '',
    })),
    projects: (profile.projects || []).map((item, idx) => ({
      ...ensureItemId(item, 'proj', idx),
      name: item.name || '',
      role: item.role || '',
      description: item.description || '',
      technologies: Array.isArray(item.technologies) ? item.technologies : [],
      url: item.url || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
    })),
    certifications: (profile.certifications || []).map((item, idx) => ({
      ...ensureItemId(item, 'cert', idx),
      name: item.name || '',
      issuer: item.issuer || '',
      date: item.date || '',
      credentialId: item.credentialId || '',
      url: item.url || '',
    })),
    awards: (profile.awards || []).map((item, idx) => ({
      ...ensureItemId(item, 'award', idx),
      title: item.title || '',
      issuer: item.issuer || '',
      date: item.date || '',
      description: item.description || '',
    })),
    volunteer: (profile.volunteer || []).map((item, idx) => ({
      ...ensureItemId(item, 'vol', idx),
      organization: item.organization || '',
      role: item.role || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      description: item.description || '',
    })),
    languages: (profile.languages || []).map((item, idx) => ({
      ...ensureItemId(item, 'lang', idx),
      language: item.language || '',
      proficiency: item.proficiency || '',
    })),
    publications: (profile.publications || []).map((item, idx) => ({
      ...ensureItemId(item, 'pub', idx),
      title: item.title || '',
      publisher: item.publisher || '',
      date: item.date || '',
      url: item.url || '',
      summary: item.summary || '',
    })),
    skillEntries: nextSkillEntries,
  };
}

/**
 * Recursively removes `undefined` fields from objects/arrays because Firestore
 * rejects `undefined` property values inside `setDoc`/`updateDoc` payloads.
 */
export function stripUndefinedForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedForFirestore(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedForFirestore(v);
      }
    }
    return out as T;
  }
  return value;
}
