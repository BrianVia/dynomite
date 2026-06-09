import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  Play,
  ScanLine,
  Bookmark,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clampContextMenuPosition } from '@/lib/context-menu-position';
import { useQueryHistoryStore } from '@/stores/query-history-store';
import { useTabsStore } from '@/stores/tabs-store';
import { useProfileStore, PROFILE_COLORS } from '@/stores/profile-store';
import { useNow } from '@/hooks/use-now';
import { SaveBookmarkDialog } from './dialogs/SaveBookmarkDialog';
import { OpenInProfileNotice } from './OpenInProfileMenu';
import type { QueryHistoryEntry } from '@/types';

function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function summarizeConditions(entry: QueryHistoryEntry): string {
  const parts: string[] = [];

  if (entry.pkValue) {
    parts.push(`pk ${entry.scanPkPrefix ? 'begins with' : '='} ${entry.pkValue}`);
  }
  if (entry.skValue) {
    const between =
      entry.skOperator === 'between' && entry.skValue2 ? `..${entry.skValue2}` : '';
    parts.push(`sk ${entry.skOperator} ${entry.skValue}${between}`);
  }
  if (entry.filters.length > 0) {
    parts.push(`${entry.filters.length} filter${entry.filters.length !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return entry.operation === 'scan' ? 'Full scan' : 'No conditions';
  }
  return parts.join(' · ');
}

export function QueryHistoryList() {
  const { entries, deleteEntry, clearHistory } = useQueryHistoryStore();
  const { openTabWithQueryState } = useTabsStore();
  const { checkAuth, login, getProfileDisplayName, getProfileColor } = useProfileStore();
  const now = useNow();
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookmarkingEntry, setBookmarkingEntry] = useState<QueryHistoryEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    entry: QueryHistoryEntry | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    entry: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenu({ visible: false, x: 0, y: 0, entry: null });
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

  // Replay opens a new tab in the entry's profile with the query staged (not executed)
  const handleReplay = async (entry: QueryHistoryEntry) => {
    if (replayingId) return;
    setReplayingId(entry.id);
    setNotice(null);

    try {
      // Ensure the entry's profile is authenticated (trigger SSO login if needed)
      const status = await checkAuth(entry.profileName);
      if (!status.authenticated) {
        const result = await login(entry.profileName);
        if (!result.success) {
          const displayName = getProfileDisplayName(entry.profileName);
          setNotice(`Login failed for ${displayName}${result.error ? `: ${result.error}` : ''}`);
          return;
        }
      }

      const tableInfo = await window.dynomite.describeTable(entry.profileName, entry.tableName);

      // Drop the index if it no longer exists on the table
      const indexExists =
        !!entry.selectedIndex &&
        (tableInfo.globalSecondaryIndexes?.some((g) => g.indexName === entry.selectedIndex) ||
          tableInfo.localSecondaryIndexes?.some((l) => l.indexName === entry.selectedIndex));

      openTabWithQueryState(entry.tableName, tableInfo, entry.profileName, {
        selectedIndex: indexExists ? entry.selectedIndex : null,
        pkValue: entry.pkValue,
        scanPkPrefix: entry.scanPkPrefix,
        skOperator: entry.skOperator,
        skValue: entry.skValue,
        skValue2: entry.skValue2,
        filters: entry.filters.map((f) => ({ ...f })),
        maxResults: entry.maxResults,
        scanForward: entry.scanForward,
        lastOperation: entry.operation,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(`Failed to replay query: ${message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: QueryHistoryEntry) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entry,
    });
  };

  const handleMenuReplay = () => {
    if (contextMenu.entry) {
      handleReplay(contextMenu.entry);
    }
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });
  };

  const handleMenuSaveBookmark = () => {
    if (contextMenu.entry) {
      setBookmarkingEntry(contextMenu.entry);
    }
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });
  };

  const handleMenuDelete = () => {
    if (contextMenu.entry) {
      deleteEntry(contextMenu.entry.id);
    }
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });
  };

  const handleClearAll = () => {
    clearHistory();
    setConfirmingClear(false);
  };

  return (
    <>
      <div className="border-t">
        {/* Header */}
        <div className="flex items-center">
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
              setConfirmingClear(false);
            }}
            className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">History</span>
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {entries.length}
              </span>
            )}
          </button>
          {isExpanded && entries.length > 0 && (
            <button
              onClick={() => setConfirmingClear(true)}
              className="p-2 mr-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Clear all history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* History List */}
        {isExpanded && (
          <div className="pb-2">
            {/* Clear-all confirmation */}
            {confirmingClear && (
              <div className="mx-2 mb-1 px-2 py-1.5 rounded bg-muted/50 flex items-center justify-between gap-2">
                <span className="text-xs">Clear all history?</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearAll}
                    className="px-2 py-0.5 rounded text-xs text-red-500 hover:bg-muted transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setConfirmingClear(false)}
                    className="px-2 py-0.5 rounded text-xs hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {entries.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No queries yet.
                <br />
                Run a query or scan to see it here.
              </div>
            ) : (
              <div className="space-y-0.5 px-2">
                {entries.map((entry) => {
                  const colorConfig = PROFILE_COLORS.find(
                    (c) => c.value === getProfileColor(entry.profileName)
                  );
                  const isReplaying = replayingId === entry.id;

                  return (
                    <button
                      key={entry.id}
                      onClick={() => handleReplay(entry)}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      title={`${entry.operation === 'query' ? 'Query' : 'Scan'} ${entry.tableName}`}
                      className={cn(
                        'w-full flex flex-col gap-0.5 px-2 py-1.5 rounded text-left',
                        'hover:bg-muted transition-colors',
                        replayingId !== null && !isReplaying && 'opacity-50'
                      )}
                    >
                      <div className="w-full flex items-center gap-2 min-w-0">
                        {isReplaying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                        ) : entry.operation === 'query' ? (
                          <Play className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ScanLine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate flex-1 text-sm">{entry.tablePrefix}</span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                            colorConfig?.classes || 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                          )}
                        >
                          {getProfileDisplayName(entry.profileName)}
                        </span>
                      </div>
                      <div className="w-full flex items-center gap-1.5 pl-[22px] text-xs text-muted-foreground min-w-0">
                        <span className="truncate flex-1">{summarizeConditions(entry)}</span>
                        {entry.resultCount !== undefined && (
                          <span className="shrink-0">{entry.resultCount.toLocaleString()} rows</span>
                        )}
                        <span className="shrink-0">·</span>
                        <span className="shrink-0">
                          {formatRelativeTime(entry.executedAt, now)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] max-h-[calc(100vh-16px)] overflow-y-auto overscroll-contain bg-popover border rounded-md shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleMenuReplay}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Play className="h-4 w-4" />
            Replay in New Tab
          </button>
          <button
            onClick={handleMenuSaveBookmark}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Bookmark className="h-4 w-4" />
            Save as Bookmark
          </button>
          <div className="border-t my-1" />
          <button
            onClick={handleMenuDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-muted transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Replay failure notice */}
      <OpenInProfileNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* Save as Bookmark Dialog */}
      {bookmarkingEntry && (
        <SaveBookmarkDialog
          isOpen={!!bookmarkingEntry}
          onClose={() => setBookmarkingEntry(null)}
          tableName={bookmarkingEntry.tableName}
          queryState={bookmarkingEntry}
        />
      )}
    </>
  );
}
