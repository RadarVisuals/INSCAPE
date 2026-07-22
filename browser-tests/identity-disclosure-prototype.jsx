import React, { useEffect, useId, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';
import './identity-disclosure-prototype.css';

// Deliberately invented, browser-test-only data. Nothing in this object is a
// production profile projection or a publication-format proposal.
const PROTOTYPE_IDENTITY = Object.freeze({
  name: 'VXCTXR#F3C1',
  address: '0xf3c189819fd5b042f692983bfbfd57ab607ee709',
  displayAddress: '0xf3c18981\u2026ee709',
  avatarUrl: '/fixtures/profile-identity-radar.svg',
  bio: 'Turning feeling into form. Building a memory beneath the visible world.',
  tags: Object.freeze(['Artist', 'Music', 'Motion']),
  links: Object.freeze([
    { label: 'VXCTXR // X', url: 'https://example.com/vxctxr' },
    { label: 'Radar // X', url: 'https://example.com/radar-x' },
    { label: 'Radar // UP', url: 'https://example.com/radar-up' }
  ]),
  officialUrl: 'https://universaleverything.io/0xf3c189819fd5b042f692983bfbfd57ab607ee709'
});

const WORLD_DOCUMENT = Object.freeze({
  version: 4,
  profile: {
    address: PROTOTYPE_IDENTITY.address,
    cachedIdentity: { name: PROTOTYPE_IDENTITY.name, avatarUrl: undefined }
  },
  presentation: { keeperId: 'abyssal_eye', stageId: 'void', environment: null },
  spaces: Object.freeze([
    {
      id: 'prototype:archive',
      order: 0,
      label: 'First Public Test',
      kind: 'folder',
      placement: { column: 7, row: 1 },
      appearance: { mode: 'label', iconKey: 'folder', showLabel: true, columnSpan: 4, rowSpan: 1 },
      startOpen: true,
      windowGeometry: { column: 10, row: 1, columnSpan: 11, rowSpan: 8 },
      assets: Object.freeze(Array.from({ length: 3 }, (_, index) => ({
        stableAssetId: `42:${PROTOTYPE_IDENTITY.address}:0x0${index + 1}`,
        network: 'lukso-mainnet',
        chainId: 42,
        tokenStandard: 'LSP8',
        contractAddress: PROTOTYPE_IDENTITY.address,
        tokenId: `0x0${index + 1}`,
        cachedName: ['Memory Fragment', 'Signal Study', 'Keeper Record'][index]
      })))
    }
  ]),
  canvasObjects: Object.freeze([])
});

function PublicIdentityDisclosure() {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const toggleExpanded = () => setExpanded((current) => !current);
  const handleToggleKeyDown = (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggleExpanded();
  };

  useEffect(() => {
    const collapse = (event) => {
      if (event.key !== 'Escape' || !expanded) return;
      event.preventDefault();
      setExpanded(false);
      document.querySelector('[data-identity-disclosure-trigger]')?.focus();
    };
    document.addEventListener('keydown', collapse);
    return () => document.removeEventListener('keydown', collapse);
  }, [expanded]);

  return (
    <aside className="identity-prototype" data-expanded={expanded || undefined} aria-label="Public profile identity prototype">
      <div className="identity-prototype__bar">
        <button
          className="identity-prototype__trigger"
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          data-identity-disclosure-trigger
          onClick={toggleExpanded}
          onKeyDown={handleToggleKeyDown}
        >
          <strong>{PROTOTYPE_IDENTITY.name}</strong>
        </button>
        <button
          className="identity-prototype__signal-control"
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${PROTOTYPE_IDENTITY.name} public profile`}
          onClick={toggleExpanded}
          onKeyDown={handleToggleKeyDown}
        >
          <span className="identity-prototype__signal" aria-hidden="true" />
        </button>
        <a
          className="identity-prototype__official"
          href={PROTOTYPE_IDENTITY.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          aria-label="Open official Universal Profile for VXCTXR"
        >
          <span aria-hidden="true">{'\u2197'}</span>
        </a>
      </div>

      <section className="identity-prototype__content" id={contentId} hidden={!expanded}>
        <code className="identity-prototype__address" title={PROTOTYPE_IDENTITY.address}>{PROTOTYPE_IDENTITY.displayAddress}</code>
        <div className="identity-prototype__person">
          <img src={PROTOTYPE_IDENTITY.avatarUrl} alt="" draggable="false" />
          <p className="identity-prototype__bio">{PROTOTYPE_IDENTITY.bio}</p>
        </div>

        <ul className="identity-prototype__tags" aria-label="Public profile tags">
          {PROTOTYPE_IDENTITY.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>

        <nav className="identity-prototype__links" aria-label="Public profile links">
          {PROTOTYPE_IDENTITY.links.map((link) => (
            <a href={link.url} key={link.label} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
              <span aria-hidden="true">{'\u2197'}</span>{link.label}
            </a>
          ))}
        </nav>
      </section>
    </aside>
  );
}

function Prototype() {
  return (
    <div className="application-root identity-prototype-page" data-browser-fixture data-application-mode="public">
      <div className="application-world" data-visible>
        <img className="identity-prototype-page__keeper" src="/assets/actors/abyssal_eye/full.webp" alt="" draggable="false" />
      </div>
      <div className="application-interface" data-visible>
        <PublishedHomeWorld document={WORLD_DOCUMENT} />
        <PublicIdentityDisclosure />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Prototype />);
