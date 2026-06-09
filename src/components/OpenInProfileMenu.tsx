import { useEffect } from 'react';
import { AlertCircle, Loader2, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileStore, PROFILE_COLORS } from '@/stores/profile-store';

interface OpenInProfileMenuItemsProps {
  currentProfileName: string;
  openingProfileName: string | null;
  onSelect: (profileName: string) => void;
}

/**
 * List of target profiles for the "Open in another profile" action.
 * Rendered inside a context menu or dropdown by the consumer.
 */
export function OpenInProfileMenuItems({
  currentProfileName,
  openingProfileName,
  onSelect,
}: OpenInProfileMenuItemsProps) {
  const {
    authStatuses,
    getEnabledProfiles,
    getProfileDisplayName,
    getProfileColor,
    getProfileEnvironment,
  } = useProfileStore();

  const targetProfiles = getEnabledProfiles().filter((p) => p.name !== currentProfileName);

  if (targetProfiles.length === 0) {
    return (
      <div className="px-3 py-1.5 text-sm text-muted-foreground">
        No other profiles available
      </div>
    );
  }

  return (
    <>
      {targetProfiles.map((profile) => {
        const displayName = getProfileDisplayName(profile.name);
        const colorConfig = PROFILE_COLORS.find((c) => c.value === getProfileColor(profile.name));
        const env = getProfileEnvironment(profile.name);
        const isAuthenticated = authStatuses.get(profile.name)?.authenticated;
        const isOpening = openingProfileName === profile.name;

        return (
          <button
            key={profile.name}
            onClick={() => onSelect(profile.name)}
            disabled={openingProfileName !== null}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors',
              openingProfileName !== null && !isOpening && 'opacity-50'
            )}
          >
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                colorConfig?.classes || 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
              )}
            >
              {displayName}
            </span>
            <span className="truncate flex-1">{profile.name}</span>
            {env && (
              <span
                className={cn(
                  'text-[10px] px-1 py-0.5 rounded shrink-0',
                  env === 'prod' && 'bg-red-500/20 text-red-600 dark:text-red-400',
                  env === 'stage' && 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
                  env === 'test' && 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
                  env === 'dev' && 'bg-green-500/20 text-green-600 dark:text-green-400'
                )}
              >
                {env.toUpperCase()}
              </span>
            )}
            {isOpening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : isAuthenticated ? (
              <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : null}
          </button>
        );
      })}
    </>
  );
}

interface OpenInProfileNoticeProps {
  notice: string | null;
  onDismiss: () => void;
}

const NOTICE_AUTO_DISMISS_MS = 5000;

/**
 * Transient bottom-right notice for "Open in another profile" failures
 * (no matching table, login failure, etc.). Auto-dismisses.
 */
export function OpenInProfileNotice({ notice, onDismiss }: OpenInProfileNoticeProps) {
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(onDismiss, NOTICE_AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-popover px-4 py-3 shadow-lg">
      <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
      <span className="text-sm">{notice}</span>
      <button
        onClick={onDismiss}
        className="rounded p-1 hover:bg-muted transition-colors"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
