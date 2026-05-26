import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentIR, WorldRegistry } from '../../domain/brain';
import type { HostRuntimeProfile } from '../../host';
import {
  type BrainLibraryRecord,
  createBrainLibraryItemFromAgent,
  deleteBrainLibraryItem,
  duplicateBrainLibraryItem,
  renameBrainLibraryItem,
  upsertBrainLibraryItemAgent,
} from '../../storage/brainLibraryRecord';
import {
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from '../../storage/brainLibraryExchange';
import { saveBrainLibrary } from '../../storage/brainLibraryStorage';

const serializeBrainLibrarySnapshot = (brains: BrainLibraryRecord[]): string =>
  JSON.stringify(brains);

interface UseBrainLibraryCoordinatorOptions {
  initialBrains: BrainLibraryRecord[];
  initialStatusMessage: string | null;
  worldRegistry: WorldRegistry;
  hostProfile: HostRuntimeProfile;
  visionCells: number;
  currentAgentId: string;
  currentDraftAgentRef: React.MutableRefObject<AgentIR>;
  hasUnsavedDraftChanges: boolean;
  syncAgentParametersFromBrain: (agent: AgentIR) => void;
  onActivateBrain: (brain: BrainLibraryRecord) => void;
  onAdoptCreatedBrain: (brain: BrainLibraryRecord) => void;
  onRenameActiveBrainMetadata: (brainId: string, agent: AgentIR) => void;
  onDeleteActiveBrainFallback: (fallbackAgent: AgentIR) => void;
}

export const useBrainLibraryCoordinator = ({
  initialBrains,
  initialStatusMessage,
  worldRegistry,
  hostProfile,
  visionCells,
  currentAgentId,
  currentDraftAgentRef,
  hasUnsavedDraftChanges,
  syncAgentParametersFromBrain,
  onActivateBrain,
  onAdoptCreatedBrain,
  onRenameActiveBrainMetadata,
  onDeleteActiveBrainFallback,
}: UseBrainLibraryCoordinatorOptions) => {
  const [brainLibrary, setBrainLibrary] = useState<BrainLibraryRecord[]>(initialBrains);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(null);
  const [isBrainLibraryOpen, setIsBrainLibraryOpen] = useState(false);
  const [brainLibraryStatusMessage, setBrainLibraryStatusMessage] =
    useState<string | null>(initialStatusMessage);
  const persistedBrainLibrarySnapshotRef = useRef(
    serializeBrainLibrarySnapshot(initialBrains)
  );

  useEffect(() => {
    const nextSnapshot = serializeBrainLibrarySnapshot(brainLibrary);
    if (persistedBrainLibrarySnapshotRef.current === nextSnapshot) {
      return;
    }

    try {
      saveBrainLibrary(brainLibrary, worldRegistry);
      persistedBrainLibrarySnapshotRef.current = nextSnapshot;
      setBrainLibraryStatusMessage((currentMessage) =>
        currentMessage?.startsWith('Brain Library 保存失败') ? null : currentMessage
      );
    } catch (error) {
      setBrainLibraryStatusMessage(
        error instanceof Error ? error.message : 'Brain Library 保存失败。'
      );
    }
  }, [brainLibrary, worldRegistry]);

  const confirmUnsavedBrainReplacement = useCallback((): boolean => {
    if (!hasUnsavedDraftChanges) {
      return true;
    }

    return window.confirm(
      '当前 Brain 存在尚未保存或未安装的草稿改动。继续会丢失这些编辑内容，是否继续？'
    );
  }, [hasUnsavedDraftChanges]);

  const handleCreateBrainFromCurrent = useCallback(
    (name: string) => {
      const nextBrain = createBrainLibraryItemFromAgent(
        name,
        currentDraftAgentRef.current,
        worldRegistry
      );
      setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
      setIsBrainLibraryOpen(true);
      setActiveBrainId(nextBrain.agent.metadata.id);
      syncAgentParametersFromBrain(nextBrain.agent);
      onAdoptCreatedBrain(nextBrain);
    },
    [currentDraftAgentRef, onAdoptCreatedBrain, syncAgentParametersFromBrain, worldRegistry]
  );

  const handleSelectBrain = useCallback(
    (brainId: string) => {
      if (!confirmUnsavedBrainReplacement()) {
        return;
      }

      const selectedBrain = brainLibrary.find(
        (brain) => brain.agent.metadata.id === brainId
      );
      if (!selectedBrain) {
        return;
      }

      setActiveBrainId(selectedBrain.agent.metadata.id);
      syncAgentParametersFromBrain(selectedBrain.agent);
      onActivateBrain(selectedBrain);
    },
    [brainLibrary, confirmUnsavedBrainReplacement, onActivateBrain, syncAgentParametersFromBrain]
  );

  const handleImportBrain = useCallback(
    (name: string, payload: unknown) => {
      const existingIds = Array.from(
        new Set([
          ...brainLibrary.map((brain) => brain.agent.metadata.id),
          currentAgentId,
        ])
      );
      const nextBrain = normalizeImportedBrainExchange(payload, worldRegistry, {
        name,
        existingIds,
      });
      if (!nextBrain) {
        throw new Error('导入内容规范化失败。');
      }
      if (!confirmUnsavedBrainReplacement()) {
        return;
      }

      setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
      setActiveBrainId(nextBrain.agent.metadata.id);
      syncAgentParametersFromBrain(nextBrain.agent);
      onActivateBrain(nextBrain);
    },
    [
      brainLibrary,
      confirmUnsavedBrainReplacement,
      currentAgentId,
      onActivateBrain,
      syncAgentParametersFromBrain,
      worldRegistry,
    ]
  );

  const handleExportBrain = useCallback(
    (brainId: string) => {
      const selectedBrain = brainLibrary.find(
        (brain) => brain.agent.metadata.id === brainId
      );
      if (!selectedBrain) {
        return;
      }

      const exportedPackage = encodeBrainLibraryRecordForExchange(selectedBrain);
      const blob = new Blob([JSON.stringify(exportedPackage, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${
        selectedBrain.agent.metadata.name || selectedBrain.agent.metadata.id
      }.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [brainLibrary]
  );

  const handleRenameBrain = useCallback(
    (brainId: string, name: string) => {
      const nextLibrary = renameBrainLibraryItem(brainLibrary, brainId, name);
      setBrainLibrary(nextLibrary);
      if (brainId !== activeBrainId) {
        return;
      }

      const renamedActiveBrain = nextLibrary.find(
        (brain) => brain.agent.metadata.id === brainId
      );
      if (!renamedActiveBrain) {
        return;
      }

      onRenameActiveBrainMetadata(brainId, renamedActiveBrain.agent);
    },
    [activeBrainId, brainLibrary, onRenameActiveBrainMetadata]
  );

  const handleDeleteBrain = useCallback(
    (brainId: string) => {
      setBrainLibrary((currentLibrary) => deleteBrainLibraryItem(currentLibrary, brainId));
      if (activeBrainId !== brainId) {
        return;
      }

      const fallbackAgent = hostProfile.createSeedAgentIR(visionCells, '当前 Agent');
      setActiveBrainId(null);
      onDeleteActiveBrainFallback(fallbackAgent);
    },
    [activeBrainId, hostProfile, onDeleteActiveBrainFallback, visionCells]
  );

  const handleDuplicateBrain = useCallback((brainId: string) => {
    setBrainLibrary((currentLibrary) => duplicateBrainLibraryItem(currentLibrary, brainId));
  }, []);

  const persistActiveBrainAgent = useCallback(
    (agent: AgentIR, updatedAt: string) => {
      if (!activeBrainId) {
        return;
      }

      setBrainLibrary((currentLibrary) =>
        upsertBrainLibraryItemAgent(
          currentLibrary,
          activeBrainId,
          agent,
          worldRegistry,
          updatedAt
        )
      );
    },
    [activeBrainId, worldRegistry]
  );

  return {
    brainLibrary,
    activeBrainId,
    isBrainLibraryOpen,
    brainLibraryStatusMessage,
    openBrainLibrary: () => setIsBrainLibraryOpen(true),
    closeBrainLibrary: () => setIsBrainLibraryOpen(false),
    handleCreateBrainFromCurrent,
    handleSelectBrain,
    handleImportBrain,
    handleExportBrain,
    handleRenameBrain,
    handleDeleteBrain,
    handleDuplicateBrain,
    persistActiveBrainAgent,
  };
};
