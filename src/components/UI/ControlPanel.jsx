// src/components/UI/ControlPanel.jsx
import React, { lazy, Suspense, useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Skull, 
  Layers, 
  Sparkles, 
  Wind, 
  Zap,
  Sliders
} from 'lucide-react';

// Sub-Tab Component Imports
import SetupTab from './tabs/SetupTab';
import SkullTab from './tabs/SkullTab';
import BgTab from './tabs/BgTab';
import EyesTab from './tabs/EyesTab';
import AuraTab from './tabs/AuraTab';
import AtmosphereTab from './tabs/AtmosphereTab';
import GlitchTab from './tabs/GlitchTab';
import ActorPresetsTab from './tabs/ActorPresetsTab';
import PhenomenaTab from './tabs/PhenomenaTab';

const Web3Tab = lazy(() => import('./tabs/Web3Tab'));

function TabLoadingFallback() {
  return <p role="status" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>Loading panel…</p>;
}

export default function ControlPanel() {
  const isUiVisible = useStore((state) => state.isUiVisible);
  const toggleUi = useStore((state) => state.toggleUi);

  const [activeTab, setActiveTab] = useState('setup');

  const tabs = [
    { id: 'setup', label: 'Setup', icon: <Sliders size={12} />, component: <SetupTab /> },
    { id: 'web3', label: 'Web3', icon: <ShieldCheck size={12} />, component: <Suspense fallback={<TabLoadingFallback />}><Web3Tab /></Suspense> },
    { id: 'skull', label: 'Skull', icon: <Skull size={12} />, component: <SkullTab /> },
    { id: 'presets', label: 'Presets', icon: <Sliders size={12} />, component: <ActorPresetsTab /> },
    { id: 'phenomena', label: 'Phenomena', icon: <Sparkles size={12} />, component: <PhenomenaTab /> },
    { id: 'bg', label: 'Background', icon: <Layers size={12} />, component: <BgTab /> },
    { id: 'eyes', label: 'Eyes', icon: <Eye size={12} />, component: <EyesTab /> },
    { id: 'aura', label: 'Aura', icon: <Sparkles size={12} />, component: <AuraTab /> },
    { id: 'atmosphere', label: 'Atmosphere', icon: <Wind size={12} />, component: <AtmosphereTab /> },
    { id: 'glitch', label: 'Glitch', icon: <Zap size={12} />, component: <GlitchTab /> }
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <>
      <button
        className="atelier-controls-toggle"
        onClick={toggleUi}
        type="button"
        aria-label={isUiVisible ? 'Hide Atelier controls' : 'Show Atelier controls'}
        style={{
          position: 'fixed', top: '15px', right: '15px', zIndex: 100,
          background: 'var(--panel-bg)', border: '1px solid var(--border-color)',
          color: 'var(--text-main)', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', borderRadius: '0', 
        }}
      >
        {isUiVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      <div
        className="atelier-controls-panel"
        style={{
          position: 'fixed', bottom: 0, left: 0, width: '100%',
          background: 'var(--panel-bg)', borderTop: '1px solid var(--border-color)',
          zIndex: 50, padding: '15px', boxSizing: 'border-box',
          transform: isUiVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column', gap: '15px',
          maxHeight: '280px'
        }}
      >
        {/* Navigation Tabs List */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', scrollbarWidth: 'none' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'var(--accent-color)' : 'transparent',
                border: '1px solid var(--border-color)', color: 'var(--text-main)',
                fontSize: '9px', textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Panel Renderer */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          {currentTab ? currentTab.component : null}
        </div>
      </div>
    </>
  );
}
