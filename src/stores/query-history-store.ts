import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueryHistoryEntry, FilterCondition, SkOperator } from '../types';
import { extractTablePrefix } from '@/lib/table-utils';

// Parameters captured when a query/scan execution starts
export interface QueryExecutionRecord {
  profileName: string;
  tableName: string;
  operation: 'query' | 'scan';
  selectedIndex: string | null;
  pkValue: string;
  scanPkPrefix: boolean;
  skOperator: SkOperator;
  skValue: string;
  skValue2: string;
  filters: FilterCondition[];
  maxResults: number;
  scanForward: boolean;
}

interface QueryHistoryState {
  // Newest-first list of executed queries/scans, capped at MAX_HISTORY_ENTRIES
  entries: QueryHistoryEntry[];

  // Actions
  recordExecution: (execution: QueryExecutionRecord) => string;
  setResultCount: (entryId: string, resultCount: number) => void;
  deleteEntry: (entryId: string) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_ENTRIES = 200;

let historyIdCounter = 0;
const generateHistoryId = () => `history-${Date.now()}-${++historyIdCounter}`;

const filtersMatch = (a: FilterCondition[], b: FilterCondition[]): boolean =>
  a.length === b.length &&
  a.every(
    (filter, i) =>
      filter.attribute === b[i].attribute &&
      filter.operator === b[i].operator &&
      filter.value === b[i].value &&
      filter.value2 === b[i].value2
  );

const executionsMatch = (
  entry: QueryHistoryEntry,
  execution: QueryExecutionRecord
): boolean =>
  entry.profileName === execution.profileName &&
  entry.tableName === execution.tableName &&
  entry.operation === execution.operation &&
  entry.selectedIndex === execution.selectedIndex &&
  entry.pkValue === execution.pkValue &&
  entry.scanPkPrefix === execution.scanPkPrefix &&
  entry.skOperator === execution.skOperator &&
  entry.skValue === execution.skValue &&
  entry.skValue2 === execution.skValue2 &&
  entry.maxResults === execution.maxResults &&
  entry.scanForward === execution.scanForward &&
  filtersMatch(entry.filters, execution.filters);

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      recordExecution: (execution) => {
        const latest = get().entries[0];

        // Dedup consecutive identical executions: refresh the latest entry
        // instead of adding a duplicate (result count re-attaches on completion)
        if (latest && executionsMatch(latest, execution)) {
          set((state) => ({
            entries: [
              { ...latest, executedAt: Date.now(), resultCount: undefined },
              ...state.entries.slice(1),
            ],
          }));
          return latest.id;
        }

        const newEntry: QueryHistoryEntry = {
          ...execution,
          filters: execution.filters.map((f) => ({ ...f })),
          id: generateHistoryId(),
          tablePrefix: extractTablePrefix(execution.tableName),
          executedAt: Date.now(),
        };

        set((state) => ({
          entries: [newEntry, ...state.entries].slice(0, MAX_HISTORY_ENTRIES),
        }));

        return newEntry.id;
      },

      setResultCount: (entryId, resultCount) => {
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === entryId ? { ...entry, resultCount } : entry
          ),
        }));
      },

      deleteEntry: (entryId) => {
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== entryId),
        }));
      },

      clearHistory: () => {
        set({ entries: [] });
      },
    }),
    {
      name: 'dynomite-query-history',
      // Persist everything (entries are small and capped)
    }
  )
);
