import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Database, Loader2, Search, RefreshCw, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clampContextMenuPosition } from '@/lib/context-menu-position';
import { Button } from './ui/button';
import { useProfileStore } from '@/stores/profile-store';
import { useTableStore } from '@/stores/table-store';
import { useTabsStore } from '@/stores/tabs-store';

// Component to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-500/30 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tableName: string | null;
}

export function TableList() {
  const { selectedProfile, authStatuses, login } = useProfileStore();
  const {
    tablesByProfile,
    selectedTable,
    isLoadingTables,
    error,
    loadTables,
    selectTable,
  } = useTableStore();
  const { openTab, openTabInBackground } = useTabsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [openingTableName, setOpeningTableName] = useState<string | null>(null);
  const [describeTableError, setDescribeTableError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tableName: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const profileName = selectedProfile?.name;
  const tables = profileName ? tablesByProfile.get(profileName) || [] : [];
  const isAuthenticated = profileName ? authStatuses.get(profileName)?.authenticated : false;

  // Filter tables by search query
  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Extract the "friendly name" from table (e.g., "MetadataStack-savvymetadata..." -> "Metadata")
  const getTableDisplayName = (tableName: string): { stack: string; table: string } => {
    const match = tableName.match(/^([A-Za-z]+)Stack-/);
    const stack = match ? match[1] : '';
    return { stack, table: tableName };
  };

  const handleRefresh = () => {
    if (profileName) {
      loadTables(profileName);
    }
  };

  const handleLogin = async () => {
    if (!profileName) return;
    setLoggingIn(true);
    const result = await login(profileName);
    setLoggingIn(false);
    if (result.success) {
      loadTables(profileName);
    }
  };

  const openTable = async (tableName: string, inBackground = false) => {
    if (!profileName) return;
    setOpeningTableName(tableName);
    setDescribeTableError(null);
    try {
      const tableInfo = await window.dynomite.describeTable(profileName, tableName);
      if (inBackground) {
        openTabInBackground(tableName, tableInfo, profileName);
      } else {
        openTab(tableName, tableInfo, profileName);
        selectTable(profileName, tableName);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDescribeTableError(`Failed to open ${tableName}: ${message}`);
    } finally {
      setOpeningTableName(null);
    }
  };

  const handleTableClick = async (tableName: string) => {
    // Regular click opens in current/new active tab
    await openTable(tableName);
  };

  const handleContextMenu = (e: React.MouseEvent, tableName: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tableName,
    });
  };

  const handleOpenInNewTab = async () => {
    if (!contextMenu.tableName || !profileName) return;
    await openTable(contextMenu.tableName, true);
    setContextMenu({ visible: false, x: 0, y: 0, tableName: null });
  };

  const handleOpenInCurrentTab = async () => {
    if (!contextMenu.tableName || !profileName) return;
    await openTable(contextMenu.tableName);
    setContextMenu({ visible: false, x: 0, y: 0, tableName: null });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, tableName: null });
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
        setContextMenu({ visible: false, x: 0, y: 0, tableName: null });
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu.visible]);

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-50" />
        <p>Select a profile to view tables</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <AlertCircle className="h-12 w-12 text-yellow-500" />
        <p>Authentication required for {selectedProfile.name}</p>
        <Button onClick={handleLogin} disabled={loggingIn}>
          {loggingIn ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            'Login with SSO'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header - sticky at top */}
      <div className="flex items-center gap-2 p-3 border-b sticky top-0 bg-background z-10">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-8 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow duration-150"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoadingTables}
        >
          <RefreshCw className={cn('h-4 w-4', isLoadingTables && 'animate-spin')} />
        </Button>
      </div>

      {/* Error state */}
      {(error || describeTableError) && (
        <div className="px-3 py-2 text-sm text-red-500 bg-red-500/10 border-b">
          {describeTableError || error}
        </div>
      )}

      {/* Table list */}
      <div>
        {isLoadingTables ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            {searchQuery ? (
              <p className="text-sm">No tables match "{searchQuery}"</p>
            ) : (
              <p className="text-sm">No tables found</p>
            )}
          </div>
        ) : (
          <div className="p-1">
            {filteredTables.map((tableName) => {
              const { stack } = getTableDisplayName(tableName);
              const isSelected = selectedTable?.tableName === tableName;

              return (
                <button
                  key={tableName}
                  onClick={() => handleTableClick(tableName)}
                  onContextMenu={(e) => handleContextMenu(e, tableName)}
                  disabled={openingTableName !== null}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                    openingTableName !== null && 'cursor-wait opacity-70',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                >
                  {openingTableName === tableName ? (
                    <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {stack && (
                        <span className="text-muted-foreground">
                          <HighlightMatch text={stack} query={searchQuery} /> ·
                        </span>
                      )}
                      <span className="truncate">
                        <HighlightMatch text={tableName} query={searchQuery} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground sticky bottom-0 bg-background">
        {filteredTables.length} of {tables.length} tables
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] max-h-[calc(100vh-16px)] overflow-y-auto overscroll-contain bg-popover border rounded-md shadow-md py-1 context-menu-enter"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleOpenInCurrentTab}
            disabled={openingTableName !== null}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
          >
            Open
          </button>
          <button
            onClick={handleOpenInNewTab}
            disabled={openingTableName !== null}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
          >
            Open in New Tab
          </button>
        </div>
      )}
    </div>
  );
}
