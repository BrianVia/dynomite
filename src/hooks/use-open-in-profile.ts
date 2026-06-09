import { useState, useCallback } from 'react';
import { useProfileStore } from '@/stores/profile-store';
import { useTabsStore, type Tab, type TabQueryState } from '@/stores/tabs-store';
import { tablesMatch } from '@/lib/table-utils';

/**
 * Opens a tab's table in another AWS profile by matching the table's stable
 * CloudFormation prefix, carrying over the current query state (pre-filled,
 * not executed).
 */
export function useOpenInProfile() {
  const { checkAuth, login, getProfileDisplayName } = useProfileStore();
  const { openTabWithQueryState } = useTabsStore();
  const [openingProfileName, setOpeningProfileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openInProfile = useCallback(
    async (tab: Tab, targetProfileName: string): Promise<boolean> => {
      const displayName = getProfileDisplayName(targetProfileName);
      setOpeningProfileName(targetProfileName);
      setNotice(null);

      try {
        // Ensure the target profile is authenticated (trigger SSO login if needed)
        const status = await checkAuth(targetProfileName);
        if (!status.authenticated) {
          const result = await login(targetProfileName);
          if (!result.success) {
            setNotice(`Login failed for ${displayName}${result.error ? `: ${result.error}` : ''}`);
            return false;
          }
        }

        // Find the matching table via its stable CloudFormation prefix
        const tables = await window.dynomite.listTables(targetProfileName);
        const matchedTable = tables.find((t) => tablesMatch(t, tab.tableName));
        if (!matchedTable) {
          setNotice(`No matching table found in ${displayName}`);
          return false;
        }

        const tableInfo = await window.dynomite.describeTable(targetProfileName, matchedTable);

        // Carry the query state over, dropping the index if the target table doesn't have it
        const { selectedIndex } = tab.queryState;
        const indexExists =
          !!selectedIndex &&
          (tableInfo.globalSecondaryIndexes?.some((g) => g.indexName === selectedIndex) ||
            tableInfo.localSecondaryIndexes?.some((l) => l.indexName === selectedIndex));
        const clonedQueryState: Partial<TabQueryState> = {
          selectedIndex: indexExists ? selectedIndex : null,
          pkValue: tab.queryState.pkValue,
          scanPkPrefix: tab.queryState.scanPkPrefix,
          skOperator: tab.queryState.skOperator,
          skValue: tab.queryState.skValue,
          skValue2: tab.queryState.skValue2,
          filters: tab.queryState.filters.map((f) => ({ ...f })),
          maxResults: tab.queryState.maxResults,
          scanForward: tab.queryState.scanForward,
          lastOperation: tab.queryState.lastOperation,
        };

        openTabWithQueryState(matchedTable, tableInfo, targetProfileName, clonedQueryState);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNotice(`Failed to open in ${displayName}: ${message}`);
        return false;
      } finally {
        setOpeningProfileName(null);
      }
    },
    [checkAuth, login, getProfileDisplayName, openTabWithQueryState]
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  return { openInProfile, openingProfileName, notice, clearNotice };
}
