import { useState, useMemo } from 'react';
import { AlertCircle, X, Copy, Check, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { ImageUrlPreviewText } from '../ImageUrlHoverPreview';
import { usePendingChangesStore } from '@/stores/pending-changes-store';
import { cn } from '@/lib/utils';
import type { TableInfo } from '@/types';

interface JsonEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: Record<string, unknown>;
  rowIndex: number;
  tabId: string;
  tableInfo: TableInfo;
}

type JsonViewMode = 'tree' | 'source';

interface JsonTreeNodeProps {
  value: unknown;
  path: string;
  depth: number;
  propertyKey?: string;
  hasComma?: boolean;
  collapsedPaths: Record<string, boolean>;
  onToggle: (path: string) => void;
}

const INDENT_PX = 18;

function extractPrimaryKey(
  row: Record<string, unknown>,
  tableInfo: TableInfo
): Record<string, unknown> {
  const pk: Record<string, unknown> = {};
  const hashKey = tableInfo.keySchema.find((k) => k.keyType === 'HASH');
  const rangeKey = tableInfo.keySchema.find((k) => k.keyType === 'RANGE');

  if (hashKey) {
    pk[hashKey.attributeName] = row[hashKey.attributeName];
  }
  if (rangeKey) {
    pk[rangeKey.attributeName] = row[rangeKey.attributeName];
  }
  return pk;
}

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function getChildPath(path: string, key: string | number) {
  return `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function getContainerSummary(value: Record<string, unknown> | unknown[]) {
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  const label = Array.isArray(value) ? 'item' : 'field';
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function JsonPropertyKey({ name }: { name: string }) {
  return (
    <>
      <span className="text-amber-600 dark:text-amber-300">{JSON.stringify(name)}</span>
      <span className="text-muted-foreground">: </span>
    </>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-rose-600 dark:text-rose-300">null</span>;
  }

  if (typeof value === 'string') {
    return (
      <span className="text-emerald-700 dark:text-emerald-300">
        <ImageUrlPreviewText text={JSON.stringify(value)} />
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-sky-700 dark:text-sky-300">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-violet-700 dark:text-violet-300">{String(value)}</span>;
  }

  return <span className="text-muted-foreground">{JSON.stringify(value)}</span>;
}

function JsonTreeNode({
  value,
  path,
  depth,
  propertyKey,
  hasComma = false,
  collapsedPaths,
  onToggle,
}: JsonTreeNodeProps) {
  const paddingLeft = depth * INDENT_PX;

  if (!isJsonContainer(value)) {
    return (
      <div className="min-h-5 whitespace-pre leading-5" style={{ paddingLeft }}>
        <span className="inline-block w-5" />
        {propertyKey !== undefined && <JsonPropertyKey name={propertyKey} />}
        <JsonPrimitive value={value} />
        {hasComma && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((item, index) => ({ key: index, value: item }))
    : Object.entries(value).map(([key, item]) => ({ key, value: item }));
  const isCollapsed = collapsedPaths[path] ?? false;
  const openToken = isArray ? '[' : '{';
  const closeToken = isArray ? ']' : '}';

  if (entries.length === 0) {
    return (
      <div className="min-h-5 whitespace-pre leading-5" style={{ paddingLeft }}>
        <span className="inline-block w-5" />
        {propertyKey !== undefined && <JsonPropertyKey name={propertyKey} />}
        <span className="text-muted-foreground">{openToken}{closeToken}</span>
        {hasComma && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="min-h-5 whitespace-pre leading-5" style={{ paddingLeft }}>
        <button
          type="button"
          onClick={() => onToggle(path)}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground align-top transition-colors"
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${propertyKey ?? 'root'} JSON node`}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {propertyKey !== undefined && <JsonPropertyKey name={propertyKey} />}
        <span className="text-muted-foreground">{openToken}</span>
        {isCollapsed && (
          <>
            <span className="px-1 text-muted-foreground italic">{getContainerSummary(value)}</span>
            <span className="text-muted-foreground">{closeToken}</span>
            {hasComma && <span className="text-muted-foreground">,</span>}
          </>
        )}
      </div>
      {!isCollapsed && (
        <>
          {entries.map((entry, index) => (
            <JsonTreeNode
              key={String(entry.key)}
              value={entry.value}
              path={getChildPath(path, entry.key)}
              depth={depth + 1}
              propertyKey={isArray ? undefined : String(entry.key)}
              hasComma={index < entries.length - 1}
              collapsedPaths={collapsedPaths}
              onToggle={onToggle}
            />
          ))}
          <div className="min-h-5 whitespace-pre leading-5" style={{ paddingLeft }}>
            <span className="inline-block w-5" />
            <span className="text-muted-foreground">{closeToken}</span>
            {hasComma && <span className="text-muted-foreground">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonEditorDialog({
  isOpen,
  onClose,
  row,
  rowIndex,
  tabId,
  tableInfo,
}: JsonEditorDialogProps) {
  const { addChange } = usePendingChangesStore();
  const [jsonText, setJsonText] = useState(() => JSON.stringify(row, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [showPkWarning, setShowPkWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<JsonViewMode>('tree');
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

  // Get PK and SK attribute names
  const hashKeyAttr = tableInfo.keySchema.find((k) => k.keyType === 'HASH')?.attributeName;
  const rangeKeyAttr = tableInfo.keySchema.find((k) => k.keyType === 'RANGE')?.attributeName;
  const pkSkAttrs = useMemo(
    () => new Set([hashKeyAttr, rangeKeyAttr].filter(Boolean)),
    [hashKeyAttr, rangeKeyAttr]
  );

  // Parse the edited JSON and detect changes
  const { parsedJson, changes, hasPkSkChanges, isValid } = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { parsedJson: null, changes: [], hasPkSkChanges: false, isValid: false };
      }

      // Detect changes by comparing each field
      const changedFields: { field: string; oldValue: unknown; newValue: unknown }[] = [];
      let pkSkChanged = false;

      // Check for modified or added fields
      Object.keys(parsed).forEach((key) => {
        const oldValue = row[key];
        const newValue = parsed[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields.push({ field: key, oldValue, newValue });
          if (pkSkAttrs.has(key)) {
            pkSkChanged = true;
          }
        }
      });

      // Check for removed fields (set to undefined/null)
      Object.keys(row).forEach((key) => {
        if (!(key in parsed)) {
          changedFields.push({ field: key, oldValue: row[key], newValue: undefined });
          if (pkSkAttrs.has(key)) {
            pkSkChanged = true;
          }
        }
      });

      return { parsedJson: parsed, changes: changedFields, hasPkSkChanges: pkSkChanged, isValid: true };
    } catch {
      return { parsedJson: null, changes: [], hasPkSkChanges: false, isValid: false };
    }
  }, [jsonText, row, pkSkAttrs]);

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch {
      // Keep current text if invalid
    }
  };

  const handleToggleNode = (path: string) => {
    setCollapsedPaths((current) => ({
      ...current,
      [path]: !(current[path] ?? false),
    }));
  };

  const handleExpandAll = () => {
    setCollapsedPaths({});
  };

  const handleSave = () => {
    if (!isValid || changes.length === 0) {
      onClose();
      return;
    }

    // If PK/SK changed, show warning first
    if (hasPkSkChanges && !showPkWarning) {
      setShowPkWarning(true);
      return;
    }

    const primaryKey = extractPrimaryKey(row, tableInfo);

    if (hasPkSkChanges) {
      // Create new item with all edited values (pk-change)
      addChange(tabId, {
        tabId,
        rowIndex,
        primaryKey,
        type: 'pk-change',
        originalItem: row,
        newItem: parsedJson as Record<string, unknown>,
      });
    } else {
      // Add individual field updates
      changes.forEach(({ field, oldValue, newValue }) => {
        addChange(tabId, {
          tabId,
          rowIndex,
          primaryKey,
          type: 'update',
          field,
          originalValue: oldValue,
          newValue,
        });
      });
    }

    onClose();
  };

  const handleCancel = () => {
    setShowPkWarning(false);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself and there are no changes
    if (e.target === e.currentTarget && changes.length === 0) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-popover border rounded-lg shadow-lg w-[85vw] h-[85vh] overflow-hidden flex flex-col dialog-content">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg">View/Edit JSON</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={handleFormat}
              className="px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Format JSON"
            >
              Format
            </button>
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PK Warning */}
        {showPkWarning && (
          <div className="mx-4 mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Primary Key Change</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Changing the partition key or sort key will DELETE this item and CREATE a new one.
              This cannot be undone after applying changes.
            </p>
          </div>
        )}

        {/* Parse Error */}
        {parseError && (
          <div className="mx-4 mt-4 p-2 rounded-md bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-mono text-xs truncate">{parseError}</span>
            </div>
          </div>
        )}

        {/* JSON Editor */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                disabled={!isValid}
                className={cn(
                  'rounded px-2.5 py-1 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50',
                  viewMode === 'tree'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode('source')}
                className={cn(
                  'rounded px-2.5 py-1 text-xs transition-colors',
                  viewMode === 'source'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Source
              </button>
            </div>
            {viewMode === 'tree' && (
              <button
                type="button"
                onClick={handleExpandAll}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Expand all
              </button>
            )}
          </div>

          {viewMode === 'tree' && isValid && parsedJson ? (
            <div
              className={cn(
                'w-full flex-1 overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-sm',
                'focus-within:ring-2 focus-within:ring-ring'
              )}
            >
              <JsonTreeNode
                value={parsedJson}
                path="root"
                depth={0}
                collapsedPaths={collapsedPaths}
                onToggle={handleToggleNode}
              />
            </div>
          ) : (
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              spellCheck={false}
              aria-label="JSON source"
              className={cn(
                'w-full flex-1 p-3 rounded-md border bg-muted/30 font-mono text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                parseError && 'border-red-500'
              )}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {isValid ? (
              changes.length > 0 ? (
                <span>
                  {changes.length} field{changes.length !== 1 ? 's' : ''} modified
                  {hasPkSkChanges && (
                    <span className="text-amber-500 ml-2">(includes key change)</span>
                  )}
                </span>
              ) : (
                <span>No changes</span>
              )
            ) : (
              <span className="text-red-500">Invalid JSON</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || changes.length === 0}
            >
              {showPkWarning ? 'Confirm Changes' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
