import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import TabPanel from './TabPanel';
import ScriptEditArea from './ScriptEditArea';
import SNNTopologyEditor from '../views/SNNTopologyEditor';
import AgentParametersPanel from './AgentParametersPanel';
import './SettingsPanel.css';

const SettingsPanel: React.FC = () => {
  const { t } = useLanguage();
  
  // 临时的 props 来满足类型检查，这些将在后续被全局状态替代
  const dummyScript = `// Welcome to NeuralSoup!
function onFrame(agent) {
  // agent.move([forward, turn, strafe, fire]);
  agent.move([0.5, 0.1, 0, 0]);
}`;

  const tabs = [
    {
      id: 'script',
      label: t('tab.script'), // Script Editor
      content: (
        <ScriptEditArea
          currentScriptName="default"
          savedScripts={{ default: dummyScript }}
          onFrameCode={dummyScript}
          isScriptApplied={true}
          onScriptChange={() => {}}
          onCodeChange={() => {}}
          onScriptApply={() => {}}
        />
      ),
    },
    {
      id: 'params',
      label: t('tab.agent-params'), // Agent Parameters
      content: (
        <AgentParametersPanel
          currentParams={{ visionCells: 32, visionRange: 250, visionAngle: 120 }}
          onApply={() => {}}
        />
      ),
    },
    {
      id: 'snn',
      label: t('tab.snn'), // SNN Editor
      content: <SNNTopologyEditor width={400} height={600} />,
    },
  ];

  return (
    <div className="settings-panel">
      <TabPanel tabs={tabs} />
    </div>
  );
};

export default SettingsPanel;
