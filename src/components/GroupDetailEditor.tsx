import React, { useEffect, useState } from 'react';

interface InspectorGroup {
  id: string;
  label: string;
  description?: string;
}

interface GroupDetailEditorProps {
  group: InspectorGroup;
  onUpdate: (updatedGroup: InspectorGroup) => void;
}

const GroupDetailEditor: React.FC<GroupDetailEditorProps> = ({ group, onUpdate }) => {
  const [label, setLabel] = useState(group.label);

  useEffect(() => {
    setLabel(group.label);
  }, [group.id, group.label]);

  const handleLabelChange = (nextLabel: string) => {
    setLabel(nextLabel);
    onUpdate({
      ...group,
      label: nextLabel,
    });
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="group-label-input">
          组标签
        </label>
        <input
          id="group-label-input"
          data-testid="group-label-input"
          className="topology-detail-input"
          type="text"
          value={label}
          onChange={(event) => handleLabelChange(event.target.value)}
        />
      </div>

      <div className="topology-detail-copy">
        {group.description ?? '当前修改的是该 neuron-group 实例的标签，会直接写回 canonical BrainIR container.label。'}
      </div>
    </div>
  );
};

export default GroupDetailEditor;
