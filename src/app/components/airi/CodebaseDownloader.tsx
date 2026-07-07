import { useState } from "react";
import { Download, Github, Code, FileCode, Folder, Loader, ExternalLink, ChevronRight, Search } from "lucide-react";

interface RepoFile {
  path: string;
  type: "file" | "dir";
  size?: number;
  downloadUrl?: string;
}

export default function CodebaseDownloader() {
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["root"]));
  const [downloading, setDownloading] = useState(false);
  const [tree, setTree] = useState<RepoFile[]>([]);

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(".git", "") };
  };

  const fetchRepo = async () => {
    const info = parseGitHubUrl(repoUrl);
    if (!info) {
      setError("Invalid GitHub URL. Use format: https://github.com/owner/repo");
      return;
    }
    setLoading(true);
    setError("");
    setFiles([]);
    setSelectedFiles(new Set());
    try {
      const res = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/git/trees/main?recursive=1`);
      if (!res.ok) {
        const fallback = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/git/trees/master?recursive=1`);
        if (!fallback.ok) throw new Error("Could not fetch repository. Check the URL and branch name.");
        const data = await fallback.json();
        processTree(data);
      } else {
        const data = await res.json();
        processTree(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch repository.");
    } finally {
      setLoading(false);
    }
  };

  const processTree = (data: any) => {
    const items: RepoFile[] = data.tree?.map((item: any) => ({
      path: item.path,
      type: item.type === "tree" ? "dir" : "file",
      size: item.size,
    })) || [];
    setFiles(items);
    setTree(items);
    setExpandedDirs(new Set(["root"]));
    setSelectedFiles(new Set(
      items.filter((f: RepoFile) => f.type === "file" && !f.path.includes("node_modules") && !f.path.startsWith("."))
        .map((f: RepoFile) => f.path)
    ));
  };

  const getDirContents = (prefix: string) => {
    return tree.filter(f => {
      if (prefix === "root") return !f.path.includes("/");
      return f.path.startsWith(prefix + "/") && f.path.replace(prefix + "/", "").split("/").length === 1;
    });
  };

  const toggleDir = (path: string) => {
    setExpandedDirs(p => {
      const next = new Set(p);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleFile = (path: string) => {
    setSelectedFiles(p => {
      const next = new Set(p);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const downloadZip = async () => {
    const info = parseGitHubUrl(repoUrl);
    if (!info || selectedFiles.size === 0) return;
    setDownloading(true);
    try {
      const selected = files.filter(f => f.type === "file" && selectedFiles.has(f.path));
      let code = `// Downloaded from ${repoUrl}\n// Files: ${selected.length}\n\n`;
      for (const file of selected) {
        const res = await fetch(`https://raw.githubusercontent.com/${info.owner}/${info.repo}/main/${file.path}`);
        if (!res.ok) {
          const fallback = await fetch(`https://raw.githubusercontent.com/${info.owner}/${info.repo}/master/${file.path}`);
          if (!fallback.ok) continue;
          const text = await fallback.text();
          code += `// === ${file.path} ===\n${text}\n\n`;
        } else {
          const text = await res.text();
          code += `// === ${file.path} ===\n${text}\n\n`;
        }
      }
      const blob = new Blob([code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${info.repo}-codebase.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const renderTree = (prefix: string, depth: number = 0) => {
    const items = getDirContents(prefix);
    return items.map((item, i) => {
      const isDir = item.type === "dir";
      const isExpanded = expandedDirs.has(item.path);
      const isSelected = selectedFiles.has(item.path);
      const childFiles = isDir ? tree.filter(f => f.path.startsWith(item.path + "/") && f.type === "file") : [];
      const allSelected = childFiles.length > 0 && childFiles.every(f => selectedFiles.has(f.path));

      return (
        <div key={item.path}>
          <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer group"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => isDir ? toggleDir(item.path) : toggleFile(item.path)}>
            {isDir ? (
              <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} style={{ color: "#9b8ec4" }} />
            ) : (
              <span className="w-3" />
            )}
            {isDir
              ? <Folder className="h-3.5 w-3.5" style={{ color: "#00F2FF" }} />
              : <FileCode className="h-3.5 w-3.5" style={{ color: "#9b8ec4" }} />
            }
            <span className="text-[11px] flex-1 truncate" style={{ color: "#f0e8d8" }}>{isDir ? item.path.split("/").pop() : item.path.split("/").pop()}</span>
            {isDir ? (
              <span className="text-[9px]" style={{ color: "#9b8ec4" }}>
                {tree.filter(f => f.path.startsWith(item.path + "/") && f.type === "file").length} files
              </span>
            ) : (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <input type="checkbox" checked={isSelected} onChange={() => toggleFile(item.path)}
                  className="h-3 w-3 accent-[#FF2D55] cursor-pointer" />
              </div>
            )}
          </div>
          {isDir && isExpanded && renderTree(item.path, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 p-5 rounded-2xl backdrop-blur-md shadow-2xl" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(112,0,255,0.15)", border: "1px solid rgba(112,0,255,0.3)" }}>
            <Code className="h-5 w-5" style={{ color: "#7000FF" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "#f0e8d8" }}>Codebase Downloader</h3>
            <p className="text-xs" style={{ color: "#9b8ec4" }}>Fetch & explore GitHub repos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9b8ec4" }} />
            <input type="text" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchRepo()}
              placeholder="https://github.com/owner/repo"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none"
              style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0e8d8" }} />
          </div>
          <button onClick={fetchRepo} disabled={loading || !repoUrl.trim()}
            className="p-2.5 rounded-xl disabled:opacity-40 cursor-pointer"
            style={{ background: "#7000FF", color: "#fff" }}>
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg p-2.5 text-[10px] font-mono" style={{ background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.2)", color: "#FF2D55" }}>
            {error}
          </div>
        )}
      </div>

      <div className="lg:col-span-7 p-5 rounded-2xl backdrop-blur-md shadow-2xl" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {files.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Github className="h-4 w-4" style={{ color: "#9b8ec4" }} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: "#9b8ec4" }}>
                  {files.filter(f => f.type === "file").length} files
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "#9b8ec4" }}>
                  {selectedFiles.size} selected
                </span>
                <button onClick={downloadZip} disabled={selectedFiles.size === 0 || downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40 cursor-pointer"
                  style={{ background: "linear-gradient(90deg, #FF2D55, #7000FF)", color: "#fff" }}>
                  {downloading ? <Loader className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  {downloading ? "Downloading..." : "Download"}
                </button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="max-h-80 overflow-y-auto py-1">
                {renderTree("root")}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[300px] border border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <Code className="h-12 w-12 mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <h4 className="text-sm font-semibold" style={{ color: "#c8b8f0" }}>No repository loaded</h4>
            <p className="text-xs mt-1" style={{ color: "#9b8ec4" }}>Enter a GitHub URL above to browse and download files</p>
          </div>
        )}
      </div>
    </div>
  );
}
