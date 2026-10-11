import { useEffect, useMemo, useState } from 'react';

const cleanName = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 80);
const createId = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
const groupIdForName = (value) => cleanName(value).toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const groupEntryId = (entry) => typeof entry === 'string' ? entry : entry?.id;
const groupEntryName = (entry) => typeof entry === 'string' ? entry.replaceAll('-', ' ') : entry?.name;

export default function useOwnerSystemWorkflowDevelopmentAuthorities({ categories, discovery, enabled }) {
  const [reviewCategories, setReviewCategories] = useState(() => categories || []);
  const [categoryOrganization, setCategoryOrganization] = useState(() => ({
    rootCategoryIds: (categories || []).map(({ id }) => id), sections: [],
  }));
  const [reviewDiscovery, setReviewDiscovery] = useState(() => discovery || []);
  const [reviewGroups, setReviewGroups] = useState(() => [...new Map((discovery || []).map((entry) => {
    const name = cleanName(entry.group); const id = groupIdForName(name); return id ? [id, { id, name }] : null;
  }).filter(Boolean)).values()]);
  useEffect(() => {
    if (!enabled) return;
    const validIds = new Set(reviewCategories.map(({ id }) => id));
    setCategoryOrganization((current) => {
      const sections = current.sections.map((section) => ({ ...section,
        categoryIds: section.categoryIds.filter((id) => validIds.has(id)) }));
      const organized = new Set(sections.flatMap(({ categoryIds }) => categoryIds));
      const rootCategoryIds = current.rootCategoryIds.filter((id) => validIds.has(id) && !organized.has(id));
      for (const { id } of reviewCategories) if (!organized.has(id) && !rootCategoryIds.includes(id)) rootCategoryIds.push(id);
      return { rootCategoryIds, sections };
    });
  }, [enabled, reviewCategories]);
  const categoryCommands = useMemo(() => enabled ? {
    createCategory(name) {
      const value = cleanName(name); if (!value) return null;
      const id = createId('review-category');
      setReviewCategories((current) => [...current, { id, name: value, public: false, assetIds: [] }]);
      setCategoryOrganization((current) => ({ ...current, rootCategoryIds: [...current.rootCategoryIds, id] }));
      return id;
    },
    deleteCategory(id) {
      setReviewCategories((current) => current.filter((entry) => entry.id !== id));
      setCategoryOrganization((current) => ({
        rootCategoryIds: current.rootCategoryIds.filter((categoryId) => categoryId !== id),
        sections: current.sections.map((section) => ({ ...section,
          categoryIds: section.categoryIds.filter((categoryId) => categoryId !== id) })),
      }));
      return true;
    },
    renameCategory(id, name) {
      const value = cleanName(name); if (!value) return false;
      setReviewCategories((current) => current.map((entry) => entry.id === id ? { ...entry, name: value } : entry)); return true;
    },
    setCategoryAssets(id, assetIds, included) {
      setReviewCategories((current) => current.map((entry) => entry.id === id ? { ...entry, assetIds: included
        ? [...new Set([...entry.assetIds, ...assetIds])] : entry.assetIds.filter((assetId) => !assetIds.includes(assetId)) } : entry)); return true;
    },
    setCategoryPublic(id, value) { setReviewCategories((current) => current.map((entry) => entry.id === id ? { ...entry, public: Boolean(value) } : entry)); return true; },
    createSection(name) {
      const value = cleanName(name); if (!value) return null;
      const id = createId('review-section');
      setCategoryOrganization((current) => ({ ...current,
        sections: [...current.sections, { id, name: value, categoryIds: [] }] }));
      return id;
    },
    renameSection(id, name) {
      const value = cleanName(name); if (!value) return false;
      setCategoryOrganization((current) => ({ ...current, sections: current.sections.map((section) => section.id === id
        ? { ...section, name: value } : section) }));
      return true;
    },
    deleteSection(id) {
      setCategoryOrganization((current) => {
        const removed = current.sections.find((section) => section.id === id);
        return { rootCategoryIds: [...current.rootCategoryIds, ...(removed?.categoryIds || [])],
          sections: current.sections.filter((section) => section.id !== id) };
      });
      return true;
    },
    moveCategory(id, sectionId = null, beforeId = null) {
      setCategoryOrganization((current) => {
        if (id === beforeId) return current;
        const sections = current.sections.map((section) => ({ ...section,
          categoryIds: section.categoryIds.filter((categoryId) => categoryId !== id) }));
        const rootCategoryIds = current.rootCategoryIds.filter((categoryId) => categoryId !== id);
        const target = sectionId ? sections.find((section) => section.id === sectionId)?.categoryIds : rootCategoryIds;
        if (!target) return current;
        const index = beforeId ? target.indexOf(beforeId) : -1;
        target.splice(index < 0 ? target.length : index, 0, id);
        return { rootCategoryIds, sections };
      });
      return true;
    },
    moveSection(id, beforeId = null) {
      setCategoryOrganization((current) => {
        if (id === beforeId) return current;
        const sections = current.sections.filter((section) => section.id !== id);
        const moved = current.sections.find((section) => section.id === id); if (!moved) return current;
        const index = beforeId ? sections.findIndex((section) => section.id === beforeId) : -1;
        sections.splice(index < 0 ? sections.length : index, 0, moved);
        return { ...current, sections };
      });
      return true;
    },
  } : null, [enabled]);
  const discoveryCommands = useMemo(() => enabled ? {
    createGroup(name) {
      const value = cleanName(name); if (!value) return null;
      const id = groupIdForName(value) || createId('review-group');
      if (reviewGroups.some((entry) => groupEntryId(entry) === id)) return null;
      setReviewGroups((current) => [...current, { id, name: value }]);
      return id;
    },
    deleteGroup(id) {
      setReviewGroups((current) => current.filter((entry) => groupEntryId(entry) !== id));
      setReviewDiscovery((current) => current.map((entry) => groupIdForName(entry.group) === id ? { ...entry, group: '' } : entry));
      return true;
    },
    renameGroup(id, name) {
      const value = cleanName(name); if (!value) return null;
      if (reviewGroups.some((entry) => groupEntryId(entry) !== id
        && groupEntryName(entry)?.toLocaleLowerCase() === value.toLocaleLowerCase())) return null;
      setReviewGroups((current) => current.map((entry) => groupEntryId(entry) === id
        ? { id, name: value } : entry));
      return id;
    },
  } : null, [enabled, reviewGroups]);
  return { categories: enabled ? reviewCategories : categories,
    categoryOrganization: enabled ? categoryOrganization : null, categoryCommands,
    discovery: enabled ? reviewDiscovery : discovery, discoveryCommands, discoveryGroups: reviewGroups };
}
