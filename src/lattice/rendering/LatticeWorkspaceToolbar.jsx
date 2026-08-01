import {
  Archive,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  Grid2X2,
  MoreHorizontal,
  Palette,
  Copy,
  RotateCw,
  Settings,
  Upload,
} from 'lucide-react';
import './latticeWorkspaceToolbar.css';

const TOOL_ICONS = Object.freeze({
  browser: Archive,
  arrange: Grid2X2,
  duplicate: Copy,
  mirrorHorizontal: FlipHorizontal2,
  mirrorVertical: FlipVertical2,
  preview: Eye,
  theme: Palette,
  publish: Upload,
  more: MoreHorizontal,
  rotate: RotateCw,
});

export default function LatticeWorkspaceToolbar({
  activeToolId = null,
  activeToolIds = [],
  arrangeEnabled = false,
  blocked = false,
  compact = false,
  embedded = false,
  faceplate = false,
  owner = false,
  tools = [],
  onEscape,
  onToolActivate,
  toolButtonRefs = {},
}) {
  if (!owner) return null;
  const isToolActive = (toolId) => activeToolId === toolId || activeToolIds.includes(toolId);

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onEscape?.();
  };

  return <>
    <nav
      aria-label="Owner workspace tools"
      className="lattice-workspace-toolbar"
      data-blocked={blocked || undefined}
      data-compact={compact || undefined}
      data-embedded={embedded || undefined}
      data-faceplate={faceplate || undefined}
      data-lattice-chrome
      inert={blocked ? '' : undefined}
      onKeyDown={handleKeyDown}
    >
      {!compact && <span className="lattice-workspace-toolbar__label">OWNER / WORKSPACE</span>}
      {tools.map((tool) => {
        const Icon = TOOL_ICONS[tool.id];
        if (!Icon) return null;
        const active = tool.id === 'arrange' ? arrangeEnabled : isToolActive(tool.id);
        return (
          <button
            aria-label={tool.label}
            aria-pressed={active}
            className="lattice-workspace-toolbar__tool"
            data-active={active || undefined}
            key={tool.id}
            disabled={tool.disabled === true}
            onClick={(event) => onToolActivate?.(tool.id, event.currentTarget, event.currentTarget)}
            ref={toolButtonRefs[tool.id]}
            title={tool.disabledReason || (compact ? tool.label : undefined)}
            type="button"
          >
            <Icon aria-hidden="true" size={14} strokeWidth={2} />
            {(!compact || (faceplate && tool.id === 'arrange')) && <span>{tool.label}</span>}
          </button>
        );
      })}
    </nav>
    {isToolActive('more') && !blocked && <section className="lattice-workspace-toolbar__more" data-lattice-chrome aria-label="More workspace tools" onKeyDown={handleKeyDown}>
      <button type="button" onClick={(event) => onToolActivate?.('settings', event.currentTarget, toolButtonRefs.more?.current || event.currentTarget)}><Settings aria-hidden="true" size={14} strokeWidth={2} />SETTINGS</button>
    </section>}
  </>;
}
