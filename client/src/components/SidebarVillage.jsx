import { useState } from 'react';
import VillageIllustration from './VillageIllustration.jsx';
import './sidebar-village.css';

export default function SidebarVillage() {
  const [paused, setPaused] = useState(false);
  return <section className="nx-sidebar-village" aria-label="Bangladesh village scene">
    <div className="nx-sidebar-landscape"><VillageIllustration mood="spring" paused={paused} /></div>
    <div className="nx-sidebar-scene-label"><span lang="bn">শিকড়ে বাংলাদেশ</span><button type="button" aria-label={paused ? 'Play sidebar scene' : 'Pause sidebar scene'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button></div>
  </section>;
}
