import './galleryNavigationCard.css';

export default function GalleryNavigationCard({ visible = false, open = false, onOpenChange }) {
  return <section className="gallery-navigation-card" aria-hidden={!visible} data-visible={visible || undefined} data-expanded={open || undefined}>
    <button type="button" tabIndex={visible ? 0 : -1} aria-expanded={open} onClick={() => onOpenChange?.(!open)}>
      <strong>GALLERY</strong><i aria-hidden="true">›</i>
    </button>
  </section>;
}
