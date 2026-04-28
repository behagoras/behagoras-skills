import { promises as fs } from 'node:fs';
import path from 'node:path';

/* -----------------------------------------------------------------------------
 * Symlink state machine
 * -----------------------------------------------------------------------------
 *
 * For any symlink we want to create at `linkPath` pointing to `targetPath`,
 * the existing entry at `linkPath` falls into exactly one of these states:
 *
 *   ┌──────────────────────────────┬──────────────────────────────────────────┐
 *   │ State                        │ Action                                   │
 *   ├──────────────────────────────┼──────────────────────────────────────────┤
 *   │ NONE                         │ Create the symlink. (status: 'created')  │
 *   │   (lstat throws ENOENT)      │                                          │
 *   ├──────────────────────────────┼──────────────────────────────────────────┤
 *   │ CORRECT_SYMLINK              │ No-op. (status: 'already')               │
 *   │   (symlink, readlink resolves│                                          │
 *   │    to the same realpath as   │                                          │
 *   │    targetPath)               │                                          │
 *   ├──────────────────────────────┼──────────────────────────────────────────┤
 *   │ DIVERGENT_SYMLINK            │ Without --force: warn + skip.            │
 *   │   (symlink pointing elsewhere│ With    --force: unlink, recreate.       │
 *   │    OR pointing to a missing  │ (status: 'diverged' | 'replaced')        │
 *   │    path → broken-symlink)    │                                          │
 *   ├──────────────────────────────┼──────────────────────────────────────────┤
 *   │ REGULAR_FILE                 │ NEVER overwrite. Error with remediation. │
 *   │ REGULAR_DIR                  │ The user has real data there.            │
 *   │   (not a symlink at all)     │ (status: 'conflict')                     │
 *   └──────────────────────────────┴──────────────────────────────────────────┘
 *
 * Invariant: this module never deletes a non-symlink entry. The only branch
 * that calls `fs.unlink` requires `lstat.isSymbolicLink() === true`.
 *
 * The `--force` flag broadens DIVERGENT_SYMLINK to allow replacement, but it
 * does NOT escalate REGULAR_FILE/REGULAR_DIR to overwrite. That's a deliberate
 * data-safety choice: a foot-gun there clobbers the user's actual content.
 * --------------------------------------------------------------------------- */

export type SymlinkStatus =
  | 'created'
  | 'already'
  | 'diverged'
  | 'replaced'
  | 'conflict-file'
  | 'conflict-dir';

export interface SymlinkResult {
  linkPath: string;
  targetPath: string;
  status: SymlinkStatus;
  /** Where the existing entry pointed (set when status='diverged'/'replaced'). */
  previousTarget?: string;
  message: string;
}

export interface EnsureSymlinkOptions {
  force?: boolean;
}

async function realpathSafe(p: string): Promise<string | null> {
  try {
    return await fs.realpath(p);
  } catch {
    return null;
  }
}

/**
 * Idempotently ensure a symlink at `linkPath` points to `targetPath`.
 * See the state-machine comment block above for the contract.
 */
export async function ensureSymlink(
  linkPath: string,
  targetPath: string,
  opts: EnsureSymlinkOptions = {}
): Promise<SymlinkResult> {
  const { force = false } = opts;
  const targetReal = (await realpathSafe(targetPath)) ?? path.resolve(targetPath);

  let lst;
  try {
    lst = await fs.lstat(linkPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // STATE: NONE
      await fs.mkdir(path.dirname(linkPath), { recursive: true });
      await fs.symlink(targetPath, linkPath);
      return {
        linkPath,
        targetPath,
        status: 'created',
        message: `created: ${linkPath} -> ${targetPath}`,
      };
    }
    throw err;
  }

  if (lst.isSymbolicLink()) {
    const current = await fs.readlink(linkPath);
    const currentResolved = path.resolve(path.dirname(linkPath), current);
    const currentReal = (await realpathSafe(linkPath)) ?? currentResolved;
    if (currentReal === targetReal) {
      // STATE: CORRECT_SYMLINK
      return {
        linkPath,
        targetPath,
        status: 'already',
        message: `already linked: ${linkPath} -> ${targetPath}`,
      };
    }
    // STATE: DIVERGENT_SYMLINK
    if (force) {
      await fs.unlink(linkPath);
      await fs.symlink(targetPath, linkPath);
      return {
        linkPath,
        targetPath,
        status: 'replaced',
        previousTarget: current,
        message: `replaced symlink (was -> ${current}): ${linkPath} -> ${targetPath}`,
      };
    }
    return {
      linkPath,
      targetPath,
      status: 'diverged',
      previousTarget: current,
      message: `existing symlink points elsewhere (-> ${current}); pass --force to replace`,
    };
  }

  // STATE: REGULAR_FILE or REGULAR_DIR — never auto-overwrite, even with --force.
  if (lst.isDirectory()) {
    return {
      linkPath,
      targetPath,
      status: 'conflict-dir',
      message: `path exists as a real directory (refusing to overwrite): ${linkPath}`,
    };
  }
  return {
    linkPath,
    targetPath,
    status: 'conflict-file',
    message: `path exists as a real file (refusing to overwrite): ${linkPath}`,
  };
}

/**
 * Remove a symlink at `linkPath`. Refuses to remove anything that is not a
 * symbolic link. Returns true if a symlink was removed, false if the path
 * did not exist. Throws if the path exists but is a real file/dir.
 */
export async function removeSymlink(linkPath: string): Promise<boolean> {
  let lst;
  try {
    lst = await fs.lstat(linkPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
  if (!lst.isSymbolicLink()) {
    throw new Error(
      `refusing to remove non-symlink at ${linkPath}; remove manually if intentional`
    );
  }
  await fs.unlink(linkPath);
  return true;
}

export interface SymlinkInspection {
  exists: boolean;
  isSymlink: boolean;
  pointsTo?: string;
  resolvedTo?: string;
  broken?: boolean;
  isDirectory?: boolean;
}

/** Inspect a path for symlink/listing logic. Never throws on missing paths. */
export async function inspectSymlink(linkPath: string): Promise<SymlinkInspection> {
  let lst;
  try {
    lst = await fs.lstat(linkPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, isSymlink: false };
    }
    throw err;
  }
  if (!lst.isSymbolicLink()) {
    return {
      exists: true,
      isSymlink: false,
      isDirectory: lst.isDirectory(),
    };
  }
  const pointsTo = await fs.readlink(linkPath);
  const resolved = await realpathSafe(linkPath);
  return {
    exists: true,
    isSymlink: true,
    pointsTo,
    resolvedTo: resolved ?? undefined,
    broken: resolved === null,
  };
}
