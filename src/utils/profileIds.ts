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
    workExperience: (profile.workExperience || []).map((item, idx) => ensureItemId(item, 'exp', idx)),
    education: (profile.education || []).map((item, idx) => ensureItemId(item, 'edu', idx)),
    projects: (profile.projects || []).map((item, idx) => ensureItemId(item, 'proj', idx)),
    certifications: (profile.certifications || []).map((item, idx) => ensureItemId(item, 'cert', idx)),
    awards: (profile.awards || []).map((item, idx) => ensureItemId(item, 'award', idx)),
    volunteer: (profile.volunteer || []).map((item, idx) => ensureItemId(item, 'vol', idx)),
    languages: (profile.languages || []).map((item, idx) => ensureItemId(item, 'lang', idx)),
    publications: (profile.publications || []).map((item, idx) => ensureItemId(item, 'pub', idx)),
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
