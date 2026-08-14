import { ChevronRight } from "lucide-react";
import type { PlanFolder } from "./types";

type PlansSidebarProps = {
  folders: PlanFolder[];
  activeFolderId: string;
  onFolderSelect: (folderId: string) => void;
  isOpen: boolean;
};

export function PlansSidebar({ folders, activeFolderId, onFolderSelect, isOpen }: PlansSidebarProps) {
  return (
    <aside
      className={`rounded-[var(--radius-2xl)] border border-slate-800/80 bg-slate-950 p-3 text-slate-100 shadow-[var(--shadow-small)] ${
        isOpen ? "block" : "hidden lg:block"
      }`}
      aria-label="Folder and discipline navigation"
    >
      <p className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Disciplines</p>
      <nav className="space-y-1" aria-label="Plans folders">
        {folders.map((folder) => (
          <FolderRow key={folder.id} folder={folder} activeFolderId={activeFolderId} onFolderSelect={onFolderSelect} level={0} />
        ))}
      </nav>
      <p className="mt-4 rounded-[var(--radius-lg)] border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
        Nested folders are supported in this structure for future discipline and package hierarchies.
      </p>
    </aside>
  );
}

function FolderRow({
  folder,
  activeFolderId,
  onFolderSelect,
  level,
}: {
  folder: PlanFolder;
  activeFolderId: string;
  onFolderSelect: (folderId: string) => void;
  level: number;
}) {
  const Icon = folder.icon;
  const isActive = folder.id === activeFolderId;

  return (
    <div>
      <button
        type="button"
        onClick={() => onFolderSelect(folder.id)}
        className={`flex w-full items-center gap-2 rounded-[var(--radius-lg)] px-2 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
          isActive
            ? "bg-sky-500/15 text-sky-100"
            : "text-slate-200 hover:bg-slate-900/80 hover:text-white"
        }`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={15} aria-hidden="true" />
        <span className="flex-1">{folder.label}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{folder.count}</span>
        {folder.children && folder.children.length > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
      </button>

      {folder.children && folder.children.length > 0 ? (
        <div className="mt-1 space-y-1">
          {folder.children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              activeFolderId={activeFolderId}
              onFolderSelect={onFolderSelect}
              level={level + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
