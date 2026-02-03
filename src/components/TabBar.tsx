import { X, Table2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { useProfileStore, PROFILE_COLORS } from '@/stores/profile-store';
import { cn } from '@/lib/utils';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
  } = useTabsStore();
  const { getProfileDisplayName, getProfileColor } = useProfileStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const contextTabIndex = contextMenu.tabId
    ? tabs.findIndex(t => t.id === contextMenu.tabId)
    : -1;
  const canCloseLeft = contextTabIndex > 0;
  const canCloseRight = contextTabIndex !== -1 && contextTabIndex < tabs.length - 1;
  const canCloseOthers = contextTabIndex !== -1 && tabs.length > 1;

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
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

  // Close context menu on scroll (window or tab bar)
  useEffect(() => {
    const handleAnyScroll = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    window.addEventListener('scroll', handleAnyScroll, true);
    const tabBarEl = tabBarRef.current;
    tabBarEl?.addEventListener('scroll', handleAnyScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleAnyScroll, true);
      tabBarEl?.removeEventListener('scroll', handleAnyScroll);
    };
  }, [contextMenu.visible]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div ref={tabBarRef} className="flex items-center border-b bg-muted/30 overflow-x-auto">
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
            onContextMenu={(e) => !tab.isClosing && handleTabContextMenu(e, tab.id)}
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

      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[190px] bg-popover border rounded-md shadow-md py-1 context-menu-enter"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              if (!contextMenu.tabId) return;
              closeTab(contextMenu.tabId);
              closeContextMenu();
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
          >
            Close Tab
          </button>

          <div className="my-1 border-t" />

          <button
            disabled={!canCloseOthers}
            onClick={() => {
              if (!contextMenu.tabId) return;
              closeOtherTabs(contextMenu.tabId);
              closeContextMenu();
            }}
            className={cn(
              'w-full px-3 py-1.5 text-sm text-left transition-colors',
              canCloseOthers ? 'hover:bg-accent' : 'text-muted-foreground cursor-not-allowed'
            )}
          >
            Close Other Tabs
          </button>
          <button
            disabled={!canCloseLeft}
            onClick={() => {
              if (!contextMenu.tabId) return;
              closeTabsToLeft(contextMenu.tabId);
              closeContextMenu();
            }}
            className={cn(
              'w-full px-3 py-1.5 text-sm text-left transition-colors',
              canCloseLeft ? 'hover:bg-accent' : 'text-muted-foreground cursor-not-allowed'
            )}
          >
            Close Tabs to the Left
          </button>
          <button
            disabled={!canCloseRight}
            onClick={() => {
              if (!contextMenu.tabId) return;
              closeTabsToRight(contextMenu.tabId);
              closeContextMenu();
            }}
            className={cn(
              'w-full px-3 py-1.5 text-sm text-left transition-colors',
              canCloseRight ? 'hover:bg-accent' : 'text-muted-foreground cursor-not-allowed'
            )}
          >
            Close Tabs to the Right
          </button>
        </div>
      )}
    </div>
  );
}
