import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Check,
  Copy,
  Hand,
  Image,
  Info,
  Layers,
  MousePointer2,
  Plus,
  Search,
  Shapes,
  Type,
} from 'lucide-react';
import WorkbenchToolbar from '../src/public/ownerSystemWorkflow/WorkbenchToolbar.jsx';
import DetachedWindow from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowDetachedWindow.jsx';
import WorkspacePreview from './workspacePreview.jsx';
import { PropertiesPreview, ControlStatesSheet } from './reviewExamples.jsx';
import {
  colorRoles,
  components,
  designDecisions,
  principles,
  system,
  themes,
  tokenSources,
  typography,
} from './registry.js';
import inventory from './tokens.generated.json';
import '../src/inscapeTokens.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import './referenceTokens.css';
import '../src/public/ownerSystemWorkflow/workflowFlat.css';
import './referenceMaterial.css';
import './reference.css';
import './toolbarPreview.css';
import './propertiesPreview.css';
import './controlStates.css';
import {
  Source,
  SourcePreview,
  ReferenceDocuments,
  ProductContract,
} from './referenceLinks.local.jsx';

const sections = [
  ['overview', 'Overview'],
  ['foundations', 'Foundations'],
  ['components', 'Components'],
  ['patterns', 'Patterns'],
  ['tokens', 'Token explorer'],
  ['coverage', 'Implementation'],
  ['guidance', 'Build with it'],
];
const tokenRows = inventory.sources.flatMap((source) =>
  source.definitions.map((token) => ({ ...token, source: source.path, role: source.role })),
);
const icons = [
  ['Select', MousePointer2],
  ['Hand', Hand],
  ['Text', Type],
  ['Shapes', Shapes],
  ['Artwork', Image],
  ['Layers', Layers],
  ['Info', Info],
  ['Add', Plus],
];
function DesignStatus({ id, status }) {
  const value = status || designDecisions.find((item) => item.id === id)?.status || 'review';
  return (
    <span className="ds-badge" data-design-status={value}>
      {{ review: 'Needs review', agreed: 'Agreed', app: 'In the app' }[value]}
    </span>
  );
}
function SectionTitle({ number, title, children }) {
  return (
    <header className="ds-section-title">
      <p className="ds-eyebrow">{number} / INSCAPE design system</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
function Card({ title, children, className = '' }) {
  return (
    <section className={`ds-card ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CreationToolbarExample({ onAction }) {
  const [tool, setTool] = useState('select'),
    [libraryOpen, setLibraryOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false),
    [infoOpen, setInfoOpen] = useState(false);
  return (
    <WorkbenchToolbar
      activeTool={tool}
      onToolChange={(value) => {
        setTool(value);
        onAction(value.charAt(0).toUpperCase() + value.slice(1) + ' tool');
      }}
      libraryOpen={libraryOpen}
      onOpenLibrary={() => {
        setLibraryOpen((value) => !value);
        onAction(libraryOpen ? 'Library closed' : 'Library opened');
      }}
      layers={{
        enabled: true,
        open: layersOpen,
        onToggle: () => {
          setLayersOpen((value) => !value);
          onAction(layersOpen ? 'Layers closed' : 'Layers opened');
        },
      }}
      info={{
        enabled: true,
        open: infoOpen,
        onToggle: () => {
          setInfoOpen((value) => !value);
          onAction(infoOpen ? 'Artwork info closed' : 'Artwork info opened');
        },
      }}
      actions={[
        {
          id: 'duplicate',
          label: 'Duplicate artwork',
          icon: Copy,
          onSelect: () => onAction('Duplicate artwork'),
        },
        {
          id: 'align',
          label: 'Align',
          children: [
            {
              id: 'horizontal',
              label: 'Horizontal centre',
              onSelect: () => onAction('Horizontal centre'),
            },
          ],
        },
      ]}
      addCommands={[
        { id: 'image', label: 'Image', icon: Image, onSelect: () => onAction('Add Image') },
        { id: 'text', label: 'Text', icon: Type, onSelect: () => onAction('Add Text') },
      ]}
      shapeCommands={[
        {
          id: 'rectangle',
          label: 'Rectangle',
          icon: Shapes,
          onSelect: () => onAction('Add Rectangle'),
        },
      ]}
    />
  );
}

function Overview({ theme, setTheme }) {
  const [message, setMessage] = useState('Select a tool. Try the menus.');
  const report = (label) => setMessage(label + ' · preview only');
  return (
    <>
      <SectionTitle number="00" title="Space for the artwork.">
        A quieter toolbar. Two themes. More room for what you make.
      </SectionTitle>
      <div className="ds-overview-art">
        <div className="ds-overview-type">
          <span className="ds-eyebrow">TOOLBAR / DIRECTION 01</span>
          <p>
            Less chrome.
            <br />
            More room.
          </p>
          <span>
            Flat controls. One clear selection.
            <br />
            The tools you know, with less weight.
          </span>
        </div>
        <div
          className="ds-overview-instrument ds-flat-preview"
          data-lattice-menu-surface
          data-menu-surface={theme}
        >
          <div className="ds-overview-preview-label">
            <span>Creation toolbar</span>
            <span>{theme}</span>
          </div>
          <CreationToolbarExample onAction={report} />
          <p className="ds-overview-feedback" role="status">
            {message}
          </p>
        </div>
      </div>
      <div className="ds-overview-themes" role="group" aria-label="Preview theme">
        {themes.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            data-lattice-menu-surface
            data-menu-surface={value}
          >
            <i aria-hidden="true" />
            <span>
              <strong>{value}</strong>
              <small>{value === 'carbon' ? 'Dark and focused' : 'Light and warm'}</small>
            </span>
            <Check aria-hidden="true" size={16} />
          </button>
        ))}
      </div>
      <p className="ds-caption ds-review-caption">
        <DesignStatus id="toolbar" /> Design preview · actions stay on this page.
      </p>
    </>
  );
}

function Foundations() {
  return (
    <>
      <SectionTitle number="01" title="Foundations">
        Use roles to express intent. Let the owning stylesheet supply the value.
      </SectionTitle>
      <h2>Palette and semantic roles</h2>
      <div className="ds-swatches">
        {colorRoles.map(([token, name, description]) => (
          <article key={token}>
            <div className="ds-swatch" style={{ background: `var(${token})` }} />
            <h3>{name}</h3>
            <p>{description}</p>
            <code>{token}</code>
          </article>
        ))}
      </div>
      <p className="ds-caption">
        Use readable ink for text and a visible neutral outline for keyboard focus. Subtle borders
        are for separation.
      </p>
      <h2>Carbon and Mist</h2>
      <div className="ds-themes">
        {themes.map((theme) => (
          <article
            className="ds-flat-preview"
            key={theme}
            data-lattice-menu-surface
            data-menu-surface={theme}
          >
            <strong>{theme}</strong>
            <span>Primary information</span>
            <small>Supporting information</small>
            <div className="ds-theme-instrument" data-workflow-material="tactile" data-workflow-finish="flat">
              <span>Selected tool</span>
              <small>Instrument surface</small>
            </div>
          </article>
        ))}
      </div>
      <p>
        Carbon pairs a dark surface with dark instruments; Mist pairs a warm light surface with
        light instruments. Keyboard focus follows the instrument ink; selection uses a distinct fill
        and state mark.
      </p>
      <h2>Typography</h2>
      <div className="ds-type-list">
        {typography.map(([token, name, example]) => (
          <article key={token}>
            <div>
              <strong>{name}</strong>
              <code>{token}</code>
            </div>
            <p style={{ font: `var(${token})` }}>{example}</p>
          </article>
        ))}
      </div>
      <div className="ds-grid">
        <Card title="Human interface">
          <p>
            Sora supplies controls, navigation, titles and body copy. Reuse an existing role before
            choosing a size or weight.
          </p>
        </Card>
        <Card title="Technical and dense">
          <p>
            IBM Plex Sans Condensed supplies measurements, addresses, metadata and compact
            supporting copy.
          </p>
        </Card>
        <Card title="Creation bar only">
          <p>
            Inter Variable is scoped to the creation bar. Popup copy retains Sora and Plex. Authored
            article fonts have a separate contract.
          </p>
        </Card>
      </div>
      <h2>Spacing, targets and edges</h2>
      <div className="ds-spacing">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n}>
            <code>--space-{n}</code>
            <i style={{ width: `var(--space-${n})` }} />
            <span>{n * 4} px</span>
          </div>
        ))}
      </div>
      <div className="ds-grid">
        <Card title="Density is contextual">
          <p>
            Creation keys: 36 px; narrow layouts and coarse pointers: 44 px. Companion fields: 32 px
            desktop, 44 px narrow/coarse. Text keeps its specific editor density. Image resize
            targets: 28 screen px.
          </p>
        </Card>
        <Card title="Geometry has meaning">
          <p>
            Toolbar buttons, search fields and menu rows use 5 px corners. Add the 4 px inset for a
            9 px outer bar or popup. Popup borders count toward that inset: 1 px border + 3 px
            padding.
          </p>
        </Card>
        <Card title="Screen and work coordinates">
          <p>
            Controls stay usable through zoom. Workbench and Stage coordinates own composition
            geometry. The 4 px interface scale never quantizes artwork.
          </p>
        </Card>
      </div>
      <h2>Icons</h2>
      <div className="ds-icon-row">
        {icons.map(([name, Icon]) => (
          <figure key={name}>
            <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </div>
      <p>
        Use the existing Lucide family and the established glyph for each action. Give icon controls
        an accessible action name and a tooltip. The wordmark remains the existing SVG.
      </p>
      <h2>Motion and layering</h2>
      <div className="ds-grid">
        <Card title="Brief, purposeful feedback">
          <p>
            The refined controls respond immediately without moving their targets. Existing module
            transitions keep their own timing and reduced-motion behavior.
          </p>
        </Card>
        <Card title="Module-owned travel">
          <p>
            Focus and artwork Lift use their existing 460 ms controller; Image side turns use 600
            ms. These interactions retain their own cancellation and reduced-motion paths.
          </p>
        </Card>
        <Card title="Layers are scoped">
          <p>
            Global layer tokens describe the application stack. Workbench windows, selection,
            toolbars and popups also have local stacking contexts. Never resolve a conflict with an
            arbitrary global z-index.
          </p>
        </Card>
      </div>
    </>
  );
}

function ComponentExamples({ theme }) {
  const [pressed, setPressed] = useState(false);
  const [message, setMessage] = useState('Example only — changes stay on this page.');
  const report = (label) => setMessage(`Example action: ${label}. No draft was changed.`);
  return (
    <>
      <SectionTitle number="02" title="Components in use">
        The shared workspace, retained control coverage and interface states.
      </SectionTitle>
      <WorkspacePreview theme={theme} onAction={report} status={<DesignStatus id="workspace" />} />
      <div className="ds-flat-preview" data-menu-surface={theme}>
        <section
          className="ds-card ds-control-examples ds-live-controls"
          data-workflow-material="tactile" data-workflow-finish="flat"
        >
          <h2>Control states</h2>
          <p>
            Hover, press and Tab through these controls. A solid fill marks the active tool; a
            softer fill and small mark show secondary selection. Keyboard focus stays separate.
          </p>
          <div className="ds-controls">
            <button className="workflow-tactile-control" onClick={() => report('Default control')}>
              Default
            </button>
            <button
              className="workflow-tactile-control"
              aria-pressed={pressed}
              onClick={() => setPressed((value) => !value)}
            >
              Toggle selection
            </button>
            <button
              className="workflow-tactile-control ds-primary-selection"
              aria-pressed="true"
              onClick={() => report('Selected tool')}
            >
              Selected tool
            </button>
            <button className="workflow-tactile-control" disabled title="Choose artwork first">
              Unavailable
            </button>
            <button
              className="workflow-tactile-control workflow-tactile-control--quiet"
              onClick={() => report('Quiet command')}
            >
              Quiet command
            </button>
          </div>
          <p className="ds-caption">
            Unavailable example: choose artwork first. Disabled controls retain a quiet, unchanged
            appearance.
          </p>
          <Source path="design-system/controlStates.css" />
        </section>
      </div>
      <p className="ds-example-status" role="status" aria-live="polite">
        {message}
      </p>
      <details className="ds-studio-baseline">
        <summary>Existing Properties controls · full reference</summary>
        <p>
          The existing Image, Display artwork and Shape controls remain here while we review their
          new homes in the shared tabs.
        </p>
        <PropertiesPreview
          theme={theme}
          onAction={report}
          status={<DesignStatus id="properties" />}
        />
      </details>
      <ControlStatesSheet onAction={report} status={<DesignStatus id="states" />} />
      <details className="ds-production-examples">
        <summary>Current production windows</summary>
        <p>These windows still use the existing material. Keep them as migration references.</p>
        <div className="ds-grid ds-windows">
          <Card title="Retained bevel shell">
            <DesignStatus status="app" />
            <p>
              Identity and compatible windows keep their theme-aware bevel. Tool migration does not
              rewrite them.
            </p>
            <div data-lattice-menu-surface data-menu-surface={theme}>
              <DetachedWindow
                ariaLabel="Example Identity shell"
                title="Identity · example"
                chrome="bevel"
                menuSurface={theme}
                className="ds-example-window"
                controls={
                  <button
                    className="system-workflow__window-cap"
                    aria-label="Example identity information"
                    onClick={() => report('Identity information')}
                  >
                    <Info aria-hidden="true" />
                  </button>
                }
              >
                <p className="ds-shell-copy">
                  The shell owns this frame. Identity supplies the trusted profile header, authored
                  content and background.
                </p>
                <p className="ds-shell-copy">
                  Current surface: <strong>{theme}</strong>
                </p>
              </DetachedWindow>
            </div>
            <Source path="src/public/ownerSystemWorkflow/OwnerSystemWorkflowDetachedWindow.jsx" />
          </Card>
        </div>
      </details>
      <h2>Full production fixtures</h2>
      <p>
        Open an isolated scene to inspect complete workflows. These fixtures use disposable
        in-memory content.
      </p>
      <div className="ds-links">
        {[
          ['Creation and menus', 'workbench-toolbar-fixture.html'],
          ['Layers', 'tool-chrome-fixture.html?sample=layers'],
          ['Image tools', 'tool-chrome-fixture.html?sample=image'],
          ['Shape tools', 'tool-chrome-fixture.html?sample=shape'],
          ['Keeper tools', 'tool-chrome-fixture.html?sample=keeper'],
        ].map(([label, url]) => (
          <a key={url} href={`/browser-tests/${url}`} target="_blank" rel="noreferrer">
            {label}
            <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
    </>
  );
}

function Patterns() {
  return (
    <>
      <SectionTitle number="03" title="Patterns and boundaries">
        Keep the purpose of each surface clear, including what a visitor can change.
      </SectionTitle>
      <div className="ds-flow" aria-label="Product hierarchy">
        <span>Workbench</span>
        <b>→</b>
        <span>Module</span>
        <b>→</b>
        <span>Stage / article / media</span>
        <b>→</b>
        <span>Independent assets</span>
      </div>
      <div className="ds-grid">
        {[
          [
            'Compose',
            'Choose material in Library → place it in a compatible module → edit through that module’s tools → save through its existing draft operation. Preserve source identity and transparency.',
          ],
          [
            'Select and inspect',
            'Click or keyboard focus activates bounds. Hover alone does not select a module. Focus travels the camera; Inspect reveals artwork. Escape closes the nearest interaction before consuming Back.',
          ],
          [
            'Edit precisely',
            'Show the active target in the tool header. Incomplete values stay local. Valid changes use the existing transaction; cancellation restores the starting state. Retargeting cancels stale gestures.',
          ],
          [
            'Navigate',
            'Hand and camera movement are temporary. Named destinations are authored views. Moving the camera does not resize content, change text wrapping or create a draft edit.',
          ],
          [
            'Publish deliberately',
            'Saved locally, prepared, uploaded and published are different outcomes. Include only chosen public material. The published snapshot stays unchanged until explicit publication.',
          ],
          [
            'Receive visitors',
            'Visitors use the shared renderer and exposed module interactions. Their movement, reading and playback are temporary. Authoring tools and private Library content stay outside the public projection.',
          ],
        ].map(([title, text]) => (
          <Card key={title} title={title}>
            <p>{text}</p>
          </Card>
        ))}
      </div>
      <h2>State language</h2>
      <div className="ds-table-wrap">
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>What the interface must say</th>
              <th>Recovery / action</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                'Loading',
                'Content is still being read.',
                'Keep context; allow cancellation when supported.',
              ],
              ['Empty', 'A successful read found no content.', 'Offer an applicable next action.'],
              [
                'Unavailable',
                'Content or capability cannot currently be reached.',
                'Explain the reason and offer a working route.',
              ],
              [
                'Stale',
                'Shown information belongs to an earlier read.',
                'Retain source and scope; offer refresh.',
              ],
              [
                'Failed',
                'The requested operation did not complete.',
                'Preserve work; expose the existing retry or recovery path.',
              ],
              [
                'Saved',
                'The local persistence operation is confirmed.',
                'Do not imply that the work is published.',
              ],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Responsive composition</h2>
      <p>
        Reflow the interface while preserving authored geometry. At 520 px and below, creation uses
        two centred rows. Companion tools reserve room above the measured bottom controls. Long copy
        wraps; the owning surface scrolls. Reception remains a bounded host for the same modules.
      </p>
      <aside className="ds-note">
        Artwork, module appearance, Workbench background and menu theme are separate decisions.
        Never propagate a chrome token change into stored artwork settings.
      </aside>
    </>
  );
}

function Tokens() {
  const [query, setQuery] = useState(''),
    [role, setRole] = useState('Shared'),
    [limit, setLimit] = useState(60);
  const filtered = tokenRows.filter(
    (token) =>
      (role === 'All' ||
        (role === 'Shared'
          ? !['Local', 'Reference local'].includes(token.role)
          : token.role === role)) &&
      `${token.name} ${token.value} ${token.source} ${token.scope.join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <SectionTitle number="04" title="Token explorer">
        Production and reference CSS, including theme scopes and accessibility overrides. Reference
        tokens are marked separately; runtime variables are not automatically shared design tokens.
      </SectionTitle>
      <div className="ds-search-row">
        <label>
          <Search aria-hidden="true" size={17} />
          <span className="ds-sr-only">Search tokens</span>
          <input
            type="search"
            placeholder="Search name, value, selector or source…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(60);
            }}
          />
        </label>
        <label>
          Scope
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setLimit(60);
            }}
          >
            <option>Shared</option>
            <option>All</option>
            {[...new Set(tokenRows.map((token) => token.role))].map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="ds-caption">
        {filtered.length} declarations · showing {Math.min(limit, filtered.length)}. Repeated names
        can have different theme or media scopes.
      </p>
      <div className="ds-token-list">
        {filtered.slice(0, limit).map((token, i) => (
          <article key={`${token.source}:${token.line}:${i}`}>
            <div>
              <strong>{token.name}</strong>
              <span className="ds-badge">{token.role}</span>
            </div>
            <code>{token.value}</code>
            <details>
              <summary>Scope and source</summary>
              <p>{token.scope.join(' → ')}</p>
              <Source path={token.source} />
              <p>
                Line {token.line}
                {token.references.length > 0 ? ` · References ${token.references.join(', ')}` : ''}
              </p>
            </details>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="ds-empty">No tokens match. Try a shorter name or choose All scopes.</p>
      )}
      {filtered.length > limit && (
        <button className="ds-button" onClick={() => setLimit((value) => value + 60)}>
          Show 60 more
        </button>
      )}
      <p className="ds-note">
        Shared sources are the public reuse entry points. “Local” includes component overrides and
        runtime layout variables, which are not automatically reusable design tokens. The JSON
        preserves CSS expressions; it does not claim DTCG format compliance.
      </p>
      <a className="ds-button" href="/design-system/tokens.generated.json" download>
        Download CSS token inventory
      </a>
    </>
  );
}

function Coverage() {
  const [query, setQuery] = useState('');
  return (
    <>
      <SectionTitle number="05" title="Implementation map">
        What is in the app today. These entries describe existing implementation; the new design
        decisions are tracked in Build with it.
      </SectionTitle>
      <label className="ds-search-label">
        Find a component
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, material or responsibility…"
        />
      </label>
      <div className="ds-component-list">
        {components
          .filter((component) =>
            JSON.stringify(component).toLowerCase().includes(query.toLowerCase()),
          )
          .map((component) => (
            <article key={component.id}>
              <header>
                <h2>{component.name}</h2>
                <DesignStatus status="app" />
              </header>
              <p className="ds-caption">
                {component.kind} · {component.material}
                {component.status === 'Retained' ? ' · retained treatment' : ''}
              </p>
              <p>{component.contract}</p>
              <Source path={component.source} />
              <details>
                <summary>Verification entry point</summary>
                <Source path={component.evidence} />
                <p>
                  A linked check is a place to verify behavior, not a claim of universal
                  accessibility or browser conformance.
                </p>
              </details>
            </article>
          ))}
      </div>
      <h2>Style ownership</h2>
      {tokenSources.map((source) => (
        <div key={source.path} className="ds-owner-row">
          <strong>{source.role}</strong>
          <div>
            <Source path={source.path} />
            <p>{source.purpose}</p>
          </div>
        </div>
      ))}
    </>
  );
}

function Guidance() {
  return (
    <>
      <SectionTitle number="06" title="Build with the system">
        Reuse the established contract, then verify the result in its real workflow.
      </SectionTitle>
      <h2>Design decisions</h2>
      <p>
        Agreed means the direction is accepted. In the app means it is already implemented. Needs
        review means a proposal or an outstanding design decision.
      </p>
      <div className="ds-decision-list">
        {designDecisions.map((item) => (
          <article key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <DesignStatus id={item.id} />
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <h2>Design principles</h2>
      <dl className="ds-principles">
        {principles.map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <h2>Implementation workflow</h2>
      <div className="ds-grid">
        <Card title="1. Locate the responsibility">
          <p>
            Read the active contract and creative intent. Identify the existing UI, state,
            persistence and access owner. Use the implementation map to find the actual component.
          </p>
        </Card>
        <Card title="2. Reuse the recipe">
          <p>
            Overview and Components share the flat reference recipe. Use the implementation map to
            identify production surfaces that still need migration. Keep authored settings outside
            interface styling.
          </p>
        </Card>
        <Card title="3. Exercise the states">
          <p>
            Check default, hover, press, selected, focus, disabled and loading. Use keyboard and
            touch, light and dark surroundings, reduced motion and forced colours.
          </p>
        </Card>
        <Card title="4. Keep evidence current">
          <p>
            Regenerate the inventory after CSS changes, update the component contract, run relevant
            tests, and inspect representative wide and narrow screenshots.
          </p>
        </Card>
      </div>
      <h2>Current production control API</h2>
      <pre>{`import '../public/ownerSystemWorkflow/workflowTactile.css';\nimport '../public/ownerSystemWorkflow/workflowFlat.css';\n\n<div data-workflow-material="tactile" data-workflow-finish="flat">\n  <button type="button" className="workflow-tactile-control"\n    aria-pressed={selected} onClick={onSelect}>\n    Select\n  </button>\n</div>`}</pre>
      <p>
        Provide geometry in the consuming component. A CSS class supplies material, not keyboard
        behavior or a save operation. Prefer an existing complete component whenever its semantics
        fit.
      </p>
      <h2>Accessibility acceptance</h2>
      <ul className="ds-checklist">
        <li>
          <Check aria-hidden="true" />
          Controls have names, visible focus and keyboard equivalents.
        </li>
        <li>
          <Check aria-hidden="true" />
          Text contrast reaches 4.5:1 for normal text; large text and required non-text information
          meet applicable 3:1 thresholds.
        </li>
        <li>
          <Check aria-hidden="true" />
          Selection does not rely on colour alone. Focus is distinct from selection.
        </li>
        <li>
          <Check aria-hidden="true" />
          Dialogs manage initial focus, containment and return. Non-modal tools remain non-modal.
        </li>
        <li>
          <Check aria-hidden="true" />
          Reduced motion, forced colours, 200% text size and narrow layouts preserve access.
        </li>
        <li>
          <Check aria-hidden="true" />
          Errors preserve content and identify an effective recovery action.
        </li>
      </ul>
      <p className="ds-note">
        These are acceptance criteria. The catalogue and browser checks do not certify the whole
        application as WCAG conformant. Retained compact controls and some translucent theme
        combinations need context-specific review.
      </p>
      <ReferenceDocuments />
      <h2>Local verification</h2>
      <pre>{`npm run design-system:tokens\nnpm run design-system:check\nnpm run test:design-system\n# With the dev server running at http://127.0.0.1:5217:\nnpm run test:browser:design-system`}</pre>
    </>
  );
}

function Reference() {
  const currentSection = () =>
    sections.some(([id]) => id === location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  const [section, setSection] = useState(currentSection),
    [theme, setTheme] = useState('carbon');
  const main = useRef(null),
    first = useRef(true);
  const navigate = (id) => {
    location.hash = id;
  };
  useEffect(() => {
    const change = () => setSection(currentSection());
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `INSCAPE · ${sections.find(([id]) => id === section)[1]}`;
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [section]);
  return (
    <div
      className="ds-reference system-workflow__token-scope"
      data-reference-section={section}
      data-lattice-menu-surface
      data-menu-surface={theme}
    >
      <a
        className="ds-skip"
        href="#reference-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
          main.current?.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to content
      </a>
      <aside className="ds-sidebar">
        <a className="ds-wordmark" href="#overview" aria-label="Inscape design system overview">
          <span />
        </a>
        <div className="ds-system-label">
          Design system <span>v{system.version}</span>
        </div>
        <nav aria-label="Design system">
          {sections.map(([id, label], i) => (
            <a href={`#${id}`} key={id} aria-current={section === id ? 'page' : undefined}>
              <span>0{i}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="ds-sidebar-footer">
          <span>Built from the product</span>
          <small>Reference · {system.reviewed}</small>
          <ProductContract />
        </div>
      </aside>
      <div className="ds-main-column">
        <header className="ds-topbar">
          <span>INSCAPE / Interface reference</span>
          <label>
            Preview surface
            <select
              aria-label="Preview surface"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              {themes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </header>
        <main id="reference-content" ref={main} tabIndex="-1">
          {section === 'overview' ? (
            <Overview theme={theme} setTheme={setTheme} />
          ) : section === 'foundations' ? (
            <Foundations />
          ) : section === 'components' ? (
            <ComponentExamples theme={theme} />
          ) : section === 'patterns' ? (
            <Patterns />
          ) : section === 'tokens' ? (
            <Tokens />
          ) : section === 'coverage' ? (
            <Coverage />
          ) : (
            <Guidance />
          )}
        </main>
        <footer className="ds-footer">
          <span>Artwork leads. Instruments stay coherent.</span>
          <span>Local reference · no profile connected</span>
        </footer>
      </div>
    </div>
  );
}

const sourcePath = new URLSearchParams(location.search).get('source');
createRoot(document.getElementById('root')).render(
  sourcePath !== null && SourcePreview ? (
    <SourcePreview path={sourcePath} sections={sections} />
  ) : (
    <Reference />
  ),
);
