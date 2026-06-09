import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Table2 } from 'lucide-react';
import { useTabsStore } from '@/stores/tabs-store';
import { useProfileStore, PROFILE_COLORS } from '@/stores/profile-store';
import { useOpenInProfile } from '@/hooks/use-open-in-profile';
import { OpenInProfileMenuItems, OpenInProfileNotice } from './OpenInProfileMenu';
import { clampContextMenuPosition } from '@/lib/context-menu-position';
import { cn } from '@/lib/utils';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabsStore();
  const { getProfileDisplayName, getProfileColor } = useProfileStore();
  const { openInProfile, openingProfileName, notice, clearNotice } = useOpenInProfile();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const contextMenuTab = contextMenu.tabId
    ? tabs.find((t) => t.id === contextMenu.tabId) || null
    : null;

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  };

  const handleOpenInProfile = async (targetProfileName: string) => {
    if (!contextMenuTab) return;
    await openInProfile(contextMenuTab, targetProfileName);
    closeContextMenu();
  };

  const handleCloseTab = () => {
    if (contextMenuTab && !contextMenuTab.isClosing) {
      closeTab(contextMenuTab.id);
    }
    closeContextMenu();
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  useLayoutEffect(() => {
    if (!contextMenu.visible || !contextMenuRef.current) return;

    const nextPosition = clampContextMenuPosition(
      contextMenu.x,
      contextMenu.y,
      contextMenuRef.current.getBoundingClientRect()
    );

    if (nextPosition.x !== contextMenu.x || nextPosition.y !== contextMenu.y) {
      setContextMenu((current) => ({
        ...current,
        x: nextPosition.x,
        y: nextPosition.y,
      }));
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y]);

  // Close context menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu.visible]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
      {tabs.map((tab) => {
        const displayName = getProfileDisplayName(tab.profileName);
        const color = getProfileColor(tab.profileName);
        const colorConfig = PROFILE_COLORS.find(c => c.value === color);
        return (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 border-r cursor-pointer group min-w-0 max-w-[280px]',
              'hover:bg-muted/50 transition-all duration-200',
              activeTabId === tab.id
                ? 'bg-background border-b-2 border-b-primary'
                : 'bg-muted/20',
              tab.isNew && 'tab-enter',
              tab.isClosing && 'tab-exit'
            )}
            onClick={() => !tab.isClosing && setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          >
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
              colorConfig?.classes || 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
            )}>
              {displayName}
            </span>
            <Table2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs truncate">{tab.tableName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!tab.isClosing) closeTab(tab.id);
              }}
              className="ml-auto p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* Context Menu */}
      {contextMenu.visible && contextMenuTab && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[240px] max-h-[calc(100vh-16px)] overflow-y-auto overscroll-contain bg-popover border rounded-md shadow-md py-1 context-menu-enter"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCloseTab}
            disabled={openingProfileName !== null}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
            Close Tab
          </button>
          <div className="border-t my-1" />
          <div className="px-3 py-1.5 text-xs text-muted-foreground">
            Open in another profile
          </div>
          <OpenInProfileMenuItems
            currentProfileName={contextMenuTab.profileName}
            openingProfileName={openingProfileName}
            onSelect={handleOpenInProfile}
          />
        </div>
      )}

      <OpenInProfileNotice notice={notice} onDismiss={clearNotice} />
    </div>
  );
}
