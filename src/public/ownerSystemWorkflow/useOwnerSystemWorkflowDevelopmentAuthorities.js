import { useEffect, useMemo, useState } from 'react';
import { setFolderAssets, setFolderImage } from '../../library/domain/libraryWorkspace.js';

const cleanName = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 80);
const createId = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

function useOwnerSystemWorkflowDevelopmentAuthorities({ categories, enabled }) {
  const [reviewCategories, setReviewCategories] = useState(() => categories || []);
  const [categoryOrganization, setCategoryOrganization] = useState(() => ({
    rootCategoryIds: (categories || []).map(({ id }) => id), sections: [],
  }));
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
      setReviewCategories(folders => setFolderAssets({ folders }, id, assetIds, included).folders); return true;
    },
    setCategoryImage(id, assetId, url, included) {
      setReviewCategories(folders => setFolderImage({ folders }, id, assetId, url, included).folders); return true;
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
  return { categories: enabled ? reviewCategories : categories,
    categoryOrganization: enabled ? categoryOrganization : null, categoryCommands };
}

function useOwnerSystemWorkflowProductionAuthorities() {
  return null;
}

// Review state belongs only to the development build, never to live Library authority.
export default import.meta.env.DEV
  ? useOwnerSystemWorkflowDevelopmentAuthorities
  : useOwnerSystemWorkflowProductionAuthorities;
